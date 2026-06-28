import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { EnemyType, ProjectileSourceKey, UserDataKey, type EnemyPresentationContext, type GetPositionFn, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { StandardEnemyModelSource, type PreparedStandardEnemyModel } from '../systems/StandardEnemyModel.ts';
import {
  DIVER_COLLISION_HALF_HEIGHT,
  DIVER_COLLISION_HALF_WIDTH,
  DIVER_COLLISION_OFFSET_X,
  DIVER_MODEL_BUCKET_CONFIG,
  DIVER_MODEL_PROFILES,
} from './EnemyDiverModel.ts';


const SPEED         = 150;
const VERT_SPEED    = 210;
const FIRE_INTERVAL = 1.9;
const PAUSE_DUR     = 0.20;
const DIVE_TILT_FACTOR = -0.3;

interface EnemyDiverOptions {
  presentationContext?: EnemyPresentationContext;
}

export class EnemyDiver extends Enemy {
  private static _source = new StandardEnemyModelSource({
    name: 'diver',
    profiles: DIVER_MODEL_PROFILES,
    bucketConfig: DIVER_MODEL_BUCKET_CONFIG,
  });

  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _spreadY: number;
  private _flashOverlay: THREE.Mesh<THREE.BufferGeometry, THREE.Material> | null = null;
  private _presentationContext: EnemyPresentationContext;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn,
    projectileFactory: ProjectileFactoryFn,
    _audio: IAudio | null = null,
    options: EnemyDiverOptions = {},
  ) {
    super(
      scene,
      sprites,
      null,
      0,
      0,
      DIVER_COLLISION_HALF_WIDTH,
      DIVER_COLLISION_HALF_HEIGHT,
      x,
      y,
      projectileFactory,
    );
    this._hp           = 2;
    this.score         = 200;
    this._dropChance   = 0.07;
    this._getPlayerPos = getPlayerPos;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;
    this._spreadY      = y - getPlayerPos().y;
    this._presentationContext = options.presentationContext ?? 'gameplay';

    this._displayName = 'Diver';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }
  override get x(): number { return super.x + DIVER_COLLISION_OFFSET_X; }
  override get hw(): number { return DIVER_COLLISION_HALF_WIDTH; }
  override get hh(): number { return DIVER_COLLISION_HALF_HEIGHT; }

  _shootAtPlayer(): void {
    super._shootAtPlayer(340, ProjectileSourceKey.ENEMY_DIVER);
  }

  _tick(dt: number): void {
    const pos = this._mesh!.position;
    if (this._pausing) {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pausing   = false;
        this._fireTimer = FIRE_INTERVAL;
      }
    } else {
      this._fireTimer -= dt;
      if (this._fireTimer <= 0 && pos.x < HALF_W - 60) {
        this._shootAtPlayer();
        this._pausing    = true;
        this._pauseTimer = PAUSE_DUR;
      }
    }

    // Each diver targets player Y plus 40% of its original formation spread,
    // so a 5-ship vForm stays spaced out instead of all stacking at player Y.
    const targetY  = this._getPlayerPos!().y + this._spreadY * 0.4;
    const diff     = targetY - pos.y;
    const maxDelta = VERT_SPEED * dt;
    const deltaY   = Math.max(-maxDelta, Math.min(maxDelta, diff));
    pos.y += deltaY;

    const speedX = this._pausing ? SPEED * 0.15 : SPEED;
    pos.x -= speedX * dt;

    if (this.terrainBounds) {
      pos.y = Math.max(
        this.terrainBounds.bottom + DIVER_COLLISION_HALF_HEIGHT,
        Math.min(this.terrainBounds.top - DIVER_COLLISION_HALF_HEIGHT, pos.y),
      );
    } else {
      pos.y = Math.max(
        -HALF_H + DIVER_COLLISION_HALF_HEIGHT,
        Math.min(HALF_H - DIVER_COLLISION_HALF_HEIGHT, pos.y),
      );
    }

    // Smooth dive tilting based on the current vertical correction.
    const dy = deltaY / (dt || 0.016);
    const rawTargetZ = -Math.atan2(dy, -speedX) + Math.PI;
    const targetZ = Math.atan2(Math.sin(rawTargetZ), Math.cos(rawTargetZ)) * DIVE_TILT_FACTOR;
    this._mesh!.rotation.z = THREE.MathUtils.lerp(this._mesh!.rotation.z, targetZ, 8 * dt);
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);
    group.userData.isInstanced = true;
    group.userData[UserDataKey.ENEMY_TYPE] = EnemyType.DIVER;

    EnemyDiver._source.attach({
      target: group,
      context: this._presentationContext,
      isAlive: () => this._alive && this._mesh !== null,
      onInstance: (instance) => { this._flashOverlay = instance.flashOverlay; },
    });

    return group;
  }

  static preloadModel(context: EnemyPresentationContext = 'gameplay'): Promise<PreparedStandardEnemyModel> {
    return EnemyDiver._source.preload(context);
  }

  _flash(): void {
    if (this._flashOverlay) {
      this._flashOverlay.visible = true;
    }
    this._hitFlashTimer = 0.08;
  }

  _restoreFlash(): void {
    if (this._flashOverlay) {
      this._flashOverlay.visible = false;
    }
  }

  destroy(): void {
    if (!this._mesh) return;
    this._scene.remove(this._mesh);
    this._mesh = null;
    this._flashOverlay = null;
  }

}
