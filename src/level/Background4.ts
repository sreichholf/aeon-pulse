import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';

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
  mesh: THREE.Mesh;
  isTop: boolean;
  baseWidth: number;
  baseHeight: number;
}

interface GeyserEntry {
  mesh: THREE.Mesh;
  spawnTimer: number;
}

interface ParticleEntry {
  mesh: THREE.Mesh;
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
  mesh: THREE.Mesh;
  rotX: number;
  rotY: number;
  rotZ: number;
}

interface PlateEntry {
  group: THREE.Group;
  mainMesh: THREE.Mesh;
  mainRot: { x: number; y: number; z: number };
  subRocks: SubRock[];
}

interface EmberEntry {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
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

  private _geysers: GeyserEntry[];
  private _geyserGeo: THREE.CylinderGeometry;
  private _geyserMat: THREE.MeshPhongMaterial;

  private _particles: ParticleEntry[];
  private _particleGeo: THREE.SphereGeometry;
  private _particleMat: THREE.MeshBasicMaterial;

  private _plates: PlateEntry[];
  private _mainRockGeo: THREE.IcosahedronGeometry;
  private _subRockGeo: THREE.IcosahedronGeometry;
  private _plateMat: THREE.MeshPhongMaterial;

  private _embers: EmberEntry[];
  private _emberGeo: THREE.BoxGeometry;

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

    const spireCount = 8;
    for (let i = 0; i < spireCount; i++) {
      const isTop = i % 2 === 0;
      const geo = isTop ? this._spireGeoTop : this._spireGeoBot;
      const mesh = new THREE.Mesh(geo, this._spireMat);

      // Orient ceiling spires to point down
      if (isTop) {
        mesh.rotation.z = Math.PI;
      }

      // Position spaced out horizontally with visual variety
      const x = (i - spireCount / 2) * (GAME_WIDTH / (spireCount - 1.5));
      const y = isTop ? GAME_HEIGHT / 2 - 20 : -GAME_HEIGHT / 2 + 20;
      mesh.position.set(x, y, -85);

      const heightScale = 0.8 + Math.random() * 0.5;
      const widthScale = 0.7 + Math.random() * 0.6;
      mesh.scale.set(widthScale, heightScale, widthScale);

      this._scene.add(mesh);
      this._spires.push({ mesh, isTop, baseWidth: widthScale, baseHeight: heightScale });
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
    });

    for (let i = 0; i < 25; i++) {
      const mesh = new THREE.Mesh(this._particleGeo, this._particleMat);
      mesh.visible = false;
      this._scene.add(mesh);

      this._particles.push({
        mesh,
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

    const plateCount = 5;
    for (let i = 0; i < plateCount; i++) {
      const group = new THREE.Group();

      // Main chunky boulder
      const mainMesh = new THREE.Mesh(this._mainRockGeo, this._plateMat);
      // Highly irregular low-poly scaling for jagged rocky appearance
      const sx = 0.85 + Math.random() * 0.5;
      const sy = 0.85 + Math.random() * 0.5;
      const sz = 0.85 + Math.random() * 0.5;
      mainMesh.scale.set(sx, sy, sz);
      mainMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      group.add(mainMesh);

      const mainRot = {
        x: (Math.random() - 0.5) * 0.25,
        y: (Math.random() - 0.5) * 0.25,
        z: (Math.random() - 0.5) * 0.15,
      };

      // 1 to 2 small satellite debris chunks orbiting or drifting nearby
      const subRocks: SubRock[] = [];
      const numSubs = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numSubs; j++) {
        const subMesh = new THREE.Mesh(this._subRockGeo, this._plateMat);
        // Irregular rocky scaling for satellite shards too
        const ssx = 0.7 + Math.random() * 0.6;
        const ssy = 0.7 + Math.random() * 0.6;
        const ssz = 0.7 + Math.random() * 0.6;
        subMesh.scale.set(ssx, ssy, ssz);

        // Offset satellites around the main rock
        const dx = (Math.random() > 0.5 ? 1 : -1) * (26 + Math.random() * 12);
        const dy = (Math.random() - 0.5) * 32;
        const dz = (Math.random() - 0.5) * 14;
        subMesh.position.set(dx, dy, dz);
        subMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        group.add(subMesh);

        subRocks.push({
          mesh: subMesh,
          rotX: (Math.random() - 0.5) * 0.6,
          rotY: (Math.random() - 0.5) * 0.6,
          rotZ: (Math.random() - 0.5) * 0.4,
        });
      }

      const x = (i - plateCount / 2) * (GAME_WIDTH / (plateCount - 0.8)) + (Math.random() - 0.5) * 40;
      const y = (Math.random() - 0.5) * (GAME_HEIGHT * 0.5); // float around middle vertical area
      group.position.set(x, y, -50);
      this._scene.add(group);

      this._plates.push({
        group,
        mainMesh,
        mainRot,
        subRocks,
      });
    }

    // 6. Tumbling atmospheric space embers (75 flickering items) - Z = -45 to +10
    this._embers = [];
    this._emberGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);

    for (let i = 0; i < 75; i++) {
      // Individual cloned materials for custom opacity animation
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff8800,
        transparent: true,
        opacity: 0.5,
      });
      const mesh = new THREE.Mesh(this._emberGeo, mat);

      const x = (Math.random() - 0.5) * GAME_WIDTH;
      const y = (Math.random() - 0.5) * GAME_HEIGHT;
      const z = -45 + Math.random() * 55; // distributed in Z
      mesh.position.set(x, y, z);

      mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this._scene.add(mesh);

      this._embers.push({
        mesh,
        mat,
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

  update(dt: number): void {
    this._time += dt;
    this._backdropMat.uniforms['uTime']!.value = this._time;

    const scrollSpeed = this.baseSpeed;

    // 1. Scroll & wrap Obsidian Spires (Parallax = 0.10)
    const spMultiplier = 0.10;
    for (const sp of this._spires) {
      sp.mesh.position.x -= scrollSpeed * spMultiplier * dt;
      if (sp.mesh.position.x < -GAME_WIDTH / 2 - 60) {
        sp.mesh.position.x = GAME_WIDTH / 2 + 60;

        // Randomize dimensions on wrap to simulate infinite variety
        const heightScale = 0.8 + Math.random() * 0.5;
        const widthScale = 0.7 + Math.random() * 0.6;
        sp.mesh.scale.set(widthScale, heightScale, widthScale);

        // Reposition slightly based on top/bottom
        sp.mesh.position.y = sp.isTop ? GAME_HEIGHT / 2 - 20 : -GAME_HEIGHT / 2 + 20;
      }
    }

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
          freeP.mesh.scale.setScalar(1.0);
          freeP.mesh.visible = true;
        }
      }
    }

    // Update active geyser particles
    for (const p of this._particles) {
      if (!p.active) continue;

      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Parallax scroll left + vertical drift
      p.x -= scrollSpeed * gyMultiplier * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.mesh.position.set(p.x, p.y, p.z);

      // Shrink and fade as particle ages
      const lifeRatio = 1.0 - (p.age / p.maxAge);
      p.mesh.scale.setScalar(lifeRatio);
    }

    // 3. Scroll, wrap & tumble Tectonic Rocks (Parallax = 0.45)
    const plMultiplier = 0.45;
    for (const pl of this._plates) {
      pl.group.position.x -= scrollSpeed * plMultiplier * dt;
      if (pl.group.position.x < -GAME_WIDTH / 2 - 120) {
        pl.group.position.x = GAME_WIDTH / 2 + 120;
        // Re-randomize vertical height on wrap
        pl.group.position.y = (Math.random() - 0.5) * (GAME_HEIGHT * 0.5);
      }

      // Slowly tumble the main rock in 3D
      pl.mainMesh.rotation.x += pl.mainRot.x * dt;
      pl.mainMesh.rotation.y += pl.mainRot.y * dt;
      pl.mainMesh.rotation.z += pl.mainRot.z * dt;

      // Slowly tumble the satellite rock chunks in 3D
      for (const sub of pl.subRocks) {
        sub.mesh.rotation.x += sub.rotX * dt;
        sub.mesh.rotation.y += sub.rotY * dt;
        sub.mesh.rotation.z += sub.rotZ * dt;
      }
    }

    // 4. Update Embers (drift left/up, tumble, flicker)
    for (const em of this._embers) {
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

      em.mesh.position.set(em.x, em.y, em.z);

      // Rotations
      em.mesh.rotation.x += em.rotSpeed * dt;
      em.mesh.rotation.y += em.rotSpeed * dt;

      // Flicker opacity
      const flickerVal = Math.sin(this._time * em.flickerSpeed + em.flickerOffset);
      em.mat.opacity = 0.25 + 0.75 * Math.abs(flickerVal);
    }
  }

  destroy(): void {
    // Backdrop
    this._scene.remove(this._backdropMesh);
    this._backdropGeo.dispose();
    this._backdropMat.dispose();

    // Spires
    for (const sp of this._spires) {
      this._scene.remove(sp.mesh);
    }
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
    for (const p of this._particles) {
      this._scene.remove(p.mesh);
    }
    this._particleGeo.dispose();
    this._particleMat.dispose();

    // Tectonic Rocks
    for (const pl of this._plates) {
      this._scene.remove(pl.group);
    }
    this._mainRockGeo.dispose();
    this._subRockGeo.dispose();
    this._plateMat.dispose();

    // Embers
    for (const em of this._embers) {
      this._scene.remove(em.mesh);
      em.mat.dispose();
    }
    this._emberGeo.dispose();
  }
}
