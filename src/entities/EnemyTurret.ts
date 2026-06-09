import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { Bullet } from './Bullet.ts';
import { BulletType, type GetPositionFn, type IAudio, type IScene } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed, addVertexColor } from '../utils/ProceduralToolkit.ts';


const SPEED         = 120;
const FIRE_INTERVAL = 2.5;
const HW = 18, HH = 18;

// Wider audio interface to allow optional pitch parameter used in this class.
// IAudio only declares play(s: string), so we use a structural supertype locally.
interface ITurretAudio {
  play(soundName: string, pitchScale?: number): void;
}

export class EnemyTurret extends Enemy {
  private _audio: ITurretAudio | null;
  private _time: number;
  private _shotsLeft: number;
  private _shotCooldown: number;
  private _recoil: number;
  private _isCharging: boolean;
  private _lockedAngle: number;
  private _playedChargeSound: boolean;
  private _fireTimer: number;
  private _headGroup: THREE.Group | null = null;
  private _cannonGroup: THREE.Group | null = null;
  private _coils: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial>[] = [];
  private _muzzle: THREE.Mesh | null = null;
  private _muzzleMat: THREE.MeshPhongMaterial | null = null;
  private _ventMat: THREE.MeshPhongMaterial | null = null;
  private _coilMat: THREE.MeshPhongMaterial | null = null;
  private _ringMat: THREE.MeshPhongMaterial | null = null;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn,
    audio: IAudio | null,
  ) {
    super(scene, sprites, null, 0, 0, HW, HH, x, y);
    this._hp           = 3;
    this.score         = 300;
    this._dropChance   = 0.07;
    this._getPlayerPos = getPlayerPos;
    this._audio        = audio as ITurretAudio | null;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);

    this._time         = 0;
    this._shotsLeft    = 0;
    this._shotCooldown = 0;
    this._recoil       = 0;
    this._isCharging   = false;
    this._lockedAngle  = 0;
    this._playedChargeSound = false;

    this._displayName = 'Turret';
    this._mesh = this._build3DModel();
    // Tilt the turret slightly forward/backward in 3D (X axis) to align the
    // massive rotating gear and the laser cannon vertically (top/bottom) on the canvas screen.
    this._mesh.rotation.x = 0.38; // Tilts closer barrel/sleeve to bottom, back to top
    this._mesh.rotation.y = 0.00; // Zero horizontal skew for perfectly stacked appearance
    this._scene.add(this._mesh);
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this.x, this.y, 0);

    // 1. Ultra-shiny premium industrial materials
    const baseMat = new THREE.MeshPhongMaterial({
      color: 0x8e9bb0,      // Polished brushed steel/chrome axle
      emissive: 0x242a36,   // Rich industrial ambient depth
      shininess: 90,
      specular: 0xffffff,   // Bright glossy chrome highlights
    });

    const gearMat = new THREE.MeshPhongMaterial({
      color: 0xff9e59,      // Highly polished bright copper
      emissive: 0x5e2307,   // Deep glowing copper core glow
      shininess: 85,        // Very high glossy metallic sheen
      specular: 0xffffff,   // Pure white specular highlights
    });

    const sleeveMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,      // Vertex-colored barrel and slate casing
      emissive: 0x151b24,   // High-contrast industrial base shadows
      shininess: 75,
      specular: 0xffffff,   // Strong crisp highlights
      vertexColors: true,
    });

    this._ventMat = new THREE.MeshPhongMaterial({
      color: 0xff4400,      // Recessed glowing warning-orange vents
      emissive: 0x440a00,
      shininess: 50,
      specular: 0xff9977,
    });

    this._coilMat = new THREE.MeshPhongMaterial({
      color: 0xff6600,      // Bright glowing copper coils
      emissive: 0x3d0f00,
      shininess: 80,
      specular: 0xffffff,
    });

    this._muzzleMat = new THREE.MeshPhongMaterial({
      color: 0x33e6ff,      // Vibrant neon-cyan railgun muzzle emitter
      emissive: 0x004455,
      shininess: 80,
      specular: 0xffffff,
    });

    this._ringMat = new THREE.MeshPhongMaterial({
      color: 0xff8800,      // Saturated glowing energy containment rings
      emissive: 0x441100,
      shininess: 80,
      specular: 0xffffff,
    });

    // 2. Static Background Mount (Z-axis axle cylinder + dual containment toruses)
    // Sits in negative Z-space, fully lit since we pushed back the database cards
    const axleGeo = new THREE.CylinderGeometry(8, 10, 24, 16);
    axleGeo.rotateX(Math.PI / 2);
    const axle = new THREE.Mesh(axleGeo, baseMat);
    axle.position.set(0, 0, -12); // Extends back from 0 to -24
    group.add(axle);

    const ringGeo = new THREE.TorusGeometry(12.5, 2.0, 10, 24);
    const ringGeos: THREE.BufferGeometry[] = [];

    const ringFrontCloned = ensureNonIndexed(ringGeo);
    ringFrontCloned.rotateY(Math.PI / 2);
    ringFrontCloned.translate(0, 0, -10);
    ringGeos.push(ringFrontCloned);

    const ringRearCloned = ensureNonIndexed(ringGeo);
    ringRearCloned.rotateY(Math.PI / 2);
    ringRearCloned.translate(0, 0, -18);
    ringGeos.push(ringRearCloned);

    const mergedRingGeo = mergeGeometries(ringGeos);
    const ringMesh = new THREE.Mesh(mergedRingGeo, this._ringMat);
    group.add(ringMesh);

    ringGeos.forEach(g => g.dispose());
    ringGeo.dispose();

    // 3. Pivoting Turret Head Group (rotates dynamically around the Z-axis)
    this._headGroup = new THREE.Group();
    this._headGroup.position.set(0, 0, 0);
    group.add(this._headGroup);

    // 3A. Huge Rotating Gear Body (4-Spoke Cross Wheel with bevels and quadrant cutouts)
    const rimShape = new THREE.Shape();
    rimShape.absarc(0, 0, 22, 0, Math.PI * 2, false);
    const rimHole = new THREE.Path();
    rimHole.absarc(0, 0, 16, 0, Math.PI * 2, true);
    rimShape.holes.push(rimHole);

    // Enabled beveling to catch brilliant specular lines on all gear corners
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: 5.0,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.8,
      bevelThickness: 0.8,
    });
    const rimCloned = ensureNonIndexed(rimGeo);
    rimCloned.translate(0, 0, -2.5); // Center on local Z axis

    // Smooth central hub cylinder
    const hubGeo = new THREE.CylinderGeometry(6.5, 6.5, 6.6, 24);
    const hubCloned = ensureNonIndexed(hubGeo);
    hubCloned.rotateX(Math.PI / 2);

    // Cylindrical Spokes connecting hub and rim, acting as heavy rounded tubes that catch metallic specular lines
    const spokeGeoV = new THREE.CylinderGeometry(2.0, 2.0, 32.0, 16);
    const spokeVCloned = ensureNonIndexed(spokeGeoV);

    const spokeGeoH = new THREE.CylinderGeometry(2.0, 2.0, 32.0, 16);
    const spokeHCloned = ensureNonIndexed(spokeGeoH);
    spokeHCloned.rotateZ(Math.PI / 2); // Horizontal spoke tube

    const gearGeos = [rimCloned, hubCloned, spokeVCloned, spokeHCloned];

    // 3B. 16 Cylindrical Sprocket teeth evenly distributed around the gear rim
    // Cylinder bodies have curved profiles that glitter dynamically as the gear rotates
    const toothGeo = new THREE.CylinderGeometry(1.2, 1.2, 3.5, 12);
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const toothCloned = ensureNonIndexed(toothGeo);
      toothCloned.rotateZ(angle);
      toothCloned.rotateZ(Math.PI / 2); // original toothGeo.rotateZ(Math.PI / 2)
      toothCloned.translate(Math.cos(angle) * 23.0, Math.sin(angle) * 23.0, 0);
      gearGeos.push(toothCloned);
    }

    const mergedGearGeo = mergeGeometries(gearGeos);
    const gearMesh = new THREE.Mesh(mergedGearGeo, gearMat);
    this._headGroup.add(gearMesh);

    // Clean up gear geometries
    gearGeos.forEach(g => g.dispose());
    rimGeo.dispose();
    hubGeo.dispose();
    spokeGeoV.dispose();
    spokeGeoH.dispose();
    toothGeo.dispose();

    // 3C. Armored Railgun Sleeve (Sliding Group for recoil feedback)
    // Mounted on the front face of the gear at z = 4.0
    this._cannonGroup = new THREE.Group();
    this._cannonGroup.position.set(0, 0, 4.0);

    // Layer 1: Heavy central steel barrel cylinder (curved profile catches bright horizontal glints)
    const barrelGeo = new THREE.CylinderGeometry(4.5, 4.5, 34.0, 16);
    barrelGeo.rotateZ(Math.PI / 2);
    const recoilGeos: THREE.BufferGeometry[] = [];

    const barrelCloned = ensureNonIndexed(barrelGeo);
    barrelCloned.translate(-10, 0, 0);
    addVertexColor(barrelCloned, 0x8e9bb0);
    recoilGeos.push(barrelCloned);

    // Layer 2: Flanking slate-steel outer plates (top and bottom armor sleeves)
    const plateGeo = new THREE.BoxGeometry(26, 3.0, 10.0);

    const plateTopCloned = ensureNonIndexed(plateGeo);
    plateTopCloned.translate(-10, 4.5, 0);
    addVertexColor(plateTopCloned, 0x60728c);
    recoilGeos.push(plateTopCloned);

    const plateBottomCloned = ensureNonIndexed(plateGeo);
    plateBottomCloned.translate(-10, -4.5, 0);
    addVertexColor(plateBottomCloned, 0x60728c);
    recoilGeos.push(plateBottomCloned);

    const mergedSleeveGeo = mergeGeometries(recoilGeos);
    const sleeveMesh = new THREE.Mesh(mergedSleeveGeo, sleeveMat);
    this._cannonGroup.add(sleeveMesh);

    recoilGeos.forEach(g => g.dispose());
    barrelGeo.dispose();
    plateGeo.dispose();

    // Recessed warning-orange/red heat vents flanking the armor
    const ventGeo = new THREE.BoxGeometry(16, 1.2, 10.2);
    const ventGeos: THREE.BufferGeometry[] = [];

    const ventTopCloned = ensureNonIndexed(ventGeo);
    ventTopCloned.translate(-10, 6.2, 0);
    ventGeos.push(ventTopCloned);

    const ventBottomCloned = ensureNonIndexed(ventGeo);
    ventBottomCloned.translate(-10, -6.2, 0);
    ventGeos.push(ventBottomCloned);

    const mergedVentGeo = mergeGeometries(ventGeos);
    const ventMesh = new THREE.Mesh(mergedVentGeo, this._ventMat);
    this._cannonGroup.add(ventMesh);

    ventGeos.forEach(g => g.dispose());
    ventGeo.dispose();

    // 4 Copper Coils wrapping around the exposed central barrel
    const coilGeo = new THREE.TorusGeometry(5.8, 1.0, 10, 24);
    coilGeo.rotateY(Math.PI / 2);
    this._coils = [];
    for (let i = 0; i < 4; i++) {
      const cMat = this._coilMat!.clone();
      const coil = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial>(coilGeo, cMat);
      coil.position.set(-6 - i * 6, 0, 0);
      this._cannonGroup.add(coil);
      this._coils.push(coil);
    }

    // Octagonal neon-cyan muzzle emitter
    const muzzleGeo = new THREE.CylinderGeometry(2.5, 2.5, 4.0, 8);
    muzzleGeo.rotateZ(Math.PI / 2);
    const muzzle = new THREE.Mesh(muzzleGeo, this._muzzleMat);
    muzzle.position.set(-29, 0, 0);
    this._cannonGroup.add(muzzle);
    this._muzzle = muzzle; // Save emitter tip

    this._headGroup.add(this._cannonGroup);

    // Pre-populate origColor for flash traversal
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (!Array.isArray(mat) && 'color' in mat) {
          child.userData['origColor'] = (mat as THREE.MeshPhongMaterial | THREE.MeshBasicMaterial).color.getHex();
        }
      }
    });

    return group;
  }

  _tick(dt: number): void {
    this._time += dt;

    const pos = this._mesh!.position;
    pos.x -= SPEED * dt;
    this._fireTimer -= dt;

    // 1. Recoil recovery
    this._recoil = THREE.MathUtils.lerp(this._recoil, 0, 10 * dt);
    this._cannonGroup!.position.x = this._recoil;

    // 2. Muzzle tip cool down
    this._muzzleMat!.emissive.lerp(new THREE.Color(0x003333), 8 * dt);

    // 3. Dynamic States: Aiming / Lock / Charging
    if (this._fireTimer < 0.8 && pos.x < HALF_W - 60 && this._shotsLeft === 0) {
      // CHARGING STATE
      if (!this._isCharging) {
        this._isCharging = true;
        this._lockedAngle = this._headGroup!.rotation.z;
      }

      const t = (0.8 - this._fireTimer) / 0.8; // fraction 0..1

      // Charge SFX once per volley
      if (this._audio && !this._playedChargeSound) {
        this._audio.play('turretCharge');
        this._playedChargeSound = true;
      }

      // Energy pulse oscillation: rapid back-and-forth aim shaking
      const shake = 0.04 * Math.sin(this._time * 50);
      this._headGroup!.rotation.z = this._lockedAngle + shake;

      // Sequential chasing copper coils
      const chaseIdx = Math.floor(this._time * 16) % 4;
      for (let i = 0; i < 4; i++) {
        const coil = this._coils[i]!;
        const isChase = (i === chaseIdx);
        const targetEmissive = isChase ? 1.0 : (0.15 + 0.35 * t);
        coil.material.emissive.setHex(0xff5500).multiplyScalar(targetEmissive);
      }

      // Vents pulse rapidly
      const ventPulse = 0.3 + 0.7 * t * Math.abs(Math.sin(this._time * 30));
      this._ventMat!.emissive.setHex(0xff3300).multiplyScalar(ventPulse);

      // Axle containment rings glow brighter
      const ringPulse = 0.3 + 0.7 * t;
      this._ringMat!.emissive.setHex(0xff7700).multiplyScalar(ringPulse);

    } else {
      // NORMAL AIMING / TRACKING STATE
      this._isCharging = false;

      // Smooth player tracking around the local Z-axis
      const { x: px, y: py } = this._getPlayerPos!();
      const targetAngle = Math.atan2(py - this.y, px - this.x);
      const desiredRotation = targetAngle - Math.PI;

      let diff = desiredRotation - this._headGroup!.rotation.z;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this._headGroup!.rotation.z += diff * Math.min(1, 10 * dt);

      // Copper coils default dim glow
      for (let i = 0; i < 4; i++) {
        this._coils[i]!.material.emissive.setHex(0xff5500).multiplyScalar(0.15);
      }

      // Vents default dim glow
      this._ventMat!.emissive.setHex(0xff3300).multiplyScalar(0.15);

      // Axle rings normal glow
      this._ringMat!.emissive.setHex(0xff7700).multiplyScalar(0.2);
    }

    // 4. Trigger Firing Volley
    if (this._fireTimer <= 0 && pos.x < HALF_W - 60 && this._shotsLeft === 0) {
      this._shotsLeft = 3;
      this._shotCooldown = 0;
      this._fireTimer = FIRE_INTERVAL;
      this._playedChargeSound = false;
    }

    // 5. Volley Execution
    if (this._shotsLeft > 0) {
      this._shotCooldown -= dt;
      if (this._shotCooldown <= 0) {
        this._shotsLeft--;
        this._shotCooldown = 0.14;

        // Apply recoil to the single sleeve group
        this._recoil = 6.0;

        // Muzzle flare flash
        this._muzzleMat!.emissive.setHex(0x00ffff).multiplyScalar(3.0);

        // precise world position
        this._mesh!.updateMatrixWorld(true);
        const firePos = new THREE.Vector3();
        this._muzzle!.getWorldPosition(firePos);

        // Volley SFX
        if (this._audio) {
          let pitchScale = 1.0;
          if (this._shotsLeft === 1) pitchScale = 0.9;
          else if (this._shotsLeft === 0) pitchScale = 0.8;
          this._audio.play('turretFire', pitchScale);
        }

        // Fire high-velocity cyan railgun slug
        const aimAngle = this._headGroup!.rotation.z + Math.PI;
        const speed = 360;
        const vx = Math.cos(aimAngle) * speed;
        const vy = Math.sin(aimAngle) * speed;

        this._newBullets.push(
          new Bullet(this._scene, this._sprites, BulletType.BOSS_LASER, firePos.x, firePos.y, vx, vy, null, 0x00ffff)
        );
      }
    }

    pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
  }
}
