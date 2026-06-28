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
  isBoss?: boolean;
  isMesh?: boolean;
  metadata?: EntityMetadata;
  destroy?: () => void;
  [key: string]: unknown;
}

/** Factory the card uses to construct one preview bullet by projectile source key. */
export type ViewerBulletFactory = (projectileKey: ProjectileSourceKey) => ViewerBullet;

/** Duration each projectile key is displayed before cycling to the next. */
const BULLET_PREVIEW_LIFETIME = 5.0;
/** Duration of the model materialize fade (Signal Acquisition Reveal, ADR 0023). */
const REVEAL_DURATION = 0.6;
/** Subject scales up from this fraction to 1.0 during the reveal so it settles in rather than blinking on. */
const REVEAL_SCALE_FROM = 0.9;
const PASSIVE_HOVER_AMPLITUDE = 2.2;
const PASSIVE_HOVER_SPEED = 1.4;
const PASSIVE_PITCH_AMPLITUDE = 0.018;
const PASSIVE_YAW_AMPLITUDE = 0.035;
const PASSIVE_ROLL_AMPLITUDE = 0.012;

export class TacticalDossierCard {
  private _entity: WrappedEntity | THREE.Object3D;
  private _scene: { add?: (obj: THREE.Object3D) => void; remove: (obj: THREE.Object3D) => void };

  private _viewerX: number;
  private _viewerY: number;
  private _viewerCurrentX?: number;
  private _viewerCurrentY?: number;
  private _viewerIdle: boolean;
  private _viewerTime: number = 0;
  private _viewerOffsetX: number = 0;
  private _viewerBaseY: number = 0;
  private _viewerBaseRotation: THREE.Euler | null = null;

  // Catalog-driven bullet preview cycling (ADR 0017)
  private _projectileKeys: ProjectileSourceKey[];
  private _bulletFactory: ViewerBulletFactory | null;
  private _bulletIndex: number = 0;
  private _bulletTimer: number;
  private _viewerBullet: ViewerBullet | null = null;

  // Signal Acquisition Reveal (ADR 0023): fade the model in once its GLB has attached.
  private _revealing: boolean = false;
  private _revealComplete: boolean = true;
  private _revealTimer: number = 0;
  private _revealOriginals: Array<{ mat: THREE.Material; opacity: number; transparent: boolean }> = [];
  private _revealBaseScale: number = 1;

  constructor(
    entity: WrappedEntity | THREE.Object3D,
    scene: { add?: (obj: THREE.Object3D) => void; remove: (obj: THREE.Object3D) => void },
    options?: {
      viewerX?: number;
      viewerY?: number;
      viewerIdle?: boolean;
      projectileKeys?: ProjectileSourceKey[];
      bulletFactory?: ViewerBulletFactory;
      viewerOffsetX?: number;
    }
  ) {
    this._entity = entity;
    this._scene = scene;
    this._viewerX = options?.viewerX ?? 0;
    this._viewerY = options?.viewerY ?? 0;
    this._viewerIdle = options?.viewerIdle ?? false;
    this._projectileKeys = options?.projectileKeys ?? [];
    this._bulletFactory = options?.bulletFactory ?? null;
    this._viewerOffsetX = options?.viewerOffsetX ?? 0;

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
  }

  private isWrappedEntity(entity: WrappedEntity | THREE.Object3D): entity is WrappedEntity {
    return !(entity instanceof THREE.Object3D);
  }

  /**
   * Begin the model materialize fade (Signal Acquisition Reveal, ADR 0023).
   * Animates opacity 0→original on the supplied materials, which must be the
   * viewer-owned clipping-plane clones so no shared gameplay material is mutated.
   * The bullet preview is gated until the reveal completes.
   */
  beginReveal(materials: THREE.Material[]): void {
    this._revealOriginals = materials.map((mat) => ({ mat, opacity: mat.opacity, transparent: mat.transparent }));
    for (const o of this._revealOriginals) {
      o.mat.transparent = true;
      o.mat.opacity = 0;
    }
    const mesh = this.mesh;
    this._revealBaseScale = mesh ? mesh.scale.x : 1;
    this._revealing = true;
    this._revealComplete = false;
    this._revealTimer = 0;
  }

  private updateReveal(dt: number): void {
    if (!this._revealing) return;
    this._revealTimer += dt;
    const t = Math.min(this._revealTimer / REVEAL_DURATION, 1);
    const eased = t * t * (3 - 2 * t);
    for (const o of this._revealOriginals) {
      o.mat.opacity = eased * o.opacity;
    }
    const mesh = this.mesh;
    if (mesh) {
      mesh.scale.setScalar(this._revealBaseScale * (REVEAL_SCALE_FROM + (1 - REVEAL_SCALE_FROM) * eased));
    }
    if (t >= 1) {
      for (const o of this._revealOriginals) {
        o.mat.opacity = o.opacity;
        o.mat.transparent = o.transparent;
      }
      if (mesh) mesh.scale.setScalar(this._revealBaseScale);
      this._revealOriginals = [];
      this._revealing = false;
      this._revealComplete = true;
    }
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

  private passiveHoverOffset(): number {
    return Math.sin(this._viewerTime * PASSIVE_HOVER_SPEED) * PASSIVE_HOVER_AMPLITUDE;
  }

  private applyPassiveInspectionRotation(mesh: THREE.Object3D): void {
    if (!this._viewerBaseRotation) return;

    mesh.rotation.set(
      this._viewerBaseRotation.x + Math.sin(this._viewerTime * 1.1) * PASSIVE_PITCH_AMPLITUDE,
      this._viewerBaseRotation.y + Math.sin(this._viewerTime * 0.8) * PASSIVE_YAW_AMPLITUDE,
      this._viewerBaseRotation.z + Math.sin(this._viewerTime * 1.5) * PASSIVE_ROLL_AMPLITUDE,
    );
  }

  update(dt: number): void {
    const mesh = this.mesh;
    if (!mesh) return;

    const isWrapped = this.isWrappedEntity(this._entity);

    // ── Idle float animation (player page) ──────────────────────────────────
    if (this._viewerIdle) {
      this._viewerTime += dt;
      mesh.position.y = this._viewerBaseY + this.passiveHoverOffset();
      this.applyPassiveInspectionRotation(mesh);
      return;
    }

    if (!isWrapped) return;

    this._viewerTime += dt;

    // ── Model materialize fade (Signal Acquisition Reveal, ADR 0023) ────────
    this.updateReveal(dt);

    // ── Catalog-driven bullet preview cycling (ADR 0017) ────────────────────
    // Gated until the subject has materialized so a projectile never floats beside an empty frame.
    if (this._revealComplete && this._projectileKeys.length > 0 && this._bulletFactory) {
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
    const wrapped = this._entity as WrappedEntity;
    const isBoss = wrapped.isBoss ?? false;
    const targetY = this._viewerY + (this._viewerBullet ? (isBoss ? 24 : 22) : (isBoss ? 8 : 6)) + this.passiveHoverOffset();
    const targetX = this._viewerX + this._viewerOffsetX;

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

    this.applyPassiveInspectionRotation(mesh);

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
