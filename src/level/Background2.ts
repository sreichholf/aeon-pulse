import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

const HALF_W = GAME_WIDTH  / 2;
const HALF_H = GAME_HEIGHT / 2;

// Simple and highly optimized background depth color gradient
const FRAG = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float distY = abs(uv.y - 0.5) * 2.0;

    // Deep carbon-blue metallic gradient simulating hangar depth void
    vec3 col = mix(vec3(0.01, 0.02, 0.03), vec3(0.05, 0.07, 0.11), 1.0 - distY);
    col *= mix(1.0, 0.20, pow(distY, 3.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface StructEntry {
  mesh: THREE.Group;
  speedMult: number;
  type: string;
  gearSpeed?: number;
}

interface SparkEntry {
  mesh: THREE.Mesh;
  speedMult: number;
  rx: number;
  ry: number;
  rz: number;
  phase: number;
  flickerSpeed: number;
  mat: THREE.MeshBasicMaterial;
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

  private _structures: StructEntry[];

  private _sparks: SparkEntry[];
  private _sparkGeoOct: THREE.OctahedronGeometry;
  private _sparkGeoTet: THREE.TetrahedronGeometry;

  constructor(scene: IScene, baseSpeed: number = 120) {
    this._scene    = scene;
    this.baseSpeed = baseSpeed;
    this._time     = 0;

    // ── 1. Background Void Depth Mesh ──
    const mat = new THREE.ShaderMaterial({
      uniforms:       { uTime: { value: 0 } },
      vertexShader:   STANDARD_VERT,
      fragmentShader: FRAG,
      depthWrite:     false,
    });
    const geo = new THREE.PlaneGeometry(GAME_WIDTH, GAME_HEIGHT);
    this._bgMesh = new THREE.Mesh(geo, mat);
    markRenderCategory(this._bgMesh, RenderCategory.BACKGROUND);
    this._bgMesh.position.z = -100;
    this._bgMesh.scale.set(1.4, 1.4, 1.0); // Scale up to ensure full screen coverage under tilt
    scene.add(this._bgMesh);
    this._mat = mat;

    // ── 2. Shared Background Materials ──
    // Dark metallic steel for background structures
    this._baseMat = new THREE.MeshPhongMaterial({
      color: 0x2d323f,
      specular: 0x556688,
      shininess: 65,
      flatShading: true,
    });

    // Pulse industrial teal for indicators and seams
    this._tealGlow = new THREE.MeshBasicMaterial({
      color: 0x00d5ff,
      transparent: true,
      opacity: 0.90,
    });

    // Glowing warning amber for furnace cores and axles
    this._amberGlow = new THREE.MeshBasicMaterial({
      color: 0xff7700,
      transparent: true,
      opacity: 0.90,
    });

    // ── 3. Initialize Reusable Hangar Structures Pool ──
    this._structures = [];

    // --- Layer A: Midground Columns (Z = -45, speedMult = 0.75, 6 items) ---
    for (let i = 0; i < 6; i++) {
      const col = this._buildColumn(this._baseMat);
      col.position.set(
        -HALF_W - 50 + i * (GAME_WIDTH / 4) + (Math.random() - 0.5) * 60,
        0,
        -45
      );
      scene.add(col);
      this._structures.push({
        mesh: col,
        speedMult: 0.75,
        type: 'column',
      });
    }

    // --- Layer B: Midground Turbines (Z = -60, speedMult = 0.60, 4 items) ---
    for (let i = 0; i < 4; i++) {
      const turbine = this._buildTurbine(this._baseMat);
      const ySign = i % 2 === 0 ? 1 : -1;
      const yOffset = ySign * (110 + Math.random() * 30);
      turbine.position.set(
        -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        yOffset,
        -60
      );
      scene.add(turbine);
      this._structures.push({
        mesh: turbine,
        speedMult: 0.60,
        type: 'turbine',
      });
    }

    // --- Layer C: Midground Cooling Conduits (Z = -65, speedMult = 0.55, 4 items) ---
    for (let i = 0; i < 4; i++) {
      const pipe = this._buildPipeline(this._baseMat);
      const ySign = i % 2 === 0 ? 1 : -1;
      const yOffset = ySign * (180 + Math.random() * 20);
      pipe.position.set(
        -HALF_W - 100 + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        yOffset,
        -65
      );
      scene.add(pipe);
      this._structures.push({
        mesh: pipe,
        speedMult: 0.55,
        type: 'pipe',
      });
    }

    // --- Layer D: Far Background Colossal Gears (Z = -90, speedMult = 0.25, 4 items) ---
    for (let i = 0; i < 4; i++) {
      const gear = this._buildGear(this._baseMat);
      const yOffset = (i % 2 === 0 ? 1 : -1) * (50 + Math.random() * 40);
      gear.position.set(
        -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 120,
        yOffset,
        -90
      );
      const gearSpeed = (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.4);
      scene.add(gear);
      this._structures.push({
        mesh: gear,
        speedMult: 0.25,
        type: 'gear',
        gearSpeed,
      });
    }

    // ── 4. Turbine Sparks & Embers (60 items with unique opacity flickering) ──
    this._sparks = [];
    this._sparkGeoOct = new THREE.OctahedronGeometry(1.4);
    this._sparkGeoTet = new THREE.TetrahedronGeometry(1.1);

    for (let i = 0; i < 60; i++) {
      const isTeal = Math.random() > 0.5;
      const mat = isTeal ? this._tealGlow.clone() : this._amberGlow.clone();
      const geo = Math.random() > 0.5 ? this._sparkGeoOct : this._sparkGeoTet;
      const mesh = new THREE.Mesh(geo, mat);

      const zDepth = -12 - Math.random() * 83; // depth range Z = -12 to -95
      const speedMult = 0.15 + (1.0 - (Math.abs(zDepth) - 12) / 83) * 1.15;

      mesh.position.set(
        (Math.random() - 0.5) * GAME_WIDTH * 1.5,
        (Math.random() - 0.5) * GAME_HEIGHT * 1.2,
        zDepth
      );

      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const rx = (Math.random() - 0.5) * 2.5;
      const ry = (Math.random() - 0.5) * 2.5;
      const rz = (Math.random() - 0.5) * 2.5;

      const phase = Math.random() * Math.PI * 2;
      const flickerSpeed = 5 + Math.random() * 8;

      scene.add(mesh);
      this._sparks.push({ mesh, speedMult, rx, ry, rz, phase, flickerSpeed, mat });
    }
  }

  // ── 3D Procedural Background Builders ──

  private _buildColumn(baseMat: THREE.MeshPhongMaterial): THREE.Group {
    const group = new THREE.Group();

    // Main column body
    const colGeo = new THREE.BoxGeometry(36, 540, 24);
    const body = new THREE.Mesh(colGeo, baseMat);
    group.add(body);

    // Symmetrical structural reinforcement panels
    const ribGeo = new THREE.BoxGeometry(8, 180, 26);
    const leftRib = new THREE.Mesh(ribGeo, baseMat);
    leftRib.position.set(-16, 0, 0);
    const rightRib = new THREE.Mesh(ribGeo, baseMat);
    rightRib.position.set(16, 0, 0);
    group.add(leftRib, rightRib);

    // Pulsing industrial teal indicator lights
    const lightGeo = new THREE.BoxGeometry(4, 16, 26.2);
    const leftLight = new THREE.Mesh(lightGeo, this._tealGlow);
    leftLight.position.set(-18, 0, 0);
    const rightLight = new THREE.Mesh(lightGeo, this._tealGlow);
    rightLight.position.set(18, 0, 0);
    group.add(leftLight, rightLight);

    const leftLight2 = new THREE.Mesh(lightGeo, this._tealGlow);
    leftLight2.position.set(-18, 120, 0);
    const rightLight2 = new THREE.Mesh(lightGeo, this._tealGlow);
    rightLight2.position.set(18, 120, 0);
    const leftLight3 = new THREE.Mesh(lightGeo, this._tealGlow);
    leftLight3.position.set(-18, -120, 0);
    const rightLight3 = new THREE.Mesh(lightGeo, this._tealGlow);
    rightLight3.position.set(18, -120, 0);
    group.add(leftLight2, rightLight2, leftLight3, rightLight3);

    return group;
  }

  private _buildTurbine(baseMat: THREE.MeshPhongMaterial): THREE.Group {
    const group = new THREE.Group();

    // Outer chassis ring
    const chassisGeo = new THREE.TorusGeometry(36, 6, 6, 12);
    const chassis = new THREE.Mesh(chassisGeo, baseMat);
    group.add(chassis);

    // Support struts
    const strutGeo = new THREE.BoxGeometry(6, 90, 8);
    const strutV = new THREE.Mesh(strutGeo, baseMat);
    const strutH = new THREE.Mesh(strutGeo, baseMat);
    strutH.rotation.z = Math.PI / 2;
    group.add(strutV, strutH);

    // Glowing amber furnace core
    const coreGeo = new THREE.CylinderGeometry(16, 16, 12, 8);
    coreGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, this._amberGlow);
    group.add(core);

    // Spinning turbine blades (rapid Z spin in update loop)
    const blades = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(26, 4, 1.5);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(bladeGeo, baseMat);
      b.rotation.z = (i * Math.PI) / 3;
      blades.add(b);
    }
    group.userData = { blades };
    group.add(blades);

    return group;
  }

  private _buildPipeline(baseMat: THREE.MeshPhongMaterial): THREE.Group {
    const group = new THREE.Group();

    // Main horizontal pipeline cylinder
    const pipeGeo = new THREE.CylinderGeometry(8, 8, 300, 8);
    pipeGeo.rotateZ(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, baseMat);
    group.add(pipe);

    // Structural connection brackets
    const clampGeo = new THREE.CylinderGeometry(11, 11, 14, 8);
    clampGeo.rotateZ(Math.PI / 2);
    const leftClamp = new THREE.Mesh(clampGeo, baseMat);
    leftClamp.position.x = -80;
    const rightClamp = new THREE.Mesh(clampGeo, baseMat);
    rightClamp.position.x = 80;
    group.add(leftClamp, rightClamp);

    // Glowing teal energy seams
    const seamGeo = new THREE.CylinderGeometry(9, 9, 3, 8);
    seamGeo.rotateZ(Math.PI / 2);
    const leftSeam = new THREE.Mesh(seamGeo, this._tealGlow);
    leftSeam.position.x = -80;
    const rightSeam = new THREE.Mesh(seamGeo, this._tealGlow);
    rightSeam.position.x = 80;
    group.add(leftSeam, rightSeam);

    return group;
  }

  private _buildGear(baseMat: THREE.MeshPhongMaterial): THREE.Group {
    const group = new THREE.Group();

    // Hub cylinder
    const hubGeo = new THREE.CylinderGeometry(14, 14, 8, 8);
    hubGeo.rotateX(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, baseMat);
    group.add(hub);

    // Glowing amber spindle core
    const spindleGeo = new THREE.CylinderGeometry(6, 6, 9, 8);
    spindleGeo.rotateX(Math.PI / 2);
    const spindle = new THREE.Mesh(spindleGeo, this._amberGlow);
    group.add(spindle);

    // Outer gear rim ring
    const rimGeo = new THREE.TorusGeometry(48, 5, 6, 16);
    const rim = new THREE.Mesh(rimGeo, baseMat);
    group.add(rim);

    // 4 connect spokes
    const spokeGeo = new THREE.BoxGeometry(4, 96, 4);
    const spokeV = new THREE.Mesh(spokeGeo, baseMat);
    const spokeH = new THREE.Mesh(spokeGeo, baseMat);
    spokeH.rotation.z = Math.PI / 2;
    group.add(spokeV, spokeH);

    // 12 Gear teeth protrusions around the perimeter
    const toothGeo = new THREE.BoxGeometry(8, 6, 6);
    for (let i = 0; i < 12; i++) {
      const theta = (i * Math.PI) / 6;
      const tooth = new THREE.Mesh(toothGeo, baseMat);
      tooth.position.set(Math.cos(theta) * 52, Math.sin(theta) * 52, 0);
      tooth.rotation.z = theta;
      group.add(tooth);
    }

    return group;
  }

  // ── Parallax Scrolling & Animation Loop ──

  update(dt: number): void {
    this._time += dt;
    if (this._mat) this._mat.uniforms['uTime']!.value = this._time;

    // --- 1. Scroll and Wrap 3D Hangar Structures ---
    for (const struct of this._structures) {
      const dx = this.baseSpeed * struct.speedMult * dt;
      struct.mesh.position.x -= dx;

      // Visual wrapping at bounds
      if (struct.mesh.position.x < -HALF_W - 180) {
        struct.mesh.position.x += GAME_WIDTH + 360;

        // Randomize Y slightly to diversify repeating patterns
        if (struct.type === 'turbine') {
          const ySign = Math.random() > 0.5 ? 1 : -1;
          struct.mesh.position.y = ySign * (110 + Math.random() * 30);
        } else if (struct.type === 'pipe') {
          const ySign = Math.random() > 0.5 ? 1 : -1;
          struct.mesh.position.y = ySign * (180 + Math.random() * 20);
        } else if (struct.type === 'gear') {
          const ySign = Math.random() > 0.5 ? 1 : -1;
          struct.mesh.position.y = ySign * (50 + Math.random() * 40);
        }
      }

      // Active gear rotation
      if (struct.type === 'gear' && struct.gearSpeed !== undefined) {
        struct.mesh.rotation.z += struct.gearSpeed * dt;
      }

      // Rapid turbine blade generator rotation
      if (struct.type === 'turbine' && struct.mesh.userData.blades) {
        struct.mesh.userData.blades.rotation.z += 8.0 * dt;
      }
    }

    // --- 2. Scroll, Tumble, and Flicker 3D Spark Crystals ---
    for (const spark of this._sparks) {
      const dx = this.baseSpeed * spark.speedMult * dt;
      spark.mesh.position.x -= dx;

      // Tumbling rotation
      spark.mesh.rotation.x += spark.rx * dt;
      spark.mesh.rotation.y += spark.ry * dt;
      spark.mesh.rotation.z += spark.rz * dt;

      // Dynmamic opacity flicker
      spark.mat.opacity = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(this._time * spark.flickerSpeed + spark.phase));

      // Wrap sparks
      if (spark.mesh.position.x < -HALF_W - 50) {
        spark.mesh.position.x = HALF_W + 50 + Math.random() * 100;
        spark.mesh.position.y = (Math.random() - 0.5) * GAME_HEIGHT * 1.2;
      }
    }
  }

  // ── GPU Memory Clean-up ──

  destroy(): void {
    if (this._bgMesh) {
      this._scene.remove(this._bgMesh);
      this._bgMesh.geometry.dispose();
      (this._bgMesh.material as THREE.Material).dispose();
      this._bgMesh = null;
    }
    this._mat = null;

    // Destroy structural meshes recursively
    for (const struct of this._structures) {
      this._scene.remove(struct.mesh);
      this._destroyHierarchy(struct.mesh);
    }
    this._structures = [];

    // Destroy spark crystals
    for (const spark of this._sparks) {
      this._scene.remove(spark.mesh);
      spark.mesh.geometry.dispose();
      spark.mat.dispose(); // unique cloned materials disposed cleanly
    }
    this._sparks = [];

    // Dispose shared geometries
    this._sparkGeoOct.dispose();
    this._sparkGeoTet.dispose();

    // Dispose shared structural materials
    this._baseMat.dispose();
    this._tealGlow.dispose();
    this._amberGlow.dispose();
  }

  private _destroyHierarchy(node: THREE.Object3D): void {
    node.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        // Base materials are disposed once at the end of destroy()
      }
    });
  }
}
