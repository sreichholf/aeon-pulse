import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';
import { InstancedScrollLayer, type InstancedScrollMeshLayer } from './InstancedScrollLayer.ts';
import type { SectorBackgroundConfig } from './sectors/Sectors.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

const FRAG = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float distY = abs(uv.y - 0.5) * 2.0;
    vec3 col = mix(vec3(0.012, 0.006, 0.006), vec3(0.040, 0.012, 0.010), 1.0 - distY);
    col += vec3(0.060, 0.010, 0.006) * pow(1.0 - distY, 2.3);
    col *= mix(1.0, 0.15, pow(distY, 3.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SPORE_VERT = `
  attribute float instancePhase;
  attribute float instanceFlickerSpeed;
  varying float vPhase;
  varying float vFlickerSpeed;

  void main() {
    vPhase = instancePhase;
    vFlickerSpeed = instanceFlickerSpeed;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const SPORE_FRAG = `
  uniform vec3 uColor;
  uniform float uTime;
  varying float vPhase;
  varying float vFlickerSpeed;

  void main() {
    float alpha = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * vFlickerSpeed + vPhase));
    gl_FragColor = vec4(uColor, alpha);
  }
`;

interface WombEntry {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  phase: number;
}

interface ColumnEntry {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  rotY: number;
  rotSpeed: number;
}

interface VeinEntry {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  yPhase: number;
  rotX: number;
}

interface PodEntry {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  scalePhase: number;
  rotZ: number;
}

type SporeGroupKey = 'greenOct' | 'greenTet' | 'magentaOct' | 'magentaTet';

interface SporeEntry {
  group: SporeGroupKey;
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
}

interface SporeMeshBundle {
  layer: InstancedScrollMeshLayer;
  geometry: THREE.BufferGeometry;
  entries: SporeEntry[];
}

export class Background3 implements IBackground {
  private _scene: IScene;
  public baseSpeed: number;
  private _time: number;

  private _bgMesh: THREE.Mesh | null;
  private _mat: THREE.ShaderMaterial | null;

  private _baseMat: THREE.MeshPhongMaterial;
  private _boneMat: THREE.MeshPhongMaterial;
  private _glowMat: THREE.MeshBasicMaterial;
  private _sporeGlowMat: THREE.MeshBasicMaterial;
  private _amberGlowMat: THREE.MeshBasicMaterial;
  private _greenSporeMat: THREE.ShaderMaterial;
  private _magentaSporeMat: THREE.ShaderMaterial;

  private _wombBodyGeo: THREE.SphereGeometry;
  private _wombLobeGeo: THREE.SphereGeometry;
  private _coreGeo: THREE.SphereGeometry;
  private _colShaftGeo: THREE.CylinderGeometry;
  private _colRibGeo: THREE.SphereGeometry;
  private _pipeShaftGeo: THREE.CylinderGeometry;
  private _pipeSeamGeo: THREE.CylinderGeometry;
  private _pipeBulbGeo: THREE.SphereGeometry;
  private _podBodyGeo: THREE.SphereGeometry;
  private _podSpikeGeo: THREE.ConeGeometry;
  private _podSporeGeo: THREE.SphereGeometry;
  private _crystalGeoOct: THREE.OctahedronGeometry;
  private _crystalGeoTet: THREE.TetrahedronGeometry;

  private _wombs: WombEntry[];
  private _columns: ColumnEntry[];
  private _veins: VeinEntry[];
  private _pods: PodEntry[];
  private _spores: SporeEntry[];

  private _wombBodyMesh: InstancedScrollMeshLayer;
  private _wombLobeMesh: InstancedScrollMeshLayer;
  private _wombCoreMesh: InstancedScrollMeshLayer;
  private _wombDotMesh: InstancedScrollMeshLayer;
  private _columnShaftMesh: InstancedScrollMeshLayer;
  private _columnRibMesh: InstancedScrollMeshLayer;
  private _veinPipeMesh: InstancedScrollMeshLayer;
  private _veinSeamMesh: InstancedScrollMeshLayer;
  private _veinBulbMesh: InstancedScrollMeshLayer;
  private _podBodyMesh: InstancedScrollMeshLayer;
  private _podSpikeMesh: InstancedScrollMeshLayer;
  private _podTipMesh: InstancedScrollMeshLayer;
  private _sporeMeshes: Record<SporeGroupKey, SporeMeshBundle>;
  private _instancedLayer: InstancedScrollLayer;

  private _sectorLandmarkBody: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarkAccent: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarkAux: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarks: Array<{ x: number; y: number; z: number; speedMult: number; phase: number }> = [];

  private readonly _sectorConfig?: SectorBackgroundConfig;

  constructor(scene: IScene, baseSpeed: number = 130, sectorConfig?: SectorBackgroundConfig) {
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
      color: 0x5e1c1c,
      emissive: 0x160606,
      specular: 0x926b67,
      shininess: 70,
      flatShading: true,
    });

    this._boneMat = new THREE.MeshPhongMaterial({
      color: 0xe5d5bd,
      specular: 0xc8bda9,
      shininess: 60,
      flatShading: true,
    });

    this._glowMat = new THREE.MeshBasicMaterial({
      color: 0xb32020,
      transparent: true,
      opacity: 0.9,
    });

    this._sporeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff4a26,
      transparent: true,
      opacity: 0.9,
    });

    this._amberGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff7a2a,
      transparent: true,
      opacity: 0.9,
    });

    this._greenSporeMat = this._createSporeMaterial(0xff4a26);
    this._magentaSporeMat = this._createSporeMaterial(0xb32020);

    this._wombBodyGeo = new THREE.SphereGeometry(18, 8, 8);
    this._wombLobeGeo = new THREE.SphereGeometry(12, 6, 6);
    this._coreGeo = new THREE.SphereGeometry(7, 6, 6);
    this._colShaftGeo = new THREE.CylinderGeometry(5, 7, 540, 6);
    this._colRibGeo = new THREE.SphereGeometry(8, 6, 6);
    this._pipeShaftGeo = new THREE.CylinderGeometry(6, 6, 300, 6);
    this._pipeSeamGeo = new THREE.CylinderGeometry(6.6, 6.6, 4, 8);
    this._pipeBulbGeo = new THREE.SphereGeometry(10, 6, 6);
    this._podBodyGeo = new THREE.SphereGeometry(15, 6, 6);
    this._podSpikeGeo = new THREE.ConeGeometry(4, 12, 5);
    this._podSporeGeo = new THREE.SphereGeometry(4.5, 6, 6);
    this._crystalGeoOct = new THREE.OctahedronGeometry(1.4);
    this._crystalGeoTet = new THREE.TetrahedronGeometry(1.1);

    this._wombs = [];
    this._columns = [];
    this._veins = [];
    this._pods = [];
    this._spores = [];

    for (let i = 0; i < 6; i++) {
      this._wombs.push({
        x: -HALF_W - 50 + i * (GAME_WIDTH / 4) + (Math.random() - 0.5) * 60,
        y: (Math.random() - 0.5) * 160,
        z: -45,
        speedMult: 0.65,
        phase: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < 4; i++) {
      this._columns.push({
        x: -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        y: 0,
        z: -60,
        speedMult: 0.4,
        rotY: 0,
        rotSpeed: (Math.random() - 0.5) * 0.4,
      });
    }

    for (let i = 0; i < 4; i++) {
      const ySign = i % 2 === 0 ? 1 : -1;
      this._veins.push({
        x: -HALF_W - 100 + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        y: ySign * (160 + Math.random() * 40),
        z: -65,
        speedMult: 0.3,
        yPhase: Math.random() * Math.PI * 2,
        rotX: 0,
      });
    }

    for (let i = 0; i < 4; i++) {
      const ySign = i % 2 === 0 ? 1 : -1;
      this._pods.push({
        x: -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 120,
        y: ySign * (80 + Math.random() * 40),
        z: -90,
        speedMult: 0.15,
        scalePhase: Math.random() * Math.PI * 2,
        rotZ: 0,
      });
    }

    for (let i = 0; i < 60; i++) {
      const isGreen = Math.random() > 0.5;
      const isOct = Math.random() > 0.5;
      const zDepth = -12 - Math.random() * 83;
      const speedMult = 0.15 + (1.0 - (Math.abs(zDepth) - 12) / 83) * 1.15;
      this._spores.push({
        group: isGreen ? (isOct ? 'greenOct' : 'greenTet') : (isOct ? 'magentaOct' : 'magentaTet'),
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
      });
    }

    this._wombBodyMesh = this._createInstancedMesh(this._wombBodyGeo, this._baseMat, this._wombs.length, 'background.womb');
    this._wombLobeMesh = this._createInstancedMesh(this._wombLobeGeo, this._baseMat, this._wombs.length * 3, 'background.womb');
    this._wombCoreMesh = this._createInstancedMesh(this._coreGeo, this._amberGlowMat, this._wombs.length, 'background.womb');
    this._wombDotMesh = this._createInstancedMesh(this._podSporeGeo, this._glowMat, this._wombs.length * 2, 'background.womb');
    this._columnShaftMesh = this._createInstancedMesh(this._colShaftGeo, this._boneMat, this._columns.length, 'background.column');
    this._columnRibMesh = this._createInstancedMesh(this._colRibGeo, this._boneMat, this._columns.length * 5, 'background.column');
    this._veinPipeMesh = this._createInstancedMesh(this._pipeShaftGeo, this._baseMat, this._veins.length, 'background.vein');
    this._veinSeamMesh = this._createInstancedMesh(this._pipeSeamGeo, this._glowMat, this._veins.length * 3, 'background.vein');
    this._veinBulbMesh = this._createInstancedMesh(this._pipeBulbGeo, this._baseMat, this._veins.length * 2, 'background.vein');
    this._podBodyMesh = this._createInstancedMesh(this._podBodyGeo, this._baseMat, this._pods.length, 'background.pod');
    this._podSpikeMesh = this._createInstancedMesh(this._podSpikeGeo, this._baseMat, this._pods.length * 5, 'background.pod');
    this._podTipMesh = this._createInstancedMesh(this._podSporeGeo, this._sporeGlowMat, this._pods.length * 5, 'background.pod');

    const sporeGroups: Record<SporeGroupKey, SporeEntry[]> = {
      greenOct: [],
      greenTet: [],
      magentaOct: [],
      magentaTet: [],
    };
    for (const spore of this._spores) sporeGroups[spore.group].push(spore);

    this._sporeMeshes = {
      greenOct: this._createSporeMesh(this._crystalGeoOct, this._greenSporeMat, sporeGroups.greenOct),
      greenTet: this._createSporeMesh(this._crystalGeoTet, this._greenSporeMat, sporeGroups.greenTet),
      magentaOct: this._createSporeMesh(this._crystalGeoOct, this._magentaSporeMat, sporeGroups.magentaOct),
      magentaTet: this._createSporeMesh(this._crystalGeoTet, this._magentaSporeMat, sporeGroups.magentaTet),
    };

    this._buildSectorLandmark();
    this.update(0);
  }

  private _createSporeMaterial(color: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 },
      },
      vertexShader: SPORE_VERT,
      fragmentShader: SPORE_FRAG,
      transparent: true,
      depthWrite: false,
    });
  }

  private _createInstancedMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    detail: string,
  ): InstancedScrollMeshLayer {
    return this._instancedLayer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail,
      geometry,
      material,
      capacity: count,
    });
  }

  private _createSporeMesh(
    baseGeometry: THREE.BufferGeometry,
    material: THREE.ShaderMaterial,
    entries: SporeEntry[],
  ): SporeMeshBundle {
    const geometry = baseGeometry.clone();
    const phase = new Float32Array(entries.length);
    const speed = new Float32Array(entries.length);
    for (let i = 0; i < entries.length; i++) {
      phase[i] = entries[i]!.phase;
      speed[i] = entries[i]!.flickerSpeed;
    }
    geometry.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(phase, 1));
    geometry.setAttribute('instanceFlickerSpeed', new THREE.InstancedBufferAttribute(speed, 1));
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    const layer = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail: 'background.spore',
      mesh,
      ownedResources: [geometry],
    });
    return { layer, geometry, entries };
  }

  private _buildYJunctionGeometry(radius: number): THREE.BufferGeometry {
    const stem = new THREE.CylinderGeometry(radius, radius, 120, 8);
    stem.rotateZ(Math.PI / 2);
    stem.translate(60, 0, 0);

    const left = new THREE.CylinderGeometry(radius, radius, 100, 8);
    left.rotateZ((3 * Math.PI) / 4);
    left.translate(-35, 35, 0);

    const right = new THREE.CylinderGeometry(radius, radius, 100, 8);
    right.rotateZ((5 * Math.PI) / 4);
    right.translate(-35, -35, 0);

    const merged = mergeGeometries([stem, left, right]);
    if (!merged) throw new Error('Failed to merge capillary junction geometry.');
    for (const geo of [stem, left, right]) geo.dispose();
    return merged;
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
    let accentMaterial: THREE.Material = this._amberGlowMat;
    let auxMaterial: THREE.Material = this._baseMat;
    let bodyCapacity = 0;
    let accentCapacity = 0;
    let auxCapacity = 0;

    if (key === 'outerMembrane') {
      bodyGeo = new THREE.TorusGeometry(55, 7, 8, 18, Math.PI * 1.5);
      bodyGeo.rotateZ((-3 * Math.PI) / 4);
      accentGeo = new THREE.CylinderGeometry(3, 2, 26, 5);
      auxGeo = new THREE.SphereGeometry(5, 6, 6);
      accentMaterial = this._glowMat;
      auxMaterial = this._amberGlowMat;
      for (let i = 0; i < 4; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 320 + (Math.random() - 0.5) * 70,
          y: 185 + (Math.random() - 0.5) * 30,
          z: -68,
          speedMult: 0.5,
          phase: Math.random() * Math.PI * 2,
        });
      }
      bodyCapacity = this._sectorLandmarks.length;
      accentCapacity = this._sectorLandmarks.length * 4;
      auxCapacity = this._sectorLandmarks.length * 2;
    } else if (key === 'gullet') {
      bodyGeo = new THREE.BoxGeometry(75, 540, 35);
      accentGeo = new THREE.CylinderGeometry(6, 6, 110, 6);
      accentGeo.rotateZ(Math.PI / 2);
      auxGeo = new THREE.SphereGeometry(20, 7, 7);
      accentMaterial = this._glowMat;
      auxMaterial = this._baseMat;
      for (let i = 0; i < 4; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 320 + (Math.random() - 0.5) * 80,
          y: 0,
          z: -72,
          speedMult: 0.45,
          phase: Math.random() * Math.PI * 2,
        });
      }
      bodyCapacity = this._sectorLandmarks.length * 2;
      accentCapacity = this._sectorLandmarks.length * 4;
      auxCapacity = this._sectorLandmarks.length * 2;
    } else if (key === 'nursery') {
      bodyGeo = new THREE.SphereGeometry(18, 8, 8);
      accentGeo = new THREE.CylinderGeometry(3, 5, 22, 5);
      auxGeo = new THREE.SphereGeometry(6, 6, 6);
      accentMaterial = this._boneMat;
      auxMaterial = this._amberGlowMat;
      for (let i = 0; i < 4; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 320 + (Math.random() - 0.5) * 70,
          y: (Math.random() - 0.5) * 140,
          z: -70,
          speedMult: 0.55,
          phase: Math.random() * Math.PI * 2,
        });
      }
      bodyCapacity = this._sectorLandmarks.length * 5;
      accentCapacity = this._sectorLandmarks.length * 5;
      auxCapacity = this._sectorLandmarks.length * 4;
    } else if (key === 'capillaryJunction') {
      bodyGeo = this._buildYJunctionGeometry(13);
      accentGeo = new THREE.SphereGeometry(9, 6, 6);
      auxGeo = new THREE.CylinderGeometry(4, 4, 70, 6);
      auxGeo.rotateZ(Math.PI / 2);
      accentMaterial = this._glowMat;
      auxMaterial = this._sporeGlowMat;
      for (let i = 0; i < 5; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 245 + (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 120,
          z: -66,
          speedMult: 0.58,
          phase: Math.random() * Math.PI * 2,
        });
      }
      bodyCapacity = this._sectorLandmarks.length;
      accentCapacity = this._sectorLandmarks.length * 3;
      auxCapacity = this._sectorLandmarks.length * 2;
    } else if (key === 'wombCore') {
      bodyGeo = new THREE.SphereGeometry(48, 9, 9);
      accentGeo = new THREE.SphereGeometry(14, 6, 6);
      auxGeo = new THREE.TorusGeometry(28, 3.5, 6, 14);
      accentMaterial = this._glowMat;
      auxMaterial = this._amberGlowMat;
      for (let i = 0; i < 3; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 420 + (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 60,
          z: -74,
          speedMult: 0.42,
          phase: Math.random() * Math.PI * 2,
        });
      }
      bodyCapacity = this._sectorLandmarks.length * 3;
      accentCapacity = this._sectorLandmarks.length * 3;
      auxCapacity = this._sectorLandmarks.length;
    } else {
      return;
    }

    const detail = `background.sector.${key}`;
    this._sectorLandmarkBody = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail,
      geometry: bodyGeo,
      material: this._baseMat,
      capacity: bodyCapacity,
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

    if (key === 'outerMembrane') {
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 220);
        const breath = 1.0 + 0.05 * Math.sin(this._time * 1.2 + lm.phase);
        this._sectorLandmarkBody.push({
          position: [lm.x, lm.y, lm.z],
          rotation: new THREE.Euler(0, 0, 0),
          scale: [breath, breath * 0.96, breath * 0.65],
        });
        const topX = lm.x;
        const topY = lm.y + 55;
        for (let i = 0; i < 3; i++) {
          const ang = (i - 1) * 0.55;
          const vx = Math.sin(ang) * 18;
          const vy = Math.cos(ang) * 18;
          this._sectorLandmarkAccent.push({
            position: [topX + vx, topY + vy, lm.z + 2],
            rotation: new THREE.Euler(0, 0, ang),
          });
        }
        this._sectorLandmarkAccent.push({ position: [topX, topY, lm.z + 2], rotation: new THREE.Euler(0, 0, 0) });
        for (let i = 0; i < 2; i++) {
          this._sectorLandmarkAux?.push({
            position: [lm.x + (i === 0 ? -26 : 26), lm.y + 48, lm.z + 4],
            scale: [breath * 0.9, breath * 0.9, breath * 0.9],
          });
        }
      }
    } else if (key === 'gullet') {
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 280);
        const contraction = 22 * Math.sin(this._time * 1.8 + lm.phase);
        const gap = 440 - contraction;
        this._sectorLandmarkBody.push({ position: [lm.x - gap, lm.y, lm.z], rotation: new THREE.Euler(0, 0, 0) });
        this._sectorLandmarkBody.push({ position: [lm.x + gap, lm.y, lm.z], rotation: new THREE.Euler(0, 0, 0) });
        for (const dir of [-1, 1]) {
          this._sectorLandmarkAccent.push({ position: [lm.x + dir * (gap - 35), lm.y - 120, lm.z + 2], rotation: new THREE.Euler(0, 0, Math.PI / 2) });
          this._sectorLandmarkAccent.push({ position: [lm.x + dir * (gap - 35), lm.y + 120, lm.z + 2], rotation: new THREE.Euler(0, 0, Math.PI / 2) });
        }
        this._sectorLandmarkAux?.push({ position: [lm.x - gap + 30, lm.y + contraction * 0.6, lm.z + 4], scale: [1.1, 1.1, 1.1] });
        this._sectorLandmarkAux?.push({ position: [lm.x + gap - 30, lm.y - contraction * 0.6, lm.z + 4], scale: [1.1, 1.1, 1.1] });
      }
    } else if (key === 'nursery') {
      const eggOffsets = [
        { x: 0, y: 0 },
        { x: -24, y: 14 },
        { x: 24, y: 12 },
        { x: -12, y: -22 },
        { x: 14, y: -18 },
      ];
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 220);
        const clusterBreath = 1.0 + 0.04 * Math.sin(this._time * 1.4 + lm.phase);
        let eggIdx = 0;
        for (const off of eggOffsets) {
          const sx = off.x * clusterBreath;
          const sy = off.y * clusterBreath;
          this._sectorLandmarkBody.push({
            position: [lm.x + sx, lm.y + sy, lm.z],
            scale: [0.85 * clusterBreath, 1.25 * clusterBreath, 0.85 * clusterBreath],
          });
          this._sectorLandmarkAccent.push({
            position: [lm.x + sx * 0.9, lm.y + sy - 18, lm.z - 2],
            scale: [clusterBreath, clusterBreath, clusterBreath],
          });
          if (eggIdx < 4) {
            this._sectorLandmarkAux?.push({
              position: [lm.x + sx * 0.7, lm.y + sy + 6, lm.z + 3],
              scale: [clusterBreath * 0.7, clusterBreath * 0.7, clusterBreath * 0.7],
            });
          }
          eggIdx++;
        }
      }
    } else if (key === 'capillaryJunction') {
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 220);
        const pulse = 1.0 + 0.07 * Math.sin(this._time * 2.2 + lm.phase);
        this._sectorLandmarkBody.push({
          position: [lm.x, lm.y, lm.z],
          scale: [pulse, pulse, pulse],
        });
        this._sectorLandmarkAccent.push({ position: [lm.x, lm.y, lm.z + 4], scale: [pulse, pulse, pulse] });
        this._sectorLandmarkAccent.push({ position: [lm.x - 40, lm.y + 38, lm.z + 4], scale: [pulse * 0.9, pulse * 0.9, pulse * 0.9] });
        this._sectorLandmarkAccent.push({ position: [lm.x - 40, lm.y - 38, lm.z + 4], scale: [pulse * 0.9, pulse * 0.9, pulse * 0.9] });
        this._sectorLandmarkAux?.push({ position: [lm.x + 60, lm.y, lm.z + 2], rotation: new THREE.Euler(0, 0, Math.PI / 2), scale: [pulse, 1, pulse] });
        this._sectorLandmarkAux?.push({ position: [lm.x - 70, lm.y + 60, lm.z + 2], rotation: new THREE.Euler(0, 0, (3 * Math.PI) / 4), scale: [pulse, 1, pulse] });
      }
    } else if (key === 'wombCore') {
      const lobeSpecs = [
        { x: 0, y: 0, s: 1.0 },
        { x: -38, y: 34, s: 0.78 },
        { x: 36, y: -32, s: 0.62 },
      ];
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 280);
        const throb = 1.0 + 0.05 * Math.sin(this._time * 1.1 + lm.phase);
        for (const spec of lobeSpecs) {
          const scale = spec.s * throb;
          this._sectorLandmarkBody.push({
            position: [lm.x + spec.x, lm.y + spec.y, lm.z],
            scale: [scale, scale, scale * 0.85],
          });
          this._sectorLandmarkAccent.push({
            position: [lm.x + spec.x * 0.9, lm.y + spec.y * 0.9, lm.z + 8],
            scale: [scale * 0.35, scale * 0.35, scale * 0.35],
          });
        }
        this._sectorLandmarkAux?.push({ position: [lm.x, lm.y, lm.z + 4], rotation: new THREE.Euler(0, 0, 0), scale: [throb, throb, throb] });
      }
    }

    this._sectorLandmarkBody.endFrame();
    this._sectorLandmarkAccent.endFrame();
    this._sectorLandmarkAux?.endFrame();
  }

  update(dt: number): void {
    this._time += dt;
    if (this._mat) this._mat.uniforms.uTime.value = this._time;
    this._greenSporeMat.uniforms.uTime.value = this._time;
    this._magentaSporeMat.uniforms.uTime.value = this._time;
    this._wombBodyMesh.beginFrame();
    this._wombLobeMesh.beginFrame();
    this._wombCoreMesh.beginFrame();
    this._wombDotMesh.beginFrame();
    this._columnShaftMesh.beginFrame();
    this._columnRibMesh.beginFrame();
    this._veinPipeMesh.beginFrame();
    this._veinSeamMesh.beginFrame();
    this._veinBulbMesh.beginFrame();
    this._podBodyMesh.beginFrame();
    this._podSpikeMesh.beginFrame();
    this._podTipMesh.beginFrame();
    for (const bundle of Object.values(this._sporeMeshes)) {
      bundle.layer.beginFrame();
    }

    let wombBodyIndex = 0;
    let wombLobeIndex = 0;
    let wombCoreIndex = 0;
    let wombDotIndex = 0;
    for (const womb of this._wombs) {
      womb.x -= this.baseSpeed * womb.speedMult * dt;
      if (womb.x < -HALF_W - 180) {
        womb.x += GAME_WIDTH + 360;
        womb.y = (Math.random() - 0.5) * 160;
      }
      const s = 1.0 + 0.08 * Math.sin(this._time * 2.2 + womb.phase);
      this._wombBodyMesh.push({ position: [womb.x, womb.y, womb.z], rotation: new THREE.Euler(0, 0, 0), scale: [1.1 * s, 0.9 * s, 0.6 * s] });
      wombBodyIndex++;
      this._wombLobeMesh.push({ position: [womb.x - 14 * s, womb.y + 8 * s, womb.z - 2 * s], rotation: new THREE.Euler(0, 0, 0), scale: [1.0 * s, 1.2 * s, 0.7 * s] });
      wombLobeIndex++;
      this._wombLobeMesh.push({ position: [womb.x + 14 * s, womb.y - 8 * s, womb.z - 2 * s], rotation: new THREE.Euler(0, 0, 0), scale: [1.2 * s, 1.0 * s, 0.7 * s] });
      wombLobeIndex++;
      this._wombLobeMesh.push({ position: [womb.x + 6 * s, womb.y + 12 * s, womb.z - 4 * s], rotation: new THREE.Euler(0, 0, 0), scale: [0.9 * s, 0.9 * s, 0.6 * s] });
      wombLobeIndex++;
      this._wombCoreMesh.push({ position: [womb.x, womb.y, womb.z + 4 * s], rotation: new THREE.Euler(0, 0, 0), scale: [s, s, s] });
      wombCoreIndex++;
      this._wombDotMesh.push({ position: [womb.x - 10 * s, womb.y - 8 * s, womb.z + 8 * s], rotation: new THREE.Euler(0, 0, 0), scale: [s, s, s] });
      wombDotIndex++;
      this._wombDotMesh.push({ position: [womb.x + 10 * s, womb.y + 8 * s, womb.z + 8 * s], rotation: new THREE.Euler(0, 0, 0), scale: [s, s, s] });
      wombDotIndex++;
    }

    let columnShaftIndex = 0;
    let columnRibIndex = 0;
    for (const column of this._columns) {
      column.x -= this.baseSpeed * column.speedMult * dt;
      if (column.x < -HALF_W - 180) {
        column.x += GAME_WIDTH + 360;
      }
      column.rotY += column.rotSpeed * dt;
      this._columnShaftMesh.push({ position: [column.x, column.y, column.z], rotation: new THREE.Euler(0, column.rotY, 0), scale: [1, 1, 1] });
      columnShaftIndex++;
      for (const ribY of [-200, -100, 0, 100, 200]) {
        this._columnRibMesh.push({ position: [column.x, column.y + ribY, column.z], rotation: new THREE.Euler(0, column.rotY, 0), scale: [1.6, 0.5, 1.6] });
        columnRibIndex++;
      }
    }

    let veinPipeIndex = 0;
    let veinSeamIndex = 0;
    let veinBulbIndex = 0;
    for (const vein of this._veins) {
      vein.x -= this.baseSpeed * vein.speedMult * dt;
      if (vein.x < -HALF_W - 180) {
        vein.x += GAME_WIDTH + 360;
        const ySign = Math.random() > 0.5 ? 1 : -1;
        vein.y = ySign * (160 + Math.random() * 40);
      }
      vein.y += Math.sin(this._time * 1.5 + vein.yPhase) * 0.15;
      vein.rotX += 0.2 * dt;
      this._veinPipeMesh.push({ position: [vein.x, vein.y, vein.z], rotation: new THREE.Euler(0, 0, Math.PI / 2), scale: [1, 1, 1] });
      veinPipeIndex++;
      this._veinSeamMesh.push({ position: [vein.x - 80, vein.y, vein.z], rotation: new THREE.Euler(0, 0, Math.PI / 2), scale: [1, 1, 1] });
      veinSeamIndex++;
      this._veinSeamMesh.push({ position: [vein.x + 80, vein.y, vein.z], rotation: new THREE.Euler(0, 0, Math.PI / 2), scale: [1, 1, 1] });
      veinSeamIndex++;
      this._veinSeamMesh.push({ position: [vein.x, vein.y, vein.z], rotation: new THREE.Euler(0, 0, Math.PI / 2), scale: [1, 1, 1] });
      veinSeamIndex++;
      this._veinBulbMesh.push({ position: [vein.x - 40, vein.y + 2, vein.z + 2], rotation: new THREE.Euler(vein.rotX, 0, 0), scale: [1, 1, 1] });
      veinBulbIndex++;
      this._veinBulbMesh.push({ position: [vein.x + 40, vein.y - 2, vein.z + 2], rotation: new THREE.Euler(vein.rotX, 0, 0), scale: [1, 1, 1] });
      veinBulbIndex++;
    }

    let podBodyIndex = 0;
    let podSpikeIndex = 0;
    let podTipIndex = 0;
    const spikeDirs = [
      new THREE.Vector3(1, 1, 0.5).normalize(),
      new THREE.Vector3(-1, 1, 0.5).normalize(),
      new THREE.Vector3(-1, -1, 0.5).normalize(),
      new THREE.Vector3(1, -1, 0.5).normalize(),
      new THREE.Vector3(0, 0, 1).normalize(),
    ];
    for (const pod of this._pods) {
      pod.x -= this.baseSpeed * pod.speedMult * dt;
      if (pod.x < -HALF_W - 180) {
        pod.x += GAME_WIDTH + 360;
        const ySign = Math.random() > 0.5 ? 1 : -1;
        pod.y = ySign * (80 + Math.random() * 40);
      }
      const s = 1.0 + 0.06 * Math.sin(this._time * 1.8 + pod.scalePhase);
      pod.rotZ += 0.1 * dt;
      this._podBodyMesh.push({ position: [pod.x, pod.y, pod.z], rotation: new THREE.Euler(0, 0, pod.rotZ), scale: [s, s, s] });
      podBodyIndex++;
      for (const dir of spikeDirs) {
        const spikePos = dir.clone().multiplyScalar(13 * s);
        const spikeQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const spikeEuler = new THREE.Euler().setFromQuaternion(spikeQuat);
        spikeEuler.x += Math.PI / 2;
        this._podSpikeMesh.push({ position: [pod.x + spikePos.x, pod.y + spikePos.y, pod.z + spikePos.z], rotation: spikeEuler, scale: [s, s, s] });
        podSpikeIndex++;
        const tipPos = dir.clone().multiplyScalar(22 * s);
        this._podTipMesh.push({ position: [pod.x + tipPos.x, pod.y + tipPos.y, pod.z + tipPos.z], rotation: new THREE.Euler(0, 0, 0), scale: [s, s, s] });
        podTipIndex++;
      }
    }

    for (const bundle of Object.values(this._sporeMeshes)) {
      let index = 0;
      for (const spore of bundle.entries) {
        spore.x -= this.baseSpeed * spore.speedMult * dt;
        spore.rotX += spore.rx * dt;
        spore.rotY += spore.ry * dt;
        spore.rotZ += spore.rz * dt;
        if (spore.x < -HALF_W - 50) {
          spore.x = HALF_W + 50 + Math.random() * 100;
          spore.y = (Math.random() - 0.5) * GAME_HEIGHT * 1.2;
        }
        bundle.layer.push({ position: [spore.x, spore.y, spore.z], rotation: new THREE.Euler(spore.rotX, spore.rotY, spore.rotZ), scale: [1, 1, 1] });
        index++;
      }
      bundle.layer.endFrame();
    }
    this._updateSectorLandmark(dt);
    this._wombBodyMesh.endFrame();
    this._wombLobeMesh.endFrame();
    this._wombCoreMesh.endFrame();
    this._wombDotMesh.endFrame();
    this._columnShaftMesh.endFrame();
    this._columnRibMesh.endFrame();
    this._veinPipeMesh.endFrame();
    this._veinSeamMesh.endFrame();
    this._veinBulbMesh.endFrame();
    this._podBodyMesh.endFrame();
    this._podSpikeMesh.endFrame();
    this._podTipMesh.endFrame();
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

    this._wombBodyGeo.dispose();
    this._wombLobeGeo.dispose();
    this._coreGeo.dispose();
    this._colShaftGeo.dispose();
    this._colRibGeo.dispose();
    this._pipeShaftGeo.dispose();
    this._pipeSeamGeo.dispose();
    this._pipeBulbGeo.dispose();
    this._podBodyGeo.dispose();
    this._podSpikeGeo.dispose();
    this._podSporeGeo.dispose();
    this._crystalGeoOct.dispose();
    this._crystalGeoTet.dispose();

    this._baseMat.dispose();
    this._boneMat.dispose();
    this._glowMat.dispose();
    this._sporeGlowMat.dispose();
    this._amberGlowMat.dispose();
    this._greenSporeMat.dispose();
    this._magentaSporeMat.dispose();
  }
}
