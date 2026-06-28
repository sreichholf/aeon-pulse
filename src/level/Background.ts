import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';
import { InstancedScrollLayer, type InstancedScrollMeshLayer } from './InstancedScrollLayer.ts';
import type { SectorBackgroundConfig } from './sectors/Sectors.ts';

const HALF_W = GAME_WIDTH / 2;

const NEBULA_FRAG = `
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),                hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p  = p * 2.0 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;

    float n = fbm(uv * 3.0 + vec2(-uTime * 0.05,  uTime * 0.02)) * 0.6
            + fbm(uv * 5.5 + vec2( uTime * 0.03, -uTime * 0.015) + 4.1) * 0.4;
    float d = smoothstep(0.45, 0.82, n);
    vec3 deep   = vec3(0.00, 0.00, 0.02);
    vec3 purple = vec3(0.10, 0.02, 0.22);
    vec3 blue   = vec3(0.02, 0.05, 0.28);
    vec3 nebulaCol = mix(deep, mix(purple, blue, uv.x + sin(uTime * 0.08) * 0.15), d * 0.55);

    gl_FragColor = vec4(nebulaCol, 1.0);
  }
`;

interface ArchEntry {
  x: number;
  y: number;
  z: number;
}

interface TowerEntry {
  x: number;
  y: number;
  z: number;
  flipped: boolean;
  bladeRotation: number;
}

interface PipeEntry {
  x: number;
  y: number;
  z: number;
}

interface SpireEntry {
  x: number;
  y: number;
  z: number;
  flipped: boolean;
}

interface RingEntry {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

interface DustEntry {
  kind: 'octa' | 'tetra';
  color: 'cyan' | 'blue';
  x: number;
  y: number;
  z: number;
  speedMult: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rx: number;
  ry: number;
  rz: number;
}

export class Background implements IBackground {
  private _scene: IScene;
  public baseSpeed: number;
  private _time: number;

  private _nebulaMesh: THREE.Mesh | null;
  private _nebulaMat: THREE.ShaderMaterial;

  private _baseMat: THREE.MeshPhongMaterial;
  private _emissiveMat: THREE.MeshBasicMaterial;
  private _archBaseMat: THREE.MeshPhongMaterial;
  private _archEmissiveMat: THREE.MeshBasicMaterial;

  private _archRingGeo: THREE.TorusGeometry;
  private _archPanelGeo: THREE.BoxGeometry;
  private _archIndicatorGeo: THREE.BoxGeometry;
  private _archTrimGeo: THREE.TorusGeometry;
  private _archOuterTrimGeo: THREE.TorusGeometry;
  private _archRingMesh: InstancedScrollMeshLayer;
  private _archPanelMesh: InstancedScrollMeshLayer;
  private _archIndicatorMesh: InstancedScrollMeshLayer;
  private _archTrimMesh: InstancedScrollMeshLayer;
  private _archOuterTrimMesh: InstancedScrollMeshLayer;
  private _arches: ArchEntry[];

  private _towerBaseGeo: THREE.CylinderGeometry;
  private _towerHubGeo: THREE.CylinderGeometry;
  private _towerBladeGeo: THREE.BoxGeometry;
  private _towerVentGeo: THREE.CylinderGeometry;
  private _towerBaseMesh: InstancedScrollMeshLayer;
  private _towerHubMesh: InstancedScrollMeshLayer;
  private _towerBladeMesh: InstancedScrollMeshLayer;
  private _towerVentMesh: InstancedScrollMeshLayer;
  private _towers: TowerEntry[];

  private _pipeBodyGeo: THREE.CylinderGeometry;
  private _pipeClampGeo: THREE.CylinderGeometry;
  private _pipeSeamGeo: THREE.CylinderGeometry;
  private _pipeBodyMesh: InstancedScrollMeshLayer;
  private _pipeClampMesh: InstancedScrollMeshLayer;
  private _pipeSeamMesh: InstancedScrollMeshLayer;
  private _pipes: PipeEntry[];

  private _spireBodyGeo: THREE.CylinderGeometry;
  private _spireCrownGeo: THREE.CylinderGeometry;
  private _spireBodyMesh: InstancedScrollMeshLayer;
  private _spireCrownMesh: InstancedScrollMeshLayer;
  private _spires: SpireEntry[];

  private _ringBodyGeo: THREE.TorusGeometry;
  private _ringCoreGeo: THREE.TorusGeometry;
  private _ringBodyMesh: InstancedScrollMeshLayer;
  private _ringCoreMesh: InstancedScrollMeshLayer;
  private _rings: RingEntry[];

  private _dustMatCyan: THREE.MeshBasicMaterial;
  private _dustMatBlue: THREE.MeshBasicMaterial;
  private _dustGeoOcta: THREE.OctahedronGeometry;
  private _dustGeoTetra: THREE.TetrahedronGeometry;
  private _dustOctaCyanMesh: InstancedScrollMeshLayer;
  private _dustOctaBlueMesh: InstancedScrollMeshLayer;
  private _dustTetraCyanMesh: InstancedScrollMeshLayer;
  private _dustTetraBlueMesh: InstancedScrollMeshLayer;
  private _dust: DustEntry[];

  private _instancedLayer: InstancedScrollLayer;
  private _rotationEuler: THREE.Euler;

  private readonly _sectorConfig?: SectorBackgroundConfig;

  private _sectorLandmarkBody: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarkAccent: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarks: Array<{ x: number; y: number; z: number; rot: number; ax: number; ay: number }> = [];

  constructor(scene: IScene, baseSpeed: number = 100, sectorConfig?: SectorBackgroundConfig) {
    this._scene = scene;
    this.baseSpeed = baseSpeed;
    this._sectorConfig = sectorConfig;
    this._time = 0;
    this._instancedLayer = new InstancedScrollLayer(scene);
    this._rotationEuler = new THREE.Euler();

    const nebulaMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: STANDARD_VERT,
      fragmentShader: NEBULA_FRAG,
      depthWrite: false,
    });
    const nebulaGeo = new THREE.PlaneGeometry(GAME_WIDTH, GAME_HEIGHT);
    this._nebulaMesh = new THREE.Mesh(nebulaGeo, nebulaMat);
    markRenderCategory(this._nebulaMesh, RenderCategory.BACKGROUND, 'background.nebula');
    this._nebulaMesh.position.z = -100;
    this._nebulaMesh.scale.set(1.4, 1.4, 1.0);
    scene.add(this._nebulaMesh);
    this._nebulaMat = nebulaMat;

    this._baseMat = new THREE.MeshPhongMaterial({
      color: 0x1d212a,
      emissive: 0x050608,
      specular: 0x556688,
      shininess: 75,
      flatShading: true,
    });
    this._emissiveMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.95,
    });
    this._archBaseMat = new THREE.MeshPhongMaterial({
      color: 0x3d4758,
      emissive: 0x0f1d2e,
      specular: 0x8899bb,
      shininess: 90,
      flatShading: true,
    });
    this._archEmissiveMat = new THREE.MeshBasicMaterial({
      color: 0x33ffdd,
      transparent: true,
      opacity: 0.98,
    });

    this._archRingGeo = new THREE.TorusGeometry(245, 14, 4, 8);
    this._archRingGeo.rotateY(Math.PI / 2);
    this._archPanelGeo = new THREE.BoxGeometry(32, 50, 18);
    this._archIndicatorGeo = new THREE.BoxGeometry(34, 12, 20);
    this._archTrimGeo = new THREE.TorusGeometry(234, 3.5, 4, 8);
    this._archTrimGeo.rotateY(Math.PI / 2);
    this._archOuterTrimGeo = new THREE.TorusGeometry(256, 2.2, 4, 8);
    this._archOuterTrimGeo.rotateY(Math.PI / 2);
    this._archRingMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.arch', geometry: this._archRingGeo, material: this._archBaseMat, capacity: 4 });
    this._archPanelMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.arch', geometry: this._archPanelGeo, material: this._archBaseMat, capacity: 8 });
    this._archIndicatorMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.arch', geometry: this._archIndicatorGeo, material: this._archEmissiveMat, capacity: 8 });
    this._archTrimMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.arch', geometry: this._archTrimGeo, material: this._archEmissiveMat, capacity: 4 });
    this._archOuterTrimMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.arch', geometry: this._archOuterTrimGeo, material: this._archEmissiveMat, capacity: 4 });
    this._arches = [];
    for (let i = 0; i < 4; i++) {
      this._arches.push({
        x: -HALF_W - 50 + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 60,
        y: 0,
        z: -22,
      });
    }

    this._towerBaseGeo = new THREE.CylinderGeometry(16, 24, 110, 6);
    this._towerHubGeo = new THREE.CylinderGeometry(13, 13, 14, 6);
    this._towerHubGeo.rotateX(Math.PI / 2);
    this._towerBladeGeo = new THREE.BoxGeometry(40, 5, 1.8);
    this._towerVentGeo = new THREE.CylinderGeometry(14, 14, 3, 6);
    this._towerBaseMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.tower', geometry: this._towerBaseGeo, material: this._baseMat, capacity: 4 });
    this._towerHubMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.tower', geometry: this._towerHubGeo, material: this._baseMat, capacity: 4 });
    this._towerBladeMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.tower', geometry: this._towerBladeGeo, material: this._baseMat, capacity: 8 });
    this._towerVentMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.tower', geometry: this._towerVentGeo, material: this._emissiveMat, capacity: 4 });
    this._towers = [];
    for (let i = 0; i < 4; i++) {
      const flipped = i % 2 === 0;
      this._towers.push({
        x: -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        y: (flipped ? 1 : -1) * (145 + Math.random() * 25),
        z: -45 - Math.random() * 7,
        flipped,
        bladeRotation: 0,
      });
    }

    this._pipeBodyGeo = new THREE.CylinderGeometry(11, 11, 280, 6);
    this._pipeBodyGeo.rotateZ(Math.PI / 2);
    this._pipeClampGeo = new THREE.CylinderGeometry(15, 15, 16, 6);
    this._pipeClampGeo.rotateZ(Math.PI / 2);
    this._pipeSeamGeo = new THREE.CylinderGeometry(12.5, 12.5, 5, 6);
    this._pipeSeamGeo.rotateZ(Math.PI / 2);
    this._pipeBodyMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.pipe', geometry: this._pipeBodyGeo, material: this._baseMat, capacity: 4 });
    this._pipeClampMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.pipe', geometry: this._pipeClampGeo, material: this._baseMat, capacity: 8 });
    this._pipeSeamMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.pipe', geometry: this._pipeSeamGeo, material: this._emissiveMat, capacity: 8 });
    this._pipes = [];
    for (let i = 0; i < 4; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      this._pipes.push({
        x: -HALF_W - 100 + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        y: sign * (190 + Math.random() * 20),
        z: -55 - Math.random() * 7,
      });
    }

    this._spireBodyGeo = new THREE.CylinderGeometry(9, 38, 480, 6);
    this._spireCrownGeo = new THREE.CylinderGeometry(10, 10, 14, 6);
    this._spireBodyMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.spire', geometry: this._spireBodyGeo, material: this._baseMat, capacity: 3 });
    this._spireCrownMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.spire', geometry: this._spireCrownGeo, material: this._emissiveMat, capacity: 3 });
    this._spires = [];
    for (let i = 0; i < 3; i++) {
      const flipped = i % 2 === 0;
      this._spires.push({
        x: -HALF_W + i * (GAME_WIDTH / 2) + (Math.random() - 0.5) * 120,
        y: (flipped ? 1 : -1) * (180 + Math.random() * 40),
        z: -90,
        flipped,
      });
    }

    this._ringBodyGeo = new THREE.TorusGeometry(180, 7, 4, 12);
    this._ringBodyGeo.rotateY(Math.PI / 2);
    this._ringCoreGeo = new THREE.TorusGeometry(171, 1.2, 4, 12);
    this._ringCoreGeo.rotateY(Math.PI / 2);
    this._ringBodyMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.ring', geometry: this._ringBodyGeo, material: this._baseMat, capacity: 3 });
    this._ringCoreMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.ring', geometry: this._ringCoreGeo, material: this._emissiveMat, capacity: 3 });
    this._rings = [];
    for (let i = 0; i < 3; i++) {
      this._rings.push({
        x: -HALF_W + i * (GAME_WIDTH / 2) + (Math.random() - 0.5) * 120,
        y: (Math.random() - 0.5) * 90,
        z: -90,
        rotationY: 0,
      });
    }

    this._dustMatCyan = new THREE.MeshBasicMaterial({
      color: 0x33ffcc,
      transparent: true,
      opacity: 0.80,
    });
    this._dustMatBlue = new THREE.MeshBasicMaterial({
      color: 0x3366ff,
      transparent: true,
      opacity: 0.70,
    });
    this._dustGeoOcta = new THREE.OctahedronGeometry(1.2);
    this._dustGeoTetra = new THREE.TetrahedronGeometry(1.0);
    this._dustOctaCyanMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.dust', geometry: this._dustGeoOcta, material: this._dustMatCyan, capacity: 80 });
    this._dustOctaBlueMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.dust', geometry: this._dustGeoOcta, material: this._dustMatBlue, capacity: 80 });
    this._dustTetraCyanMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.dust', geometry: this._dustGeoTetra, material: this._dustMatCyan, capacity: 80 });
    this._dustTetraBlueMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.dust', geometry: this._dustGeoTetra, material: this._dustMatBlue, capacity: 80 });
    this._dust = [];
    for (let i = 0; i < 80; i++) {
      const z = -12 - Math.random() * 83;
      const speedMult = 0.15 + (1.0 - (Math.abs(z) - 12) / 83) * 1.15;
      this._dust.push({
        kind: Math.random() > 0.5 ? 'octa' : 'tetra',
        color: Math.random() > 0.5 ? 'cyan' : 'blue',
        x: (Math.random() - 0.5) * GAME_WIDTH * 1.5,
        y: (Math.random() - 0.5) * GAME_HEIGHT * 1.2,
        z,
        speedMult,
        rotationX: Math.random() * Math.PI,
        rotationY: Math.random() * Math.PI,
        rotationZ: Math.random() * Math.PI,
        rx: (Math.random() - 0.5) * 2.2,
        ry: (Math.random() - 0.5) * 2.2,
        rz: (Math.random() - 0.5) * 2.2,
      });
    }

    this._buildSectorLandmark();
  }

  update(dt: number): void {
    this._time += dt;
    this._nebulaMat.uniforms['uTime']!.value = this._time;

    this._updateArches(dt);
    this._updateTowers(dt);
    this._updatePipes(dt);
    this._updateSpires(dt);
    this._updateRings(dt);
    this._updateDust(dt);
    this._updateSectorLandmark(dt);
  }

  // Per-Sector signature landmark (M1, ADR 0029). One distinctive accent
  // structure per Chapter-1 Sector, scrolling atop the shared chapter
  // background so the five levels read as different places. outerHull = none.
  private _buildSectorLandmark(): void {
    const key = this._sectorConfig?.sectorKey;
    if (!key || key === 'outerHull') return;

    let bodyGeo: THREE.BufferGeometry;
    let accentGeo: THREE.BufferGeometry;
    let count: number;

    if (key === 'antennaField') {
      // Antenna Array — tall masts with a glowing tip; top-heavy placement.
      bodyGeo = new THREE.CylinderGeometry(3, 6, 170, 6);
      accentGeo = new THREE.SphereGeometry(7, 8, 6);
      count = 6;
      for (let i = 0; i < count; i++) {
        const x = -HALF_W + (i / count) * GAME_WIDTH * 1.4 + (Math.random() - 0.5) * 60;
        this._sectorLandmarks.push({ x, y: 120 + Math.random() * 80, z: -64, rot: 0, ax: 0, ay: 85 });
      }
    } else if (key === 'transitSpine') {
      // Transit Truss — horizontal beams with emissive joint struts; broken alternating.
      bodyGeo = new THREE.BoxGeometry(150, 10, 10);
      accentGeo = new THREE.BoxGeometry(6, 26, 12);
      count = 5;
      for (let i = 0; i < count; i++) {
        const x = -HALF_W + (i / count) * GAME_WIDTH * 1.4 + (Math.random() - 0.5) * 60;
        this._sectorLandmarks.push({ x, y: (i % 2 === 0 ? 1 : -1) * (90 + Math.random() * 30), z: -64, rot: 0, ax: 0, ay: 0 });
      }
    } else if (key === 'cargoLane') {
      // Cargo Container clusters — crates with an emissive band; center-corridor.
      bodyGeo = new THREE.BoxGeometry(46, 30, 30);
      accentGeo = new THREE.BoxGeometry(47, 5, 31);
      count = 6;
      for (let i = 0; i < count; i++) {
        const x = -HALF_W + (i / count) * GAME_WIDTH * 1.4 + (Math.random() - 0.5) * 60;
        this._sectorLandmarks.push({ x, y: (Math.random() - 0.5) * 80, z: -64, rot: 0, ax: 0, ay: 0 });
      }
    } else if (key === 'coreGate') {
      // Core Gate — massive pillars with a portal-ring crown; narrowing/central.
      bodyGeo = new THREE.CylinderGeometry(16, 20, 220, 5);
      accentGeo = new THREE.TorusGeometry(20, 3, 4, 8);
      count = 3;
      for (let i = 0; i < count; i++) {
        const x = -HALF_W + (i / count) * GAME_WIDTH * 1.4 + (Math.random() - 0.5) * 60;
        this._sectorLandmarks.push({ x, y: 0, z: -60, rot: 0, ax: 0, ay: 110 });
      }
    } else {
      return;
    }

    const detail = `background.sector.${key}`;
    this._sectorLandmarkBody = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail, geometry: bodyGeo, material: this._baseMat, capacity: count, ownedResources: [bodyGeo] });
    this._sectorLandmarkAccent = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail, geometry: accentGeo, material: this._emissiveMat, capacity: count, ownedResources: [accentGeo] });
  }

  private _updateSectorLandmark(dt: number): void {
    if (!this._sectorLandmarkBody || !this._sectorLandmarkAccent) return;
    const dx = this.baseSpeed * 0.55 * dt;
    this._sectorLandmarkBody.beginFrame();
    this._sectorLandmarkAccent.beginFrame();
    for (const lm of this._sectorLandmarks) {
      lm.x -= dx;
      if (lm.x < -HALF_W - 180) lm.x = HALF_W + 180 + Math.random() * 120;
      this._rotationEuler.set(0, 0, lm.rot);
      this._sectorLandmarkBody.push({ position: [lm.x, lm.y, lm.z], rotation: this._rotationEuler });
      this._sectorLandmarkAccent.push({ position: [lm.x + lm.ax, lm.y + lm.ay, lm.z], rotation: this._rotationEuler });
    }
    this._sectorLandmarkBody.endFrame();
    this._sectorLandmarkAccent.endFrame();
  }

  private _updateArches(dt: number): void {
    const dx = this.baseSpeed * 1.25 * dt;
    this._archRingMesh.beginFrame();
    this._archTrimMesh.beginFrame();
    this._archOuterTrimMesh.beginFrame();
    this._archPanelMesh.beginFrame();
    this._archIndicatorMesh.beginFrame();

    for (let i = 0; i < this._arches.length; i++) {
      const arch = this._arches[i]!;
      arch.x -= dx;
      if (arch.x < -HALF_W - 130) {
        arch.x = HALF_W + 130 + Math.random() * 120;
      }

      this._rotationEuler.set(0, 0, 0);
      this._archRingMesh.push({ position: [arch.x, arch.y, arch.z], rotation: this._rotationEuler });
      this._archTrimMesh.push({ position: [arch.x, arch.y, arch.z], rotation: this._rotationEuler });
      this._archOuterTrimMesh.push({ position: [arch.x, arch.y, arch.z], rotation: this._rotationEuler });

      this._archPanelMesh.push({ position: [arch.x, arch.y + 235, arch.z], rotation: this._rotationEuler });
      this._archPanelMesh.push({ position: [arch.x, arch.y - 235, arch.z], rotation: this._rotationEuler });
      this._archIndicatorMesh.push({ position: [arch.x, arch.y + 205, arch.z], rotation: this._rotationEuler });
      this._archIndicatorMesh.push({ position: [arch.x, arch.y - 205, arch.z], rotation: this._rotationEuler });
    }
    this._archRingMesh.endFrame();
    this._archTrimMesh.endFrame();
    this._archOuterTrimMesh.endFrame();
    this._archPanelMesh.endFrame();
    this._archIndicatorMesh.endFrame();
  }

  private _updateTowers(dt: number): void {
    const dx = this.baseSpeed * 0.70 * dt;
    this._towerBaseMesh.beginFrame();
    this._towerHubMesh.beginFrame();
    this._towerVentMesh.beginFrame();
    this._towerBladeMesh.beginFrame();

    for (let i = 0; i < this._towers.length; i++) {
      const tower = this._towers[i]!;
      tower.x -= dx;
      tower.bladeRotation += 3.5 * dt;

      if (tower.x < -HALF_W - 130) {
        tower.x = HALF_W + 130 + Math.random() * 120;
        tower.flipped = Math.random() > 0.5;
        const sign = tower.flipped ? 1 : -1;
        tower.y = sign * (145 + Math.random() * 25);
        tower.z = -45 - Math.random() * 7;
      }

      const rotationZ = tower.flipped ? Math.PI : 0;
      const yDir = tower.flipped ? -1 : 1;
      this._rotationEuler.set(0, 0, rotationZ);
      this._towerBaseMesh.push({ position: [tower.x, tower.y, tower.z], rotation: this._rotationEuler });
      this._towerHubMesh.push({ position: [tower.x, tower.y + (10 * yDir), tower.z + 5], rotation: this._rotationEuler });
      this._towerVentMesh.push({ position: [tower.x, tower.y + (56 * yDir), tower.z], rotation: this._rotationEuler });

      this._rotationEuler.set(0, 0, rotationZ + tower.bladeRotation);
      this._towerBladeMesh.push({ position: [tower.x, tower.y + (10 * yDir), tower.z + 5], rotation: this._rotationEuler });
      this._rotationEuler.set(0, 0, rotationZ + tower.bladeRotation + Math.PI / 2);
      this._towerBladeMesh.push({ position: [tower.x, tower.y + (10 * yDir), tower.z + 5], rotation: this._rotationEuler });
    }
    this._towerBaseMesh.endFrame();
    this._towerHubMesh.endFrame();
    this._towerVentMesh.endFrame();
    this._towerBladeMesh.endFrame();
  }

  private _updatePipes(dt: number): void {
    const dx = this.baseSpeed * 0.65 * dt;
    this._pipeBodyMesh.beginFrame();
    this._pipeClampMesh.beginFrame();
    this._pipeSeamMesh.beginFrame();

    for (let i = 0; i < this._pipes.length; i++) {
      const pipe = this._pipes[i]!;
      pipe.x -= dx;

      if (pipe.x < -HALF_W - 130) {
        pipe.x = HALF_W + 130 + Math.random() * 120;
        const sign = Math.random() > 0.5 ? 1 : -1;
        pipe.y = sign * (190 + Math.random() * 20);
        pipe.z = -55 - Math.random() * 7;
      }

      this._rotationEuler.set(0, 0, 0);
      this._pipeBodyMesh.push({ position: [pipe.x, pipe.y, pipe.z], rotation: this._rotationEuler });
      this._pipeClampMesh.push({ position: [pipe.x - 75, pipe.y, pipe.z], rotation: this._rotationEuler });
      this._pipeClampMesh.push({ position: [pipe.x + 75, pipe.y, pipe.z], rotation: this._rotationEuler });
      this._pipeSeamMesh.push({ position: [pipe.x - 75, pipe.y, pipe.z], rotation: this._rotationEuler });
      this._pipeSeamMesh.push({ position: [pipe.x + 75, pipe.y, pipe.z], rotation: this._rotationEuler });
    }
    this._pipeBodyMesh.endFrame();
    this._pipeClampMesh.endFrame();
    this._pipeSeamMesh.endFrame();
  }

  private _updateSpires(dt: number): void {
    const dx = this.baseSpeed * 0.25 * dt;
    this._spireBodyMesh.beginFrame();
    this._spireCrownMesh.beginFrame();

    for (let i = 0; i < this._spires.length; i++) {
      const spire = this._spires[i]!;
      spire.x -= dx;

      if (spire.x < -HALF_W - 130) {
        spire.x = HALF_W + 130 + Math.random() * 120;
        spire.flipped = Math.random() > 0.5;
        const sign = spire.flipped ? 1 : -1;
        spire.y = sign * (180 + Math.random() * 40);
      }

      const rotationZ = spire.flipped ? Math.PI : 0;
      const yDir = spire.flipped ? -1 : 1;
      this._rotationEuler.set(0, 0, rotationZ);
      this._spireBodyMesh.push({ position: [spire.x, spire.y, spire.z], rotation: this._rotationEuler });
      this._spireCrownMesh.push({ position: [spire.x, spire.y + (240 * yDir), spire.z], rotation: this._rotationEuler });
    }
    this._spireBodyMesh.endFrame();
    this._spireCrownMesh.endFrame();
  }

  private _updateRings(dt: number): void {
    const dx = this.baseSpeed * 0.20 * dt;
    this._ringBodyMesh.beginFrame();
    this._ringCoreMesh.beginFrame();

    for (let i = 0; i < this._rings.length; i++) {
      const ring = this._rings[i]!;
      ring.x -= dx;
      ring.rotationY += 0.22 * dt;

      if (ring.x < -HALF_W - 130) {
        ring.x = HALF_W + 130 + Math.random() * 120;
        ring.y = (Math.random() - 0.5) * 90;
      }

      this._rotationEuler.set(0, ring.rotationY, 0);
      this._ringBodyMesh.push({ position: [ring.x, ring.y, ring.z], rotation: this._rotationEuler });
      this._ringCoreMesh.push({ position: [ring.x, ring.y, ring.z], rotation: this._rotationEuler });
    }
    this._ringBodyMesh.endFrame();
    this._ringCoreMesh.endFrame();
  }

  private _updateDust(dt: number): void {
    const counts = {
      octaCyan: 0,
      octaBlue: 0,
      tetraCyan: 0,
      tetraBlue: 0,
    };
    this._dustOctaCyanMesh.beginFrame();
    this._dustOctaBlueMesh.beginFrame();
    this._dustTetraCyanMesh.beginFrame();
    this._dustTetraBlueMesh.beginFrame();

    for (const dust of this._dust) {
      dust.x -= this.baseSpeed * dust.speedMult * dt;
      dust.rotationX += dust.rx * dt;
      dust.rotationY += dust.ry * dt;
      dust.rotationZ += dust.rz * dt;

      if (dust.x < -HALF_W - 40) {
        dust.x = HALF_W + 40 + Math.random() * 40;
        dust.y = (Math.random() - 0.5) * GAME_HEIGHT * 1.2;
      }

      this._rotationEuler.set(dust.rotationX, dust.rotationY, dust.rotationZ);
      if (dust.kind === 'octa' && dust.color === 'cyan') {
        counts.octaCyan++;
        this._dustOctaCyanMesh.push({ position: [dust.x, dust.y, dust.z], rotation: this._rotationEuler });
      } else if (dust.kind === 'octa' && dust.color === 'blue') {
        counts.octaBlue++;
        this._dustOctaBlueMesh.push({ position: [dust.x, dust.y, dust.z], rotation: this._rotationEuler });
      } else if (dust.kind === 'tetra' && dust.color === 'cyan') {
        counts.tetraCyan++;
        this._dustTetraCyanMesh.push({ position: [dust.x, dust.y, dust.z], rotation: this._rotationEuler });
      } else {
        counts.tetraBlue++;
        this._dustTetraBlueMesh.push({ position: [dust.x, dust.y, dust.z], rotation: this._rotationEuler });
      }
    }
    this._dustOctaCyanMesh.endFrame();
    this._dustOctaBlueMesh.endFrame();
    this._dustTetraCyanMesh.endFrame();
    this._dustTetraBlueMesh.endFrame();
  }

  destroy(): void {
    if (this._nebulaMesh) {
      this._scene.remove(this._nebulaMesh);
      this._nebulaMesh.geometry.dispose();
      (this._nebulaMesh.material as THREE.Material).dispose();
      this._nebulaMesh = null;
    }
    this._instancedLayer.destroy();

    this._archRingGeo.dispose();
    this._archPanelGeo.dispose();
    this._archIndicatorGeo.dispose();
    this._archTrimGeo.dispose();
    this._archOuterTrimGeo.dispose();
    this._towerBaseGeo.dispose();
    this._towerHubGeo.dispose();
    this._towerBladeGeo.dispose();
    this._towerVentGeo.dispose();
    this._pipeBodyGeo.dispose();
    this._pipeClampGeo.dispose();
    this._pipeSeamGeo.dispose();
    this._spireBodyGeo.dispose();
    this._spireCrownGeo.dispose();
    this._ringBodyGeo.dispose();
    this._ringCoreGeo.dispose();
    this._dustGeoOcta.dispose();
    this._dustGeoTetra.dispose();

    this._baseMat.dispose();
    this._emissiveMat.dispose();
    this._archBaseMat.dispose();
    this._archEmissiveMat.dispose();
    this._dustMatCyan.dispose();
    this._dustMatBlue.dispose();
  }
}
