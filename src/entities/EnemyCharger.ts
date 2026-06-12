import * as THREE from 'three';
import { Enemy, HALF_H } from './Enemy.ts';
import type { GetPositionFn, IAudio, IScene, ProjectileFactoryFn } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed, addVertexColor } from '../utils/ProceduralToolkit.ts';

function coloredGeometry(
  source: THREE.BufferGeometry,
  colorHex: number,
  transform?: (geo: THREE.BufferGeometry) => void,
): THREE.BufferGeometry {
  const geo = ensureNonIndexed(source);
  if (transform) transform(geo);
  addVertexColor(geo, colorHex);
  return geo;
}


const SPEED        = 150;
const TRIGGER_DISTANCE = 520;
const LOCK_DUR     = 1.0;
const CHARGE_SPEED = 700;
const HW = 22, HH = 12;

type ChargerState = 'entering' | 'locking' | 'charging';

export class EnemyCharger extends Enemy {
  private _state: ChargerState;
  private _lockTimer: number;
  private _chargeTargetY: number;
  private _homingFrozen: boolean;
  private _materialsList: THREE.Material[];
  private _geometriesList: THREE.BufferGeometry[];
  private _time?: number;
  private _shipGroup: THREE.Group | null = null;
  private _topWingGroup: THREE.Group | null = null;
  private _bottomWingGroup: THREE.Group | null = null;
  private _topPlumeT: THREE.Mesh | null = null;
  private _topPlumeA: THREE.Mesh | null = null;
  private _bottomPlumeT: THREE.Mesh | null = null;
  private _bottomPlumeA: THREE.Mesh | null = null;
  private _topSteerPlume: THREE.Mesh | null = null;
  private _bottomSteerPlume: THREE.Mesh | null = null;
  private _topTrail: THREE.Mesh | null = null;
  private _bottomTrail: THREE.Mesh | null = null;
  private _laserMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;
  private _neonEmissiveUniform: { value: THREE.Color } | null = null;
  private _amberMat: THREE.MeshPhongMaterial | null = null;
  private _trailMat: THREE.MeshBasicMaterial | null = null;

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
    this._hp             = 1;
    this.score           = 250;
    this._dropChance     = 0.05;
    this._getPlayerPos   = getPlayerPos;
    this._state          = 'entering';
    this._lockTimer      = 0;
    this._chargeTargetY  = 0;
    this._homingFrozen   = false;
    this._materialsList  = [];
    this._geometriesList = [];

    this._displayName = 'Charger';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  get viewerXOffset(): number {
    const baseOffset = this._state === 'charging' ? -12 : 18;
    return baseOffset * Math.cos(this._mesh!.rotation.y);
  }

  private get _isInViewer(): boolean {
    return (this as { _isViewer?: boolean })._isViewer === true;
  }

  private _trackResource<T extends THREE.Material | THREE.BufferGeometry>(res: T): T {
    if (!res) return res;
    if ((res as THREE.Material).isMaterial) this._materialsList.push(res as THREE.Material);
    else if ((res as { isBufferGeometry?: boolean }).isBufferGeometry) this._geometriesList.push(res as THREE.BufferGeometry);
    return res;
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this.x, this.y, 0);

    // Inner ship group that we can shake/vibrate during the warning phase
    this._shipGroup = new THREE.Group();
    group.add(this._shipGroup);

    // Modern material design (Overcharged Plasma theme)
    const neonEmissiveUniform = { value: new THREE.Color(0x00a8b3) };
    this._neonEmissiveUniform = neonEmissiveUniform;

    const structuralMat = this._trackResource(new THREE.MeshPhongMaterial({
      color: 0xffffff,       // Vertex-colored matte/metal structural surfaces
      emissive: 0x080b10,
      shininess: 60,
      specular: 0x7f8b96,
      vertexColors: true,
    }));
    structuralMat.userData['uNeonEmissive'] = neonEmissiveUniform;
    structuralMat.customProgramCacheKey = () => 'EnemyChargerEmissiveV1';
    structuralMat.onBeforeCompile = (shader) => {
      shader.uniforms['uNeonEmissive'] = neonEmissiveUniform;
      shader.fragmentShader = 'uniform vec3 uNeonEmissive;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        `vec3 totalEmissiveRadiance = emissive;
        #ifdef USE_COLOR
        float neonMask = step(0.5, vColor.g - vColor.r);
        totalEmissiveRadiance = mix(emissive, uNeonEmissive, neonMask);
        #endif`
      );
    };

    const amberMat = this._trackResource(new THREE.MeshPhongMaterial({
      color: 0xff7700,       // Super hot amber reactor
      emissive: 0x772200,
      shininess: 100,
      specular: 0xffaa44,
    }));
    this._amberMat = amberMat;

    const laserMat = this._trackResource(new THREE.MeshBasicMaterial({
      color: 0xff2200,       // Warning red/orange laser
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));

    const trailMat = this._trackResource(new THREE.MeshBasicMaterial({
      color: 0x00f3ff,       // Trailing neon speed afterimage
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this._trailMat = trailMat;

    // ── 1. FUSELAGE / BODY (Glaive-Class Interceptor) ──
    const bodyGeo = new THREE.ConeGeometry(10.5, 34, 8);
    const ventGeo = new THREE.CylinderGeometry(5.5, 5.5, 2, 8);
    const spineGeo = new THREE.BoxGeometry(22, 2.5, 4.5);
    const noseGeo = new THREE.ConeGeometry(4.5, 10, 8);
    const reactorGeo = new THREE.SphereGeometry(7, 16, 16);

    const fuselageGeos = [
      coloredGeometry(bodyGeo, 0x1c1e22, geo => {
        geo.rotateZ(Math.PI / 2);
        geo.translate(-2, 0, 0);
      }),
      coloredGeometry(ventGeo, 0x607080, geo => {
        geo.rotateZ(Math.PI / 2);
        geo.translate(8, 0, 0);
      }),
      coloredGeometry(spineGeo, 0x00f3ff, geo => {
        geo.translate(-1, 0, 0);
      }),
      coloredGeometry(noseGeo, 0x00f3ff, geo => {
        geo.rotateZ(Math.PI / 2);
        geo.translate(-22, 0, 0);
      }),
      coloredGeometry(reactorGeo, 0x00f3ff, geo => {
        geo.translate(6, 0, 0);
      }),
    ];
    const fuselageGeo = this._trackResource(mergeGeometries(fuselageGeos));
    const fuselageMesh = new THREE.Mesh(fuselageGeo, structuralMat);
    this._shipGroup.add(fuselageMesh);

    fuselageGeos.forEach(g => g.dispose());
    bodyGeo.dispose();
    ventGeo.dispose();
    spineGeo.dispose();
    noseGeo.dispose();
    reactorGeo.dispose();

    // ── 2. VERTICAL SCISSOR WINGS (XY Gameplay Plane) ──
    this._topWingGroup = new THREE.Group();
    this._topWingGroup.position.set(2, 6, 0);
    this._shipGroup.add(this._topWingGroup);

    this._bottomWingGroup = new THREE.Group();
    this._bottomWingGroup.position.set(2, -6, 0);
    this._shipGroup.add(this._bottomWingGroup);

    const topWingGeo = new THREE.BoxGeometry(18, 6, 2.5);
    const topNozzleGeo = new THREE.CylinderGeometry(2.5, 3.2, 5, 8);
    const topChannelGeo = new THREE.BoxGeometry(14, 1.5, 2.7);
    const topStructureGeos = [
      coloredGeometry(topWingGeo, 0x607080, geo => {
        geo.translate(-4, 3, 0);
      }),
      coloredGeometry(topNozzleGeo, 0x1c1e22, geo => {
        geo.rotateZ(Math.PI / 2);
        geo.translate(3, 6, 0);
      }),
      coloredGeometry(topChannelGeo, 0x00f3ff, geo => {
        geo.translate(-3, 6.1, 0);
      }),
    ];
    const topStructureGeo = this._trackResource(mergeGeometries(topStructureGeos));
    const topStructure = new THREE.Mesh(topStructureGeo, structuralMat);
    this._topWingGroup.add(topStructure);

    topStructureGeos.forEach(g => g.dispose());
    topWingGeo.dispose();
    topNozzleGeo.dispose();
    topChannelGeo.dispose();

    const bottomWingGeo = new THREE.BoxGeometry(18, 6, 2.5);
    const bottomNozzleGeo = new THREE.CylinderGeometry(3.2, 2.5, 5, 8);
    const bottomChannelGeo = new THREE.BoxGeometry(14, 1.5, 2.7);
    const bottomStructureGeos = [
      coloredGeometry(bottomWingGeo, 0x607080, geo => {
        geo.translate(-4, -3, 0);
      }),
      coloredGeometry(bottomNozzleGeo, 0x1c1e22, geo => {
        geo.rotateZ(Math.PI / 2);
        geo.translate(3, -6, 0);
      }),
      coloredGeometry(bottomChannelGeo, 0x00f3ff, geo => {
        geo.translate(-3, -6.1, 0);
      }),
    ];
    const bottomStructureGeo = this._trackResource(mergeGeometries(bottomStructureGeos));
    const bottomStructure = new THREE.Mesh(bottomStructureGeo, structuralMat);
    this._bottomWingGroup.add(bottomStructure);

    bottomStructureGeos.forEach(g => g.dispose());
    bottomWingGeo.dispose();
    bottomNozzleGeo.dispose();
    bottomChannelGeo.dispose();

    // ── 3. TWIN-ENGINE PLUMES (Wingtip spikes) ──
    const plumeTGeo = this._trackResource(new THREE.ConeGeometry(1.8, 12, 8));
    plumeTGeo.rotateZ(-Math.PI / 2);
    plumeTGeo.translate(9, 0, 0);
    addVertexColor(plumeTGeo, 0x00f3ff);

    const plumeAGeo = this._trackResource(new THREE.ConeGeometry(0.9, 16, 8));
    plumeAGeo.rotateZ(-Math.PI / 2);
    plumeAGeo.translate(11, 0, 0);

    // Top Plume Meshes
    this._topPlumeT = new THREE.Mesh(plumeTGeo, structuralMat);
    this._topPlumeT.position.set(2, 6, 0);
    this._topWingGroup.add(this._topPlumeT);

    this._topPlumeA = new THREE.Mesh(plumeAGeo, amberMat);
    this._topPlumeA.position.set(2, 6, 0);
    this._topWingGroup.add(this._topPlumeA);

    // Bottom Plume Meshes
    this._bottomPlumeT = new THREE.Mesh(plumeTGeo, structuralMat);
    this._bottomPlumeT.position.set(2, -6, 0);
    this._bottomWingGroup.add(this._bottomPlumeT);

    this._bottomPlumeA = new THREE.Mesh(plumeAGeo, amberMat);
    this._bottomPlumeA.position.set(2, -6, 0);
    this._bottomWingGroup.add(this._bottomPlumeA);

    // ── 4. FUSELAGE REACTIONARY THRUSTERS (Vertical steering bursts) ──
    const steerGeo = this._trackResource(new THREE.ConeGeometry(2.0, 12, 8));
    steerGeo.rotateZ(Math.PI / 2);
    steerGeo.translate(0, 6, 0);

    this._topSteerPlume = new THREE.Mesh(steerGeo, amberMat);
    this._topSteerPlume.position.set(6, 6, 0);
    this._topSteerPlume.scale.set(0, 0, 0);
    this._topSteerPlume.visible = false;
    this._shipGroup.add(this._topSteerPlume);

    const steerDownGeo = this._trackResource(new THREE.ConeGeometry(2.0, 12, 8));
    steerDownGeo.rotateZ(-Math.PI / 2);
    steerDownGeo.translate(0, -6, 0);

    this._bottomSteerPlume = new THREE.Mesh(steerDownGeo, amberMat);
    this._bottomSteerPlume.position.set(6, -6, 0);
    this._bottomSteerPlume.scale.set(0, 0, 0);
    this._bottomSteerPlume.visible = false;
    this._shipGroup.add(this._bottomSteerPlume);

    // ── 5. DUAL WINGTIP SPEED TRAILS (Supersonic ribbons) ──
    const trailGeo = this._trackResource(new THREE.CylinderGeometry(1.2, 0.1, 70, 8));
    trailGeo.rotateZ(-Math.PI / 2);
    trailGeo.translate(35, 0, 0);

    this._topTrail = new THREE.Mesh(trailGeo, trailMat);
    this._topTrail.position.set(2, 6, 0);
    this._topTrail.visible = false;
    this._topWingGroup.add(this._topTrail);

    this._bottomTrail = new THREE.Mesh(trailGeo, trailMat);
    this._bottomTrail.position.set(2, -6, 0);
    this._bottomTrail.visible = false;
    this._bottomWingGroup.add(this._bottomTrail);

    // ── 6. WARNING TARGETING LASER SIGHT ──
    const laserGeo = this._trackResource(new THREE.CylinderGeometry(0.8, 0.8, 1, 6));
    laserGeo.rotateZ(Math.PI / 2);
    laserGeo.translate(-0.5, 0, 0);

    this._laserMesh = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(laserGeo, laserMat);
    this._laserMesh.position.set(-22, 0, 0);
    this._laserMesh.scale.x = 0;
    this._laserMesh.visible = false;
    this._shipGroup.add(this._laserMesh);

    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (!Array.isArray(mat) && 'color' in mat) {
          const m = mat as THREE.MeshPhongMaterial | THREE.MeshBasicMaterial;
          child.userData['origColor'] = m.color.getHex();
          if ('emissive' in m) {
            child.userData['origEmissive'] = (m as THREE.MeshPhongMaterial).emissive.getHex();
          }
        }
      }
    });

    return group;
  }

  _tick(dt: number): void {
    this._time = (this._time || 0) + dt;
    const pos = this._mesh!.position;

    if (this._isInViewer) {
      this._topWingGroup!.rotation.z = THREE.MathUtils.lerp(this._topWingGroup!.rotation.z, -0.05, 5 * dt);
      this._bottomWingGroup!.rotation.z = THREE.MathUtils.lerp(this._bottomWingGroup!.rotation.z, 0.05, 5 * dt);
      this._shipGroup!.position.set(0, 0, 0);

      this._topPlumeT!.scale.set(0, 0, 0);
      this._topPlumeA!.scale.set(0, 0, 0);
      this._bottomPlumeT!.scale.set(0, 0, 0);
      this._bottomPlumeA!.scale.set(0, 0, 0);
      this._topSteerPlume!.scale.set(0, 0, 0);
      this._bottomSteerPlume!.scale.set(0, 0, 0);

      this._topPlumeT!.visible = false;
      this._topPlumeA!.visible = false;
      this._bottomPlumeT!.visible = false;
      this._bottomPlumeA!.visible = false;
      this._topSteerPlume!.visible = false;
      this._bottomSteerPlume!.visible = false;
      this._topTrail!.visible = false;
      this._bottomTrail!.visible = false;
      this._laserMesh!.visible = false;

      if (this._neonEmissiveUniform) {
        this._neonEmissiveUniform.value.setHex(0x00a8b3);
      }
      if (this._amberMat && this._amberMat.emissive) {
        this._amberMat.emissive.setHex(0x772200);
      }
      return;
    }

    if (this._state === 'entering') {
      // ── Cruise animation ──
      // Wings folded flat parallel to body
      this._topWingGroup!.rotation.z = THREE.MathUtils.lerp(this._topWingGroup!.rotation.z, -0.05, 5 * dt);
      this._bottomWingGroup!.rotation.z = THREE.MathUtils.lerp(this._bottomWingGroup!.rotation.z, 0.05, 5 * dt);

      // Normal engine flame size
      const pulse = 0.8 + Math.sin(this._time * 15) * 0.1;
      this._topPlumeT!.scale.set(pulse, 0.8, 0.8);
      this._topPlumeA!.scale.set(pulse, 0.7, 0.7);
      this._bottomPlumeT!.scale.set(pulse, 0.8, 0.8);
      this._bottomPlumeA!.scale.set(pulse, 0.7, 0.7);

      this._topPlumeT!.visible = true;
      this._topPlumeA!.visible = true;
      this._bottomPlumeT!.visible = true;
      this._bottomPlumeA!.visible = true;

      this._topSteerPlume!.scale.set(0, 0, 0);
      this._bottomSteerPlume!.scale.set(0, 0, 0);
      this._topSteerPlume!.visible = false;
      this._bottomSteerPlume!.visible = false;
      this._topTrail!.visible = false;
      this._bottomTrail!.visible = false;
      this._laserMesh!.visible = false;

      // Move left
      pos.x -= SPEED * dt;
      const playerX = this._getPlayerPos!().x;
      if (pos.x <= 400 && pos.x - playerX <= TRIGGER_DISTANCE) {
        this._state = 'locking';
        this._lockTimer = LOCK_DUR;
        this._chargeTargetY = this._getPlayerPos!().y;
        this._laserMesh!.visible = true;
      }

    } else if (this._state === 'locking') {
      // ── Warning / Lock-on animation ──
      this._lockTimer -= dt;

      // Scissor wings open vertically in XY plane (~28 degrees)
      const wingTargetAngle = Math.PI / 6.5;
      this._topWingGroup!.rotation.z = THREE.MathUtils.lerp(this._topWingGroup!.rotation.z, wingTargetAngle, 3 * dt);
      this._bottomWingGroup!.rotation.z = THREE.MathUtils.lerp(this._bottomWingGroup!.rotation.z, -wingTargetAngle, 3 * dt);

      // Energy channels and reactor pulse like a high-speed heartbeat
      const heartBeat = (1 + Math.sin(this._time * 40)) * 0.5;
      if (this._neonEmissiveUniform) {
        this._neonEmissiveUniform.value.setHex(heartBeat > 0.5 ? 0x00f3ff : 0x004455);
      }
      if (this._amberMat && this._amberMat.emissive) {
        this._amberMat.emissive.setHex(heartBeat > 0.5 ? 0xffaa00 : 0x441100);
      }

      // Reactor engine builds power
      const pulse = 1.3 + Math.sin(this._time * 60) * 0.3;
      this._topPlumeT!.scale.set(pulse, pulse, pulse);
      this._topPlumeA!.scale.set(pulse, pulse, pulse);
      this._bottomPlumeT!.scale.set(pulse, pulse, pulse);
      this._bottomPlumeA!.scale.set(pulse, pulse, pulse);

      this._topPlumeT!.visible = true;
      this._topPlumeA!.visible = true;
      this._bottomPlumeT!.visible = true;
      this._bottomPlumeA!.visible = true;

      this._topSteerPlume!.scale.set(0, 0, 0);
      this._bottomSteerPlume!.scale.set(0, 0, 0);
      this._topSteerPlume!.visible = false;
      this._bottomSteerPlume!.visible = false;
      this._topTrail!.visible = false;
      this._bottomTrail!.visible = false;

      // Ship shudders/vibrates under high-frequency tension (vertical tremor)
      const shudder = Math.sin(this._time * 120) * 0.75;
      this._shipGroup!.position.set(0, shudder, 0);

      // Targeting Laser tracks the player
      const playerPos = this._getPlayerPos!();
      const diffX = playerPos.x - (pos.x - 22);
      const diffY = playerPos.y - pos.y;
      const angle = Math.atan2(diffY, diffX);
      this._laserMesh!.rotation.z = angle;

      // Distance to target defines laser length
      const dist = Math.sqrt(diffX * diffX + diffY * diffY);
      this._laserMesh!.scale.x = dist;

      // Laser pulses and narrows from wide warning to razor-thin
      const progress = 1 - (this._lockTimer / LOCK_DUR);
      const pulseWidth = (1 - progress * 0.85) * (1.2 + Math.sin(this._time * 45) * 0.4);
      this._laserMesh!.scale.y = pulseWidth;
      this._laserMesh!.scale.z = pulseWidth;
      this._laserMesh!.material.opacity = 0.5 + progress * 0.5;

      // Overclock flash at the last instant
      if (this._lockTimer <= 0.08) {
        this._laserMesh!.material.color.setHex(0xffffff);
        this._laserMesh!.scale.y = 3.5;
        this._laserMesh!.scale.z = 3.5;
      }

      if (this._lockTimer <= 0) {
        // Reset color, vibration, and advance to charge
        this._shipGroup!.position.set(0, 0, 0);
        if (this._neonEmissiveUniform) {
          this._neonEmissiveUniform.value.setHex(0x00a8b3);
        }
        if (this._amberMat && this._amberMat.emissive) {
          this._amberMat.emissive.setHex(0x772200);
        }
        this._laserMesh!.visible = false;
        this._state = 'charging';
        this._homingFrozen = false;
      }

    } else if (this._state === 'charging') {
      // ── Charging High-Speed Rush ──
      // Wide locked wing position (~36 degrees)
      const wingTargetAngle = Math.PI / 5;
      this._topWingGroup!.rotation.z = THREE.MathUtils.lerp(this._topWingGroup!.rotation.z, wingTargetAngle, 6 * dt);
      this._bottomWingGroup!.rotation.z = THREE.MathUtils.lerp(this._bottomWingGroup!.rotation.z, -wingTargetAngle, 6 * dt);

      // Huge engine plumes with high-frequency scaling flicker
      const flicker = 1.0 + Math.sin(this._time * 80) * 0.25;
      this._topPlumeT!.scale.set(3.2 * flicker, 1.4, 1.4);
      this._topPlumeA!.scale.set(4.2 * flicker, 0.8, 0.8);
      this._bottomPlumeT!.scale.set(3.2 * flicker, 1.4, 1.4);
      this._bottomPlumeA!.scale.set(4.2 * flicker, 0.8, 0.8);

      this._topPlumeT!.visible = true;
      this._topPlumeA!.visible = true;
      this._bottomPlumeT!.visible = true;
      this._bottomPlumeA!.visible = true;

      // Energy tails glow bright and fade in length
      this._trailMat!.opacity = 0.20 + Math.sin(this._time * 50) * 0.05;
      this._topTrail!.visible = true;
      this._bottomTrail!.visible = true;

      pos.x -= CHARGE_SPEED * dt;

      // Dampened Near-Homing Steering
      const playerPos = this._getPlayerPos!();
      const distToPlayerX = Math.abs(pos.x - playerPos.x);

      if (distToPlayerX > 150 && !this._homingFrozen) {
        const diff = playerPos.y - pos.y;
        const maxDelta = 250 * dt;
        pos.y += Math.max(-maxDelta, Math.min(maxDelta, diff));

        // Reactionary Steering Jet Bursts (Fuselage jets)
        if (diff > 5) {
          // Steering UP -> fire bottom thruster downwards
          this._bottomSteerPlume!.scale.set(1.5 + Math.random() * 0.5, 2.2, 1.5 + Math.random() * 0.5);
          this._bottomSteerPlume!.visible = true;
          this._topSteerPlume!.scale.set(0, 0, 0);
          this._topSteerPlume!.visible = false;
        } else if (diff < -5) {
          // Steering DOWN -> fire top thruster upwards
          this._topSteerPlume!.scale.set(1.5 + Math.random() * 0.5, 2.2, 1.5 + Math.random() * 0.5);
          this._topSteerPlume!.visible = true;
          this._bottomSteerPlume!.scale.set(0, 0, 0);
          this._bottomSteerPlume!.visible = false;
        } else {
          this._topSteerPlume!.scale.set(0, 0, 0);
          this._bottomSteerPlume!.scale.set(0, 0, 0);
          this._topSteerPlume!.visible = false;
          this._bottomSteerPlume!.visible = false;
        }
      } else {
        // Homing lock disengaged / frozen close to player
        this._homingFrozen = true;
        this._topSteerPlume!.scale.set(0, 0, 0);
        this._bottomSteerPlume!.scale.set(0, 0, 0);
        this._topSteerPlume!.visible = false;
        this._bottomSteerPlume!.visible = false;
      }
    }

    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }
  }

  destroy(): void {
    if (!this._mesh) return;
    this._scene.remove(this._mesh);

    for (const geom of this._geometriesList) {
      geom.dispose();
    }
    for (const mat of this._materialsList) {
      mat.dispose();
    }

    this._materialsList = [];
    this._geometriesList = [];
    this._mesh = null;
  }
}
