import * as THREE from 'three';
import { DifficultyMode, type IBullet, type ProjectileFactoryFn, type TerrainBounds, type IScene, type IWeaponTierSink } from '../types.ts';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { Action } from '../systems/InputManager.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';
import { PlayerModel } from './PlayerModel.ts';
import {
  WeaponTier,
  getTapFireCooldown,
  planChargedFire,
  planTapFire,
  type WeaponHardpoints,
  type WeaponTierValue,
} from './WeaponTier.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

const SPEED             = 200;   // px/s
const DISPLAY_W         = 80;
const DISPLAY_H         = 72;
const HITBOX_HW         = 10;    // small hitbox for fairness
const HITBOX_HH         = 8;
const RESPAWN_X         = -HALF_W + 130;
const RESPAWN_Y         = 0;
const INVINCIBLE_TIME   = 2.0;   // seconds
const FLICKER_RATE      = 10;    // Hz
const CHARGE_TIME       = 1.5;   // seconds to full charge
const CHARGE_THRESHOLD  = 0.80;  // fraction needed to trigger charge shot
const EXIT_FLYOUT_ACCEL = 520;
const EXIT_FLYOUT_MAX_SPEED = 760;
type ExitMode = 'none' | 'hold' | 'flyout' | 'complete';

interface PlayerAudio {
  play(soundName: string, ...args: unknown[]): void;
  startChargeHum(): void;
  stopChargeHum(): void;
}

interface InputManager {
  isDown(action: string): boolean;
  wasJustPressed(action: string): boolean;
}

export class Player {
  get x(): number { return this._mesh.position.x; }
  get y(): number { return this._mesh.position.y; }
  get weaponTier(): WeaponTierValue { return this._weaponTier; }
  readonly hw: number = HITBOX_HW;
  readonly hh: number = HITBOX_HH;

  chargeLevel: number;           // 0–1, exposed for HUD
  bombStock: number;
  terrainBounds: TerrainBounds | null;

  private _scene: IScene;
  private _sprites: unknown;
  private _input: InputManager;
  private _audio: PlayerAudio;
  private _projectileFactory: ProjectileFactoryFn;
  private _debugInvincible: boolean;
  private _mode: DifficultyMode;
  private _shieldMax: number;
  private _shieldPips: number;
  private _shieldRegenDur: number;
  private _shieldRegenTimer: number;
  private _shieldFlickerTimer: number;
  private _weaponTier: WeaponTierValue;
  private _weaponTierSink: IWeaponTierSink | null;
  private _fireTimer: number;
  private _prevFireDown: boolean;
  private _fireDownDuration: number;
  private _invTimer: number;
  private _flickerTimer: number;
  private _newBullets: IBullet[];
  private _mesh: THREE.Group;
  private _model: PlayerModel;
  private _exitMode: ExitMode;
  private _exitHoldTimer: number;
  private _exitFlyoutTimer: number;
  private _exitSpeed: number;

  constructor(
    scene: IScene,
    sprites: unknown,
    input: InputManager,
    audio: PlayerAudio,
    projectileFactory: ProjectileFactoryFn,
    mode?: DifficultyMode,
    debugInvincible = false,
    loadedModel?: THREE.Group | null,
    weaponTierSink?: IWeaponTierSink | null,
  ) {
    this._scene   = scene;
    this._sprites = sprites;
    this._input   = input;
    this._audio   = audio;
    this._projectileFactory = projectileFactory;
    this._debugInvincible = debugInvincible;

    this._weaponTier     = WeaponTier.RAPID;
    this.chargeLevel     = 0;       // 0–1, exposed for HUD
    this.bombStock       = 2;
    this._fireTimer      = 0;
    this._prevFireDown   = false;
    this._fireDownDuration = 0;
    this._invTimer       = 0;
    this._flickerTimer   = 0;
    this._newBullets     = [];
    this._exitMode       = 'none';
    this._exitHoldTimer  = 0;
    this._exitFlyoutTimer = 0;
    this._exitSpeed      = 300;

    this._mode           = mode ?? DifficultyMode.ACE;
    this._shieldMax      = this._mode === DifficultyMode.ROOKIE ? 2 : this._mode === DifficultyMode.PILOT ? 1 : 0;
    this._shieldPips     = this._shieldMax;
    this._shieldRegenDur = this._mode === DifficultyMode.ROOKIE ? 4.0 : 7.0;
    this._shieldRegenTimer = 0;
    this._shieldFlickerTimer = 0;

    this.terrainBounds = null; // { top, bottom } — set by GameplayRun from active playfield bounds

    this._model = new PlayerModel(loadedModel);
    this._weaponTierSink = weaponTierSink ?? null;
    this._mesh = this._model.root;
    markRenderCategory(this._mesh, RenderCategory.PLAYER);
    this._mesh.position.set(RESPAWN_X, RESPAWN_Y, 2);
    scene.add(this._mesh);
  }

  get isInvincible(): boolean { return this._exitMode !== 'none' || this._invTimer > 0; }
  get isExitComplete(): boolean { return this._exitMode === 'complete'; }
  get shieldPips(): number     { return this._shieldPips; }
  get shieldMax(): number      { return this._shieldMax; }
  get hasFullShield(): boolean { return this._shieldPips >= this._shieldMax; }
  get shieldRegenPct(): number { return this._shieldPips < this._shieldMax && this._shieldRegenDur > 0
                           ? 1 - (this._shieldRegenTimer / this._shieldRegenDur) : 0; }

  // Returns newly spawned Bullet[] this frame; caller adds to master list
  update(dt: number): IBullet[] {
    this._newBullets = [];
    if (this._exitMode !== 'none' && this._exitMode !== 'complete') {
      this._updateExitSequence(dt);
      return this._newBullets;
    }
    this._updateMovement(dt);
    this._updateWeapon(dt);
    this._updateInvincibility(dt);
    this._updateShieldRegen(dt);
    this._updateShieldFlicker(dt);
    return this._newBullets;
  }

  setPosition(x: number, y: number): void {
    this._mesh.position.set(x, y, 2);
  }

  beginLevelExit(holdDuration: number, flyoutDuration: number): void {
    this._exitMode = 'hold';
    this._exitHoldTimer = holdDuration;
    this._exitFlyoutTimer = flyoutDuration;
    this._exitSpeed = 300;
    this.chargeLevel = 0;
    this._prevFireDown = false;
    this._fireDownDuration = 0;
    this._fireTimer = 0;
    this._invTimer = 0;
    this._flickerTimer = 0;
    this._mesh.visible = true;
    this._audio.stopChargeHum();
    this._model.chargeOrb.visible = false;
  }

  private _updateExitHold(dt: number): void {
    const p = this._mesh.position;
    p.y = THREE.MathUtils.lerp(p.y, 0, Math.min(1, 2.0 * dt));

    const rotSpeed = 8 * dt;
    this._mesh.rotation.x = THREE.MathUtils.lerp(this._mesh.rotation.x, 0, rotSpeed);
    this._mesh.rotation.y = THREE.MathUtils.lerp(this._mesh.rotation.y, 0, rotSpeed);
    this._mesh.rotation.z = THREE.MathUtils.lerp(this._mesh.rotation.z, 0, rotSpeed);
    this._updateThrusterVisuals(dt, 1.0, 2.4);
  }

  private _beginExitFlyout(): void {
    this._exitMode = 'flyout';
  }

  private _updateExitFlyout(dt: number): void {
    this._exitSpeed = Math.min(EXIT_FLYOUT_MAX_SPEED, this._exitSpeed + EXIT_FLYOUT_ACCEL * dt);

    const p = this._mesh.position;
    p.x += this._exitSpeed * dt;
    p.y = THREE.MathUtils.lerp(p.y, 0, Math.min(1, 3.5 * dt));

    const rotSpeed = 10 * dt;
    this._mesh.rotation.x = THREE.MathUtils.lerp(this._mesh.rotation.x, 0, rotSpeed);
    this._mesh.rotation.y = THREE.MathUtils.lerp(this._mesh.rotation.y, -0.18, rotSpeed);
    this._mesh.rotation.z = THREE.MathUtils.lerp(this._mesh.rotation.z, 0, rotSpeed);
    this._updateThrusterVisuals(dt, 1.85, 4.2);
  }

  private _updateExitSequence(dt: number): void {
    if (this._exitMode === 'hold') {
      this._exitHoldTimer -= dt;
      this._updateExitHold(dt);
      if (this._exitHoldTimer <= 0) {
        this._exitHoldTimer = 0;
        this._beginExitFlyout();
      }
      return;
    }

    if (this._exitMode === 'flyout') {
      this._updateExitFlyout(dt);
      this._exitFlyoutTimer -= dt;
      if (this._exitFlyoutTimer <= 0) {
        this._exitFlyoutTimer = 0;
        this._exitMode = 'complete';
      }
    }
  }

  // ── MOVEMENT ───────────────────────────────────────────────────────────────

  private _updateMovement(dt: number): void {
    let dx = 0, dy = 0;
    if (this._input.isDown(Action.LEFT))  dx -= 1;
    if (this._input.isDown(Action.RIGHT)) dx += 1;
    if (this._input.isDown(Action.UP))    dy += 1;
    if (this._input.isDown(Action.DOWN))  dy -= 1;

    if (dx !== 0 && dy !== 0) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }

    const p = this._mesh.position;
    p.x = Math.max(-HALF_W + DISPLAY_W / 2 + 2,
          Math.min( HALF_W - DISPLAY_W / 2 - 2, p.x + dx * SPEED * dt));
    p.y = Math.max(-HALF_H + DISPLAY_H / 2 + 2,
          Math.min( HALF_H - DISPLAY_H / 2 - 2, p.y + dy * SPEED * dt));

    if (this.terrainBounds) {
      p.y = Math.max(this.terrainBounds.bottom + this.hh,
            Math.min(this.terrainBounds.top    - this.hh, p.y));
    }

    // ── 3D FLIGHT ANIMATIONS & TILTS ─────────────────────────────────────────
    // The ship points along +X, so screen-space nose up/down is a Z-axis turn.
    const targetRoll = 0;
    const targetPitch = dy * 0.2;   // ~12 degrees max pitch
    // Target Yaw: dx pivots nose slightly in direction of acceleration
    const targetYaw = -dx * 0.14;  // ~8 degrees max yaw

    // Smoothly spring back or roll in with interpolation
    const rotSpeed = 12 * dt;
    this._mesh.rotation.x = THREE.MathUtils.lerp(this._mesh.rotation.x, targetRoll,  rotSpeed);
    this._mesh.rotation.y = THREE.MathUtils.lerp(this._mesh.rotation.y, targetYaw,   rotSpeed);
    this._mesh.rotation.z = THREE.MathUtils.lerp(this._mesh.rotation.z, targetPitch, rotSpeed);

    let targetLightIntensity = 2.0;
    let speedMult = 1.0;
    if (dx > 0) {
      targetLightIntensity = 3.5;
      speedMult = 1.6;
    } else if (dx < 0) {
      targetLightIntensity = 0.8;
      speedMult = 0.6;
    }

    this._updateThrusterVisuals(dt, speedMult, targetLightIntensity);
  }

  private _updateThrusterVisuals(dt: number, speedMult: number, targetLightIntensity: number): void {
    // Animate trailing volumetric plasma particles
    if (this._model.thrusters.pool.length > 0) {
      let yellowCount = 0;
      let orangeCount = 0;

      for (const p of this._model.thrusters.pool) {
        p.life -= p.decay * dt;
        if (p.life <= 0) {
          // Recycle dead particle at the nozzle with minor randomized offset
          p.life = 1.0;
          p.decay = 1.8 + Math.random() * 1.8;
          p.x = -42 + (Math.random() - 0.5) * 4;
          p.y = (Math.random() - 0.5) * 3;
          p.z = (Math.random() - 0.5) * 3;
          // Shoot backwards (negative X)
          p.vx = -(140 + Math.random() * 110) * speedMult;
          p.vy = (Math.random() - 0.5) * 25;
          p.vz = (Math.random() - 0.5) * 25;
        } else {
          // Drifts and spreads
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
        }

        // Set InstancedMesh matrix at corresponding index
        const mesh = p.isYellow ? this._model.thrusters.yellowMesh : this._model.thrusters.orangeMesh;
        const index = p.isYellow ? yellowCount++ : orangeCount++;

        this._model.thrusters.helper.position.set(p.x, p.y, p.z);
        this._model.thrusters.helper.scale.setScalar(p.life);
        this._model.thrusters.helper.updateMatrix();
        mesh.setMatrixAt(index, this._model.thrusters.helper.matrix);
      }

      this._model.thrusters.yellowMesh.count = yellowCount;
      this._model.thrusters.yellowMesh.visible = yellowCount > 0;
      this._model.thrusters.yellowMesh.instanceMatrix.needsUpdate = true;

      this._model.thrusters.orangeMesh.count = orangeCount;
      this._model.thrusters.orangeMesh.visible = orangeCount > 0;
      this._model.thrusters.orangeMesh.instanceMatrix.needsUpdate = true;
    }

    // Smoothly adjust the engine PointLight intensity
    this._model.engineLight.intensity = THREE.MathUtils.lerp(this._model.engineLight.intensity, targetLightIntensity, 10 * dt);
  }

  // ── WEAPON ─────────────────────────────────────────────────────────────────

  private _updateWeapon(dt: number): void {
    const fireDown    = this._input.isDown(Action.FIRE);
    const firePressed = this._input.wasJustPressed(Action.FIRE);

    if (this._fireTimer > 0) this._fireTimer -= dt;

    // While held: charge accumulates after a 300ms safety window for rapid tapping
    if (fireDown) {
      this._fireDownDuration += dt;
      if (this._fireDownDuration >= 0.30) {
        this.chargeLevel = Math.min(1, this.chargeLevel + dt / CHARGE_TIME);
        if (this.chargeLevel > 0.08) {
          this._audio.startChargeHum();
        }
      }
    } else {
      this._fireDownDuration = 0;
    }

    // First-press tap shot (all tiers)
    if (firePressed && this._fireTimer <= 0) {
      this._fireTap();
      this._fireTimer = getTapFireCooldown(this.weaponTier);
      this._audio.stopChargeHum();
    }

    // Key release
    if (!fireDown && this._prevFireDown) {
      if (this.chargeLevel >= CHARGE_THRESHOLD) {
        this._fireCharged();
        this._fireTimer = 0.3;
      }
      this.chargeLevel = 0;
      this._audio.stopChargeHum();
    }

    this._prevFireDown = fireDown;

    // ── CHARGE-UP PLASMA ORB ANIMATION ───────────────────────────────────────
    if (this.chargeLevel > 0 && this._fireDownDuration >= 0.30) {
      this._model.chargeOrb.visible = true;
      // Scale dynamically as charge progresses, with an intense plasma pulse
      const pulse = 1.0 + Math.sin(Date.now() * 0.035) * 0.15;
      const targetScale = this.chargeLevel * 2.8 * pulse;
      this._model.chargeOrb.scale.setScalar(targetScale);

      // Spin the plasma sphere to give a churning energy look
      this._model.chargeOrb.rotation.y += 5 * dt;
      this._model.chargeOrb.rotation.z += 3 * dt;
    } else {
      this._model.chargeOrb.visible = false;
    }
  }

  private _fireTap(): void {
    for (const spawn of planTapFire(this.weaponTier, this._getWeaponHardpoints())) {
      this._newBullets.push(this._projectileFactory(spawn));
    }
    this._audio.play('playerShoot', this.weaponTier);
  }

  private _fireCharged(): void {
    for (const spawn of planChargedFire(this.weaponTier, this._getWeaponHardpoints())) {
      this._newBullets.push(this._projectileFactory(spawn));
    }
    this._audio.play('playerChargeShoot', this.weaponTier);
  }

  private _getWeaponHardpoints(): WeaponHardpoints {
    return {
      nose: { x: this._mesh.position.x + 33.2, y: this._mesh.position.y - 10.5 },
      leftWing: { x: this._mesh.position.x + 6, y: this._mesh.position.y + 12 },
      rightWing: { x: this._mesh.position.x + 6, y: this._mesh.position.y - 12 },
    };
  }

  // ── INVINCIBILITY / FLICKER ────────────────────────────────────────────────

  private _updateInvincibility(dt: number): void {
    if (this._invTimer <= 0) return;
    this._invTimer     -= dt;
    this._flickerTimer += dt;
    this._mesh.visible  = Math.floor(this._flickerTimer * FLICKER_RATE) % 2 === 0;
    if (this._invTimer <= 0) {
      this._invTimer    = 0;
      this._mesh.visible = true;
    }
  }

  private _updateShieldRegen(dt: number): void {
    if (this._shieldPips >= this._shieldMax || this._shieldRegenTimer <= 0) return;
    this._shieldRegenTimer -= dt;
    if (this._shieldRegenTimer <= 0) {
      this._shieldPips = this._shieldMax;   // all-at-once restore
      this._shieldRegenTimer = 0;
      this._model.shieldAura.visible = false;   // Keep invisible until hit
    }
  }

  private _updateShieldFlicker(dt: number): void {
    if (this._shieldPips === 0) {
      this._model.shieldAura.visible = false;
      return;
    }
    if (this._shieldFlickerTimer > 0) {
      this._shieldFlickerTimer -= dt;
      this._model.shieldAura.visible = true;
      // Smoothly fade the shield glow out from 0.70 opacity down to 0 over its 0.3s duration
      const pct = Math.max(0, Math.min(1, this._shieldFlickerTimer / 0.3));
      this._model.shieldAura.material.opacity = 0.70 * pct;
      if (this._shieldFlickerTimer <= 0) {
        this._shieldFlickerTimer = 0;
        this._model.shieldAura.visible = false; // Hide completely when done
      }
    } else {
      this._model.shieldAura.visible = false;   // Invisible during normal flight
    }
  }

  private _flickerShield(): void {
    this._shieldFlickerTimer = 0.3;
  }

  resetShield(): void {
    this._shieldPips = this._shieldMax;
    this._shieldRegenTimer = 0;
    this._shieldFlickerTimer = 0;
    this._model.shieldAura.visible = false;     // Invisible during normal flight
    this._model.shieldAura.material.opacity = 0;
  }

  refillShield(): boolean {
    if (this._shieldPips >= this._shieldMax) return false;
    this.resetShield();
    this._audio.play('shieldRefill');
    return true;
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  useBomb(): boolean {
    if (this.bombStock <= 0 || this.isInvincible) return false;
    this.bombStock--;
    this._invTimer = 2.0;
    return true;
  }

  setWeapon(tier: WeaponTierValue): void {
    this._weaponTier = tier;
    this._weaponTierSink?.setWeaponTier(tier);
  }

  /** Called by collision detection. Returns true if a lethal hit occurred. */
  hit(): boolean {
    if (this._debugInvincible) return false;
    if (this.isInvincible) return false;

    if (this._shieldPips > 0) {
      // Shield absorbs the hit — no life loss, no tier drop
      this._audio.play('playerHit');
      this._shieldPips--;
      this._shieldRegenTimer = this._shieldRegenDur;
      this._flickerShield();   // visual: aura flicker
      return false;            // false = no life lost
    }

    return true; // Lethal hit!
  }

  applyDeathPenalty(): void {
    this._audio.play('playerHit');
    this._audio.stopChargeHum();

    // Unshielded hit — Ace always drops tier; Pilot drops tier; Rookie never drops tier
    if (this._mode !== DifficultyMode.ROOKIE) {
      this.setWeapon(Math.max(WeaponTier.RAPID, this.weaponTier - 1) as WeaponTierValue);
    }
    this.chargeLevel   = 0;
    this._prevFireDown = false;
    this._fireTimer    = 0.5;
    this._invTimer     = INVINCIBLE_TIME;
    this._flickerTimer = 0;
    this._mesh.position.set(RESPAWN_X, RESPAWN_Y, 2);
    this.bombStock = 2;
  }

  upgradeWeapon(maxTier: number = WeaponTier.PLASMA): boolean {
    if (this.weaponTier < Math.min(maxTier, WeaponTier.PLASMA)) {
      this.setWeapon((this.weaponTier + 1) as WeaponTierValue);
      this._audio.play('powerUp');
      return true;
    }
    return false;
  }

  collectBomb(): boolean {
    if (this.bombStock < 4) {
      this.bombStock++;
      return true;
    }
    return false;
  }

  destroy(): void {
    this._audio.stopChargeHum();
    this._scene.remove(this._mesh);
    this._mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
