import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

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
  private _topSpireMesh: THREE.InstancedMesh;
  private _botSpireMesh: THREE.InstancedMesh;

  private _geysers: GeyserEntry[];
  private _geyserGeo: THREE.CylinderGeometry;
  private _geyserMat: THREE.MeshPhongMaterial;

  private _particles: ParticleEntry[];
  private _particleGeo: THREE.SphereGeometry;
  private _particleMat: THREE.MeshBasicMaterial;
  private _particleMesh: THREE.InstancedMesh;

  private _plates: PlateEntry[];
  private _mainRockGeo: THREE.IcosahedronGeometry;
  private _subRockGeo: THREE.IcosahedronGeometry;
  private _plateMat: THREE.MeshPhongMaterial;
  private _plateMainMesh: THREE.InstancedMesh;
  private _plateSubMesh: THREE.InstancedMesh;

  private _embers: EmberEntry[];
  private _emberGeo: THREE.BoxGeometry;
  private _emberMat: THREE.MeshBasicMaterial;
  private _emberMesh: THREE.InstancedMesh;
  private _instanceHelper: THREE.Object3D;
  private _blackColor: THREE.Color;

  // Scratch Euler reused every frame to avoid per-frame heap allocations
  private _euler: THREE.Euler;

  constructor(scene: IScene) {
    this._scene = scene;
    this._time = 0;
    this.baseSpeed = 140; // Default scrolling speed

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
    this._topSpireMesh = new THREE.InstancedMesh(this._spireGeoTop, this._spireMat, 4);
    this._botSpireMesh = new THREE.InstancedMesh(this._spireGeoBot, this._spireMat, 4);
    this._topSpireMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._botSpireMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    markRenderCategory(this._topSpireMesh, RenderCategory.BACKGROUND, 'background.spire');
    markRenderCategory(this._botSpireMesh, RenderCategory.BACKGROUND, 'background.spire');
    this._topSpireMesh.count = 0;
    this._botSpireMesh.count = 0;
    this._scene.add(this._topSpireMesh);
    this._scene.add(this._botSpireMesh);

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
    this._particleMesh = new THREE.InstancedMesh(this._particleGeo, this._particleMat, 25);
    this._particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    markRenderCategory(this._particleMesh, RenderCategory.BACKGROUND, 'background.geyserParticle');
    this._particleMesh.count = 0;
    this._scene.add(this._particleMesh);

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
    this._plateMainMesh = new THREE.InstancedMesh(this._mainRockGeo, this._plateMat, 5);
    this._plateSubMesh = new THREE.InstancedMesh(this._subRockGeo, this._plateMat, 10);
    this._plateMainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._plateSubMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    markRenderCategory(this._plateMainMesh, RenderCategory.BACKGROUND, 'background.rockPlate');
    markRenderCategory(this._plateSubMesh, RenderCategory.BACKGROUND, 'background.rockPlate');
    this._plateMainMesh.count = 0;
    this._plateSubMesh.count = 0;
    this._scene.add(this._plateMainMesh);
    this._scene.add(this._plateSubMesh);

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
    this._emberMesh = new THREE.InstancedMesh(this._emberGeo, this._emberMat, 75);
    this._emberMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._emberMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(75 * 3), 3);
    markRenderCategory(this._emberMesh, RenderCategory.BACKGROUND, 'background.ember');
    this._emberMesh.count = 75;
    this._scene.add(this._emberMesh);
    this._instanceHelper = new THREE.Object3D();
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
    this._backdropMat.uniforms['uTime']!.value = this._time;

    const scrollSpeed = this.baseSpeed;

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
      const index = sp.isTop ? topSpireCount++ : botSpireCount++;
      const rotationZ = sp.isTop ? Math.PI : 0;
      this._setInstanceTransform(
        mesh,
        index,
        [sp.x, sp.y, sp.z],
        this._euler.set(0, 0, rotationZ),
        [sp.baseWidth, sp.baseHeight, sp.baseWidth],
      );
    }
    this._topSpireMesh.count = topSpireCount;
    this._botSpireMesh.count = botSpireCount;
    this._topSpireMesh.instanceMatrix.needsUpdate = true;
    this._botSpireMesh.instanceMatrix.needsUpdate = true;

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
      this._setInstanceTransform(
        this._particleMesh,
        particleCount++,
        [p.x, p.y, p.z],
        this._euler.set(0, 0, 0),
        [lifeRatio, lifeRatio, lifeRatio],
      );
    }
    this._particleMesh.count = particleCount;
    this._particleMesh.instanceMatrix.needsUpdate = true;

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
      this._setInstanceTransform(
        this._plateMainMesh,
        i,
        [pl.x, pl.y, pl.z],
        this._euler.set(pl.mainRotation.x, pl.mainRotation.y, pl.mainRotation.z),
        [pl.mainScale.x, pl.mainScale.y, pl.mainScale.z],
      );

      // Slowly tumble the satellite rock chunks in 3D
      for (const sub of pl.subRocks) {
        sub.rotationX += sub.rotX * dt;
        sub.rotationY += sub.rotY * dt;
        sub.rotationZ += sub.rotZ * dt;
        this._setInstanceTransform(
          this._plateSubMesh,
          plateSubIndex++,
          [pl.x + sub.offsetX, pl.y + sub.offsetY, pl.z + sub.offsetZ],
          this._euler.set(sub.rotationX, sub.rotationY, sub.rotationZ),
          [sub.scaleX, sub.scaleY, sub.scaleZ],
        );
      }
    }
    this._plateMainMesh.count = this._plates.length;
    this._plateSubMesh.count = plateSubIndex;
    this._plateMainMesh.instanceMatrix.needsUpdate = true;
    this._plateSubMesh.instanceMatrix.needsUpdate = true;

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

      this._setInstanceTransform(
        this._emberMesh,
        i,
        [em.x, em.y, em.z],
        this._euler.set(rot, rot, 0),
        [scale, scale, scale],
      );
      this._emberMesh.setColorAt(i, this._blackColor.setRGB(brightness, brightness * 0.55, 0));
    }
    this._emberMesh.instanceMatrix.needsUpdate = true;
    if (this._emberMesh.instanceColor) {
      this._emberMesh.instanceColor.needsUpdate = true;
    }
  }

  destroy(): void {
    // Backdrop
    this._scene.remove(this._backdropMesh);
    this._backdropGeo.dispose();
    this._backdropMat.dispose();

    // Spires
    this._scene.remove(this._topSpireMesh);
    this._scene.remove(this._botSpireMesh);
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
    this._scene.remove(this._particleMesh);
    this._particleGeo.dispose();
    this._particleMat.dispose();

    // Tectonic Rocks
    this._scene.remove(this._plateMainMesh);
    this._scene.remove(this._plateSubMesh);
    this._mainRockGeo.dispose();
    this._subRockGeo.dispose();
    this._plateMat.dispose();

    // Embers
    this._scene.remove(this._emberMesh);
    this._emberGeo.dispose();
    this._emberMat.dispose();
  }
}
