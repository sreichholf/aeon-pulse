import * as THREE from 'three';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.ts';
import { InputManager } from './InputManager.ts';
import { AudioManager } from './audio/AudioManager.ts';
import { ScoreManager } from './ScoreManager.ts';
import { tickGameplay, type WorldState } from './Gameplay.ts';
import { checkCollisions, type CollisionContact } from './Collisions.ts';
import { HitCause, HitEventKind, resolveCollisionContacts, resolveAreaDamage, type HitEvent } from './CombatResolution.ts';
import { ProjectilePool } from './ProjectilePool.ts';
import { Player } from '../entities/Player.ts';
import { PowerUp } from '../entities/PowerUp.ts';
import { Explosion } from '../entities/Explosion.ts';
import { CancellationPointItem } from '../entities/CancellationPointItem.ts';
import { spawnEnemy, spawnBoss } from '../entities/EntityRegistry.ts';
import { createProp } from '../entities/PropRegistry.ts';
import { LevelManager, type LevelGameHost } from '../level/LevelManager.ts';
import { resolveLevelContent, type ResolvedLevelContent } from '../level/ResolvedLevelContent.ts';
import { StageEventType, type StageEvent } from '../level/StageEvents.ts';
import type { CampaignLevelRecord } from '../campaign/Campaign.ts';
import { CampaignAttempt } from '../campaign/CampaignAttempt.ts';
import { measurePerfPhase, recordPerfEvent, setPerfCount, setPerfLabel } from './PerfProbe.ts';
import {
  displaceSpawnYFromSolidProps,
  overlapsSolidProp,
  resolveSolidPropBodyPosition,
  validateSolidPropPlacement,
} from './SolidPropPhysicality.ts';

import {
  DifficultyMode,
  EnemyType,
  PropEffectKind,
  PropType,
  type IBackgroundWithSpeed,
  type IBoss,
  type IBullet,
  type IEffect,
  type IEnemy,
  type IPowerUp,
  type IProp,
  type IScene,
  type ITerrain,
  type PlayfieldBounds,
  PowerUpType,
} from '../types.ts';

const LEVEL_EXIT_HOLD_DURATION = 2.0;
const LEVEL_EXIT_FLYOUT_DURATION = 1.5;

const HP_BONUS_BY_CHAPTER: Readonly<Record<number, number>> = { 1: 0, 2: 1, 3: 2, 4: 3 };
const ARMORED_ENEMY_TYPES: ReadonlySet<EnemyType> = new Set<EnemyType>([
  EnemyType.STRAIGHT,
  EnemyType.SWARM,
  EnemyType.CHARGER,
  EnemyType.STALACTITE,
  EnemyType.SINE,
  EnemyType.DIVER,
]);

export interface HUDSnapshot {
  score: number;
  hiScore: number;
  lives: number;
  bombs: number;
  maxBombs: number;
  chargeLevel: number;
  weaponTier: number;
  shieldPips: number;
  shieldMax: number;
  shieldRegenPct: number;
}

export interface BulletStatsSnapshot {
  total: number;
  renderUnits: number;
  byType: Record<string, number>;
  bySourceKey: Record<string, number>;
  renderUnitsBySourceKey: Record<string, number>;
}

export interface GameplayPlaytestSnapshot {
  scrollX: number | null;
  enemyCount: number;
  bulletCount: number;
  powerupCount: number;
  effectCount: number;
  bossActive: boolean;
  isExitingLevel: boolean;
  enemiesByType: Record<string, number>;
}

interface GameplayRunDeps {
  scene: IScene;
  sprites: Record<string, THREE.Texture>;
  input: InputManager;
  audio: AudioManager;
  score: ScoreManager;
  onLevelComplete: () => void;
  invinciblePlayer?: boolean;
  playerModel?: THREE.Group | null;
}


export class GameplayRun implements LevelGameHost {
  background: IBackgroundWithSpeed | null;
  private _player: Player | null;
  private _bullets: IBullet[];
  private _enemies: IEnemy[];
  private _powerups: IPowerUp[];
  private _effects: IEffect[];
  private _props: IProp[];
  private _boss: IBoss | null;
  private _levelManager: LevelManager | null;
  private _terrain: ITerrain | null;
  private _playfieldBounds: PlayfieldBounds | null;
  private _playfieldMargins: { top: number; bottom: number } | null;
  private _projectilePool: ProjectilePool;
  private _deps: GameplayRunDeps;
  private _level: CampaignLevelRecord | null;
  private _resolvedLevelContent: ResolvedLevelContent | null;
  private _isExitingLevel: boolean;
  private _enemyTypes: WeakMap<IEnemy, EnemyType>;
  private _pendingPlayerHitEvent: HitEvent | null = null;
  private _deathBombTimer: number = 0;
  private _hasPendingLevelComplete = false;

  private _attempt: CampaignAttempt | null;

  constructor(deps: GameplayRunDeps) {
    this._deps = deps;
    this.background = null;
    this._player = null;
    this._bullets = [];
    this._enemies = [];
    this._powerups = [];
    this._effects = [];
    this._props = [];
    this._boss = null;
    this._levelManager = null;
    this._terrain = null;
    this._playfieldBounds = null;
    this._playfieldMargins = null;
    this._projectilePool = new ProjectilePool(deps.scene, deps.sprites);
    this._level = null;
    this._resolvedLevelContent = null;
    this._isExitingLevel = false;
    this._attempt = null;
    this._enemyTypes = new WeakMap();
  }

  start(attempt: CampaignAttempt, mode: DifficultyMode): void {
    this._attempt = attempt;
    const level = attempt.level;
    const content = resolveLevelContent(level);
    this._level = level;
    this._resolvedLevelContent = content;

    this.background = content.createBackground(this._deps.scene);
    this._bullets = [];
    this._enemies = [];
    this._powerups = [];
    this._effects = [];
    this._props = [];
    this._boss = null;
    this._isExitingLevel = false;
    this._player = new Player(
      this._deps.scene,
      this._deps.sprites,
      this._deps.input,
      this._deps.audio,
      (spawn) => this._projectilePool.create(spawn),
      mode,
      this._deps.invinciblePlayer ?? false,
      this._deps.playerModel,
      this._attempt,
    );

    this._player.setWeapon(attempt.weaponTier);

    this._levelManager = new LevelManager(this, content);
    this._terrain = content.createTerrain(this._deps.scene);
    this._playfieldMargins = content.playfieldMargins;
    this._playfieldBounds = this._composePlayfieldBounds(content.playfieldBounds, this._playfieldMargins);
    this._player.terrainBounds = this._playfieldBounds;
    this._enemyTypes = new WeakMap();
  }

  private _composePlayfieldBounds(
    base: PlayfieldBounds | null,
    margins: { top: number; bottom: number } | null,
  ): PlayfieldBounds | null {
    if (!base) return null;
    if (!margins) return base;
    return {
      top: base.top - margins.top,
      bottom: base.bottom + margins.bottom,
    };
  }

  private _getActiveCorridorBoundsAt(x: number): PlayfieldBounds | null {
    if (this._terrain && this._levelManager) {
      const walls = this._terrain.getCollisionWallsAt(this._levelManager.scrollX + x);
      return this._composePlayfieldBounds(walls, this._playfieldMargins);
    }
    return this._playfieldBounds;
  }

  tick(dt: number): void {
    this._hasPendingLevelComplete = false;
    if (this._isExitingLevel) {
      this._tickLevelExit(dt);
      return;
    }

    this._tickBombs(dt);
    const world = this._buildWorldState();
    this._tickWorld(world, dt);
    this._syncWorldArrays(world);
    this._recordGameplayProbeContext();
    this._applyEnemySolidPropRepulsion();
    this._resolveTimedBursts();

    if (this._isExitingLevel) {
      this._clearHostileBullets();
      return;
    }

    this._resolveCombat();
  }

  private _tickBombs(dt: number): void {
    if (this._pendingPlayerHitEvent) {
      this._deathBombTimer -= dt;
      if (this._player && this._deps.input.wasJustPressed('BOMB') && this._player.useBomb()) {
        this._pendingPlayerHitEvent = null;
        this._triggerSmartBomb();
      } else if (this._deathBombTimer <= 0) {
        this._applyPlayerHit(this._pendingPlayerHitEvent);
        this._pendingPlayerHitEvent = null;
      }
    } else {
      if (this._player && this._deps.input.wasJustPressed('BOMB')) {
        if (this._player.useBomb()) {
          this._triggerSmartBomb();
        }
      }
    }
  }

  private _buildWorldState(): WorldState {
    return {
      background: this.background,
      terrain: this._terrain,
      levelManager: this._levelManager,
      player: this._player,
      enemies: this._enemies,
      boss: this._boss,
      bullets: this._bullets,
      powerups: this._powerups,
      effects: this._effects,
      props: this._props,
      playfieldMargins: this._playfieldMargins,
      destroyOrReleaseBullet: (bullet) => this._projectilePool.destroyOrRelease(bullet),
    };
  }

  private _tickWorld(world: WorldState, dt: number): void {
    measurePerfPhase('run.tickGameplay', () => tickGameplay(world, dt));
  }

  private _syncWorldArrays(world: WorldState): void {
    this._enemies = world.enemies;
    this._bullets = world.bullets;
    this._powerups = world.powerups;
    this._effects = world.effects;
    this._props = world.props;
    setPerfCount('enemies', this._enemies.length);
    setPerfCount('bullets', this._bullets.length);
    setPerfCount('powerups', this._powerups.length);
    setPerfCount('effects', this._effects.length);
    setPerfCount('props', this._props.length);
  }

  private _resolveTimedBursts(): void {
    // Consume Timed Burst detonations post-tick (props set isBursting during
    // tickGameplay; resolving here avoids mutating collections mid-tick).
    for (const prop of this._props) {
      const burst = prop.consumeBurst();
      if (burst) this._handleHit({ kind: HitEventKind.PROP_DESTROYED, result: burst });
    }
  }

  private _resolveCombat(): void {
    const contacts: CollisionContact[] = [];
    measurePerfPhase('run.collisions', () => {
      checkCollisions(
        {
          player: this._player,
          enemies: this._enemies,
          boss: this._boss,
          bullets: this._bullets,
          powerups: this._powerups,
          props: this._props,
        },
        (contact) => contacts.push(contact),
      );
    });
    setPerfCount('contacts', contacts.length);
    measurePerfPhase('run.resolveContacts', () => {
      resolveCollisionContacts(contacts, (event) => this._handleHit(event));
    });
  }

  get hasPendingLevelComplete(): boolean { return this._hasPendingLevelComplete; }

  getHUDSnapshot(): HUDSnapshot {
    return {
      score: this._deps.score.score,
      hiScore: this._deps.score.hiScore,
      lives: this._deps.score.lives,
      bombs: this._player?.bombStock ?? 0,
      maxBombs: 4,
      chargeLevel: this._player?.chargeLevel ?? 0,
      weaponTier: this._player?.weaponTier ?? 1,
      shieldPips: this._player?.shieldPips ?? 0,
      shieldMax: this._player?.shieldMax ?? 0,
      shieldRegenPct: this._player?.shieldRegenPct ?? 0,
    };
  }

  getBulletStatsSnapshot(): BulletStatsSnapshot {
    const byType: Record<string, number> = {};
    const bySourceKey: Record<string, number> = {};
    const renderUnitsBySourceKey: Record<string, number> = {};
    let renderUnits = 0;

    for (const bullet of this._bullets) {
      byType[bullet.type] = (byType[bullet.type] ?? 0) + 1;
      const sourceKey = bullet.sourceKey ?? bullet.type;
      const bulletRenderUnits = bullet.renderUnitCount ?? 1;
      bySourceKey[sourceKey] = (bySourceKey[sourceKey] ?? 0) + 1;
      renderUnitsBySourceKey[sourceKey] = (renderUnitsBySourceKey[sourceKey] ?? 0) + bulletRenderUnits;
      renderUnits += bulletRenderUnits;
    }

    return {
      total: this._bullets.length,
      renderUnits,
      byType,
      bySourceKey,
      renderUnitsBySourceKey,
    };
  }

  getPlaytestSnapshot(): GameplayPlaytestSnapshot {
    const enemiesByType: Record<string, number> = {};
    for (const enemy of this._enemies) {
      const type = this._enemyTypes.get(enemy);
      if (!type) continue;
      enemiesByType[type] = (enemiesByType[type] ?? 0) + 1;
    }

    return {
      scrollX: this._levelManager ? Math.round(this._levelManager.scrollX) : null,
      enemyCount: this._enemies.length,
      bulletCount: this._bullets.length,
      powerupCount: this._powerups.length,
      effectCount: this._effects.length,
      bossActive: this._boss !== null,
      isExitingLevel: this._isExitingLevel,
      enemiesByType,
    };
  }

  clear(): void {
    this.background?.destroy();
    this.background = null;

    this._player?.destroy();
    this._player = null;

    for (const enemy of this._enemies) enemy.destroy();
    this._enemies = [];

    for (const bullet of this._bullets) this._projectilePool.destroyOrRelease(bullet);
    this._bullets = [];
    this._projectilePool.clear();

    for (const powerup of this._powerups) powerup.destroy();
    this._powerups = [];

    for (const effect of this._effects) effect.destroy();
    this._effects = [];

    for (const prop of this._props) prop.destroy();
    this._props = [];

    this._boss?.destroy();
    this._boss = null;

    this._levelManager?.destroy();
    this._levelManager = null;

    this._terrain?.destroy?.();
    this._terrain = null;
    this._playfieldBounds = null;
    this._playfieldMargins = null;
    this._resolvedLevelContent = null;
    this._isExitingLevel = false;
    this._pendingPlayerHitEvent = null;
    this._deathBombTimer = 0;
    this._hasPendingLevelComplete = false;

    this._deps.scene.camera.position.set(0, 0, 100);
  }

  handleStageEvent(event: StageEvent): void {
    recordPerfEvent('stageEvent', {
      kind: event.kind,
      enemyType: event.kind === StageEventType.SPAWN_ENEMY ? event.enemyType : null,
      x: event.kind === StageEventType.SPAWN_ENEMY ? Math.round(event.x) : null,
      y: event.kind === StageEventType.SPAWN_ENEMY ? Math.round(event.y) : null,
      scrollX: Math.round(this._levelManager?.scrollX ?? 0),
    });

    switch (event.kind) {
      case StageEventType.SPAWN_ENEMY:
        this.spawnEnemy(event.enemyType, event.x, event.y);
        break;
      case StageEventType.SPAWN_PROP:
        this.spawnProp(event.propType, event.x, event.y, { isFullGate: event.isFullGate, burstWindow: event.burstWindow });
        break;
      case StageEventType.LAVA_PULSE:
        this._terrain?.triggerLavaPulse?.();
        break;
    }
  }

  spawnEnemy(type: EnemyType, x: number, y: number): void {
    const enemy = spawnEnemy(type, {
      scene: this._deps.scene,
      sprites: this._deps.sprites,
      x,
      y,
      getPos: () => ({ x: this._player?.x ?? 0, y: this._player?.y ?? 0 }),
      audio: this._deps.audio,
      getScrollX: () => this._levelManager?.scrollX ?? 0,
      terrain: this._terrain,
      projectileFactory: (spawn) => this._projectilePool.create(spawn),
    });

    if (enemy) {
      this._enemyTypes.set(enemy, type);
      const chapter = this._level?.chapterNumber ?? 1;
      const armored = chapter >= 2 && ARMORED_ENEMY_TYPES.has(type);
      const hpBonus = armored ? 0 : (HP_BONUS_BY_CHAPTER[chapter] ?? 0);
      if (hpBonus > 0 || armored) {
        enemy.applyDurabilityScaling(hpBonus, armored);
      }
      if (enemy.isSpaceShip) {
        if (this._playfieldBounds) {
          enemy.terrainBounds = this._playfieldBounds;
          enemy.y = Math.max(
            this._playfieldBounds.bottom + enemy.hh,
            Math.min(this._playfieldBounds.top - enemy.hh, enemy.y),
          );
        }

        if (this._terrain && this._levelManager) {
          const scrollX = this._levelManager.scrollX;
          const walls = this._terrain.getCollisionWallsAt(scrollX + enemy.x);
          const bounds = this._playfieldMargins
            ? { top: walls.top - this._playfieldMargins.top, bottom: walls.bottom + this._playfieldMargins.bottom }
            : walls;
          enemy.y = Math.max(bounds.bottom + enemy.hh, Math.min(bounds.top - enemy.hh, enemy.y));
        }

        enemy.y = this._clampSpawnAwayFromSolidProps(enemy.x, enemy.y, enemy.hw, enemy.hh);
      }

      this._enemies.push(enemy);
      recordPerfEvent('enemySpawned', {
        enemyType: type,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        scrollX: Math.round(this._levelManager?.scrollX ?? 0),
      });
    }
  }

  spawnProp(
    propType: PropType,
    x: number,
    y: number,
    overrides?: { isFullGate?: boolean; burstWindow?: number },
  ): void {
    const scrollSpeed = this.background?.baseSpeed ?? 100;
    const prop = createProp(this._deps.scene, propType, x, y, scrollSpeed, overrides);
    this._validateSolidPropSpawn(prop);
    this._props.push(prop);
  }

  private _validateSolidPropSpawn(prop: IProp): void {
    if (!prop.isSolid) return;
    for (const issue of validateSolidPropPlacement(prop, GAME_WIDTH / 2 - 120, this._getActiveCorridorBoundsAt(prop.x))) {
      console.error(issue);
    }
  }

  private _clampSpawnAwayFromSolidProps(x: number, y: number, hw: number, hh: number): number {
    const solidBounds = this._props
      .filter((prop) => prop.isAlive && prop.isSolid)
      .map((prop) => prop.getSolidBounds())
      .filter((bounds): bounds is NonNullable<typeof bounds> => bounds !== null);
    return displaceSpawnYFromSolidProps(x, y, hw, hh, solidBounds, this._getActiveCorridorBoundsAt(x));
  }

  private _applyEnemySolidPropRepulsion(): void {
    for (const prop of this._props) {
      if (!prop.isAlive || !prop.isSolid) continue;
      const bounds = prop.getSolidBounds();
      if (!bounds) continue;

      for (const enemy of this._enemies) {
        if (!enemy.isAlive) continue;
        if (!overlapsSolidProp(bounds, enemy)) continue;
        const next = resolveSolidPropBodyPosition(bounds, enemy);
        if (next.x === enemy.x && next.y === enemy.y) continue;
        if (typeof (enemy as { setPosition?: (x: number, y: number) => void }).setPosition === 'function') {
          (enemy as { setPosition(x: number, y: number): void }).setPosition(next.x, next.y);
        } else {
          (enemy as { x: number }).x = next.x;
          (enemy as { y: number }).y = next.y;
        }
      }
    }
  }

  hasEnemyNear(x: number, y: number, radius: number): boolean {
    for (const enemy of this._enemies) {
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        return true;
      }
    }
    return false;
  }

  spawnBoss(): void {
    const level = this._level;
    if (!level?.finaleBossArchetype) return;

    const onDeath = () => {
      this._triggerBulletCancellation();
      this._deps.score.addScore(this._boss?.score ?? 5000);
      if (level.isFinale) {
        this._deps.score.gainLife();
      }
      this._boss = null;
      this._hasPendingLevelComplete = true;
    };

    this._boss = spawnBoss(level.finaleBossArchetype, {
      scene: this._deps.scene,
      sprites: this._deps.sprites,
      getPos: () => ({ x: this._player?.x ?? 0, y: this._player?.y ?? 0 }),
      onDeath,
      audio: this._deps.audio,
      spawnEnemyCallback: (type, x, y) => this.spawnEnemy(type, x, y),
      projectileFactory: (spawn) => this._projectilePool.create(spawn),
    });
    if (this._playfieldBounds) {
      this._boss.playfieldBounds = this._playfieldBounds;
    }
  }

  completeLevel(): void {
    this._beginLevelExit();
  }

  isLevelClearGateOpen(): boolean {
    return this._enemies.length === 0 && this._powerups.length === 0;
  }

  private _beginLevelExit(): void {
    if (this._isExitingLevel) return;
    this._isExitingLevel = true;
    this._clearHostileBullets();
    this._player?.beginLevelExit(LEVEL_EXIT_HOLD_DURATION, LEVEL_EXIT_FLYOUT_DURATION);
  }

  private _clearHostileBullets(): void {
    this._bullets = this._bullets.filter((bullet) => {
      if (bullet.isPlayerBullet) return true;
      this._projectilePool.destroyOrRelease(bullet);
      return false;
    });
  }

  private _triggerBulletCancellation(fromBomb: boolean = false): void {
    this._bullets = this._bullets.filter((bullet) => {
      if (bullet.isPlayerBullet || !bullet.active) return true;
      
      this._effects.push(
        new CancellationPointItem(
          this._deps.scene,
          bullet.x,
          bullet.y,
          () => ({ x: this._player?.x ?? 0, y: this._player?.y ?? 0 }),
          (amount: number) => {
            if (!fromBomb) {
              this._deps.score.addScore(amount);
              this._deps.audio.play('scoreCollect');
            }
          }
        )
      );

      this._projectilePool.destroyOrRelease(bullet);
      return false;
    });
  }

  private _clearBulletsInRadius(x: number, y: number, radius: number): void {
    const r2 = radius * radius;
    this._bullets = this._bullets.filter((bullet) => {
      if (bullet.isPlayerBullet || !bullet.active) return true;
      const dx = bullet.x - x;
      const dy = bullet.y - y;
      if (dx * dx + dy * dy > r2) return true;
      this._effects.push(
        new CancellationPointItem(
          this._deps.scene,
          bullet.x,
          bullet.y,
          () => ({ x: this._player?.x ?? 0, y: this._player?.y ?? 0 }),
          (amount: number) => {
            this._deps.score.addScore(amount);
            this._deps.audio.play('scoreCollect');
          }
        )
      );
      this._projectilePool.destroyOrRelease(bullet);
      return false;
    });
  }

  private _triggerSmartBomb(): void {
    this._triggerBulletCancellation(true);

    this._deps.scene.flash(0.35);
    this._deps.audio.play('explosion'); 

    for (let i = 0; i < 8; i++) {
      this._effects.push(new Explosion(this._deps.scene, 
        (Math.random() - 0.5) * 800, (Math.random() - 0.5) * 500,
        { count: 24, minSpeed: 100, maxSpeed: 500, size: 8, color: 0x00ffff, duration: 0.8 }
      ));
    }

    const halfW = 960 / 2; // GAME_WIDTH / 2

    resolveAreaDamage(
      {
        enemyDamage: 200,
        bossDamagePct: 0.2,
        activeBounds: { minX: -halfW - 50, maxX: halfW + 50 }
      },
      { enemies: this._enemies, boss: this._boss, props: this._props },
      (event) => this._handleHit(event)
    );
  }

  private _recordGameplayProbeContext(): void {
    if (this._level) {
      setPerfLabel('level.id', this._level.id);
      setPerfLabel('level.chapter', this._level.chapterName);
    }
    setPerfCount('level.scrollX', Math.round(this._levelManager?.scrollX ?? 0));

    const byType: Partial<Record<EnemyType, number>> = {};
    for (const enemy of this._enemies) {
      const type = this._enemyTypes.get(enemy);
      if (!type) continue;
      byType[type] = (byType[type] ?? 0) + 1;
    }

    for (const type of Object.values(EnemyType)) {
      setPerfCount(`enemyType.${type}`, byType[type] ?? 0);
    }
  }

  private _tickLevelExit(dt: number): void {
    this.background?.update(dt);

    if (this._terrain && this._levelManager) {
      this._terrain.update?.(this._levelManager.scrollX, dt);
    }
    this._player?.update(dt);

    for (const bullet of this._bullets) bullet.update(dt);
    this._bullets = this._bullets.filter((bullet) => {
      if (bullet.isOffscreen || !bullet.active) {
        this._projectilePool.destroyOrRelease(bullet);
        return false;
      }
      return true;
    });

    for (const effect of this._effects) effect.update(dt);
    this._effects = this._effects.filter((effect) => {
      if (effect.isDone) {
        effect.destroy();
        return false;
      }
      return true;
    });

    if (this._player?.isExitComplete) {
      this._isExitingLevel = false;
      this._deps.onLevelComplete();
    }
  }

  private _handleHit(event: HitEvent): void {
    switch (event.kind) {
      case HitEventKind.ENEMY_KILLED:
        if ((event as any).triggerCancellation) {
          this._triggerBulletCancellation();
        }
        this._deps.score.addScore(event.score);
        this._deps.audio.play('explosion');
        this._effects.push(new Explosion(this._deps.scene, event.x, event.y,
          { count: 16, minSpeed: 50, maxSpeed: 180, size: 5, color: 0xff8800, duration: 0.4 }));
        if (event.dropPowerup) {
          const type = Math.random() < 0.05 ? PowerUpType.BOMB : PowerUpType.WEAPON;
          this._powerups.push(new PowerUp(this._deps.scene, event.x, event.y, type));
        }
        break;
      case HitEventKind.BOSS_HIT:
        this._deps.audio.play('explosion');
        this._effects.push(new Explosion(this._deps.scene, event.x, event.y,
          { count: 10, minSpeed: 40, maxSpeed: 120, size: 4, color: 0xffffff, duration: 0.25 }));
        break;
      case HitEventKind.PROP_DESTROYED: {
        const r = event.result;
        if (r.effects.includes(PropEffectKind.BULLET_CLEAR) && r.clearRadius > 0) {
          this._clearBulletsInRadius(r.x, r.y, r.clearRadius);
        }
        if (r.effects.includes(PropEffectKind.SCORE_DROP)) {
          this._deps.score.addScore(r.scoreValue);
        }
        if (r.effects.includes(PropEffectKind.POWERUP_DROP) && r.dropPowerup) {
          const type = Math.random() < 0.05 ? PowerUpType.BOMB : PowerUpType.WEAPON;
          this._powerups.push(new PowerUp(this._deps.scene, r.x, r.y, type));
        }
        if (r.effects.includes(PropEffectKind.HAZARD_RELEASE) && r.hazardRadius > 0) {
          this._effects.push(new Explosion(this._deps.scene, r.x, r.y,
            { count: 24, minSpeed: 60, maxSpeed: r.hazardRadius * 2, size: 7, color: 0xff3322, duration: r.hazardDuration }));
        }
        this._deps.audio.play('explosion');
        this._effects.push(new Explosion(this._deps.scene, r.x, r.y,
          { count: 18, minSpeed: 50, maxSpeed: 200, size: 6, color: 0xffaa44, duration: 0.45 }));
        break;
      }
      case HitEventKind.PLAYER_HIT: {
        if (this._pendingPlayerHitEvent) break; // ignore hits while pending
        if (this._player && this._player.bombStock > 0) {
          this._pendingPlayerHitEvent = event;
          this._deathBombTimer = 0.075;
          break;
        }
        this._applyPlayerHit(event);
        break;
      }
      case HitEventKind.POWERUP_COLLECTED: {
        if (this._player) {
          if (event.powerup.type === PowerUpType.BOMB) {
            const added = this._player.collectBomb();
            if (added) {
              this._deps.audio.play('powerUp');
              this._effects.push(new Explosion(this._deps.scene, this._player.x, this._player.y,
                { count: 15, minSpeed: 80, maxSpeed: 160, size: 5, color: 0xffaa00, duration: 0.35 }));
            } else {
              this._deps.score.addScore(2000);
              this._effects.push(new Explosion(this._deps.scene, event.powerup.x, event.powerup.y,
                { count: 10, minSpeed: 40, maxSpeed: 120, size: 4, color: 0xffaa00, duration: 0.25 }));
              this._deps.audio.play('scoreCollect');
            }
          } else {
            const upgraded = this._player.upgradeWeapon(this._level?.softTierCap ?? 5);
            if (upgraded) {
              this._effects.push(new Explosion(this._deps.scene, event.powerup.x, event.powerup.y,
                { count: 12, minSpeed: 60, maxSpeed: 140, size: 5, color: 0xff00ee, duration: 0.30 }));
            } else {
              const shieldRefilled = this._player.refillShield();
              if (shieldRefilled) {
                this._effects.push(new Explosion(this._deps.scene, this._player.x, this._player.y,
                  { count: 15, minSpeed: 80, maxSpeed: 160, size: 5, color: 0x00ffcc, duration: 0.35 }));
              } else {
                this._deps.score.addScore(1000);
                this._effects.push(new Explosion(this._deps.scene, event.powerup.x, event.powerup.y,
                  { count: 10, minSpeed: 40, maxSpeed: 120, size: 4, color: 0xffaa00, duration: 0.25 }));
                this._deps.audio.play('scoreCollect');
              }
            }
          }
        }
        event.powerup.destroy();
        this._powerups.splice(this._powerups.indexOf(event.powerup), 1);
        break;
      }
    }
  }

  private _applyPlayerHit(event: HitEvent): void {
    if (event.kind !== HitEventKind.PLAYER_HIT) return;
    this._player?.applyDeathPenalty();
    this._deps.score.loseLife();
    this._deps.scene.flash(0.12);
    const color = event.cause === HitCause.TERRAIN ? 0x00aaff
                : event.cause === HitCause.LASER   ? 0x00ffee
                : 0xaa3bff;
    this._effects.push(new Explosion(this._deps.scene, event.x, event.y,
      { count: 20, minSpeed: 80, maxSpeed: 260, size: 6, color, duration: 0.5 }));
  }
}


