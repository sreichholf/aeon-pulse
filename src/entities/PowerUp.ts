import * as THREE from 'three';
import { GAME_WIDTH } from '../constants.ts';
import type { IScene } from '../types.ts';

const HALF_W    = GAME_WIDTH  / 2;
const DRIFT_VX  = -55;   // floats slowly left
const BOB_AMP   = 7;     // vertical bob amplitude px
const BOB_FREQ  = 3.0;   // Hz
const HW        = 14;    // collision half-width
const HH        = 14;    // collision half-height

export class PowerUp {
  private _scene: IScene;
  private _baseY: number;
  private _time: number;
  private _mesh: THREE.Group;
  private _core: THREE.Mesh;
  private _ring1: THREE.Mesh;
  private _ring2: THREE.Mesh;

  constructor(scene: IScene, x: number, y: number) {
    this._scene = scene;
    this._baseY = y;
    this._time  = 0;

    // Create central master group
    this._mesh = new THREE.Group();
    this._mesh.position.set(x, y, 1);

    // --- Premium 3D Gyroscopic Powerup Materials ---
    // Faceted, glowing translucent magenta crystal core
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0xff00ee,
      emissive: 0x4a0044,
      specular: 0xffaaff,
      shininess: 120,
      transparent: true,
      opacity: 0.88,
      flatShading: true, // gives a sharp, diamond-faceted look
    });

    // Sleek metallic cyan for the gyroscopic outer cage rings
    const ringMat = new THREE.MeshPhongMaterial({
      color: 0x00ffcc,
      emissive: 0x004433,
      specular: 0xffffff,
      shininess: 100,
    });

    // 1. Central faceted octahedron crystal core
    const coreGeo = new THREE.OctahedronGeometry(6.5, 1);
    this._core = new THREE.Mesh(coreGeo, coreMat);
    this._mesh.add(this._core);

    // 2. Nested Gyroscopic Cage Rings
    // Outer Ring
    const ring1Geo = new THREE.TorusGeometry(11.5, 0.85, 8, 24);
    this._ring1 = new THREE.Mesh(ring1Geo, ringMat);
    this._mesh.add(this._ring1);

    // Inner Ring (slightly smaller, rotated orthogonally)
    const ring2Geo = new THREE.TorusGeometry(9.0, 0.70, 8, 20);
    this._ring2 = new THREE.Mesh(ring2Geo, ringMat);
    this._ring2.rotation.x = Math.PI / 2;
    this._mesh.add(this._ring2);

    scene.add(this._mesh);
  }

  get x(): number  { return this._mesh.position.x; }
  get y(): number  { return this._mesh.position.y; }
  get hw(): number { return HW; }
  get hh(): number { return HH; }

  get isOffscreen(): boolean {
    return this._mesh.position.x < -HALF_W - 40;
  }

  update(dt: number): void {
    this._time += dt;

    // Movement: Drift left and apply vertical bobbing wave
    this._mesh.position.x += DRIFT_VX * dt;
    this._mesh.position.y  = this._baseY + Math.sin(this._time * BOB_FREQ) * BOB_AMP;

    // --- Dynamic Micro-Animations ---
    // A. Central core spins rapidly on offset axes and pulsates organically
    this._core.rotation.y += 2.8 * dt;
    this._core.rotation.x += 1.4 * dt;
    const pulseScale = 1.0 + Math.sin(this._time * 6.5) * 0.15;
    this._core.scale.setScalar(pulseScale);

    // B. Gyroscopic outer rings counter-rotate on offset angles
    this._ring1.rotation.y += 1.5 * dt;
    this._ring1.rotation.z += 0.8 * dt;

    this._ring2.rotation.x += 2.0 * dt;
    this._ring2.rotation.y -= 1.2 * dt;
  }

  destroy(): void {
    this._scene.remove(this._mesh);

    // Deep resource disposal to prevent GPU memory leaks
    this._mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}
