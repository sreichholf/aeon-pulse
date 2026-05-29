import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import type { ITerrain, TerrainBounds, IScene } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

const PULSE_RISE_DURATION  = 1.5; // seconds to rise
const PULSE_HOLD_DURATION  = 1.0; // seconds to hold
const PULSE_FALL_DURATION  = 1.5; // seconds to fall
const PULSE_TOTAL          = PULSE_RISE_DURATION + PULSE_HOLD_DURATION + PULSE_FALL_DURATION;
const PULSE_MAX_OFFSET     = 60;  // px the bottom wall rises

interface ControlPoint {
  at: number;
  top: number;
  bottom: number;
}

interface ColumnEntry {
  dx: number;
  dz: number;
  heightOffset: number;
  radius: number;
  rotY: number;
  slantX: number;
  slantZ: number;
}

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

interface DebrisEntry {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rotSpeedX: number;
  rotSpeedY: number;
  active: boolean;
}

export class Terrain4 implements ITerrain {
  private _scene: IScene;
  private _points: ControlPoint[];

  private _pulsing: boolean;
  private _pulseTimer: number;
  private _lavaPulse: number;

  private _rockMat: THREE.MeshPhongMaterial;
  private _lavaPlaneMat: THREE.MeshBasicMaterial;
  private _topColumnGeo: THREE.CylinderGeometry;
  private _botColumnGeo: THREE.CylinderGeometry;
  private _topColumnMesh: THREE.InstancedMesh;
  private _botColumnMesh: THREE.InstancedMesh;

  private _topSlots: ColumnEntry[][];
  private _botSlots: ColumnEntry[][];

  private _slotSpacing: number;
  private _slotCount: number;

  private _backingGeo: THREE.PlaneGeometry;
  private _topBackingMesh: THREE.InstancedMesh;
  private _botBackingMesh: THREE.InstancedMesh;

  private _debrisPool: DebrisEntry[];
  private _debrisGeo: THREE.ConeGeometry;

  private _scrollX: number;
  private _time: number;
  private _instanceHelper: THREE.Object3D;

  constructor(scene: IScene, points: ControlPoint[]) {
    this._scene  = scene;
    this._points = points;

    this._pulsing     = false;
    this._pulseTimer  = 0;
    this._lavaPulse   = 0; // 0–1, drives flaring intensity

    // 1. Shared basalt rock material with a warm granite tone and strong specular highlight
    this._rockMat = new THREE.MeshPhongMaterial({
      color: 0x8c7665,      // Lighter warm granite-basalt
      emissive: 0x2d241e,   // Static warm volcanic underglow (highly visible base shadow)
      specular: 0xdfd5c6,   // Very bright specular to catch chiseled facets
      shininess: 40,        // High specular contrast on flat-shaded facets
      flatShading: true,    // Flat chiseled segment shading
    });

    // 2. Volcanic backing lava material
    this._lavaPlaneMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,      // Rich glowing red-orange
    });

    this._slotSpacing = 28; // horizontal spacing between slots
    this._slotCount = 60;   // pool size: covering screen width with safety margin
    this._topSlots = [];
    this._botSlots = [];

    // 3. Hexagonal Column geometries (tapered to create angled crystal basalt spires)
    // Wider base at screen edges, narrower tip extending into cavern
    this._topColumnGeo = new THREE.CylinderGeometry(15, 15 * 0.55, 1, 6);
    this._botColumnGeo = new THREE.CylinderGeometry(15 * 0.55, 15, 1, 6);
    this._topColumnMesh = new THREE.InstancedMesh(this._topColumnGeo, this._rockMat, this._slotCount * 3);
    this._botColumnMesh = new THREE.InstancedMesh(this._botColumnGeo, this._rockMat, this._slotCount * 3);
    this._topColumnMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._botColumnMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    markRenderCategory(this._topColumnMesh, RenderCategory.TERRAIN, 'terrain.column');
    markRenderCategory(this._botColumnMesh, RenderCategory.TERRAIN, 'terrain.column');
    this._topColumnMesh.count = 0;
    this._botColumnMesh.count = 0;
    this._scene.add(this._topColumnMesh);
    this._scene.add(this._botColumnMesh);

    // Pre-allocate slots, each holding 3 columns layered between Z = -28 and Z = -12 (behind player at Z = 2)
    for (let i = 0; i < this._slotCount; i++) {
      const topCols: ColumnEntry[] = [];
      const botCols: ColumnEntry[] = [];

      for (let d = 0; d < 3; d++) {
        const zDepth = -28 + d * 8 + (Math.random() - 0.5) * 2;
        const dx = (Math.random() - 0.5) * 8;
        const heightVar = (Math.random() - 0.5) * 15;
        const rad = 11 + Math.random() * 5;
        const rotY = Math.random() * Math.PI;
        const slantX = 0; // Zero depth-based tilt to prevent column meshes from extending into player ship's depth plane
        const slantZ = (Math.random() - 0.5) * 0.22;

        topCols.push({
          dx,
          dz: zDepth,
          heightOffset: heightVar,
          radius: rad,
          rotY,
          slantX,
          slantZ,
        });

        botCols.push({
          dx,
          dz: zDepth,
          heightOffset: heightVar,
          radius: rad,
          rotY,
          slantX,
          slantZ,
        });
      }

      this._topSlots.push(topCols);
      this._botSlots.push(botCols);
    }

    // 4. Pre-allocate 120 slot-based backing lava planes at Z = -35
    // These block the background void *only* behind the column sets, preventing bleeding
    this._backingGeo = new THREE.PlaneGeometry(28, 1);
    this._topBackingMesh = new THREE.InstancedMesh(this._backingGeo, this._lavaPlaneMat, this._slotCount);
    this._botBackingMesh = new THREE.InstancedMesh(this._backingGeo, this._lavaPlaneMat, this._slotCount);
    this._topBackingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._botBackingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    markRenderCategory(this._topBackingMesh, RenderCategory.TERRAIN, 'terrain.backing');
    markRenderCategory(this._botBackingMesh, RenderCategory.TERRAIN, 'terrain.backing');
    this._topBackingMesh.count = 0;
    this._botBackingMesh.count = 0;
    this._scene.add(this._topBackingMesh);
    this._scene.add(this._botBackingMesh);

    // 5. Pre-allocate pool of 30 falling rock debris chunks
    this._debrisPool = [];
    this._debrisGeo = new THREE.ConeGeometry(4, 8, 4); // 4-sided low-poly cones

    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(this._debrisGeo, this._rockMat);
      markRenderCategory(mesh, RenderCategory.TERRAIN, 'terrain.debris');
      mesh.visible = false;
      this._scene.add(mesh);

      this._debrisPool.push({
        mesh,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        rotSpeedX: 0,
        rotSpeedY: 0,
        active: false,
      });
    }

    this._scrollX = 0;
    this._time = 0;
    this._instanceHelper = new THREE.Object3D();
    this.update(0);
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

  triggerLavaPulse(): void {
    if (this._pulsing) return;
    this._pulsing    = true;
    this._pulseTimer = 0;
  }

  private _getPulseOffset(): number {
    if (!this._pulsing) return 0;
    const t = this._pulseTimer;
    if (t < PULSE_RISE_DURATION) {
      return PULSE_MAX_OFFSET * (t / PULSE_RISE_DURATION);
    } else if (t < PULSE_RISE_DURATION + PULSE_HOLD_DURATION) {
      return PULSE_MAX_OFFSET;
    } else {
      const fall = t - PULSE_RISE_DURATION - PULSE_HOLD_DURATION;
      return PULSE_MAX_OFFSET * (1.0 - fall / PULSE_FALL_DURATION);
    }
  }

  getWallsAt(scrollX: number): TerrainBounds {
    const pts = this._points;
    let top: number, bottom: number;
    if (!pts || pts.length === 0) {
      top    =  GAME_HEIGHT / 2;
      bottom = -GAME_HEIGHT / 2;
    } else if (scrollX <= pts[0]!.at) {
      top    = pts[0]!.top;
      bottom = pts[0]!.bottom;
    } else if (scrollX >= pts[pts.length - 1]!.at) {
      const last = pts[pts.length - 1]!;
      top    = last.top;
      bottom = last.bottom;
    } else {
      top    = pts[0]!.top;
      bottom = pts[0]!.bottom;
      let prev = pts[0]!;
      for (const cur of pts.slice(1)) {
        if (scrollX >= prev.at && scrollX <= cur.at) {
          const t = (scrollX - prev.at) / (cur.at - prev.at);
          top    = prev.top    + (cur.top    - prev.top)    * t;
          bottom = prev.bottom + (cur.bottom - prev.bottom) * t;
          break;
        }
        prev = cur;
      }
    }
    bottom += this._getPulseOffset();
    return { top, bottom };
  }

  getActualWallsAt(scrollX: number): TerrainBounds {
    // 1. Start with the base smooth interpolated walls at scrollX
    const baseWalls = this.getWallsAt(scrollX);
    let actualTop = baseWalls.top;
    let actualBottom = baseWalls.bottom;

    const S = this._slotSpacing;
    const centerSlot = Math.round(scrollX / S);

    // 2. Scan neighbor slots (current slot, left, and right neighbors)
    // to catch overlaps from adjacent wide column meshes
    for (let slotOffset = -1; slotOffset <= 1; slotOffset++) {
      const slot = centerSlot + slotOffset;
      const slotWorldX = slot * S;
      const poolIndex = Math.abs(slot) % this._slotCount;

      const topCols = this._topSlots[poolIndex]!;
      const botCols = this._botSlots[poolIndex]!;

      // Check top columns (d = 1 and d = 2 overlap with player's Z plane)
      for (let d = 1; d <= 2; d++) {
        const col = topCols[d]!
        const colWorldX = slotWorldX + col.dx;

        // Horizontally overlapping this column?
        if (Math.abs(scrollX - colWorldX) < col.radius) {
          const tWalls = this.getWallsAt(colWorldX);
          const topHeight = Math.max(1, (GAME_HEIGHT / 2 - tWalls.top) + col.heightOffset);
          const tipY = GAME_HEIGHT / 2 - topHeight;
          actualTop = Math.min(actualTop, tipY);
        }
      }

      // Check bottom columns (d = 1 and d = 2 overlap with player's Z plane)
      for (let d = 1; d <= 2; d++) {
        const col = botCols[d]!
        const colWorldX = slotWorldX + col.dx;

        // Horizontally overlapping this column?
        if (Math.abs(scrollX - colWorldX) < col.radius) {
          const bWalls = this.getWallsAt(colWorldX);
          const botHeight = Math.max(1, (bWalls.bottom - (-GAME_HEIGHT / 2)) + col.heightOffset);
          const tipY = -GAME_HEIGHT / 2 + botHeight;
          actualBottom = Math.max(actualBottom, tipY);
        }
      }
    }

    // Add a 6px safety buffer to prevent the ship's wings/fuselage from visually overlapping or clipping the column tips.
    let topBound = actualTop - 6;
    let bottomBound = actualBottom + 6;
    if (topBound < bottomBound) {
      const mid = (actualTop + actualBottom) / 2;
      topBound = mid;
      bottomBound = mid;
    }

    return { top: topBound, bottom: bottomBound };
  }

  update(scrollX: number, dt: number = 0): void {
    this._scrollX = scrollX;
    this._time += dt;

    // 1. Advance pulse timer & compute lava intensity curve
    if (this._pulsing) {
      this._pulseTimer += dt;
      if (this._pulseTimer >= PULSE_TOTAL) {
        this._pulsing    = false;
        this._pulseTimer = 0;
      }
      const t = this._pulseTimer;
      if (t < PULSE_RISE_DURATION) {
        this._lavaPulse = t / PULSE_RISE_DURATION;
      } else if (t < PULSE_RISE_DURATION + PULSE_HOLD_DURATION) {
        this._lavaPulse = 1.0;
      } else {
        this._lavaPulse = 1.0 - (t - PULSE_RISE_DURATION - PULSE_HOLD_DURATION) / PULSE_FALL_DURATION;
      }
    } else {
      this._lavaPulse = 0;
    }

    // 2. Tectonic Screen Shake VFX during active lava pulse
    if (this._pulsing) {
      const shakeIntensity = 7 * this._lavaPulse; // Jitter up to 7 pixels
      const shakeX = (Math.random() - 0.5) * shakeIntensity;
      const shakeY = (Math.random() - 0.5) * shakeIntensity;
      this._scene.camera.position.set(shakeX, shakeY, 100);
    } else {
      this._scene.camera.position.set(0, 0, 100);
    }

    // 3. Gentle breathing pulse on backing lava material
    // Breathing cycles every ~4.2 seconds (freq = 1.5 rad/s) between warm dim and rich active orange
    const baseLava = new THREE.Color(0x882200);
    const activeLava = new THREE.Color(0xff4400);
    const curLava = new THREE.Color();
    const breatheIntensity = 0.5 + 0.5 * Math.sin(this._time * 1.5);
    curLava.lerpColors(baseLava, activeLava, breatheIntensity);
    this._lavaPlaneMat.color.copy(curLava);

    // 4. Update the boundary Columns & Backing Planes dynamically
    let topBackingCount = 0;
    let botBackingCount = 0;
    let topColumnCount = 0;
    let botColumnCount = 0;

    const S = this._slotSpacing;
    const startSlot = Math.floor((scrollX - GAME_WIDTH / 2 - 120) / S);
    const endSlot = Math.ceil((scrollX + GAME_WIDTH / 2 + 120) / S);

    for (let slot = startSlot; slot <= endSlot; slot++) {
      const slotWorldX = slot * S;
      const poolIndex = Math.abs(slot) % this._slotCount;

      const topCols = this._topSlots[poolIndex]!;
      const botCols = this._botSlots[poolIndex]!;

      const slotWalls = this.getWallsAt(slotWorldX);
      const slotTopHeight = Math.max(1, GAME_HEIGHT / 2 - slotWalls.top);
      const slotBotHeight = Math.max(1, slotWalls.bottom - (-GAME_HEIGHT / 2));

      // 4A. Update slot-clamped Lava Backing Planes (Z = -35)
      // These perfectly mask the background spires only where the column meshes stand
      this._setInstanceTransform(
        this._topBackingMesh,
        topBackingCount++,
        [slotWorldX - scrollX, GAME_HEIGHT / 2 - slotTopHeight / 2, -35],
        new THREE.Euler(0, 0, 0),
        [1, slotTopHeight, 1],
      );

      this._setInstanceTransform(
        this._botBackingMesh,
        botBackingCount++,
        [slotWorldX - scrollX, -GAME_HEIGHT / 2 + slotBotHeight / 2, -35],
        new THREE.Euler(0, 0, 0),
        [1, slotBotHeight, 1],
      );

      // 4B. Update individual Column meshes (Z = -28 to 8)
      for (let d = 0; d < 3; d++) {
        const tCol = topCols[d]!;
        const bCol = botCols[d]!;

        const tWorldX = slotWorldX + tCol.dx;
        const bWorldX = slotWorldX + bCol.dx;

        const tWalls = this.getWallsAt(tWorldX);
        const bWalls = this.getWallsAt(bWorldX);

        // Position, scale & rotate Top Column
        const topHeight = Math.max(1, (GAME_HEIGHT / 2 - tWalls.top) + tCol.heightOffset);
        this._setInstanceTransform(
          this._topColumnMesh,
          topColumnCount++,
          [tWorldX - scrollX, GAME_HEIGHT / 2 - topHeight / 2, tCol.dz],
          new THREE.Euler(tCol.slantX, tCol.rotY, tCol.slantZ),
          [tCol.radius, topHeight, 0.2],
        );

        // Position, scale & rotate Bottom Column
        const botHeight = Math.max(1, (bWalls.bottom - (-GAME_HEIGHT / 2)) + bCol.heightOffset);
        this._setInstanceTransform(
          this._botColumnMesh,
          botColumnCount++,
          [bWorldX - scrollX, -GAME_HEIGHT / 2 + botHeight / 2, bCol.dz],
          new THREE.Euler(bCol.slantX, bCol.rotY, bCol.slantZ),
          [bCol.radius, botHeight, 0.2],
        );
      }
    }

    this._topBackingMesh.count = topBackingCount;
    this._botBackingMesh.count = botBackingCount;
    this._topColumnMesh.count = topColumnCount;
    this._botColumnMesh.count = botColumnCount;
    this._topBackingMesh.instanceMatrix.needsUpdate = true;
    this._botBackingMesh.instanceMatrix.needsUpdate = true;
    this._topColumnMesh.instanceMatrix.needsUpdate = true;
    this._botColumnMesh.instanceMatrix.needsUpdate = true;

    // 5. Spawning & updating gravity-driven falling ceiling debris
    if (this._pulsing && Math.random() < 0.15) {
      const spawnX = scrollX + (Math.random() - 0.5) * (GAME_WIDTH + 80);
      const walls = this.getWallsAt(spawnX);

      const freeDebris = this._debrisPool.find(d => !d.active);
      if (freeDebris) {
        freeDebris.active = true;
        freeDebris.x = spawnX;
        freeDebris.y = walls.top - 12;
        freeDebris.z = -25 + Math.random() * 40;
        freeDebris.vx = -40 - Math.random() * 60;
        freeDebris.vy = -80 - Math.random() * 120;
        freeDebris.rotSpeedX = (Math.random() - 0.5) * 8;
        freeDebris.rotSpeedY = (Math.random() - 0.5) * 8;
        freeDebris.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
        freeDebris.mesh.visible = true;
      }
    }

    // Update active debris
    for (const d of this._debrisPool) {
      if (!d.active) continue;

      d.vy -= 420 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      d.mesh.rotation.x += d.rotSpeedX * dt;
      d.mesh.rotation.y += d.rotSpeedY * dt;

      d.mesh.position.set(d.x - scrollX, d.y, d.z);

      const dWalls = this.getWallsAt(d.x);
      if (d.y - 4 <= dWalls.bottom || d.y < -GAME_HEIGHT / 2 - 20) {
        d.active = false;
        d.mesh.visible = false;
      }
      if (d.x - scrollX < -GAME_WIDTH / 2 - 50) {
        d.active = false;
        d.mesh.visible = false;
      }
    }
  }

  destroy(): void {
    this._scene.camera.position.set(0, 0, 100);

    // Clean up backing planes
    this._scene.remove(this._topBackingMesh);
    this._scene.remove(this._botBackingMesh);
    this._backingGeo.dispose();
    this._lavaPlaneMat.dispose();

    // Clean up columns
    this._scene.remove(this._topColumnMesh);
    this._scene.remove(this._botColumnMesh);
    this._topColumnGeo.dispose();
    this._botColumnGeo.dispose();

    // Clean up debris
    for (const d of this._debrisPool) {
      this._scene.remove(d.mesh);
    }
    this._debrisGeo.dispose();

    this._rockMat.dispose();
  }
}
