import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { Explosion } from './Explosion.ts';
import { Entity } from './Entity.ts';
import type { GetPositionFn, IBullet, EntityMetadata, IAudio, IScene, IBoss, HitZone, ICollidable, PlayfieldBounds } from '../types.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

export abstract class BossBase extends Entity implements IBoss {
  protected _scene: IScene;
  protected _sprites: Record<string, THREE.Texture>;
  protected _getPlayerPos: GetPositionFn;
  protected _onDeath: () => void;
  protected _audio: IAudio;
  protected _hp: number;
  protected _maxHp: number;
  protected _alive: boolean;
  protected _entered: boolean;
  protected _dying: boolean;
  protected _dyingTimer: number;
  protected _flashTimer: number;
  protected _hitFlashTimer: number;
  protected _hitCooldown: number;
  protected _newBullets: IBullet[];
  protected _stopX: number;
  protected _entrySpeed: number;
  protected _displayW: number;
  protected _displayH: number;
  protected _mesh!: THREE.Object3D | null;
  protected _explosion: Explosion | null;
  protected _displayName!: string;
  playfieldBounds: PlayfieldBounds | null;
  score: number = 0;

  // Abstract — subclasses must implement
  protected abstract _build3DModel(): THREE.Object3D;
  protected abstract _tickBoss(dt: number): void;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    getPlayerPos: GetPositionFn,
    onDeath: () => void,
    audio: IAudio,
    stopX: number,
    entrySpeed: number,
    hp: number,
    displayW: number,
    displayH: number,
  ) {
    super();
    this._scene        = scene;
    this._sprites      = sprites;
    this._getPlayerPos = getPlayerPos;
    this._onDeath      = onDeath;
    this._audio        = audio;

    this._hp          = hp;
    this._maxHp       = hp;
    this._alive       = true;
    this._entered     = false;
    this._dying       = false;
    this._dyingTimer  = 0;
    this._flashTimer    = 0;
    this._hitFlashTimer = 0;
    this._hitCooldown   = 0;
    this._newBullets  = [];

    this._stopX      = stopX;
    this._entrySpeed = entrySpeed;
    this._displayW   = displayW;
    this._displayH   = displayH;

    this._explosion = null;
    this.playfieldBounds = null;
  }

  // Called by each subclass as the last line of its constructor, after all
  // subclass fields are assigned — ensures _build3DModel() has full context.
  protected _init(): void {
    this._mesh = this._build3DModel();
    this._mesh.position.set(HALF_W + this._displayW / 2 + 10, 0, 0);
    this._scene.add(this._mesh);
    this._captureOriginalColors();
  }

  get x(): number           { return (this._mesh?.position.x) ?? 0; }
  get y(): number           { return (this._mesh?.position.y) ?? 0; }
  get isAlive(): boolean    { return this._alive; }
  get isDying(): boolean    { return this._dying; }
  get lasers(): ReadonlyArray<ICollidable> { return []; }
  get healthFraction(): number { return this._hp / this._maxHp; }
  get isOffscreen(): boolean { return false; }

  override get isBoss(): true { return true; }

  hitZones(): HitZone[] {
    return [{ id: 'core', x: this.x, y: this.y, hw: this.hw, hh: this.hh }];
  }

  get metadata(): EntityMetadata {
    return {
      displayName: this._displayName,
      hp: this._hp,
      score: this.score ?? 5000,
      isBoss: true,
    };
  }

  private _captureOriginalColors(): void {
    this._mesh?.traverse(child => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshPhongMaterial;
        if (mat.color) {
          child.userData.origColor = mat.color.getHex();
        }
        if (mat.emissive) {
          child.userData.origEmissive = mat.emissive.getHex();
        }
      }
    });
  }

  update(dt: number): IBullet[] {
    this._newBullets = [];
    if (!this._alive) return this._newBullets;

    if (this._dying) {
      this._updateDying(dt);
      return this._newBullets;
    }

    if (this._hitCooldown > 0) this._hitCooldown -= dt;
    if (this._hitFlashTimer > 0) {
      this._hitFlashTimer -= dt;
      if (this._hitFlashTimer <= 0) this._restoreHitFlash();
    }
    this._updateEntrance(dt);

    if (this._entered) {
      this._tickBoss(dt);
    }

    this._updateAlertFlash(dt);

    return this._newBullets;
  }

  protected _updateEntrance(dt: number): void {
    if (this._entered || !this._mesh) return;
    this._mesh.position.x -= this._entrySpeed * dt;
    if (this._mesh.position.x <= this._stopX) {
      this._mesh.position.x = this._stopX;
      this._entered = true;
      this._onEntranceComplete();
    }
  }

  protected _onEntranceComplete(): void {
    this._audio.play('bossAlert');
  }

  // Hook methods to be overridden by subclasses
  protected _updateAlertFlash(_dt: number): void {}

  hit(damage: number = 1, zone: string = 'core'): boolean {
    if (!this._alive || this._dying) return false;
    if (!this._canTakeDamage(zone)) return false;
    if (this._hitCooldown > 0) return false;

    this._hitCooldown = this._getHitCooldownDur();
    this._applyDamage(damage, zone);
    this._flashMesh(zone);
    this._checkPhase();

    if (this._isDead()) {
      this._startDying();
      return true;
    }
    return false;
  }

  protected _getHitCooldownDur(): number { return 0.20; }
  protected _canTakeDamage(_zone: string): boolean { return true; }
  protected _applyDamage(damage: number, _zone: string): void {
    this._hp = Math.max(0, this._hp - damage);
  }

  protected _flashMesh(_zone: string): void {
    this._mesh?.traverse(child => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshPhongMaterial;
        if (mat.color) {
          mat.color.setHex(0xffaaaa);
          if (mat.emissive) {
            child.userData.origEmissiveFlash = mat.emissive.getHex();
            mat.emissive.setHex(0xaa3333);
          }
        }
      }
    });
    this._hitFlashTimer = 0.06;
  }

  protected _restoreHitFlash(): void {
    if (!this._mesh) return;
    this._mesh.traverse(child => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshPhongMaterial;
        if (mat.color && child.userData.origColor !== undefined) {
          mat.color.setHex(child.userData.origColor);
          if (mat.emissive && child.userData.origEmissiveFlash !== undefined) {
            mat.emissive.setHex(child.userData.origEmissiveFlash);
          }
        }
      }
    });
  }

  protected _checkPhase(): void {}
  protected _isDead(): boolean { return this._hp <= 0; }

  protected _startDying(): void {
    this._dying      = true;
    this._dyingTimer = 0;

    const cfg = this.deathConfig;
    this._explosion = new Explosion(this._scene, this.x, this.y, {
      count: cfg.explosionCount,
      minSpeed: cfg.explosionMinSpeed,
      maxSpeed: cfg.explosionMaxSpeed,
      size: cfg.explosionParticleSize,
      color: cfg.explosionColor,
      duration: this._getDyingDuration(),
    });

    this._audio.play('explosion');
    this._scene.flash(cfg.flashOpacity);
  }

  protected _getDyingDuration(): number { return 3.0; }

  get deathConfig(): {
    explosionCount: number;
    explosionColor: number;
    explosionMinSpeed: number;
    explosionMaxSpeed: number;
    explosionParticleSize: number;
    flashOpacity: number;
    shakeIntensity: number;
    decayingShake: boolean;
  } {
    return {
      explosionCount: 48,
      explosionColor: 0x00eeff,
      explosionMinSpeed: 80,
      explosionMaxSpeed: 400,
      explosionParticleSize: 10,
      flashOpacity: 0.4,
      shakeIntensity: 6,
      decayingShake: false,
    };
  }

  protected _updateDying(dt: number): void {
    this._dyingTimer += dt;
    this._flashTimer += dt;
    const dur = this._getDyingDuration();
    const progress = this._dyingTimer / dur;

    if (this._mesh) {
      const flash = Math.floor(this._flashTimer * 20) % 2 === 0;
      this._mesh.visible = flash;
    }

    this._explosion?.update(dt);
    this._onDyingTick(dt);

    if (progress < 0.9) {
      const cfg = this.deathConfig;
      const shake = cfg.decayingShake ? cfg.shakeIntensity * (1.0 - progress) : cfg.shakeIntensity;
      this._scene.camera.position.x = (Math.random() - 0.5) * shake;
      this._scene.camera.position.y = (Math.random() - 0.5) * shake;
    }

    if (this._dyingTimer >= dur) {
      this._scene.camera.position.x = 0;
      this._scene.camera.position.y = 0;
      this._alive = false;
      this.destroy();
      this._onDeath();
    }
  }

  protected _onDyingTick(_dt: number): void {}

  destroy(): void {
    this._explosion?.destroy();
    this._explosion = null;
    if (this._mesh) {
      this._scene.remove(this._mesh);
      this._mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      this._mesh = null;
    }
  }

  // Abstract hitbox getters — subclasses must implement
  abstract get hw(): number;
  abstract get hh(): number;
}
