import * as THREE from 'three';
import { Enemy } from './Enemy.ts';
import type { IScene } from '../types.ts';

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
    nubs.forEach(pos => {
      const nub = new THREE.Mesh(nubGeo, sporeMat);
      nub.position.set(pos.x, pos.y, pos.z);
      group.add(nub);
    });

    // 3. Fleshy magenta vein rings wrapping the column
    const veinGeo1 = new THREE.TorusGeometry(25.5, 1.2, 8, 16);
    const veinGeo2 = new THREE.TorusGeometry(25.5, 1.2, 8, 16);
    const veinGeo3 = new THREE.TorusGeometry(25.5, 1.2, 8, 16);

    const vein1 = new THREE.Mesh(veinGeo1, veinMat);
    vein1.rotation.x = Math.PI / 2;
    vein1.position.set(0, 28, 0);
    group.add(vein1);

    const vein2 = new THREE.Mesh(veinGeo2, veinMat);
    vein2.rotation.x = Math.PI / 2;
    vein2.position.set(0, 0, 0);
    group.add(vein2);

    const vein3 = new THREE.Mesh(veinGeo3, veinMat);
    vein3.rotation.x = Math.PI / 2;
    vein3.position.set(0, -28, 0);
    group.add(vein3);

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
