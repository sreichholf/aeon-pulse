import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import type { ITerrain, TerrainBounds, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

interface ControlPoint {
  at: number;
  top: number;
  bottom: number;
}

export class Terrain implements ITerrain {
  private _scene: IScene;
  private _points: ControlPoint[];

  // ── Shared Materials ──
  private _baseMat: THREE.MeshPhongMaterial;
  private _glowMat: THREE.MeshBasicMaterial;
  private _pillarMat: THREE.MeshPhongMaterial;

  // ── Shared Geometries ──
  private _plateGeo: THREE.BoxGeometry;
  private _glowGeo: THREE.BoxGeometry;
  private _conduitGeo: THREE.BoxGeometry;
  private _beamGeo: THREE.BoxGeometry;
  private _stripGeo: THREE.BoxGeometry;

  // ── Pools ──
  private _sliceWidth: number;
  private _numSlices: number;
  private _topPanels: THREE.Group[];
  private _botPanels: THREE.Group[];
  private _topPillars: THREE.Group[];
  private _botPillars: THREE.Group[];

  constructor(scene: IScene, points: ControlPoint[]) {
    this._scene  = scene;
    this._points = points;

    // ── 1. Shared Materials ──
    // Dark metallic steel-grey panels
    this._baseMat = new THREE.MeshPhongMaterial({
      color: 0x333b4d,
      specular: 0x556688,
      shininess: 70,
      flatShading: true,
    });

    // Highly emissive glowing warning amber joints/seams
    this._glowMat = new THREE.MeshBasicMaterial({
      color: 0xff7700,
      transparent: true,
      opacity: 0.95,
    });

    // Dark carbon-steel for support pillars and recessed panel conduits
    this._pillarMat = new THREE.MeshPhongMaterial({
      color: 0x222631,
      specular: 0x445577,
      shininess: 60,
      flatShading: true,
    });

    // ── 2. Shared Geometries (One-time instantiation for performance) ──
    this._plateGeo   = new THREE.BoxGeometry(66, 1.0, 20);
    this._glowGeo    = new THREE.BoxGeometry(2, 1.02, 21);
    this._conduitGeo = new THREE.BoxGeometry(40, 1.01, 8);
    this._beamGeo    = new THREE.BoxGeometry(10, 1.0, 26);
    this._stripGeo   = new THREE.BoxGeometry(3, 1.01, 28);

    // ── 3. Initialize Reusable Pools ──
    this._sliceWidth = 70;
    this._numSlices  = 18;

    this._topPanels  = [];
    this._botPanels  = [];
    this._topPillars = [];
    this._botPillars = [];

    for (let i = 0; i < this._numSlices; i++) {
      // Build Ceiling Panel and Floor Panel
      const topP = this._buildPanel(this._baseMat, this._glowMat);
      const botP = this._buildPanel(this._baseMat, this._glowMat);
      markRenderCategory(topP, RenderCategory.TERRAIN);
      markRenderCategory(botP, RenderCategory.TERRAIN);
      this._scene.add(topP);
      this._scene.add(botP);
      this._topPanels.push(topP);
      this._botPanels.push(botP);

      // Build Support Pillars (placed at the seams between panels)
      const topCol = this._buildPillar(this._pillarMat, this._glowMat);
      const botCol = this._buildPillar(this._pillarMat, this._glowMat);
      markRenderCategory(topCol, RenderCategory.TERRAIN);
      markRenderCategory(botCol, RenderCategory.TERRAIN);
      this._scene.add(topCol);
      this._scene.add(botCol);
      this._topPillars.push(topCol);
      this._botPillars.push(botCol);
    }

    this.update(0);
  }

  // ── 3D Modular Terrain Builders ──

  private _buildPanel(baseMat: THREE.MeshPhongMaterial, glowMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Main structural box panel
    const plate = new THREE.Mesh(this._plateGeo, baseMat);
    group.add(plate);

    // Glowing warning amber seams at the left/right edges
    const leftGlow = new THREE.Mesh(this._glowGeo, glowMat);
    leftGlow.position.x = -33;
    const rightGlow = new THREE.Mesh(this._glowGeo, glowMat);
    rightGlow.position.x = 33;
    group.add(leftGlow, rightGlow);

    // Recessed conduit center plate
    const conduit = new THREE.Mesh(this._conduitGeo, this._pillarMat);
    group.add(conduit);

    return group;
  }

  private _buildPillar(pillarMat: THREE.MeshPhongMaterial, glowMat: THREE.MeshBasicMaterial): THREE.Group {
    const group = new THREE.Group();

    // Heavy steel bracket column
    const beam = new THREE.Mesh(this._beamGeo, pillarMat);
    group.add(beam);

    // Glowing indicator strip down the center
    const strip = new THREE.Mesh(this._stripGeo, glowMat);
    group.add(strip);

    return group;
  }

  // ── Linear Interpolation for Collision Walls ──

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

  // ── Infinite Scrolling & Real-time Scaling Update Loop ──

  update(scrollX: number): void {
    for (const [i, topPanel] of this._topPanels.entries()) {
      // Infinite wrapping X coordinate relative to the camera viewport
      const localX = (i * this._sliceWidth - (scrollX % this._sliceWidth)) - (HALF_W + 100);

      // Calculate global world X coordinate for collision wall height queries
      const worldX = scrollX + localX;
      const { top, bottom } = this.getWallsAt(worldX);

      // --- 1. Ceiling Panels (top) ---
      const hTop = Math.max(1, HALF_H - top);
      topPanel.scale.y = hTop;
      topPanel.position.set(localX, top + hTop / 2, -10);

      // --- 2. Floor Panels (bottom) ---
      const hBot = Math.max(1, bottom + HALF_H);
      const botPanel = this._botPanels[i]!;
      botPanel.scale.y = hBot;
      botPanel.position.set(localX, bottom - hBot / 2, -10);

      // --- 3. Ceiling Support Pillars (placed at the seams) ---
      const seamLocalX = localX + this._sliceWidth / 2;
      const seamWorldX = scrollX + seamLocalX;
      const seamWalls  = this.getWallsAt(seamWorldX);

      const hTopPillar = Math.max(1, HALF_H - seamWalls.top + 10);
      const topPillar  = this._topPillars[i]!;
      topPillar.scale.y = hTopPillar;
      // Positioned with a 5px protrusion past the panel edge to frame it beautifully
      topPillar.position.set(seamLocalX, seamWalls.top - 5 + hTopPillar / 2, -7);

      // --- 4. Floor Support Pillars ---
      const hBotPillar = Math.max(1, seamWalls.bottom + HALF_H + 10);
      const botPillar  = this._botPillars[i]!;
      botPillar.scale.y = hBotPillar;
      botPillar.position.set(seamLocalX, seamWalls.bottom + 5 - hBotPillar / 2, -7);
    }
  }

  // ── GPU Memory Clean-up ──

  destroy(): void {
    for (let i = 0; i < this._numSlices; i++) {
      this._scene.remove(this._topPanels[i]!);
      this._scene.remove(this._botPanels[i]!);
      this._scene.remove(this._topPillars[i]!);
      this._scene.remove(this._botPillars[i]!);
    }

    // Dispose shared geometries
    this._plateGeo.dispose();
    this._glowGeo.dispose();
    this._conduitGeo.dispose();
    this._beamGeo.dispose();
    this._stripGeo.dispose();

    // Dispose shared materials
    this._baseMat.dispose();
    this._glowMat.dispose();
    this._pillarMat.dispose();

    this._topPanels  = [];
    this._botPanels  = [];
    this._topPillars = [];
    this._botPillars = [];
  }
}
