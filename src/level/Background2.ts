import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

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

  private _columnBodyMesh: THREE.InstancedMesh;
  private _columnRibMesh: THREE.InstancedMesh;
  private _columnLightMesh: THREE.InstancedMesh;
  private _turbineChassisMesh: THREE.InstancedMesh;
  private _turbineStrutMesh: THREE.InstancedMesh;
  private _turbineCoreMesh: THREE.InstancedMesh;
  private _turbineBladeMesh: THREE.InstancedMesh;
  private _pipelinePipeMesh: THREE.InstancedMesh;
  private _pipelineClampMesh: THREE.InstancedMesh;
  private _pipelineSeamMesh: THREE.InstancedMesh;
  private _gearSpindleMesh: THREE.InstancedMesh;
  private _gearBodyMesh: THREE.InstancedMesh;
  private _sparkTealOctMesh: THREE.InstancedMesh;
  private _sparkTealTetMesh: THREE.InstancedMesh;
  private _sparkAmberOctMesh: THREE.InstancedMesh;
  private _sparkAmberTetMesh: THREE.InstancedMesh;

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
  private _instanceHelper: THREE.Object3D;

  constructor(scene: IScene, baseSpeed: number = 120) {
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

    this._columnBodyMesh = new THREE.InstancedMesh(this._columnBodyGeo, this._baseMat, this._columnEntries.length);
    this._columnRibMesh = new THREE.InstancedMesh(this._columnRibGeo, this._baseMat, this._columnEntries.length * 2);
    this._columnLightMesh = new THREE.InstancedMesh(this._columnLightGeo, this._tealGlow, this._columnEntries.length * 6);
    this._turbineChassisMesh = new THREE.InstancedMesh(this._turbineChassisGeo, this._baseMat, this._turbineEntries.length);
    this._turbineStrutMesh = new THREE.InstancedMesh(this._turbineStrutGeo, this._baseMat, this._turbineEntries.length * 2);
    this._turbineCoreMesh = new THREE.InstancedMesh(this._turbineCoreGeo, this._amberGlow, this._turbineEntries.length);
    this._turbineBladeMesh = new THREE.InstancedMesh(this._turbineBladeGeo, this._baseMat, this._turbineEntries.length * 6);
    this._pipelinePipeMesh = new THREE.InstancedMesh(this._pipelinePipeGeo, this._baseMat, this._pipelineEntries.length);
    this._pipelineClampMesh = new THREE.InstancedMesh(this._pipelineClampGeo, this._baseMat, this._pipelineEntries.length * 2);
    this._pipelineSeamMesh = new THREE.InstancedMesh(this._pipelineSeamGeo, this._tealGlow, this._pipelineEntries.length * 2);
    this._gearSpindleMesh = new THREE.InstancedMesh(this._gearSpindleGeo, this._amberGlow, this._gearEntries.length);
    this._gearBodyMesh = new THREE.InstancedMesh(this._gearBodyGeo, this._baseMat, this._gearEntries.length);

    const tealOctCount = this._sparkEntries.filter((spark) => spark.isTeal && spark.isOct).length;
    const tealTetCount = this._sparkEntries.filter((spark) => spark.isTeal && !spark.isOct).length;
    const amberOctCount = this._sparkEntries.filter((spark) => !spark.isTeal && spark.isOct).length;
    const amberTetCount = this._sparkEntries.filter((spark) => !spark.isTeal && !spark.isOct).length;

    this._sparkTealOctMesh = new THREE.InstancedMesh(this._sparkGeoOct, this._tealGlow, tealOctCount);
    this._sparkTealTetMesh = new THREE.InstancedMesh(this._sparkGeoTet, this._tealGlow, tealTetCount);
    this._sparkAmberOctMesh = new THREE.InstancedMesh(this._sparkGeoOct, this._amberGlow, amberOctCount);
    this._sparkAmberTetMesh = new THREE.InstancedMesh(this._sparkGeoTet, this._amberGlow, amberTetCount);

    for (const mesh of [
      this._columnBodyMesh,
      this._columnRibMesh,
      this._columnLightMesh,
      this._turbineChassisMesh,
      this._turbineStrutMesh,
      this._turbineCoreMesh,
      this._turbineBladeMesh,
      this._pipelinePipeMesh,
      this._pipelineClampMesh,
      this._pipelineSeamMesh,
      this._gearSpindleMesh,
      this._gearBodyMesh,
      this._sparkTealOctMesh,
      this._sparkTealTetMesh,
      this._sparkAmberOctMesh,
      this._sparkAmberTetMesh,
    ]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    markRenderCategory(this._columnBodyMesh, RenderCategory.BACKGROUND, 'background.column');
    markRenderCategory(this._columnRibMesh, RenderCategory.BACKGROUND, 'background.column');
    markRenderCategory(this._columnLightMesh, RenderCategory.BACKGROUND, 'background.column');
    markRenderCategory(this._turbineChassisMesh, RenderCategory.BACKGROUND, 'background.turbine');
    markRenderCategory(this._turbineStrutMesh, RenderCategory.BACKGROUND, 'background.turbine');
    markRenderCategory(this._turbineCoreMesh, RenderCategory.BACKGROUND, 'background.turbine');
    markRenderCategory(this._turbineBladeMesh, RenderCategory.BACKGROUND, 'background.turbine');
    markRenderCategory(this._pipelinePipeMesh, RenderCategory.BACKGROUND, 'background.pipe');
    markRenderCategory(this._pipelineClampMesh, RenderCategory.BACKGROUND, 'background.pipe');
    markRenderCategory(this._pipelineSeamMesh, RenderCategory.BACKGROUND, 'background.pipe');
    markRenderCategory(this._gearSpindleMesh, RenderCategory.BACKGROUND, 'background.gear');
    markRenderCategory(this._gearBodyMesh, RenderCategory.BACKGROUND, 'background.gear');
    markRenderCategory(this._sparkTealOctMesh, RenderCategory.BACKGROUND, 'background.spark');
    markRenderCategory(this._sparkTealTetMesh, RenderCategory.BACKGROUND, 'background.spark');
    markRenderCategory(this._sparkAmberOctMesh, RenderCategory.BACKGROUND, 'background.spark');
    markRenderCategory(this._sparkAmberTetMesh, RenderCategory.BACKGROUND, 'background.spark');

    this._scene.add(this._columnBodyMesh);
    this._scene.add(this._columnRibMesh);
    this._scene.add(this._columnLightMesh);
    this._scene.add(this._turbineChassisMesh);
    this._scene.add(this._turbineStrutMesh);
    this._scene.add(this._turbineCoreMesh);
    this._scene.add(this._turbineBladeMesh);
    this._scene.add(this._pipelinePipeMesh);
    this._scene.add(this._pipelineClampMesh);
    this._scene.add(this._pipelineSeamMesh);
    this._scene.add(this._gearSpindleMesh);
    this._scene.add(this._gearBodyMesh);
    this._scene.add(this._sparkTealOctMesh);
    this._scene.add(this._sparkTealTetMesh);
    this._scene.add(this._sparkAmberOctMesh);
    this._scene.add(this._sparkAmberTetMesh);

    this._instanceHelper = new THREE.Object3D();
    this.update(0);
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

  private _wrapX(currentX: number, wrapPad: number): number {
    if (currentX >= -HALF_W - wrapPad) return currentX;
    return currentX + GAME_WIDTH + wrapPad * 2;
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
      this._setInstanceTransform(this._columnBodyMesh, columnBodyIndex++, [column.x, column.y, column.z], new THREE.Euler(0, 0, 0));

      for (const offsetX of [-16, 16]) {
        this._setInstanceTransform(this._columnRibMesh, columnRibIndex++, [column.x + offsetX, column.y, column.z], new THREE.Euler(0, 0, 0));
      }
      for (const offsetY of [0, 120, -120]) {
        for (const offsetX of [-18, 18]) {
          this._setInstanceTransform(this._columnLightMesh, columnLightIndex++, [column.x + offsetX, column.y + offsetY, column.z], new THREE.Euler(0, 0, 0));
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
      this._setInstanceTransform(this._turbineChassisMesh, turbineChassisIndex++, center, new THREE.Euler(0, 0, 0));
      this._setInstanceTransform(this._turbineStrutMesh, turbineStrutIndex++, center, new THREE.Euler(0, 0, 0));
      this._setInstanceTransform(this._turbineStrutMesh, turbineStrutIndex++, center, new THREE.Euler(0, 0, Math.PI / 2));
      this._setInstanceTransform(this._turbineCoreMesh, turbineCoreIndex++, center, new THREE.Euler(0, 0, 0));

      for (let i = 0; i < 6; i++) {
        this._setInstanceTransform(
          this._turbineBladeMesh,
          turbineBladeIndex++,
          center,
          new THREE.Euler(0, 0, turbine.bladeRotation + (i * Math.PI) / 3),
        );
      }
    }

    for (const pipe of this._pipelineEntries) {
      pipe.x = this._wrapX(pipe.x - this.baseSpeed * pipe.speedMult * dt, 180);
      if (pipe.x > HALF_W + 180) {
        const ySign = Math.random() > 0.5 ? 1 : -1;
        pipe.y = ySign * (180 + Math.random() * 20);
      }
      const center = [pipe.x, pipe.y, pipe.z] as THREE.Vector3Tuple;
      this._setInstanceTransform(this._pipelinePipeMesh, pipelinePipeIndex++, center, new THREE.Euler(0, 0, 0));
      for (const offsetX of [-80, 80]) {
        this._setInstanceTransform(this._pipelineClampMesh, pipelineClampIndex++, [pipe.x + offsetX, pipe.y, pipe.z], new THREE.Euler(0, 0, 0));
        this._setInstanceTransform(this._pipelineSeamMesh, pipelineSeamIndex++, [pipe.x + offsetX, pipe.y, pipe.z], new THREE.Euler(0, 0, 0));
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
      this._setInstanceTransform(this._gearBodyMesh, gearBodyIndex++, center, baseRot);
      this._setInstanceTransform(this._gearSpindleMesh, gearSpindleIndex++, center, baseRot);
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

      this._setInstanceTransform(
        targetMesh,
        targetIndex,
        [spark.x, spark.y, spark.z],
        new THREE.Euler(spark.rotX, spark.rotY, spark.rotZ),
        [scale, scale, scale],
      );
    }

    this._columnBodyMesh.count = columnBodyIndex;
    this._columnRibMesh.count = columnRibIndex;
    this._columnLightMesh.count = columnLightIndex;
    this._turbineChassisMesh.count = turbineChassisIndex;
    this._turbineStrutMesh.count = turbineStrutIndex;
    this._turbineCoreMesh.count = turbineCoreIndex;
    this._turbineBladeMesh.count = turbineBladeIndex;
    this._pipelinePipeMesh.count = pipelinePipeIndex;
    this._pipelineClampMesh.count = pipelineClampIndex;
    this._pipelineSeamMesh.count = pipelineSeamIndex;
    this._gearBodyMesh.count = gearBodyIndex;
    this._gearSpindleMesh.count = gearSpindleIndex;
    this._sparkTealOctMesh.count = sparkTealOctIndex;
    this._sparkTealTetMesh.count = sparkTealTetIndex;
    this._sparkAmberOctMesh.count = sparkAmberOctIndex;
    this._sparkAmberTetMesh.count = sparkAmberTetIndex;

    for (const mesh of [
      this._columnBodyMesh,
      this._columnRibMesh,
      this._columnLightMesh,
      this._turbineChassisMesh,
      this._turbineStrutMesh,
      this._turbineCoreMesh,
      this._turbineBladeMesh,
      this._pipelinePipeMesh,
      this._pipelineClampMesh,
      this._pipelineSeamMesh,
      this._gearSpindleMesh,
      this._gearBodyMesh,
      this._sparkTealOctMesh,
      this._sparkTealTetMesh,
      this._sparkAmberOctMesh,
      this._sparkAmberTetMesh,
    ]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
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
      this._columnBodyMesh,
      this._columnRibMesh,
      this._columnLightMesh,
      this._turbineChassisMesh,
      this._turbineStrutMesh,
      this._turbineCoreMesh,
      this._turbineBladeMesh,
      this._pipelinePipeMesh,
      this._pipelineClampMesh,
      this._pipelineSeamMesh,
      this._gearSpindleMesh,
      this._gearBodyMesh,
      this._sparkTealOctMesh,
      this._sparkTealTetMesh,
      this._sparkAmberOctMesh,
      this._sparkAmberTetMesh,
    ]) {
      this._scene.remove(mesh);
    }

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
