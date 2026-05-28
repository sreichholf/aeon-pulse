import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';

const HALF_W = GAME_WIDTH  / 2;
const HALF_H = GAME_HEIGHT / 2;

// Simple and highly optimized background deep organic gradient void
const FRAG = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float distY = abs(uv.y - 0.5) * 2.0;

    // Deep organic violet-crimson void gradient
    vec3 col = mix(vec3(0.006, 0.001, 0.008), vec3(0.035, 0.005, 0.02), 1.0 - distY);
    col *= mix(1.0, 0.15, pow(distY, 3.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface StructEntry {
  mesh: THREE.Group;
  speedMult: number;
  type: string;
  phase?: number;
  rotSpeed?: number;
  yPhase?: number;
  scalePhase?: number;
}

interface SporeEntry {
  mesh: THREE.Mesh;
  speedMult: number;
  rx: number;
  ry: number;
  rz: number;
  phase: number;
  flickerSpeed: number;
  mat: THREE.MeshBasicMaterial;
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

  // ── Shared Geometries ──
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

  private _structures: StructEntry[];
  private _spores: SporeEntry[];

  constructor(scene: IScene, baseSpeed: number = 130) {
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
    this._bgMesh.position.z = -100;
    this._bgMesh.scale.set(1.4, 1.4, 1.0); // Scale up to ensure full screen coverage under tilt
    scene.add(this._bgMesh);
    this._mat = mat;

    // ── 2. Shared Biological Materials (Optimized Visual Recess for Background Depth) ──
    // Glistening dark rose-crimson biological flesh tissue
    this._baseMat = new THREE.MeshPhongMaterial({
      color: 0x6e1b34,      // Dark organic rose-crimson
      emissive: 0x14030a,   // Deep-crimson backing
      specular: 0xaa7788,   // Glistening specularity
      shininess: 70,
      flatShading: true,
    });

    // Dusty calcified ivory bone
    this._boneMat = new THREE.MeshPhongMaterial({
      color: 0xa8a192,      // Receded ivory-white
      specular: 0x888888,
      shininess: 60,
      flatShading: true,
    });

    // Searing hot magenta veins
    this._glowMat = new THREE.MeshBasicMaterial({
      color: 0xff00aa,
      transparent: true,
      opacity: 0.90,
    });

    // Toxic yellow-green bioluminescent spores
    this._sporeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xb2ff00,
      transparent: true,
      opacity: 0.90,
    });

    // Searing amber biological core light
    this._amberGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff7700,
      transparent: true,
      opacity: 0.90,
    });

    // ── 3. Shared Geometries (Pre-allocated for locked 60 FPS) ──
    this._wombBodyGeo  = new THREE.SphereGeometry(18, 8, 8);
    this._wombLobeGeo  = new THREE.SphereGeometry(12, 6, 6);
    this._coreGeo      = new THREE.SphereGeometry(7, 6, 6);
    this._colShaftGeo  = new THREE.CylinderGeometry(5, 7, 540, 6);
    this._colRibGeo    = new THREE.SphereGeometry(8, 6, 6);
    this._pipeShaftGeo = new THREE.CylinderGeometry(6, 6, 300, 6);
    this._pipeSeamGeo  = new THREE.CylinderGeometry(6.6, 6.6, 4, 8);
    this._pipeBulbGeo  = new THREE.SphereGeometry(10, 6, 6);
    this._podBodyGeo   = new THREE.SphereGeometry(15, 6, 6);
    this._podSpikeGeo  = new THREE.ConeGeometry(4, 12, 5);
    this._podSporeGeo  = new THREE.SphereGeometry(4.5, 6, 6);
    this._crystalGeoOct = new THREE.OctahedronGeometry(1.4);
    this._crystalGeoTet = new THREE.TetrahedronGeometry(1.1);

    // ── 4. Initialize Reusable Organic Structures Pool ──
    this._structures = [];

    // --- Layer A: Fleshy Womb Sacs (Z = -45, speedMult = 0.65, 6 items) ---
    for (let i = 0; i < 6; i++) {
      const womb = this._buildWombSac(this._baseMat, this._glowMat, this._amberGlowMat);
      womb.position.set(
        -HALF_W - 50 + i * (GAME_WIDTH / 4) + (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 160,
        -45
      );
      const phase = Math.random() * Math.PI * 2;
      scene.add(womb);
      this._structures.push({
        mesh: womb,
        speedMult: 0.65,
        type: 'womb',
        phase,
      });
    }

    // --- Layer B: Calcified Bone Columns (Z = -60, speedMult = 0.40, 4 items) ---
    for (let i = 0; i < 4; i++) {
      const col = this._buildBoneColumn(this._boneMat);
      col.position.set(
        -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        0,
        -60
      );
      const rotSpeed = (Math.random() - 0.5) * 0.4;
      scene.add(col);
      this._structures.push({
        mesh: col,
        speedMult: 0.40,
        type: 'column',
        rotSpeed,
      });
    }

    // --- Layer C: Writhing Vein Conduits (Z = -65, speedMult = 0.30, 4 items) ---
    for (let i = 0; i < 4; i++) {
      const vein = this._buildVeinConduit(this._baseMat, this._glowMat);
      const ySign = i % 2 === 0 ? 1 : -1;
      const yOffset = ySign * (160 + Math.random() * 40);
      vein.position.set(
        -HALF_W - 100 + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        yOffset,
        -65
      );
      const yPhase = Math.random() * Math.PI * 2;
      scene.add(vein);
      this._structures.push({
        mesh: vein,
        speedMult: 0.30,
        type: 'vein',
        yPhase,
      });
    }

    // --- Layer D: Far Background Spore Pods (Z = -90, speedMult = 0.15, 4 items) ---
    for (let i = 0; i < 4; i++) {
      const pod = this._buildSporePod(this._baseMat, this._sporeGlowMat);
      const ySign = i % 2 === 0 ? 1 : -1;
      const yOffset = ySign * (80 + Math.random() * 40);
      pod.position.set(
        -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 120,
        yOffset,
        -90
      );
      const scalePhase = Math.random() * Math.PI * 2;
      scene.add(pod);
      this._structures.push({
        mesh: pod,
        speedMult: 0.15,
        type: 'pod',
        scalePhase,
      });
    }

    // ── 5. Bioluminescent Drifting Spores (60 items with unique opacity flickering) ──
    this._spores = [];

    for (let i = 0; i < 60; i++) {
      const isGreen = Math.random() > 0.5;
      const mat = isGreen ? this._sporeGlowMat.clone() : this._glowMat.clone();
      const geo = Math.random() > 0.5 ? this._crystalGeoOct : this._crystalGeoTet;
      const mesh = new THREE.Mesh(geo, mat);

      const zDepth = -12 - Math.random() * 83; // depth range Z = -12 to -95
      // Closer spores scroll faster
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
      this._spores.push({ mesh, speedMult, rx, ry, rz, phase, flickerSpeed, mat });
    }
  }

  // ── 3D Procedural Biological Organ Builders ──

  private _buildWombSac(
    baseMat: THREE.MeshPhongMaterial,
    glowMat: THREE.MeshBasicMaterial,
    amberMat: THREE.MeshBasicMaterial
  ): THREE.Group {
    const group = new THREE.Group();

    // Main womb body
    const body = new THREE.Mesh(this._wombBodyGeo, baseMat);
    body.scale.set(1.1, 0.9, 0.6); // flattened along Z
    group.add(body);

    // Overlapping smaller biological lobes
    const lobe1 = new THREE.Mesh(this._wombLobeGeo, baseMat);
    lobe1.position.set(-14, 8, -2);
    lobe1.scale.set(1.0, 1.2, 0.7);

    const lobe2 = new THREE.Mesh(this._wombLobeGeo, baseMat);
    lobe2.position.set(14, -8, -2);
    lobe2.scale.set(1.2, 1.0, 0.7);

    const lobe3 = new THREE.Mesh(this._wombLobeGeo, baseMat);
    lobe3.position.set(6, 12, -4);
    lobe3.scale.set(0.9, 0.9, 0.6);

    group.add(lobe1, lobe2, lobe3);

    // Glowing cellular amber core inside the lobes
    const core = new THREE.Mesh(this._coreGeo, amberMat);
    core.position.set(0, 0, 4); // protrudes slightly out forward
    group.add(core);

    // Glowing magenta seams/secretion dots
    const veinLight1 = new THREE.Mesh(this._podSporeGeo, glowMat);
    veinLight1.position.set(-10, -8, 8);
    const veinLight2 = new THREE.Mesh(this._podSporeGeo, glowMat);
    veinLight2.position.set(10, 8, 8);
    group.add(veinLight1, veinLight2);

    return group;
  }

  private _buildBoneColumn(boneMat: THREE.MeshPhongMaterial): THREE.Group {
    const group = new THREE.Group();

    // Central bone spine shaft
    const shaft = new THREE.Mesh(this._colShaftGeo, boneMat);
    group.add(shaft);

    // Ribbed vertebrae discs running down the spine
    const ribPositions = [-200, -100, 0, 100, 200];
    for (const y of ribPositions) {
      const rib = new THREE.Mesh(this._colRibGeo, boneMat);
      rib.position.y = y;
      rib.scale.set(1.6, 0.5, 1.6); // flattened vertebrae ring
      group.add(rib);
    }

    return group;
  }

  private _buildVeinConduit(baseMat: THREE.MeshPhongMaterial, glowMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Main horizontal vein pipeline
    const pipe = new THREE.Mesh(this._pipeShaftGeo, baseMat);
    pipe.rotation.z = Math.PI / 2; // aligned horizontally
    group.add(pipe);

    // Glowing magenta energy seams
    const seam1 = new THREE.Mesh(this._pipeSeamGeo, glowMat);
    seam1.position.x = -80;
    seam1.rotation.z = Math.PI / 2;

    const seam2 = new THREE.Mesh(this._pipeSeamGeo, glowMat);
    seam2.position.x = 80;
    seam2.rotation.z = Math.PI / 2;

    const seam3 = new THREE.Mesh(this._pipeSeamGeo, glowMat);
    seam3.position.x = 0;
    seam3.rotation.z = Math.PI / 2;

    group.add(seam1, seam2, seam3);

    // Fleshy biological bulges
    const bulb1 = new THREE.Mesh(this._pipeBulbGeo, baseMat);
    bulb1.position.set(-40, 2, 2);

    const bulb2 = new THREE.Mesh(this._pipeBulbGeo, baseMat);
    bulb2.position.set(40, -2, 2);

    group.add(bulb1, bulb2);

    return group;
  }

  private _buildSporePod(baseMat: THREE.MeshPhongMaterial, sporeGlowMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Central biological bulb
    const body = new THREE.Mesh(this._podBodyGeo, baseMat);
    group.add(body);

    // 5 Conical spikes protruding in radial directions
    const spikeDirs = [
      { dir: new THREE.Vector3(1, 1, 0.5).normalize() },
      { dir: new THREE.Vector3(-1, 1, 0.5).normalize() },
      { dir: new THREE.Vector3(-1, -1, 0.5).normalize() },
      { dir: new THREE.Vector3(1, -1, 0.5).normalize() },
      { dir: new THREE.Vector3(0, 0, 1).normalize() },
    ];

    for (const s of spikeDirs) {
      const spike = new THREE.Mesh(this._podSpikeGeo, baseMat);
      // Position on the body surface
      spike.position.copy(s.dir).multiplyScalar(13);
      // Align spike direction pointing outward
      spike.lookAt(s.dir.clone().multiplyScalar(50));
      spike.rotateX(Math.PI / 2); // adjust cone base alignment
      group.add(spike);

      // Bioluminescent toxic yellow-green spore tip at the spike end
      const tipSpore = new THREE.Mesh(this._podSporeGeo, sporeGlowMat);
      tipSpore.position.copy(s.dir).multiplyScalar(22);
      group.add(tipSpore);
    }

    return group;
  }

  // ── Parallax Scrolling & Asynchronous Breathing Loop ──

  update(dt: number): void {
    this._time += dt;
    if (this._mat) this._mat.uniforms['uTime']!.value = this._time;

    // --- 1. Scroll, Wrap, and Animate 3D Hive Structures ---
    for (const struct of this._structures) {
      const dx = this.baseSpeed * struct.speedMult * dt;
      struct.mesh.position.x -= dx;

      // Wrap off-screen structures
      if (struct.mesh.position.x < -HALF_W - 180) {
        struct.mesh.position.x += GAME_WIDTH + 360;

        // Randomize Y offset slightly on wrap to break repetition
        if (struct.type === 'womb') {
          struct.mesh.position.y = (Math.random() - 0.5) * 160;
        } else if (struct.type === 'vein') {
          const ySign = Math.random() > 0.5 ? 1 : -1;
          struct.mesh.position.y = ySign * (160 + Math.random() * 40);
        } else if (struct.type === 'pod') {
          const ySign = Math.random() > 0.5 ? 1 : -1;
          struct.mesh.position.y = ySign * (80 + Math.random() * 40);
        }
      }

      // Biological movement & organic breathing scaling
      if (struct.type === 'womb' && struct.phase !== undefined) {
        const s = 1.0 + 0.08 * Math.sin(this._time * 2.2 + struct.phase);
        struct.mesh.scale.set(s, s, s);
      } else if (struct.type === 'column' && struct.rotSpeed !== undefined) {
        // Colossal rib bone pillars rotate slowly to expose depth
        struct.mesh.rotation.y += struct.rotSpeed * dt;
      } else if (struct.type === 'vein' && struct.yPhase !== undefined) {
        // Writhing biological vein pipeline
        struct.mesh.position.y += Math.sin(this._time * 1.5 + struct.yPhase) * 0.15;
        struct.mesh.rotation.x += 0.2 * dt;
      } else if (struct.type === 'pod' && struct.scalePhase !== undefined) {
        const s = 1.0 + 0.06 * Math.sin(this._time * 1.8 + struct.scalePhase);
        struct.mesh.scale.set(s, s, s);
        struct.mesh.rotation.z += 0.1 * dt;
      }
    }

    // --- 2. Scroll, Tumble, and Flicker 3D Spore Crystals ---
    for (const spore of this._spores) {
      const dx = this.baseSpeed * spore.speedMult * dt;
      spore.mesh.position.x -= dx;

      // Tumbling rotation
      spore.mesh.rotation.x += spore.rx * dt;
      spore.mesh.rotation.y += spore.ry * dt;
      spore.mesh.rotation.z += spore.rz * dt;

      // Opacity flicker
      spore.mat.opacity = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(this._time * spore.flickerSpeed + spore.phase));

      // Infinite scrolling wrapping
      if (spore.mesh.position.x < -HALF_W - 50) {
        spore.mesh.position.x = HALF_W + 50 + Math.random() * 100;
        spore.mesh.position.y = (Math.random() - 0.5) * GAME_HEIGHT * 1.2;
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
    for (const spore of this._spores) {
      this._scene.remove(spore.mesh);
      spore.mesh.geometry.dispose();
      spore.mat.dispose(); // unique cloned materials disposed cleanly
    }
    this._spores = [];

    // Dispose shared geometries
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

    // Dispose shared structural materials
    this._baseMat.dispose();
    this._glowMat.dispose();
    this._sporeGlowMat.dispose();
    this._amberGlowMat.dispose();
    this._boneMat.dispose();
  }

  private _destroyHierarchy(node: THREE.Object3D): void {
    node.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
  }
}
