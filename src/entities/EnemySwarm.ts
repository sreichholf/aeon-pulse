import * as THREE from 'three';
import { Enemy, HALF_H } from './Enemy.ts';
import { EnemyType, UserDataKey, type EnemyPresentationContext, type GetPositionFn, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { StandardEnemyModelSource, type PreparedStandardEnemyModel } from '../systems/StandardEnemyModel.ts';
import {
  SWARM_MODEL_BUCKET_CONFIG,
  SWARM_MODEL_PROFILES,
} from './EnemySwarmModel.ts';

const SPEED         = 230;
const HW = 18, HH = 13;

interface EnemySwarmOptions {
  presentationContext?: EnemyPresentationContext;
}

export class EnemySwarm extends Enemy {
  private static _source = new StandardEnemyModelSource({
    name: 'swarm',
    profiles: SWARM_MODEL_PROFILES,
    bucketConfig: SWARM_MODEL_BUCKET_CONFIG,
  });

  private _modelWrapper: THREE.Group | null = null;
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
    options: EnemySwarmOptions = {},
  ) {
    super(scene, sprites, null, 0, 0, HW, HH, x, y, projectileFactory);
    this._hp           = 1;
    this.score         = 50;
    this._presentationContext = options.presentationContext ?? 'gameplay';
    void getPlayerPos;

    this._displayName = 'Swarm';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  _tick(dt: number): void {

    const pos = this._mesh!.position;
    pos.x -= SPEED * dt;

    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);
    group.userData.isInstanced = true;
    group.userData[UserDataKey.ENEMY_TYPE] = EnemyType.SWARM;

    EnemySwarm._source.attach({
      target: group,
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
    return EnemySwarm._source.preload(context);
  }

  _flash(): void {
    if (this._flashOverlay) {
      this._flashOverlay.visible = true;
    }
    if (this._mesh) {
      this._mesh.userData.isFlashing = true;
    }
    this._hitFlashTimer = 0.08;
  }

  _restoreFlash(): void {
    if (this._flashOverlay) {
      this._flashOverlay.visible = false;
    }
    if (this._mesh) {
      this._mesh.userData.isFlashing = false;
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
