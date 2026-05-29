import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import type { GetPositionFn, IAudio, IScene } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SPEED         = 130;
const FIRE_INTERVAL = 2.5;
const PAUSE_DUR     = 0.30;
const HW = 35, HH = 15;

export class EnemyStraight extends Enemy {
  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _time: number;
  private _kickback: number;
  private _engineScale: number;
  private _visorFlash: number;
  private _visorPulseTime: number;
  private _visorMat: THREE.MeshPhongMaterial | null = null;
  private _visualsGroup: THREE.Group | null = null;
  private _mainFlame: THREE.Mesh | null = null;
  private _topFlame: THREE.Mesh | null = null;
  private _bottomFlame: THREE.Mesh | null = null;

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

    // Animations states
    this._time           = 0;
    this._kickback       = 0;
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

    // 1. Aiming and Pausing logic
    if (this._pausing) {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pausing   = false;
        this._fireTimer = FIRE_INTERVAL;
      }
      // Visor warning flare & engine throttle-down
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 2.5, 8 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 0.20, 10 * dt);
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
    }

    // Move left
    pos.x -= (this._pausing ? SPEED * 0.15 : SPEED) * dt;

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

    // 3. Firing Recoil Kickback Interpolation
    this._kickback = THREE.MathUtils.lerp(this._kickback, 0, 9 * dt);
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
    if (this._topFlame) {
      this._topFlame.scale.set(flameScale, this._engineScale, this._engineScale);
      this._topFlame.visible = flameScale > 0.05;
    }
    if (this._bottomFlame) {
      this._bottomFlame.scale.set(flameScale, this._engineScale, this._engineScale);
      this._bottomFlame.visible = flameScale > 0.05;
    }

    // Subtle idle body wobble in X-axis
    this._mesh!.rotation.x = Math.sin(this._time * 15) * 0.08;
  }

  _shootAtPlayer(): void {
    super._shootAtPlayer();
    this._kickback = 8.0; // Recoil to the right (+X)
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
    const carbonMat = new THREE.MeshPhongMaterial({
      color: 0xdce3f0, // Brilliant pearlescent silver-white for maximum visibility
      emissive: 0x2e3547, // Strong ambient self-illumination to prevent dark shadows
      shininess: 100,
      specular: 0xffffff, // Mirror-like chrome specularity
      flatShading: true,
    });

    const crimsonMat = new THREE.MeshPhongMaterial({
      color: 0xff3b50, // Intense glowing neon red for mid-wing plates
      emissive: 0x660813, // Strong red self-illumination
      shininess: 110,
      specular: 0xff99aa,
      flatShading: true,
    });

    const obsidianMat = new THREE.MeshPhongMaterial({
      color: 0x7a8ca8, // Polished gunmetal steel for the outer wing tip borders
      emissive: 0x1d222e,
      shininess: 130,
      specular: 0xffffff, // Brilliant bright highlights on wing edges
      flatShading: true,
    });

    const visorMat = new THREE.MeshPhongMaterial({
      color: 0xff1a2c,
      emissive: 0xaa0005,
      shininess: 100,
      specular: 0xff8899,
    });
    this._visorMat = visorMat;

    const nozzleMat = new THREE.MeshPhongMaterial({
      color: 0x8293ad, // Brighter metallic nozzle sockets
      shininess: 95,
      specular: 0xffffff,
    });

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00ffd2,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    // --- 1. Faceted Tapering Hexagonal Fuselage (Aerodynamic Stealth Hull) ---
    // Central Main Hull (tapers slightly back)
    const bodyGeo = new THREE.CylinderGeometry(4.0, 5.0, 16, 6);
    bodyGeo.rotateZ(Math.PI / 2); // Lay along the horizontal X-axis

    // Front Nose Cone (tapers aggressively forward)
    const noseGeo = new THREE.CylinderGeometry(0.8, 4.0, 10, 6);
    noseGeo.rotateZ(Math.PI / 2);

    // Rear Engine Fuselage Interface
    const rearGeo = new THREE.CylinderGeometry(5.0, 4.2, 5, 6);
    rearGeo.rotateZ(Math.PI / 2);

    // --- 2. Cockpit Canopy & Tactical Visors ---
    // Faceted Diamond Glass Canopy (mounted on top of the sloped body)
    const canopyGeo = new THREE.CylinderGeometry(1.2, 2.5, 8, 5);
    canopyGeo.rotateZ(Math.PI / 2);

    // Aggressive recessed sensor visor slit on the nose tip
    const sensorGeo = new THREE.BoxGeometry(3, 0.6, 3);

    // --- 3. Forward-Swept Wings (Su-47 Style) & Beveled Armor Fillets ---
    // Tier 1 (Base - Matte Obsidian Carbon-Steel, Forward-Swept Profile)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(10, 0);          // Root rear
    wingShape.lineTo(-6, 22);         // Top tip rear (sweeps aggressively forward)
    wingShape.lineTo(-12, 21);        // Top tip front
    wingShape.lineTo(-2, 0);          // Root front
    wingShape.lineTo(-12, -21);       // Bottom tip front
    wingShape.lineTo(-6, -22);        // Bottom tip rear
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

    // Sloped Armor Fillets (flared structural wing roots bridging wing to hexagonal body)
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

    // --- 4. Recessed Thrust-Vectoring Exhaust Ports (F-22 style Flaps) ---
    // Outer casing shrouds that cover and recess the engines
    const flapTopGeo = new THREE.BoxGeometry(5, 1.2, 11);
    const flapBotGeo = new THREE.BoxGeometry(5, 1.2, 11);
    const panelLeftGeo = new THREE.BoxGeometry(5, 7.5, 1.2);
    const panelRightGeo = new THREE.BoxGeometry(5, 7.5, 1.2);

    // Merge static carbon geometries
    const carbonGeos = [
      bodyGeo.clone().translate(1, 0, 0),
      noseGeo.clone().translate(-12, 0, 0),
      rearGeo.clone().translate(11.5, 0, 0),
      baseWingGeo.clone(),
      filletGeo.clone().translate(2, 0, 0),
      flapTopGeo.clone().translate(14, 4.0, 0),
      flapBotGeo.clone().translate(14, -4.0, 0),
      panelLeftGeo.clone().translate(14, 0, 4.9),
      panelRightGeo.clone().translate(14, 0, -4.9),
    ];
    const mergedCarbonGeo = mergeGeometries(carbonGeos);
    const carbonMesh = new THREE.Mesh(mergedCarbonGeo, carbonMat);
    visuals.add(carbonMesh);

    // Clean up temporary carbon geometries
    carbonGeos.forEach(g => g.dispose());
    bodyGeo.dispose();
    noseGeo.dispose();
    rearGeo.dispose();
    baseWingGeo.dispose();
    filletGeo.dispose();
    flapTopGeo.dispose();
    flapBotGeo.dispose();
    panelLeftGeo.dispose();
    panelRightGeo.dispose();

    // Tier 2 (Mid-Plate - Crimson Titanium, Swept Wing Inserts)
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

    const crimsonGeos = [
      midWingGeo.clone().translate(0, 0, 1.8),
      midWingGeo.clone().translate(0, 0, -1.8),
    ];
    const mergedCrimsonGeo = mergeGeometries(crimsonGeos);
    const crimsonMesh = new THREE.Mesh(mergedCrimsonGeo, crimsonMat);
    visuals.add(crimsonMesh);

    // Clean up temporary crimson geometries
    crimsonGeos.forEach(g => g.dispose());
    midWingGeo.dispose();

    // Tier 3 (Outer - Polished Obsidian Blade Tips)
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

    const obsidianGeos = [
      outerWingGeo.clone().translate(0, 0, 3.2),
      outerWingGeo.clone().translate(0, 0, -3.2),
    ];
    const mergedObsidianGeo = mergeGeometries(obsidianGeos);
    const obsidianMesh = new THREE.Mesh(mergedObsidianGeo, obsidianMat);
    visuals.add(obsidianMesh);

    // Clean up temporary obsidian geometries
    obsidianGeos.forEach(g => g.dispose());
    outerWingGeo.dispose();

    // Merge visor parts (canopy + sensor)
    const canopyGeoCloned = canopyGeo.clone();
    canopyGeoCloned.rotateY(0.1);
    canopyGeoCloned.rotateZ(Math.PI / 2);
    canopyGeoCloned.translate(-5, 3.2, 0);

    const sensorGeoCloned = sensorGeo.clone();
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

    // Recessed thruster nozzles nestled inside the shrouds
    const nozzleCentralGeo = new THREE.CylinderGeometry(2.0, 1.6, 3.5, 12);
    nozzleCentralGeo.rotateZ(Math.PI / 2);
    const nozzleSideGeo = new THREE.CylinderGeometry(1.4, 1.0, 3, 12);
    nozzleSideGeo.rotateZ(Math.PI / 2);

    const nozzleGeos = [
      nozzleCentralGeo.clone().translate(12.5, 0, 0),
      nozzleSideGeo.clone().translate(12.0, 2.5, 1.8),
      nozzleSideGeo.clone().translate(12.0, -2.5, -1.8),
    ];
    const mergedNozzleGeo = mergeGeometries(nozzleGeos);
    const nozzleMesh = new THREE.Mesh(mergedNozzleGeo, nozzleMat);
    visuals.add(nozzleMesh);

    // Clean up temporary nozzle geometries
    nozzleGeos.forEach(g => g.dispose());
    nozzleCentralGeo.dispose();
    nozzleSideGeo.dispose();

    // Supersonic cyan exhaust cones originating from inside the vectoring shroud
    const flameCentralGeo = new THREE.ConeGeometry(1.6, 9, 12);
    flameCentralGeo.rotateZ(-Math.PI / 2);
    const flameSideGeo = new THREE.ConeGeometry(1.0, 7, 12);
    flameSideGeo.rotateZ(-Math.PI / 2);

    const mainFlame = new THREE.Mesh(flameCentralGeo, flameMat);
    mainFlame.position.set(18.0, 0, 0);
    visuals.add(mainFlame);
    this._mainFlame = mainFlame;

    const topFlame = new THREE.Mesh(flameSideGeo, flameMat);
    topFlame.position.set(16.5, 2.5, 1.8);
    visuals.add(topFlame);
    this._topFlame = topFlame;

    const bottomFlame = new THREE.Mesh(flameSideGeo, flameMat);
    bottomFlame.position.set(16.5, -2.5, -1.8);
    visuals.add(bottomFlame);
    this._bottomFlame = bottomFlame;

    visuals.scale.set(1.32, 1.32, 1.32);
    return group;
  }
}
