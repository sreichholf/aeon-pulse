import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import type { ITerrain, TerrainBounds, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';
import { InstancedScrollLayer, type InstancedScrollMeshLayer } from './InstancedScrollLayer.ts';
import { interpolateWalls, type TerrainPoint } from './WallInterpolator.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

export class Terrain implements ITerrain {
  private _scene: IScene;
  private _points: TerrainPoint[];

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

  private _sliceWidth: number;
  private _numSlices: number;
  private _panelPlateMesh: InstancedScrollMeshLayer;
  private _panelGlowMesh: InstancedScrollMeshLayer;
  private _panelConduitMesh: InstancedScrollMeshLayer;
  private _pillarBeamMesh: InstancedScrollMeshLayer;
  private _pillarStripMesh: InstancedScrollMeshLayer;
  private _instancedLayer: InstancedScrollLayer;

  constructor(scene: IScene, points: TerrainPoint[]) {
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

    this._sliceWidth = 70;
    this._numSlices  = 18;
    this._instancedLayer = new InstancedScrollLayer(scene);

    const panelCount = this._numSlices * 2;
    const panelGlowCount = panelCount * 2;

    this._panelPlateMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.panel', geometry: this._plateGeo, material: this._baseMat, capacity: panelCount });
    this._panelGlowMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.panel', geometry: this._glowGeo, material: this._glowMat, capacity: panelGlowCount });
    this._panelConduitMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.panel', geometry: this._conduitGeo, material: this._pillarMat, capacity: panelCount });
    this._pillarBeamMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.pillar', geometry: this._beamGeo, material: this._pillarMat, capacity: panelCount });
    this._pillarStripMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.pillar', geometry: this._stripGeo, material: this._glowMat, capacity: panelCount });

    this.update(0);
  }

  // ── Linear Interpolation for Collision Walls ──

  getWallsAt(scrollX: number): TerrainBounds {
    return interpolateWalls(this._points, scrollX);
  }

  getCollisionWallsAt(scrollX: number): TerrainBounds {
    return this.getWallsAt(scrollX);
  }

  // ── Infinite Scrolling & Real-time Scaling Update Loop ──

  update(scrollX: number): void {
    this._panelPlateMesh.beginFrame();
    this._panelConduitMesh.beginFrame();
    this._panelGlowMesh.beginFrame();
    this._pillarBeamMesh.beginFrame();
    this._pillarStripMesh.beginFrame();

    for (let i = 0; i < this._numSlices; i++) {
      // Infinite wrapping X coordinate relative to the camera viewport
      const localX = (i * this._sliceWidth - (scrollX % this._sliceWidth)) - (HALF_W + 100);

      // Calculate global world X coordinate for collision wall height queries
      const worldX = scrollX + localX;
      const { top, bottom } = this.getWallsAt(worldX);

      // --- 1. Ceiling Panels (top) ---
      const hTop = Math.max(1, HALF_H - top);
      this._panelPlateMesh.push({ position: [localX, top + hTop / 2, -10], scale: [1, hTop, 1] });
      this._panelConduitMesh.push({ position: [localX, top + hTop / 2, -10], scale: [1, hTop, 1] });
      this._panelGlowMesh.push({ position: [localX - 33, top + hTop / 2, -10], scale: [1, hTop, 1] });
      this._panelGlowMesh.push({ position: [localX + 33, top + hTop / 2, -10], scale: [1, hTop, 1] });

      // --- 2. Floor Panels (bottom) ---
      const hBot = Math.max(1, bottom + HALF_H);
      this._panelPlateMesh.push({ position: [localX, bottom - hBot / 2, -10], scale: [1, hBot, 1] });
      this._panelConduitMesh.push({ position: [localX, bottom - hBot / 2, -10], scale: [1, hBot, 1] });
      this._panelGlowMesh.push({ position: [localX - 33, bottom - hBot / 2, -10], scale: [1, hBot, 1] });
      this._panelGlowMesh.push({ position: [localX + 33, bottom - hBot / 2, -10], scale: [1, hBot, 1] });

      // --- 3. Ceiling Support Pillars (placed at the seams) ---
      const seamLocalX = localX + this._sliceWidth / 2;
      const seamWorldX = scrollX + seamLocalX;
      const seamWalls  = this.getWallsAt(seamWorldX);

      const hTopPillar = Math.max(1, HALF_H - seamWalls.top + 10);
      this._pillarBeamMesh.push({ position: [seamLocalX, seamWalls.top - 5 + hTopPillar / 2, -7], scale: [1, hTopPillar, 1] });
      this._pillarStripMesh.push({ position: [seamLocalX, seamWalls.top - 5 + hTopPillar / 2, -7], scale: [1, hTopPillar, 1] });

      // --- 4. Floor Support Pillars ---
      const hBotPillar = Math.max(1, seamWalls.bottom + HALF_H + 10);
      this._pillarBeamMesh.push({ position: [seamLocalX, seamWalls.bottom + 5 - hBotPillar / 2, -7], scale: [1, hBotPillar, 1] });
      this._pillarStripMesh.push({ position: [seamLocalX, seamWalls.bottom + 5 - hBotPillar / 2, -7], scale: [1, hBotPillar, 1] });
    }
    this._panelPlateMesh.endFrame();
    this._panelConduitMesh.endFrame();
    this._panelGlowMesh.endFrame();
    this._pillarBeamMesh.endFrame();
    this._pillarStripMesh.endFrame();
  }

  // ── GPU Memory Clean-up ──

  destroy(): void {
    this._instancedLayer.destroy();

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
  }
}
