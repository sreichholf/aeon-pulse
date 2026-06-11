import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { ProjectileSourceKey, type GetPositionFn, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import sineGlbUrl from '../models/sine.glb';
import {
  createStandardEnemyModelInstance,
  prepareStandardEnemyModel,
  type PreparedStandardEnemyModel,
} from '../systems/StandardEnemyModel.ts';
import {
  SINE_MODEL_BUCKET_CONFIG,
  SINE_MODEL_OFFSET,
  SINE_MODEL_ROTATION,
  SINE_TARGET_VISUAL_HEIGHT,
} from './EnemySineModel.ts';

const SPEED         = 110;
const SINE_AMP      = 35;
const SINE_FREQ     = 1.2;
const FIRE_INTERVAL = 2.0;
const PAUSE_DUR     = 0.25;
const HW = 36, HH = 17;

export class EnemySine extends Enemy {
  private static _model: PreparedStandardEnemyModel | null = null;
  private static _loadPromise: Promise<PreparedStandardEnemyModel> | null = null;

  private _time: number;
  private _startY: number;
  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _kickback: number;
  protected _isViewer?: boolean;  // set externally by viewer code
  private _visualsGroup: THREE.Group | null = null;
  private _flashOverlay: THREE.Mesh<THREE.BufferGeometry, THREE.Material> | null = null;
  private _modelWrapper: THREE.Group | null = null;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn,
    projectileFactory: ProjectileFactoryFn,
    _audio: IAudio | null = null,
  ) {
    super(scene, sprites, null, 0, 0, HW, HH, x, y, projectileFactory);
    this._hp           = 1;
    this.score         = 150;
    this._dropChance   = 0.06;
    this._getPlayerPos = getPlayerPos;
    this._time         = 0;
    this._startY       = y;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;
    this._kickback     = 0;

    this._displayName = 'Sine';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  _shootAtPlayer(): void {
    super._shootAtPlayer(260, ProjectileSourceKey.ENEMY_SINE);
    this._kickback = 10.0;
  }

  _tick(dt: number): void {
    this._time += dt;
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
    const speedX = this._pausing ? SPEED * 0.15 : SPEED;
    pos.x -= speedX * dt;

    // Smooth dynamic path banking (tilt based on vertical sine velocity)
    const amp = this._isViewer ? 15 : SINE_AMP;
    const freq = this._isViewer ? 0.8 : SINE_FREQ;

    const slopeY = amp * freq * Math.cos(this._time * freq);
    pos.y  = this._startY + amp * Math.sin(this._time * freq);

    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }

    // Firing Recoil Kickback Interpolation
    this._kickback = THREE.MathUtils.lerp(this._kickback, 0, dt * 10);
    if (this._visualsGroup) {
      this._visualsGroup.position.x = this._kickback;
    }

    // Ship Z banking rotation matching original logic (reduced to 15% of original tilt)
    this._mesh!.rotation.z = -(slopeY / speedX) * 0.1275;
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);

    const visuals = new THREE.Group();
    group.add(visuals);
    this._visualsGroup = visuals;

    const attachModel = (source: PreparedStandardEnemyModel): void => {
      if (!this._alive || this._mesh === null) return;
      const instance = createStandardEnemyModelInstance(source, {
        targetVisualHeight: SINE_TARGET_VISUAL_HEIGHT,
        rotation: SINE_MODEL_ROTATION,
        offset: SINE_MODEL_OFFSET,
      });
      this._modelWrapper = instance.root;
      this._flashOverlay = instance.flashOverlay;
      visuals.add(instance.root);
    };

    if (EnemySine._model) {
      attachModel(EnemySine._model);
    } else if (typeof window !== 'undefined') {
      EnemySine._loadModel()
        .then(attachModel)
        .catch((error) => console.error('Failed to load sine GLB model:', error));
    }

    return group;
  }

  static preloadModel(): Promise<PreparedStandardEnemyModel> {
    return EnemySine._loadModel();
  }

  private static _loadModel(): Promise<PreparedStandardEnemyModel> {
    if (EnemySine._model) return Promise.resolve(EnemySine._model);
    if (EnemySine._loadPromise) return EnemySine._loadPromise;

    const loader = new GLTFLoader();
    EnemySine._loadPromise = new Promise((resolve, reject) => {
      loader.load(
        sineGlbUrl,
        (gltf) => {
          EnemySine._model = prepareStandardEnemyModel(gltf.scene, SINE_MODEL_BUCKET_CONFIG);
          resolve(EnemySine._model);
        },
        undefined,
        reject,
      );
    });
    return EnemySine._loadPromise;
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
    this._visualsGroup = null;
    this._modelWrapper = null;
    this._flashOverlay = null;
  }
}
