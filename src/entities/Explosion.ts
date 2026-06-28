import * as THREE from 'three';
import type { IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

interface ExplosionOptions {
  count?:    number;
  minSpeed?: number;
  maxSpeed?: number;
  size?:     number;
  color?:    number;
  duration?: number;
}

export class Explosion {
  private _scene: IScene;
  private _duration: number;
  private _elapsed: number;
  private _done: boolean;
  private _pos: Float32Array;
  private _vel: Float32Array;
  private _count: number;
  private _pts: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

  constructor(scene: IScene, x: number, y: number, {
    count    = 20,
    minSpeed = 60,
    maxSpeed = 220,
    size     = 6,
    color    = 0xff6600,
    duration = 0.45,
  }: ExplosionOptions = {}) {
    this._scene    = scene;
    this._duration = duration;
    this._elapsed  = 0;
    this._done     = false;

    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = minSpeed + Math.random() * (maxSpeed - minSpeed);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 5;
      vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = Math.sin(a) * s;
    }
    this._pos = pos;
    this._vel = vel;
    this._count = count;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color, size, sizeAttenuation: false, transparent: true, opacity: 1, depthWrite: false,
    });
    this._pts = new THREE.Points(geo, mat);
    markRenderCategory(this._pts, RenderCategory.EFFECT);
    scene.add(this._pts);
  }

  get isDone(): boolean { return this._done; }

  update(dt: number): void {
    if (this._done) return;
    this._elapsed += dt;
    const progress = this._elapsed / this._duration;

    for (let i = 0; i < this._count; i++) {
      this._pos[i * 3]!     += this._vel[i * 3]!     * dt;
      this._pos[i * 3 + 1]! += this._vel[i * 3 + 1]! * dt;
    }
    this._pts.geometry.attributes['position']!.needsUpdate = true;
    this._pts.material.opacity = Math.max(0, 1 - progress);

    if (progress >= 1) {
      this._done = true;
      this.destroy();
    }
  }

  destroy(): void {
    this._scene.remove(this._pts);
    this._pts.geometry.dispose();
    this._pts.material.dispose();
  }
}
