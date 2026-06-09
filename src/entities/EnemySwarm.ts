import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import type { GetPositionFn, IAudio, IScene, ProjectileFactoryFn } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed } from '../utils/ProceduralToolkit.ts';


const SPEED         = 230;
const FIRE_INTERVAL = 2.7;
const PAUSE_DUR     = 0.20;
const HW = 18, HH = 13;

interface WingEntry {
  mesh: THREE.Mesh;
  side: number;
}

export class EnemySwarm extends Enemy {
  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _time?: number;
  private _wings: WingEntry[] = [];
  private _flame: THREE.Mesh | null = null;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn,
    projectileFactory: ProjectileFactoryFn,
    _audio: IAudio | null = null,
  ) {
    super(scene, sprites, null, 0, 0, HW, HH, x, y, projectileFactory);
    this._hp           = 1;
    this.score         = 50;
    this._getPlayerPos = getPlayerPos;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;

    this._displayName = 'Swarm';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  _shootAtPlayer(): void {
    super._shootAtPlayer(290 + Math.random() * 60, 'enemySwarm');
  }

  _tick(dt: number): void {
    this._time = (this._time || 0) + dt;

    // Wing flapping animation at ~45Hz
    if (this._wings.length > 0) {
      this._wings.forEach(w => {
        w.mesh.rotation.x = w.side * 0.4 + Math.sin(this._time! * 45) * 0.18;
      });
    }

    // Engine flame pulsing
    if (this._flame) {
      this._flame.scale.x = 1.0 + Math.sin(this._time * 50) * 0.22;
    }

    // Hovering jitter / buzz wobbles
    this._mesh!.rotation.x = Math.sin(this._time * 30) * 0.05;
    this._mesh!.rotation.z = Math.sin(this._time * 25) * 0.04;

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
    pos.x -= (this._pausing ? SPEED * 0.15 : SPEED) * dt;

    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);

    // ── MATERIALS ─────────────────────────────────────────────────────────────
    const hullMat = new THREE.MeshPhongMaterial({
      color:     0x13888f,
      emissive:  0x002b2e,
      shininess: 90,
      specular:  0x22aaaa,
    });

    const brightMat = new THREE.MeshPhongMaterial({
      color:     0x2bc1c9,
      emissive:  0x003333,
      shininess: 80,
      specular:  0x55dddd,
    });

    const cockpitMat = new THREE.MeshPhongMaterial({
      color:     0xaaffff,
      emissive:  0x004444,
      shininess: 130,
      specular:  0x99ffff,
    });

    const engineMat = new THREE.MeshPhongMaterial({
      color:     0x022b2e,
      shininess: 80,
      specular:  0x44bbbb,
    });

    const flameMat = new THREE.MeshPhongMaterial({
      color:       0x00ffee,
      emissive:    0x006655,
      transparent: true,
      opacity:     0.85,
      shininess:   20,
    });

    // ── 1. MAIN FUSELAGE — lathe (same technique as other 3D enemies) ──────────
    // A fat, rounded beetle/scarab body. Rotated so nose faces -X (left).
    // LatheGeometry rotates a profile around Y, then rotateZ(PI/2) swings Y→ -X.
    const lathePoints = [
      new THREE.Vector2(0,   15),  // nose tip
      new THREE.Vector2(3.5, 12),  // nose taper
      new THREE.Vector2(7,    7),  // max belly — broad and round
      new THREE.Vector2(8,    0),  // widest point (centre)
      new THREE.Vector2(6.5,  -6), // tail taper
      new THREE.Vector2(3,   -11), // tail end
    ];
    const latheGeo = new THREE.LatheGeometry(lathePoints, 18);
    latheGeo.rotateZ(Math.PI / 2); // nose now points in -X direction
    const fuselage = new THREE.Mesh(latheGeo, hullMat);
    group.add(fuselage);

    // ── 2. SWEPT DELTA WINGS ───────────────────────────────────────────────────
    // BoxGeometry wings with XY face visible from the camera. Angled ~25° around
    // X so the trailing edge sweeps backward, giving perspective and depth.
    const wingGeo = new THREE.BoxGeometry(14, 2.5, 5);
    wingGeo.translate(-1.5, 0, 0); // bias slightly rearward

    this._wings = [];
    for (const side of [1, -1]) {
      const wing = new THREE.Mesh(wingGeo, brightMat);
      wing.position.set(-1, side * 9, 0);
      wing.rotation.x = side * 0.4; // sweep the wing tip backward
      group.add(wing);
      this._wings.push({ mesh: wing, side: side });
    }

    // ── 3. FORWARD PRONGS (insectoid mandibles) ────────────────────────────────
    // Short cylinders that jut forward from the nose at ±Y — gives the
    // craft an aggressive silhouette and a clearly distinct front.
    const prongGeo = new THREE.CylinderGeometry(0.9, 0.5, 7, 8);
    prongGeo.rotateZ(Math.PI / 2);

    const prongGeos = [
      ensureNonIndexed(prongGeo).translate(-17, 4, 0),
      ensureNonIndexed(prongGeo).translate(-17, -4, 0),
    ];
    const mergedProngGeo = mergeGeometries(prongGeos);
    const prongsMesh = new THREE.Mesh(mergedProngGeo, brightMat);
    group.add(prongsMesh);

    // Clean up temporary geometries
    prongGeos.forEach(g => g.dispose());
    prongGeo.dispose();

    // ── 4. COCKPIT DOME ────────────────────────────────────────────────────────
    // A raised glowing sphere sitting on top of the fuselage, clearly 3D.
    const cockpitGeo = new THREE.SphereGeometry(3.5, 12, 10);
    cockpitGeo.scale(1.5, 1.0, 1.0);
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(-8, 0, 5); // forward, sitting proud on the dorsal surface
    group.add(cockpit);

    // ── 5. ENGINE NOZZLE + FLAME ───────────────────────────────────────────────
    const nozzleGeo = new THREE.CylinderGeometry(3.5, 2.5, 5, 12);
    nozzleGeo.rotateZ(Math.PI / 2);
    const nozzle = new THREE.Mesh(nozzleGeo, engineMat);
    nozzle.position.set(12, 0, 0); // tail
    group.add(nozzle);

    const flameGeo = new THREE.ConeGeometry(2.5, 9, 12);
    flameGeo.rotateZ(-Math.PI / 2);
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(19, 0, 0);
    group.add(flame);
    this._flame = flame;

    return group;
  }
}
