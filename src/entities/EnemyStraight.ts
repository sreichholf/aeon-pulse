import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { BulletType, type GetPositionFn, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import straightGlbUrl from '../models/straight.glb';
import {
  createStandardEnemyModelInstance,
  prepareStandardEnemyModel,
  type PreparedStandardEnemyModel,
} from '../systems/StandardEnemyModel.ts';
import {
  STRAIGHT_MODEL_BUCKET_CONFIG,
  STRAIGHT_MODEL_OFFSET,
  STRAIGHT_MODEL_ROTATION,
  STRAIGHT_TARGET_MODEL_HEIGHT,
  STRAIGHT_VISUAL_ROTATION_X,
  STRAIGHT_VISUAL_SCALE,
} from './EnemyStraightModel.ts';

const SPEED         = 130;
const FIRE_INTERVAL = 2.5;
const PAUSE_DUR     = 0.30;
const HW = 30, HH = 34;

export class EnemyStraight extends Enemy {
  private static _model: PreparedStandardEnemyModel | null = null;
  private static _loadPromise: Promise<PreparedStandardEnemyModel> | null = null;

  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _lunging: boolean;
  private _lungeTimer: number;
  private _time: number;
  private _kickback: number;
  private _kickbackVel: number;
  private _engineScale: number;
  private _visorFlash: number;
  private _visorPulseTime: number;
  private _visorMaterial: THREE.MeshBasicMaterial | null = null;
  private _visualsGroup: THREE.Group | null = null;
  private _mainFlame: THREE.Object3D | null = null;
  private _leftGunPoint: THREE.Object3D | null = null;
  private _rightGunPoint: THREE.Object3D | null = null;
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
    this.score         = 100;
    this._dropChance   = 0.07;
    this._getPlayerPos = getPlayerPos;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;
    this._lunging      = false;
    this._lungeTimer   = 0;

    this._time           = 0;
    this._kickback       = 0;
    this._kickbackVel    = 0;
    this._engineScale    = 1.0;
    this._visorFlash     = 0.4;
    this._visorPulseTime = 0;

    this._displayName = 'Straight';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  _tick(dt: number): void {
    this._time += dt;
    this._visorPulseTime += dt;
    const pos = this._mesh!.position;

    let currentSpeed = SPEED;

    if (this._pausing) {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pausing   = false;
        this._lunging   = true;
        this._lungeTimer = PAUSE_DUR;
      }
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 2.5, 8 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 0.79, 10 * dt);
      currentSpeed = SPEED * 0.79;
    } else if (this._lunging) {
      this._lungeTimer -= dt;
      if (this._lungeTimer <= 0) {
        this._lunging = false;
        this._fireTimer = FIRE_INTERVAL;
      }
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 0.4, 6 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 1.21, 12 * dt);
      currentSpeed = SPEED * 1.21;
    } else {
      this._fireTimer -= dt;
      if (this._fireTimer <= 0 && pos.x < HALF_W - 60) {
        this._shootAtPlayer();
        this._pausing    = true;
        this._pauseTimer = PAUSE_DUR;
      }
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 0.4, 6 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 1.0, 8 * dt);
      currentSpeed = SPEED;
    }

    pos.x -= currentSpeed * dt;

    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }

    if (this._visorMaterial) {
      const pulse = 1.0 + Math.sin(this._visorPulseTime * 25) * 0.35;
      const intensity = this._visorFlash * (this._pausing ? pulse : 1.0);
      this._visorMaterial.color.setRGB(0.9 * intensity, 0.08 * intensity, 0.08 * intensity);
    }

    const k = 440;
    const c = 28;
    const force = -k * this._kickback - c * this._kickbackVel;
    this._kickbackVel += force * dt;
    this._kickback += this._kickbackVel * dt;
    if (this._visualsGroup) {
      this._visualsGroup.position.x = this._kickback;
    }

    const jitter = 1.0 + Math.sin(this._time * 40) * 0.20;
    const flameScale = this._engineScale * jitter;

    if (this._mainFlame) {
      this._mainFlame.scale.set(flameScale, this._engineScale, this._engineScale);
      this._mainFlame.visible = flameScale > 0.05;
    }
  }

  _shootAtPlayer(): void {
    if (!this._getPlayerPos) return;

    if (this._mesh) {
      this._mesh.updateMatrixWorld(true);
    }

    const leftWorldPos = new THREE.Vector3();
    const rightWorldPos = new THREE.Vector3();

    if (this._leftGunPoint && this._rightGunPoint) {
      this._leftGunPoint.getWorldPosition(leftWorldPos);
      this._rightGunPoint.getWorldPosition(rightWorldPos);
    } else {
      leftWorldPos.set(this.x, this.y, 0);
      rightWorldPos.set(this.x, this.y, 0);
    }

    const { x: px, y: py } = this._getPlayerPos();
    const targetAngle = Math.atan2(py - this.y, px - this.x);
    let diff = targetAngle - Math.PI;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;

    const firedAngle = Math.PI + diff * 0.5;
    const speed = 260;
    const vx = Math.cos(firedAngle) * speed;
    const vy = Math.sin(firedAngle) * speed;

    this._newBullets.push(
      this._projectileFactory({ type: BulletType.ENEMY, x: leftWorldPos.x, y: leftWorldPos.y, vx, vy }),
      this._projectileFactory({ type: BulletType.ENEMY, x: rightWorldPos.x, y: rightWorldPos.y, vx, vy }),
    );

    this._kickback = 7.0;
    this._kickbackVel = -75.0;
    this._visorPulseTime = 0;
    if (this._visorMaterial) {
      this._visorMaterial.color.setRGB(3.0, 3.0, 3.0);
    }
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);

    const visuals = new THREE.Group();
    visuals.rotation.x = STRAIGHT_VISUAL_ROTATION_X;
    visuals.scale.setScalar(STRAIGHT_VISUAL_SCALE);
    group.add(visuals);
    this._visualsGroup = visuals;

    const attachModel = (source: PreparedStandardEnemyModel): void => {
      if (!this._alive || this._mesh === null) return;
      const instance = createStandardEnemyModelInstance(source, {
        targetVisualHeight: STRAIGHT_TARGET_MODEL_HEIGHT,
        rotation: STRAIGHT_MODEL_ROTATION,
        offset: STRAIGHT_MODEL_OFFSET,
      });
      this._flashOverlay = instance.flashOverlay;
      visuals.add(instance.root);
    };

    if (EnemyStraight._model) {
      attachModel(EnemyStraight._model);
    } else if (typeof window !== 'undefined') {
      EnemyStraight._loadModel()
        .then(attachModel)
        .catch((error) => console.error('Failed to load straight GLB model:', error));
    }

    this._addLocalEffects(visuals);
    return group;
  }

  static preloadModel(): Promise<PreparedStandardEnemyModel> {
    return EnemyStraight._loadModel();
  }

  private static _loadModel(): Promise<PreparedStandardEnemyModel> {
    if (EnemyStraight._model) return Promise.resolve(EnemyStraight._model);
    if (EnemyStraight._loadPromise) return EnemyStraight._loadPromise;

    const loader = new GLTFLoader();
    EnemyStraight._loadPromise = new Promise((resolve, reject) => {
      loader.load(
        straightGlbUrl,
        (gltf) => {
          EnemyStraight._model = prepareStandardEnemyModel(gltf.scene, STRAIGHT_MODEL_BUCKET_CONFIG);
          resolve(EnemyStraight._model);
        },
        undefined,
        reject,
      );
    });
    return EnemyStraight._loadPromise;
  }

  private _addLocalEffects(visuals: THREE.Group): void {
    this._visorMaterial = new THREE.MeshBasicMaterial({
      color: 0x5c0808,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.74, 2.9), this._visorMaterial);
    visor.position.set(-13.5, 1.32, 0);
    visor.rotation.z = 0.1;
    visor.renderOrder = 25;
    visor.userData['uniqueEffect'] = true;
    visuals.add(visor);

    const flameGroup = new THREE.Group();
    flameGroup.position.set(13.0, 0, 0);
    flameGroup.add(
      this._createFlameCone(1.2, 10, [0.5, 2.2, 2.8], 0xff5500, 0.78),
      this._createFlameCone(1.2, 10, [0.5, 2.2, -2.8], 0xff5500, 0.78),
      this._createFlameCone(0.6, 6, [2.5, 2.2, 2.8], 0xffe600, 0.92),
      this._createFlameCone(0.6, 6, [2.5, 2.2, -2.8], 0xffe600, 0.92),
    );
    visuals.add(flameGroup);
    this._mainFlame = flameGroup;

    const leftGun = new THREE.Object3D();
    leftGun.position.set(10.5, -0.4, 23.0);
    visuals.add(leftGun);
    this._leftGunPoint = leftGun;

    const rightGun = new THREE.Object3D();
    rightGun.position.set(10.5, -0.4, -23.0);
    visuals.add(rightGun);
    this._rightGunPoint = rightGun;
  }

  private _createFlameCone(
    radius: number,
    height: number,
    position: [number, number, number],
    color: THREE.ColorRepresentation,
    opacity: number,
  ): THREE.Mesh {
    const geometry = new THREE.ConeGeometry(radius, height, 8);
    geometry.rotateZ(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.userData['uniqueEffect'] = true;
    return mesh;
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
    this._mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData['uniqueEffect']) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this._mesh = null;
    this._visualsGroup = null;
    this._mainFlame = null;
    this._leftGunPoint = null;
    this._rightGunPoint = null;
    this._flashOverlay = null;
    this._visorMaterial = null;
  }
}
