import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { ProjectileSourceKey, type GetPositionFn, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import diverGlbUrl from '../models/diver.glb';
import {
  createStandardEnemyModelInstance,
  prepareStandardEnemyModel,
  type PreparedStandardEnemyModel,
} from '../systems/StandardEnemyModel.ts';
import {
  DIVER_MODEL_BUCKET_CONFIG,
  DIVER_MODEL_OFFSET,
  DIVER_MODEL_ROTATION,
  DIVER_TARGET_VISUAL_HEIGHT,
} from './EnemyDiverModel.ts';


const SPEED         = 150;
const VERT_SPEED    = 210;
const FIRE_INTERVAL = 1.9;
const PAUSE_DUR     = 0.20;
const DIVE_TILT_FACTOR = -0.3;
const HW = 25, HH = 22;

export class EnemyDiver extends Enemy {
  private static _model: PreparedStandardEnemyModel | null = null;
  private static _loadPromise: Promise<PreparedStandardEnemyModel> | null = null;

  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _spreadY: number;
  private _modelWrapper: THREE.Group | null = null;
  private _flashOverlay: THREE.Mesh<THREE.BufferGeometry, THREE.Material> | null = null;

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
    this._hp           = 2;
    this.score         = 200;
    this._dropChance   = 0.07;
    this._getPlayerPos = getPlayerPos;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;
    this._spreadY      = y - getPlayerPos().y;

    this._displayName = 'Diver';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

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
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
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

    const attachModel = (source: PreparedStandardEnemyModel): void => {
      if (!this._alive || this._mesh === null) return;
      const instance = createStandardEnemyModelInstance(source, {
        targetVisualHeight: DIVER_TARGET_VISUAL_HEIGHT,
        rotation: DIVER_MODEL_ROTATION,
        offset: DIVER_MODEL_OFFSET,
      });
      this._modelWrapper = instance.root;
      this._flashOverlay = instance.flashOverlay;
      group.add(instance.root);
    };

    if (EnemyDiver._model) {
      attachModel(EnemyDiver._model);
    } else if (typeof window !== 'undefined') {
      EnemyDiver._loadModel()
        .then(attachModel)
        .catch((error) => console.error('Failed to load diver GLB model:', error));
    }

    return group;
  }

  static preloadModel(): Promise<PreparedStandardEnemyModel> {
    return EnemyDiver._loadModel();
  }

  private static _loadModel(): Promise<PreparedStandardEnemyModel> {
    if (EnemyDiver._model) return Promise.resolve(EnemyDiver._model);
    if (EnemyDiver._loadPromise) return EnemyDiver._loadPromise;

    const loader = new GLTFLoader();
    EnemyDiver._loadPromise = new Promise((resolve, reject) => {
      loader.load(
        diverGlbUrl,
        (gltf) => {
          EnemyDiver._model = prepareStandardEnemyModel(gltf.scene, DIVER_MODEL_BUCKET_CONFIG);
          resolve(EnemyDiver._model);
        },
        undefined,
        reject,
      );
    });
    return EnemyDiver._loadPromise;
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
    this._modelWrapper = null;
    this._flashOverlay = null;
  }

}
