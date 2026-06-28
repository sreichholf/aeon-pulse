import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { EnemyType, ProjectileSourceKey, UserDataKey, type EnemyPresentationContext, type GetPositionFn, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { StandardEnemyModelSource, type PreparedStandardEnemyModel } from '../systems/StandardEnemyModel.ts';
import {
  SINE_COLLISION_HALF_HEIGHT,
  SINE_COLLISION_HALF_WIDTH,
  SINE_COLLISION_OFFSET_X,
  SINE_MODEL_BUCKET_CONFIG,
  SINE_MODEL_PROFILES,
} from './EnemySineModel.ts';

const SPEED         = 110;
const SINE_AMP      = 35;
const SINE_FREQ     = 1.2;
const VIEWER_SINE_AMP = 15;
const VIEWER_SINE_FREQ = 0.8;
const FIRST_SHOT_DELAY = 0.85;
const REPEAT_SHOT_DELAY = 2.4;
const SHOT_SPEED = 210;

interface EnemySineOptions {
  presentationContext?: EnemyPresentationContext;
}

export class EnemySine extends Enemy {
  private static _source = new StandardEnemyModelSource({
    name: 'sine',
    profiles: SINE_MODEL_PROFILES,
    bucketConfig: SINE_MODEL_BUCKET_CONFIG,
  });

  private _time: number;
  private _startY: number;
  private _fireTimer: number;
  private _flashOverlay: THREE.Mesh<THREE.BufferGeometry, THREE.Material> | null = null;
  private _modelWrapper: THREE.Group | null = null;
  private _sineAmp: number;
  private _sineFreq: number;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn,
    projectileFactory: ProjectileFactoryFn,
    _audio: IAudio | null = null,
    options: EnemySineOptions = {},
  ) {
    super(
      scene,
      sprites,
      null,
      0,
      0,
      SINE_COLLISION_HALF_WIDTH,
      SINE_COLLISION_HALF_HEIGHT,
      x,
      y,
      projectileFactory,
      options.presentationContext,
    );
    this._hp           = 2;
    this.score         = 150;
    this._dropChance   = 0.06;
    this._getPlayerPos = getPlayerPos;
    this._time         = 0;
    this._startY       = y;
    this._sineAmp      = this._presentationContext === 'viewer' ? VIEWER_SINE_AMP : SINE_AMP;
    this._sineFreq     = this._presentationContext === 'viewer' ? VIEWER_SINE_FREQ : SINE_FREQ;
    this._fireTimer    = this._presentationContext === 'viewer'
      ? Number.POSITIVE_INFINITY
      : FIRST_SHOT_DELAY + Math.random() * 0.25;

    this._displayName = 'Sine';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);

    if (this._presentationContext === 'viewer') {
      this._applyViewerPose();
    }
  }

  get isSpaceShip(): boolean { return true; }
  override get x(): number { return super.x + SINE_COLLISION_OFFSET_X; }
  override get hw(): number { return SINE_COLLISION_HALF_WIDTH; }
  override get hh(): number { return SINE_COLLISION_HALF_HEIGHT; }

  private _fireSweepShot(): void {
    this._newBullets.push(
      this._projectileFactory({
        type: ProjectileSourceKey.ENEMY_SINE,
        x: this.x - 12,
        y: this.y,
        vx: -SHOT_SPEED,
        vy: 0,
      })
    );
  }

  override _tick(dt: number): void {
    this._time += dt;
    const pos = this._mesh!.position;
    const speedX = SPEED;
    pos.x -= speedX * dt;

    const slopeY = this._sineAmp * this._sineFreq * Math.cos(this._time * this._sineFreq);
    pos.y  = this._startY + this._sineAmp * Math.sin(this._time * this._sineFreq);

    if (this.terrainBounds) {
      pos.y = Math.max(
        this.terrainBounds.bottom + SINE_COLLISION_HALF_HEIGHT,
        Math.min(this.terrainBounds.top - SINE_COLLISION_HALF_HEIGHT, pos.y),
      );
    } else {
      pos.y = Math.max(
        -HALF_H + SINE_COLLISION_HALF_HEIGHT,
        Math.min(HALF_H - SINE_COLLISION_HALF_HEIGHT, pos.y),
      );
    }

    if (Number.isFinite(this._fireTimer)) {
      this._fireTimer -= dt;
      if (this._fireTimer <= 0 && pos.x < HALF_W - 24) {
        this._fireSweepShot();
        this._fireTimer = REPEAT_SHOT_DELAY;
      }
    }

    this._mesh!.rotation.z = -(slopeY / speedX) * 0.1275;
  }

  private _applyViewerPose(): void {
    if (!this._mesh) return;
    this._mesh.rotation.z = -(this._sineAmp * this._sineFreq / SPEED) * 0.1275;
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);
    group.userData.isInstanced = true;
    group.userData[UserDataKey.ENEMY_TYPE] = EnemyType.SINE;

    const visuals = new THREE.Group();
    group.add(visuals);

    EnemySine._source.attach({
      target: visuals,
      context: this._presentationContext,
      isAlive: () => this._alive && this._mesh !== null,
      onInstance: (instance) => {
        this._modelWrapper = instance.root;
        this._flashOverlay = instance.flashOverlay;
      },
    });

    return group;
  }

  static preloadModel(context: EnemyPresentationContext = 'gameplay'): Promise<PreparedStandardEnemyModel> {
    return EnemySine._source.preload(context);
  }

  override _flash(): void {
    if (this._flashOverlay) {
      this._flashOverlay.visible = true;
    }
    this._hitFlashTimer = 0.08;
  }

  override _restoreFlash(): void {
    if (this._flashOverlay) {
      this._flashOverlay.visible = false;
    }
  }

  override destroy(): void {
    if (!this._mesh) return;
    this._scene.remove(this._mesh);
    this._mesh = null;
    this._modelWrapper = null;
    this._flashOverlay = null;
  }
}