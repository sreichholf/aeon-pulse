import * as THREE from 'three';
import { BulletType, type GetPositionFn, type IBullet, type IScene } from '../types.ts';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { Bullet } from './Bullet.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function ensureNonIndexed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return geo.index ? geo.toNonIndexed() : geo.clone();
}

const SLIDE_SPEED  = 80;
const CHARGE_SPEED = 320;
const CLING_TIME   = 1.5;
const BURST_COUNT  = 5;
const BURST_SPREAD = Math.PI / 12;

const Phase = { SLIDE: 0, CLING: 1, BURST: 2, CHARGE: 3 } as const;
type PhaseValue = typeof Phase[keyof typeof Phase];

export class RockDrake extends Enemy {
  private _onTop: boolean;
  private _segmentMeshes: THREE.Group[];
  private _jointMeshes: THREE.Mesh[];
  private _time: number;
  private _jointMat: THREE.MeshPhongMaterial | null;
  private _stopX: number;
  private _phase: PhaseValue;
  private _clingTimer: number;
  private _burst: boolean;

  constructor(scene: IScene, sprites: Record<string, THREE.Texture>, x: number, y: number, getPlayerPos: GetPositionFn) {
    super(scene, sprites, null, 0, 0, 28, 20, x, y);
    this._hp             = 4;
    this.score           = 400;
    this._dropChance     = 0.06;
    this._hitCooldownDur = 0.08;
    this._getPlayerPos   = getPlayerPos;

    this._onTop = y > 0;

    this._segmentMeshes = [];
    this._jointMeshes   = [];
    this._time          = 0;
    this._jointMat      = null;

    this._displayName = 'Rock Drake';
    this._mesh = this._build3DModel();
    if (!this._onTop) this._mesh.scale.y = -1;
    this._scene.add(this._mesh);

    this._stopX      = 150 + Math.random() * 200;
    this._phase      = Phase.SLIDE;
    this._clingTimer = 0;
    this._burst      = false;
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this.x, this.y, 0);

    const rockMat = new THREE.MeshPhongMaterial({
      color: 0x7a6a5f, // Warm basalt brown-grey (brightened for visibility)
      emissive: 0x381f12, // Warm volcanic ambient glow
      specular: 0x54473e, // Stony specular highlight
      shininess: 35, // Rough volcanic stone
    });

    const armorMat = new THREE.MeshPhongMaterial({
      color: 0x948375, // Lighter volcanic crust/slate (brightened)
      emissive: 0x3c2311, // Warmer ambient glow
      specular: 0x6a5d52,
      shininess: 25,
    });

    this._jointMat = new THREE.MeshPhongMaterial({
      color: 0xff3300, // Molten orange
      emissive: 0xff3300,
      shininess: 10,
    });

    const clawMat = new THREE.MeshPhongMaterial({
      color: 0xab9c90, // Distinct stone claw color (brightened to stand out)
      emissive: 0x321a0f,
      specular: 0x5c4f46,
      shininess: 30,
    });

    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00, // Glowing amber eyes
    });

    // Helper to build splayed transformed leg geometries relative to the segment group origin
    const getLegGeos = (legX: number, legY: number, legZ: number, signZ: number) => {
      // Thigh: angles outwards and upwards
      const thighGeo = new THREE.CylinderGeometry(2.5, 1.8, 9, 4);
      const thighCloned = ensureNonIndexed(thighGeo);
      thighCloned.rotateX(signZ * Math.PI / 6); // thigh splayed out in Z
      thighCloned.rotateZ(-Math.PI / 12); // slightly angled forward
      thighCloned.translate(0, 3.5, signZ * 2.0);
      thighCloned.translate(legX, legY, legZ); // transform to segment space
      thighGeo.dispose();

      // Shin: angles further outwards/upwards
      const shinGeo = new THREE.CylinderGeometry(1.8, 1.2, 8, 4);
      const shinCloned = ensureNonIndexed(shinGeo);
      shinCloned.rotateX(signZ * Math.PI / 3); // shin angled more heavily in Z
      shinCloned.translate(0, 9.0, signZ * 5.0);
      shinCloned.translate(legX, legY, legZ);
      shinGeo.dispose();

      // Splayed stone claws
      const clawGeo = new THREE.ConeGeometry(1.2, 5, 4);

      const claw1Cloned = ensureNonIndexed(clawGeo);
      claw1Cloned.rotateX(signZ * Math.PI / 2.2); // angled towards terrain surface
      claw1Cloned.translate(-1.8, 12.0, signZ * 7.5);
      claw1Cloned.translate(legX, legY, legZ);

      const claw2Cloned = ensureNonIndexed(clawGeo);
      claw2Cloned.rotateX(signZ * Math.PI / 2.2);
      claw2Cloned.translate(1.8, 12.0, signZ * 7.5);
      claw2Cloned.translate(legX, legY, legZ);

      clawGeo.dispose();

      return {
        rockGeos: [thighCloned, shinCloned],
        clawGeos: [claw1Cloned, claw2Cloned]
      };
    };

    // 2. Segmented Basalt Body Parts (tapered, faceted with low-poly segments)
    // Head Segment (Segment 0)
    const headGroup = new THREE.Group();
    headGroup.position.set(-20, 0, 0);
    const headGeo = new THREE.CylinderGeometry(2, 7, 10, 5);
    const headCloned = ensureNonIndexed(headGeo);
    headCloned.rotateZ(Math.PI / 2); // align horizontally pointing left
    const headMesh = new THREE.Mesh(headCloned, rockMat);
    headGroup.add(headMesh);

    // Eyes on head (symmetrical left and right in Z)
    const eyeGeo = new THREE.SphereGeometry(1.6, 8, 8);
    const eyeRCloned = ensureNonIndexed(eyeGeo);
    eyeRCloned.translate(-3, 2, 4.5);
    const eyeLCloned = ensureNonIndexed(eyeGeo);
    eyeLCloned.translate(-3, 2, -4.5);

    const eyeGeos = [eyeRCloned, eyeLCloned];
    const mergedEyeGeo = mergeGeometries(eyeGeos);
    const eyesMesh = new THREE.Mesh(mergedEyeGeo, eyeMat);
    headGroup.add(eyesMesh);
    group.add(headGroup);
    this._segmentMeshes.push(headGroup);

    // Clean up Head geometries
    eyeGeos.forEach(g => g.dispose());
    headCloned.dispose();
    headGeo.dispose();
    eyeGeo.dispose();

    // Chest Segment (Segment 1)
    const chestGroup = new THREE.Group();
    chestGroup.position.set(-10, 0, 0);
    const chestGeo = new THREE.SphereGeometry(9.5, 5, 4);
    const chestCloned = ensureNonIndexed(chestGeo);

    // Get splayed leg geometries
    const frontLegRGeos = getLegGeos(0, 2, 7.5, 1);
    const frontLegLGeos = getLegGeos(0, 2, -7.5, -1);

    const chestRockGeos = [
      chestCloned,
      ...frontLegRGeos.rockGeos,
      ...frontLegLGeos.rockGeos
    ];
    const mergedChestRockGeo = mergeGeometries(chestRockGeos);
    const chestRockMesh = new THREE.Mesh(mergedChestRockGeo, rockMat);
    chestGroup.add(chestRockMesh);

    // Dorsal Spine Spikes + Stone Claws
    const spineGeo = new THREE.ConeGeometry(2, 6, 4);
    const spine1aCloned = ensureNonIndexed(spineGeo);
    spine1aCloned.translate(-2, 9, 3.5);
    const spine1bCloned = ensureNonIndexed(spineGeo);
    spine1bCloned.translate(-2, 9, -3.5);

    const chestClawGeos = [
      spine1aCloned,
      spine1bCloned,
      ...frontLegRGeos.clawGeos,
      ...frontLegLGeos.clawGeos
    ];
    const mergedChestClawGeo = mergeGeometries(chestClawGeos);
    const chestClawMesh = new THREE.Mesh(mergedChestClawGeo, clawMat);
    chestGroup.add(chestClawMesh);

    // Overlapping Segmented Armor
    const chestPlateGeo = new THREE.BoxGeometry(10, 3.5, 18);
    const chestPlate = new THREE.Mesh(chestPlateGeo, armorMat);
    chestPlate.position.set(0, 7.5, 0);
    chestGroup.add(chestPlate);

    group.add(chestGroup);
    this._segmentMeshes.push(chestGroup);

    // Clean up Chest geometries
    chestRockGeos.forEach(g => g.dispose());
    chestClawGeos.forEach(g => g.dispose());
    chestGeo.dispose();
    spineGeo.dispose();

    // Mid-Body Segment (Segment 2)
    const midGroup = new THREE.Group();
    midGroup.position.set(0, 0, 0);
    const midGeo = new THREE.SphereGeometry(8.0, 5, 4);
    const midMesh = new THREE.Mesh(midGeo, rockMat);
    midGroup.add(midMesh);

    // Overlapping Segmented Armor
    const midPlateGeo = new THREE.BoxGeometry(9, 3, 15);
    const midPlate = new THREE.Mesh(midPlateGeo, armorMat);
    midPlate.position.set(0, 6.2, 0);
    midGroup.add(midPlate);

    // Dorsal Spine Spikes
    const spineGeo2 = new THREE.ConeGeometry(2, 6, 4);
    const spine2aCloned = ensureNonIndexed(spineGeo2);
    spine2aCloned.translate(-1, 7.5, 2.5);
    const spine2bCloned = ensureNonIndexed(spineGeo2);
    spine2bCloned.translate(-1, 7.5, -2.5);

    const midSpineGeos = [spine2aCloned, spine2bCloned];
    const mergedMidSpineGeo = mergeGeometries(midSpineGeos);
    const midSpineMesh = new THREE.Mesh(mergedMidSpineGeo, clawMat);
    midGroup.add(midSpineMesh);
    group.add(midGroup);
    this._segmentMeshes.push(midGroup);

    // Clean up Mid geometries
    midSpineGeos.forEach(g => g.dispose());
    spineGeo2.dispose();

    // Rear Segment (Segment 3)
    const rearGroup = new THREE.Group();
    rearGroup.position.set(10, 0, 0);
    const rearGeo = new THREE.SphereGeometry(6.5, 5, 4);
    const rearCloned = ensureNonIndexed(rearGeo);

    // Get rear leg geometries
    const rearLegRGeos = getLegGeos(0, 1.5, 5.5, 1);
    const rearLegLGeos = getLegGeos(0, 1.5, -5.5, -1);

    const rearRockGeos = [
      rearCloned,
      ...rearLegRGeos.rockGeos,
      ...rearLegLGeos.rockGeos
    ];
    const mergedRearRockGeo = mergeGeometries(rearRockGeos);
    const rearRockMesh = new THREE.Mesh(mergedRearRockGeo, rockMat);
    rearGroup.add(rearRockMesh);

    // Dorsal Spine Spikes + Leg Claws
    const spineGeo3 = new THREE.ConeGeometry(2, 6, 4);
    const spine3aCloned = ensureNonIndexed(spineGeo3);
    spine3aCloned.translate(0, 6.0, 2.0);
    const spine3bCloned = ensureNonIndexed(spineGeo3);
    spine3bCloned.translate(0, 6.0, -2.0);

    const rearClawGeos = [
      spine3aCloned,
      spine3bCloned,
      ...rearLegRGeos.clawGeos,
      ...rearLegLGeos.clawGeos
    ];
    const mergedRearClawGeo = mergeGeometries(rearClawGeos);
    const rearClawMesh = new THREE.Mesh(mergedRearClawGeo, clawMat);
    rearGroup.add(rearClawMesh);

    // Overlapping Segmented Armor
    const rearPlateGeo = new THREE.BoxGeometry(8, 2.5, 12);
    const rearPlate = new THREE.Mesh(rearPlateGeo, armorMat);
    rearPlate.position.set(0, 5.0, 0);
    rearGroup.add(rearPlate);

    group.add(rearGroup);
    this._segmentMeshes.push(rearGroup);

    // Clean up Rear geometries
    rearRockGeos.forEach(g => g.dispose());
    rearClawGeos.forEach(g => g.dispose());
    rearGeo.dispose();
    spineGeo3.dispose();

    // Tail Segment (Segment 4)
    const tailGroup = new THREE.Group();
    tailGroup.position.set(20, 0, 0);
    const tailGeo = new THREE.ConeGeometry(3.5, 14, 5);
    tailGeo.rotateZ(-Math.PI / 2); // point to the right (+X)
    const tailMesh = new THREE.Mesh(tailGeo, rockMat);
    tailMesh.position.set(2, 0, 0);
    tailGroup.add(tailMesh);
    group.add(tailGroup);
    this._segmentMeshes.push(tailGroup);

    // 3. Glowing Lava Joint connectors sandwiched in gaps
    const createJoint = (jointX: number, radius: number) => {
      const jointGeo = new THREE.SphereGeometry(radius, 8, 8);
      const joint = new THREE.Mesh(jointGeo, this._jointMat!);
      joint.position.set(jointX, 0, 0);
      group.add(joint);
      this._jointMeshes.push(joint);
    };
    createJoint(-15, 4.8); // Head to Chest
    createJoint(-5,  6.8); // Chest to Mid
    createJoint(5,   5.8); // Mid to Rear
    createJoint(15,  4.5); // Rear to Tail

    // 4. Clinging legs reaching ceiling/floor (reaches +Y to grip terrain)
    const buildLeg = (legX: number, legY: number, legZ: number, signZ: number): THREE.Group => {
      const legGroup = new THREE.Group();
      legGroup.position.set(legX, legY, legZ);

      // Thigh: angles outwards and upwards
      const thighGeo = new THREE.CylinderGeometry(2.5, 1.8, 9, 4);
      thighGeo.rotateX(signZ * Math.PI / 6); // thigh splayed out in Z
      thighGeo.rotateZ(-Math.PI / 12); // slightly angled forward
      const thigh = new THREE.Mesh(thighGeo, rockMat);
      thigh.position.set(0, 3.5, signZ * 2.0);
      legGroup.add(thigh);

      // Shin: angles further outwards/upwards
      const shinGeo = new THREE.CylinderGeometry(1.8, 1.2, 8, 4);
      shinGeo.rotateX(signZ * Math.PI / 3); // shin angled more heavily in Z
      const shin = new THREE.Mesh(shinGeo, rockMat);
      shin.position.set(0, 9.0, signZ * 5.0);
      legGroup.add(shin);

      // Splayed stone claws
      const clawGeo = new THREE.ConeGeometry(1.2, 5, 4);
      clawGeo.rotateX(signZ * Math.PI / 2.2); // angled towards terrain surface

      const claw1 = new THREE.Mesh(clawGeo, clawMat);
      claw1.position.set(-1.8, 12.0, signZ * 7.5);

      const claw2 = new THREE.Mesh(clawGeo, clawMat);
      claw2.position.set(1.8, 12.0, signZ * 7.5);

      legGroup.add(claw1);
      legGroup.add(claw2);

      return legGroup;
    };

    // Attach 4 legs to appropriate segments so they ripple dynamically with the segment wiggles!
    // Front legs attached to Chest Segment (Segment 1)
    const frontLegR = buildLeg(0, 2, 7.5, 1);
    const frontLegL = buildLeg(0, 2, -7.5, -1);
    chestGroup.add(frontLegR);
    chestGroup.add(frontLegL);

    // Rear legs attached to Rear Segment (Segment 3)
    const rearLegR = buildLeg(0, 1.5, 5.5, 1);
    const rearLegL = buildLeg(0, 1.5, -5.5, -1);
    rearGroup.add(rearLegR);
    rearGroup.add(rearLegL);

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
    return this.x < -HALF_W - 120 || this.x > HALF_W + 200;
  }

  _tick(dt: number): void {
    this._time += dt;

    // 1. Dynamic Crawling Wiggle & Ripple (Slide & Charge phases)
    if (this._phase === Phase.SLIDE || this._phase === Phase.CHARGE) {
      const speed = this._phase === Phase.CHARGE ? 16 : 8;
      const amplitude = this._phase === Phase.CHARGE ? 3.5 : 2.0;

      // Ripple segment positions vertically and tail wiggles in Z
      this._segmentMeshes.forEach((seg, idx) => {
        // Segment Y rippling wave
        seg.position.y = Math.sin(this._time * speed - idx * 1.2) * amplitude;

        // Tail segment (idx = 4) wiggles side to side (Z-axis) for extra lifelike motion
        if (idx === 4) {
          seg.position.z = Math.sin(this._time * speed * 1.5) * (amplitude * 1.5);
        }
      });

      // Also ripple joints to match
      this._jointMeshes.forEach((joint, idx) => {
        joint.position.y = Math.sin(this._time * speed - (idx + 0.5) * 1.2) * amplitude;
      });

      // Keep joint brightness steady during motion
      if (this._jointMat) {
        this._jointMat.emissive.setHex(0xff3300);
      }
    }

    // 2. Volcanic Heartbeat / Thermal Breathing (Cling phase)
    if (this._phase === Phase.CLING) {
      // Return segments to neutral positions smoothly
      this._segmentMeshes.forEach(seg => {
        seg.position.y = THREE.MathUtils.lerp(seg.position.y, 0, 0.1);
        seg.position.z = THREE.MathUtils.lerp(seg.position.z, 0, 0.1);
      });
      this._jointMeshes.forEach(joint => {
        joint.position.y = THREE.MathUtils.lerp(joint.position.y, 0, 0.1);
      });

      // Pulse lava joint brightness rapidly as energy builds up
      if (this._jointMat) {
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(this._time * 10));
        this._jointMat.emissive.setRGB(1.0 * pulse, 0.2 * pulse, 0.0);
      }
    }

    // 3. Flare joints during burst
    if (this._phase === Phase.BURST) {
      if (this._jointMat) {
        this._jointMat.emissive.setHex(0xffffff); // White hot!
      }
    }

    switch (this._phase) {
      case Phase.SLIDE:  this._slideUpdate(dt);  break;
      case Phase.CLING:  this._clingUpdate(dt);  break;
      case Phase.BURST:  this._burstUpdate();    break;
      case Phase.CHARGE: this._chargeUpdate(dt); break;
    }
  }

  private _slideUpdate(dt: number): void {
    if (!this._mesh) return;
    this._mesh.position.x -= SLIDE_SPEED * dt;
    if (this._mesh.position.x <= this._stopX) {
      this._mesh.position.x = this._stopX;
      this._phase      = Phase.CLING;
      this._clingTimer = 0;
    }
  }

  private _clingUpdate(dt: number): void {
    this._clingTimer += dt;
    if (this._clingTimer >= CLING_TIME) this._phase = Phase.BURST;
  }

  private _burstUpdate(): void {
    if (this._burst) return;
    this._burst = true;
    const getPlayerPos = this._getPlayerPos!;
    const tgt       = getPlayerPos();
    const baseAngle = Math.atan2(tgt.y - this.y, tgt.x - this.x);
    for (let i = 0; i < BURST_COUNT; i++) {
      const angle = baseAngle + BURST_SPREAD * (i - (BURST_COUNT - 1) / 2);
      const speed = 160;
      this._newBullets.push(
        new Bullet(this._scene, this._sprites, 'lava', this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed),
      );
    }
    this._phase = Phase.CHARGE;
  }

  private _chargeUpdate(dt: number): void {
    if (!this._mesh) return;
    this._mesh.position.x -= CHARGE_SPEED * dt;
  }
}
