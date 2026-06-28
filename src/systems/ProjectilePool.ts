import { Bullet } from '../entities/Bullet.ts';
import { BulletType, type IBullet, type IScene, type ProjectileSpawn } from '../types.ts';

type PoolKey = string;

const POOLABLE_TYPES = new Set<string>([
  BulletType.PLAYER,
  BulletType.ENEMY,
]);

export class ProjectilePool {
  private _scene: IScene;
  private _sprites: unknown;
  private _inactive: Map<PoolKey, Bullet[]>;
  private _active: Map<Bullet, PoolKey>;

  constructor(scene: IScene, sprites: unknown) {
    this._scene = scene;
    this._sprites = sprites;
    this._inactive = new Map();
    this._active = new Map();
  }

  create(spawn: ProjectileSpawn): IBullet {
    if (!this._isPoolable(spawn)) {
      return new Bullet(
        this._scene,
        this._sprites,
        spawn.type,
        spawn.x,
        spawn.y,
        spawn.vx,
        spawn.vy,
        spawn.getTargetPos ?? null,
        spawn.tint ?? null,
        spawn.damageOverride ?? null,
      );
    }

    const key = this._key(spawn);
    const pool = this._inactive.get(key);
    const bullet = pool?.pop();

    if (pool && pool.length === 0) {
      this._inactive.delete(key);
    }

    if (bullet) {
      bullet.reset(spawn.x, spawn.y, spawn.vx, spawn.vy, spawn.getTargetPos ?? null);
      this._active.set(bullet, key);
      return bullet;
    }

    const created = new Bullet(
      this._scene,
      this._sprites,
      spawn.type,
      spawn.x,
      spawn.y,
      spawn.vx,
      spawn.vy,
      spawn.getTargetPos ?? null,
      spawn.tint ?? null,
      spawn.damageOverride ?? null,
    );
    this._active.set(created, key);
    return created;
  }

  release(bullet: IBullet): boolean {
    if (!(bullet instanceof Bullet)) return false;

    const key = this._active.get(bullet);
    if (!key) return false;

    this._active.delete(bullet);
    bullet.releaseFromScene();

    const pool = this._inactive.get(key) ?? [];
    pool.push(bullet);
    this._inactive.set(key, pool);
    return true;
  }

  destroyOrRelease(bullet: IBullet): void {
    if (!this.release(bullet)) {
      bullet.destroy();
    }
  }

  clear(): void {
    for (const bullet of this._active.keys()) {
      bullet.destroy();
    }
    this._active.clear();

    for (const pool of this._inactive.values()) {
      for (const bullet of pool) {
        bullet.destroy();
      }
    }
    this._inactive.clear();
  }

  private _isPoolable(spawn: ProjectileSpawn): boolean {
    return POOLABLE_TYPES.has(spawn.type) && (spawn.getTargetPos === undefined || spawn.getTargetPos === null);
  }

  private _key(spawn: ProjectileSpawn): PoolKey {
    return [
      spawn.type,
      spawn.tint ?? 'none',
      spawn.damageOverride ?? 'base',
    ].join(':');
  }
}
