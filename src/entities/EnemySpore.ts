import * as THREE from 'three';
import { Enemy } from './Enemy.ts';
import { BulletType, type GetPositionFn, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed } from '../utils/ProceduralToolkit.ts';


export class EnemySpore extends Enemy {
  private _vx: number;
  private _vy: number;
  private _time: number;

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
    const group = new THREE.Group();
    group.position.set(this.x, this.y, 0);

    const coreMat = new THREE.MeshPhongMaterial({
      color: 0xb52d57,
      emissive: 0x2b0614,
      specular: 0xffaacc,
      shininess: 90,
      flatShading: true,
    });

    const noduleMat = new THREE.MeshBasicMaterial({
      color: 0xb2ff00,
      transparent: true,
      opacity: 0.90,
    });

    // Central faceted biological spore core
    const coreGeo = new THREE.IcosahedronGeometry(14, 1);
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Dynamic biological satellite nodule crystals
    const noduleCoords = [
      { r: 4.0, x: 8, y: 8, z: 8 },
      { r: 3.0, x: -8, y: -8, z: -8 },
      { r: 4.5, x: -9, y: 9, z: -4 },
      { r: 3.5, x: 7, y: -9, z: 6 },
      { r: 3.2, x: 0, y: 0, z: 12 },
      { r: 3.2, x: 0, y: 0, z: -12 }
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
    const satelliteMesh = new THREE.Mesh(mergedNoduleGeo, noduleMat);
    group.add(satelliteMesh);

    // Clean up nodule geometries
    noduleGeos.forEach(g => g.dispose());
    Object.values(noduleGeoCache).forEach(g => g.dispose());

    // Pre-populate origColor for flash traversal
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (!Array.isArray(mat) && 'color' in mat) {
          child.userData['origColor'] = (mat as THREE.MeshPhongMaterial | THREE.MeshBasicMaterial).color.getHex();
        }
      }
    });

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
}
