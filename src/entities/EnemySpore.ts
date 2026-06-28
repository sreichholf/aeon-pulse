import * as THREE from 'three';
import { Enemy } from './Enemy.ts';
import { BulletType, EnemyType, UserDataKey, type GetPositionFn, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed, ProceduralResourceCache, setMaterialBucket } from '../utils/ProceduralToolkit.ts';
import { DEFAULT_FLASH_MATERIAL } from '../systems/StandardEnemyModel.ts';

interface EnemySporeResources {
  geometries: { core: THREE.BufferGeometry; nodules: THREE.BufferGeometry };
  materials: { core: THREE.MeshPhongMaterial; nodules: THREE.MeshBasicMaterial };
}

export class EnemySpore extends Enemy {
  private static _cache = new ProceduralResourceCache<EnemySporeResources>();

  private _vx: number;
  private _vy: number;
  private _time: number;
  private _coreOverlay: THREE.Mesh | null = null;
  private _satelliteOverlay: THREE.Mesh | null = null;

  static initSharedResources(): void {
    EnemySpore._cache.init(() => {
      const materials = {
        core: new THREE.MeshPhongMaterial({
          color: 0xb52d57,
          emissive: 0x2b0614,
          specular: 0xffaacc,
          shininess: 90,
          flatShading: true,
        }),
        nodules: new THREE.MeshBasicMaterial({
          color: 0xb2ff00,
          transparent: true,
          opacity: 0.90,
        }),
      };
      setMaterialBucket(materials.core, 'body');
      setMaterialBucket(materials.nodules, 'glow');

      const coreGeo = new THREE.IcosahedronGeometry(14, 1);

      const noduleCoords = [
        { r: 4.0, x: 8, y: 8, z: 8 },
        { r: 3.0, x: -8, y: -8, z: -8 },
        { r: 4.5, x: -9, y: 9, z: -4 },
        { r: 3.5, x: 7, y: -9, z: 6 },
        { r: 3.2, x: 0, y: 0, z: 12 },
        { r: 3.2, x: 0, y: 0, z: -12 },
      ];

      const noduleGeos: THREE.BufferGeometry[] = [];
      const noduleGeoCache: Record<string, THREE.BufferGeometry> = {};

      noduleCoords.forEach((c, idx) => {
        const key = `${c.r.toFixed(1)}_${idx % 2}`;
        if (!noduleGeoCache[key]) {
          noduleGeoCache[key] = (idx % 2 === 0)
            ? new THREE.OctahedronGeometry(c.r)
            : new THREE.TetrahedronGeometry(c.r);
        }
        const noduleCloned = ensureNonIndexed(noduleGeoCache[key]);
        noduleCloned.translate(c.x, c.y, c.z);
        noduleGeos.push(noduleCloned);
      });

      const mergedNoduleGeo = mergeGeometries(noduleGeos);

      noduleGeos.forEach(g => g.dispose());
      Object.values(noduleGeoCache).forEach(g => g.dispose());

      return { geometries: { core: coreGeo, nodules: mergedNoduleGeo }, materials };
    });
  }

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn,
    projectileFactory: ProjectileFactoryFn,
  ) {
    super(scene, sprites, null, 0, 0, 16, 16, x, y, projectileFactory);
    this._hp           = 4;
    this.score         = 300;
    this._dropChance   = 0.06;
    this._getPlayerPos = getPlayerPos;
    this._vx           = -40;
    this._vy           = (Math.random() - 0.5) * 30;
    this._time         = Math.random() * 10;

    this._displayName = 'Spore';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  private _build3DModel(): THREE.Group {
    EnemySpore.initSharedResources();

    const group = new THREE.Group();
    group.position.set(this.x, this.y, 0);

    const { geometries: geos, materials: mats } = EnemySpore._cache.resources;

    const core = new THREE.Mesh(geos.core, mats.core);
    group.add(core);

    const satelliteMesh = new THREE.Mesh(geos.nodules, mats.nodules);
    group.add(satelliteMesh);

    this._coreOverlay = new THREE.Mesh(geos.core, DEFAULT_FLASH_MATERIAL);
    this._coreOverlay.visible = false;
    this._coreOverlay.renderOrder = 20;
    group.add(this._coreOverlay);

    this._satelliteOverlay = new THREE.Mesh(geos.nodules, DEFAULT_FLASH_MATERIAL);
    this._satelliteOverlay.visible = false;
    this._satelliteOverlay.renderOrder = 20;
    group.add(this._satelliteOverlay);

    group.userData.isInstanced = true;
    group.userData[UserDataKey.ENEMY_TYPE] = EnemyType.SPORE;
    return group;
  }

  get isOffscreen(): boolean { return this._mesh ? this._mesh.position.x < -500 : true; }

  _tick(dt: number): void {
    this._time += dt;
    this._mesh!.position.x += this._vx * dt;
    this._mesh!.position.y += this._vy * dt;
    const scale = 1.0 + Math.sin(this._time * 4) * 0.1;
    this._mesh!.scale.setScalar(scale);

    // Biological 3D rolling rotation
    this._mesh!.rotation.x += 0.4 * dt;
    this._mesh!.rotation.y += 0.2 * dt;
  }

  _onDeath(): void {
    const ox = this.x, oy = this.y;
    for (let i = 0; i < 4; i++) {
      const a     = (i / 4) * Math.PI * 2;
      const speed = 120;
      this._pendingBullets.push(this._projectileFactory({
        type: BulletType.HOMING,
        x: ox,
        y: oy,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        getTargetPos: this._getPlayerPos,
      }));
    }
  }

  override _flash(): void {
    if (this._coreOverlay) this._coreOverlay.visible = true;
    if (this._satelliteOverlay) this._satelliteOverlay.visible = true;
    this._hitFlashTimer = 0.08;
  }

  override _restoreFlash(): void {
    if (this._coreOverlay) this._coreOverlay.visible = false;
    if (this._satelliteOverlay) this._satelliteOverlay.visible = false;
  }

  override destroy(): void {
    if (this._mesh) {
      this._scene.remove(this._mesh);
      this._mesh = null;
    }
    this._coreOverlay = null;
    this._satelliteOverlay = null;
  }
}
