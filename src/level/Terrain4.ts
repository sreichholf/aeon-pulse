import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import type { ITerrain, TerrainBounds, IScene } from '../types.ts';
import { RenderCategory } from '../systems/RenderStats.ts';
import { InstancedScrollLayer, type InstancedScrollMeshLayer } from './InstancedScrollLayer.ts';
import { interpolateWalls, type TerrainPoint } from './WallInterpolator.ts';

const PULSE_RISE_DURATION = 1.5;
const PULSE_HOLD_DURATION = 1.0;
const PULSE_FALL_DURATION = 1.5;
const PULSE_TOTAL = PULSE_RISE_DURATION + PULSE_HOLD_DURATION + PULSE_FALL_DURATION;
const PULSE_MAX_OFFSET = 60;
const TERRAIN_SLOT_MARGIN = 420;
const HIDDEN_WARMUP_X = GAME_WIDTH * 2;
const HIDDEN_WARMUP_Y = GAME_HEIGHT * 2;

interface ColumnEntry {
  dx: number;
  dz: number;
  heightOffset: number;
  radius: number;
  rotY: number;
  slantX: number;
  slantZ: number;
}

type ReliefKind = 'plain' | 'tooth' | 'plate' | 'seam';

interface ReliefEntry {
  kind: ReliefKind;
  dx: number;
  dz: number;
  width: number;
  height: number;
  depth: number;
  rotationZ: number;
}

type RockMassKind = 'deep' | 'mid' | 'wedge';

interface RockMassEntry {
  kind: RockMassKind;
  dx: number;
  dz: number;
  anchor: number;
  width: number;
  height: number;
  depth: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

interface DebrisEntry {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  rotSpeedX: number;
  rotSpeedY: number;
  scale: number;
  active: boolean;
}

export class Terrain4 implements ITerrain {
  private _scene: IScene;
  private _points: TerrainPoint[];

  private _pulsing: boolean;
  private _pulseTimer: number;
  private _lavaPulse: number;

  private _rockMat: THREE.MeshPhongMaterial;
  private _deepRockMat: THREE.MeshPhongMaterial;
  private _plateMat: THREE.MeshPhongMaterial;
  private _lavaPlaneMat: THREE.MeshBasicMaterial;
  private _seamMat: THREE.MeshBasicMaterial;

  private _topColumnGeo: THREE.CylinderGeometry;
  private _botColumnGeo: THREE.CylinderGeometry;
  private _topBackingGeo: THREE.PlaneGeometry;
  private _botBackingGeo: THREE.PlaneGeometry;
  private _deepRockGeo: THREE.DodecahedronGeometry;
  private _midRockGeo: THREE.IcosahedronGeometry;
  private _wedgeRockGeo: THREE.TetrahedronGeometry;
  private _toothGeo: THREE.CylinderGeometry;
  private _plateGeo: THREE.BoxGeometry;
  private _seamGeo: THREE.BoxGeometry;
  private _debrisGeo: THREE.ConeGeometry;

  private _topColumnMesh: InstancedScrollMeshLayer;
  private _botColumnMesh: InstancedScrollMeshLayer;
  private _topBackingMesh: InstancedScrollMeshLayer;
  private _botBackingMesh: InstancedScrollMeshLayer;
  private _deepRockMesh: InstancedScrollMeshLayer;
  private _midRockMesh: InstancedScrollMeshLayer;
  private _wedgeRockMesh: InstancedScrollMeshLayer;
  private _toothMesh: InstancedScrollMeshLayer;
  private _plateMesh: InstancedScrollMeshLayer;
  private _seamMesh: InstancedScrollMeshLayer;
  private _debrisMesh: InstancedScrollMeshLayer;

  private _topSlots: ColumnEntry[][];
  private _botSlots: ColumnEntry[][];
  private _topRockMasses: RockMassEntry[][];
  private _botRockMasses: RockMassEntry[][];
  private _topRelief: ReliefEntry[];
  private _botRelief: ReliefEntry[];
  private _debrisPool: DebrisEntry[];

  private _slotSpacing: number;
  private _slotCount: number;
  private _scrollX: number;
  private _time: number;
  private _instancedLayer: InstancedScrollLayer;
  private _tipCache: Map<number, { topTips: number[]; botTips: number[] }>;

  private _euler: THREE.Euler;
  private _baseLava: THREE.Color;
  private _activeLava: THREE.Color;
  private _curLava: THREE.Color;

  constructor(scene: IScene, points: TerrainPoint[]) {
    this._scene = scene;
    this._points = points;
    this._instancedLayer = new InstancedScrollLayer(scene);

    this._pulsing = false;
    this._pulseTimer = 0;
    this._lavaPulse = 0;

    this._rockMat = new THREE.MeshPhongMaterial({
      color: 0x6a5143,
      emissive: 0x2a1c15,
      specular: 0x6a5a4d,
      shininess: 12,
      flatShading: true,
    });
    this._deepRockMat = new THREE.MeshPhongMaterial({
      color: 0x584236,
      emissive: 0x24170f,
      specular: 0x5a4b40,
      shininess: 10,
      flatShading: true,
    });
    this._plateMat = new THREE.MeshPhongMaterial({
      color: 0x765a49,
      emissive: 0x2d1d15,
      specular: 0x6c5b4e,
      shininess: 12,
      flatShading: true,
    });
    this._lavaPlaneMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    this._seamMat = new THREE.MeshBasicMaterial({
      color: 0xff7a2c,
      transparent: true,
      opacity: 0.5,
    });

    this._slotSpacing = 44;
    this._slotCount = 44;
    this._topSlots = [];
    this._botSlots = [];
    this._topRockMasses = [];
    this._botRockMasses = [];
    this._topRelief = [];
    this._botRelief = [];
    this._debrisPool = [];

    this._topColumnGeo = new THREE.CylinderGeometry(24, 13, 1, 5);
    this._botColumnGeo = new THREE.CylinderGeometry(13, 24, 1, 5);
    this._topBackingGeo = new THREE.PlaneGeometry(this._slotSpacing * 1.55, 1);
    this._botBackingGeo = new THREE.PlaneGeometry(this._slotSpacing * 1.55, 1);
    this._deepRockGeo = new THREE.DodecahedronGeometry(1, 0);
    this._midRockGeo = new THREE.IcosahedronGeometry(1, 0);
    this._wedgeRockGeo = new THREE.TetrahedronGeometry(1, 0);
    this._toothGeo = new THREE.CylinderGeometry(0.2, 1, 1, 4);
    this._plateGeo = new THREE.BoxGeometry(1, 1, 1);
    this._seamGeo = new THREE.BoxGeometry(1, 1, 1);
    this._debrisGeo = new THREE.ConeGeometry(4, 8, 4);

    this._topColumnMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.column',
      geometry: this._topColumnGeo,
      material: this._deepRockMat,
      capacity: this._slotCount * 3,
    });
    this._botColumnMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.column',
      geometry: this._botColumnGeo,
      material: this._deepRockMat,
      capacity: this._slotCount * 3,
    });
    this._topBackingMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.backing',
      geometry: this._topBackingGeo,
      material: this._lavaPlaneMat,
      capacity: this._slotCount,
    });
    this._botBackingMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.backing',
      geometry: this._botBackingGeo,
      material: this._lavaPlaneMat,
      capacity: this._slotCount,
    });
    this._deepRockMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.deepRock',
      geometry: this._deepRockGeo,
      material: this._deepRockMat,
      capacity: this._slotCount * 6,
    });
    this._midRockMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.midRock',
      geometry: this._midRockGeo,
      material: this._rockMat,
      capacity: this._slotCount * 8,
    });
    this._wedgeRockMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.wedgeRock',
      geometry: this._wedgeRockGeo,
      material: this._plateMat,
      capacity: this._slotCount * 8,
    });
    this._toothMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.reliefTooth',
      geometry: this._toothGeo,
      material: this._rockMat,
      capacity: this._slotCount * 2,
    });
    this._plateMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.reliefPlate',
      geometry: this._plateGeo,
      material: this._plateMat,
      capacity: this._slotCount * 2,
    });
    this._seamMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.reliefSeam',
      geometry: this._seamGeo,
      material: this._seamMat,
      capacity: this._slotCount * 2,
    });
    this._debrisMesh = this._instancedLayer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.debris',
      geometry: this._debrisGeo,
      material: this._rockMat,
      capacity: 30,
    });

    for (let i = 0; i < this._slotCount; i++) {
      const topCols: ColumnEntry[] = [];
      const botCols: ColumnEntry[] = [];
      const topMasses: RockMassEntry[] = [];
      const botMasses: RockMassEntry[] = [];

      for (let d = 0; d < 3; d++) {
        const zDepth = -34 + d * 12 + (Math.random() - 0.5) * 2;
        const dx = (Math.random() - 0.5) * 12;
        const heightVar = (Math.random() - 0.5) * 18;
        const radius = 18 + Math.random() * 10 - d * 2;
        const rotY = Math.random() * Math.PI;
        const slantX = 0;
        const slantZ = (Math.random() - 0.5) * 0.14;

        topCols.push({ dx, dz: zDepth, heightOffset: heightVar, radius, rotY, slantX, slantZ });
        botCols.push({ dx, dz: zDepth, heightOffset: heightVar, radius, rotY, slantX, slantZ });
      }

      for (let r = 0; r < 5; r++) {
        topMasses.push(this._createRockMassEntry(r));
        botMasses.push(this._createRockMassEntry(r));
      }

      this._topSlots.push(topCols);
      this._botSlots.push(botCols);
      this._topRockMasses.push(topMasses);
      this._botRockMasses.push(botMasses);
      this._topRelief.push(this._createReliefEntry(true));
      this._botRelief.push(this._createReliefEntry(false));
    }

    for (let i = 0; i < 30; i++) {
      this._debrisPool.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        rotSpeedX: 0,
        rotSpeedY: 0,
        scale: 1,
        active: false,
      });
    }

    this._scrollX = 0;
    this._time = 0;
    this._tipCache = new Map();
    this._euler = new THREE.Euler();
    this._baseLava = new THREE.Color(0x882200);
    this._activeLava = new THREE.Color(0xff4400);
    this._curLava = new THREE.Color();
    this.update(0);
  }

  private _createRockMassEntry(index: number): RockMassEntry {
    const roll = Math.random();
    const kind: RockMassKind = index === 0 || roll < 0.28
      ? 'deep'
      : roll < 0.76
        ? 'mid'
        : 'wedge';

    if (kind === 'deep') {
      return {
        kind,
        dx: (Math.random() - 0.5) * 42,
        dz: -42 - Math.random() * 8,
        anchor: 0.3 + Math.random() * 0.34,
        width: 44 + Math.random() * 28,
        height: 38 + Math.random() * 32,
        depth: 15 + Math.random() * 8,
        rotX: (Math.random() - 0.5) * 0.45,
        rotY: Math.random() * Math.PI,
        rotZ: (Math.random() - 0.5) * 0.35,
      };
    }

    if (kind === 'mid') {
      return {
        kind,
        dx: (Math.random() - 0.5) * 36,
        dz: -28 - Math.random() * 8,
        anchor: 0.48 + Math.random() * 0.32,
        width: 30 + Math.random() * 24,
        height: 28 + Math.random() * 24,
        depth: 13 + Math.random() * 8,
        rotX: (Math.random() - 0.5) * 0.38,
        rotY: Math.random() * Math.PI,
        rotZ: (Math.random() - 0.5) * 0.32,
      };
    }

    return {
      kind,
      dx: (Math.random() - 0.5) * 30,
      dz: -16 - Math.random() * 5,
      anchor: 0.68 + Math.random() * 0.2,
      width: 18 + Math.random() * 16,
      height: 24 + Math.random() * 24,
      depth: 11 + Math.random() * 6,
      rotX: (Math.random() - 0.5) * 0.34,
      rotY: Math.random() * Math.PI,
      rotZ: (Math.random() - 0.5) * 0.45,
    };
  }

  private _createReliefEntry(isTop: boolean): ReliefEntry {
    const roll = Math.random();
    if (roll < 0.46) {
      return { kind: 'plain', dx: 0, dz: 0, width: 0, height: 0, depth: 0, rotationZ: 0 };
    }
    if (roll < 0.76) {
      return {
        kind: 'tooth',
        dx: (Math.random() - 0.5) * 14,
        dz: -3.4 - Math.random() * 2.6,
        width: 14 + Math.random() * 8,
        height: 20 + Math.random() * 14,
        depth: 10 + Math.random() * 5,
        rotationZ: (Math.random() - 0.5) * 0.18 + (isTop ? Math.PI : 0),
      };
    }
    if (roll < 0.94) {
      return {
        kind: 'plate',
        dx: (Math.random() - 0.5) * 18,
        dz: -2.8,
        width: 20 + Math.random() * 14,
        height: 8 + Math.random() * 6,
        depth: 10 + Math.random() * 5,
        rotationZ: (Math.random() - 0.5) * 0.16,
      };
    }
    return {
      kind: 'seam',
      dx: (Math.random() - 0.5) * 10,
      dz: -1.1,
      width: 9 + Math.random() * 5,
      height: 1.5 + Math.random() * 0.7,
      depth: 8,
      rotationZ: (Math.random() - 0.5) * 0.08,
    };
  }

  private _pushRockMass(entry: RockMassEntry, slotWorldX: number, bandHeight: number, isTop: boolean): void {
    const localX = slotWorldX - this._scrollX + entry.dx;
    const height = Math.max(10, Math.min(entry.height, bandHeight * 0.72));
    const y = isTop
      ? GAME_HEIGHT / 2 - bandHeight * entry.anchor
      : -GAME_HEIGHT / 2 + bandHeight * entry.anchor;

    const target = entry.kind === 'deep'
      ? this._deepRockMesh
      : entry.kind === 'mid'
        ? this._midRockMesh
        : this._wedgeRockMesh;

    target.push({
      position: [localX, y, entry.dz],
      rotation: this._euler.set(entry.rotX, entry.rotY, entry.rotZ + (isTop ? Math.PI : 0)),
      scale: [entry.width, height, entry.depth],
    });
  }

  private _pushRelief(relief: ReliefEntry, worldX: number, tipY: number, z: number, isTop: boolean): void {
    if (relief.kind === 'plain') return;

    const localX = worldX - this._scrollX + relief.dx;
    const y = isTop ? tipY + relief.height * 0.45 : tipY - relief.height * 0.45;
    const rotationX = relief.kind === 'plate' ? 0.12 : 0;
    const rotationZ =
      relief.rotationZ +
      (relief.kind === 'plate' && isTop ? -0.1 : 0) +
      (relief.kind === 'plate' && !isTop ? 0.1 : 0);

    const target = relief.kind === 'tooth'
      ? this._toothMesh
      : relief.kind === 'plate'
        ? this._plateMesh
        : this._seamMesh;

    target.push({
      position: [localX, y, z + relief.dz],
      rotation: this._euler.set(rotationX, 0, rotationZ),
      scale: [relief.width, relief.height, relief.depth],
    });
  }

  private _pushHiddenWarmup(layer: InstancedScrollMeshLayer): void {
    layer.push({
      position: [HIDDEN_WARMUP_X, HIDDEN_WARMUP_Y, -90],
      rotation: this._euler.set(0, 0, 0),
      scale: [1, 1, 1],
    });
  }

  triggerLavaPulse(): void {
    if (this._pulsing) return;
    this._pulsing = true;
    this._pulseTimer = 0;
  }

  private _getPulseOffset(): number {
    if (!this._pulsing) return 0;
    const t = this._pulseTimer;
    if (t < PULSE_RISE_DURATION) return PULSE_MAX_OFFSET * (t / PULSE_RISE_DURATION);
    if (t < PULSE_RISE_DURATION + PULSE_HOLD_DURATION) return PULSE_MAX_OFFSET;
    const fall = t - PULSE_RISE_DURATION - PULSE_HOLD_DURATION;
    return PULSE_MAX_OFFSET * (1 - fall / PULSE_FALL_DURATION);
  }

  getWallsAt(scrollX: number): TerrainBounds {
    const walls = interpolateWalls(this._points, scrollX);
    return { top: walls.top, bottom: walls.bottom + this._getPulseOffset() };
  }

  getCollisionWallsAt(scrollX: number): TerrainBounds {
    const baseWalls = this.getWallsAt(scrollX);
    let actualTop = baseWalls.top;
    let actualBottom = baseWalls.bottom;
    const centerSlot = Math.round(scrollX / this._slotSpacing);

    for (let slotOffset = -1; slotOffset <= 1; slotOffset++) {
      const slot = centerSlot + slotOffset;
      const slotWorldX = slot * this._slotSpacing;
      const cached = this._tipCache.get(slot);
      const poolIndex = Math.abs(slot) % this._slotCount;
      const topCols = this._topSlots[poolIndex]!;
      const botCols = this._botSlots[poolIndex]!;

      for (let d = 1; d <= 2; d++) {
        const topCol = topCols[d]!;
        const topColWorldX = slotWorldX + topCol.dx;
        if (Math.abs(scrollX - topColWorldX) < topCol.radius) {
          const tipY = cached
            ? cached.topTips[d]!
            : GAME_HEIGHT / 2 - Math.max(1, (GAME_HEIGHT / 2 - this.getWallsAt(topColWorldX).top) + topCol.heightOffset);
          actualTop = Math.min(actualTop, tipY);
        }

        const botCol = botCols[d]!;
        const botColWorldX = slotWorldX + botCol.dx;
        if (Math.abs(scrollX - botColWorldX) < botCol.radius) {
          const tipY = cached
            ? cached.botTips[d]!
            : -GAME_HEIGHT / 2 + Math.max(1, (this.getWallsAt(botColWorldX).bottom - (-GAME_HEIGHT / 2)) + botCol.heightOffset);
          actualBottom = Math.max(actualBottom, tipY);
        }
      }
    }

    let topBound = actualTop - 6;
    let bottomBound = actualBottom + 6;
    if (topBound < bottomBound) {
      const mid = (actualTop + actualBottom) / 2;
      topBound = mid;
      bottomBound = mid;
    }

    return { top: topBound, bottom: bottomBound };
  }

  update(scrollX: number, dt = 0): void {
    this._scrollX = scrollX;
    this._time += dt;
    this._tipCache.clear();

    if (this._pulsing) {
      this._pulseTimer += dt;
      if (this._pulseTimer >= PULSE_TOTAL) {
        this._pulsing = false;
        this._pulseTimer = 0;
      }
      const t = this._pulseTimer;
      if (t < PULSE_RISE_DURATION) {
        this._lavaPulse = t / PULSE_RISE_DURATION;
      } else if (t < PULSE_RISE_DURATION + PULSE_HOLD_DURATION) {
        this._lavaPulse = 1;
      } else {
        this._lavaPulse = 1 - (t - PULSE_RISE_DURATION - PULSE_HOLD_DURATION) / PULSE_FALL_DURATION;
      }
    } else {
      this._lavaPulse = 0;
    }

    if (this._pulsing) {
      const shakeIntensity = 7 * this._lavaPulse;
      this._scene.camera.position.set((Math.random() - 0.5) * shakeIntensity, (Math.random() - 0.5) * shakeIntensity, 100);
    } else {
      this._scene.camera.position.set(0, 0, 100);
    }

    const breatheIntensity = 0.3 + 0.4 * Math.sin(this._time * 1.5) + this._lavaPulse * 0.3;
    this._curLava.lerpColors(this._baseLava, this._activeLava, Math.max(0, Math.min(1, breatheIntensity)));
    this._lavaPlaneMat.color.copy(this._curLava);

    this._topBackingMesh.beginFrame();
    this._botBackingMesh.beginFrame();
    this._deepRockMesh.beginFrame();
    this._midRockMesh.beginFrame();
    this._wedgeRockMesh.beginFrame();
    this._topColumnMesh.beginFrame();
    this._botColumnMesh.beginFrame();
    this._toothMesh.beginFrame();
    this._plateMesh.beginFrame();
    this._seamMesh.beginFrame();

    this._pushHiddenWarmup(this._topBackingMesh);
    this._pushHiddenWarmup(this._botBackingMesh);
    this._pushHiddenWarmup(this._deepRockMesh);
    this._pushHiddenWarmup(this._midRockMesh);
    this._pushHiddenWarmup(this._wedgeRockMesh);
    this._pushHiddenWarmup(this._topColumnMesh);
    this._pushHiddenWarmup(this._botColumnMesh);
    this._pushHiddenWarmup(this._toothMesh);
    this._pushHiddenWarmup(this._plateMesh);
    this._pushHiddenWarmup(this._seamMesh);

    const startSlot = Math.floor((scrollX - GAME_WIDTH / 2 - TERRAIN_SLOT_MARGIN) / this._slotSpacing);
    const endSlot = Math.ceil((scrollX + GAME_WIDTH / 2 + TERRAIN_SLOT_MARGIN) / this._slotSpacing);

    for (let slot = startSlot; slot <= endSlot; slot++) {
      const slotWorldX = slot * this._slotSpacing;
      const poolIndex = Math.abs(slot) % this._slotCount;
      const topCols = this._topSlots[poolIndex]!;
      const botCols = this._botSlots[poolIndex]!;
      const topMasses = this._topRockMasses[poolIndex]!;
      const botMasses = this._botRockMasses[poolIndex]!;
      const topRelief = this._topRelief[poolIndex]!;
      const botRelief = this._botRelief[poolIndex]!;
      const slotWalls = this.getWallsAt(slotWorldX);
      const slotTopHeight = Math.max(1, GAME_HEIGHT / 2 - slotWalls.top);
      const slotBotHeight = Math.max(1, slotWalls.bottom - (-GAME_HEIGHT / 2));

      this._topBackingMesh.push({
        position: [slotWorldX - scrollX, GAME_HEIGHT / 2 - slotTopHeight / 2, -38],
        rotation: this._euler.set(0, 0, 0),
        scale: [1, slotTopHeight, 1],
      });
      this._botBackingMesh.push({
        position: [slotWorldX - scrollX, -GAME_HEIGHT / 2 + slotBotHeight / 2, -38],
        rotation: this._euler.set(0, 0, 0),
        scale: [1, slotBotHeight, 1],
      });

      for (const mass of topMasses) {
        this._pushRockMass(mass, slotWorldX, slotTopHeight, true);
      }
      for (const mass of botMasses) {
        this._pushRockMass(mass, slotWorldX, slotBotHeight, false);
      }

      const topTips = [0, 0, 0];
      const botTips = [0, 0, 0];

      for (let d = 0; d < 3; d++) {
        const tCol = topCols[d]!;
        const bCol = botCols[d]!;
        const tWorldX = slotWorldX + tCol.dx;
        const bWorldX = slotWorldX + bCol.dx;
        const tWalls = this.getWallsAt(tWorldX);
        const bWalls = this.getWallsAt(bWorldX);

        const topHeight = Math.max(1, (GAME_HEIGHT / 2 - tWalls.top) + tCol.heightOffset);
        topTips[d] = GAME_HEIGHT / 2 - topHeight;
        this._topColumnMesh.push({
          position: [tWorldX - scrollX, GAME_HEIGHT / 2 - topHeight / 2, tCol.dz],
          rotation: this._euler.set(tCol.slantX, tCol.rotY, tCol.slantZ),
          scale: [tCol.radius, topHeight, 0.24],
        });

        const botHeight = Math.max(1, (bWalls.bottom - (-GAME_HEIGHT / 2)) + bCol.heightOffset);
        botTips[d] = -GAME_HEIGHT / 2 + botHeight;
        this._botColumnMesh.push({
          position: [bWorldX - scrollX, -GAME_HEIGHT / 2 + botHeight / 2, bCol.dz],
          rotation: this._euler.set(bCol.slantX, bCol.rotY, bCol.slantZ),
          scale: [bCol.radius, botHeight, 0.24],
        });

        if (d === 2) {
          this._pushRelief(topRelief, tWorldX, topTips[d]!, tCol.dz + 1.5, true);
          this._pushRelief(botRelief, bWorldX, botTips[d]!, bCol.dz + 1.5, false);
        }
      }

      this._tipCache.set(slot, { topTips, botTips });
    }

    this._topBackingMesh.endFrame();
    this._botBackingMesh.endFrame();
    this._deepRockMesh.endFrame();
    this._midRockMesh.endFrame();
    this._wedgeRockMesh.endFrame();
    this._topColumnMesh.endFrame();
    this._botColumnMesh.endFrame();
    this._toothMesh.endFrame();
    this._plateMesh.endFrame();
    this._seamMesh.endFrame();

    if (this._pulsing && Math.random() < 0.15) {
      const spawnX = scrollX + (Math.random() - 0.5) * (GAME_WIDTH + 80);
      const walls = this.getWallsAt(spawnX);
      const freeDebris = this._debrisPool.find((entry) => !entry.active);
      if (freeDebris) {
        freeDebris.active = true;
        freeDebris.x = spawnX;
        freeDebris.y = walls.top - 12;
        freeDebris.z = -25 + Math.random() * 40;
        freeDebris.vx = -40 - Math.random() * 60;
        freeDebris.vy = -80 - Math.random() * 120;
        freeDebris.rotX = Math.random() * Math.PI * 2;
        freeDebris.rotY = Math.random() * Math.PI * 2;
        freeDebris.rotZ = Math.random() * Math.PI * 2;
        freeDebris.rotSpeedX = (Math.random() - 0.5) * 8;
        freeDebris.rotSpeedY = (Math.random() - 0.5) * 8;
        freeDebris.scale = 0.7 + Math.random() * 0.8;
      }
    }

    this._debrisMesh.beginFrame();
    this._pushHiddenWarmup(this._debrisMesh);
    for (const debris of this._debrisPool) {
      if (!debris.active) continue;

      debris.vy -= 420 * dt;
      debris.x += debris.vx * dt;
      debris.y += debris.vy * dt;
      debris.rotX += debris.rotSpeedX * dt;
      debris.rotY += debris.rotSpeedY * dt;

      const walls = this.getWallsAt(debris.x);
      if (debris.y - 4 <= walls.bottom || debris.y < -GAME_HEIGHT / 2 - 20 || debris.x - scrollX < -GAME_WIDTH / 2 - 50) {
        debris.active = false;
        continue;
      }

      this._debrisMesh.push({
        position: [debris.x - scrollX, debris.y, debris.z],
        rotation: this._euler.set(debris.rotX, debris.rotY, debris.rotZ),
        scale: [debris.scale, debris.scale, debris.scale],
      });
    }
    this._debrisMesh.endFrame();
  }

  destroy(): void {
    this._scene.camera.position.set(0, 0, 100);
    this._instancedLayer.destroy();
    this._topBackingGeo.dispose();
    this._botBackingGeo.dispose();
    this._topColumnGeo.dispose();
    this._botColumnGeo.dispose();
    this._deepRockGeo.dispose();
    this._midRockGeo.dispose();
    this._wedgeRockGeo.dispose();
    this._toothGeo.dispose();
    this._plateGeo.dispose();
    this._seamGeo.dispose();
    this._debrisGeo.dispose();
    this._rockMat.dispose();
    this._deepRockMat.dispose();
    this._plateMat.dispose();
    this._lavaPlaneMat.dispose();
    this._seamMat.dispose();
  }
}
