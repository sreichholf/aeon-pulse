import * as THREE from 'three';
import { ProjectileSourceKey, type GetPositionFn, type IBullet, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed } from '../utils/ProceduralToolkit.ts';
import { DEFAULT_FLASH_MATERIAL } from '../systems/StandardEnemyModel.ts';


const SLIDE_SPEED  = 80;
const CHARGE_SPEED = 320;
const CLING_TIME   = 1.5;
const BURST_COUNT  = 5;
const BURST_SPREAD = Math.PI / 12;

const Phase = { SLIDE: 0, CLING: 1, BURST: 2, CHARGE: 3 } as const;
type PhaseValue = typeof Phase[keyof typeof Phase];

export class RockDrake extends Enemy {
  private static _cachedGeometries: {
    head: THREE.BufferGeometry;
    eyes: THREE.BufferGeometry;
    headFlash: THREE.BufferGeometry;
    chestRock: THREE.BufferGeometry;
    chestClaw: THREE.BufferGeometry;
    chestPlate: THREE.BufferGeometry;
    chestFlash: THREE.BufferGeometry;
    mid: THREE.BufferGeometry;
    midPlate: THREE.BufferGeometry;
    midSpine: THREE.BufferGeometry;
    midFlash: THREE.BufferGeometry;
    rearRock: THREE.BufferGeometry;
    rearClaw: THREE.BufferGeometry;
    rearPlate: THREE.BufferGeometry;
    rearFlash: THREE.BufferGeometry;
    tail: THREE.BufferGeometry;
    joint1: THREE.BufferGeometry;
    joint2: THREE.BufferGeometry;
    joint3: THREE.BufferGeometry;
    joint4: THREE.BufferGeometry;
  } | null = null;

  private static _cachedMaterials: {
    rock: THREE.MeshPhongMaterial;
    armor: THREE.MeshPhongMaterial;
    jointTemplate: THREE.MeshPhongMaterial;
    claw: THREE.MeshPhongMaterial;
    eye: THREE.MeshBasicMaterial;
  } | null = null;

  static initSharedResources(): void {
    if (RockDrake._cachedGeometries) return;

    // 1. Materials
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

    const jointTemplate = new THREE.MeshPhongMaterial({
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

    RockDrake._cachedMaterials = {
      rock: rockMat,
      armor: armorMat,
      jointTemplate,
      claw: clawMat,
      eye: eyeMat,
    };

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

    // 2. Geometries
    // Head Segment (Segment 0)
    const headGeo = new THREE.CylinderGeometry(2, 7, 10, 5);
    const headCloned = ensureNonIndexed(headGeo);
    headCloned.rotateZ(Math.PI / 2); // align horizontally pointing left
    headGeo.dispose();

    // Eyes on head (symmetrical left and right in Z)
    const eyeGeo = new THREE.SphereGeometry(1.6, 8, 8);
    const eyeRCloned = ensureNonIndexed(eyeGeo);
    eyeRCloned.translate(-3, 2, 4.5);
    const eyeLCloned = ensureNonIndexed(eyeGeo);
    eyeLCloned.translate(-3, 2, -4.5);

    const eyeGeos = [eyeRCloned, eyeLCloned];
    const mergedEyeGeo = mergeGeometries(eyeGeos);
    if (!mergedEyeGeo) throw new Error('RockDrake: failed to merge head eye geometry');
    mergedEyeGeo.computeVertexNormals();
    mergedEyeGeo.computeBoundingBox();
    mergedEyeGeo.computeBoundingSphere();
    eyeGeos.forEach(g => g.dispose());
    eyeGeo.dispose();

    // Head Flash Geometry
    const headFlashGeos = [headCloned.clone(), mergedEyeGeo.clone()];
    const headFlashGeo = mergeGeometries(headFlashGeos);
    if (!headFlashGeo) throw new Error('RockDrake: failed to merge head flash geometry');
    headFlashGeo.computeVertexNormals();
    headFlashGeos.forEach(g => g.dispose());

    // Chest Segment (Segment 1)
    const chestGeo = new THREE.SphereGeometry(9.5, 5, 4);
    const chestCloned = ensureNonIndexed(chestGeo);
    chestGeo.dispose();

    // Get splayed leg geometries
    const frontLegRGeos = getLegGeos(0, 2, 7.5, 1);
    const frontLegLGeos = getLegGeos(0, 2, -7.5, -1);

    const chestRockGeos = [
      chestCloned,
      ...frontLegRGeos.rockGeos,
      ...frontLegLGeos.rockGeos
    ];
    const mergedChestRockGeo = mergeGeometries(chestRockGeos);
    if (!mergedChestRockGeo) throw new Error('RockDrake: failed to merge chest rock geometry');
    mergedChestRockGeo.computeVertexNormals();
    chestRockGeos.forEach(g => g.dispose());

    // Dorsal Spine Spikes + Stone Claws
    const spineGeo = new THREE.ConeGeometry(2, 6, 4);
    const spine1aCloned = ensureNonIndexed(spineGeo);
    spine1aCloned.translate(-2, 9, 3.5);
    const spine1bCloned = ensureNonIndexed(spineGeo);
    spine1bCloned.translate(-2, 9, -3.5);
    spineGeo.dispose();

    const chestClawGeos = [
      spine1aCloned,
      spine1bCloned,
      ...frontLegRGeos.clawGeos,
      ...frontLegLGeos.clawGeos
    ];
    const mergedChestClawGeo = mergeGeometries(chestClawGeos);
    if (!mergedChestClawGeo) throw new Error('RockDrake: failed to merge chest claw geometry');
    mergedChestClawGeo.computeVertexNormals();
    chestClawGeos.forEach(g => g.dispose());

    const chestPlateGeo = ensureNonIndexed(new THREE.BoxGeometry(10, 3.5, 18));

    // Chest Flash Geometry
    const chestFlashGeos = [mergedChestRockGeo.clone(), mergedChestClawGeo.clone(), chestPlateGeo.clone()];
    const chestFlashGeo = mergeGeometries(chestFlashGeos);
    if (!chestFlashGeo) throw new Error('RockDrake: failed to merge chest flash geometry');
    chestFlashGeo.computeVertexNormals();
    chestFlashGeos.forEach(g => g.dispose());

    // Mid-Body Segment (Segment 2)
    const midGeo = ensureNonIndexed(new THREE.SphereGeometry(8.0, 5, 4));
    const midPlateGeo = ensureNonIndexed(new THREE.BoxGeometry(9, 3, 15));

    // Dorsal Spine Spikes
    const spineGeo2 = new THREE.ConeGeometry(2, 6, 4);
    const spine2aCloned = ensureNonIndexed(spineGeo2);
    spine2aCloned.translate(-1, 7.5, 2.5);
    const spine2bCloned = ensureNonIndexed(spineGeo2);
    spine2bCloned.translate(-1, 7.5, -2.5);
    spineGeo2.dispose();

    const midSpineGeos = [spine2aCloned, spine2bCloned];
    const mergedMidSpineGeo = mergeGeometries(midSpineGeos);
    if (!mergedMidSpineGeo) throw new Error('RockDrake: failed to merge mid spine geometry');
    mergedMidSpineGeo.computeVertexNormals();
    midSpineGeos.forEach(g => g.dispose());

    // Mid Flash Geometry
    const midFlashGeos = [midGeo.clone(), midPlateGeo.clone(), mergedMidSpineGeo.clone()];
    const midFlashGeo = mergeGeometries(midFlashGeos);
    if (!midFlashGeo) throw new Error('RockDrake: failed to merge mid flash geometry');
    midFlashGeo.computeVertexNormals();
    midFlashGeos.forEach(g => g.dispose());

    // Rear Segment (Segment 3)
    const rearGeo = new THREE.SphereGeometry(6.5, 5, 4);
    const rearCloned = ensureNonIndexed(rearGeo);
    rearGeo.dispose();

    // Get rear leg geometries
    const rearLegRGeos = getLegGeos(0, 1.5, 5.5, 1);
    const rearLegLGeos = getLegGeos(0, 1.5, -5.5, -1);

    const rearRockGeos = [
      rearCloned,
      ...rearLegRGeos.rockGeos,
      ...rearLegLGeos.rockGeos
    ];
    const mergedRearRockGeo = mergeGeometries(rearRockGeos);
    if (!mergedRearRockGeo) throw new Error('RockDrake: failed to merge rear rock geometry');
    mergedRearRockGeo.computeVertexNormals();
    rearRockGeos.forEach(g => g.dispose());

    // Dorsal Spine Spikes + Leg Claws
    const spineGeo3 = new THREE.ConeGeometry(2, 6, 4);
    const spine3aCloned = ensureNonIndexed(spineGeo3);
    spine3aCloned.translate(0, 6.0, 2.0);
    const spine3bCloned = ensureNonIndexed(spineGeo3);
    spine3bCloned.translate(0, 6.0, -2.0);
    spineGeo3.dispose();

    const rearClawGeos = [
      spine3aCloned,
      spine3bCloned,
      ...rearLegRGeos.clawGeos,
      ...rearLegLGeos.clawGeos
    ];
    const mergedRearClawGeo = mergeGeometries(rearClawGeos);
    if (!mergedRearClawGeo) throw new Error('RockDrake: failed to merge rear claw geometry');
    mergedRearClawGeo.computeVertexNormals();
    rearClawGeos.forEach(g => g.dispose());

    const rearPlateGeo = ensureNonIndexed(new THREE.BoxGeometry(8, 2.5, 12));

    // Rear Flash Geometry
    const rearFlashGeos = [mergedRearRockGeo.clone(), mergedRearClawGeo.clone(), rearPlateGeo.clone()];
    const rearFlashGeo = mergeGeometries(rearFlashGeos);
    if (!rearFlashGeo) throw new Error('RockDrake: failed to merge rear flash geometry');
    rearFlashGeo.computeVertexNormals();
    rearFlashGeos.forEach(g => g.dispose());

    // Tail Segment (Segment 4)
    const tailGeo = ensureNonIndexed(new THREE.ConeGeometry(3.5, 14, 5));
    tailGeo.rotateZ(-Math.PI / 2); // point to the right (+X)
    tailGeo.translate(2, 0, 0);

    // Joint geometries
    const joint1Geo = ensureNonIndexed(new THREE.SphereGeometry(4.8, 8, 8));
    const joint2Geo = ensureNonIndexed(new THREE.SphereGeometry(6.8, 8, 8));
    const joint3Geo = ensureNonIndexed(new THREE.SphereGeometry(5.8, 8, 8));
    const joint4Geo = ensureNonIndexed(new THREE.SphereGeometry(4.5, 8, 8));

    RockDrake._cachedGeometries = {
      head: headCloned,
      eyes: mergedEyeGeo,
      headFlash: headFlashGeo,
      chestRock: mergedChestRockGeo,
      chestClaw: mergedChestClawGeo,
      chestPlate: chestPlateGeo,
      chestFlash: chestFlashGeo,
      mid: midGeo,
      midPlate: midPlateGeo,
      midSpine: mergedMidSpineGeo,
      midFlash: midFlashGeo,
      rearRock: mergedRearRockGeo,
      rearClaw: mergedRearClawGeo,
      rearPlate: rearPlateGeo,
      rearFlash: rearFlashGeo,
      tail: tailGeo,
      joint1: joint1Geo,
      joint2: joint2Geo,
      joint3: joint3Geo,
      joint4: joint4Geo,
    };
  }

  private _onTop: boolean;
  private _segmentMeshes: THREE.Group[];
  private _jointMeshes: THREE.Mesh[];
  private _time: number;
  private _jointMat: THREE.MeshPhongMaterial | null;
  private _stopX: number;
  private _phase: PhaseValue;
  private _clingTimer: number;
  private _burst: boolean;
  private _overlays: THREE.Mesh[] = [];

  constructor(scene: IScene, sprites: Record<string, THREE.Texture>, x: number, y: number, getPlayerPos: GetPositionFn, projectileFactory: ProjectileFactoryFn) {
    super(scene, sprites, null, 0, 0, 28, 20, x, y, projectileFactory);
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

    // Make sure static resources are initialized
    RockDrake.initSharedResources();
    const mats = RockDrake._cachedMaterials!;

    // Clone mutating joint material per-instance
    this._jointMat = mats.jointTemplate.clone();

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

    const geos = RockDrake._cachedGeometries!;
    const mats = RockDrake._cachedMaterials!;

    this._overlays = [];

    // Segment 0: Head
    const headGroup = new THREE.Group();
    headGroup.position.set(-20, 0, 0);

    const headMesh = new THREE.Mesh(geos.head, mats.rock);
    headGroup.add(headMesh);

    const eyesMesh = new THREE.Mesh(geos.eyes, mats.eye);
    headGroup.add(eyesMesh);

    const headOverlay = new THREE.Mesh(geos.headFlash, DEFAULT_FLASH_MATERIAL);
    headOverlay.visible = false;
    headOverlay.renderOrder = 20;
    headGroup.add(headOverlay);
    this._overlays.push(headOverlay);

    group.add(headGroup);
    this._segmentMeshes.push(headGroup);

    // Segment 1: Chest
    const chestGroup = new THREE.Group();
    chestGroup.position.set(-10, 0, 0);

    const chestRockMesh = new THREE.Mesh(geos.chestRock, mats.rock);
    chestGroup.add(chestRockMesh);

    const chestClawMesh = new THREE.Mesh(geos.chestClaw, mats.claw);
    chestGroup.add(chestClawMesh);

    const chestPlate = new THREE.Mesh(geos.chestPlate, mats.armor);
    chestPlate.position.set(0, 7.5, 0);
    chestGroup.add(chestPlate);

    const chestOverlay = new THREE.Mesh(geos.chestFlash, DEFAULT_FLASH_MATERIAL);
    chestOverlay.visible = false;
    chestOverlay.renderOrder = 20;
    chestGroup.add(chestOverlay);
    this._overlays.push(chestOverlay);

    group.add(chestGroup);
    this._segmentMeshes.push(chestGroup);

    // Segment 2: Mid-Body
    const midGroup = new THREE.Group();
    midGroup.position.set(0, 0, 0);

    const midMesh = new THREE.Mesh(geos.mid, mats.rock);
    midGroup.add(midMesh);

    const midPlate = new THREE.Mesh(geos.midPlate, mats.armor);
    midPlate.position.set(0, 6.2, 0);
    midGroup.add(midPlate);

    const midSpineMesh = new THREE.Mesh(geos.midSpine, mats.claw);
    midGroup.add(midSpineMesh);

    const midOverlay = new THREE.Mesh(geos.midFlash, DEFAULT_FLASH_MATERIAL);
    midOverlay.visible = false;
    midOverlay.renderOrder = 20;
    midGroup.add(midOverlay);
    this._overlays.push(midOverlay);

    group.add(midGroup);
    this._segmentMeshes.push(midGroup);

    // Segment 3: Rear
    const rearGroup = new THREE.Group();
    rearGroup.position.set(10, 0, 0);

    const rearRockMesh = new THREE.Mesh(geos.rearRock, mats.rock);
    rearGroup.add(rearRockMesh);

    const rearClawMesh = new THREE.Mesh(geos.rearClaw, mats.claw);
    rearGroup.add(rearClawMesh);

    const rearPlate = new THREE.Mesh(geos.rearPlate, mats.armor);
    rearPlate.position.set(0, 5.0, 0);
    rearGroup.add(rearPlate);

    const rearOverlay = new THREE.Mesh(geos.rearFlash, DEFAULT_FLASH_MATERIAL);
    rearOverlay.visible = false;
    rearOverlay.renderOrder = 20;
    rearGroup.add(rearOverlay);
    this._overlays.push(rearOverlay);

    group.add(rearGroup);
    this._segmentMeshes.push(rearGroup);

    // Segment 4: Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(20, 0, 0);

    const tailMesh = new THREE.Mesh(geos.tail, mats.rock);
    tailGroup.add(tailMesh);

    const tailOverlay = new THREE.Mesh(geos.tail, DEFAULT_FLASH_MATERIAL);
    tailOverlay.visible = false;
    tailOverlay.renderOrder = 20;
    tailGroup.add(tailOverlay);
    this._overlays.push(tailOverlay);

    group.add(tailGroup);
    this._segmentMeshes.push(tailGroup);

    // 3. Glowing Lava Joint connectors Sandwich
    const createJoint = (jointX: number, geom: THREE.BufferGeometry) => {
      const joint = new THREE.Mesh(geom, this._jointMat!);
      joint.position.set(jointX, 0, 0);
      group.add(joint);
      this._jointMeshes.push(joint);

      const jointOverlay = new THREE.Mesh(geom, DEFAULT_FLASH_MATERIAL);
      jointOverlay.visible = false;
      jointOverlay.renderOrder = 20;
      joint.add(jointOverlay);
      this._overlays.push(jointOverlay);
    };
    createJoint(-15, geos.joint1); // Head to Chest
    createJoint(-5,  geos.joint2); // Chest to Mid
    createJoint(5,   geos.joint3); // Mid to Rear
    createJoint(15,  geos.joint4); // Rear to Tail

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
        this._projectileFactory({
          type: ProjectileSourceKey.LAVA,
          x: this.x,
          y: this.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        })
      );
    }
    this._phase = Phase.CHARGE;
  }

  private _chargeUpdate(dt: number): void {
    if (!this._mesh) return;
    this._mesh.position.x -= CHARGE_SPEED * dt;
  }

  override _flash(): void {
    for (const overlay of this._overlays) {
      overlay.visible = true;
    }
    this._hitFlashTimer = 0.08;
  }

  override _restoreFlash(): void {
    for (const overlay of this._overlays) {
      overlay.visible = false;
    }
  }

  override destroy(): void {
    if (this._mesh) {
      this._scene.remove(this._mesh);
      this._mesh = null;
    }

    if (this._jointMat) {
      this._jointMat.dispose();
      this._jointMat = null;
    }

    this._segmentMeshes = [];
    this._jointMeshes = [];
    this._overlays = [];
  }
}
