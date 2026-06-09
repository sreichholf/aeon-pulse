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

export class Terrain3 implements ITerrain {
  private _scene: IScene;
  private _points: ControlPoint[];
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
  private _membraneMesh: THREE.InstancedMesh;
  private _lobeMesh: THREE.InstancedMesh;
  private _veinMesh: THREE.InstancedMesh;
  private _panelSporeMesh: THREE.InstancedMesh;
  private _spikeShaftMesh: THREE.InstancedMesh;
  private _spikeKnuckleMesh: THREE.InstancedMesh;
  private _spikeTipMesh: THREE.InstancedMesh;
  private _instanceHelper: THREE.Object3D;

  constructor(scene: IScene, points: ControlPoint[]) {
    this._scene = scene;
    this._points = points;
    this._time = 0;

    this._baseMat = new THREE.MeshPhongMaterial({
      color: 0xb52d57,
      emissive: 0x2b0614,
      specular: 0xffaacc,
      shininess: 90,
      flatShading: true,
    });

    this._membraneMat = new THREE.MeshPhongMaterial({
      color: 0x3d0a19,
      emissive: 0x0c0105,
      specular: 0x22050e,
      shininess: 20,
      flatShading: true,
    });

    this._glowMat = new THREE.MeshBasicMaterial({
      color: 0xff00aa,
      transparent: true,
      opacity: 0.95,
    });

    this._sporeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xb2ff00,
      transparent: true,
      opacity: 0.95,
    });

    this._boneMat = new THREE.MeshPhongMaterial({
      color: 0xf2ebd9,
      specular: 0xffffff,
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

    const panelCount = this._numSlices * 2;
    const lobeCount = panelCount * 3;
    const veinCount = panelCount * 2;
    const panelSporeCount = panelCount * 3;
    const spikeCount = panelCount;
    const knuckleCount = spikeCount * 3;

    this._membraneMesh = new THREE.InstancedMesh(this._membraneGeo, this._membraneMat, panelCount);
    this._lobeMesh = new THREE.InstancedMesh(this._lobeGeo, this._baseMat, lobeCount);
    this._veinMesh = new THREE.InstancedMesh(this._veinGeo, this._glowMat, veinCount);
    this._panelSporeMesh = new THREE.InstancedMesh(this._sporeGeo, this._sporeGlowMat, panelSporeCount);
    this._spikeShaftMesh = new THREE.InstancedMesh(this._boneColGeo, this._boneMat, spikeCount);
    this._spikeKnuckleMesh = new THREE.InstancedMesh(this._knuckleGeo, this._boneMat, knuckleCount);
    this._spikeTipMesh = new THREE.InstancedMesh(this._tipGeo, this._sporeGlowMat, spikeCount);

    for (const mesh of [
      this._membraneMesh,
      this._lobeMesh,
      this._veinMesh,
      this._panelSporeMesh,
      this._spikeShaftMesh,
      this._spikeKnuckleMesh,
      this._spikeTipMesh,
    ]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    markRenderCategory(this._membraneMesh, RenderCategory.TERRAIN, 'terrain.panel');
    markRenderCategory(this._lobeMesh, RenderCategory.TERRAIN, 'terrain.panel');
    markRenderCategory(this._veinMesh, RenderCategory.TERRAIN, 'terrain.panel');
    markRenderCategory(this._panelSporeMesh, RenderCategory.TERRAIN, 'terrain.panel');
    markRenderCategory(this._spikeShaftMesh, RenderCategory.TERRAIN, 'terrain.spike');
    markRenderCategory(this._spikeKnuckleMesh, RenderCategory.TERRAIN, 'terrain.spike');
    markRenderCategory(this._spikeTipMesh, RenderCategory.TERRAIN, 'terrain.spike');

    this._scene.add(this._membraneMesh);
    this._scene.add(this._lobeMesh);
    this._scene.add(this._veinMesh);
    this._scene.add(this._panelSporeMesh);
    this._scene.add(this._spikeShaftMesh);
    this._scene.add(this._spikeKnuckleMesh);
    this._scene.add(this._spikeTipMesh);

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

  getWallsAt(scrollX: number): TerrainBounds {
    const pts = this._points;
    if (!pts || pts.length === 0) return { top: GAME_HEIGHT / 2, bottom: -GAME_HEIGHT / 2 };
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    if (scrollX <= first.at) return { top: first.top, bottom: first.bottom };
    if (scrollX >= last.at) return { top: last.top, bottom: last.bottom };
    let prev = first;
    for (const cur of pts.slice(1)) {
      if (scrollX >= prev.at && scrollX <= cur.at) {
        const t = (scrollX - prev.at) / (cur.at - prev.at);
        return {
          top: prev.top + (cur.top - prev.top) * t,
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

  update(scrollX: number): void {
    this._time += 0.016;

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

      this._setInstanceTransform(this._membraneMesh, membraneIndex++, [localX, top + hTop / 2, -10], [1, hTop, 1]);
      this._setInstanceTransform(this._membraneMesh, membraneIndex++, [localX, bottom - hBot / 2, -10], [1, hBot, 1]);

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
      this._setInstanceTransform(this._spikeShaftMesh, spikeIndex++, [seamLocalX, seamWalls.top - 4 + hTopSpike / 2, -7], [1, hTopSpike, 1]);
      this._setInstanceTransform(this._spikeKnuckleMesh, knuckleIndex++, [seamLocalX, seamWalls.top - 4 + hTopSpike * 0.25, -7], [1, 1, 1]);
      this._setInstanceTransform(this._spikeKnuckleMesh, knuckleIndex++, [seamLocalX, seamWalls.top - 4 + hTopSpike * 0.5, -7], [1, 1, 1]);
      this._setInstanceTransform(this._spikeKnuckleMesh, knuckleIndex++, [seamLocalX, seamWalls.top - 4 + hTopSpike * 0.75, -7], [1, 1, 1]);
      this._setInstanceTransform(this._spikeTipMesh, tipIndex++, [seamLocalX, seamWalls.top - 4, -7], [1, 1, 1]);

      const hBotSpike = Math.max(1, seamWalls.bottom + HALF_H + 8);
      this._setInstanceTransform(this._spikeShaftMesh, spikeIndex++, [seamLocalX, seamWalls.bottom + 4 - hBotSpike / 2, -7], [1, hBotSpike, 1]);
      this._setInstanceTransform(this._spikeKnuckleMesh, knuckleIndex++, [seamLocalX, seamWalls.bottom + 4 - hBotSpike * 0.25, -7], [1, 1, 1]);
      this._setInstanceTransform(this._spikeKnuckleMesh, knuckleIndex++, [seamLocalX, seamWalls.bottom + 4 - hBotSpike * 0.5, -7], [1, 1, 1]);
      this._setInstanceTransform(this._spikeKnuckleMesh, knuckleIndex++, [seamLocalX, seamWalls.bottom + 4 - hBotSpike * 0.75, -7], [1, 1, 1]);
      this._setInstanceTransform(this._spikeTipMesh, tipIndex++, [seamLocalX, seamWalls.bottom + 4, -7], [1, 1, 1]);
    }

    this._membraneMesh.count = membraneIndex;
    this._lobeMesh.count = lobeIndex;
    this._veinMesh.count = veinIndex;
    this._panelSporeMesh.count = panelSporeIndex;
    this._spikeShaftMesh.count = spikeIndex;
    this._spikeKnuckleMesh.count = knuckleIndex;
    this._spikeTipMesh.count = tipIndex;

    this._membraneMesh.instanceMatrix.needsUpdate = true;
    this._lobeMesh.instanceMatrix.needsUpdate = true;
    this._veinMesh.instanceMatrix.needsUpdate = true;
    this._panelSporeMesh.instanceMatrix.needsUpdate = true;
    this._spikeShaftMesh.instanceMatrix.needsUpdate = true;
    this._spikeKnuckleMesh.instanceMatrix.needsUpdate = true;
    this._spikeTipMesh.instanceMatrix.needsUpdate = true;
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

    this._setInstanceTransform(this._lobeMesh, lobeIndex++, [panelX, yOffset(0), zOffset(0)], [breathing, breathing, 0.4 * breathing]);
    this._setInstanceTransform(this._lobeMesh, lobeIndex++, [panelX - 18 * breathing, yOffset(0), zOffset(-2)], [0.8 * breathing, 1.2 * breathing, 0.35 * breathing]);
    this._setInstanceTransform(this._lobeMesh, lobeIndex++, [panelX + 18 * breathing, yOffset(0), zOffset(-2)], [0.8 * breathing, 1.2 * breathing, 0.35 * breathing]);

    this._setInstanceTransform(this._veinMesh, veinIndex++, [panelX - 20 * breathing, yOffset(0), zOffset(6)], [breathing, breathing, breathing]);
    this._setInstanceTransform(this._veinMesh, veinIndex++, [panelX + 20 * breathing, yOffset(0), zOffset(6)], [breathing, breathing, breathing]);

    this._setInstanceTransform(this._panelSporeMesh, sporeIndex++, [panelX - 8 * breathing, yOffset(0), zOffset(10)], [breathing, breathing, breathing]);
    this._setInstanceTransform(this._panelSporeMesh, sporeIndex++, [panelX + 8 * breathing, yOffset(0), zOffset(10)], [breathing, breathing, breathing]);
    this._setInstanceTransform(this._panelSporeMesh, sporeIndex++, [panelX, yOffset(0), zOffset(11)], [breathing, breathing, breathing]);

    this._lastVeinIndex = veinIndex;
    this._lastSporeIndex = sporeIndex;
    return { lobeIndex };
  }

  destroy(): void {
    this._scene.remove(this._membraneMesh);
    this._scene.remove(this._lobeMesh);
    this._scene.remove(this._veinMesh);
    this._scene.remove(this._panelSporeMesh);
    this._scene.remove(this._spikeShaftMesh);
    this._scene.remove(this._spikeKnuckleMesh);
    this._scene.remove(this._spikeTipMesh);

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
