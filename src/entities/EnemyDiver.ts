import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { ProjectileSourceKey, type GetPositionFn, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import diverGlbUrl from '../models/diver.glb';


const SPEED         = 150;
const VERT_SPEED    = 210;
const FIRE_INTERVAL = 1.4;
const PAUSE_DUR     = 0.20;
const TARGET_VISUAL_HEIGHT = 44;
const GLB_ROT_X = Math.PI / 2;
const GLB_ROT_Y = -Math.PI / 2;
const GLB_ROT_Z = Math.PI / 2;
const GLB_OFFSET_X = 0;
const GLB_OFFSET_Y = 0;
const GLB_OFFSET_Z = 0;
const DIVE_TILT_FACTOR = 0.3;
const HW = 25, HH = 22;

export class EnemyDiver extends Enemy {
  private static _model: THREE.Group | null = null;
  private static _loadPromise: Promise<THREE.Group> | null = null;

  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _spreadY: number;
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

    const attachModel = (source: THREE.Group): void => {
      if (!this._alive || this._mesh === null) return;
      this._modelWrapper = this._createModelWrapper(source);
      group.add(this._modelWrapper);
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

  static preloadModel(): Promise<THREE.Group> {
    return EnemyDiver._loadModel();
  }

  private static _loadModel(): Promise<THREE.Group> {
    if (EnemyDiver._model) return Promise.resolve(EnemyDiver._model);
    if (EnemyDiver._loadPromise) return EnemyDiver._loadPromise;

    const loader = new GLTFLoader();
    EnemyDiver._loadPromise = new Promise((resolve, reject) => {
      loader.load(
        diverGlbUrl,
        (gltf) => {
          EnemyDiver._model = gltf.scene;
          resolve(gltf.scene);
        },
        undefined,
        reject,
      );
    });
    return EnemyDiver._loadPromise;
  }

  private _createModelWrapper(source: THREE.Group): THREE.Group {
    const shipModel = source.clone(true);
    shipModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry = child.geometry.clone();
        if (Array.isArray(child.material)) {
          child.material = child.material.map((material) => material.clone());
        } else {
          child.material = child.material.clone();
        }
        this._tuneModelMaterial(child.material);
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(shipModel);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    shipModel.position.set(-center.x, -center.y, -center.z);

    const wrapper = new THREE.Group();
    wrapper.add(shipModel);
    wrapper.rotation.set(GLB_ROT_X, GLB_ROT_Y, GLB_ROT_Z);
    const scaleFactor = TARGET_VISUAL_HEIGHT / (size.y || 1);
    wrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);
    wrapper.position.set(GLB_OFFSET_X, GLB_OFFSET_Y, GLB_OFFSET_Z);

    return wrapper;
  }

  private _tuneModelMaterial(material: THREE.Material | THREE.Material[]): void {
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      mat.side = THREE.DoubleSide;
      mat.depthTest = true;
      mat.visible = true;
      if ('opacity' in mat && typeof mat.opacity === 'number' && mat.opacity < 1) {
        mat.transparent = true;
        mat.depthWrite = false;
      }
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.envMapIntensity = 0.9;
        if (mat.emissiveMap) {
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.8);
        }
      }
      mat.needsUpdate = true;
    }
  }

}
