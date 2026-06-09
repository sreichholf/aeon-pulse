import * as THREE from 'three';
import { InputManager } from './InputManager.ts';
import { AudioManager } from './audio/AudioManager.ts';
import { ScoreManager } from './ScoreManager.ts';
import { tickGameplay, type WorldState } from './Gameplay.ts';
import { checkCollisions, type CollisionContact } from './Collisions.ts';
import { HitCause, HitEventKind, resolveCollisionContacts, type HitEvent } from './CombatResolution.ts';
import { ProjectilePool } from './ProjectilePool.ts';
import { Player } from '../entities/Player.ts';
import type { WeaponTierValue } from '../entities/Player.ts';
import { PowerUp } from '../entities/PowerUp.ts';
import { Explosion } from '../entities/Explosion.ts';
import { spawnEnemy, spawnBoss } from '../entities/EntityRegistry.ts';
import { LevelManager, type LevelGameHost } from '../level/LevelManager.ts';
import { LEVELS } from '../level/Levels.ts';
import { StageEventType, type StageEvent } from '../level/StageEvents.ts';
import type { CampaignLevelRecord } from '../campaign/Campaign.ts';
import { CampaignAttempt } from '../campaign/CampaignAttempt.ts';

import {
  DifficultyMode,
  type EnemyType,
  type IBackgroundWithSpeed,
  type IBoss,
  type IBullet,
  type IEffect,
  type IEnemy,
  type IPowerUp,
  type IScene,
  type ITerrain,
  type PlayfieldBounds,
} from '../types.ts';

const LEVEL_EXIT_HOLD_DURATION = 2.0;
const LEVEL_EXIT_FLYOUT_DURATION = 1.5;

export interface HUDSnapshot {
  score: number;
  hiScore: number;
  lives: number;
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
  private _boss: IBoss | null;
  private _levelManager: LevelManager | null;
  private _terrain: ITerrain | null;
  private _playfieldBounds: PlayfieldBounds | null;
  private _projectilePool: ProjectilePool;
  private _deps: GameplayRunDeps;
  private _level: CampaignLevelRecord | null;
  private _isExitingLevel: boolean;
  private _levelExitHoldTimer: number;
  private _levelExitTimer: number;
  private _levelExitFlyoutStarted: boolean;

  private _attempt: CampaignAttempt | null;

  constructor(deps: GameplayRunDeps) {
    this._deps = deps;
    this.background = null;
    this._player = null;
    this._bullets = [];
    this._enemies = [];
    this._powerups = [];
    this._effects = [];
    this._boss = null;
    this._levelManager = null;
    this._terrain = null;
    this._playfieldBounds = null;
    this._projectilePool = new ProjectilePool(deps.scene, deps.sprites);
    this._level = null;
    this._isExitingLevel = false;
    this._attempt = null;
    this._levelExitHoldTimer = 0;
    this._levelExitTimer = 0;
    this._levelExitFlyoutStarted = false;
  }

  start(attempt: CampaignAttempt, mode: DifficultyMode): void {
    this._attempt = attempt;
    const level = attempt.level;
    const levelDef = LEVELS[level.archetype]!;
    this._level = level;

    this.background = levelDef.createBackground(this._deps.scene);
    this._bullets = [];
    this._enemies = [];
    this._powerups = [];
    this._effects = [];
    this._boss = null;
    this._isExitingLevel = false;
    this._levelExitHoldTimer = 0;
    this._levelExitTimer = 0;
    this._levelExitFlyoutStarted = false;
    this._player = new Player(
      this._deps.scene,
      this._deps.sprites,
      this._deps.input,
      this._deps.audio,
      (spawn) => this._projectilePool.create(spawn),
      mode,
      this._deps.invinciblePlayer ?? false,
      this._deps.playerModel,
    );

    if (attempt.weaponTier > 1) {
      this._player.weaponTier = attempt.weaponTier as WeaponTierValue;
    }
    this._player.resetShield();

    this._levelManager = new LevelManager(this, level);
    this._terrain = levelDef.createTerrain?.(this._deps.scene, levelDef.terrainPoints) ?? null;
    this._playfieldBounds = levelDef.playfieldBounds;
    this._player.terrainBounds = this._playfieldBounds;
  }

  tick(dt: number): void {
    if (this._isExitingLevel) {
      this._tickLevelExit(dt);
      return;
    }

    const world: WorldState = {
      background: this.background,
      terrain: this._terrain,
      levelManager: this._levelManager,
      player: this._player,
      enemies: this._enemies,
      boss: this._boss,
      bullets: this._bullets,
      powerups: this._powerups,
      effects: this._effects,
      destroyOrReleaseBullet: (bullet) => this._projectilePool.destroyOrRelease(bullet),
    };

    tickGameplay(world, dt);
    this._enemies = world.enemies;
    this._bullets = world.bullets;
    this._powerups = world.powerups;
    this._effects = world.effects;

    if (this._isExitingLevel) {
      this._clearHostileBullets();
      return;
    }

    const contacts: CollisionContact[] = [];
    checkCollisions(
      {
        player: this._player,
        enemies: this._enemies,
        boss: this._boss,
        bullets: this._bullets,
        powerups: this._powerups,
      },
      (contact) => contacts.push(contact),
    );
    resolveCollisionContacts(contacts, (event) => this._handleHit(event));
  }

  getHUDSnapshot(): HUDSnapshot {
    return {
      score: this._deps.score.score,
      hiScore: this._deps.score.hiScore,
      lives: this._deps.score.lives,
      chargeLevel: this._player?.chargeLevel ?? 0,
      weaponTier: this._player?.weaponTier ?? 1,
      shieldPips: this._player?.shieldPips ?? 0,
      shieldMax: this._player?.shieldMax ?? 0,
      shieldRegenPct: this._player?.shieldRegenPct ?? 0,
    };
  }

  getSavedWeaponTier(): number {
    return this._player?.weaponTier ?? 1;
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

    this._boss?.destroy();
    this._boss = null;

    this._levelManager?.destroy();
    this._levelManager = null;

    this._terrain?.destroy?.();
    this._terrain = null;
    this._playfieldBounds = null;
    this._isExitingLevel = false;
    this._levelExitHoldTimer = 0;
    this._levelExitTimer = 0;
    this._levelExitFlyoutStarted = false;

    this._deps.scene.camera.position.set(0, 0, 100);
  }

  handleStageEvent(event: StageEvent): void {
    switch (event.kind) {
      case StageEventType.SPAWN_ENEMY:
        this.spawnEnemy(event.enemyType, event.x, event.y);
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
      if (this._playfieldBounds) {
        enemy.terrainBounds = this._playfieldBounds;
      }
      this._enemies.push(enemy);
    }
  }

  spawnBoss(): void {
    const level = this._level;
    if (!level?.finaleBossArchetype) return;

    const onDeath = () => {
      this._deps.score.addScore(this._boss?.score ?? 5000);
      if (level.isFinale) {
        this._deps.score.gainLife();
      }
      this._boss = null;
      this._deps.onLevelComplete();
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
    if (this._level?.isFinale) {
      this._deps.onLevelComplete();
      return;
    }
    this._beginLevelExit();
  }

  isLevelClearGateOpen(): boolean {
    return this._enemies.length === 0 && this._powerups.length === 0;
  }

  private _beginLevelExit(): void {
    if (this._isExitingLevel) return;
    this._isExitingLevel = true;
    this._levelExitHoldTimer = LEVEL_EXIT_HOLD_DURATION;
    this._levelExitTimer = LEVEL_EXIT_FLYOUT_DURATION;
    this._levelExitFlyoutStarted = false;
    this._clearHostileBullets();
    this._player?.beginExitHold();
  }

  private _clearHostileBullets(): void {
    this._bullets = this._bullets.filter((bullet) => {
      if (bullet.isPlayerBullet) return true;
      this._projectilePool.destroyOrRelease(bullet);
      return false;
    });
  }

  private _tickLevelExit(dt: number): void {
    this.background?.update(dt);

    if (this._terrain && this._levelManager) {
      this._terrain.update?.(this._levelManager.scrollX, dt);
    }

    if (this._levelExitHoldTimer > 0) {
      this._levelExitHoldTimer -= dt;
      this._player?.updateExitHold(dt);
      if (this._levelExitHoldTimer <= 0) {
        this._levelExitHoldTimer = 0;
        this._levelExitFlyoutStarted = true;
        this._player?.beginExitFlyout();
      }
    } else {
      if (!this._levelExitFlyoutStarted) {
        this._levelExitFlyoutStarted = true;
        this._player?.beginExitFlyout();
      }
      this._player?.updateExitFlyout(dt);
      this._levelExitTimer -= dt;
    }

    for (const bullet of this._bullets) bullet.update(dt);
    this._bullets = this._bullets.filter((bullet) => {
      if (bullet.isOffscreen || !bullet.active) {
        this._projectilePool.destroyOrRelease(bullet);
        return false;
      }
      return true;
    });

    for (const effect of this._effects) effect.update(dt);
    this._effects = this._effects.filter((effect) => !effect.isDone);

    if (this._levelExitFlyoutStarted && this._levelExitTimer <= 0) {
      this._levelExitTimer = 0;
      this._isExitingLevel = false;
      this._deps.onLevelComplete();
    }
  }

  private _handleHit(event: HitEvent): void {
    switch (event.kind) {
      case HitEventKind.ENEMY_KILLED:
        this._deps.score.addScore(event.score);
        this._deps.audio.play('explosion');
        this._effects.push(new Explosion(this._deps.scene, event.x, event.y,
          { count: 16, minSpeed: 50, maxSpeed: 180, size: 5, color: 0xff8800, duration: 0.4 }));
        if (event.dropPowerup) {
          this._powerups.push(new PowerUp(this._deps.scene, event.x, event.y));
        }
        break;
      case HitEventKind.BOSS_HIT:
        this._deps.audio.play('explosion');
        this._effects.push(new Explosion(this._deps.scene, event.x, event.y,
          { count: 10, minSpeed: 40, maxSpeed: 120, size: 4, color: 0xffffff, duration: 0.25 }));
        break;
      case HitEventKind.PLAYER_HIT: {
        this._deps.score.loseLife();
        this._deps.scene.flash(0.12);
        const color = event.cause === HitCause.TERRAIN ? 0x00aaff
                    : event.cause === HitCause.LASER   ? 0x00ffee
                    : 0xaa3bff;
        this._effects.push(new Explosion(this._deps.scene, event.x, event.y,
          { count: 20, minSpeed: 80, maxSpeed: 260, size: 6, color, duration: 0.5 }));
        break;
      }
      case HitEventKind.POWERUP_COLLECTED:
        if (this._player) {
          const upgraded = this._player.upgradeWeapon(this._level?.softTierCap ?? 5);
          if (upgraded) {
            // Outcome 1: Weapon Upgraded
            // Spawn a vibrant magenta/cyan particle burst matching the 3D crystal core at collection site
            this._effects.push(new Explosion(this._deps.scene, event.powerup.x, event.powerup.y,
              { count: 12, minSpeed: 60, maxSpeed: 140, size: 5, color: 0xff00ee, duration: 0.30 }));
          } else {
            const shieldRefilled = this._player.refillShield();
            if (shieldRefilled) {
              // Outcome 2: Shield Refilled
              // Spawns a cyan/blue particle flash around the player ship
              this._effects.push(new Explosion(this._deps.scene, this._player.x, this._player.y,
                { count: 15, minSpeed: 80, maxSpeed: 160, size: 5, color: 0x00ffcc, duration: 0.35 }));
            } else {
              // Outcome 3: Score Consolation (+1000 score)
              this._deps.score.addScore(1000);
              // Spawn a golden/orange particle burst at the collection coordinates
              this._effects.push(new Explosion(this._deps.scene, event.powerup.x, event.powerup.y,
                { count: 10, minSpeed: 40, maxSpeed: 120, size: 4, color: 0xffaa00, duration: 0.25 }));
              this._deps.audio.play('scoreCollect');
            }
          }
        }
        event.powerup.destroy();
        this._powerups.splice(this._powerups.indexOf(event.powerup), 1);
        break;
    }
  }
}
