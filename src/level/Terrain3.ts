import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import type { ITerrain, TerrainBounds, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';
import { InstancedScrollLayer, type InstancedScrollMeshLayer } from './InstancedScrollLayer.ts';
import { interpolateWalls, type TerrainPoint } from './WallInterpolator.ts';

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;

export class Terrain3 implements ITerrain {
  private _scene: IScene;
  private _points: TerrainPoint[];
  private _time: number;

  private _baseMat: THREE.MeshPhongMaterial;
  private _membraneMat: THREE.MeshPhongMaterial;
  private _glowMat: THREE.MeshBasicMaterial;
  private _sporeGlowMat: THREE.MeshBasicMaterial;
  private _boneMat: THREE.MeshPhongMaterial;

  private _membraneGeo: THREE.BoxGeometry;
  private _lobeGeo: THREE.SphereGeometry;
  private _veinGeo: THREE.BoxGeometry;
  private _sporeGeo: THREE.SphereGeometry;
  private _boneColGeo: THREE.CylinderGeometry;
  private _knuckleGeo: THREE.SphereGeometry;
  private _tipGeo: THREE.SphereGeometry;

  private _sliceWidth: number;
  private _numSlices: number;
  private _membraneMesh: InstancedScrollMeshLayer;
  private _lobeMesh: InstancedScrollMeshLayer;
  private _veinMesh: InstancedScrollMeshLayer;
  private _panelSporeMesh: InstancedScrollMeshLayer;
  private _spikeShaftMesh: InstancedScrollMeshLayer;
  private _spikeKnuckleMesh: InstancedScrollMeshLayer;
  private _spikeTipMesh: InstancedScrollMeshLayer;
  private _instancedLayer: InstancedScrollLayer;

  constructor(scene: IScene, points: TerrainPoint[]) {
    this._scene = scene;
    this._points = points;
    this._time = 0;

    this._baseMat = new THREE.MeshPhongMaterial({
      color: 0x6a1f1f,
      emissive: 0x190707,
      specular: 0xaa766c,
      shininess: 90,
      flatShading: true,
    });

    this._membraneMat = new THREE.MeshPhongMaterial({
      color: 0x161010,
      emissive: 0x040202,
      specular: 0x292020,
      shininess: 26,
      flatShading: true,
    });

    this._glowMat = new THREE.MeshBasicMaterial({
      color: 0xb32020,
      transparent: true,
      opacity: 0.95,
    });

    this._sporeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff4a26,
      transparent: true,
      opacity: 0.95,
    });

    this._boneMat = new THREE.MeshPhongMaterial({
      color: 0xe5d5bd,
      specular: 0xe7ddcf,
      shininess: 80,
      flatShading: true,
    });

    this._membraneGeo = new THREE.BoxGeometry(66, 1.0, 15);
    this._lobeGeo = new THREE.SphereGeometry(25, 8, 8);
    this._veinGeo = new THREE.BoxGeometry(4, 1.01, 8);
    this._sporeGeo = new THREE.SphereGeometry(4, 6, 6);
    this._boneColGeo = new THREE.CylinderGeometry(2, 3, 1.0, 6);
    this._knuckleGeo = new THREE.SphereGeometry(4.5, 6, 6);
    this._tipGeo = new THREE.SphereGeometry(5, 6, 6);

    this._sliceWidth = 70;
    this._numSlices = 18;
    this._instancedLayer = new InstancedScrollLayer(scene);

    const panelCount = this._numSlices * 2;
    const lobeCount = panelCount * 3;
    const veinCount = panelCount * 2;
    const panelSporeCount = panelCount * 3;
    const spikeCount = panelCount;
    const knuckleCount = spikeCount * 3;

    this._membraneMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.panel', geometry: this._membraneGeo, material: this._membraneMat, capacity: panelCount });
    this._lobeMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.panel', geometry: this._lobeGeo, material: this._baseMat, capacity: lobeCount });
    this._veinMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.panel', geometry: this._veinGeo, material: this._glowMat, capacity: veinCount });
    this._panelSporeMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.panel', geometry: this._sporeGeo, material: this._sporeGlowMat, capacity: panelSporeCount });
    this._spikeShaftMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.spike', geometry: this._boneColGeo, material: this._boneMat, capacity: spikeCount });
    this._spikeKnuckleMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.spike', geometry: this._knuckleGeo, material: this._boneMat, capacity: knuckleCount });
    this._spikeTipMesh = this._instancedLayer.createLayer({ renderCategory: RenderCategory.TERRAIN, detail: 'terrain.spike', geometry: this._tipGeo, material: this._sporeGlowMat, capacity: spikeCount });

    this.update(0);
  }

  getWallsAt(scrollX: number): TerrainBounds {
    return interpolateWalls(this._points, scrollX);
  }

  getCollisionWallsAt(scrollX: number): TerrainBounds {
    return this.getWallsAt(scrollX);
  }

  update(scrollX: number): void {
    this._time += 0.016;
    this._membraneMesh.beginFrame();
    this._lobeMesh.beginFrame();
    this._veinMesh.beginFrame();
    this._panelSporeMesh.beginFrame();
    this._spikeShaftMesh.beginFrame();
    this._spikeKnuckleMesh.beginFrame();
    this._spikeTipMesh.beginFrame();

    let membraneIndex = 0;
    let lobeIndex = 0;
    let veinIndex = 0;
    let panelSporeIndex = 0;
    let spikeIndex = 0;
    let knuckleIndex = 0;
    let tipIndex = 0;

    for (let i = 0; i < this._numSlices; i++) {
      const localX = (i * this._sliceWidth - (scrollX % this._sliceWidth)) - (HALF_W + 100);
      const worldX = scrollX + localX;
      const { top, bottom } = this.getWallsAt(worldX);

      const breathingTop = 1.0 + 0.06 * Math.sin(this._time * 2.5 + i * 0.4);
      const breathingBot = 1.0 + 0.06 * Math.sin(this._time * 2.5 - i * 0.4);

      const hTop = Math.max(1, HALF_H - top);
      const hBot = Math.max(1, bottom + HALF_H);

      this._membraneMesh.push({ position: [localX, top + hTop / 2, -10], scale: [1, hTop, 1] });
      membraneIndex++;
      this._membraneMesh.push({ position: [localX, bottom - hBot / 2, -10], scale: [1, hBot, 1] });
      membraneIndex++;

      lobeIndex = this._writePanelSurface(localX, top, breathingTop, lobeIndex, veinIndex, panelSporeIndex, true).lobeIndex;
      veinIndex = this._lastVeinIndex;
      panelSporeIndex = this._lastSporeIndex;
      lobeIndex = this._writePanelSurface(localX, bottom, breathingBot, lobeIndex, veinIndex, panelSporeIndex, false).lobeIndex;
      veinIndex = this._lastVeinIndex;
      panelSporeIndex = this._lastSporeIndex;

      const seamLocalX = localX + this._sliceWidth / 2;
      const seamWorldX = scrollX + seamLocalX;
      const seamWalls = this.getWallsAt(seamWorldX);

      const hTopSpike = Math.max(1, HALF_H - seamWalls.top + 8);
      this._spikeShaftMesh.push({ position: [seamLocalX, seamWalls.top - 4 + hTopSpike / 2, -7], scale: [1, hTopSpike, 1] });
      spikeIndex++;
      this._spikeKnuckleMesh.push({ position: [seamLocalX, seamWalls.top - 4 + hTopSpike * 0.25, -7], scale: [1, 1, 1] });
      knuckleIndex++;
      this._spikeKnuckleMesh.push({ position: [seamLocalX, seamWalls.top - 4 + hTopSpike * 0.5, -7], scale: [1, 1, 1] });
      knuckleIndex++;
      this._spikeKnuckleMesh.push({ position: [seamLocalX, seamWalls.top - 4 + hTopSpike * 0.75, -7], scale: [1, 1, 1] });
      knuckleIndex++;
      this._spikeTipMesh.push({ position: [seamLocalX, seamWalls.top - 4, -7], scale: [1, 1, 1] });
      tipIndex++;

      const hBotSpike = Math.max(1, seamWalls.bottom + HALF_H + 8);
      this._spikeShaftMesh.push({ position: [seamLocalX, seamWalls.bottom + 4 - hBotSpike / 2, -7], scale: [1, hBotSpike, 1] });
      spikeIndex++;
      this._spikeKnuckleMesh.push({ position: [seamLocalX, seamWalls.bottom + 4 - hBotSpike * 0.25, -7], scale: [1, 1, 1] });
      knuckleIndex++;
      this._spikeKnuckleMesh.push({ position: [seamLocalX, seamWalls.bottom + 4 - hBotSpike * 0.5, -7], scale: [1, 1, 1] });
      knuckleIndex++;
      this._spikeKnuckleMesh.push({ position: [seamLocalX, seamWalls.bottom + 4 - hBotSpike * 0.75, -7], scale: [1, 1, 1] });
      knuckleIndex++;
      this._spikeTipMesh.push({ position: [seamLocalX, seamWalls.bottom + 4, -7], scale: [1, 1, 1] });
      tipIndex++;
    }
    this._membraneMesh.endFrame();
    this._lobeMesh.endFrame();
    this._veinMesh.endFrame();
    this._panelSporeMesh.endFrame();
    this._spikeShaftMesh.endFrame();
    this._spikeKnuckleMesh.endFrame();
    this._spikeTipMesh.endFrame();
  }

  private _lastVeinIndex = 0;
  private _lastSporeIndex = 0;

  private _writePanelSurface(
    panelX: number,
    panelY: number,
    breathing: number,
    lobeIndex: number,
    veinIndex: number,
    sporeIndex: number,
    isTop: boolean,
  ): { lobeIndex: number } {
    const z = -10;
    const zOffset = (base: number) => z + base * breathing;
    const yOffset = (base: number) => panelY + base * breathing;
    const sign = isTop ? 1 : 1;

    this._lobeMesh.push({ position: [panelX, yOffset(0), zOffset(0)], scale: [breathing, breathing, 0.4 * breathing] });
    lobeIndex++;
    this._lobeMesh.push({ position: [panelX - 18 * breathing, yOffset(0), zOffset(-2)], scale: [0.8 * breathing, 1.2 * breathing, 0.35 * breathing] });
    lobeIndex++;
    this._lobeMesh.push({ position: [panelX + 18 * breathing, yOffset(0), zOffset(-2)], scale: [0.8 * breathing, 1.2 * breathing, 0.35 * breathing] });
    lobeIndex++;

    this._veinMesh.push({ position: [panelX - 20 * breathing, yOffset(0), zOffset(6)], scale: [breathing, breathing, breathing] });
    veinIndex++;
    this._veinMesh.push({ position: [panelX + 20 * breathing, yOffset(0), zOffset(6)], scale: [breathing, breathing, breathing] });
    veinIndex++;

    this._panelSporeMesh.push({ position: [panelX - 8 * breathing, yOffset(0), zOffset(10)], scale: [breathing, breathing, breathing] });
    sporeIndex++;
    this._panelSporeMesh.push({ position: [panelX + 8 * breathing, yOffset(0), zOffset(10)], scale: [breathing, breathing, breathing] });
    sporeIndex++;
    this._panelSporeMesh.push({ position: [panelX, yOffset(0), zOffset(11)], scale: [breathing, breathing, breathing] });
    sporeIndex++;

    this._lastVeinIndex = veinIndex;
    this._lastSporeIndex = sporeIndex;
    return { lobeIndex };
  }

  destroy(): void {
    this._instancedLayer.destroy();

    this._membraneGeo.dispose();
    this._lobeGeo.dispose();
    this._veinGeo.dispose();
    this._sporeGeo.dispose();
    this._boneColGeo.dispose();
    this._knuckleGeo.dispose();
    this._tipGeo.dispose();

    this._baseMat.dispose();
    this._membraneMat.dispose();
    this._glowMat.dispose();
    this._sporeGlowMat.dispose();
    this._boneMat.dispose();
  }
}
