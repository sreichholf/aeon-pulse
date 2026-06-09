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

  private _sliceWidth: number;
  private _numSlices: number;
  private _panelPlateMesh: THREE.InstancedMesh;
  private _panelGlowMesh: THREE.InstancedMesh;
  private _panelConduitMesh: THREE.InstancedMesh;
  private _pillarBeamMesh: THREE.InstancedMesh;
  private _pillarStripMesh: THREE.InstancedMesh;
  private _instanceHelper: THREE.Object3D;

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

    this._sliceWidth = 70;
    this._numSlices  = 18;

    const panelCount = this._numSlices * 2;
    const panelGlowCount = panelCount * 2;

    this._panelPlateMesh = new THREE.InstancedMesh(this._plateGeo, this._baseMat, panelCount);
    this._panelGlowMesh = new THREE.InstancedMesh(this._glowGeo, this._glowMat, panelGlowCount);
    this._panelConduitMesh = new THREE.InstancedMesh(this._conduitGeo, this._pillarMat, panelCount);
    this._pillarBeamMesh = new THREE.InstancedMesh(this._beamGeo, this._pillarMat, panelCount);
    this._pillarStripMesh = new THREE.InstancedMesh(this._stripGeo, this._glowMat, panelCount);

    for (const mesh of [
      this._panelPlateMesh,
      this._panelGlowMesh,
      this._panelConduitMesh,
      this._pillarBeamMesh,
      this._pillarStripMesh,
    ]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    markRenderCategory(this._panelPlateMesh, RenderCategory.TERRAIN, 'terrain.panel');
    markRenderCategory(this._panelGlowMesh, RenderCategory.TERRAIN, 'terrain.panel');
    markRenderCategory(this._panelConduitMesh, RenderCategory.TERRAIN, 'terrain.panel');
    markRenderCategory(this._pillarBeamMesh, RenderCategory.TERRAIN, 'terrain.pillar');
    markRenderCategory(this._pillarStripMesh, RenderCategory.TERRAIN, 'terrain.pillar');

    this._scene.add(this._panelPlateMesh);
    this._scene.add(this._panelGlowMesh);
    this._scene.add(this._panelConduitMesh);
    this._scene.add(this._pillarBeamMesh);
    this._scene.add(this._pillarStripMesh);

    this._instanceHelper = new THREE.Object3D();

    this.update(0);
  }

  private _setInstanceTransform(
    mesh: THREE.InstancedMesh,
    index: number,
    position: THREE.Vector3Tuple,
    scale: THREE.Vector3Tuple,
  ): void {
    this._instanceHelper.position.set(...position);
    this._instanceHelper.rotation.set(0, 0, 0);
    this._instanceHelper.scale.set(...scale);
    this._instanceHelper.updateMatrix();
    mesh.setMatrixAt(index, this._instanceHelper.matrix);
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

  getActualWallsAt(scrollX: number): TerrainBounds {
    return this.getWallsAt(scrollX);
  }

  // ── Infinite Scrolling & Real-time Scaling Update Loop ──

  update(scrollX: number): void {
    let panelIndex = 0;
    let glowIndex = 0;
    let pillarIndex = 0;

    for (let i = 0; i < this._numSlices; i++) {
      // Infinite wrapping X coordinate relative to the camera viewport
      const localX = (i * this._sliceWidth - (scrollX % this._sliceWidth)) - (HALF_W + 100);

      // Calculate global world X coordinate for collision wall height queries
      const worldX = scrollX + localX;
      const { top, bottom } = this.getWallsAt(worldX);

      // --- 1. Ceiling Panels (top) ---
      const hTop = Math.max(1, HALF_H - top);
      this._setInstanceTransform(this._panelPlateMesh, panelIndex, [localX, top + hTop / 2, -10], [1, hTop, 1]);
      this._setInstanceTransform(this._panelConduitMesh, panelIndex, [localX, top + hTop / 2, -10], [1, hTop, 1]);
      this._setInstanceTransform(this._panelGlowMesh, glowIndex++, [localX - 33, top + hTop / 2, -10], [1, hTop, 1]);
      this._setInstanceTransform(this._panelGlowMesh, glowIndex++, [localX + 33, top + hTop / 2, -10], [1, hTop, 1]);
      panelIndex++;

      // --- 2. Floor Panels (bottom) ---
      const hBot = Math.max(1, bottom + HALF_H);
      this._setInstanceTransform(this._panelPlateMesh, panelIndex, [localX, bottom - hBot / 2, -10], [1, hBot, 1]);
      this._setInstanceTransform(this._panelConduitMesh, panelIndex, [localX, bottom - hBot / 2, -10], [1, hBot, 1]);
      this._setInstanceTransform(this._panelGlowMesh, glowIndex++, [localX - 33, bottom - hBot / 2, -10], [1, hBot, 1]);
      this._setInstanceTransform(this._panelGlowMesh, glowIndex++, [localX + 33, bottom - hBot / 2, -10], [1, hBot, 1]);
      panelIndex++;

      // --- 3. Ceiling Support Pillars (placed at the seams) ---
      const seamLocalX = localX + this._sliceWidth / 2;
      const seamWorldX = scrollX + seamLocalX;
      const seamWalls  = this.getWallsAt(seamWorldX);

      const hTopPillar = Math.max(1, HALF_H - seamWalls.top + 10);
      this._setInstanceTransform(this._pillarBeamMesh, pillarIndex, [seamLocalX, seamWalls.top - 5 + hTopPillar / 2, -7], [1, hTopPillar, 1]);
      this._setInstanceTransform(this._pillarStripMesh, pillarIndex, [seamLocalX, seamWalls.top - 5 + hTopPillar / 2, -7], [1, hTopPillar, 1]);
      pillarIndex++;

      // --- 4. Floor Support Pillars ---
      const hBotPillar = Math.max(1, seamWalls.bottom + HALF_H + 10);
      this._setInstanceTransform(this._pillarBeamMesh, pillarIndex, [seamLocalX, seamWalls.bottom + 5 - hBotPillar / 2, -7], [1, hBotPillar, 1]);
      this._setInstanceTransform(this._pillarStripMesh, pillarIndex, [seamLocalX, seamWalls.bottom + 5 - hBotPillar / 2, -7], [1, hBotPillar, 1]);
      pillarIndex++;
    }

    this._panelPlateMesh.count = panelIndex;
    this._panelConduitMesh.count = panelIndex;
    this._panelGlowMesh.count = glowIndex;
    this._pillarBeamMesh.count = pillarIndex;
    this._pillarStripMesh.count = pillarIndex;

    this._panelPlateMesh.instanceMatrix.needsUpdate = true;
    this._panelConduitMesh.instanceMatrix.needsUpdate = true;
    this._panelGlowMesh.instanceMatrix.needsUpdate = true;
    this._pillarBeamMesh.instanceMatrix.needsUpdate = true;
    this._pillarStripMesh.instanceMatrix.needsUpdate = true;
  }

  // ── GPU Memory Clean-up ──

  destroy(): void {
    this._scene.remove(this._panelPlateMesh);
    this._scene.remove(this._panelGlowMesh);
    this._scene.remove(this._panelConduitMesh);
    this._scene.remove(this._pillarBeamMesh);
    this._scene.remove(this._pillarStripMesh);

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
