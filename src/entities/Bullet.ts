import * as THREE from 'three';
import { BulletType, type IBullet, type GetPositionFn, type IScene } from '../types.ts';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import type { BulletAnimRefs, CacheStore } from './BulletsPlayer.ts';
import { getProjectileDefinition, ProjectileFaction, ProjectileMotionKind, type ProjectileDefinition, type ProjectileMovement } from './ProjectileDefinitions.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

// Static geometry and material cache to avoid runtime allocations & garbage collector lag
const CACHE: CacheStore = {
  geos: {},
  mats: {},
};

function getGeometry(key: string, builder: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const cached = CACHE.geos[key];
  if (cached) return cached;
  const geo = builder();
  CACHE.geos[key] = geo;
  return geo;
}

function getMaterial(key: string, builder: () => THREE.Material): THREE.Material {
  const cached = CACHE.mats[key];
  if (cached) return cached;
  const mat = builder();
  CACHE.mats[key] = mat;
  return mat;
}

export class Bullet implements IBullet {
  active: boolean;
  readonly isPlayerBullet: boolean;
  readonly damage: number;
  readonly isPiercing: boolean;
  readonly hw: number;
  readonly hh: number;
  readonly type: BulletType;
  private _definition: ProjectileDefinition;
  private _movement: ProjectileMovement;
  private _getTargetPos: GetPositionFn | null;
  private _vx: number;
  private _vy: number;
  private _scene: IScene;
  private _mesh: THREE.Object3D;
  private _animRefs: BulletAnimRefs;
  private _inScene: boolean;
  private _waveTime: number;
  private _disposed: boolean;

  constructor(
    scene: IScene,
    sprites: unknown,
    type: string,
    x: number,
    y: number,
    vx: number,
    vy: number,
    getTargetPos: GetPositionFn | null = null,
    tint: number | null = null,
    damageOverride: number | null = null,
  ) {
    const def = getProjectileDefinition(type);

    this.active         = true;
    this._inScene       = true;
    this._definition    = def;
    this._movement      = def.movement;
    this.isPlayerBullet = def.faction === ProjectileFaction.PLAYER;
    this.damage         = damageOverride !== null ? damageOverride : def.damage.amount;
    this.isPiercing     = def.damage.piercing;
    this._getTargetPos  = getTargetPos;
    this.hw             = def.collision.halfWidth;
    this.hh             = def.collision.halfHeight;
    this._waveTime      = 0;
    this._vx            = vx;
    this._vy            = vy;
    this._scene         = scene;
    this.type           = def.id;
    this._disposed      = false;

    const built = this._build3DProjectile(tint);
    this._mesh     = built.mesh;
    this._animRefs = built.refs ?? {};
    this._mesh.position.set(x, y, 1);

    this._alignToVelocity();

    scene.add(this._mesh);
  }

  get x(): number { return this._mesh.position.x; }
  get y(): number { return this._mesh.position.y; }

  private _alignToVelocity(): void {
    if (this._movement.alignToVelocity) {
      const angle = Math.atan2(this._vy, this._vx);
      this._mesh.rotation.z = angle;
    }
  }

  private _build3DProjectile(tint: number | null) {
    return this._definition.presentation.build(tint, CACHE, getMaterial, getGeometry);
  }

  reset(x: number, y: number, vx: number, vy: number, getTargetPos: GetPositionFn | null = null): void {
    if (this._disposed) {
      throw new Error('Cannot reset a disposed projectile');
    }

    this.active = true;
    this._inScene = true;
    this._getTargetPos = getTargetPos;
    this._vx = vx;
    this._vy = vy;
    this._waveTime = 0;
    this._mesh.position.set(x, y, 1);
    this._mesh.rotation.set(0, 0, 0);
    this._mesh.scale.set(1, 1, 1);
    this._alignToVelocity();
    this._scene.add(this._mesh);
  }

  update(dt: number): void {
    if (this._movement.kind === ProjectileMotionKind.HOMING && this._getTargetPos) {
      const tgt   = this._getTargetPos();

      // If the bullet has flown past the player, consider it successfully evaded
      if (this.x < tgt.x - this._movement.evasionPastTargetX) {
        this.active = false;
        return;
      }

      const angle = Math.atan2(tgt.y - this.y, tgt.x - this.x);
      const cur   = Math.atan2(this._vy, this._vx);
      const spd   = Math.hypot(this._vx, this._vy);

      let diff = angle - cur;
      if (diff >  Math.PI) diff -= 2 * Math.PI;
      if (diff < -Math.PI) diff += 2 * Math.PI;

      const maxTurn = this._movement.turnRate * dt;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
      const next = cur + turn;
      this._vx = Math.cos(next) * spd;
      this._vy = Math.sin(next) * spd;

      this._alignToVelocity();
    }

    this._mesh.position.x += this._vx * dt;
    this._mesh.position.y += this._vy * dt;

    if (this._movement.kind === ProjectileMotionKind.LINEAR_WAVE) {
      this._waveTime += dt;
      this._mesh.position.y += this._movement.amplitude * this._movement.angularSpeed *
        Math.cos(this._waveTime * this._movement.angularSpeed) * dt;
    }

    this._animateProjectiles(dt);
  }

  private _animateProjectiles(dt: number): void {
    this._definition.presentation.animate?.(dt, this._mesh, this._animRefs);
  }

  get isOffscreen(): boolean {
    return (
      this.x < -HALF_W - this._definition.collision.offscreenPaddingX ||
      this.x >  HALF_W + this._definition.collision.offscreenPaddingX ||
      this.y < -HALF_H - this._definition.collision.offscreenPaddingY ||
      this.y >  HALF_H + this._definition.collision.offscreenPaddingY
    );
  }

  destroy(): void {
    if (this._disposed) return;
    this.releaseFromScene();
    this._disposed = true;

    // Safe traversal to dispose of cloned (tinted) materials only
    this._mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (child.material.userData && child.material.userData['cloned']) {
          child.material.dispose();
        }
      }
    });
  }

  releaseFromScene(): void {
    if (!this._inScene) {
      this.active = false;
      return;
    }

    this._inScene = false;
    this.active = false;
    this._scene.remove(this._mesh);
  }
}
