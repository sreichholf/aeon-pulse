// Central type contracts for the AEON PULSE TypeScript migration.
// All agents import shared interfaces from here.

import * as THREE from 'three';

// ── Enums ──────────────────────────────────────────────────────────────────
export enum GameState {
  TITLE = 'TITLE',
  LEVEL_START = 'LEVEL_START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_COMPLETE = 'GAME_COMPLETE',
  VIEWER = 'VIEWER',
}

export enum EnemyType {
  STRAIGHT = 'straight',
  SINE = 'sine',
  DIVER = 'diver',
  SWARM = 'swarm',
  TURRET = 'turret',
  CHARGER = 'charger',
  SPORE = 'spore',
  OBSTACLE = 'obstacle',
  ROCK_DRAKE = 'rockDrake',
  STALACTITE = 'stalactite',
}

export enum BulletType {
  PLAYER = 'player',
  PLAYER_CHARGE = 'playerCharge',
  PLAYER_WAVE = 'playerWave',
  PLAYER_PLASMA = 'playerPlasma',
  ENEMY = 'enemy',
  HOMING = 'homing',
  BOSS = 'boss',
  BOSS_LASER = 'bossLaser',
  WAVE = 'wave',
  LAVA = 'lava',
}

export enum ProjectileSourceKey {
  PLAYER = 'player',
  PLAYER_CHARGE = 'playerCharge',
  PLAYER_CHARGE_SIDE = 'playerChargeSide',
  PLAYER_WAVE = 'playerWave',
  PLAYER_PLASMA = 'playerPlasma',
  ENEMY = 'enemy',
  ENEMY_SINE = 'enemySine',
  ENEMY_DIVER = 'enemyDiver',
  ENEMY_SWARM = 'enemySwarm',
  HOMING = 'homing',
  BOSS = 'boss',
  BOSS_LASER = 'bossLaser',
  WAVE = 'wave',
  LAVA = 'lava',
}

export enum RenderCategory {
  BACKGROUND = 'background',
  TERRAIN = 'terrain',
  PLAYER = 'player',
  ENEMY = 'enemy',
  BOSS = 'boss',
  BULLET = 'bullet',
  EFFECT = 'effect',
  UI = 'ui',
  ENGINE = 'engine',
  UNCATEGORIZED = 'uncategorized',
}

export enum UserDataKey {
  RENDER_CATEGORY = 'renderCategory',
  RENDER_DETAIL = 'renderDetail',
  COMPILED_MESHES = 'compiledMeshes',
}

export enum DifficultyMode {
  ROOKIE = 'rookie',
  PILOT = 'pilot',
  ACE = 'ace',
}

export enum MusicCue {
  TITLE = 'title',
  CHAPTER_MEGASTRUCTURE = 'chapter_megastructure',
  CHAPTER_INDUSTRIAL = 'chapter_industrial',
  CHAPTER_HIVE = 'chapter_hive',
  CHAPTER_VOLCANIC = 'chapter_volcanic',
}

// ── Game state type (kept for backward compat) ───────────────────────────────
// GameState is now an enum above — no separate type alias needed.

// ── Bullet types (kept for backward compat) ───────────────────────────────────
// BulletType is now an enum above — no separate type alias needed.

// ── Shared value objects ──────────────────────────────────────────────────────
export interface Vec2 {
  x: number;
  y: number;
}

export interface TerrainBounds {
  top: number;
  bottom: number;
}

export type PlayfieldBounds = TerrainBounds;

export interface HitResult extends Vec2 {
  dropPowerup: boolean;
}

export interface EntityMetadata {
  displayName: string | undefined;
  hp: number;
  score: number;
  isBoss: boolean;
}

// ── Callbacks ─────────────────────────────────────────────────────────────────
export type GetPositionFn = () => Vec2;
export type SpawnEnemyFn  = (type: EnemyType, x: number, y: number) => void;

export interface ProjectileSpawn {
  type: ProjectileSourceKey | BulletType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  getTargetPos?: GetPositionFn | null;
  tint?: number | null;
  damageOverride?: number | null;
}

export type ProjectileFactoryFn = (spawn: ProjectileSpawn) => IBullet;

// ── Scene (minimal interface so entities never depend on THREE.Scene directly) ─
export interface IScene {
  camera: THREE.Camera;
  add(object: THREE.Object3D): void;
  remove(object: THREE.Object3D): void;
  flash(duration: number): void;
}

// ── AABB collidable ───────────────────────────────────────────────────────────
export interface ICollidable {
  readonly x: number;
  readonly y: number;
  readonly hw: number;
  readonly hh: number;
}

// ── Player ───────────────────────────────────────────────────────────────────
export interface IPlayer extends ICollidable {
  /** set by Game each frame; null when terrain is inactive */
  terrainBounds: TerrainBounds | null;
  hit(): boolean;
  update(dt: number): IBullet[];
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
export interface IPowerUp extends ICollidable {
  readonly isOffscreen: boolean;
  update(dt: number): void;
  destroy(): void;
}

// ── Visual effect (short-lived particle burst) ────────────────────────────────
export interface IEffect {
  update(dt: number): void;
  readonly isDone: boolean;
  destroy(): void;
}

// ── Bullet ───────────────────────────────────────────────────────────────────
export interface IBullet extends ICollidable {
  active: boolean;
  readonly isPlayerBullet: boolean;
  readonly damage: number;
  readonly isPiercing: boolean;
  readonly isOffscreen: boolean;
  readonly type: BulletType;
  readonly sourceKey?: string;
  readonly renderUnitCount?: number;
  update(dt: number): void;
  destroy(): void;
}

// ── Enemy (non-boss) ─────────────────────────────────────────────────────────
export interface IEnemy extends ICollidable {
  readonly isBoss: false;
  readonly isAlive: boolean;
  readonly isOffscreen: boolean;
  readonly isSpaceShip: boolean;
  score: number;
  readonly metadata: EntityMetadata;
  terrainBounds: TerrainBounds | null;
  update(dt: number): IBullet[];
  hit(damage?: number): HitResult | null;
  destroy(): void;
}

// ── Boss hit zone ─────────────────────────────────────────────────────────────
export interface HitZone {
  id: string;
  x: number;
  y: number;
  hw: number;
  hh: number;
}

// ── Boss ─────────────────────────────────────────────────────────────────────
export interface IBoss extends ICollidable {
  readonly isBoss: true;
  readonly isAlive: boolean;
  readonly isOffscreen: boolean;
  readonly isDying: boolean;
  score: number;
  readonly metadata: EntityMetadata;
  playfieldBounds: PlayfieldBounds | null;
  update(dt: number): IBullet[];
  hit(damage?: number, zone?: string): boolean;
  hitZones(): HitZone[];
  readonly lasers: ReadonlyArray<ICollidable>;
  destroy(): void;
}

// ── Boss constructor params (normalised across all four bosses) ───────────────
export interface BossConstructorParams {
  scene: IScene;
  sprites: Record<string, THREE.Texture>;
  getPlayerPos: GetPositionFn;
  onDeath: () => void;
  audio: IAudio;
  spawnEnemy: SpawnEnemyFn;
  projectileFactory: ProjectileFactoryFn;
}

// ── Terrain ───────────────────────────────────────────────────────────────────
export interface ITerrain {
  getWallsAt(scrollX: number): TerrainBounds;
  getActualWallsAt(x: number): TerrainBounds;
  update?(scrollX: number, dt: number): void;
  triggerLavaPulse?(): void;
  destroy?(): void;
}

// ── Level manager ─────────────────────────────────────────────────────────────
export interface ILevelManager {
  readonly scrollX: number;
  update(dt: number): void;
}

// ── Background ────────────────────────────────────────────────────────────────
export interface IBackground {
  update(dt: number): void;
  destroy(): void;
}

export interface IBackgroundWithSpeed extends IBackground {
  baseSpeed: number;
}

// ── Audio (minimal interface so entities never import AudioManager directly) ──
export interface IAudio {
  play(soundName: string): void;
}
