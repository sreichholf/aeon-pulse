import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { Entity } from './Entity.ts';
import { ProjectileSourceKey, type HitResult, type GetPositionFn, type TerrainBounds, type IBullet, type EntityMetadata, type IEnemy, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

export const HALF_W = GAME_WIDTH  / 2;
export const HALF_H = GAME_HEIGHT / 2;

export class Enemy extends Entity implements IEnemy {
  protected _scene: IScene;
  protected _sprites: Record<string, THREE.Texture>;
  protected _alive: boolean;
  protected _hp: number;
  protected _newBullets: IBullet[];
  protected _pendingBullets: IBullet[];
  protected _hitCooldown: number;
  protected _hitCooldownDur: number;
  protected _hitFlashTimer: number;
  protected _dropChance: number;
  protected _projectileFactory: ProjectileFactoryFn;
  score: number;
  _getPlayerPos: GetPositionFn | null;
  terrainBounds: TerrainBounds | null;
  protected _hw: number;
  protected _hh: number;
  protected _mesh: THREE.Mesh | THREE.Group | null;  // null after destroy()
  protected _displayName?: string;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    spriteKey: string | null,
    dispW: number,
    dispH: number,
    hw: number,
    hh: number,
    x: number,
    y: number,
    projectileFactory: ProjectileFactoryFn,
  ) {
    super();
    this._scene   = scene;
    this._sprites = sprites;

    this._alive          = true;
    this._hp             = 1;
    this._newBullets     = [];
    this._pendingBullets = [];
    this._hitCooldown    = 0;
    this._hitCooldownDur = 0;
    this._hitFlashTimer  = 0;
    this._dropChance     = 0;
    this._projectileFactory = projectileFactory;
    this.score           = 0;
    this._getPlayerPos   = null;
    this.terrainBounds   = null;

    this._hw = hw;
    this._hh = hh;

    if (spriteKey !== null) {
      // 2D sprite enemy
      const geo = new THREE.PlaneGeometry(dispW, dispH);
      const mat = new THREE.MeshBasicMaterial({
        map: sprites[spriteKey],
        transparent: true,
        depthWrite: false,
      });
      this._mesh = new THREE.Mesh(geo, mat);
      markRenderCategory(this._mesh, RenderCategory.ENEMY);
      this._mesh.position.set(x, y, 0);
      scene.add(this._mesh);
    } else {
      // 3D enemy: lightweight position-only placeholder.
      // The subclass constructor will replace this with its 3D group.
      this._mesh = new THREE.Group();
      markRenderCategory(this._mesh, RenderCategory.ENEMY);
      this._mesh.position.set(x, y, 0);
    }
  }

  get x(): number           { return this._mesh ? this._mesh.position.x : 0; }
  get y(): number           { return this._mesh ? this._mesh.position.y : 0; }
  get hw(): number          { return this._hw; }
  get hh(): number          { return this._hh; }
  get isAlive(): boolean    { return this._alive; }
  get isOffscreen(): boolean { return !this._mesh || this._mesh.position.x < -HALF_W - 120; }
  get isSpaceShip(): boolean { return false; }

  get metadata(): EntityMetadata {
    return {
      displayName: this._displayName,
      hp: this._hp,
      score: this.score,
      isBoss: false,
    };
  }

  get viewerXOffset(): number { return 0; }

  get isBoss(): false { return false; }



  update(dt: number): IBullet[] {
    if (this._mesh && !this._mesh.userData['renderCategory']) {
      markRenderCategory(this._mesh, RenderCategory.ENEMY);
    }
    this._newBullets     = [...this._pendingBullets];
    this._pendingBullets = [];
    if (!this._alive) return this._newBullets;
    if (this._hitCooldown > 0) this._hitCooldown -= dt;
    if (this._hitFlashTimer > 0) {
      this._hitFlashTimer -= dt;
      if (this._hitFlashTimer <= 0) this._restoreFlash();
    }
    this._tick(dt);
    return this._newBullets;
  }

  _tick(_dt: number): void {}

  hit(damage = 1): HitResult | null {
    if (!this._alive) return null;
    if (this._hitCooldown > 0) return null;
    this._hitCooldown = this._hitCooldownDur;
    this._hp -= damage;
    this._flash();
    if (this._hp <= 0) {
      this._alive = false;
      this._onDeath();
      return { x: this.x, y: this.y, dropPowerup: Math.random() < this._dropChance };
    }
    return null;
  }

  _onDeath(): void {}

  _flash(): void {
    if (!this._mesh) return;
    this._mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (!Array.isArray(mat) && 'color' in mat) {
          const phongMat = mat as THREE.MeshPhongMaterial | THREE.MeshBasicMaterial;
          if (child.userData['origColor'] === undefined) {
            child.userData['origColor'] = phongMat.color.getHex();
          }
          phongMat.color.setHex(0xffaaaa);
        }
      }
    });
    this._hitFlashTimer = 0.08;
  }

  _restoreFlash(): void {
    if (!this._mesh) return;
    this._mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (!Array.isArray(mat) && 'color' in mat) {
          const origColor = child.userData['origColor'] as number | undefined;
          if (origColor !== undefined) {
            (mat as THREE.MeshPhongMaterial | THREE.MeshBasicMaterial).color.setHex(origColor);
          }
        }
      }
    });
  }

  _shootAtPlayer(speed = 260, type: ProjectileSourceKey = ProjectileSourceKey.ENEMY): void {
    if (!this._getPlayerPos) return;
    const { x: px, y: py } = this._getPlayerPos();
    const dx = px - this.x, dy = py - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const spawn = { type, x: this.x, y: this.y, vx: (dx / len) * speed, vy: (dy / len) * speed };
    this._newBullets.push(this._projectileFactory(spawn));
  }

  _shootBurst(speed = 240, spread = 0.18): void {
    if (!this._getPlayerPos) return;
    const { x: px, y: py } = this._getPlayerPos();
    const base = Math.atan2(py - this.y, px - this.x);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * spread;
      const spawn = { type: ProjectileSourceKey.ENEMY, x: this.x, y: this.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
      this._newBullets.push(this._projectileFactory(spawn));
    }
  }

  destroy(): void {
    if (!this._mesh) return;
    this._scene.remove(this._mesh);
    this._mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
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
