import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import type { GetPositionFn, IAudio, IScene } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed, addVertexColor } from '../utils/ProceduralToolkit.ts';


const SPEED         = 110;
const SINE_AMP      = 80;
const SINE_FREQ     = 1.8;
const FIRE_INTERVAL = 2.0;
const PAUSE_DUR     = 0.25;
const HW = 27, HH = 20;

export class EnemySine extends Enemy {
  private _time: number;
  private _startY: number;
  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _kickback: number;
  protected _isViewer?: boolean;  // set externally by viewer code (Agent 5)
  private _clawTF: THREE.Group | null = null;
  private _clawTB: THREE.Group | null = null;
  private _clawBF: THREE.Group | null = null;
  private _clawBB: THREE.Group | null = null;
  private _nozzleTGroup: THREE.Group | null = null;
  private _nozzleBGroup: THREE.Group | null = null;
  private _flameT: THREE.Mesh | null = null;
  private _flameB: THREE.Mesh | null = null;
  private _irisMat: THREE.MeshPhongMaterial | null = null;
  private _pupil: THREE.Mesh | null = null;
  private _visualsGroup: THREE.Group | null = null;

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
    this.score         = 150;
    this._dropChance   = 0.06;
    this._getPlayerPos = getPlayerPos;
    this._time         = 0;
    this._startY       = y;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;
    this._kickback     = 0;

    this._displayName = 'Sine';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  _shootAtPlayer(): void {
    super._shootAtPlayer(260, 'enemySine');
    this._kickback = 10.0;
  }

  _tick(dt: number): void {
    this._time += dt;
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
    const speedX = this._pausing ? SPEED * 0.15 : SPEED;
    pos.x -= speedX * dt;

    // Smooth dynamic path banking (tilt based on vertical sine velocity)
    const amp = this._isViewer ? 22 : SINE_AMP;
    const freq = this._isViewer ? 1.2 : SINE_FREQ;

    const slopeY = amp * freq * Math.cos(this._time * freq);
    pos.y  = this._startY + amp * Math.sin(this._time * freq);

    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }

    // 1. Path-Responsive Claw Flaps rotation (flexing/compressing based on Y slope)
    const factor = Math.min(1.0, Math.max(-1.0, slopeY / 120.0));
    const maxRotation = 0.35; // ~20 degrees of active claw movement

    if (this._clawTF) this._clawTF.rotation.z = THREE.MathUtils.lerp(this._clawTF.rotation.z, factor * maxRotation, dt * 10);
    if (this._clawTB) this._clawTB.rotation.z = THREE.MathUtils.lerp(this._clawTB.rotation.z, -factor * maxRotation, dt * 10);
    if (this._clawBF) this._clawBF.rotation.z = THREE.MathUtils.lerp(this._clawBF.rotation.z, -factor * maxRotation, dt * 10);
    if (this._clawBB) this._clawBB.rotation.z = THREE.MathUtils.lerp(this._clawBB.rotation.z, factor * maxRotation, dt * 10);

    // 2. Active Vectoring Steering (dual nozzles pivot dynamically opposite to banking)
    const targetVectorAngle = (slopeY / speedX) * 0.9;
    if (this._nozzleTGroup) {
      this._nozzleTGroup.rotation.z = THREE.MathUtils.lerp(this._nozzleTGroup.rotation.z, targetVectorAngle, dt * 10);
    }
    if (this._nozzleBGroup) {
      this._nozzleBGroup.rotation.z = THREE.MathUtils.lerp(this._nozzleBGroup.rotation.z, targetVectorAngle, dt * 10);
    }

    // 3. Firing Recoil Kickback Interpolation
    this._kickback = THREE.MathUtils.lerp(this._kickback, 0, dt * 10);
    if (this._visualsGroup) {
      this._visualsGroup.position.x = this._kickback;
    }

    // 4. High-frequency dual thruster flame jitter
    const jitterT = 1.0 + Math.sin(this._time * 50) * 0.25;
    const jitterB = 1.0 + Math.cos(this._time * 45) * 0.25;
    const throttleScale = this._pausing ? 0.3 : 1.0;
    if (this._flameT) {
      this._flameT.scale.set(throttleScale * jitterT, throttleScale * (1.0 + Math.sin(this._time * 20) * 0.1), throttleScale);
      this._flameT.visible = throttleScale > 0.05;
    }
    if (this._flameB) {
      this._flameB.scale.set(throttleScale * jitterB, throttleScale * (1.0 + Math.cos(this._time * 20) * 0.1), throttleScale);
      this._flameB.visible = throttleScale > 0.05;
    }

    // 5. Charging/discharge eye iris glow & pupil dilation pulse
    let pupilScale = 1.0;
    if (this._irisMat) {
      if (this._pausing) {
        // Post-fire discharge cooling phase (white-hot flash decaying back to lime green)
        const ratio = this._pauseTimer / PAUSE_DUR; // 1.0 down to 0.0
        const r = 0.13 + ratio * 2.87;
        const g = 0.73 + ratio * 2.27;
        const b = 0.13 + ratio * 2.87;
        this._irisMat.emissive.setRGB(r, g, b);
        pupilScale = 0.4 + (1 - ratio) * 0.6;
      } else if (this._fireTimer <= 0.35) {
        // Pre-fire charging warning flare
        const chargeRatio = (0.35 - this._fireTimer) / 0.35; // 0.0 up to 1.0
        const pulse = 1.0 + Math.sin(this._time * 65) * 0.5;
        const intensity = 1.0 + chargeRatio * 2.0 * pulse;
        this._irisMat.emissive.setRGB(0.13 * intensity, 0.73 * intensity, 0.13 * intensity);
        pupilScale = 1.0 + chargeRatio * 0.4;
      } else {
        // Cruising idle state
        const idlePulse = Math.sin(this._time * 5) * 0.15 + 0.85;
        this._irisMat.emissive.setRGB(0.13 * idlePulse, 0.73 * idlePulse, 0.13 * idlePulse);
        pupilScale = 1.0;
      }
    }
    if (this._pupil) {
      this._pupil.scale.set(1.0, pupilScale, pupilScale);
    }

    // Ship Z banking rotation matching original logic
    this._mesh!.rotation.z = -(slopeY / speedX) * 0.85;
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);

    // Visuals container to isolate dynamic kickback translation from position
    const visuals = new THREE.Group();
    visuals.scale.set(1.36, 1.36, 1.36);
    group.add(visuals);
    this._visualsGroup = visuals;

    // --- Materials (Bio-Mechanical Interceptor Design System) ---
    const structuralMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0x003305,
      shininess: 90,
      specular: 0x339933,
      flatShading: true,
      vertexColors: true,
    });

    const cockpitMat = new THREE.MeshPhongMaterial({
      color: 0xccff55,
      transparent: true,
      opacity: 0.65,
      shininess: 100,
      specular: 0x99cc33, // glassy canopy lime specular
    });

    const engineMetalMat = new THREE.MeshPhongMaterial({
      color: 0x0c260c, // deep dark forest metal
      shininess: 80,
      specular: 0xaaff00,
    });

    const irisMat = new THREE.MeshPhongMaterial({
      color: 0x5ce65c,
      emissive: 0x22bb22,
      shininess: 30,
    });
    this._irisMat = irisMat;

    const pupilMat = new THREE.MeshPhongMaterial({
      color: 0x030703,
      shininess: 10,
    });

    const flameMat = new THREE.MeshPhongMaterial({
      color: 0xaaff00,
      emissive: 0x335500,
      transparent: true,
      opacity: 0.8,
      shininess: 30,
      blending: THREE.AdditiveBlending,
    });

    // ── 1. CENTRAL SPHERICAL CORE & CARAPACE PANELS (2x Scaled) ──────────────
    // Base Core Sphere (Radius 12)
    const coreGeo = new THREE.SphereGeometry(12, 16, 16);

    // Segmented Carapace Panels: Top, Bottom, and Rear bands (Radius ~12.4)
    const topPanelGeo = new THREE.SphereGeometry(12.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3);
    const bottomPanelGeo = new THREE.SphereGeometry(12.4, 16, 8, 0, Math.PI * 2, Math.PI * 2 / 3, Math.PI / 3);
    const rearPanelGeo = new THREE.SphereGeometry(12.2, 16, 8, Math.PI / 2, Math.PI, Math.PI / 4, Math.PI / 2);

    const coreCloned = ensureNonIndexed(coreGeo);
    addVertexColor(coreCloned, 0x0c260c);

    const topPanelCloned = ensureNonIndexed(topPanelGeo);
    addVertexColor(topPanelCloned, 0x2ebd2e);

    const bottomPanelCloned = ensureNonIndexed(bottomPanelGeo);
    addVertexColor(bottomPanelCloned, 0x2ebd2e);

    const rearPanelCloned = ensureNonIndexed(rearPanelGeo);
    addVertexColor(rearPanelCloned, 0x5ce65c);

    const coreGeos = [coreCloned, topPanelCloned, bottomPanelCloned, rearPanelCloned];
    const mergedCoreGeo = mergeGeometries(coreGeos);
    const coreMesh = new THREE.Mesh(mergedCoreGeo, structuralMat);
    visuals.add(coreMesh);

    // Clean up temporary geometries
    coreGeos.forEach(g => g.dispose());
    coreGeo.dispose();
    topPanelGeo.dispose();
    bottomPanelGeo.dispose();
    rearPanelGeo.dispose();

    // ── 2. DEEP BIO-APERTURE OPTIC EYE (2x Scaled) ───────────────────────────
    // Glass Outer Lens Dome (Hemisphere radius 6.0 pointing along -X direction)
    const lensGeo = new THREE.SphereGeometry(6.0, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    lensGeo.rotateZ(Math.PI / 2);
    const lensMesh = new THREE.Mesh(lensGeo, cockpitMat);
    lensMesh.position.set(-9.0, 0, 0);
    visuals.add(lensMesh);

    // Glowing Lime-Green Iris (Radius 5.0, nested behind lens)
    const irisGeo = new THREE.CylinderGeometry(5.0, 5.0, 1.0, 16);
    irisGeo.rotateZ(Math.PI / 2);
    const irisMesh = new THREE.Mesh(irisGeo, irisMat);
    irisMesh.position.set(-8.0, 0, 0);
    visuals.add(irisMesh);

    // Dark Central Pupil
    const pupilGeo = new THREE.CylinderGeometry(1.6, 1.6, 1.6, 8);
    pupilGeo.rotateZ(Math.PI / 2);
    const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
    pupilMesh.position.set(-8.4, 0, 0);
    visuals.add(pupilMesh);
    this._pupil = pupilMesh;

    // ── 3. FOUR ACTIVE MANEUVERING CLAWS (2x Scaled) ─────────────────────────
    const shieldGeo = new THREE.BoxGeometry(12, 3.6, 6.4);
    const spikeGeo = new THREE.ConeGeometry(1.6, 8.0, 4);
    spikeGeo.rotateZ(Math.PI / 2);
    const hingeGeo = new THREE.CylinderGeometry(2.4, 2.4, 7.2, 8);

    // Claw 1: Top-Front (TF) - Pivot Group centered at hinge joint (-2, 11, 0)
    this._clawTF = new THREE.Group();
    this._clawTF.position.set(-2, 11, 0);

    const shieldTFCloned = ensureNonIndexed(shieldGeo);
    shieldTFCloned.rotateZ(0.2);
    shieldTFCloned.translate(-6, 4, 0);
    addVertexColor(shieldTFCloned, 0x2ebd2e);

    const spikeTFCloned = ensureNonIndexed(spikeGeo);
    spikeTFCloned.rotateZ(0.5);
    spikeTFCloned.translate(-13, 2.6, 0);
    addVertexColor(spikeTFCloned, 0x0c260c);
    const hingeTFCloned = ensureNonIndexed(hingeGeo);
    addVertexColor(hingeTFCloned, 0x0c260c);
    const clawTFGeos = [shieldTFCloned, spikeTFCloned, hingeTFCloned];
    const mergedClawTFGeo = mergeGeometries(clawTFGeos);
    const clawTFMesh = new THREE.Mesh(mergedClawTFGeo, structuralMat);

    this._clawTF.add(clawTFMesh);
    visuals.add(this._clawTF);

    clawTFGeos.forEach(g => g.dispose());

    // Claw 2: Top-Back (TB) - Pivot Group centered at hinge joint (2, 11, 0)
    this._clawTB = new THREE.Group();
    this._clawTB.position.set(2, 11, 0);

    const shieldTBCloned = ensureNonIndexed(shieldGeo);
    shieldTBCloned.rotateZ(-0.2);
    shieldTBCloned.translate(6, 4, 0);
    addVertexColor(shieldTBCloned, 0x2ebd2e);

    const spikeTBCloned = ensureNonIndexed(spikeGeo);
    spikeTBCloned.rotateZ(-0.5);
    spikeTBCloned.translate(13, 2.6, 0);
    addVertexColor(spikeTBCloned, 0x0c260c);
    const hingeTBCloned = ensureNonIndexed(hingeGeo);
    addVertexColor(hingeTBCloned, 0x0c260c);
    const clawTBGeos = [shieldTBCloned, spikeTBCloned, hingeTBCloned];
    const mergedClawTBGeo = mergeGeometries(clawTBGeos);
    const clawTBMesh = new THREE.Mesh(mergedClawTBGeo, structuralMat);

    this._clawTB.add(clawTBMesh);
    visuals.add(this._clawTB);

    clawTBGeos.forEach(g => g.dispose());

    // Claw 3: Bottom-Front (BF) - Pivot Group centered at hinge joint (-2, -11, 0)
    this._clawBF = new THREE.Group();
    this._clawBF.position.set(-2, -11, 0);

    const shieldBFCloned = ensureNonIndexed(shieldGeo);
    shieldBFCloned.rotateZ(-0.2);
    shieldBFCloned.translate(-6, -4, 0);
    addVertexColor(shieldBFCloned, 0x2ebd2e);

    const spikeBFCloned = ensureNonIndexed(spikeGeo);
    spikeBFCloned.rotateZ(-0.5);
    spikeBFCloned.translate(-13, -2.6, 0);
    addVertexColor(spikeBFCloned, 0x0c260c);
    const hingeBFCloned = ensureNonIndexed(hingeGeo);
    addVertexColor(hingeBFCloned, 0x0c260c);
    const clawBFGeos = [shieldBFCloned, spikeBFCloned, hingeBFCloned];
    const mergedClawBFGeo = mergeGeometries(clawBFGeos);
    const clawBFMesh = new THREE.Mesh(mergedClawBFGeo, structuralMat);

    this._clawBF.add(clawBFMesh);
    visuals.add(this._clawBF);

    clawBFGeos.forEach(g => g.dispose());

    // Claw 4: Bottom-Back (BB) - Pivot Group centered at hinge joint (2, -11, 0)
    this._clawBB = new THREE.Group();
    this._clawBB.position.set(2, -11, 0);

    const shieldBBCloned = ensureNonIndexed(shieldGeo);
    shieldBBCloned.rotateZ(0.2);
    shieldBBCloned.translate(6, -4, 0);
    addVertexColor(shieldBBCloned, 0x2ebd2e);

    const spikeBBCloned = ensureNonIndexed(spikeGeo);
    spikeBBCloned.rotateZ(0.5);
    spikeBBCloned.translate(13, -2.6, 0);
    addVertexColor(spikeBBCloned, 0x0c260c);
    const hingeBBCloned = ensureNonIndexed(hingeGeo);
    addVertexColor(hingeBBCloned, 0x0c260c);
    const clawBBGeos = [shieldBBCloned, spikeBBCloned, hingeBBCloned];
    const mergedClawBBGeo = mergeGeometries(clawBBGeos);
    const clawBBMesh = new THREE.Mesh(mergedClawBBGeo, structuralMat);

    this._clawBB.add(clawBBMesh);
    visuals.add(this._clawBB);

    clawBBGeos.forEach(g => g.dispose());
    shieldGeo.dispose();
    spikeGeo.dispose();
    hingeGeo.dispose();

    // ── 4. DUAL THRUST-VECTORING THRUSTERS (2x Scaled) ───────────────────────
    const nozzleGeo = new THREE.CylinderGeometry(3.2, 2.0, 7.0, 12);
    nozzleGeo.rotateZ(Math.PI / 2);

    const flameGeo = new THREE.ConeGeometry(2.4, 12.0, 12);
    flameGeo.rotateZ(-Math.PI / 2);

    // Top-Rear Thruster Mount (Socket centered at x=9.0, y=7.0)
    this._nozzleTGroup = new THREE.Group();
    this._nozzleTGroup.position.set(9.0, 7.0, 0);
    const nozzleT = new THREE.Mesh(nozzleGeo, engineMetalMat);
    nozzleT.position.set(3.0, 0, 0);
    const flameT = new THREE.Mesh(flameGeo, flameMat);
    flameT.position.set(10.0, 0, 0);
    this._nozzleTGroup.add(nozzleT);
    this._nozzleTGroup.add(flameT);
    this._flameT = flameT;
    visuals.add(this._nozzleTGroup);

    // Bottom-Rear Thruster Mount (Socket centered at x=9.0, y=-7.0)
    this._nozzleBGroup = new THREE.Group();
    this._nozzleBGroup.position.set(9.0, -7.0, 0);
    const nozzleB = new THREE.Mesh(nozzleGeo, engineMetalMat);
    nozzleB.position.set(3.0, 0, 0);
    const flameB = new THREE.Mesh(flameGeo, flameMat);
    flameB.position.set(10.0, 0, 0);
    this._nozzleBGroup.add(nozzleB);
    this._nozzleBGroup.add(flameB);
    this._flameB = flameB;
    visuals.add(this._nozzleBGroup);

    return group;
  }
}
