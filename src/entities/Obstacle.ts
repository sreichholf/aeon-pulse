import * as THREE from 'three';
import { Enemy } from './Enemy.ts';
import { EnemyType, UserDataKey, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed, ProceduralResourceCache, setMaterialBucket } from '../utils/ProceduralToolkit.ts';
import { DEFAULT_FLASH_MATERIAL } from '../systems/StandardEnemyModel.ts';

interface ObstacleResources {
  geometries: { column: THREE.BufferGeometry; nubs: THREE.BufferGeometry; veins: THREE.BufferGeometry };
  materials: { flesh: THREE.MeshPhongMaterial; vein: THREE.MeshBasicMaterial; spore: THREE.MeshBasicMaterial };
}

export class Obstacle extends Enemy {
  private static _cache = new ProceduralResourceCache<ObstacleResources>();

  private _overlays: THREE.Mesh[] = [];

  static initSharedResources(): void {
    Obstacle._cache.init(() => {

    const materials = {
      flesh: new THREE.MeshPhongMaterial({
        color: 0xb52d57,
        emissive: 0x2b0614,
        specular: 0xffaacc,
        shininess: 90,
        flatShading: true,
      }),
      vein: new THREE.MeshBasicMaterial({
        color: 0xff00aa,
        transparent: true,
        opacity: 0.95,
      }),
      spore: new THREE.MeshBasicMaterial({
        color: 0xb2ff00,
        transparent: true,
        opacity: 0.95,
      }),
    };
    setMaterialBucket(materials.flesh, 'body');
    setMaterialBucket(materials.vein, 'glow');
    setMaterialBucket(materials.spore, 'glow');

    const columnGeo = new THREE.CylinderGeometry(25, 25, 110, 6);

    const nubGeo = new THREE.SphereGeometry(4, 6, 6);
    const nubs = [
      { x: 18, y: 20, z: 18 },
      { x: -20, y: -10, z: 15 },
      { x: 10, y: -35, z: -23 },
    ];
    const nubGeos = nubs.map(pos => {
      const g = ensureNonIndexed(nubGeo);
      g.translate(pos.x, pos.y, pos.z);
      return g;
    });
    const mergedNubGeo = mergeGeometries(nubGeos);
    nubGeos.forEach(g => g.dispose());
    nubGeo.dispose();

    const veinGeo = new THREE.TorusGeometry(25.5, 1.2, 8, 16);
    const positionsY = [28, 0, -28];
    const veinGeos = positionsY.map(y => {
      const g = ensureNonIndexed(veinGeo);
      g.rotateX(Math.PI / 2);
      g.translate(0, y, 0);
      return g;
    });
    const mergedVeinGeo = mergeGeometries(veinGeos);
    veinGeos.forEach(g => g.dispose());
    veinGeo.dispose();

    return { geometries: { column: columnGeo, nubs: mergedNubGeo, veins: mergedVeinGeo }, materials };
  });
  }

  constructor(scene: IScene, sprites: Record<string, THREE.Texture>, x: number, y: number, projectileFactory: ProjectileFactoryFn) {
    super(scene, sprites, null, 0, 0, 25, 55, x, y, projectileFactory);
    this._hp          = 25;
    this.score        = 500;
    this._displayName = 'Obstacle';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  private _build3DModel(): THREE.Group {
    Obstacle.initSharedResources();

    const group = new THREE.Group();
    group.position.set(this.x, this.y, 0);

    const { geometries: geos, materials: mats } = Obstacle._cache.resources;

    const column = new THREE.Mesh(geos.column, mats.flesh);
    group.add(column);

    const nubMesh = new THREE.Mesh(geos.nubs, mats.spore);
    group.add(nubMesh);

    const veinMesh = new THREE.Mesh(geos.veins, mats.vein);
    group.add(veinMesh);

    for (const geo of [geos.column, geos.nubs, geos.veins]) {
      const overlay = new THREE.Mesh(geo, DEFAULT_FLASH_MATERIAL);
      overlay.visible = false;
      overlay.renderOrder = 20;
      group.add(overlay);
      this._overlays.push(overlay);
    }

    group.userData.isInstanced = true;
    group.userData[UserDataKey.ENEMY_TYPE] = EnemyType.OBSTACLE;
    return group;
  }

  override get isOffscreen(): boolean {
    return this._mesh ? this._mesh.position.x < -500 : true;
  }

  _tick(dt: number): void {
    if (!this._mesh) return;
    this._mesh.position.x -= 120 * dt;
    this._mesh.rotation.y += 0.4 * dt;
  }

  override _flash(): void {
    for (const overlay of this._overlays) overlay.visible = true;
    this._hitFlashTimer = 0.08;
  }

  override _restoreFlash(): void {
    for (const overlay of this._overlays) overlay.visible = false;
  }

  override destroy(): void {
    if (this._mesh) {
      this._scene.remove(this._mesh);
      this._mesh = null;
    }
    this._overlays = [];
  }
}
