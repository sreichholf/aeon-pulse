import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import type { GetPositionFn, IAudio, IScene } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed, addVertexColor } from '../utils/ProceduralToolkit.ts';


const SPEED         = 150;
const VERT_SPEED    = 210;
const FIRE_INTERVAL = 1.4;
const PAUSE_DUR     = 0.20;
const HW = 15, HH = 22;

export class EnemyDiver extends Enemy {
  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _spreadY: number;
  private _time?: number;
  private _flames: THREE.Mesh[] = [];

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn,
    _audio: IAudio | null = null,
  ) {
    super(scene, sprites, null, 0, 0, HW, HH, x, y);
    this._hp           = 2;
    this.score         = 200;
    this._dropChance   = 0.07;
    this._getPlayerPos = getPlayerPos;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;
    this._spreadY      = y - getPlayerPos().y;

    this._displayName = 'Diver';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  _shootAtPlayer(): void {
    super._shootAtPlayer(340, 'enemyDiver');
  }

  _tick(dt: number): void {
    this._time = (this._time || 0) + dt;
    const pos = this._mesh!.position;
    if (this._pausing) {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pausing   = false;
        this._fireTimer = FIRE_INTERVAL;
      }
    } else {
      this._fireTimer -= dt;
      if (this._fireTimer <= 0 && pos.x < HALF_W - 60) {
        this._shootAtPlayer();
        this._pausing    = true;
        this._pauseTimer = PAUSE_DUR;
      }
    }

    // Each diver targets player Y plus 40% of its original formation spread,
    // so a 5-ship vForm stays spaced out instead of all stacking at player Y.
    const targetY  = this._getPlayerPos!().y + this._spreadY * 0.4;
    const diff     = targetY - pos.y;
    const maxDelta = VERT_SPEED * dt;
    const deltaY   = Math.max(-maxDelta, Math.min(maxDelta, diff));
    pos.y += deltaY;

    const speedX = this._pausing ? SPEED * 0.15 : SPEED;
    pos.x -= speedX * dt;

    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }

    // Dynamic Visual animations: rapid pulsing thrusters and smooth dynamic dive tilting
    const dy = deltaY / (dt || 0.016);
    const targetZ = -Math.atan2(dy, -speedX);
    this._mesh!.rotation.z = THREE.MathUtils.lerp(this._mesh!.rotation.z, targetZ, 8 * dt);

    if (this._flames.length > 0) {
      const flameScale = 1.0 + Math.sin(this._time * 35) * 0.18;
      this._flames.forEach(f => f.scale.x = flameScale);
    }
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);

    // ── MATERIALS ─────────────────────────────────────────────────────────────
    const hullMat = new THREE.MeshPhongMaterial({
      color:        0xffffff,
      emissive:     0x331e00,
      shininess:    90,
      specular:     0xaa7733,
      vertexColors: true,
    });

    const flameMat = new THREE.MeshPhongMaterial({
      color:       0xff8800,
      emissive:    0x662200,
      transparent: true,
      opacity:     0.78,
      shininess:   30,
    });

    // ── 1. HEAVY FUSELAGE (LATHE) + OUTER WING TIPS (hullMat) ─────────────────
    // Fatter, more imposing profile than the interceptor — this is a bomber.
    // LatheGeometry rotates around Y; rotateZ(PI/2) swings nose to -X (left).
    const lathePoints = [
      new THREE.Vector2(0,   20),  // nose tip
      new THREE.Vector2(4,   16),  // nose taper
      new THREE.Vector2(9,    8),  // broad belly — heavier than interceptor
      new THREE.Vector2(10,   0),  // widest centre point
      new THREE.Vector2(8,   -8),  // tail taper
      new THREE.Vector2(4,  -14),  // tail end
    ];
    const latheGeo = new THREE.LatheGeometry(lathePoints, 18);
    const fuselageGeo = ensureNonIndexed(latheGeo);
    fuselageGeo.rotateZ(Math.PI / 2);

    const tipGeo = new THREE.BoxGeometry(9, 2, 5);
    addVertexColor(fuselageGeo, 0xd4953b);
    const hullGeos = [fuselageGeo];

    for (const side of [1, -1]) {
      const tipCloned = ensureNonIndexed(tipGeo);
      tipCloned.rotateZ(side * -0.25);
      tipCloned.translate(-3, side * 19, 0);
      addVertexColor(tipCloned, 0xd4953b);
      hullGeos.push(tipCloned);
    }

    // ── 2. SWEPT DORSAL & VENTRAL FINS (brightMat) ────────────────────────────
    // BoxGeometry fins with real Z-depth (7 units) so they look solid from every
    // angle and rotate naturally when the ship dives. These replace the old flat
    // ExtrudeGeometry blade wings that looked like spinning cards.
    // Each fin is a swept trapezoid approximated by two boxes — a wide root slab
    // and a narrower outer tip — giving a classic swept-fin silhouette.
    const rootGeo = new THREE.BoxGeometry(14, 3, 7);
    for (const side of [1, -1]) {
      // Root slab — wide, attached to body
      const rootCloned = ensureNonIndexed(rootGeo);
      rootCloned.rotateZ(side * -0.15);
      rootCloned.translate(-1, side * 12, 0);
      addVertexColor(rootCloned, 0xffbe5c);
      hullGeos.push(rootCloned);
    }

    // ── 3. COCKPIT DOME ────────────────────────────────────────────────────────
    // Raised prominently in Z so it's clearly visible — platinum/silver dome
    // sitting on the dorsal surface just behind the nose.
    const cockpitGeo = new THREE.SphereGeometry(4, 14, 10);
    const cockpitCloned = ensureNonIndexed(cockpitGeo);
    cockpitCloned.scale(1.3, 0.75, 0.85);
    cockpitCloned.translate(-7, 0, 8); // raised 8 units in Z, forward on hull
    addVertexColor(cockpitCloned, 0xddddff);
    hullGeos.push(cockpitCloned);

    // ── 4. DUAL ENGINE NOZZLES & FLAMES ──────────────────────────────────────
    const nozzleGeo = new THREE.CylinderGeometry(2.8, 2.2, 7, 12);
    const flameGeo = new THREE.ConeGeometry(2.0, 9, 12);
    flameGeo.rotateZ(-Math.PI / 2);
    const flameGeos: THREE.BufferGeometry[] = [];

    this._flames = [];
    for (const side of [1, -1]) {
      const nozzleCloned = ensureNonIndexed(nozzleGeo);
      nozzleCloned.rotateZ(Math.PI / 2);
      nozzleCloned.translate(13, side * 5, 0);
      addVertexColor(nozzleCloned, 0x2e1b05);
      hullGeos.push(nozzleCloned);

      const flameCloned = ensureNonIndexed(flameGeo);
      flameCloned.translate(20, side * 5, 0);
      flameGeos.push(flameCloned);
    }

    const mergedHullGeo = mergeGeometries(hullGeos);
    const hullMesh = new THREE.Mesh(mergedHullGeo, hullMat);
    group.add(hullMesh);

    const mergedFlameGeo = mergeGeometries(flameGeos);
    const flameMesh = new THREE.Mesh(mergedFlameGeo, flameMat);
    group.add(flameMesh);
    this._flames.push(flameMesh);

    hullGeos.forEach(g => g.dispose());
    flameGeos.forEach(g => g.dispose());
    latheGeo.dispose();
    tipGeo.dispose();
    rootGeo.dispose();
    cockpitGeo.dispose();
    nozzleGeo.dispose();
    flameGeo.dispose();

    return group;
  }
}
