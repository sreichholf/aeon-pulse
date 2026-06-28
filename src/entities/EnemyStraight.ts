import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { BulletType, EnemyType, UserDataKey, type EnemyPresentationContext, type GetPositionFn, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { StandardEnemyModelSource, type PreparedStandardEnemyModel } from '../systems/StandardEnemyModel.ts';
import { addVertexColor, ensureNonIndexed } from '../utils/ProceduralToolkit.ts';
import {
  STRAIGHT_COLLISION_HALF_HEIGHT,
  STRAIGHT_COLLISION_HALF_WIDTH,
  STRAIGHT_COLLISION_OFFSET_X,
  STRAIGHT_ENGINE_FLAME_OFFSET,
  STRAIGHT_LEFT_GUN_OFFSET,
  STRAIGHT_MODEL_BUCKET_CONFIG,
  STRAIGHT_MODEL_PROFILES,
  STRAIGHT_RIGHT_GUN_OFFSET,
  STRAIGHT_VISUAL_SCALE,
} from './EnemyStraightModel.ts';

const SPEED         = 130;
const FIRE_INTERVAL = 2.5;
const PAUSE_DUR     = 0.30;
const OUTWARD_CANT  = 0.08;

interface EnemyStraightOptions {
  presentationContext?: EnemyPresentationContext;
}

export class EnemyStraight extends Enemy {
  private static _source = new StandardEnemyModelSource({
    name: 'straight',
    profiles: STRAIGHT_MODEL_PROFILES,
    bucketConfig: STRAIGHT_MODEL_BUCKET_CONFIG,
  });

  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _lunging: boolean;
  private _lungeTimer: number;
  private _time: number;
  private _kickback: number;
  private _kickbackVel: number;
  private _engineScale: number;
  private _visualsGroup: THREE.Group | null = null;
  private _mainFlame: THREE.Object3D | null = null;
  private _leftGunPoint: THREE.Object3D | null = null;
  private _rightGunPoint: THREE.Object3D | null = null;
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
    options: EnemyStraightOptions = {},
  ) {
    super(
      scene,
      sprites,
      null,
      0,
      0,
      STRAIGHT_COLLISION_HALF_WIDTH,
      STRAIGHT_COLLISION_HALF_HEIGHT,
      x,
      y,
      projectileFactory,
    );
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
    this._presentationContext = options.presentationContext ?? 'gameplay';

    this._displayName = 'Straight';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }
  override get x(): number { return super.x + STRAIGHT_COLLISION_OFFSET_X; }
  override get hw(): number { return STRAIGHT_COLLISION_HALF_WIDTH; }
  override get hh(): number { return STRAIGHT_COLLISION_HALF_HEIGHT; }

  _tick(dt: number): void {
    this._time += dt;
    const pos = this._mesh!.position;

    let currentSpeed = SPEED;

    if (this._pausing) {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pausing   = false;
        this._lunging   = true;
        this._lungeTimer = PAUSE_DUR;
      }
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 0.79, 10 * dt);
      currentSpeed = SPEED * 0.79;
    } else if (this._lunging) {
      this._lungeTimer -= dt;
      if (this._lungeTimer <= 0) {
        this._lunging = false;
        this._fireTimer = FIRE_INTERVAL;
      }
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 1.21, 12 * dt);
      currentSpeed = SPEED * 1.21;
    } else {
      this._fireTimer -= dt;
      if (this._fireTimer <= 0 && pos.x < HALF_W - 60) {
        this._shootAtPlayer();
        this._pausing    = true;
        this._pauseTimer = PAUSE_DUR;
      }
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 1.0, 8 * dt);
      currentSpeed = SPEED;
    }

    pos.x -= currentSpeed * dt;

    if (this.terrainBounds) {
      pos.y = Math.max(
        this.terrainBounds.bottom + STRAIGHT_COLLISION_HALF_HEIGHT,
        Math.min(this.terrainBounds.top - STRAIGHT_COLLISION_HALF_HEIGHT, pos.y),
      );
    } else {
      pos.y = Math.max(
        -HALF_H + STRAIGHT_COLLISION_HALF_HEIGHT,
        Math.min(HALF_H - STRAIGHT_COLLISION_HALF_HEIGHT, pos.y),
      );
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
    const speed = 260;

    const createShot = (worldPos: THREE.Vector3, outwardCant: number) => {
      const targetAngle = Math.atan2(py - worldPos.y, px - worldPos.x);
      let diff = targetAngle - Math.PI;
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff < -Math.PI) diff += 2 * Math.PI;

      const firedAngle = Math.PI + diff * 0.5 + outwardCant;
      return this._projectileFactory({
        type: BulletType.ENEMY,
        x: worldPos.x,
        y: worldPos.y,
        vx: Math.cos(firedAngle) * speed,
        vy: Math.sin(firedAngle) * speed,
      });
    };

    this._newBullets.push(
      createShot(leftWorldPos, OUTWARD_CANT),
      createShot(rightWorldPos, -OUTWARD_CANT),
    );

    this._kickback = 7.0;
    this._kickbackVel = -75.0;
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);
    group.userData.isInstanced = true;
    group.userData[UserDataKey.ENEMY_TYPE] = EnemyType.STRAIGHT;

    const visuals = new THREE.Group();
    visuals.scale.setScalar(STRAIGHT_VISUAL_SCALE);
    group.add(visuals);
    this._visualsGroup = visuals;

    EnemyStraight._source.attach({
      target: visuals,
      context: this._presentationContext,
      isAlive: () => this._alive && this._mesh !== null,
      onInstance: (instance) => { this._flashOverlay = instance.flashOverlay; },
    });

    this._addLocalEffects(visuals);
    return group;
  }

  static preloadModel(context: EnemyPresentationContext = 'gameplay'): Promise<PreparedStandardEnemyModel> {
    return EnemyStraight._source.preload(context);
  }

  private _addLocalEffects(visuals: THREE.Group): void {
    const flameMesh = this._createMergedFlameMesh();
    visuals.add(flameMesh);
    this._mainFlame = flameMesh;

    const leftGun = new THREE.Object3D();
    leftGun.position.copy(STRAIGHT_LEFT_GUN_OFFSET);
    visuals.add(leftGun);
    this._leftGunPoint = leftGun;

    const rightGun = new THREE.Object3D();
    rightGun.position.copy(STRAIGHT_RIGHT_GUN_OFFSET);
    visuals.add(rightGun);
    this._rightGunPoint = rightGun;
  }

  private _createMergedFlameMesh(): THREE.Mesh {
    const { geometry, material } = getSharedStraightFlameAsset();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(STRAIGHT_ENGINE_FLAME_OFFSET);
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
    this._mesh = null;
    this._visualsGroup = null;
    this._mainFlame = null;
    this._leftGunPoint = null;
    this._rightGunPoint = null;
    this._flashOverlay = null;
  }
}

let _sharedStraightFlameAsset: {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
} | null = null;

function getSharedStraightFlameAsset(): {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
} {
  if (_sharedStraightFlameAsset) return _sharedStraightFlameAsset;

  const cones = [
    buildStraightFlameCone(1.2, 10, [0.5, 2.2, 2.8], 0xff5500),
    buildStraightFlameCone(1.2, 10, [0.5, 2.2, -2.8], 0xff5500),
    buildStraightFlameCone(0.6, 6, [2.5, 2.2, 2.8], 0xffe600),
    buildStraightFlameCone(0.6, 6, [2.5, 2.2, -2.8], 0xffe600),
  ];
  const geometry = mergeGeometries(cones, false);
  cones.forEach((g) => g.dispose());
  if (!geometry) throw new Error('Failed to merge Straight flame geometry');
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  _sharedStraightFlameAsset = { geometry, material };
  return _sharedStraightFlameAsset;
}

function buildStraightFlameCone(
  radius: number,
  height: number,
  position: [number, number, number],
  color: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  const geometry = ensureNonIndexed(new THREE.ConeGeometry(radius, height, 8));
  geometry.rotateZ(-Math.PI / 2);
  geometry.translate(...position);
  addVertexColor(geometry, new THREE.Color(color).getHex());
  return geometry;
}
