import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import type { GetPositionFn, IAudio, IScene } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function ensureNonIndexed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return geo.index ? geo.toNonIndexed() : geo.clone();
}

function addVertexColor(geo: THREE.BufferGeometry, colorHex: number): void {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color(colorHex);
  for (let i = 0; i < count; i++) {
    colors[i * 3]     = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

const SPEED         = 130;
const FIRE_INTERVAL = 2.5;
const PAUSE_DUR     = 0.30;
const HW = 35, HH = 15;

export class EnemyStraight extends Enemy {
  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _lunging: boolean;
  private _lungeTimer: number;
  private _time: number;
  private _kickback: number;
  private _kickbackVel: number;
  private _engineScale: number;
  private _visorFlash: number;
  private _visorPulseTime: number;
  private _visorMat: THREE.MeshPhongMaterial | null = null;
  private _visualsGroup: THREE.Group | null = null;
  private _mainFlame: THREE.Mesh | null = null;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn,
    _audio: IAudio | null = null,
  ) {
    super(scene, sprites, null, 0, 0, HW, HH, x, y);
    this._hp           = 1;
    this.score         = 100;
    this._dropChance   = 0.07;
    this._getPlayerPos = getPlayerPos;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;
    this._lunging      = false;
    this._lungeTimer   = 0;

    // Animations states
    this._time           = 0;
    this._kickback       = 0;
    this._kickbackVel    = 0;
    this._engineScale    = 1.0;
    this._visorFlash     = 0.4;
    this._visorPulseTime = 0;

    this._displayName = 'Straight';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  _tick(dt: number): void {
    this._time += dt;
    this._visorPulseTime += dt;
    const pos = this._mesh!.position;

    // 1. Aiming, Pausing, and Lunging speed compensation logic
    let currentSpeed = SPEED;

    if (this._pausing) {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pausing   = false;
        this._lunging   = true;
        this._lungeTimer = PAUSE_DUR;
      }
      // Visor warning flare & engine throttle-down
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 2.5, 8 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 0.79, 10 * dt);
      currentSpeed = SPEED * 0.79;
    } else if (this._lunging) {
      this._lungeTimer -= dt;
      if (this._lungeTimer <= 0) {
        this._lunging = false;
        this._fireTimer = FIRE_INTERVAL;
      }
      // Visor returning to resting state & engine supercharged forward-lunge
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 0.4, 6 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 1.21, 12 * dt);
      currentSpeed = SPEED * 1.21; // Forward lunge at 1.21x speed to fully compensate!
    } else {
      this._fireTimer -= dt;
      if (this._fireTimer <= 0 && pos.x < HALF_W - 60) {
        this._shootAtPlayer();
        this._pausing    = true;
        this._pauseTimer = PAUSE_DUR;
      }
      // Visor resting state & engine throttle-up
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 0.4, 6 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 1.0, 8 * dt);
      currentSpeed = SPEED;
    }

    // Move left
    pos.x -= currentSpeed * dt;

    // Bounds clamping
    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }

    // 2. Visor Emissive Pulse Animation
    if (this._visorMat) {
      const pulse = 1.0 + Math.sin(this._visorPulseTime * 25) * 0.35;
      const intensity = this._visorFlash * (this._pausing ? pulse : 1.0);
      this._visorMat.emissive.setRGB(0.9 * intensity, 0.08 * intensity, 0.08 * intensity);
    }

    // 3. Firing Spring Recoil Backlash (Underdamped Harmonic Oscillation)
    const k = 220; // Stiffness
    const c = 14;  // Damping (allows one clean, punchy forward overshoot/compensation)
    const force = -k * this._kickback - c * this._kickbackVel;
    this._kickbackVel += force * dt;
    this._kickback += this._kickbackVel * dt;
    if (this._visualsGroup) {
      this._visualsGroup.position.x = this._kickback;
    }

    // 4. Supersonic Jitter Thrusters
    const jitter = 1.0 + Math.sin(this._time * 40) * 0.20;
    const flameScale = this._engineScale * jitter;

    if (this._mainFlame) {
      this._mainFlame.scale.set(flameScale, this._engineScale, this._engineScale);
      this._mainFlame.visible = flameScale > 0.05;
    }

    // Subtle idle body wobble in X-axis
    this._mesh!.rotation.x = Math.sin(this._time * 15) * 0.08;
  }

  _shootAtPlayer(): void {
    super._shootAtPlayer();
    this._kickback = 2.0; // Recoil to the right (+X) (scaled down by 75% total)
    this._kickbackVel = -21.25; // Forward-lash velocity to the left (-X) to compensate (scaled down by 75% total)
    this._visorPulseTime = 0;
    if (this._visorMat) {
      // Visor turns pure white-hot briefly upon firing
      this._visorMat.emissive.setRGB(3.0, 3.0, 3.0);
    }
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);

    // Visuals container to isolate dynamic kickback translation from position
    const visuals = new THREE.Group();
    group.add(visuals);
    this._visualsGroup = visuals;

    // --- Materials (Obsidian Raider Design System) ---
    const shipMat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      emissive: 0x242938, // Unified ambient self-illumination
      shininess: 100,
      specular: 0xffffff, // Mirror-like chrome specularity
      flatShading: true,
    });

    const visorMat = new THREE.MeshPhongMaterial({
      color: 0xff1a2c,
      emissive: 0xaa0005,
      shininess: 100,
      specular: 0xff8899,
    });
    this._visorMat = visorMat;

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00ffd2,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    // --- 1. Faceted Tapering Hexagonal Fuselage (Aerodynamic Stealth Hull) ---
    const bodyGeo = new THREE.CylinderGeometry(4.0, 5.0, 16, 6);
    bodyGeo.rotateZ(Math.PI / 2); // Lay along the horizontal X-axis

    const noseGeo = new THREE.CylinderGeometry(0.8, 4.0, 10, 6);
    noseGeo.rotateZ(Math.PI / 2);

    const rearGeo = new THREE.CylinderGeometry(5.0, 4.2, 5, 6);
    rearGeo.rotateZ(Math.PI / 2);

    // --- 2. Cockpit Canopy & Tactical Visors ---
    const canopyGeo = new THREE.CylinderGeometry(1.2, 2.5, 8, 5);
    canopyGeo.rotateZ(Math.PI / 2);

    const sensorGeo = new THREE.BoxGeometry(3, 0.6, 3);

    // --- 3. Forward-Swept Wings & Beveled Armor Fillets ---
    const wingShape = new THREE.Shape();
    wingShape.moveTo(10, 0);
    wingShape.lineTo(-6, 22);
    wingShape.lineTo(-12, 21);
    wingShape.lineTo(-2, 0);
    wingShape.lineTo(-12, -21);
    wingShape.lineTo(-6, -22);
    wingShape.closePath();

    const extrudeBase = {
      depth: 1.5,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.8,
      bevelThickness: 0.8
    };
    const baseWingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeBase);
    baseWingGeo.center();
    baseWingGeo.rotateX(Math.PI / 2);

    const filletShape = new THREE.Shape();
    filletShape.moveTo(11, 0);
    filletShape.lineTo(1, 9);
    filletShape.lineTo(-4, 8);
    filletShape.lineTo(-3, 0);
    filletShape.lineTo(-4, -8);
    filletShape.lineTo(1, -9);
    filletShape.closePath();

    const extrudeFillet = {
      depth: 3.5,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.5,
      bevelThickness: 0.5
    };
    const filletGeo = new THREE.ExtrudeGeometry(filletShape, extrudeFillet);
    filletGeo.center();
    filletGeo.rotateX(Math.PI / 2);

    const flapTopGeo = new THREE.BoxGeometry(5, 1.2, 11);
    const flapBotGeo = new THREE.BoxGeometry(5, 1.2, 11);
    const panelLeftGeo = new THREE.BoxGeometry(5, 7.5, 1.2);
    const panelRightGeo = new THREE.BoxGeometry(5, 7.5, 1.2);

    // Carbon structural geometries (Pearlescent silver-white: 0xdce3f0)
    const bodyCloned = ensureNonIndexed(bodyGeo);
    bodyCloned.translate(1, 0, 0);
    addVertexColor(bodyCloned, 0xdce3f0);

    const noseCloned = ensureNonIndexed(noseGeo);
    noseCloned.translate(-12, 0, 0);
    addVertexColor(noseCloned, 0xdce3f0);

    const rearCloned = ensureNonIndexed(rearGeo);
    rearCloned.translate(11.5, 0, 0);
    addVertexColor(rearCloned, 0xdce3f0);

    const wingCloned = ensureNonIndexed(baseWingGeo);
    addVertexColor(wingCloned, 0xdce3f0);

    const filletCloned = ensureNonIndexed(filletGeo);
    filletCloned.translate(2, 0, 0);
    addVertexColor(filletCloned, 0xdce3f0);

    const flapTopCloned = ensureNonIndexed(flapTopGeo);
    flapTopCloned.translate(14, 4.0, 0);
    addVertexColor(flapTopCloned, 0xdce3f0);

    const flapBotCloned = ensureNonIndexed(flapBotGeo);
    flapBotCloned.translate(14, -4.0, 0);
    addVertexColor(flapBotCloned, 0xdce3f0);

    const panelLeftCloned = ensureNonIndexed(panelLeftGeo);
    panelLeftCloned.translate(14, 0, 4.9);
    addVertexColor(panelLeftCloned, 0xdce3f0);

    const panelRightCloned = ensureNonIndexed(panelRightGeo);
    panelRightCloned.translate(14, 0, -4.9);
    addVertexColor(panelRightCloned, 0xdce3f0);

    const carbonGeos = [
      bodyCloned, noseCloned, rearCloned, wingCloned, filletCloned,
      flapTopCloned, flapBotCloned, panelLeftCloned, panelRightCloned
    ];

    // Crimson wing inserts geometries (Glowing neon red: 0xff3b50)
    const midShape = new THREE.Shape();
    midShape.moveTo(8, 0);
    midShape.lineTo(-5, 17);
    midShape.lineTo(-10, 16);
    midShape.lineTo(-1, 0);
    midShape.lineTo(-10, -16);
    midShape.lineTo(-5, -17);
    midShape.closePath();

    const extrudeMid = {
      depth: 1.2,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.6,
      bevelThickness: 0.6
    };
    const midWingGeo = new THREE.ExtrudeGeometry(midShape, extrudeMid);
    midWingGeo.center();
    midWingGeo.rotateX(Math.PI / 2);

    const midWingR = ensureNonIndexed(midWingGeo);
    midWingR.translate(0, 0, 1.8);
    addVertexColor(midWingR, 0xff3b50);

    const midWingL = ensureNonIndexed(midWingGeo);
    midWingL.translate(0, 0, -1.8);
    addVertexColor(midWingL, 0xff3b50);

    const crimsonGeos = [midWingR, midWingL];

    // Obsidian outer wing tips geometries (Polished gunmetal steel: 0x7a8ca8)
    const outerShape = new THREE.Shape();
    outerShape.moveTo(6, 0);
    outerShape.lineTo(-4, 12);
    outerShape.lineTo(-8, 11);
    outerShape.lineTo(0, 0);
    outerShape.lineTo(-8, -11);
    outerShape.lineTo(-4, -12);
    outerShape.closePath();

    const extrudeOuter = {
      depth: 1.0,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.4,
      bevelThickness: 0.4
    };
    const outerWingGeo = new THREE.ExtrudeGeometry(outerShape, extrudeOuter);
    outerWingGeo.center();
    outerWingGeo.rotateX(Math.PI / 2);

    const outerWingR = ensureNonIndexed(outerWingGeo);
    outerWingR.translate(0, 0, 3.2);
    addVertexColor(outerWingR, 0x7a8ca8);

    const outerWingL = ensureNonIndexed(outerWingGeo);
    outerWingL.translate(0, 0, -3.2);
    addVertexColor(outerWingL, 0x7a8ca8);

    const obsidianGeos = [outerWingR, outerWingL];

    // Nozzles geometries (Brighter metallic sockets: 0x8293ad)
    const nozzleCentralGeo = new THREE.CylinderGeometry(2.0, 1.6, 3.5, 12);
    nozzleCentralGeo.rotateZ(Math.PI / 2);
    const nozzleSideGeo = new THREE.CylinderGeometry(1.4, 1.0, 3, 12);
    nozzleSideGeo.rotateZ(Math.PI / 2);

    const nozzleCentral = ensureNonIndexed(nozzleCentralGeo);
    nozzleCentral.translate(12.5, 0, 0);
    addVertexColor(nozzleCentral, 0x8293ad);

    const nozzleSideR = ensureNonIndexed(nozzleSideGeo);
    nozzleSideR.translate(12.0, 2.5, 1.8);
    addVertexColor(nozzleSideR, 0x8293ad);

    const nozzleSideL = ensureNonIndexed(nozzleSideGeo);
    nozzleSideL.translate(12.0, -2.5, -1.8);
    addVertexColor(nozzleSideL, 0x8293ad);

    const nozzleGeos = [nozzleCentral, nozzleSideR, nozzleSideL];

    // Merge structural geometries into a single ship mesh
    const hullGeos = [
      ...carbonGeos,
      ...crimsonGeos,
      ...obsidianGeos,
      ...nozzleGeos
    ];
    const mergedHullGeo = mergeGeometries(hullGeos);
    const shipMesh = new THREE.Mesh(mergedHullGeo, shipMat);
    visuals.add(shipMesh);

    // Clean up temporary geometries
    hullGeos.forEach(g => g.dispose());
    bodyGeo.dispose();
    noseGeo.dispose();
    rearGeo.dispose();
    baseWingGeo.dispose();
    filletGeo.dispose();
    flapTopGeo.dispose();
    flapBotGeo.dispose();
    panelLeftGeo.dispose();
    panelRightGeo.dispose();
    midWingGeo.dispose();
    outerWingGeo.dispose();
    nozzleCentralGeo.dispose();
    nozzleSideGeo.dispose();

    // --- 4. Glowing independent visor cockpit/sensor ---
    const canopyGeoCloned = ensureNonIndexed(canopyGeo);
    canopyGeoCloned.rotateY(0.1);
    canopyGeoCloned.translate(-5, 3.2, 0);

    const sensorGeoCloned = ensureNonIndexed(sensorGeo);
    sensorGeoCloned.rotateZ(0.2);
    sensorGeoCloned.translate(-14.5, -1.0, 0);

    const visorGeos = [canopyGeoCloned, sensorGeoCloned];
    const mergedVisorGeo = mergeGeometries(visorGeos);
    const visorMesh = new THREE.Mesh(mergedVisorGeo, visorMat);
    visuals.add(visorMesh);

    // Clean up temporary visor geometries
    visorGeos.forEach(g => g.dispose());
    canopyGeo.dispose();
    sensorGeo.dispose();

    // --- 5. Merged engine flames (Supersonic cyan exhaust cones) ---
    const flameCentralGeo = new THREE.ConeGeometry(1.6, 9, 12);
    flameCentralGeo.rotateZ(-Math.PI / 2);
    const flameSideGeo = new THREE.ConeGeometry(1.0, 7, 12);
    flameSideGeo.rotateZ(-Math.PI / 2);

    const flameCentralCloned = ensureNonIndexed(flameCentralGeo);
    flameCentralCloned.translate(1.0, 0, 0); // 18.0 - 17.0 = 1.0

    const flameSideTCloned = ensureNonIndexed(flameSideGeo);
    flameSideTCloned.translate(-0.5, 2.5, 1.8); // 16.5 - 17.0 = -0.5

    const flameSideBCloned = ensureNonIndexed(flameSideGeo);
    flameSideBCloned.translate(-0.5, -2.5, -1.8); // 16.5 - 17.0 = -0.5

    const flameGeos = [flameCentralCloned, flameSideTCloned, flameSideBCloned];
    const mergedFlameGeo = mergeGeometries(flameGeos);
    const flameMesh = new THREE.Mesh(mergedFlameGeo, flameMat);
    flameMesh.position.set(17.0, 0, 0);
    visuals.add(flameMesh);
    this._mainFlame = flameMesh;

    // Clean up temporary flame geometries
    flameGeos.forEach(g => g.dispose());
    flameCentralGeo.dispose();
    flameSideGeo.dispose();

    visuals.scale.set(1.32, 1.32, 1.32);
    return group;
  }
}
