import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

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
  private _archRingMesh: THREE.InstancedMesh;
  private _archPanelMesh: THREE.InstancedMesh;
  private _archIndicatorMesh: THREE.InstancedMesh;
  private _archTrimMesh: THREE.InstancedMesh;
  private _archOuterTrimMesh: THREE.InstancedMesh;
  private _arches: ArchEntry[];

  private _towerBaseGeo: THREE.CylinderGeometry;
  private _towerHubGeo: THREE.CylinderGeometry;
  private _towerBladeGeo: THREE.BoxGeometry;
  private _towerVentGeo: THREE.CylinderGeometry;
  private _towerBaseMesh: THREE.InstancedMesh;
  private _towerHubMesh: THREE.InstancedMesh;
  private _towerBladeMesh: THREE.InstancedMesh;
  private _towerVentMesh: THREE.InstancedMesh;
  private _towers: TowerEntry[];

  private _pipeBodyGeo: THREE.CylinderGeometry;
  private _pipeClampGeo: THREE.CylinderGeometry;
  private _pipeSeamGeo: THREE.CylinderGeometry;
  private _pipeBodyMesh: THREE.InstancedMesh;
  private _pipeClampMesh: THREE.InstancedMesh;
  private _pipeSeamMesh: THREE.InstancedMesh;
  private _pipes: PipeEntry[];

  private _spireBodyGeo: THREE.CylinderGeometry;
  private _spireCrownGeo: THREE.CylinderGeometry;
  private _spireBodyMesh: THREE.InstancedMesh;
  private _spireCrownMesh: THREE.InstancedMesh;
  private _spires: SpireEntry[];

  private _ringBodyGeo: THREE.TorusGeometry;
  private _ringCoreGeo: THREE.TorusGeometry;
  private _ringBodyMesh: THREE.InstancedMesh;
  private _ringCoreMesh: THREE.InstancedMesh;
  private _rings: RingEntry[];

  private _dustMatCyan: THREE.MeshBasicMaterial;
  private _dustMatBlue: THREE.MeshBasicMaterial;
  private _dustGeoOcta: THREE.OctahedronGeometry;
  private _dustGeoTetra: THREE.TetrahedronGeometry;
  private _dustOctaCyanMesh: THREE.InstancedMesh;
  private _dustOctaBlueMesh: THREE.InstancedMesh;
  private _dustTetraCyanMesh: THREE.InstancedMesh;
  private _dustTetraBlueMesh: THREE.InstancedMesh;
  private _dust: DustEntry[];

  private _instanceHelper: THREE.Object3D;
  private _rotationEuler: THREE.Euler;

  constructor(scene: IScene, baseSpeed: number = 100) {
    this._scene = scene;
    this.baseSpeed = baseSpeed;
    this._time = 0;
    this._instanceHelper = new THREE.Object3D();
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
    this._archRingMesh = this._createInstancedMesh(this._archRingGeo, this._archBaseMat, 4, 'background.arch');
    this._archPanelMesh = this._createInstancedMesh(this._archPanelGeo, this._archBaseMat, 8, 'background.arch');
    this._archIndicatorMesh = this._createInstancedMesh(this._archIndicatorGeo, this._archEmissiveMat, 8, 'background.arch');
    this._archTrimMesh = this._createInstancedMesh(this._archTrimGeo, this._archEmissiveMat, 4, 'background.arch');
    this._archOuterTrimMesh = this._createInstancedMesh(this._archOuterTrimGeo, this._archEmissiveMat, 4, 'background.arch');
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
    this._towerBaseMesh = this._createInstancedMesh(this._towerBaseGeo, this._baseMat, 4, 'background.tower');
    this._towerHubMesh = this._createInstancedMesh(this._towerHubGeo, this._baseMat, 4, 'background.tower');
    this._towerBladeMesh = this._createInstancedMesh(this._towerBladeGeo, this._baseMat, 8, 'background.tower');
    this._towerVentMesh = this._createInstancedMesh(this._towerVentGeo, this._emissiveMat, 4, 'background.tower');
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
    this._pipeBodyMesh = this._createInstancedMesh(this._pipeBodyGeo, this._baseMat, 4, 'background.pipe');
    this._pipeClampMesh = this._createInstancedMesh(this._pipeClampGeo, this._baseMat, 8, 'background.pipe');
    this._pipeSeamMesh = this._createInstancedMesh(this._pipeSeamGeo, this._emissiveMat, 8, 'background.pipe');
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
    this._spireBodyMesh = this._createInstancedMesh(this._spireBodyGeo, this._baseMat, 3, 'background.spire');
    this._spireCrownMesh = this._createInstancedMesh(this._spireCrownGeo, this._emissiveMat, 3, 'background.spire');
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
    this._ringBodyMesh = this._createInstancedMesh(this._ringBodyGeo, this._baseMat, 3, 'background.ring');
    this._ringCoreMesh = this._createInstancedMesh(this._ringCoreGeo, this._emissiveMat, 3, 'background.ring');
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
    this._dustOctaCyanMesh = this._createInstancedMesh(this._dustGeoOcta, this._dustMatCyan, 80, 'background.dust');
    this._dustOctaBlueMesh = this._createInstancedMesh(this._dustGeoOcta, this._dustMatBlue, 80, 'background.dust');
    this._dustTetraCyanMesh = this._createInstancedMesh(this._dustGeoTetra, this._dustMatCyan, 80, 'background.dust');
    this._dustTetraBlueMesh = this._createInstancedMesh(this._dustGeoTetra, this._dustMatBlue, 80, 'background.dust');
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
  }

  private _createInstancedMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    detail: string,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = count;
    markRenderCategory(mesh, RenderCategory.BACKGROUND, detail);
    this._scene.add(mesh);
    return mesh;
  }

  private _setInstanceTransform(
    mesh: THREE.InstancedMesh,
    index: number,
    position: THREE.Vector3Tuple,
    rotation: THREE.Euler,
    scale: THREE.Vector3Tuple = [1, 1, 1],
  ): void {
    this._instanceHelper.position.set(...position);
    this._instanceHelper.rotation.copy(rotation);
    this._instanceHelper.scale.set(...scale);
    this._instanceHelper.updateMatrix();
    mesh.setMatrixAt(index, this._instanceHelper.matrix);
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
  }

  private _updateArches(dt: number): void {
    const dx = this.baseSpeed * 1.25 * dt;
    let panelIndex = 0;
    let indicatorIndex = 0;

    for (let i = 0; i < this._arches.length; i++) {
      const arch = this._arches[i]!;
      arch.x -= dx;
      if (arch.x < -HALF_W - 130) {
        arch.x = HALF_W + 130 + Math.random() * 120;
      }

      this._rotationEuler.set(0, 0, 0);
      this._setInstanceTransform(this._archRingMesh, i, [arch.x, arch.y, arch.z], this._rotationEuler);
      this._setInstanceTransform(this._archTrimMesh, i, [arch.x, arch.y, arch.z], this._rotationEuler);
      this._setInstanceTransform(this._archOuterTrimMesh, i, [arch.x, arch.y, arch.z], this._rotationEuler);

      this._setInstanceTransform(this._archPanelMesh, panelIndex++, [arch.x, arch.y + 235, arch.z], this._rotationEuler);
      this._setInstanceTransform(this._archPanelMesh, panelIndex++, [arch.x, arch.y - 235, arch.z], this._rotationEuler);
      this._setInstanceTransform(this._archIndicatorMesh, indicatorIndex++, [arch.x, arch.y + 205, arch.z], this._rotationEuler);
      this._setInstanceTransform(this._archIndicatorMesh, indicatorIndex++, [arch.x, arch.y - 205, arch.z], this._rotationEuler);
    }

    this._archRingMesh.instanceMatrix.needsUpdate = true;
    this._archTrimMesh.instanceMatrix.needsUpdate = true;
    this._archOuterTrimMesh.instanceMatrix.needsUpdate = true;
    this._archPanelMesh.instanceMatrix.needsUpdate = true;
    this._archIndicatorMesh.instanceMatrix.needsUpdate = true;
  }

  private _updateTowers(dt: number): void {
    const dx = this.baseSpeed * 0.70 * dt;
    let bladeIndex = 0;

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
      this._setInstanceTransform(this._towerBaseMesh, i, [tower.x, tower.y, tower.z], this._rotationEuler);
      this._setInstanceTransform(this._towerHubMesh, i, [tower.x, tower.y + (10 * yDir), tower.z + 5], this._rotationEuler);
      this._setInstanceTransform(this._towerVentMesh, i, [tower.x, tower.y + (56 * yDir), tower.z], this._rotationEuler);

      this._rotationEuler.set(0, 0, rotationZ + tower.bladeRotation);
      this._setInstanceTransform(this._towerBladeMesh, bladeIndex++, [tower.x, tower.y + (10 * yDir), tower.z + 5], this._rotationEuler);
      this._rotationEuler.set(0, 0, rotationZ + tower.bladeRotation + Math.PI / 2);
      this._setInstanceTransform(this._towerBladeMesh, bladeIndex++, [tower.x, tower.y + (10 * yDir), tower.z + 5], this._rotationEuler);
    }

    this._towerBaseMesh.instanceMatrix.needsUpdate = true;
    this._towerHubMesh.instanceMatrix.needsUpdate = true;
    this._towerVentMesh.instanceMatrix.needsUpdate = true;
    this._towerBladeMesh.instanceMatrix.needsUpdate = true;
  }

  private _updatePipes(dt: number): void {
    const dx = this.baseSpeed * 0.65 * dt;
    let clampIndex = 0;
    let seamIndex = 0;

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
      this._setInstanceTransform(this._pipeBodyMesh, i, [pipe.x, pipe.y, pipe.z], this._rotationEuler);
      this._setInstanceTransform(this._pipeClampMesh, clampIndex++, [pipe.x - 75, pipe.y, pipe.z], this._rotationEuler);
      this._setInstanceTransform(this._pipeClampMesh, clampIndex++, [pipe.x + 75, pipe.y, pipe.z], this._rotationEuler);
      this._setInstanceTransform(this._pipeSeamMesh, seamIndex++, [pipe.x - 75, pipe.y, pipe.z], this._rotationEuler);
      this._setInstanceTransform(this._pipeSeamMesh, seamIndex++, [pipe.x + 75, pipe.y, pipe.z], this._rotationEuler);
    }

    this._pipeBodyMesh.instanceMatrix.needsUpdate = true;
    this._pipeClampMesh.instanceMatrix.needsUpdate = true;
    this._pipeSeamMesh.instanceMatrix.needsUpdate = true;
  }

  private _updateSpires(dt: number): void {
    const dx = this.baseSpeed * 0.25 * dt;

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
      this._setInstanceTransform(this._spireBodyMesh, i, [spire.x, spire.y, spire.z], this._rotationEuler);
      this._setInstanceTransform(this._spireCrownMesh, i, [spire.x, spire.y + (240 * yDir), spire.z], this._rotationEuler);
    }

    this._spireBodyMesh.instanceMatrix.needsUpdate = true;
    this._spireCrownMesh.instanceMatrix.needsUpdate = true;
  }

  private _updateRings(dt: number): void {
    const dx = this.baseSpeed * 0.20 * dt;

    for (let i = 0; i < this._rings.length; i++) {
      const ring = this._rings[i]!;
      ring.x -= dx;
      ring.rotationY += 0.22 * dt;

      if (ring.x < -HALF_W - 130) {
        ring.x = HALF_W + 130 + Math.random() * 120;
        ring.y = (Math.random() - 0.5) * 90;
      }

      this._rotationEuler.set(0, ring.rotationY, 0);
      this._setInstanceTransform(this._ringBodyMesh, i, [ring.x, ring.y, ring.z], this._rotationEuler);
      this._setInstanceTransform(this._ringCoreMesh, i, [ring.x, ring.y, ring.z], this._rotationEuler);
    }

    this._ringBodyMesh.instanceMatrix.needsUpdate = true;
    this._ringCoreMesh.instanceMatrix.needsUpdate = true;
  }

  private _updateDust(dt: number): void {
    const counts = {
      octaCyan: 0,
      octaBlue: 0,
      tetraCyan: 0,
      tetraBlue: 0,
    };

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
        this._setInstanceTransform(this._dustOctaCyanMesh, counts.octaCyan++, [dust.x, dust.y, dust.z], this._rotationEuler);
      } else if (dust.kind === 'octa' && dust.color === 'blue') {
        this._setInstanceTransform(this._dustOctaBlueMesh, counts.octaBlue++, [dust.x, dust.y, dust.z], this._rotationEuler);
      } else if (dust.kind === 'tetra' && dust.color === 'cyan') {
        this._setInstanceTransform(this._dustTetraCyanMesh, counts.tetraCyan++, [dust.x, dust.y, dust.z], this._rotationEuler);
      } else {
        this._setInstanceTransform(this._dustTetraBlueMesh, counts.tetraBlue++, [dust.x, dust.y, dust.z], this._rotationEuler);
      }
    }

    this._dustOctaCyanMesh.count = counts.octaCyan;
    this._dustOctaBlueMesh.count = counts.octaBlue;
    this._dustTetraCyanMesh.count = counts.tetraCyan;
    this._dustTetraBlueMesh.count = counts.tetraBlue;
    this._dustOctaCyanMesh.instanceMatrix.needsUpdate = true;
    this._dustOctaBlueMesh.instanceMatrix.needsUpdate = true;
    this._dustTetraCyanMesh.instanceMatrix.needsUpdate = true;
    this._dustTetraBlueMesh.instanceMatrix.needsUpdate = true;
  }

  destroy(): void {
    if (this._nebulaMesh) {
      this._scene.remove(this._nebulaMesh);
      this._nebulaMesh.geometry.dispose();
      (this._nebulaMesh.material as THREE.Material).dispose();
      this._nebulaMesh = null;
    }

    for (const mesh of [
      this._archRingMesh,
      this._archPanelMesh,
      this._archIndicatorMesh,
      this._archTrimMesh,
      this._archOuterTrimMesh,
      this._towerBaseMesh,
      this._towerHubMesh,
      this._towerBladeMesh,
      this._towerVentMesh,
      this._pipeBodyMesh,
      this._pipeClampMesh,
      this._pipeSeamMesh,
      this._spireBodyMesh,
      this._spireCrownMesh,
      this._ringBodyMesh,
      this._ringCoreMesh,
      this._dustOctaCyanMesh,
      this._dustOctaBlueMesh,
      this._dustTetraCyanMesh,
      this._dustTetraBlueMesh,
    ]) {
      this._scene.remove(mesh);
    }

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
