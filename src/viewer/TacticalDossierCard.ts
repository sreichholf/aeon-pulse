import * as THREE from 'three';
import { type EntityMetadata, type GetPositionFn, type ProjectileSourceKey } from '../types.ts';

export interface ViewerBullet {
  update(dt: number): void;
  destroy(): void;
  _mesh: THREE.Object3D;
}

export interface WrappedEntity {
  _mesh: THREE.Object3D | null;
  update?: (dt: number) => unknown;
  _tick?: (dt: number) => unknown;
  _getPlayerPos?: GetPositionFn | null;
  isBoss?: boolean;
  isMesh?: boolean;
  metadata?: EntityMetadata;
  destroy?: () => void;
  viewerXOffset?: number;
  _isViewer?: boolean;
  _entered?: boolean;
  [key: string]: unknown;
}

/** Factory the card uses to construct one preview bullet by projectile source key. */
export type ViewerBulletFactory = (projectileKey: ProjectileSourceKey) => ViewerBullet;

/** Duration each projectile key is displayed before cycling to the next. */
const BULLET_PREVIEW_LIFETIME = 5.0;

export class TacticalDossierCard {
  private _entity: WrappedEntity | THREE.Object3D;
  private _scene: { add?: (obj: THREE.Object3D) => void; remove: (obj: THREE.Object3D) => void };

  private _viewerX: number;
  private _viewerY: number;
  private _viewerCurrentX?: number;
  private _viewerCurrentY?: number;
  private _viewerIdle: boolean;
  private _viewerTime: number = 0;
  private _viewerBaseY: number = 0;
  private _viewerBaseRotation: THREE.Euler | null = null;

  // Catalog-driven bullet preview cycling (ADR 0017)
  private _projectileKeys: ProjectileSourceKey[];
  private _bulletFactory: ViewerBulletFactory | null;
  private _bulletIndex: number = 0;
  private _bulletTimer: number;          // starts at lifetime so first bullet fires immediately
  private _viewerBullet: ViewerBullet | null = null;

  constructor(
    entity: WrappedEntity | THREE.Object3D,
    scene: { add?: (obj: THREE.Object3D) => void; remove: (obj: THREE.Object3D) => void },
    options?: {
      viewerX?: number;
      viewerY?: number;
      viewerIdle?: boolean;
      projectileKeys?: ProjectileSourceKey[];
      bulletFactory?: ViewerBulletFactory;
    }
  ) {
    this._entity = entity;
    this._scene = scene;
    this._viewerX = options?.viewerX ?? 0;
    this._viewerY = options?.viewerY ?? 0;
    this._viewerIdle = options?.viewerIdle ?? false;
    this._projectileKeys = options?.projectileKeys ?? [];
    this._bulletFactory = options?.bulletFactory ?? null;

    // Initialise timer to lifetime so the first bullet spawns on the very first update() tick.
    this._bulletTimer = BULLET_PREVIEW_LIFETIME;

    const mesh = this.mesh;
    if (mesh) {
      this._viewerBaseY = mesh.position.y;
      this._viewerBaseRotation = mesh.rotation.clone();

      if (options?.viewerX === undefined) {
        this._viewerX = mesh.position.x;
      }
      if (options?.viewerY === undefined) {
        this._viewerY = mesh.position.y;
      }
    }

    if (this.isWrappedEntity(this._entity)) {
      this._entity._isViewer = true;
      this._entity._entered = true;
      if (typeof this._entity._getPlayerPos !== 'function' || this._entity._getPlayerPos === null) {
        this._entity._getPlayerPos = () => ({ x: 0, y: 0 });
      }
    }
  }

  private isWrappedEntity(entity: WrappedEntity | THREE.Object3D): entity is WrappedEntity {
    return !(entity instanceof THREE.Object3D);
  }

  get entity(): WrappedEntity | THREE.Object3D {
    return this._entity;
  }

  get mesh(): THREE.Object3D | null {
    if (this._entity instanceof THREE.Object3D) {
      return this._entity;
    }
    return this._entity._mesh || null;
  }

  get metadata(): EntityMetadata | undefined {
    if (this.isWrappedEntity(this._entity)) {
      return this._entity.metadata;
    }
    return undefined;
  }

  get isBoss(): boolean {
    if (this.isWrappedEntity(this._entity)) {
      return this._entity.isBoss ?? false;
    }
    return false;
  }

  get viewerX(): number {
    return this._viewerX;
  }

  get viewerY(): number {
    return this._viewerY;
  }

  get viewerBullet(): ViewerBullet | null {
    return this._viewerBullet;
  }

  get viewerTime(): number {
    return this._viewerTime;
  }

  update(dt: number): void {
    const mesh = this.mesh;
    if (!mesh) return;

    const isWrapped = this.isWrappedEntity(this._entity);

    // ── Idle float animation (player page) ──────────────────────────────────
    if (this._viewerIdle) {
      this._viewerTime += dt;
      mesh.position.y = this._viewerBaseY + Math.sin(this._viewerTime * 1.4) * 2.2;
      if (this._viewerBaseRotation) {
        mesh.rotation.set(
          this._viewerBaseRotation.x + Math.sin(this._viewerTime * 1.1) * 0.018,
          this._viewerBaseRotation.y + Math.sin(this._viewerTime * 0.8) * 0.035,
          this._viewerBaseRotation.z + Math.sin(this._viewerTime * 1.5) * 0.012,
        );
      }
      return;
    }

    if (!isWrapped) return;

    const wrapped = this._entity as WrappedEntity;

    // ── Tick entity for visual animation only; ignore any bullets it emits ──
    if (typeof wrapped.update === 'function') {
      wrapped.update(dt);
    } else if (typeof wrapped._tick === 'function') {
      wrapped._tick(dt);
    }

    // ── Catalog-driven bullet preview cycling (ADR 0017) ────────────────────
    if (this._projectileKeys.length > 0 && this._bulletFactory) {
      this._bulletTimer += dt;
      if (this._bulletTimer >= BULLET_PREVIEW_LIFETIME) {
        this._bulletTimer = 0;

        // Destroy the current preview and spawn the next projectile key in the list
        if (this._viewerBullet) {
          this._viewerBullet.destroy();
        }
        const projectileKey = this._projectileKeys[this._bulletIndex % this._projectileKeys.length]!;
        this._viewerBullet = this._bulletFactory(projectileKey);
        this._bulletIndex++;
      }
    }

    // ── Position lock ────────────────────────────────────────────────────────
    const isBoss = wrapped.isBoss ?? false;
    const targetY = this._viewerY + (this._viewerBullet ? (isBoss ? 24 : 22) : (isBoss ? 8 : 6));
    const targetX = this._viewerX + ((wrapped.viewerXOffset as number | undefined) ?? 0);

    if (this._viewerCurrentX === undefined) {
      this._viewerCurrentX = targetX;
      this._viewerCurrentY = targetY;
    } else {
      this._viewerCurrentX += (targetX - this._viewerCurrentX) * 10 * dt;
      this._viewerCurrentY = (this._viewerCurrentY ?? targetY) + (targetY - (this._viewerCurrentY ?? targetY)) * 10 * dt;
    }

    mesh.position.x = this._viewerCurrentX;
    mesh.position.y = this._viewerCurrentY;
    mesh.position.z = 0;

    // Slowly rotate to show off 3D shape
    mesh.rotation.y += dt * 0.45;

    // ── Bullet preview display ───────────────────────────────────────────────
    if (this._viewerBullet) {
      this._viewerBullet.update(dt);

      const bulletY = this._viewerY - (isBoss ? 42 : 37);
      this._viewerBullet._mesh.position.set(this._viewerX, bulletY, 0);
      this._viewerBullet._mesh.scale.set(1.4, 1.4, 1.4);
      this._viewerBullet._mesh.rotation.y += dt * 0.45;
    }
  }

  destroy(): void {
    if (this._viewerBullet) {
      this._viewerBullet.destroy();
      this._viewerBullet = null;
    }

    if (this.isWrappedEntity(this._entity)) {
      if (typeof this._entity.destroy === 'function') {
        this._entity.destroy();
      } else if (this._entity.isMesh && this._entity._mesh instanceof THREE.Mesh) {
        this._scene.remove(this._entity._mesh);
        this._entity._mesh.geometry?.dispose();
        if (Array.isArray(this._entity._mesh.material)) {
          for (const mat of this._entity._mesh.material) {
            mat.dispose();
          }
        } else {
          (this._entity._mesh.material as THREE.Material | undefined)?.dispose();
        }
      }
    } else {
      this._scene.remove(this._entity);
      this._entity.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            for (const mat of child.material) mat.dispose();
          } else {
            (child.material as THREE.Material | undefined)?.dispose();
          }
        }
      });
    }
  }
}
