import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

const FRAG = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float distY = abs(uv.y - 0.5) * 2.0;
    vec3 col = mix(vec3(0.006, 0.001, 0.008), vec3(0.035, 0.005, 0.02), 1.0 - distY);
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
  mesh: THREE.InstancedMesh;
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

  private _wombBodyMesh: THREE.InstancedMesh;
  private _wombLobeMesh: THREE.InstancedMesh;
  private _wombCoreMesh: THREE.InstancedMesh;
  private _wombDotMesh: THREE.InstancedMesh;
  private _columnShaftMesh: THREE.InstancedMesh;
  private _columnRibMesh: THREE.InstancedMesh;
  private _veinPipeMesh: THREE.InstancedMesh;
  private _veinSeamMesh: THREE.InstancedMesh;
  private _veinBulbMesh: THREE.InstancedMesh;
  private _podBodyMesh: THREE.InstancedMesh;
  private _podSpikeMesh: THREE.InstancedMesh;
  private _podTipMesh: THREE.InstancedMesh;
  private _sporeMeshes: Record<SporeGroupKey, SporeMeshBundle>;
  private _instanceHelper: THREE.Object3D;

  constructor(scene: IScene, baseSpeed: number = 130) {
    this._scene = scene;
    this.baseSpeed = baseSpeed;
    this._time = 0;

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
      color: 0x6e1b34,
      emissive: 0x14030a,
      specular: 0xaa7788,
      shininess: 70,
      flatShading: true,
    });

    this._boneMat = new THREE.MeshPhongMaterial({
      color: 0xa8a192,
      specular: 0x888888,
      shininess: 60,
      flatShading: true,
    });

    this._glowMat = new THREE.MeshBasicMaterial({
      color: 0xff00aa,
      transparent: true,
      opacity: 0.9,
    });

    this._sporeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xb2ff00,
      transparent: true,
      opacity: 0.9,
    });

    this._amberGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff7700,
      transparent: true,
      opacity: 0.9,
    });

    this._greenSporeMat = this._createSporeMaterial(0xb2ff00);
    this._magentaSporeMat = this._createSporeMaterial(0xff00aa);

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

    this._instanceHelper = new THREE.Object3D();
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
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    markRenderCategory(mesh, RenderCategory.BACKGROUND, detail);
    this._scene.add(mesh);
    return mesh;
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
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = entries.length;
    markRenderCategory(mesh, RenderCategory.BACKGROUND, 'background.spore');
    this._scene.add(mesh);
    return { mesh, geometry, entries };
  }

  private _setInstanceTransform(
    mesh: THREE.InstancedMesh,
    index: number,
    position: THREE.Vector3Tuple,
    rotation: THREE.Euler,
    scale: THREE.Vector3Tuple,
  ): void {
    this._instanceHelper.position.set(...position);
    this._instanceHelper.rotation.copy(rotation);
    this._instanceHelper.scale.set(...scale);
    this._instanceHelper.updateMatrix();
    mesh.setMatrixAt(index, this._instanceHelper.matrix);
  }

  update(dt: number): void {
    this._time += dt;
    if (this._mat) this._mat.uniforms.uTime.value = this._time;
    this._greenSporeMat.uniforms.uTime.value = this._time;
    this._magentaSporeMat.uniforms.uTime.value = this._time;

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
      this._setInstanceTransform(this._wombBodyMesh, wombBodyIndex++, [womb.x, womb.y, womb.z], new THREE.Euler(0, 0, 0), [1.1 * s, 0.9 * s, 0.6 * s]);
      this._setInstanceTransform(this._wombLobeMesh, wombLobeIndex++, [womb.x - 14 * s, womb.y + 8 * s, womb.z - 2 * s], new THREE.Euler(0, 0, 0), [1.0 * s, 1.2 * s, 0.7 * s]);
      this._setInstanceTransform(this._wombLobeMesh, wombLobeIndex++, [womb.x + 14 * s, womb.y - 8 * s, womb.z - 2 * s], new THREE.Euler(0, 0, 0), [1.2 * s, 1.0 * s, 0.7 * s]);
      this._setInstanceTransform(this._wombLobeMesh, wombLobeIndex++, [womb.x + 6 * s, womb.y + 12 * s, womb.z - 4 * s], new THREE.Euler(0, 0, 0), [0.9 * s, 0.9 * s, 0.6 * s]);
      this._setInstanceTransform(this._wombCoreMesh, wombCoreIndex++, [womb.x, womb.y, womb.z + 4 * s], new THREE.Euler(0, 0, 0), [s, s, s]);
      this._setInstanceTransform(this._wombDotMesh, wombDotIndex++, [womb.x - 10 * s, womb.y - 8 * s, womb.z + 8 * s], new THREE.Euler(0, 0, 0), [s, s, s]);
      this._setInstanceTransform(this._wombDotMesh, wombDotIndex++, [womb.x + 10 * s, womb.y + 8 * s, womb.z + 8 * s], new THREE.Euler(0, 0, 0), [s, s, s]);
    }

    let columnShaftIndex = 0;
    let columnRibIndex = 0;
    for (const column of this._columns) {
      column.x -= this.baseSpeed * column.speedMult * dt;
      if (column.x < -HALF_W - 180) {
        column.x += GAME_WIDTH + 360;
      }
      column.rotY += column.rotSpeed * dt;
      this._setInstanceTransform(this._columnShaftMesh, columnShaftIndex++, [column.x, column.y, column.z], new THREE.Euler(0, column.rotY, 0), [1, 1, 1]);
      for (const ribY of [-200, -100, 0, 100, 200]) {
        this._setInstanceTransform(this._columnRibMesh, columnRibIndex++, [column.x, column.y + ribY, column.z], new THREE.Euler(0, column.rotY, 0), [1.6, 0.5, 1.6]);
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
      this._setInstanceTransform(this._veinPipeMesh, veinPipeIndex++, [vein.x, vein.y, vein.z], new THREE.Euler(0, 0, Math.PI / 2), [1, 1, 1]);
      this._setInstanceTransform(this._veinSeamMesh, veinSeamIndex++, [vein.x - 80, vein.y, vein.z], new THREE.Euler(0, 0, Math.PI / 2), [1, 1, 1]);
      this._setInstanceTransform(this._veinSeamMesh, veinSeamIndex++, [vein.x + 80, vein.y, vein.z], new THREE.Euler(0, 0, Math.PI / 2), [1, 1, 1]);
      this._setInstanceTransform(this._veinSeamMesh, veinSeamIndex++, [vein.x, vein.y, vein.z], new THREE.Euler(0, 0, Math.PI / 2), [1, 1, 1]);
      this._setInstanceTransform(this._veinBulbMesh, veinBulbIndex++, [vein.x - 40, vein.y + 2, vein.z + 2], new THREE.Euler(vein.rotX, 0, 0), [1, 1, 1]);
      this._setInstanceTransform(this._veinBulbMesh, veinBulbIndex++, [vein.x + 40, vein.y - 2, vein.z + 2], new THREE.Euler(vein.rotX, 0, 0), [1, 1, 1]);
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
      this._setInstanceTransform(this._podBodyMesh, podBodyIndex++, [pod.x, pod.y, pod.z], new THREE.Euler(0, 0, pod.rotZ), [s, s, s]);
      for (const dir of spikeDirs) {
        const spikePos = dir.clone().multiplyScalar(13 * s);
        const spikeQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const spikeEuler = new THREE.Euler().setFromQuaternion(spikeQuat);
        spikeEuler.x += Math.PI / 2;
        this._setInstanceTransform(this._podSpikeMesh, podSpikeIndex++, [pod.x + spikePos.x, pod.y + spikePos.y, pod.z + spikePos.z], spikeEuler, [s, s, s]);
        const tipPos = dir.clone().multiplyScalar(22 * s);
        this._setInstanceTransform(this._podTipMesh, podTipIndex++, [pod.x + tipPos.x, pod.y + tipPos.y, pod.z + tipPos.z], new THREE.Euler(0, 0, 0), [s, s, s]);
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
        this._setInstanceTransform(bundle.mesh, index++, [spore.x, spore.y, spore.z], new THREE.Euler(spore.rotX, spore.rotY, spore.rotZ), [1, 1, 1]);
      }
      bundle.mesh.count = bundle.entries.length;
      bundle.mesh.instanceMatrix.needsUpdate = true;
    }

    this._wombBodyMesh.count = wombBodyIndex;
    this._wombLobeMesh.count = wombLobeIndex;
    this._wombCoreMesh.count = wombCoreIndex;
    this._wombDotMesh.count = wombDotIndex;
    this._columnShaftMesh.count = columnShaftIndex;
    this._columnRibMesh.count = columnRibIndex;
    this._veinPipeMesh.count = veinPipeIndex;
    this._veinSeamMesh.count = veinSeamIndex;
    this._veinBulbMesh.count = veinBulbIndex;
    this._podBodyMesh.count = podBodyIndex;
    this._podSpikeMesh.count = podSpikeIndex;
    this._podTipMesh.count = podTipIndex;

    this._wombBodyMesh.instanceMatrix.needsUpdate = true;
    this._wombLobeMesh.instanceMatrix.needsUpdate = true;
    this._wombCoreMesh.instanceMatrix.needsUpdate = true;
    this._wombDotMesh.instanceMatrix.needsUpdate = true;
    this._columnShaftMesh.instanceMatrix.needsUpdate = true;
    this._columnRibMesh.instanceMatrix.needsUpdate = true;
    this._veinPipeMesh.instanceMatrix.needsUpdate = true;
    this._veinSeamMesh.instanceMatrix.needsUpdate = true;
    this._veinBulbMesh.instanceMatrix.needsUpdate = true;
    this._podBodyMesh.instanceMatrix.needsUpdate = true;
    this._podSpikeMesh.instanceMatrix.needsUpdate = true;
    this._podTipMesh.instanceMatrix.needsUpdate = true;
  }

  destroy(): void {
    if (this._bgMesh) {
      this._scene.remove(this._bgMesh);
      this._bgMesh.geometry.dispose();
      (this._bgMesh.material as THREE.Material).dispose();
      this._bgMesh = null;
    }
    this._mat = null;

    for (const mesh of [
      this._wombBodyMesh,
      this._wombLobeMesh,
      this._wombCoreMesh,
      this._wombDotMesh,
      this._columnShaftMesh,
      this._columnRibMesh,
      this._veinPipeMesh,
      this._veinSeamMesh,
      this._veinBulbMesh,
      this._podBodyMesh,
      this._podSpikeMesh,
      this._podTipMesh,
    ]) {
      this._scene.remove(mesh);
    }

    for (const bundle of Object.values(this._sporeMeshes)) {
      this._scene.remove(bundle.mesh);
      bundle.geometry.dispose();
    }

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
