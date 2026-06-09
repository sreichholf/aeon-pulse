import * as THREE from 'three';
import { BulletType, DifficultyMode, ProjectileSourceKey, type IBullet, type ProjectileFactoryFn, type TerrainBounds, type Vec2, type IScene } from '../types.ts';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { Action } from '../systems/InputManager.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';
import { Bullet } from './Bullet.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed } from '../utils/ProceduralToolkit.ts';


const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

// Configurable constants for fine-tuning the loaded GLB model alignment and scale
const GLB_SCALE = 1.05; 
const GLB_ROT_X = 0;
const GLB_ROT_Y = -Math.PI / 2; // Facing -Z originally, rotate 90 deg around Y to point nose along +X (to the right)
const GLB_ROT_Z = 0;
const GLB_OFFSET_X = -4; // Shift backward slightly to center engine/canopy weight
const GLB_OFFSET_Y = 0;
const GLB_OFFSET_Z = 0;


const SPEED             = 200;   // px/s
const DISPLAY_W         = 80;
const DISPLAY_H         = 72;
const HITBOX_HW         = 10;    // small hitbox for fairness
const HITBOX_HH         = 8;
const RESPAWN_X         = -HALF_W + 130;
const RESPAWN_Y         = 0;
const INVINCIBLE_TIME   = 2.0;   // seconds
const FLICKER_RATE      = 10;    // Hz
const CHARGE_TIME       = 1.5;   // seconds to full charge
const CHARGE_THRESHOLD  = 0.80;  // fraction needed to trigger charge shot
const RAPID_COOLDOWN    = 0.14;  // seconds between tap shots
const EXIT_FLYOUT_ACCEL = 520;
const EXIT_FLYOUT_MAX_SPEED = 760;

export const WeaponTier = { RAPID: 1, TWIN: 2, SPREAD: 3, WAVE: 4, PLASMA: 5 } as const;
export type WeaponTierValue = typeof WeaponTier[keyof typeof WeaponTier];
type ExitMode = 'none' | 'hold' | 'flyout';

interface PlayerAudio {
  play(soundName: string, ...args: unknown[]): void;
  startChargeHum(): void;
  stopChargeHum(): void;
}

interface InputManager {
  isDown(action: string): boolean;
  wasJustPressed(action: string): boolean;
}

interface ThrusterParticle {
  isYellow: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  decay: number;
}

export class Player {
  get x(): number { return this._mesh.position.x; }
  get y(): number { return this._mesh.position.y; }
  readonly hw: number = HITBOX_HW;
  readonly hh: number = HITBOX_HH;

  weaponTier: WeaponTierValue;
  chargeLevel: number;           // 0–1, exposed for HUD
  terrainBounds: TerrainBounds | null;

  private _scene: IScene;
  private _sprites: unknown;
  private _input: InputManager;
  private _audio: PlayerAudio;
  private _projectileFactory: ProjectileFactoryFn;
  private _debugInvincible: boolean;
  private _mode: DifficultyMode;
  private _shieldMax: number;
  private _shieldPips: number;
  private _shieldRegenDur: number;
  private _shieldRegenTimer: number;
  private _shieldFlickerTimer: number;
  private _fireTimer: number;
  private _prevFireDown: boolean;
  private _fireDownDuration: number;
  private _invTimer: number;
  private _flickerTimer: number;
  private _newBullets: IBullet[];
  private _particles: ThrusterParticle[];
  private _yellowParticleMesh: THREE.InstancedMesh | null;
  private _orangeParticleMesh: THREE.InstancedMesh | null;
  private _instanceHelper: THREE.Object3D;
  private _engineLight: THREE.PointLight | null;
  private _chargeOrb: THREE.Mesh | null;
  private _shieldAura: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial> | null;
  private _mesh: THREE.Group;
  private _exitMode: ExitMode;
  private _exitSpeed: number;

  constructor(
    scene: IScene,
    sprites: unknown,
    input: InputManager,
    audio: PlayerAudio,
    projectileFactory: ProjectileFactoryFn,
    mode?: DifficultyMode,
    debugInvincible = false,
    loadedModel?: THREE.Group | null,
  ) {
    this._scene   = scene;
    this._sprites = sprites;
    this._input   = input;
    this._audio   = audio;
    this._projectileFactory = projectileFactory;
    this._debugInvincible = debugInvincible;

    this.weaponTier      = WeaponTier.RAPID;
    this.chargeLevel     = 0;       // 0–1, exposed for HUD
    this._fireTimer      = 0;
    this._prevFireDown   = false;
    this._fireDownDuration = 0;
    this._invTimer       = 0;
    this._flickerTimer   = 0;
    this._newBullets     = [];
    this._exitMode       = 'none';
    this._exitSpeed      = 300;

    this._mode           = mode ?? DifficultyMode.ACE;
    this._shieldMax      = this._mode === DifficultyMode.ROOKIE ? 2 : this._mode === DifficultyMode.PILOT ? 1 : 0;
    this._shieldPips     = this._shieldMax;
    this._shieldRegenDur = this._mode === DifficultyMode.ROOKIE ? 4.0 : 7.0;
    this._shieldRegenTimer = 0;
    this._shieldFlickerTimer = 0;

    this.terrainBounds = null; // { top, bottom } — set by Game each frame

    // Build the high-fidelity 3D player ship group!
    this._particles = [];
    this._yellowParticleMesh = null;
    this._orangeParticleMesh = null;
    this._instanceHelper = new THREE.Object3D();
    this._engineLight = null;
    this._chargeOrb = null;
    this._shieldAura = null;
    this._mesh = this._build3DPlayerShip(loadedModel);
    markRenderCategory(this._mesh, RenderCategory.PLAYER);
    this._mesh.position.set(RESPAWN_X, RESPAWN_Y, 2);
    scene.add(this._mesh);
  }

  /**
   * Procedurally designs or loads a highly cohesive, aerodynamic 3D aerospace fighter.
   * Utilizes a Lathed central hull, extruded & beveled wings, and organically
   * merged structural prongs to look like a single molded fuselage rather than glued blocks.
   * If a preloaded GLB model is provided, it centers, aligns, and scales it to fit.
   */
  private _build3DPlayerShip(loadedModel?: THREE.Group | null): THREE.Group {
    const group = new THREE.Group();

    // Glossy retro arcade style Phong materials for high visibility and vibrant specularity
    const hullMat = new THREE.MeshPhongMaterial({
      color: 0x224a82, // vibrant dark blue
      shininess: 90,
      specular: 0x5588ff,
    });

    const trimMat = new THREE.MeshPhongMaterial({
      color: 0xff3300, // vivid red accent
      shininess: 80,
      specular: 0xffaaaa,
    });

    const brightMat = new THREE.MeshPhongMaterial({
      color: 0x4d88e0, // electric bright blue
      shininess: 80,
      specular: 0xffffff,
    });

    const cockpitMat = new THREE.MeshPhongMaterial({
      color: 0xffaa00, // bright orange canopy
      shininess: 120,
      specular: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });

    const engineMetalMat = new THREE.MeshPhongMaterial({
      color: 0x2a3e5c, // steel engine housing
      shininess: 100,
      specular: 0x88aaff,
    });

    // Unlit glowing materials for effects (bloom-ready)
    const matYellow = new THREE.MeshBasicMaterial({
      color: 0xffdd44, // hot yellow flame center
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    const matOrange = new THREE.MeshBasicMaterial({
      color: 0xff5500, // orange-red outer fire
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    const chargeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff, // cyan charge
      transparent: true,
      opacity: 0.8,
    });

    if (loadedModel) {
      const shipModel = loadedModel.clone();
      const modelWrapper = new THREE.Group();

      // Compute bounding box to automatically center and normalize scale
      const box = new THREE.Box3().setFromObject(shipModel);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Center the model's geometry relative to the wrapper
      shipModel.position.set(-center.x, -center.y, -center.z);
      modelWrapper.add(shipModel);

      // Apply rotation adjustments to point nose to +X, cockpit up +Y, wings in Z
      modelWrapper.rotation.set(GLB_ROT_X, GLB_ROT_Y, GLB_ROT_Z);

      // Normalize size so its main horizontal dimension matches the gameplay length (72 units)
      const maxDim = Math.max(size.x, size.y, size.z);
      const scaleFactor = (72 / maxDim) * GLB_SCALE;
      modelWrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);

      // Apply any fine-tuned translation offsets
      modelWrapper.position.set(GLB_OFFSET_X, GLB_OFFSET_Y, GLB_OFFSET_Z);

      group.add(modelWrapper);

      // Ensure model receives lighting correctly and tune PBR properties for satin diffuse rendering
      shipModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            const tuneTexture = (texture?: THREE.Texture | null): void => {
              if (!texture) return;
              texture.minFilter = THREE.LinearMipmapLinearFilter;
              texture.magFilter = THREE.LinearFilter;
              texture.generateMipmaps = true;
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.RepeatWrapping;
              texture.needsUpdate = true;
            };

            const processMaterial = (oldMat: THREE.Material): THREE.Material => {
              if (oldMat instanceof THREE.MeshStandardMaterial || oldMat.type === 'MeshStandardMaterial') {
                const stdMat = oldMat as THREE.MeshStandardMaterial;

                stdMat.side = THREE.DoubleSide;
                stdMat.envMapIntensity = 0.85;
                stdMat.roughness = stdMat.roughnessMap
                  ? THREE.MathUtils.clamp(stdMat.roughness, 0.35, 1.0)
                  : THREE.MathUtils.clamp(stdMat.roughness, 0.32, 0.72);
                stdMat.metalness = stdMat.metalnessMap
                  ? THREE.MathUtils.clamp(stdMat.metalness, 0.18, 0.65)
                  : THREE.MathUtils.clamp(stdMat.metalness, 0.12, 0.45);

                if (stdMat.emissiveMap) {
                  stdMat.emissiveIntensity = 0.92;
                } else if (stdMat.map) {
                  stdMat.emissive = stdMat.color.clone().multiplyScalar(0.08);
                  stdMat.emissiveIntensity = 0.55;
                }

                tuneTexture(stdMat.map);
                tuneTexture(stdMat.normalMap);
                tuneTexture(stdMat.aoMap);
                tuneTexture(stdMat.roughnessMap);
                tuneTexture(stdMat.metalnessMap);
                tuneTexture(stdMat.emissiveMap);
                stdMat.needsUpdate = true;
                return stdMat;
              }
              return oldMat;
            };

            if (Array.isArray(child.material)) {
              child.material = child.material.map(processMaterial);
            } else {
              child.material = processMaterial(child.material);
            }
          }
        }
      });
    } else {
      // ── 1. UNIFIED CONTURED FUSELAGE (LATHE) ─────────────────────────────────
      // We define a 2D profile curve that starts at a sharp nose tip (front),
      // swells out for the main hull/canopy base, and tapers smoothly down to the exhaust port.
      const lathePoints: THREE.Vector2[] = [];
      lathePoints.push(new THREE.Vector2(0, 38));        // Nose tip
      lathePoints.push(new THREE.Vector2(2.5, 32));      // Nose taper
      lathePoints.push(new THREE.Vector2(5.5, 24));      // Sleek curve
      lathePoints.push(new THREE.Vector2(8.5, 10));      // Cockpit swell
      lathePoints.push(new THREE.Vector2(9.2, 0));       // Max width (center)
      lathePoints.push(new THREE.Vector2(8.0, -10));     // Rear fuselage taper
      lathePoints.push(new THREE.Vector2(6.0, -22));     // Tapering to tail
      lathePoints.push(new THREE.Vector2(4.5, -30));     // Engine mount

      const latheGeo = new THREE.LatheGeometry(lathePoints, 24);
      // Rotate lathe geometry to align along the longitudinal X-axis (pointing forward along +X)
      latheGeo.rotateZ(-Math.PI / 2);

      // ── 2. SEAMLESSLY SUBMERGED CANOPY ───────────────────────────────────────
      // Submerging the canopy capsule into the lathed fuselage so it integrates smoothly.
      const cockpitGeo = new THREE.SphereGeometry(6.2, 24, 24);
      cockpitGeo.scale(2.2, 1.0, 1.0); // Elongate along flight path
      const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
      cockpit.position.set(4, 3.8, 0); // Nestled into top-front of fuselage
      group.add(cockpit);

      // ── 3. CONTURED, BEVELED WINGS (EXTRUDE) ─────────────────────────────────
      // Instead of boxes, we draw a custom swept-back wing in 2D and extrude it
      // with beveling so the edges are smooth and catch highlights beautifully.
      const wingShape = new THREE.Shape();
      wingShape.moveTo(5, 0);             // Root attachment front
      wingShape.lineTo(-12, 34);          // Sweeping back and out to tip
      wingShape.lineTo(-24, 32);          // Wingtip trailing edge
      wingShape.lineTo(-16, 0);           // Wing root attachment back
      wingShape.lineTo(-24, -32);         // Symmetric sweep down/out
      wingShape.lineTo(-12, -34);
      wingShape.closePath();

      const extrudeSettings = {
        depth: 2.5,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 1.2,
        bevelThickness: 1.2
      };

      const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
      wingGeo.center(); // Center geometry
      const wings = new THREE.Mesh(wingGeo, brightMat);
      // Rotate so the wing profile spreads in the Z-axis (towards/away from screen)
      wings.rotation.x = Math.PI / 2;
      wings.position.set(-10, 0, 0);
      group.add(wings);

      // ── 4. INTEGRATED TWIN PRONGS (VIC VIPER STYLE) ──────────────────────────
      // Prongs are structured using sweeping support roots and red-tipped prongs
      // that align beautifully with the wings to look like one molded assembly.

      // Angled Wing struts (connects fuselage to prongs)
      const strutGeo = new THREE.BoxGeometry(6, 12, 4);
      strutGeo.rotateZ(-Math.PI / 6); // Angled forward

      // Sleek continuous prongs
      const prongGeo = new THREE.CylinderGeometry(1.8, 1.8, 48, 12);
      prongGeo.rotateZ(Math.PI / 2); // Align along X axis

      // Merge static fuselage parts sharing hullMat
      const hullGeos = [
        ensureNonIndexed(latheGeo).translate(-2, 0, 0),
        ensureNonIndexed(strutGeo).translate(-8, 7, 3),
        ensureNonIndexed(strutGeo).translate(-8, -7, -3),
        ensureNonIndexed(prongGeo).translate(12, 12, 3.5),
        ensureNonIndexed(prongGeo).translate(12, -12, -3.5),
      ];
      const mergedHullGeo = mergeGeometries(hullGeos);
      const hullMesh = new THREE.Mesh(mergedHullGeo, hullMat);
      group.add(hullMesh);

      // Clean up temporary geometries
      hullGeos.forEach(g => g.dispose());
      latheGeo.dispose();
      strutGeo.dispose();
      prongGeo.dispose();

      // Aerodynamic tapered prong tips (pointed red cones)
      const prongTipGeo = new THREE.ConeGeometry(2.0, 10, 12);
      prongTipGeo.rotateZ(-Math.PI / 2); // Point forward (+X)

      const tipGeos = [
        ensureNonIndexed(prongTipGeo).translate(37, 12, 3.5),
        ensureNonIndexed(prongTipGeo).translate(37, -12, -3.5),
      ];
      const mergedTipGeo = mergeGeometries(tipGeos);
      const tipMesh = new THREE.Mesh(mergedTipGeo, trimMat);
      group.add(tipMesh);

      // Clean up temporary tip geometries
      tipGeos.forEach(g => g.dispose());
      prongTipGeo.dispose();

      // ── 5. INTEGRATED ENGINE EXHAUST & GLOWING PLASMA PARTICLES ──────────────
      // The engine nozzle is shaped to blend cleanly into the tail taper
      const nozzleGeo = new THREE.CylinderGeometry(4.5, 3.8, 10, 16);
      nozzleGeo.rotateZ(Math.PI / 2);
      const nozzle = new THREE.Mesh(nozzleGeo, engineMetalMat);
      nozzle.position.x = -34;
      group.add(nozzle);
    }

    // ── 5. INTEGRATED ENGINE EXHAUST & GLOWING PLASMA PARTICLES ──────────────
    // Particle Group for dynamic volumetric fire effect
    const thrusterGroup = new THREE.Group();
    group.add(thrusterGroup);

    // Create 20 trailing particles using InstancedMesh instead of 20 separate meshes
    this._particles = [];
    const sphereGeo = new THREE.SphereGeometry(3.2, 8, 8);

    this._yellowParticleMesh = new THREE.InstancedMesh(sphereGeo, matYellow, 20);
    this._orangeParticleMesh = new THREE.InstancedMesh(sphereGeo, matOrange, 20);
    this._yellowParticleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._orangeParticleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    thrusterGroup.add(this._yellowParticleMesh);
    thrusterGroup.add(this._orangeParticleMesh);

    for (let i = 0; i < 20; i++) {
      const isYellow = Math.random() > 0.6;
      this._particles.push({
        isYellow,
        x: -42,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: Math.random(), // Staggered starting lifetimes for smooth stream
        decay: 1.8 + Math.random() * 1.8
      });
    }

    // Engine lighting
    this._engineLight = new THREE.PointLight(0xffaa00, 2.0, 150);
    this._engineLight.position.set(-44, 0, 2);
    group.add(this._engineLight);

    // Charge Energy condensation orb
    const chargeGeo = new THREE.SphereGeometry(8, 24, 24);
    this._chargeOrb = new THREE.Mesh(chargeGeo, chargeMat);
    this._chargeOrb.position.set(33.2, -10.5, 0);
    this._chargeOrb.visible = false;
    group.add(this._chargeOrb);

    const shieldMat = new THREE.MeshPhongMaterial({
      color: 0x00aaff,
      emissive: 0x002255,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    
    // Create an elegant "egg-shaped" protective ellipsoid shield with a beautiful padding around the ship
    // Elongated along the flight path (X) and contoured tightly in height (Y) and depth (Z)
    const shieldGeo = new THREE.SphereGeometry(1, 24, 24);
    this._shieldAura = new THREE.Mesh(shieldGeo, shieldMat);
    this._shieldAura.scale.set(43, 23, 23); // Elongated egg shape: X radius 43, Y/Z radius 23
    this._shieldAura.position.set(-2, 0, 0); // Shifted slightly backward to align perfectly with the fuselage weight
    this._shieldAura.visible = false;
    group.add(this._shieldAura);

    return group;
  }

  get isInvincible(): boolean { return this._exitMode !== 'none' || this._invTimer > 0; }
  get shieldPips(): number     { return this._shieldPips; }
  get shieldMax(): number      { return this._shieldMax; }
  get hasFullShield(): boolean { return this._shieldPips >= this._shieldMax; }
  get shieldRegenPct(): number { return this._shieldPips < this._shieldMax && this._shieldRegenDur > 0
                           ? 1 - (this._shieldRegenTimer / this._shieldRegenDur) : 0; }

  _getPos(): Vec2 {
    return { x: this._mesh.position.x, y: this._mesh.position.y };
  }

  // Returns newly spawned Bullet[] this frame; caller adds to master list
  update(dt: number, _input?: unknown, _audio?: unknown): IBullet[] {
    this._newBullets = [];
    if (this._exitMode === 'hold') {
      this.updateExitHold(dt);
      return this._newBullets;
    }
    if (this._exitMode === 'flyout') {
      this.updateExitFlyout(dt);
      return this._newBullets;
    }
    this._updateMovement(dt);
    this._updateWeapon(dt);
    this._updateInvincibility(dt);
    this._updateShieldRegen(dt);
    this._updateShieldFlicker(dt);
    return this._newBullets;
  }

  beginExitHold(): void {
    this._exitMode = 'hold';
    this._exitSpeed = 300;
    this.chargeLevel = 0;
    this._prevFireDown = false;
    this._fireDownDuration = 0;
    this._fireTimer = 0;
    this._invTimer = 0;
    this._flickerTimer = 0;
    this._mesh.visible = true;
    this._audio.stopChargeHum();
    if (this._chargeOrb) this._chargeOrb.visible = false;
  }

  beginExitFlyout(): void {
    this.beginExitHold();
    this._exitMode = 'flyout';
  }

  updateExitHold(dt: number): void {
    const p = this._mesh.position;
    p.y = THREE.MathUtils.lerp(p.y, 0, Math.min(1, 2.0 * dt));

    const rotSpeed = 8 * dt;
    this._mesh.rotation.x = THREE.MathUtils.lerp(this._mesh.rotation.x, 0, rotSpeed);
    this._mesh.rotation.y = THREE.MathUtils.lerp(this._mesh.rotation.y, 0, rotSpeed);
    this._mesh.rotation.z = THREE.MathUtils.lerp(this._mesh.rotation.z, 0, rotSpeed);
    this._updateThrusterVisuals(dt, 1.0, 2.4);
  }

  updateExitFlyout(dt: number): void {
    this._exitSpeed = Math.min(EXIT_FLYOUT_MAX_SPEED, this._exitSpeed + EXIT_FLYOUT_ACCEL * dt);

    const p = this._mesh.position;
    p.x += this._exitSpeed * dt;
    p.y = THREE.MathUtils.lerp(p.y, 0, Math.min(1, 3.5 * dt));

    const rotSpeed = 10 * dt;
    this._mesh.rotation.x = THREE.MathUtils.lerp(this._mesh.rotation.x, 0, rotSpeed);
    this._mesh.rotation.y = THREE.MathUtils.lerp(this._mesh.rotation.y, -0.18, rotSpeed);
    this._mesh.rotation.z = THREE.MathUtils.lerp(this._mesh.rotation.z, 0, rotSpeed);
    this._updateThrusterVisuals(dt, 1.85, 4.2);
  }

  // ── MOVEMENT ───────────────────────────────────────────────────────────────

  private _updateMovement(dt: number): void {
    let dx = 0, dy = 0;
    if (this._input.isDown(Action.LEFT))  dx -= 1;
    if (this._input.isDown(Action.RIGHT)) dx += 1;
    if (this._input.isDown(Action.UP))    dy += 1;
    if (this._input.isDown(Action.DOWN))  dy -= 1;

    if (dx !== 0 && dy !== 0) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }

    const p = this._mesh.position;
    p.x = Math.max(-HALF_W + DISPLAY_W / 2 + 2,
          Math.min( HALF_W - DISPLAY_W / 2 - 2, p.x + dx * SPEED * dt));
    p.y = Math.max(-HALF_H + DISPLAY_H / 2 + 2,
          Math.min( HALF_H - DISPLAY_H / 2 - 2, p.y + dy * SPEED * dt));

    if (this.terrainBounds) {
      p.y = Math.max(this.terrainBounds.bottom + this.hh,
            Math.min(this.terrainBounds.top    - this.hh, p.y));
    }

    // ── 3D FLIGHT ANIMATIONS & TILTS ─────────────────────────────────────────
    // The ship points along +X, so screen-space nose up/down is a Z-axis turn.
    const targetRoll = 0;
    const targetPitch = dy * 0.2;   // ~12 degrees max pitch
    // Target Yaw: dx pivots nose slightly in direction of acceleration
    const targetYaw = -dx * 0.14;  // ~8 degrees max yaw

    // Smoothly spring back or roll in with interpolation
    const rotSpeed = 12 * dt;
    this._mesh.rotation.x = THREE.MathUtils.lerp(this._mesh.rotation.x, targetRoll,  rotSpeed);
    this._mesh.rotation.y = THREE.MathUtils.lerp(this._mesh.rotation.y, targetYaw,   rotSpeed);
    this._mesh.rotation.z = THREE.MathUtils.lerp(this._mesh.rotation.z, targetPitch, rotSpeed);

    let targetLightIntensity = 2.0;
    let speedMult = 1.0;
    if (dx > 0) {
      targetLightIntensity = 3.5;
      speedMult = 1.6;
    } else if (dx < 0) {
      targetLightIntensity = 0.8;
      speedMult = 0.6;
    }

    this._updateThrusterVisuals(dt, speedMult, targetLightIntensity);
  }

  private _updateThrusterVisuals(dt: number, speedMult: number, targetLightIntensity: number): void {
    // Animate trailing volumetric plasma particles
    if (this._particles && this._particles.length > 0) {
      let yellowCount = 0;
      let orangeCount = 0;

      for (const p of this._particles) {
        p.life -= p.decay * dt;
        if (p.life <= 0) {
          // Recycle dead particle at the nozzle with minor randomized offset
          p.life = 1.0;
          p.decay = 1.8 + Math.random() * 1.8;
          p.x = -42 + (Math.random() - 0.5) * 4;
          p.y = (Math.random() - 0.5) * 3;
          p.z = (Math.random() - 0.5) * 3;
          // Shoot backwards (negative X)
          p.vx = -(140 + Math.random() * 110) * speedMult;
          p.vy = (Math.random() - 0.5) * 25;
          p.vz = (Math.random() - 0.5) * 25;
        } else {
          // Drifts and spreads
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
        }

        // Set InstancedMesh matrix at corresponding index
        const mesh = p.isYellow ? this._yellowParticleMesh : this._orangeParticleMesh;
        const index = p.isYellow ? yellowCount++ : orangeCount++;

        if (mesh) {
          this._instanceHelper.position.set(p.x, p.y, p.z);
          this._instanceHelper.scale.setScalar(p.life);
          this._instanceHelper.updateMatrix();
          mesh.setMatrixAt(index, this._instanceHelper.matrix);
        }
      }

      if (this._yellowParticleMesh) {
        this._yellowParticleMesh.count = yellowCount;
        this._yellowParticleMesh.visible = yellowCount > 0;
        this._yellowParticleMesh.instanceMatrix.needsUpdate = true;
      }
      if (this._orangeParticleMesh) {
        this._orangeParticleMesh.count = orangeCount;
        this._orangeParticleMesh.visible = orangeCount > 0;
        this._orangeParticleMesh.instanceMatrix.needsUpdate = true;
      }
    }

    // Smoothly adjust the engine PointLight intensity
    if (this._engineLight) {
      this._engineLight.intensity = THREE.MathUtils.lerp(this._engineLight.intensity, targetLightIntensity, 10 * dt);
    }
  }

  // ── WEAPON ─────────────────────────────────────────────────────────────────

  private _updateWeapon(dt: number): void {
    const fireDown    = this._input.isDown(Action.FIRE);
    const firePressed = this._input.wasJustPressed(Action.FIRE);

    if (this._fireTimer > 0) this._fireTimer -= dt;

    // While held: charge accumulates after a 300ms safety window for rapid tapping
    if (fireDown) {
      this._fireDownDuration += dt;
      if (this._fireDownDuration >= 0.30) {
        this.chargeLevel = Math.min(1, this.chargeLevel + dt / CHARGE_TIME);
        if (this.chargeLevel > 0.08) {
          this._audio.startChargeHum();
        }
      }
    } else {
      this._fireDownDuration = 0;
    }

    // First-press tap shot (all tiers)
    if (firePressed && this._fireTimer <= 0) {
      this._fireTap();
      this._fireTimer = this._getFireCooldown();
      this._audio.stopChargeHum();
    }

    // Key release
    if (!fireDown && this._prevFireDown) {
      if (this.chargeLevel >= CHARGE_THRESHOLD) {
        this._fireCharged();
        this._fireTimer = 0.3;
      }
      this.chargeLevel = 0;
      this._audio.stopChargeHum();
    }

    this._prevFireDown = fireDown;

    // ── CHARGE-UP PLASMA ORB ANIMATION ───────────────────────────────────────
    if (this._chargeOrb) {
      if (this.chargeLevel > 0 && this._fireDownDuration >= 0.30) {
        this._chargeOrb.visible = true;
        // Scale dynamically as charge progresses, with an intense plasma pulse
        const pulse = 1.0 + Math.sin(Date.now() * 0.035) * 0.15;
        const targetScale = this.chargeLevel * 2.8 * pulse;
        this._chargeOrb.scale.setScalar(targetScale);

        // Spin the plasma sphere to give a churning energy look
        this._chargeOrb.rotation.y += 5 * dt;
        this._chargeOrb.rotation.z += 3 * dt;
      } else {
        this._chargeOrb.visible = false;
      }
    }
  }

  // ── CANNON HARDPOINTS ──────────────────────────────────────────────────────
  // Nose Cannon (physical nose tip of Player Model)
  private _noseCannonX(): number { return this._mesh.position.x + 33.2; }
  private _noseCannonY(): number { return this._mesh.position.y - 10.5; }

  // Wing Cannons (physical wing mounts/weapon pods)
  private _wingCannonLeftX(): number { return this._mesh.position.x + 6; }
  private _wingCannonLeftY(): number { return this._mesh.position.y + 12; }

  private _wingCannonRightX(): number { return this._mesh.position.x + 6; }
  private _wingCannonRightY(): number { return this._mesh.position.y - 12; }

  private _getFireCooldown(): number {
    switch (this.weaponTier) {
      case WeaponTier.RAPID:
        return 0.08;
      case WeaponTier.TWIN:
        return 0.10;
      case WeaponTier.SPREAD:
        return 0.12;
      case WeaponTier.WAVE:
      case WeaponTier.PLASMA:
      default:
        return 0.14;
    }
  }

  private _fireTap(): void {
    const nx = this._noseCannonX(), ny = this._noseCannonY();
    const lx = this._wingCannonLeftX(), ly = this._wingCannonLeftY();
    const rx = this._wingCannonRightX(), ry = this._wingCannonRightY();

    if (this.weaponTier === WeaponTier.RAPID) {
      // Tier 1: Single shot from Nose Cannon
      this._spawn(BulletType.PLAYER, nx, ny, 600, 0, '#00ffff');
    } else if (this.weaponTier === WeaponTier.TWIN) {
      // Tier 2: Double shots from Wing Cannons
      this._spawn(BulletType.PLAYER, lx, ly, 600, 0, '#ffd700');
      this._spawn(BulletType.PLAYER, rx, ry, 600, 0, '#ffd700');
    } else if (this.weaponTier === WeaponTier.SPREAD) {
      // Tier 3: Triple shots: straight from Nose, angled from Wing tips
      this._spawn(BulletType.PLAYER, nx, ny, 520,    0, '#ffffff');
      this._spawn(BulletType.PLAYER, lx, ly, 470,  170, '#ffffff');
      this._spawn(BulletType.PLAYER, rx, ry, 470, -170, '#ffffff');
    } else if (this.weaponTier === WeaponTier.WAVE) {
      // Tier 4: Center wave from Nose Cannon
      this._spawn(BulletType.PLAYER_WAVE, nx, ny, 500, 0, '#ff00ff', 2);
    } else if (this.weaponTier === WeaponTier.PLASMA) {
      // Tier 5 (Focused Plasma): Heavy center wave from Nose, side support from Wing Cannons
      this._spawn(BulletType.PLAYER_WAVE, nx, ny, 500,    0, '#00ffd5', 2);
      this._spawn(BulletType.PLAYER,      lx, ly, 500,  170, '#00ffd5');
      this._spawn(BulletType.PLAYER,      rx, ry, 500, -170, '#00ffd5');
    }
    this._audio.play('playerShoot', this.weaponTier);
  }

  private _fireCharged(): void {
    const nx = this._noseCannonX(), ny = this._noseCannonY();
    const lx = this._wingCannonLeftX(), ly = this._wingCannonLeftY();
    const rx = this._wingCannonRightX(), ry = this._wingCannonRightY();

    if (this.weaponTier === WeaponTier.RAPID) {
      // Tier 1 Charge: Nose Cannon
      this._spawn(BulletType.PLAYER_CHARGE, nx, ny, 700, 0, '#ffd700');
    } else if (this.weaponTier === WeaponTier.TWIN) {
      // Tier 2 Charge: Twin charged shots from Wing Cannons
      this._spawn(BulletType.PLAYER_CHARGE, lx, ly, 700, 0, '#ffd700');
      this._spawn(BulletType.PLAYER_CHARGE, rx, ry, 700, 0, '#ffd700');
    } else if (this.weaponTier === WeaponTier.SPREAD) {
      // Tier 3 Charge: Straight from Nose, angled from Wing tips
      this._spawn(BulletType.PLAYER_CHARGE, nx, ny, 620,    0, '#ffd700');
      this._spawn(BulletType.PLAYER_CHARGE, lx, ly, 560,  210, '#ffd700');
      this._spawn(BulletType.PLAYER_CHARGE, rx, ry, 560, -210, '#ffd700');
    } else if (this.weaponTier === WeaponTier.WAVE) {
      // Tier 4 Charge: Triple waves (center from Nose, sides from Wing Cannons)
      this._spawn(BulletType.PLAYER_WAVE, nx, ny, 480,    0, '#ff00ff');
      this._spawn(BulletType.PLAYER_WAVE, lx, ly, 440,  180, '#ff00ff');
      this._spawn(BulletType.PLAYER_WAVE, rx, ry, 440, -180, '#ff00ff');
    } else if (this.weaponTier === WeaponTier.PLASMA) {
      // Tier 5 Charge: Heavy center plasma from Nose, side support from Wing Cannons
      this._spawn(BulletType.PLAYER_PLASMA, nx, ny, 550,    0, null, 2);
      this._spawn(ProjectileSourceKey.PLAYER_CHARGE_SIDE, lx, ly, 540,  190, '#00ffd5');
      this._spawn(ProjectileSourceKey.PLAYER_CHARGE_SIDE, rx, ry, 540, -190, '#00ffd5');
    }
    this._audio.play('playerChargeShoot', this.weaponTier);
  }

  private _spawn(type: BulletType | ProjectileSourceKey, x: number, y: number, vx: number, vy: number, tint: string | null = null, dmgOverride: number | null = null): void {
    const tintNum = tint ? parseInt(tint.replace('#', ''), 16) : null;
    const spawn = { type, x, y, vx, vy, getTargetPos: null, tint: tintNum, damageOverride: dmgOverride };
    this._newBullets.push(this._projectileFactory(spawn));
  }

  // ── INVINCIBILITY / FLICKER ────────────────────────────────────────────────

  private _updateInvincibility(dt: number): void {
    if (this._invTimer <= 0) return;
    this._invTimer     -= dt;
    this._flickerTimer += dt;
    this._mesh.visible  = Math.floor(this._flickerTimer * FLICKER_RATE) % 2 === 0;
    if (this._invTimer <= 0) {
      this._invTimer    = 0;
      this._mesh.visible = true;
    }
  }

  private _updateShieldRegen(dt: number): void {
    if (this._shieldPips >= this._shieldMax || this._shieldRegenTimer <= 0) return;
    this._shieldRegenTimer -= dt;
    if (this._shieldRegenTimer <= 0) {
      this._shieldPips = this._shieldMax;   // all-at-once restore
      this._shieldRegenTimer = 0;
      if (this._shieldAura) {
        this._shieldAura.visible = false;   // Keep invisible until hit
      }
    }
  }

  private _updateShieldFlicker(dt: number): void {
    if (this._shieldPips === 0) {
      if (this._shieldAura) this._shieldAura.visible = false;
      return;
    }
    if (this._shieldFlickerTimer > 0) {
      this._shieldFlickerTimer -= dt;
      if (this._shieldAura) {
        this._shieldAura.visible = true;
        // Smoothly fade the shield glow out from 0.70 opacity down to 0 over its 0.3s duration
        const pct = Math.max(0, Math.min(1, this._shieldFlickerTimer / 0.3));
        this._shieldAura.material.opacity = 0.70 * pct;
      }
      if (this._shieldFlickerTimer <= 0) {
        this._shieldFlickerTimer = 0;
        if (this._shieldAura) this._shieldAura.visible = false; // Hide completely when done
      }
    } else {
      if (this._shieldAura) {
        this._shieldAura.visible = false;   // Invisible during normal flight
      }
    }
  }

  private _flickerShield(): void {
    this._shieldFlickerTimer = 0.3;
  }

  resetShield(): void {
    this._shieldPips = this._shieldMax;
    this._shieldRegenTimer = 0;
    this._shieldFlickerTimer = 0;
    if (this._shieldAura) {
      this._shieldAura.visible = false;     // Invisible during normal flight
      this._shieldAura.material.opacity = 0;
    }
  }

  refillShield(): boolean {
    if (this._shieldPips >= this._shieldMax) return false;
    this.resetShield();
    this._audio.play('shieldRefill');
    return true;
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  /** Called by collision detection. Returns true if a life was consumed. */
  hit(): boolean {
    if (this._debugInvincible) return false;
    if (this.isInvincible) return false;
    this._audio.play('playerHit');
    this._audio.stopChargeHum();

    if (this._shieldPips > 0) {
      // Shield absorbs the hit — no life loss, no tier drop
      this._shieldPips--;
      this._shieldRegenTimer = this._shieldRegenDur;
      this._flickerShield();   // visual: aura flicker
      return false;            // false = no life lost
    }

    // Unshielded hit — Ace always drops tier; Pilot drops tier; Rookie never drops tier
    if (this._mode !== DifficultyMode.ROOKIE) {
      this.weaponTier = Math.max(WeaponTier.RAPID, this.weaponTier - 1) as WeaponTierValue;
    }
    this.chargeLevel   = 0;
    this._prevFireDown = false;
    this._fireTimer    = 0.5;
    this._invTimer     = INVINCIBLE_TIME;
    this._flickerTimer = 0;
    this._mesh.position.set(RESPAWN_X, RESPAWN_Y, 2);
    return true;
  }

  upgradeWeapon(maxTier: number = WeaponTier.PLASMA): boolean {
    if (this.weaponTier < Math.min(maxTier, WeaponTier.PLASMA)) {
      this.weaponTier = (this.weaponTier + 1) as WeaponTierValue;
      this._audio.play('powerUp');
      return true;
    }
    return false;
  }

  destroy(): void {
    this._audio.stopChargeHum();
    this._scene.remove(this._mesh);
    this._mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
