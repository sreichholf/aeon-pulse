import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';
import { InstancedScrollLayer, type InstancedScrollMeshLayer } from './InstancedScrollLayer.ts';
import type { SectorBackgroundConfig } from './sectors/Sectors.ts';

const HALF_W = GAME_WIDTH / 2;

const FRAG = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float distY = abs(uv.y - 0.5) * 2.0;
    vec3 col = mix(vec3(0.01, 0.02, 0.03), vec3(0.05, 0.07, 0.11), 1.0 - distY);
    col *= mix(1.0, 0.20, pow(distY, 3.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface ColumnEntry {
  x: number;
  y: number;
  z: number;
  speedMult: number;
}

interface TurbineEntry {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  bladeRotation: number;
}

interface PipelineEntry {
  x: number;
  y: number;
  z: number;
  speedMult: number;
}

interface GearEntry {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  gearSpeed: number;
  rotation: number;
}

interface SparkEntry {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  rx: number;
  ry: number;
  rz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  phase: number;
  flickerSpeed: number;
  baseScale: number;
  isTeal: boolean;
  isOct: boolean;
}

export class Background2 implements IBackground {
  private _scene: IScene;
  public baseSpeed: number;
  private _time: number;

  private _bgMesh: THREE.Mesh | null;
  private _mat: THREE.ShaderMaterial | null;

  private _baseMat: THREE.MeshPhongMaterial;
  private _tealGlow: THREE.MeshBasicMaterial;
  private _amberGlow: THREE.MeshBasicMaterial;

  private _columnEntries: ColumnEntry[];
  private _turbineEntries: TurbineEntry[];
  private _pipelineEntries: PipelineEntry[];
  private _gearEntries: GearEntry[];
  private _sparkEntries: SparkEntry[];

  private _columnBodyMesh: InstancedScrollMeshLayer;
  private _columnRibMesh: InstancedScrollMeshLayer;
  private _columnLightMesh: InstancedScrollMeshLayer;
  private _turbineChassisMesh: InstancedScrollMeshLayer;
  private _turbineStrutMesh: InstancedScrollMeshLayer;
  private _turbineCoreMesh: InstancedScrollMeshLayer;
  private _turbineBladeMesh: InstancedScrollMeshLayer;
  private _pipelinePipeMesh: InstancedScrollMeshLayer;
  private _pipelineClampMesh: InstancedScrollMeshLayer;
  private _pipelineSeamMesh: InstancedScrollMeshLayer;
  private _gearSpindleMesh: InstancedScrollMeshLayer;
  private _gearBodyMesh: InstancedScrollMeshLayer;
  private _sparkTealOctMesh: InstancedScrollMeshLayer;
  private _sparkTealTetMesh: InstancedScrollMeshLayer;
  private _sparkAmberOctMesh: InstancedScrollMeshLayer;
  private _sparkAmberTetMesh: InstancedScrollMeshLayer;

  private _columnBodyGeo: THREE.BoxGeometry;
  private _columnRibGeo: THREE.BoxGeometry;
  private _columnLightGeo: THREE.BoxGeometry;
  private _turbineChassisGeo: THREE.TorusGeometry;
  private _turbineStrutGeo: THREE.BoxGeometry;
  private _turbineCoreGeo: THREE.CylinderGeometry;
  private _turbineBladeGeo: THREE.BoxGeometry;
  private _pipelinePipeGeo: THREE.CylinderGeometry;
  private _pipelineClampGeo: THREE.CylinderGeometry;
  private _pipelineSeamGeo: THREE.CylinderGeometry;
  private _gearSpindleGeo: THREE.CylinderGeometry;
  private _gearBodyGeo: THREE.BufferGeometry;
  private _sparkGeoOct: THREE.OctahedronGeometry;
  private _sparkGeoTet: THREE.TetrahedronGeometry;
  private _instancedLayer: InstancedScrollLayer;

  private readonly _sectorConfig?: SectorBackgroundConfig;

  private _sectorLandmarkBody: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarkAccent: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarkAux: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarks: Array<{ x: number; y: number; z: number; rot: number; phase: number; speedMult: number }> = [];

  constructor(scene: IScene, baseSpeed: number = 120, sectorConfig?: SectorBackgroundConfig) {
    this._scene = scene;
    this.baseSpeed = baseSpeed;
    this._sectorConfig = sectorConfig;
    this._time = 0;
    this._instancedLayer = new InstancedScrollLayer(scene);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: STANDARD_VERT,
      fragmentShader: FRAG,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(GAME_WIDTH, GAME_HEIGHT);
    this._bgMesh = new THREE.Mesh(geo, mat);
    markRenderCategory(this._bgMesh, RenderCategory.BACKGROUND, 'background.backdrop');
    this._bgMesh.position.z = -100;
    this._bgMesh.scale.set(1.4, 1.4, 1.0);
    scene.add(this._bgMesh);
    this._mat = mat;

    this._baseMat = new THREE.MeshPhongMaterial({
      color: 0x2d323f,
      specular: 0x556688,
      shininess: 65,
      flatShading: true,
    });

    this._tealGlow = new THREE.MeshBasicMaterial({
      color: 0x00d5ff,
      transparent: true,
      opacity: 0.90,
    });

    this._amberGlow = new THREE.MeshBasicMaterial({
      color: 0xff7700,
      transparent: true,
      opacity: 0.90,
    });

    this._columnEntries = [];
    this._turbineEntries = [];
    this._pipelineEntries = [];
    this._gearEntries = [];
    this._sparkEntries = [];

    this._columnBodyGeo = new THREE.BoxGeometry(36, 540, 24);
    this._columnRibGeo = new THREE.BoxGeometry(8, 180, 26);
    this._columnLightGeo = new THREE.BoxGeometry(4, 16, 26.2);
    this._turbineChassisGeo = new THREE.TorusGeometry(36, 6, 6, 12);
    this._turbineStrutGeo = new THREE.BoxGeometry(6, 90, 8);
    this._turbineCoreGeo = new THREE.CylinderGeometry(16, 16, 12, 8);
    this._turbineCoreGeo.rotateX(Math.PI / 2);
    this._turbineBladeGeo = new THREE.BoxGeometry(26, 4, 1.5);
    this._pipelinePipeGeo = new THREE.CylinderGeometry(8, 8, 300, 8);
    this._pipelinePipeGeo.rotateZ(Math.PI / 2);
    this._pipelineClampGeo = new THREE.CylinderGeometry(11, 11, 14, 8);
    this._pipelineClampGeo.rotateZ(Math.PI / 2);
    this._pipelineSeamGeo = new THREE.CylinderGeometry(9, 9, 3, 8);
    this._pipelineSeamGeo.rotateZ(Math.PI / 2);
    this._gearSpindleGeo = new THREE.CylinderGeometry(6, 6, 9, 8);
    this._gearSpindleGeo.rotateX(Math.PI / 2);
    this._gearBodyGeo = this._buildGearBodyGeometry();
    this._sparkGeoOct = new THREE.OctahedronGeometry(1.4);
    this._sparkGeoTet = new THREE.TetrahedronGeometry(1.1);

    for (let i = 0; i < 6; i++) {
      this._columnEntries.push({
        x: -HALF_W - 50 + i * (GAME_WIDTH / 4) + (Math.random() - 0.5) * 60,
        y: 0,
        z: -45,
        speedMult: 0.75,
      });
    }

    for (let i = 0; i < 4; i++) {
      const ySign = i % 2 === 0 ? 1 : -1;
      this._turbineEntries.push({
        x: -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        y: ySign * (110 + Math.random() * 30),
        z: -60,
        speedMult: 0.60,
        bladeRotation: 0,
      });
    }

    for (let i = 0; i < 4; i++) {
      const ySign = i % 2 === 0 ? 1 : -1;
      this._pipelineEntries.push({
        x: -HALF_W - 100 + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        y: ySign * (180 + Math.random() * 20),
        z: -65,
        speedMult: 0.55,
      });
    }

    for (let i = 0; i < 4; i++) {
      const yOffset = (i % 2 === 0 ? 1 : -1) * (50 + Math.random() * 40);
      this._gearEntries.push({
        x: -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 120,
        y: yOffset,
        z: -90,
        speedMult: 0.25,
        gearSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.4),
        rotation: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < 60; i++) {
      const isTeal = Math.random() > 0.5;
      const isOct = Math.random() > 0.5;
      const zDepth = -12 - Math.random() * 83;
      const speedMult = 0.15 + (1.0 - (Math.abs(zDepth) - 12) / 83) * 1.15;
      this._sparkEntries.push({
        x: (Math.random() - 0.5) * GAME_WIDTH * 1.5,
        y: (Math.random() - 0.5) * GAME_HEIGHT * 1.2,
        z: zDepth,
        speedMult,
        rx: (Math.random() - 0.5) * 2.5,
        ry: (Math.random() - 0.5) * 2.5,
        rz: (Math.random() - 0.5) * 2.5,
        rotX: Math.random() * Math.PI,
        rotY: Math.random() * Math.PI,
        rotZ: Math.random() * Math.PI,
        phase: Math.random() * Math.PI * 2,
        flickerSpeed: 5 + Math.random() * 8,
        baseScale: 0.85 + Math.random() * 0.4,
        isTeal,
        isOct,
      });
    }

    this._columnBodyMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.column', geometry: this._columnBodyGeo, material: this._baseMat, capacity: this._columnEntries.length });
    this._columnRibMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.column', geometry: this._columnRibGeo, material: this._baseMat, capacity: this._columnEntries.length * 2 });
    this._columnLightMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.column', geometry: this._columnLightGeo, material: this._tealGlow, capacity: this._columnEntries.length * 6 });
    this._turbineChassisMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.turbine', geometry: this._turbineChassisGeo, material: this._baseMat, capacity: this._turbineEntries.length });
    this._turbineStrutMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.turbine', geometry: this._turbineStrutGeo, material: this._baseMat, capacity: this._turbineEntries.length * 2 });
    this._turbineCoreMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.turbine', geometry: this._turbineCoreGeo, material: this._amberGlow, capacity: this._turbineEntries.length });
    this._turbineBladeMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.turbine', geometry: this._turbineBladeGeo, material: this._baseMat, capacity: this._turbineEntries.length * 6 });
    this._pipelinePipeMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.pipe', geometry: this._pipelinePipeGeo, material: this._baseMat, capacity: this._pipelineEntries.length });
    this._pipelineClampMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.pipe', geometry: this._pipelineClampGeo, material: this._baseMat, capacity: this._pipelineEntries.length * 2 });
    this._pipelineSeamMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.pipe', geometry: this._pipelineSeamGeo, material: this._tealGlow, capacity: this._pipelineEntries.length * 2 });
    this._gearSpindleMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.gear', geometry: this._gearSpindleGeo, material: this._amberGlow, capacity: this._gearEntries.length });
    this._gearBodyMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.gear', geometry: this._gearBodyGeo, material: this._baseMat, capacity: this._gearEntries.length });

    const tealOctCount = this._sparkEntries.filter((spark) => spark.isTeal && spark.isOct).length;
    const tealTetCount = this._sparkEntries.filter((spark) => spark.isTeal && !spark.isOct).length;
    const amberOctCount = this._sparkEntries.filter((spark) => !spark.isTeal && spark.isOct).length;
    const amberTetCount = this._sparkEntries.filter((spark) => !spark.isTeal && !spark.isOct).length;

    this._sparkTealOctMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.spark', geometry: this._sparkGeoOct, material: this._tealGlow, capacity: tealOctCount });
    this._sparkTealTetMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.spark', geometry: this._sparkGeoTet, material: this._tealGlow, capacity: tealTetCount });
    this._sparkAmberOctMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.spark', geometry: this._sparkGeoOct, material: this._amberGlow, capacity: amberOctCount });
    this._sparkAmberTetMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.spark', geometry: this._sparkGeoTet, material: this._amberGlow, capacity: amberTetCount });

    this._buildSectorLandmark();
    this.update(0);
  }

  private _wrapX(currentX: number, wrapPad: number): number {
    if (currentX >= -HALF_W - wrapPad) return currentX;
    return currentX + GAME_WIDTH + wrapPad * 2;
  }
  private _buildSectorLandmark(): void {
    const key = this._sectorConfig?.sectorKey;
    if (!key) return;

    let bodyGeo: THREE.BufferGeometry;
    let accentGeo: THREE.BufferGeometry;
    let auxGeo: THREE.BufferGeometry | null = null;
    let accentMaterial: THREE.Material = this._tealGlow;
    let auxMaterial: THREE.Material = this._baseMat;
    let accentCapacity = 0;
    let auxCapacity = 0;

    if (key === 'intakeManifold') {
      bodyGeo = new THREE.TorusGeometry(40, 6, 6, 12);
      bodyGeo.rotateY(Math.PI / 2);
      accentGeo = new THREE.BoxGeometry(12, 78, 16);
      auxGeo = new THREE.BoxGeometry(84, 8, 16);
      accentMaterial = this._tealGlow;
      auxMaterial = this._baseMat;
      accentCapacity = 4;
      auxCapacity = 8;
      for (let i = 0; i < 4; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 320 + (Math.random() - 0.5) * 70,
          y: (i % 2 === 0 ? 1 : -1) * (120 + Math.random() * 22),
          z: -68,
          rot: 0,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.52,
        });
      }
    } else if (key === 'conveyorGallery') {
      bodyGeo = new THREE.BoxGeometry(82, 12, 24);
      accentGeo = new THREE.CylinderGeometry(7, 7, 24, 10);
      accentGeo.rotateZ(Math.PI / 2);
      auxGeo = new THREE.BoxGeometry(62, 5, 26);
      accentMaterial = this._baseMat;
      auxMaterial = this._tealGlow;
      accentCapacity = 10;
      auxCapacity = 5;
      for (let i = 0; i < 5; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 250 + (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 90,
          z: -66,
          rot: 0,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.6,
        });
      }
    } else if (key === 'pressHall') {
      bodyGeo = new THREE.BoxGeometry(32, 150, 24);
      accentGeo = new THREE.BoxGeometry(52, 18, 28);
      auxGeo = new THREE.BoxGeometry(44, 10, 28);
      accentMaterial = this._amberGlow;
      auxMaterial = this._baseMat;
      accentCapacity = 4;
      auxCapacity = 4;
      for (let i = 0; i < 4; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 320 + (Math.random() - 0.5) * 60,
          y: 0,
          z: -74,
          rot: 0,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.48,
        });
      }
    } else if (key === 'coolantRun') {
      bodyGeo = new THREE.CylinderGeometry(9, 9, 160, 8);
      bodyGeo.rotateZ(Math.PI / 2);
      accentGeo = new THREE.CylinderGeometry(12, 12, 12, 8);
      accentGeo.rotateZ(Math.PI / 2);
      auxGeo = new THREE.BoxGeometry(24, 8, 26);
      accentMaterial = this._baseMat;
      auxMaterial = this._tealGlow;
      accentCapacity = 10;
      auxCapacity = 5;
      for (let i = 0; i < 5; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 250 + (Math.random() - 0.5) * 60,
          y: (i % 2 === 0 ? 1 : -1) * (150 + Math.random() * 26),
          z: -68,
          rot: 0,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.54,
        });
      }
    } else if (key === 'smelterCore') {
      bodyGeo = new THREE.BoxGeometry(46, 190, 30);
      accentGeo = new THREE.BoxGeometry(16, 54, 31);
      auxGeo = new THREE.TorusGeometry(16, 2.2, 6, 10);
      auxGeo.rotateY(Math.PI / 2);
      accentMaterial = this._amberGlow;
      auxMaterial = this._amberGlow;
      accentCapacity = 10;
      auxCapacity = 5;
      for (let i = 0; i < 5; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 235 + (Math.random() - 0.5) * 50,
          y: (i % 2 === 0 ? 1 : -1) * (30 + Math.random() * 16),
          z: -76,
          rot: 0,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.56,
        });
      }
    } else {
      return;
    }

    const detail = `background.sector.${key}`;
    this._sectorLandmarkBody = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail,
      geometry: bodyGeo,
      material: this._baseMat,
      capacity: this._sectorLandmarks.length,
      ownedResources: [bodyGeo],
    });
    this._sectorLandmarkAccent = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail,
      geometry: accentGeo,
      material: accentMaterial,
      capacity: accentCapacity,
      ownedResources: [accentGeo],
    });
    if (auxGeo) {
      this._sectorLandmarkAux = this._instancedLayer.createLayer({
        renderCategory: RenderCategory.BACKGROUND,
        detail,
        geometry: auxGeo,
        material: auxMaterial,
        capacity: auxCapacity,
        ownedResources: [auxGeo],
      });
    }
  }

  private _updateSectorLandmark(dt: number): void {
    if (!this._sectorLandmarkBody || !this._sectorLandmarkAccent) return;
    const key = this._sectorConfig?.sectorKey;
    if (!key) return;

    this._sectorLandmarkBody.beginFrame();
    this._sectorLandmarkAccent.beginFrame();
    this._sectorLandmarkAux?.beginFrame();

    for (const lm of this._sectorLandmarks) {
      lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 220);
      lm.rot += dt * 0.2;
      const bodyRot = new THREE.Euler(0, key === 'intakeManifold' ? lm.rot * 0.25 : 0, 0);
      this._sectorLandmarkBody.push({ position: [lm.x, lm.y, lm.z], rotation: bodyRot });

      if (key === 'intakeManifold') {
        this._sectorLandmarkAccent.push({ position: [lm.x, lm.y, lm.z], rotation: new THREE.Euler(0, 0, 0) });
        this._sectorLandmarkAux?.push({ position: [lm.x - 34, lm.y, lm.z], rotation: new THREE.Euler(0, 0, 0) });
        this._sectorLandmarkAux?.push({ position: [lm.x + 34, lm.y, lm.z], rotation: new THREE.Euler(0, 0, 0) });
      } else if (key === 'conveyorGallery') {
        const rollerRot = new THREE.Euler(0, 0, this._time * 3.4 + lm.phase);
        this._sectorLandmarkAccent.push({ position: [lm.x - 24, lm.y, lm.z], rotation: rollerRot });
        this._sectorLandmarkAccent.push({ position: [lm.x + 24, lm.y, lm.z], rotation: rollerRot });
        this._sectorLandmarkAux?.push({ position: [lm.x, lm.y + 8, lm.z], rotation: new THREE.Euler(0, 0, 0) });
      } else if (key === 'pressHall') {
        const headOffset = Math.sin(this._time * 1.9 + lm.phase) * 24;
        this._sectorLandmarkAccent.push({ position: [lm.x, lm.y + 70 - headOffset, lm.z], rotation: new THREE.Euler(0, 0, 0) });
        this._sectorLandmarkAux?.push({ position: [lm.x, lm.y - 72, lm.z], rotation: new THREE.Euler(0, 0, 0) });
      } else if (key === 'coolantRun') {
        this._sectorLandmarkAccent.push({ position: [lm.x - 46, lm.y, lm.z], rotation: new THREE.Euler(0, 0, 0) });
        this._sectorLandmarkAccent.push({ position: [lm.x + 46, lm.y, lm.z], rotation: new THREE.Euler(0, 0, 0) });
        const pulse = 0.9 + 0.25 * Math.sin(this._time * 2.2 + lm.phase);
        this._sectorLandmarkAux?.push({ position: [lm.x, lm.y, lm.z], rotation: new THREE.Euler(0, 0, 0), scale: [pulse, 1, pulse] });
      } else if (key === 'smelterCore') {
        this._sectorLandmarkAccent.push({ position: [lm.x - 10, lm.y + 44, lm.z], rotation: new THREE.Euler(0, 0, 0) });
        this._sectorLandmarkAccent.push({ position: [lm.x + 10, lm.y - 14, lm.z], rotation: new THREE.Euler(0, 0, 0) });
        const crownRot = new THREE.Euler(0, this._time * 0.6 + lm.phase * 0.15, 0);
        this._sectorLandmarkAux?.push({ position: [lm.x, lm.y + 92, lm.z], rotation: crownRot });
      }
    }

    this._sectorLandmarkBody.endFrame();
    this._sectorLandmarkAccent.endFrame();
    this._sectorLandmarkAux?.endFrame();
  }

  private _buildGearBodyGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];

    const hub = new THREE.CylinderGeometry(14, 14, 8, 8);
    hub.rotateX(Math.PI / 2);
    parts.push(hub);

    parts.push(new THREE.TorusGeometry(48, 5, 6, 16));

    const spokeVertical = new THREE.BoxGeometry(4, 96, 4);
    parts.push(spokeVertical);

    const spokeHorizontal = new THREE.BoxGeometry(4, 96, 4);
    spokeHorizontal.rotateZ(Math.PI / 2);
    parts.push(spokeHorizontal);

    for (let i = 0; i < 12; i++) {
      const theta = (i * Math.PI) / 6;
      const tooth = new THREE.BoxGeometry(8, 6, 6);
      tooth.rotateZ(theta);
      tooth.translate(Math.cos(theta) * 52, Math.sin(theta) * 52, 0);
      parts.push(tooth);
    }

    const merged = mergeGeometries(parts);
    if (!merged) throw new Error('Failed to merge Background2 gear geometry.');
    for (const part of parts) part.dispose();
    return merged;
  }

  update(dt: number): void {
    this._time += dt;
    if (this._mat) this._mat.uniforms['uTime']!.value = this._time;
    this._columnBodyMesh.beginFrame();
    this._columnRibMesh.beginFrame();
    this._columnLightMesh.beginFrame();
    this._turbineChassisMesh.beginFrame();
    this._turbineStrutMesh.beginFrame();
    this._turbineCoreMesh.beginFrame();
    this._turbineBladeMesh.beginFrame();
    this._pipelinePipeMesh.beginFrame();
    this._pipelineClampMesh.beginFrame();
    this._pipelineSeamMesh.beginFrame();
    this._gearSpindleMesh.beginFrame();
    this._gearBodyMesh.beginFrame();
    this._sparkTealOctMesh.beginFrame();
    this._sparkTealTetMesh.beginFrame();
    this._sparkAmberOctMesh.beginFrame();
    this._sparkAmberTetMesh.beginFrame();

    let columnBodyIndex = 0;
    let columnRibIndex = 0;
    let columnLightIndex = 0;
    let turbineChassisIndex = 0;
    let turbineStrutIndex = 0;
    let turbineCoreIndex = 0;
    let turbineBladeIndex = 0;
    let pipelinePipeIndex = 0;
    let pipelineClampIndex = 0;
    let pipelineSeamIndex = 0;
    let gearSpindleIndex = 0;
    let gearBodyIndex = 0;
    let sparkTealOctIndex = 0;
    let sparkTealTetIndex = 0;
    let sparkAmberOctIndex = 0;
    let sparkAmberTetIndex = 0;

    for (const column of this._columnEntries) {
      column.x = this._wrapX(column.x - this.baseSpeed * column.speedMult * dt, 180);
      this._columnBodyMesh.push({ position: [column.x, column.y, column.z], rotation: new THREE.Euler(0, 0, 0) });
      columnBodyIndex++;

      for (const offsetX of [-16, 16]) {
        this._columnRibMesh.push({ position: [column.x + offsetX, column.y, column.z], rotation: new THREE.Euler(0, 0, 0) });
        columnRibIndex++;
      }
      for (const offsetY of [0, 120, -120]) {
        for (const offsetX of [-18, 18]) {
          this._columnLightMesh.push({ position: [column.x + offsetX, column.y + offsetY, column.z], rotation: new THREE.Euler(0, 0, 0) });
          columnLightIndex++;
        }
      }
    }

    for (const turbine of this._turbineEntries) {
      turbine.x = this._wrapX(turbine.x - this.baseSpeed * turbine.speedMult * dt, 180);
      if (turbine.x > HALF_W + 180) {
        const ySign = Math.random() > 0.5 ? 1 : -1;
        turbine.y = ySign * (110 + Math.random() * 30);
      }
      turbine.bladeRotation += 8.0 * dt;

      const center = [turbine.x, turbine.y, turbine.z] as THREE.Vector3Tuple;
      this._turbineChassisMesh.push({ position: center, rotation: new THREE.Euler(0, 0, 0) });
      turbineChassisIndex++;
      this._turbineStrutMesh.push({ position: center, rotation: new THREE.Euler(0, 0, 0) });
      turbineStrutIndex++;
      this._turbineStrutMesh.push({ position: center, rotation: new THREE.Euler(0, 0, Math.PI / 2) });
      turbineStrutIndex++;
      this._turbineCoreMesh.push({ position: center, rotation: new THREE.Euler(0, 0, 0) });
      turbineCoreIndex++;

      for (let i = 0; i < 6; i++) {
        this._turbineBladeMesh.push({
          position: center,
          rotation: new THREE.Euler(0, 0, turbine.bladeRotation + (i * Math.PI) / 3),
        });
        turbineBladeIndex++;
      }
    }

    for (const pipe of this._pipelineEntries) {
      pipe.x = this._wrapX(pipe.x - this.baseSpeed * pipe.speedMult * dt, 180);
      if (pipe.x > HALF_W + 180) {
        const ySign = Math.random() > 0.5 ? 1 : -1;
        pipe.y = ySign * (180 + Math.random() * 20);
      }
      const center = [pipe.x, pipe.y, pipe.z] as THREE.Vector3Tuple;
      this._pipelinePipeMesh.push({ position: center, rotation: new THREE.Euler(0, 0, 0) });
      pipelinePipeIndex++;
      for (const offsetX of [-80, 80]) {
        this._pipelineClampMesh.push({ position: [pipe.x + offsetX, pipe.y, pipe.z], rotation: new THREE.Euler(0, 0, 0) });
        pipelineClampIndex++;
        this._pipelineSeamMesh.push({ position: [pipe.x + offsetX, pipe.y, pipe.z], rotation: new THREE.Euler(0, 0, 0) });
        pipelineSeamIndex++;
      }
    }

    for (const gear of this._gearEntries) {
      gear.x = this._wrapX(gear.x - this.baseSpeed * gear.speedMult * dt, 180);
      if (gear.x > HALF_W + 180) {
        const ySign = Math.random() > 0.5 ? 1 : -1;
        gear.y = ySign * (50 + Math.random() * 40);
      }
      gear.rotation += gear.gearSpeed * dt;

      const center = [gear.x, gear.y, gear.z] as THREE.Vector3Tuple;
      const baseRot = new THREE.Euler(0, 0, gear.rotation);
      this._gearBodyMesh.push({ position: center, rotation: baseRot });
      gearBodyIndex++;
      this._gearSpindleMesh.push({ position: center, rotation: baseRot });
      gearSpindleIndex++;
    }

    for (const spark of this._sparkEntries) {
      spark.x -= this.baseSpeed * spark.speedMult * dt;
      spark.rotX += spark.rx * dt;
      spark.rotY += spark.ry * dt;
      spark.rotZ += spark.rz * dt;

      if (spark.x < -HALF_W - 50) {
        spark.x = HALF_W + 50 + Math.random() * 100;
        spark.y = (Math.random() - 0.5) * GAME_HEIGHT * 1.2;
      }

      const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this._time * spark.flickerSpeed + spark.phase));
      const scale = spark.baseScale * pulse;
      const targetMesh =
        spark.isTeal
          ? (spark.isOct ? this._sparkTealOctMesh : this._sparkTealTetMesh)
          : (spark.isOct ? this._sparkAmberOctMesh : this._sparkAmberTetMesh);

      const targetIndex =
        spark.isTeal
          ? (spark.isOct ? sparkTealOctIndex++ : sparkTealTetIndex++)
          : (spark.isOct ? sparkAmberOctIndex++ : sparkAmberTetIndex++);

      targetMesh.push({
        position: [spark.x, spark.y, spark.z],
        rotation: new THREE.Euler(spark.rotX, spark.rotY, spark.rotZ),
        scale: [scale, scale, scale],
      });
    }
    this._updateSectorLandmark(dt);
    this._columnBodyMesh.endFrame();
    this._columnRibMesh.endFrame();
    this._columnLightMesh.endFrame();
    this._turbineChassisMesh.endFrame();
    this._turbineStrutMesh.endFrame();
    this._turbineCoreMesh.endFrame();
    this._turbineBladeMesh.endFrame();
    this._pipelinePipeMesh.endFrame();
    this._pipelineClampMesh.endFrame();
    this._pipelineSeamMesh.endFrame();
    this._gearSpindleMesh.endFrame();
    this._gearBodyMesh.endFrame();
    this._sparkTealOctMesh.endFrame();
    this._sparkTealTetMesh.endFrame();
    this._sparkAmberOctMesh.endFrame();
    this._sparkAmberTetMesh.endFrame();
  }

  destroy(): void {
    if (this._bgMesh) {
      this._scene.remove(this._bgMesh);
      this._bgMesh.geometry.dispose();
      (this._bgMesh.material as THREE.Material).dispose();
      this._bgMesh = null;
    }
    this._mat = null;
    this._instancedLayer.destroy();

    this._columnBodyGeo.dispose();
    this._columnRibGeo.dispose();
    this._columnLightGeo.dispose();
    this._turbineChassisGeo.dispose();
    this._turbineStrutGeo.dispose();
    this._turbineCoreGeo.dispose();
    this._turbineBladeGeo.dispose();
    this._pipelinePipeGeo.dispose();
    this._pipelineClampGeo.dispose();
    this._pipelineSeamGeo.dispose();
    this._gearSpindleGeo.dispose();
    this._gearBodyGeo.dispose();
    this._sparkGeoOct.dispose();
    this._sparkGeoTet.dispose();

    this._baseMat.dispose();
    this._tealGlow.dispose();
    this._amberGlow.dispose();
  }
}




