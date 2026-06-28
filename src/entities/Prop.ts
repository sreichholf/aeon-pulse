import * as THREE from 'three';
import { PropCollisionShape, type IScene, type IProp, type PropEffectKind, type PropHitResult, type PropSolidBounds, type PropType } from '../types.ts';
import { DEFAULT_FLASH_MATERIAL } from '../systems/StandardEnemyModel.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';
import { buildPropGroup } from './PropVisuals.ts';

/**
 * Tunable profile for a prop kind. Authored as data in PropRegistry and read
 * by the Prop base class. Milestone 2 will add per-Sector authored variants;
 * Milestone 0 ships a single profile per PropType.
 */
export interface PropProfile {
  readonly propType: PropType;
  readonly hp: number;
  readonly scoreValue: number;
  readonly effects: readonly PropEffectKind[];
  readonly clearRadius: number;
  readonly hazardRadius: number;
  readonly hazardDuration: number;
  /** Seconds alive before a Timed Burst auto-detonates. Infinity = no burst. */
  readonly burstWindow: number;
  readonly dropPowerupChance: number;
  readonly hw: number;
  readonly hh: number;
  /** Solid props block movement and projectiles. Defaults to non-solid for v1 props. */
  readonly isSolid?: boolean;
  readonly collisionShape?: PropCollisionShape;
  /** If true, this solid prop kind is allowed to span the full vertical corridor. */
  readonly fullGate?: boolean;
}

/** v2: optional per-placement overrides authored in Sector prop layouts. */
export interface PropOverrides {
  isFullGate?: boolean;
  burstWindow?: number;
}

/**
 * Destructible scenery prop (per ADR 0028). Non-solid: it does not ram the
 * player and is not rammed. It scrolls with the level, can be shot, and may
 * auto-detonate via a Timed Burst window. Two death paths both yield a
 * PropHitResult -> PROP_DESTROYED HitEvent:
 *   - shot to death: hit(damage) returns the result
 *   - timed burst:   update() sets isBursting; GameplayRun consumes it post-tick
 */
export class Prop implements IProp {
  readonly propType: PropType;
  private readonly _profile: PropProfile;
  private readonly _scene: IScene;
  private readonly _scrollSpeed: number;
  private _mesh: THREE.Group | null;
  private _overlays: THREE.Mesh[] = [];
  private _flashTimer = 0;
  private _hp: number;

  x: number;
  y: number;
  readonly hw: number;
  readonly hh: number;
  private _isAlive = true;
  private _isBursting = false;
  private _burstTimer: number;
  private _fullGateOverride: boolean | undefined;

  constructor(
    scene: IScene,
    profile: PropProfile,
    x: number,
    y: number,
    scrollSpeed: number,
    overrides?: PropOverrides,
  ) {
    this._scene = scene;
    this._profile = profile;
    this.propType = profile.propType;
    this.x = x;
    this.y = y;
    this.hw = profile.hw;
    this.hh = profile.hh;
    this._hp = profile.hp;
    this._burstTimer = overrides?.burstWindow ?? profile.burstWindow;
    this._fullGateOverride = overrides?.isFullGate;
    this._scrollSpeed = scrollSpeed;
    this._mesh = this._buildMesh();
    this._scene.add(this._mesh);
  }

  get isAlive(): boolean { return this._isAlive; }
  get isOffscreen(): boolean { return this.x < -500; }
  get isBursting(): boolean { return this._isBursting; }
  get isSolid(): boolean { return this._profile.isSolid ?? false; }
  get collisionShape(): PropCollisionShape { return this._profile.collisionShape ?? PropCollisionShape.BOX; }
  get isFullGate(): boolean { return this._fullGateOverride ?? this._profile.fullGate ?? false; }

  getSolidBounds(): PropSolidBounds | null {
    if (!this.isSolid) return null;
    if (this.collisionShape === PropCollisionShape.CIRCLE) {
      const radius = Math.max(this.hw, this.hh);
      return { shape: PropCollisionShape.CIRCLE, x: this.x, y: this.y, radius };
    }
    return { shape: PropCollisionShape.BOX, x: this.x, y: this.y, hw: this.hw, hh: this.hh };
  }

  update(dt: number): void {
    if (!this._isAlive || !this._mesh) return;
    this.x -= this._scrollSpeed * dt;
    this._mesh.position.x = this.x;

    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        for (const overlay of this._overlays) overlay.visible = false;
      }
    }

    if (Number.isFinite(this._burstTimer)) {
      this._burstTimer -= dt;
      if (this._burstTimer <= 0 && !this._isBursting) {
        this._isBursting = true;
      }
    }
  }

  hit(damage = 1): PropHitResult | null {
    if (!this._isAlive) return null;
    this._hp -= damage;
    this._flash();
    if (this._hp <= 0) {
      this._isAlive = false;
      return this._buildDeathResult();
    }
    return null;
  }

  consumeBurst(): PropHitResult | null {
    if (!this._isAlive || !this._isBursting) return null;
    this._isAlive = false;
    return this._buildDeathResult();
  }

  destroy(): void {
    if (this._mesh) {
      this._scene.remove(this._mesh);
      this._mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      this._mesh = null;
    }
    this._overlays = [];
  }

  private _buildDeathResult(): PropHitResult {
    return {
      x: this.x,
      y: this.y,
      propType: this.propType,
      effects: this._profile.effects,
      scoreValue: this._profile.scoreValue,
      dropPowerup: Math.random() < this._profile.dropPowerupChance,
      clearRadius: this._profile.clearRadius,
      hazardRadius: this._profile.hazardRadius,
      hazardDuration: this._profile.hazardDuration,
    };
  }

  private _flash(): void {
    for (const overlay of this._overlays) overlay.visible = true;
    this._flashTimer = 0.08;
  }

  private _buildMesh(): THREE.Group {
    const group = buildPropGroup(this.propType, this.hw, this.hh);
    group.position.set(this.x, this.y, 0);

    // Walk every body mesh the builder produced and (a) tag its render
    // category and (b) add a flash overlay as a sibling so flashes hit every
    // visible part regardless of how the builder nested the geometry.
    const meshes: THREE.Mesh[] = [];
    group.traverse((obj) => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
    for (const mesh of meshes) {
      markRenderCategory(mesh, RenderCategory.PROP, `prop.${this.propType}`);
      const overlay = new THREE.Mesh(mesh.geometry, DEFAULT_FLASH_MATERIAL);
      overlay.visible = false;
      overlay.renderOrder = 20;
      overlay.position.copy(mesh.position);
      overlay.rotation.copy(mesh.rotation);
      overlay.scale.copy(mesh.scale);
      mesh.parent!.add(overlay);
      this._overlays.push(overlay);
    }

    return group;
  }
}
