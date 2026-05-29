import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { STANDARD_VERT } from './ShaderChunks.ts';
import type { IBackground, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

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

    // --- Background Nebula (Original space colors backdrop) ---
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

interface StructEntry {
  mesh: THREE.Group;
  speedMult: number;
  type: string;
  gearSpeed?: number;
}

interface DustEntry {
  mesh: THREE.Mesh;
  speedMult: number;
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

  private _structures: StructEntry[];

  private _dustMatCyan: THREE.MeshBasicMaterial;
  private _dustMatBlue: THREE.MeshBasicMaterial;
  private _dustGeoOcta: THREE.OctahedronGeometry;
  private _dustGeoTetra: THREE.TetrahedronGeometry;
  private _dust: DustEntry[];

  constructor(scene: IScene, baseSpeed: number = 100) {
    this._scene    = scene;
    this.baseSpeed = baseSpeed;
    this._time     = 0;

    // ── 1. Cosmic Space Nebula Backdrop ──
    const nebulaMat = new THREE.ShaderMaterial({
      uniforms:       { uTime: { value: 0 } },
      vertexShader:   STANDARD_VERT,
      fragmentShader: NEBULA_FRAG,
      depthWrite:     false,
    });
    const nebulaGeo  = new THREE.PlaneGeometry(GAME_WIDTH, GAME_HEIGHT);
    this._nebulaMesh = new THREE.Mesh(nebulaGeo, nebulaMat);
    markRenderCategory(this._nebulaMesh, RenderCategory.BACKGROUND);
    this._nebulaMesh.position.z = -100;
    this._nebulaMesh.scale.set(1.4, 1.4, 1.0); // Scale up to ensure full screen coverage under tilt
    scene.add(this._nebulaMesh);
    this._nebulaMat = nebulaMat;

    // ── 2. Shared Megastructure Materials ──
    this._baseMat = new THREE.MeshPhongMaterial({
      color: 0x1d212a,       // dark metallic carbon-steel
      emissive: 0x050608,    // deep ambient backing
      specular: 0x556688,    // cool gray-blue highlights
      shininess: 75,
      flatShading: true,     // sharp faceted low-poly look
    });

    this._emissiveMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,       // glowing neon cyber-cyan
      transparent: true,
      opacity: 0.95,
    });

    // Brighter, higher-visibility custom materials for foreground arches so they stand out
    this._archBaseMat = new THREE.MeshPhongMaterial({
      color: 0x3d4758,       // much brighter bluish steel
      emissive: 0x0f1d2e,    // subtle deep-cyan self-illuminating ambient glow
      specular: 0x8899bb,    // highly reactive specular sheen
      shininess: 90,
      flatShading: true,
    });

    this._archEmissiveMat = new THREE.MeshBasicMaterial({
      color: 0x33ffdd,       // extra-bright glowing cyber-cyan
      transparent: true,
      opacity: 0.98,
    });

    // ── 3. Megastructure Recycling Pool ──
    this._structures = [];

    // Layer A: Foreground Segmented Hangar Arches (Z = -22, speedMult = 1.25)
    for (let i = 0; i < 4; i++) {
      const arch = this._buildArch(this._archBaseMat, this._archEmissiveMat);
      arch.position.set(
        -HALF_W - 50 + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 60,
        0,
        -22
      );
      markRenderCategory(arch, RenderCategory.BACKGROUND);
      scene.add(arch);
      this._structures.push({
        mesh: arch,
        speedMult: 1.25,
        type: 'arch',
      });
    }

    // Layer B: Midground Cooling Fan Towers (Z = -45 to -52, speedMult = 0.70)
    for (let i = 0; i < 4; i++) {
      const tower = this._buildCoolingTower(this._baseMat, this._emissiveMat);
      const ySign = i % 2 === 0 ? 1 : -1;
      const yOffset = ySign * (145 + Math.random() * 25);
      const zDepth = -45 - Math.random() * 7;
      tower.position.set(
        -HALF_W + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        yOffset,
        zDepth
      );
      if (ySign === 1) {
        tower.rotation.z = Math.PI; // flip overhead
      }
      markRenderCategory(tower, RenderCategory.BACKGROUND);
      scene.add(tower);
      this._structures.push({
        mesh: tower,
        speedMult: 0.70,
        type: 'tower',
      });
    }

    // Layer C: Midground Conduit Pipelines (Z = -55 to -62, speedMult = 0.65)
    for (let i = 0; i < 4; i++) {
      const pipe = this._buildPipeline(this._baseMat, this._emissiveMat);
      const ySign = i % 2 === 0 ? 1 : -1;
      const yOffset = ySign * (190 + Math.random() * 20);
      const zDepth = -55 - Math.random() * 7;
      pipe.position.set(
        -HALF_W - 100 + i * (GAME_WIDTH / 3) + (Math.random() - 0.5) * 80,
        yOffset,
        zDepth
      );
      markRenderCategory(pipe, RenderCategory.BACKGROUND);
      scene.add(pipe);
      this._structures.push({
        mesh: pipe,
        speedMult: 0.65,
        type: 'pipe',
      });
    }

    // Layer D: Background Power Spires (Z = -90, speedMult = 0.25)
    for (let i = 0; i < 3; i++) {
      const spire = this._buildPowerSpire(this._baseMat, this._emissiveMat);
      const ySign = i % 2 === 0 ? 1 : -1;
      const yOffset = ySign * (180 + Math.random() * 40);
      spire.position.set(
        -HALF_W + i * (GAME_WIDTH / 2) + (Math.random() - 0.5) * 120,
        yOffset,
        -90
      );
      if (ySign === 1) {
        spire.rotation.z = Math.PI;
      }
      markRenderCategory(spire, RenderCategory.BACKGROUND);
      scene.add(spire);
      this._structures.push({
        mesh: spire,
        speedMult: 0.25,
        type: 'spire',
      });
    }

    // Layer E: Background Station Rings (Z = -90, speedMult = 0.20)
    for (let i = 0; i < 3; i++) {
      const ring = this._buildBackgroundRing(this._baseMat, this._emissiveMat);
      ring.position.set(
        -HALF_W + i * (GAME_WIDTH / 2) + (Math.random() - 0.5) * 120,
        (Math.random() - 0.5) * 90,
        -90
      );
      markRenderCategory(ring, RenderCategory.BACKGROUND);
      scene.add(ring);
      this._structures.push({
        mesh: ring,
        speedMult: 0.20,
        type: 'ring',
      });
    }

    // ── 4. 3D Crystalline Space Dust ──
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
    this._dustGeoOcta  = new THREE.OctahedronGeometry(1.2);
    this._dustGeoTetra = new THREE.TetrahedronGeometry(1.0);

    this._dust = [];
    const dustCount = 80;
    for (let i = 0; i < dustCount; i++) {
      const geo = Math.random() > 0.5 ? this._dustGeoOcta : this._dustGeoTetra;
      const mat = Math.random() > 0.5 ? this._dustMatCyan : this._dustMatBlue;
      const mesh = new THREE.Mesh(geo, mat);

      const zVal = -12 - Math.random() * 83; // Z bounds: -12 (foreground dust) to -95
      // Parallax speed based on depth (closer particles scroll faster)
      const speedMult = 0.15 + (1.0 - (Math.abs(zVal) - 12) / 83) * 1.15;

      mesh.position.set(
        (Math.random() - 0.5) * GAME_WIDTH * 1.5,
        (Math.random() - 0.5) * GAME_HEIGHT * 1.2,
        zVal
      );

      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const rx = (Math.random() - 0.5) * 2.2;
      const ry = (Math.random() - 0.5) * 2.2;
      const rz = (Math.random() - 0.5) * 2.2;

      markRenderCategory(mesh, RenderCategory.BACKGROUND);
      scene.add(mesh);
      this._dust.push({ mesh, speedMult, rx, ry, rz });
    }
  }

  // ── 3D Procedural Megastructure Builders ──

  private _buildArch(mat: THREE.MeshPhongMaterial, emissiveMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Low-poly octagonal ring archway (player flies through its center)
    const ringGeo = new THREE.TorusGeometry(245, 14, 4, 8);
    ringGeo.rotateY(Math.PI / 2); // align perpendicular to viewport path
    const ring = new THREE.Mesh(ringGeo, mat);
    group.add(ring);

    // Support reinforcement columns on outer bounds
    const panelGeo = new THREE.BoxGeometry(32, 50, 18);
    const topPanel = new THREE.Mesh(panelGeo, mat);
    topPanel.position.set(0, 235, 0);
    const botPanel = new THREE.Mesh(panelGeo, mat);
    botPanel.position.set(0, -235, 0);
    group.add(topPanel, botPanel);

    // Dynamic glowing cyber-cyan indicator bars on the inner side of top/bottom columns
    const indicatorGeo = new THREE.BoxGeometry(34, 12, 20);
    const topInd = new THREE.Mesh(indicatorGeo, emissiveMat);
    topInd.position.set(0, 205, 0);
    const botInd = new THREE.Mesh(indicatorGeo, emissiveMat);
    botInd.position.set(0, -205, 0);
    group.add(topInd, botInd);

    // Searing neon cyber-cyan glowing inner trim band (thickened)
    const trimGeo = new THREE.TorusGeometry(234, 3.5, 4, 8);
    trimGeo.rotateY(Math.PI / 2);
    const trim = new THREE.Mesh(trimGeo, emissiveMat);
    group.add(trim);

    // Secondary outer neon cyber-cyan glowing trim band for double neon effect
    const outerTrimGeo = new THREE.TorusGeometry(256, 2.2, 4, 8);
    outerTrimGeo.rotateY(Math.PI / 2);
    const outerTrim = new THREE.Mesh(outerTrimGeo, emissiveMat);
    group.add(outerTrim);

    return group;
  }

  private _buildCoolingTower(mat: THREE.MeshPhongMaterial, emissiveMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Heavy support column base
    const baseGeo = new THREE.CylinderGeometry(16, 24, 110, 6);
    const base = new THREE.Mesh(baseGeo, mat);
    group.add(base);

    // Ventilation fan hub
    const hubGeo = new THREE.CylinderGeometry(13, 13, 14, 6);
    hubGeo.rotateX(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, mat);
    hub.position.set(0, 10, 5);
    group.add(hub);

    // Four cooling fan blades
    const blades = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(40, 5, 1.8);
    const blade1 = new THREE.Mesh(bladeGeo, mat);
    const blade2 = new THREE.Mesh(bladeGeo, mat);
    blade2.rotation.z = Math.PI / 2;
    blades.add(blade1, blade2);
    blades.position.copy(hub.position);
    group.userData = { blades };
    group.add(blades);

    // Glowing exhaust portal
    const ventGeo = new THREE.CylinderGeometry(14, 14, 3, 6);
    const vent = new THREE.Mesh(ventGeo, emissiveMat);
    vent.position.set(0, 56, 0);
    group.add(vent);

    return group;
  }

  private _buildPipeline(mat: THREE.MeshPhongMaterial, emissiveMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Horizontal energy transport conduit
    const pipeGeo = new THREE.CylinderGeometry(11, 11, 280, 6);
    pipeGeo.rotateZ(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, mat);
    group.add(pipe);

    // Symmetrical industrial valve brackets
    const clampGeo = new THREE.CylinderGeometry(15, 15, 16, 6);
    clampGeo.rotateZ(Math.PI / 2);
    const clampL = new THREE.Mesh(clampGeo, mat);
    clampL.position.set(-75, 0, 0);
    const clampR = new THREE.Mesh(clampGeo, mat);
    clampR.position.set(75, 0, 0);
    group.add(clampL, clampR);

    // Magma-cyan cooling rings
    const seamGeo = new THREE.CylinderGeometry(12.5, 12.5, 5, 6);
    seamGeo.rotateZ(Math.PI / 2);
    const seamL = new THREE.Mesh(seamGeo, emissiveMat);
    seamL.position.copy(clampL.position);
    const seamR = new THREE.Mesh(seamGeo, emissiveMat);
    seamR.position.copy(clampR.position);
    group.add(seamL, seamR);

    return group;
  }

  private _buildPowerSpire(mat: THREE.MeshPhongMaterial, emissiveMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Tower structural column
    const spireGeo = new THREE.CylinderGeometry(9, 38, 480, 6);
    const spire = new THREE.Mesh(spireGeo, mat);
    group.add(spire);

    // Glowing spire tip/capacitor
    const crownGeo = new THREE.CylinderGeometry(10, 10, 14, 6);
    const crown = new THREE.Mesh(crownGeo, emissiveMat);
    crown.position.set(0, 240, 0);
    group.add(crown);

    return group;
  }

  private _buildBackgroundRing(mat: THREE.MeshPhongMaterial, emissiveMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Giant background station ring
    const ringGeo = new THREE.TorusGeometry(180, 7, 4, 12);
    ringGeo.rotateY(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, mat);
    group.add(ring);

    // Inner neon energetic torus core
    const coreGeo = new THREE.TorusGeometry(171, 1.2, 4, 12);
    coreGeo.rotateY(Math.PI / 2);
    const core = new THREE.Mesh(coreGeo, emissiveMat);
    group.add(core);

    return group;
  }

  update(dt: number): void {
    this._time += dt;
    this._nebulaMat.uniforms['uTime']!.value = this._time;

    // 1. Scroll & Wrap Megastructures
    for (const struct of this._structures) {
      const dx = this.baseSpeed * struct.speedMult * dt;
      struct.mesh.position.x -= dx;

      // Wrap back to the right when off-screen
      if (struct.mesh.position.x < -HALF_W - 130) {
        struct.mesh.position.x = HALF_W + 130 + Math.random() * 120;

        // Re-randomize height offsets and rotations to keep landscape organic
        if (struct.type === 'tower') {
          const ySign = Math.random() > 0.5 ? 1 : -1;
          struct.mesh.position.y = ySign * (145 + Math.random() * 25);
          struct.mesh.rotation.z = ySign === 1 ? Math.PI : 0;
        } else if (struct.type === 'pipe') {
          const ySign = Math.random() > 0.5 ? 1 : -1;
          struct.mesh.position.y = ySign * (190 + Math.random() * 20);
        } else if (struct.type === 'spire') {
          const ySign = Math.random() > 0.5 ? 1 : -1;
          struct.mesh.position.y = ySign * (180 + Math.random() * 40);
          struct.mesh.rotation.z = ySign === 1 ? Math.PI : 0;
        } else if (struct.type === 'ring') {
          struct.mesh.position.y = (Math.random() - 0.5) * 90;
        }
      }

      // Fan blade active rotation
      if (struct.type === 'tower' && struct.mesh.userData.blades) {
        struct.mesh.userData.blades.rotation.z += 3.5 * dt;
      }

      // Orbital station ring slow rotation
      if (struct.type === 'ring') {
        struct.mesh.rotation.y += 0.22 * dt;
      }
    }

    // 2. Scroll & Tumbling Crystalline Space Dust
    for (const d of this._dust) {
      const dx = this.baseSpeed * d.speedMult * dt;
      d.mesh.position.x -= dx;

      // Active rotation spin
      d.mesh.rotation.x += d.rx * dt;
      d.mesh.rotation.y += d.ry * dt;
      d.mesh.rotation.z += d.rz * dt;

      // Wrap space dust
      if (d.mesh.position.x < -HALF_W - 40) {
        d.mesh.position.x = HALF_W + 40 + Math.random() * 40;
        d.mesh.position.y = (Math.random() - 0.5) * GAME_HEIGHT * 1.2;
      }
    }
  }

  destroy(): void {
    // 1. Clean up Nebula
    if (this._nebulaMesh) {
      this._scene.remove(this._nebulaMesh);
      this._nebulaMesh.geometry.dispose();
      (this._nebulaMesh.material as THREE.Material).dispose();
      this._nebulaMesh = null;
    }

    // 2. Clean up Megastructures
    for (const struct of this._structures) {
      this._scene.remove(struct.mesh);
      struct.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    }
    this._structures = [];

    // Dispose shared model styling resources
    this._baseMat.dispose();
    this._emissiveMat.dispose();
    this._archBaseMat.dispose();
    this._archEmissiveMat.dispose();

    // 3. Clean up Crystalline Space Dust
    for (const d of this._dust) {
      this._scene.remove(d.mesh);
    }
    this._dust = [];

    // Dispose shared dust resources
    this._dustMatCyan.dispose();
    this._dustMatBlue.dispose();
    this._dustGeoOcta.dispose();
    this._dustGeoTetra.dispose();
  }
}
