import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';
import { InstancedScrollLayer, type InstancedScrollMeshLayer } from './InstancedScrollLayer.ts';
import type { SectorBackgroundConfig } from './sectors/Sectors.ts';

const HALF_W = GAME_WIDTH / 2;

interface SectorLandmarkEntry {
  x: number;
  y: number;
  z: number;
  phase: number;
  speedMult: number;
  extra?: number;
}

const BACKDROP_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    // Subtle heat breathing bottom glow
    float breathe = 0.05 * sin(uTime * 0.5);
    float grad = smoothstep(0.95, 0.0, vUv.y - breathe);
    vec3 darkCharcoal = vec3(0.035, 0.010, 0.001);
    vec3 glowingOrange = vec3(0.32, 0.10, 0.008);
    vec3 col = mix(darkCharcoal, glowingOrange, grad);
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface SpireEntry {
  isTop: boolean;
  x: number;
  y: number;
  z: number;
  baseWidth: number;
  baseHeight: number;
}

interface GeyserEntry {
  mesh: THREE.Mesh;
  spawnTimer: number;
}

interface ParticleEntry {
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  age: number;
  maxAge: number;
  active: boolean;
}

interface SubRock {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

interface PlateEntry {
  x: number;
  y: number;
  z: number;
  mainScale: { x: number; y: number; z: number };
  mainRotation: { x: number; y: number; z: number };
  mainRot: { x: number; y: number; z: number };
  subRocks: SubRock[];
}

interface EmberEntry {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rotSpeed: number;
  flickerOffset: number;
  flickerSpeed: number;
}

function cloneMergeCompatibleGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return geometry.index ? geometry.toNonIndexed() : geometry.clone();
}

export function buildScorchedPlateGeometry(): THREE.BufferGeometry {
  const rawParts: THREE.BufferGeometry[] = [];
  const plate = new THREE.CylinderGeometry(26, 30, 12, 6);
  plate.rotateZ(Math.PI / 2);
  rawParts.push(plate);
  const chunk = new THREE.IcosahedronGeometry(12, 0);
  chunk.translate(22, 6, 0);
  rawParts.push(chunk);
  const shard = new THREE.IcosahedronGeometry(9, 0);
  shard.translate(-20, -5, 4);
  shard.rotateZ(0.5);
  rawParts.push(shard);

  const parts = rawParts.map(cloneMergeCompatibleGeometry);
  const merged = mergeGeometries(parts);

  for (const geometry of rawParts) geometry.dispose();
  for (const geometry of parts) geometry.dispose();

  if (!merged) throw new Error('Failed to merge scorched plate geometry.');
  return merged;
}

export class Background4 implements IBackground {
  private _scene: IScene;
  public baseSpeed: number;
  private _time: number;

  private _backdropGeo: THREE.PlaneGeometry;
  private _backdropMat: THREE.ShaderMaterial;
  private _backdropMesh: THREE.Mesh;

  private _spires: SpireEntry[];
  private _spireGeoTop: THREE.ConeGeometry;
  private _spireGeoBot: THREE.ConeGeometry;
  private _spireMat: THREE.MeshPhongMaterial;
  private _topSpireMesh: InstancedScrollMeshLayer;
  private _botSpireMesh: InstancedScrollMeshLayer;

  private _geysers: GeyserEntry[];
  private _geyserGeo: THREE.CylinderGeometry;
  private _geyserMat: THREE.MeshPhongMaterial;

  private _particles: ParticleEntry[];
  private _particleGeo: THREE.SphereGeometry;
  private _particleMat: THREE.MeshBasicMaterial;
  private _particleMesh: InstancedScrollMeshLayer;

  private _plates: PlateEntry[];
  private _mainRockGeo: THREE.IcosahedronGeometry;
  private _subRockGeo: THREE.IcosahedronGeometry;
  private _plateMat: THREE.MeshPhongMaterial;
  private _plateMainMesh: InstancedScrollMeshLayer;
  private _plateSubMesh: InstancedScrollMeshLayer;

  private _embers: EmberEntry[];
  private _emberGeo: THREE.BoxGeometry;
  private _emberMat: THREE.MeshBasicMaterial;
  private _emberMesh: InstancedScrollMeshLayer;
  private _instancedLayer: InstancedScrollLayer;
  private _blackColor: THREE.Color;

  // Scratch Euler reused every frame to avoid per-frame heap allocations
  private _euler: THREE.Euler;

  private readonly _sectorConfig?: SectorBackgroundConfig;

  private _sectorLandmarkBody: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarkAccent: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarkAux: InstancedScrollMeshLayer | null = null;
  private _sectorLandmarks: SectorLandmarkEntry[] = [];
  private _sectorMaterials: THREE.Material[] = [];

  constructor(scene: IScene, sectorConfig?: SectorBackgroundConfig) {
    this._scene = scene;
    this._sectorConfig = sectorConfig;
    this._time = 0;
    this.baseSpeed = 140; // Default scrolling speed
    this._instancedLayer = new InstancedScrollLayer(scene);

    // 1. Charcoal-Orange Deep Space Backdrop (Z = -95)
    this._backdropGeo = new THREE.PlaneGeometry(GAME_WIDTH, GAME_HEIGHT);
    this._backdropMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: STANDARD_VERT,
      fragmentShader: BACKDROP_FRAG,
      depthWrite: false,
    });
    this._backdropMesh = new THREE.Mesh(this._backdropGeo, this._backdropMat);
    markRenderCategory(this._backdropMesh, RenderCategory.BACKGROUND, 'background.backdrop');
    this._backdropMesh.position.set(0, 0, -95);
    this._backdropMesh.scale.set(1.4, 1.4, 1.0); // Scale up to ensure full screen coverage under tilt
    this._scene.add(this._backdropMesh);

    // 2. Colossal Obsidian Spires (Z = -85) - Parallax 0.10
    this._spires = [];
    this._spireGeoTop = new THREE.ConeGeometry(24, 200, 5); // Ceiling spires
    this._spireGeoBot = new THREE.ConeGeometry(24, 200, 5); // Floor spires

    // Glossy glass-like obsidian material
    this._spireMat = new THREE.MeshPhongMaterial({
      color: 0x0d0b09,      // Glassy black
      emissive: 0x030202,   // Very dark
      specular: 0x665544,   // High specular highlight
      shininess: 90,        // Extremely glassy
      flatShading: true,
    });
    this._topSpireMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.spire', geometry: this._spireGeoTop, material: this._spireMat, capacity: 4 });
    this._botSpireMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.spire', geometry: this._spireGeoBot, material: this._spireMat, capacity: 4 });

    const spireCount = 8;
    for (let i = 0; i < spireCount; i++) {
      const isTop = i % 2 === 0;
      // Position spaced out horizontally with visual variety
      const x = (i - spireCount / 2) * (GAME_WIDTH / (spireCount - 1.5));
      const y = isTop ? GAME_HEIGHT / 2 - 20 : -GAME_HEIGHT / 2 + 20;

      const heightScale = 0.8 + Math.random() * 0.5;
      const widthScale = 0.7 + Math.random() * 0.6;
      this._spires.push({
        isTop,
        x,
        y,
        z: -85,
        baseWidth: widthScale,
        baseHeight: heightScale,
      });
    }

    // 3. Lava Geysers & Vents (Z = -65) - Parallax 0.25
    this._geysers = [];
    this._geyserGeo = new THREE.CylinderGeometry(8, 22, 28, 5);
    this._geyserMat = new THREE.MeshPhongMaterial({
      color: 0x221a15,      // Dusty volcanic stone
      emissive: 0x551100,   // Molten heart warning glow
      shininess: 10,
      flatShading: true,
    });

    const geyserCount = 4;
    for (let i = 0; i < geyserCount; i++) {
      const mesh = new THREE.Mesh(this._geyserGeo, this._geyserMat);
      markRenderCategory(mesh, RenderCategory.BACKGROUND, 'background.geyser');
      const x = (i - geyserCount / 2) * (GAME_WIDTH / (geyserCount - 0.5)) + (Math.random() - 0.5) * 50;
      const y = -GAME_HEIGHT / 2 + 14;
      mesh.position.set(x, y, -65);
      this._scene.add(mesh);

      this._geysers.push({
        mesh,
        spawnTimer: Math.random() * 0.15,
      });
    }

    // 4. Rising Geyser Particles Pool (25 active orange particles)
    this._particles = [];
    this._particleGeo = new THREE.SphereGeometry(3.5, 4, 4);
    this._particleMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.9,
    });
    this._particleMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.geyserParticle', geometry: this._particleGeo, material: this._particleMat, capacity: 25 });

    for (let i = 0; i < 25; i++) {
      this._particles.push({
        x: 0,
        y: 0,
        z: -64,
        vy: 0,
        vx: 0,
        age: 0,
        maxAge: 0,
        active: false,
      });
    }

    // 5. Drifting Tectonic Rocks (Z = -50) - Parallax 0.45
    // These are chiseled organic rock clusters that match the look and feel of the cavern walls
    this._plates = [];
    this._mainRockGeo = new THREE.IcosahedronGeometry(22, 0); // 20-sided sharp triangular facets (rocky, no large flat pentagons)
    this._subRockGeo = new THREE.IcosahedronGeometry(7, 0);   // smaller satellite debris chunks
    this._plateMat = new THREE.MeshPhongMaterial({
      color: 0x55483e,      // Darker, rougher basalt stone color
      emissive: 0x1c1410,   // Softer volcanic underglow (blends in depth)
      specular: 0x55443c,   // Softer, much less bright specular highlight (rough stone look)
      shininess: 12,        // Low shininess to make it look rough, dusty, and matte
      flatShading: true,
    });
    this._plateMainMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.rockPlate', geometry: this._mainRockGeo, material: this._plateMat, capacity: 5 });
    this._plateSubMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.rockPlate', geometry: this._subRockGeo, material: this._plateMat, capacity: 10 });

    const plateCount = 5;
    for (let i = 0; i < plateCount; i++) {
      const sx = 0.85 + Math.random() * 0.5;
      const sy = 0.85 + Math.random() * 0.5;
      const sz = 0.85 + Math.random() * 0.5;
      const mainRotation = {
        x: Math.random() * Math.PI,
        y: Math.random() * Math.PI,
        z: 0,
      };

      const mainRot = {
        x: (Math.random() - 0.5) * 0.25,
        y: (Math.random() - 0.5) * 0.25,
        z: (Math.random() - 0.5) * 0.15,
      };

      // 1 to 2 small satellite debris chunks orbiting or drifting nearby
      const subRocks: SubRock[] = [];
      const numSubs = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numSubs; j++) {
        const ssx = 0.7 + Math.random() * 0.6;
        const ssy = 0.7 + Math.random() * 0.6;
        const ssz = 0.7 + Math.random() * 0.6;

        // Offset satellites around the main rock
        const dx = (Math.random() > 0.5 ? 1 : -1) * (26 + Math.random() * 12);
        const dy = (Math.random() - 0.5) * 32;
        const dz = (Math.random() - 0.5) * 14;

        subRocks.push({
          offsetX: dx,
          offsetY: dy,
          offsetZ: dz,
          scaleX: ssx,
          scaleY: ssy,
          scaleZ: ssz,
          rotationX: Math.random() * Math.PI,
          rotationY: Math.random() * Math.PI,
          rotationZ: 0,
          rotX: (Math.random() - 0.5) * 0.6,
          rotY: (Math.random() - 0.5) * 0.6,
          rotZ: (Math.random() - 0.5) * 0.4,
        });
      }

      const x = (i - plateCount / 2) * (GAME_WIDTH / (plateCount - 0.8)) + (Math.random() - 0.5) * 40;
      const y = (Math.random() - 0.5) * (GAME_HEIGHT * 0.5); // float around middle vertical area

      this._plates.push({
        x,
        y,
        z: -50,
        mainScale: { x: sx, y: sy, z: sz },
        mainRotation,
        mainRot,
        subRocks,
      });
    }

    // 6. Tumbling atmospheric space embers (75 flickering items) - Z = -45 to +10
    this._embers = [];
    this._emberGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    this._emberMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 1,
      vertexColors: true,
    });
    const emberMesh = new THREE.InstancedMesh(this._emberGeo, this._emberMat, 75);
    emberMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(75 * 3), 3);
    this._emberMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.BACKGROUND, detail: 'background.ember', mesh: emberMesh });
    this._blackColor = new THREE.Color(0x000000);
    this._euler = new THREE.Euler();

    for (let i = 0; i < 75; i++) {
      const x = (Math.random() - 0.5) * GAME_WIDTH;
      const y = (Math.random() - 0.5) * GAME_HEIGHT;
      const z = -45 + Math.random() * 55; // distributed in Z

      this._embers.push({
        x,
        y,
        z,
        vx: -35 - Math.random() * 45, // scroll left
        vy: 10 + Math.random() * 20,   // drift up
        rotSpeed: (Math.random() - 0.5) * 4,
        flickerOffset: Math.random() * 10,
        flickerSpeed: 2 + Math.random() * 3,
      });
    }

    this._buildSectorLandmark();
    this.update(0);
  }

  update(dt: number): void {
    this._time += dt;
    this._backdropMat.uniforms['uTime']!.value = this._time;

    const scrollSpeed = this.baseSpeed;
    this._topSpireMesh.beginFrame();
    this._botSpireMesh.beginFrame();
    this._particleMesh.beginFrame();
    this._plateMainMesh.beginFrame();
    this._plateSubMesh.beginFrame();
    this._emberMesh.beginFrame();

    // 1. Scroll & wrap Obsidian Spires (Parallax = 0.10)
    const spMultiplier = 0.10;
    let topSpireCount = 0;
    let botSpireCount = 0;
    for (const sp of this._spires) {
      sp.x -= scrollSpeed * spMultiplier * dt;
      if (sp.x < -GAME_WIDTH / 2 - 60) {
        sp.x = GAME_WIDTH / 2 + 60;

        // Randomize dimensions on wrap to simulate infinite variety
        sp.baseHeight = 0.8 + Math.random() * 0.5;
        sp.baseWidth = 0.7 + Math.random() * 0.6;

        // Reposition slightly based on top/bottom
        sp.y = sp.isTop ? GAME_HEIGHT / 2 - 20 : -GAME_HEIGHT / 2 + 20;
      }

      const mesh = sp.isTop ? this._topSpireMesh : this._botSpireMesh;
      if (sp.isTop) topSpireCount++;
      else botSpireCount++;
      const rotationZ = sp.isTop ? Math.PI : 0;
      mesh.push({
        position: [sp.x, sp.y, sp.z],
        rotation: this._euler.set(0, 0, rotationZ),
        scale: [sp.baseWidth, sp.baseHeight, sp.baseWidth],
      });
    }
    this._topSpireMesh.endFrame();
    this._botSpireMesh.endFrame();

    // 2. Scroll & wrap Lava Geysers (Parallax = 0.25)
    const gyMultiplier = 0.25;
    for (const gy of this._geysers) {
      gy.mesh.position.x -= scrollSpeed * gyMultiplier * dt;
      if (gy.mesh.position.x < -GAME_WIDTH / 2 - 50) {
        gy.mesh.position.x = GAME_WIDTH / 2 + 50;
      }

      // Periodically spawn a rising glowing particle
      gy.spawnTimer -= dt;
      if (gy.spawnTimer <= 0) {
        gy.spawnTimer = 0.12 + Math.random() * 0.18;

        const freeP = this._particles.find(p => !p.active);
        if (freeP) {
          freeP.active = true;
          freeP.x = gy.mesh.position.x + (Math.random() - 0.5) * 4;
          freeP.y = gy.mesh.position.y + 14;
          freeP.vx = -4 + Math.random() * 8;
          freeP.vy = 65 + Math.random() * 55; // vertical rise speed
          freeP.age = 0;
          freeP.maxAge = 1.0 + Math.random() * 0.8;
        }
      }
    }

    // Update active geyser particles
    let particleCount = 0;
    for (const p of this._particles) {
      if (!p.active) continue;

      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        continue;
      }

      // Parallax scroll left + vertical drift
      p.x -= scrollSpeed * gyMultiplier * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Shrink and fade as particle ages
      const lifeRatio = 1.0 - (p.age / p.maxAge);
      this._particleMesh.push({
        position: [p.x, p.y, p.z],
        rotation: this._euler.set(0, 0, 0),
        scale: [lifeRatio, lifeRatio, lifeRatio],
      });
      particleCount++;
    }
    this._particleMesh.endFrame();

    // 3. Scroll, wrap & tumble Tectonic Rocks (Parallax = 0.45)
    const plMultiplier = 0.45;
    let plateSubIndex = 0;
    for (let i = 0; i < this._plates.length; i++) {
      const pl = this._plates[i]!;
      pl.x -= scrollSpeed * plMultiplier * dt;
      if (pl.x < -GAME_WIDTH / 2 - 120) {
        pl.x = GAME_WIDTH / 2 + 120;
        // Re-randomize vertical height on wrap
        pl.y = (Math.random() - 0.5) * (GAME_HEIGHT * 0.5);
      }

      // Slowly tumble the main rock in 3D
      pl.mainRotation.x += pl.mainRot.x * dt;
      pl.mainRotation.y += pl.mainRot.y * dt;
      pl.mainRotation.z += pl.mainRot.z * dt;
      this._plateMainMesh.push({
        position: [pl.x, pl.y, pl.z],
        rotation: this._euler.set(pl.mainRotation.x, pl.mainRotation.y, pl.mainRotation.z),
        scale: [pl.mainScale.x, pl.mainScale.y, pl.mainScale.z],
      });

      // Slowly tumble the satellite rock chunks in 3D
      for (const sub of pl.subRocks) {
        sub.rotationX += sub.rotX * dt;
        sub.rotationY += sub.rotY * dt;
        sub.rotationZ += sub.rotZ * dt;
        this._plateSubMesh.push({
          position: [pl.x + sub.offsetX, pl.y + sub.offsetY, pl.z + sub.offsetZ],
          rotation: this._euler.set(sub.rotationX, sub.rotationY, sub.rotationZ),
          scale: [sub.scaleX, sub.scaleY, sub.scaleZ],
        });
        plateSubIndex++;
      }
    }
    this._plateMainMesh.endFrame();
    this._plateSubMesh.endFrame();

    // 4. Update Embers (drift left/up, tumble, flicker)
    for (let i = 0; i < this._embers.length; i++) {
      const em = this._embers[i]!;
      em.x += em.vx * dt;
      em.y += em.vy * dt;

      // Wrap around horizontal and vertical boundaries
      if (em.x < -GAME_WIDTH / 2 - 20) {
        em.x = GAME_WIDTH / 2 + 20;
        em.y = (Math.random() - 0.5) * GAME_HEIGHT;
      }
      if (em.y > GAME_HEIGHT / 2 + 20) {
        em.y = -GAME_HEIGHT / 2 - 20;
        em.x = (Math.random() - 0.5) * GAME_WIDTH;
      }

      const flickerVal = Math.sin(this._time * em.flickerSpeed + em.flickerOffset);
      const brightness = 0.25 + 0.75 * Math.abs(flickerVal);
      const scale = 0.7 + 0.6 * brightness;
      const rot = this._time * em.rotSpeed;

      this._emberMesh.push({
        position: [em.x, em.y, em.z],
        rotation: this._euler.set(rot, rot, 0),
        scale: [scale, scale, scale],
      });
      this._emberMesh.setColorAt(i, this._blackColor.setRGB(brightness, brightness * 0.55, 0));
    }
    this._emberMesh.endFrame();
    this._updateSectorLandmark(dt);
  }

  private _wrapX(currentX: number, wrapPad: number): number {
    if (currentX >= -HALF_W - wrapPad) return currentX;
    return currentX + GAME_WIDTH + wrapPad * 2;
  }

  private _buildBasaltFinGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const base = new THREE.BoxGeometry(18, 150, 8);
    base.rotateZ(0.04);
    parts.push(base);
    const tip = new THREE.BoxGeometry(13, 60, 7);
    tip.translate(3, 90, 0);
    tip.rotateZ(-0.1);
    parts.push(tip);
    const fin = new THREE.BoxGeometry(8, 80, 7);
    fin.translate(-9, 35, 0);
    fin.rotateZ(0.18);
    parts.push(fin);
    const merged = mergeGeometries(parts);
    if (!merged) throw new Error('Failed to merge basalt fin geometry.');
    for (const p of parts) p.dispose();
    return merged;
  }

  private _buildScorchedPlateGeometry(): THREE.BufferGeometry {
    return buildScorchedPlateGeometry();
  }

  private _buildCalderaRimGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const outer = new THREE.TorusGeometry(42, 9, 6, 14);
    parts.push(outer);
    for (let i = 0; i < 7; i++) {
      const theta = (i * Math.PI * 2) / 7;
      const spike = new THREE.ConeGeometry(8, 28, 5);
      spike.rotateZ(-Math.PI / 2);
      spike.rotateY(theta);
      spike.translate(Math.cos(theta) * 46, Math.sin(theta) * 46, 0);
      parts.push(spike);
    }
    const merged = mergeGeometries(parts);
    if (!merged) throw new Error('Failed to merge caldera rim geometry.');
    for (const p of parts) p.dispose();
    return merged;
  }

  private _buildSectorLandmark(): void {
    const key = this._sectorConfig?.sectorKey;
    if (!key) return;

    let bodyGeo: THREE.BufferGeometry;
    let accentGeo: THREE.BufferGeometry;
    let auxGeo: THREE.BufferGeometry | null = null;
    let bodyMat: THREE.Material = this._plateMat;
    let accentMat: THREE.Material = this._emberMat;
    let auxMat: THREE.Material | null = null;
    let bodyCapacity = 0;
    let accentCapacity = 0;
    let auxCapacity = 0;

    if (key === 'basaltApproach') {
      bodyGeo = this._buildBasaltFinGeometry();
      accentGeo = new THREE.BoxGeometry(5, 45, 4);
      accentMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.75 });
      this._sectorMaterials.push(accentMat);
      for (let i = 0; i < 4; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 280 + (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 180,
          z: -70,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.12,
        });
      }
      bodyCapacity = this._sectorLandmarks.length;
      accentCapacity = this._sectorLandmarks.length * 2;
    } else if (key === 'magmaConduit') {
      bodyGeo = new THREE.BoxGeometry(110, 18, 14);
      accentGeo = new THREE.CylinderGeometry(2.5, 2.5, 96, 6);
      accentGeo.rotateZ(Math.PI / 2);
      accentMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });
      this._sectorMaterials.push(accentMat);
      for (let i = 0; i < 4; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 290 + (Math.random() - 0.5) * 60,
          y: 0,
          z: -68,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.15,
        });
      }
      bodyCapacity = this._sectorLandmarks.length * 2;
      accentCapacity = this._sectorLandmarks.length * 2;
    } else if (key === 'crystalCavern') {
      bodyGeo = new THREE.IcosahedronGeometry(16, 0);
      accentGeo = new THREE.ConeGeometry(11, 110, 6);
      auxGeo = new THREE.OctahedronGeometry(8);
      bodyMat = this._plateMat;
      accentMat = new THREE.MeshPhongMaterial({
        color: 0x88ffff,
        transparent: true,
        opacity: 0.5,
        emissive: 0x004444,
        shininess: 90,
        flatShading: true,
      });
      this._sectorMaterials.push(accentMat);
      auxMat = new THREE.MeshBasicMaterial({ color: 0xccffff, transparent: true, opacity: 0.85 });
      this._sectorMaterials.push(auxMat);
      for (let i = 0; i < 4; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 300 + (Math.random() - 0.5) * 50,
          y: (Math.random() - 0.5) * 160,
          z: -65,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.20,
        });
      }
      bodyCapacity = this._sectorLandmarks.length;
      accentCapacity = this._sectorLandmarks.length;
      auxCapacity = this._sectorLandmarks.length * 2;
    } else if (key === 'ashFalls') {
      bodyGeo = this._buildScorchedPlateGeometry();
      accentGeo = new THREE.BoxGeometry(2.5, 22, 2.5);
      accentMat = new THREE.MeshBasicMaterial({ color: 0x665544, transparent: true, opacity: 0.7 });
      this._sectorMaterials.push(accentMat);
      for (let i = 0; i < 5; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 230 + (Math.random() - 0.5) * 50,
          y: (Math.random() - 0.5) * 210,
          z: -62,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.25,
        });
      }
      bodyCapacity = this._sectorLandmarks.length;
      accentCapacity = this._sectorLandmarks.length * 3;
    } else if (key === 'calderaHeart') {
      bodyGeo = this._buildCalderaRimGeometry();
      accentGeo = new THREE.CircleGeometry(30, 14);
      auxGeo = new THREE.TorusGeometry(28, 3, 6, 16);
      bodyMat = this._plateMat;
      accentMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
      auxMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.75 });
      this._sectorMaterials.push(accentMat, auxMat);
      for (let i = 0; i < 3; i++) {
        this._sectorLandmarks.push({
          x: -HALF_W + i * 380 + (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 140,
          z: -72,
          phase: Math.random() * Math.PI * 2,
          speedMult: 0.18,
        });
      }
      bodyCapacity = this._sectorLandmarks.length;
      accentCapacity = this._sectorLandmarks.length;
      auxCapacity = this._sectorLandmarks.length;
    } else {
      return;
    }

    const detail = `background.sector.${key}`;
    this._sectorLandmarkBody = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail,
      geometry: bodyGeo,
      material: bodyMat,
      capacity: bodyCapacity,
      ownedResources: [bodyGeo],
    });
    this._sectorLandmarkAccent = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail,
      geometry: accentGeo,
      material: accentMat,
      capacity: accentCapacity,
      ownedResources: [accentGeo],
    });
    if (auxGeo && auxMat) {
      this._sectorLandmarkAux = this._instancedLayer.createLayer({
        renderCategory: RenderCategory.BACKGROUND,
        detail,
        geometry: auxGeo,
        material: auxMat,
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

    if (key === 'basaltApproach') {
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 220);
        const sway = 0.04 * Math.sin(this._time * 0.8 + lm.phase);
        this._sectorLandmarkBody.push({ position: [lm.x, lm.y, lm.z], rotation: this._euler.set(0, 0, sway) });
        this._sectorLandmarkAccent.push({ position: [lm.x - 5, lm.y + 35, lm.z + 3], rotation: this._euler.set(0, 0, sway + 0.1), scale: [1, 1, 1] });
        this._sectorLandmarkAccent.push({ position: [lm.x + 6, lm.y - 20, lm.z + 3], rotation: this._euler.set(0, 0, sway - 0.08), scale: [0.85, 0.85, 0.85] });
      }
    } else if (key === 'magmaConduit') {
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 240);
        const topY = GAME_HEIGHT / 2 - 18;
        const botY = -GAME_HEIGHT / 2 + 18;
        const pulse = 0.9 + 0.15 * Math.sin(this._time * 2.5 + lm.phase);
        this._sectorLandmarkBody.push({ position: [lm.x, topY, lm.z], rotation: this._euler.set(0, 0, 0) });
        this._sectorLandmarkBody.push({ position: [lm.x, botY, lm.z], rotation: this._euler.set(0, 0, 0) });
        this._sectorLandmarkAccent.push({ position: [lm.x, topY, lm.z + 3], rotation: this._euler.set(0, 0, Math.PI / 2), scale: [pulse, 1, pulse] });
        this._sectorLandmarkAccent.push({ position: [lm.x, botY, lm.z + 3], rotation: this._euler.set(0, 0, Math.PI / 2), scale: [pulse, 1, pulse] });
      }
    } else if (key === 'crystalCavern') {
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 240);
        const shimmer = 1.0 + 0.06 * Math.sin(this._time * 1.8 + lm.phase);
        this._sectorLandmarkBody.push({ position: [lm.x, lm.y, lm.z], rotation: this._euler.set(0, 0, 0) });
        this._sectorLandmarkAccent.push({ position: [lm.x, lm.y + 52, lm.z + 4], rotation: this._euler.set(0, 0, 0), scale: [shimmer, shimmer, shimmer] });
        this._sectorLandmarkAux?.push({ position: [lm.x - 10, lm.y + 95, lm.z + 8], rotation: this._euler.set(0, 0, 0), scale: [shimmer, shimmer, shimmer] });
        this._sectorLandmarkAux?.push({ position: [lm.x + 12, lm.y + 88, lm.z + 8], rotation: this._euler.set(0, 0, 0), scale: [shimmer * 0.8, shimmer * 0.8, shimmer * 0.8] });
      }
    } else if (key === 'ashFalls') {
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 220);
        const rot = this._euler.set(0, 0, 0.25 * Math.sin(this._time * 0.6 + lm.phase));
        this._sectorLandmarkBody.push({ position: [lm.x, lm.y, lm.z], rotation: rot });
        for (let i = 0; i < 3; i++) {
          const ax = lm.x + (i - 1) * 18;
          const ay = lm.y - 35 - i * 12 - (this._time * 15) % 48;
          const ashRot = this._euler.set(0, 0, (i - 1) * 0.3 + this._time * 0.5 + lm.phase);
          this._sectorLandmarkAccent.push({ position: [ax, ay, lm.z + 6], rotation: ashRot });
        }
      }
    } else if (key === 'calderaHeart') {
      for (const lm of this._sectorLandmarks) {
        lm.x = this._wrapX(lm.x - this.baseSpeed * lm.speedMult * dt, 280);
        const throb = 1.0 + 0.08 * Math.sin(this._time * 1.6 + lm.phase);
        this._sectorLandmarkBody.push({ position: [lm.x, lm.y, lm.z], rotation: this._euler.set(0, 0, 0) });
        this._sectorLandmarkAccent.push({ position: [lm.x, lm.y, lm.z + 4], rotation: this._euler.set(0, 0, 0), scale: [throb, throb, throb] });
        const ringScale = 1.0 + 0.25 * Math.sin(this._time * 2.2 + lm.phase);
        this._sectorLandmarkAux?.push({ position: [lm.x, lm.y, lm.z + 6], rotation: this._euler.set(0, 0, 0), scale: [ringScale, ringScale, ringScale] });
      }
    }

    this._sectorLandmarkBody.endFrame();
    this._sectorLandmarkAccent.endFrame();
    this._sectorLandmarkAux?.endFrame();
  }

  destroy(): void {
    // Backdrop
    this._scene.remove(this._backdropMesh);
    this._backdropGeo.dispose();
    this._backdropMat.dispose();

    this._instancedLayer.destroy();

    // Sector landmark materials (geometries disposed via layer ownership)
    for (const mat of this._sectorMaterials) {
      mat.dispose();
    }

    // Spires
    this._spireGeoTop.dispose();
    this._spireGeoBot.dispose();
    this._spireMat.dispose();

    // Geysers
    for (const gy of this._geysers) {
      this._scene.remove(gy.mesh);
    }
    this._geyserGeo.dispose();
    this._geyserMat.dispose();

    // Particles
    this._particleGeo.dispose();
    this._particleMat.dispose();

    // Tectonic Rocks
    this._mainRockGeo.dispose();
    this._subRockGeo.dispose();
    this._plateMat.dispose();

    // Embers
    this._emberGeo.dispose();
    this._emberMat.dispose();
  }
}
