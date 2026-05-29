import * as THREE from 'three';
import { Enemy } from './Enemy.ts';
import type { IScene } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function ensureNonIndexed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return geo.index ? geo.toNonIndexed() : geo.clone();
}

export class Obstacle extends Enemy {
  constructor(scene: IScene, sprites: Record<string, THREE.Texture>, x: number, y: number) {
    super(scene, sprites, null, 0, 0, 25, 55, x, y);
    this._hp          = 25;
    this.score        = 500;
    this._displayName = 'Obstacle';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this.x, this.y, 0);

    const fleshMat = new THREE.MeshPhongMaterial({
      color: 0xb52d57,
      emissive: 0x2b0614,
      specular: 0xffaacc,
      shininess: 90,
      flatShading: true,
    });

    const veinMat = new THREE.MeshBasicMaterial({
      color: 0xff00aa,
      transparent: true,
      opacity: 0.95,
    });

    const sporeMat = new THREE.MeshBasicMaterial({
      color: 0xb2ff00,
      transparent: true,
      opacity: 0.95,
    });

    // 1. Faceted biological hexagonal column
    const columnGeo = new THREE.CylinderGeometry(25, 25, 110, 6);
    const column = new THREE.Mesh(columnGeo, fleshMat);
    group.add(column);

    // 2. Bioluminescent toxic-green spore nubs protruding from hex surface
    const nubGeo = new THREE.SphereGeometry(4, 6, 6);
    const nubs = [
      { x: 18, y: 20, z: 18 },
      { x: -20, y: -10, z: 15 },
      { x: 10, y: -35, z: -23 }
    ];
    const nubGeos = nubs.map(pos => {
      const g = ensureNonIndexed(nubGeo);
      g.translate(pos.x, pos.y, pos.z);
      return g;
    });
    const mergedNubGeo = mergeGeometries(nubGeos);
    const nubMesh = new THREE.Mesh(mergedNubGeo, sporeMat);
    group.add(nubMesh);

    nubGeos.forEach(g => g.dispose());
    nubGeo.dispose();

    // 3. Fleshy magenta vein rings wrapping the column
    const veinGeo = new THREE.TorusGeometry(25.5, 1.2, 8, 16);
    const positionsY = [28, 0, -28];
    const veinGeos = positionsY.map(y => {
      const g = ensureNonIndexed(veinGeo);
      g.rotateX(Math.PI / 2);
      g.translate(0, y, 0);
      return g;
    });
    const mergedVeinGeo = mergeGeometries(veinGeos);
    const veinMesh = new THREE.Mesh(mergedVeinGeo, veinMat);
    group.add(veinMesh);

    veinGeos.forEach(g => g.dispose());
    veinGeo.dispose();

    // Pre-populate origColor for flash traversal
    group.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshPhongMaterial;
        if (mat.color) {
          child.userData['origColor'] = mat.color.getHex();
        }
      }
    });

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
}
