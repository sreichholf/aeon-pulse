import * as THREE from 'three';
import type { IEffect, IScene, Vec2 } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

const MAX_SPEED = 600;
const ACCEL = 1200;
const COLLECT_RADIUS_SQ = 20 * 20;

export class CancellationPointItem implements IEffect {
  private _scene: IScene;
  private _mesh: THREE.Mesh;
  private _x: number;
  private _y: number;
  private _vx: number;
  private _vy: number;
  private _getPlayerPos: () => Vec2;
  private _onCollect: (amount: number) => void;
  private _time: number;
  private _isDone: boolean;

  constructor(
    scene: IScene,
    x: number,
    y: number,
    getPlayerPos: () => Vec2,
    onCollect: (amount: number) => void
  ) {
    this._scene = scene;
    this._x = x;
    this._y = y;
    this._getPlayerPos = getPlayerPos;
    this._onCollect = onCollect;
    this._time = 0;
    this._isDone = false;

    // Small outward burst initially
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 150;
    this._vx = Math.cos(angle) * speed;
    this._vy = Math.sin(angle) * speed;

    const geo = new THREE.OctahedronGeometry(2.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    this._mesh = new THREE.Mesh(geo, mat);
    this._mesh.position.set(x, y, 1);
    markRenderCategory(this._mesh, RenderCategory.EFFECT, 'cancellationPoint');
    this._scene.add(this._mesh);
  }

  get isDone(): boolean {
    return this._isDone;
  }

  update(dt: number): void {
    if (this._isDone) return;
    this._time += dt;

    this._mesh.rotation.y += 10 * dt;
    this._mesh.rotation.x += 8 * dt;

    const playerPos = this._getPlayerPos();
    const dx = playerPos.x - this._x;
    const dy = playerPos.y - this._y;
    const distSq = dx * dx + dy * dy;

    if (distSq < COLLECT_RADIUS_SQ) {
      this._onCollect(50);
      this._isDone = true;
      return;
    }

    // Magnetize towards player after brief delay
    if (this._time > 0.15) {
      const dist = Math.sqrt(distSq);
      if (dist > 0) {
        const nextSpeed = Math.min(MAX_SPEED, Math.sqrt(this._vx * this._vx + this._vy * this._vy) + ACCEL * dt);
        this._vx = (dx / dist) * nextSpeed;
        this._vy = (dy / dist) * nextSpeed;
      }
    }

    // Clamp speed
    const speedSq = this._vx * this._vx + this._vy * this._vy;
    if (speedSq > MAX_SPEED * MAX_SPEED) {
      const scale = MAX_SPEED / Math.sqrt(speedSq);
      this._vx *= scale;
      this._vy *= scale;
    }

    this._x += this._vx * dt;
    this._y += this._vy * dt;
    this._mesh.position.set(this._x, this._y, 1);
  }

  destroy(): void {
    if (this._mesh.parent) {
      this._mesh.parent.remove(this._mesh);
    }
  }
}
