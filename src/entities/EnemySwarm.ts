import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { ProjectileSourceKey, type GetPositionFn, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import swarmGlbUrl from '../models/swarm.glb';
import {
  createStandardEnemyModelInstance,
  prepareStandardEnemyModel,
  type PreparedStandardEnemyModel,
} from '../systems/StandardEnemyModel.ts';
import {
  SWARM_MODEL_BUCKET_CONFIG,
  SWARM_MODEL_OFFSET,
  SWARM_MODEL_ROTATION,
  SWARM_TARGET_VISUAL_HEIGHT,
} from './EnemySwarmModel.ts';

const SPEED         = 230;
const FIRE_INTERVAL = 2.7;
const PAUSE_DUR     = 0.20;
const HW = 18, HH = 13;

export class EnemySwarm extends Enemy {
  private static _model: PreparedStandardEnemyModel | null = null;
  private static _loadPromise: Promise<PreparedStandardEnemyModel> | null = null;

  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
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
    this._hp           = 1;
    this.score         = 50;
    this._getPlayerPos = getPlayerPos;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;

    this._displayName = 'Swarm';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  _shootAtPlayer(): void {
    super._shootAtPlayer(290 + Math.random() * 60, ProjectileSourceKey.ENEMY_SWARM);
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
    pos.x -= (this._pausing ? SPEED * 0.15 : SPEED) * dt;

    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);

    const attachModel = (source: PreparedStandardEnemyModel): void => {
      if (!this._alive || this._mesh === null) return;
      const instance = createStandardEnemyModelInstance(source, {
        targetVisualHeight: SWARM_TARGET_VISUAL_HEIGHT,
        rotation: SWARM_MODEL_ROTATION,
        offset: SWARM_MODEL_OFFSET,
      });
      this._modelWrapper = instance.root;
      this._flashOverlay = instance.flashOverlay;
      group.add(instance.root);
    };

    if (EnemySwarm._model) {
      attachModel(EnemySwarm._model);
    } else if (typeof window !== 'undefined') {
      EnemySwarm._loadModel()
        .then(attachModel)
        .catch((error) => console.error('Failed to load swarm GLB model:', error));
    }

    return group;
  }

  static preloadModel(): Promise<PreparedStandardEnemyModel> {
    return EnemySwarm._loadModel();
  }

  private static _loadModel(): Promise<PreparedStandardEnemyModel> {
    if (EnemySwarm._model) return Promise.resolve(EnemySwarm._model);
    if (EnemySwarm._loadPromise) return EnemySwarm._loadPromise;

    const loader = new GLTFLoader();
    EnemySwarm._loadPromise = new Promise((resolve, reject) => {
      loader.load(
        swarmGlbUrl,
        (gltf) => {
          EnemySwarm._model = prepareStandardEnemyModel(gltf.scene, SWARM_MODEL_BUCKET_CONFIG);
          resolve(EnemySwarm._model);
        },
        undefined,
        reject,
      );
    });
    return EnemySwarm._loadPromise;
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
