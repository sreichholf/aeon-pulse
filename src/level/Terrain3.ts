import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import type { ITerrain, TerrainBounds, IScene } from '../types.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

interface ControlPoint {
  at: number;
  top: number;
  bottom: number;
}

export class Terrain3 implements ITerrain {
  private _scene: IScene;
  private _points: ControlPoint[];
  private _time: number;

  // ── Shared Materials ──
  private _baseMat: THREE.MeshPhongMaterial;
  private _membraneMat: THREE.MeshPhongMaterial;
  private _glowMat: THREE.MeshBasicMaterial;
  private _sporeGlowMat: THREE.MeshBasicMaterial;
  private _boneMat: THREE.MeshPhongMaterial;

  // ── Shared Geometries ──
  private _membraneGeo: THREE.BoxGeometry;
  private _lobeGeo: THREE.SphereGeometry;
  private _veinGeo: THREE.BoxGeometry;
  private _sporeGeo: THREE.SphereGeometry;
  private _boneColGeo: THREE.CylinderGeometry;
  private _knuckleGeo: THREE.SphereGeometry;
  private _tipGeo: THREE.SphereGeometry;

  // ── Pools ──
  private _sliceWidth: number;
  private _numSlices: number;
  private _topPanels: THREE.Group[];
  private _botPanels: THREE.Group[];
  private _topSpikes: THREE.Group[];
  private _botSpikes: THREE.Group[];

  constructor(scene: IScene, points: ControlPoint[]) {
    this._scene  = scene;
    this._points = points;
    this._time   = 0;

    // ── 1. Shared Biological Materials ──
    // Wet organic rose-crimson/magenta flesh tissue for surface lobes
    this._baseMat = new THREE.MeshPhongMaterial({
      color: 0xb52d57,
      emissive: 0x2b0614,
      specular: 0xffaacc,
      shininess: 90,
      flatShading: true,
    });

    // Deep shadowed backing tissue membrane (dark burgundy-black to prevent flat-surface specular blowout)
    this._membraneMat = new THREE.MeshPhongMaterial({
      color: 0x3d0a19,      // Deep rich organic shadow burgundy
      emissive: 0x0c0105,   // Dark shadow emission
      specular: 0x22050e,   // Low specular reflection to prevent blowout
      shininess: 20,        // Soft matte-wet look
      flatShading: true,
    });

    // Searing hot magenta veins
    this._glowMat = new THREE.MeshBasicMaterial({
      color: 0xff00aa,
      transparent: true,
      opacity: 0.95,
    });

    // Toxic yellow-green bioluminescent spores
    this._sporeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xb2ff00,
      transparent: true,
      opacity: 0.95,
    });

    // Polished calcified ivory bone
    this._boneMat = new THREE.MeshPhongMaterial({
      color: 0xf2ebd9,
      specular: 0xffffff,
      shininess: 80,
      flatShading: true,
    });

    // ── 2. Shared Geometries (Pre-allocated for locked 60 FPS) ──
    this._membraneGeo = new THREE.BoxGeometry(66, 1.0, 15);
    this._lobeGeo     = new THREE.SphereGeometry(25, 8, 8);
    this._veinGeo     = new THREE.BoxGeometry(4, 1.01, 8);
    this._sporeGeo    = new THREE.SphereGeometry(4, 6, 6);
    this._boneColGeo  = new THREE.CylinderGeometry(2, 3, 1.0, 6);
    this._knuckleGeo  = new THREE.SphereGeometry(4.5, 6, 6);
    this._tipGeo      = new THREE.SphereGeometry(5, 6, 6);

    // ── 3. Initialize Reusable Segment Pools ──
    this._sliceWidth = 70;
    this._numSlices  = 18;

    this._topPanels  = [];
    this._botPanels  = [];
    this._topSpikes  = [];
    this._botSpikes  = [];

    for (let i = 0; i < this._numSlices; i++) {
      // Build organic ceiling and floor panels
      const topP = this._buildPanel(this._baseMat, this._glowMat, this._sporeGlowMat);
      const botP = this._buildPanel(this._baseMat, this._glowMat, this._sporeGlowMat);
      this._scene.add(topP);
      this._scene.add(botP);
      this._topPanels.push(topP);
      this._botPanels.push(botP);

      // Build calcified bone spikes at the seams
      const topSpk = this._buildSpike(this._boneMat, this._sporeGlowMat);
      const botSpk = this._buildSpike(this._boneMat, this._sporeGlowMat);
      this._scene.add(topSpk);
      this._scene.add(botSpk);
      this._topSpikes.push(topSpk);
      this._botSpikes.push(botSpk);
    }

    this.update(0);
  }

  // ── 3D Modular Organ Builders ──

  private _buildPanel(
    baseMat: THREE.MeshPhongMaterial,
    glowMat: THREE.MeshBasicMaterial,
    sporeMat: THREE.MeshBasicMaterial
  ): THREE.Group {
    const group = new THREE.Group();

    // Backing membrane box that will be stretched vertically (uses the dark, non-blowout shadow material)
    const membrane = new THREE.Mesh(this._membraneGeo, this._membraneMat);
    group.add(membrane);

    // Surface organic structures (lobes, veins, spores) that remain undistorted
    const surface = new THREE.Group();

    // Lobe 1 (center)
    const lobe1 = new THREE.Mesh(this._lobeGeo, baseMat);
    lobe1.scale.set(1.0, 1.0, 0.4);
    surface.add(lobe1);

    // Lobe 2 (left)
    const lobe2 = new THREE.Mesh(this._lobeGeo, baseMat);
    lobe2.scale.set(0.8, 1.2, 0.35);
    lobe2.position.set(-18, 0, -2);
    surface.add(lobe2);

    // Lobe 3 (right)
    const lobe3 = new THREE.Mesh(this._lobeGeo, baseMat);
    lobe3.scale.set(0.8, 1.2, 0.35);
    lobe3.position.set(18, 0, -2);
    surface.add(lobe3);

    // Glowing magenta veins
    const leftVein = new THREE.Mesh(this._veinGeo, glowMat);
    leftVein.position.set(-20, 0, 6);
    const rightVein = new THREE.Mesh(this._veinGeo, glowMat);
    rightVein.position.set(20, 0, 6);
    surface.add(leftVein, rightVein);

    // Toxic yellow-green bioluminescent spores
    const spore1 = new THREE.Mesh(this._sporeGeo, sporeMat);
    spore1.position.set(-8, 0, 10);
    const spore2 = new THREE.Mesh(this._sporeGeo, sporeMat);
    spore2.position.set(8, 0, 10);
    const spore3 = new THREE.Mesh(this._sporeGeo, sporeMat);
    spore3.position.set(0, 0, 11);
    surface.add(spore1, spore2, spore3);

    group.add(surface);

    // Store references in userData for distortion-free updating
    group.userData = { membrane, surface };

    return group;
  }

  private _buildSpike(boneMat: THREE.MeshPhongMaterial, sporeMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Calcified bone shaft (height 1, will be scaled)
    const shaft = new THREE.Mesh(this._boneColGeo, boneMat);
    group.add(shaft);

    // Joint knuckles running down the shaft (will remain perfect spheres)
    const knuckle1 = new THREE.Mesh(this._knuckleGeo, boneMat);
    const knuckle2 = new THREE.Mesh(this._knuckleGeo, boneMat);
    const knuckle3 = new THREE.Mesh(this._knuckleGeo, boneMat);
    group.add(knuckle1, knuckle2, knuckle3);

    // Glowing toxic tip at the inner edge (will remain perfect sphere)
    const tip = new THREE.Mesh(this._tipGeo, sporeMat);
    group.add(tip);

    // Store references in userData for update loop scaling
    group.userData = { shaft, knuckle1, knuckle2, knuckle3, tip };

    return group;
  }

  // ── Linear Interpolation for dynamic organic walls ──

  getWallsAt(scrollX: number): TerrainBounds {
    const pts = this._points;
    if (!pts || pts.length === 0) return { top: GAME_HEIGHT / 2, bottom: -GAME_HEIGHT / 2 };
    const first = pts[0]!;
    const last  = pts[pts.length - 1]!;
    if (scrollX <= first.at) return { top: first.top, bottom: first.bottom };
    if (scrollX >= last.at)  return { top: last.top,  bottom: last.bottom  };
    let prev = first;
    for (const cur of pts.slice(1)) {
      if (scrollX >= prev.at && scrollX <= cur.at) {
        const t = (scrollX - prev.at) / (cur.at - prev.at);
        return {
          top:    prev.top    + (cur.top    - prev.top)    * t,
          bottom: prev.bottom + (cur.bottom - prev.bottom) * t,
        };
      }
      prev = cur;
    }
    return { top: last.top, bottom: last.bottom };
  }

  // ── Infinite Scrolling & Writhing Breathing Update Loop ──

  update(scrollX: number): void {
    this._time += 0.016; // approximate delta time per frame

    for (const [i, topPanel] of this._topPanels.entries()) {
      // Infinite wrapping relative X viewport coordinate
      const localX = (i * this._sliceWidth - (scrollX % this._sliceWidth)) - (HALF_W + 100);

      // Calculate global world X for dynamic LEVEL3_TERRAIN wall queries
      const worldX = scrollX + localX;
      const { top, bottom } = this.getWallsAt(worldX);

      // --- 1. Ceiling Panels (top with sweeping phase-offset breathing) ---
      const breathingTop = 1.0 + 0.06 * Math.sin(this._time * 2.5 + i * 0.4);
      const hTop = Math.max(1, HALF_H - top);
      const tPanelData = topPanel.userData;

      // Position the panel exactly at the ceiling boundary
      topPanel.position.set(localX, top, -10);

      // Scale and position only the backing box membrane to cover depth
      tPanelData.membrane.scale.y = hTop;
      tPanelData.membrane.position.y = hTop / 2;

      // Apply uniform non-distorting organic breathing to the surface lobes
      tPanelData.surface.scale.set(breathingTop, breathingTop, breathingTop);

      // --- 2. Floor Panels (bottom with inverted phase-offset breathing) ---
      const breathingBot = 1.0 + 0.06 * Math.sin(this._time * 2.5 - i * 0.4);
      const hBot = Math.max(1, bottom + HALF_H);
      const botPanel = this._botPanels[i]!;
      const bPanelData = botPanel.userData;

      // Position the panel exactly at the floor boundary
      botPanel.position.set(localX, bottom, -10);

      // Scale and position only the backing box membrane to cover depth
      bPanelData.membrane.scale.y = hBot;
      bPanelData.membrane.position.y = -hBot / 2;

      // Apply uniform non-distorting organic breathing to the surface lobes
      bPanelData.surface.scale.set(breathingBot, breathingBot, breathingBot);

      // --- 3. Ceiling Spikes (bone ribs at panel seams) ---
      const seamLocalX = localX + this._sliceWidth / 2;
      const seamWorldX = scrollX + seamLocalX;
      const seamWalls  = this.getWallsAt(seamWorldX);

      const hTopSpike = Math.max(1, HALF_H - seamWalls.top + 8);
      const topSpk = this._topSpikes[i]!;
      const tSpkData = topSpk.userData;

      // Position Group exactly at the ceiling boundary seam
      topSpk.position.set(seamLocalX, seamWalls.top - 4, -7);

      // Scale and position only the shaft cylinder
      tSpkData.shaft.scale.y = hTopSpike;
      tSpkData.shaft.position.y = hTopSpike / 2;

      // Position knuckles along the scaled shaft without distortion
      tSpkData.knuckle1.position.y = hTopSpike * 0.25;
      tSpkData.knuckle2.position.y = hTopSpike * 0.50;
      tSpkData.knuckle3.position.y = hTopSpike * 0.75;

      // Position the toxic glowing spore tip at the inner edge (local y = 0)
      tSpkData.tip.position.y = 0;

      // --- 4. Floor Spikes (flipped vertically pointing upwards) ---
      const hBotSpike = Math.max(1, seamWalls.bottom + HALF_H + 8);
      const botSpk = this._botSpikes[i]!;
      const bSpkData = botSpk.userData;

      // Position Group exactly at the floor boundary seam
      botSpk.position.set(seamLocalX, seamWalls.bottom + 4, -7);

      // Scale and position only the shaft cylinder extending downwards
      bSpkData.shaft.scale.y = hBotSpike;
      bSpkData.shaft.position.y = -hBotSpike / 2;

      // Position knuckles along the scaled shaft without distortion
      bSpkData.knuckle1.position.y = -hBotSpike * 0.25;
      bSpkData.knuckle2.position.y = -hBotSpike * 0.50;
      bSpkData.knuckle3.position.y = -hBotSpike * 0.75;

      // Position the toxic glowing spore tip at the inner edge (local y = 0)
      bSpkData.tip.position.y = 0;
    }
  }

  // ── GPU Memory Clean-up ──

  destroy(): void {
    for (let i = 0; i < this._numSlices; i++) {
      this._scene.remove(this._topPanels[i]!);
      this._scene.remove(this._botPanels[i]!);
      this._scene.remove(this._topSpikes[i]!);
      this._scene.remove(this._botSpikes[i]!);
    }

    // Dispose shared geometries
    this._membraneGeo.dispose();
    this._lobeGeo.dispose();
    this._veinGeo.dispose();
    this._sporeGeo.dispose();
    this._boneColGeo.dispose();
    this._knuckleGeo.dispose();
    this._tipGeo.dispose();

    // Dispose shared materials
    this._baseMat.dispose();
    this._membraneMat.dispose();
    this._glowMat.dispose();
    this._sporeGlowMat.dispose();
    this._boneMat.dispose();

    this._topPanels = [];
    this._botPanels = [];
    this._topSpikes = [];
    this._botSpikes = [];
  }
}
