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
  PROP = 'prop',
  UI = 'ui',
  ENGINE = 'engine',
  UNCATEGORIZED = 'uncategorized',
}

export enum UserDataKey {
  RENDER_CATEGORY = 'renderCategory',
  RENDER_DETAIL = 'renderDetail',
  COMPILED_MESHES = 'compiledMeshes',
  ENEMY_TYPE = 'enemyType',
  MODEL_BUCKET = 'modelBucket',
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

export const WeaponTier = { RAPID: 1, TWIN: 2, SPREAD: 3, WAVE: 4, PLASMA: 5 } as const;
export type WeaponTierValue = typeof WeaponTier[keyof typeof WeaponTier];

// ── Destructible scenery props (per ADR 0028) ─────────────────────────────────
export enum PropType {
  // Chapter 1 — Megastructure
  SENSOR_POD = 'sensorPod',
  CARGO_CANISTER = 'cargoCanister',
  SHIELD_RELAY = 'shieldRelay',
  // Chapter 2 — Industrial
  FUEL_TANK = 'fuelTank',
  CONVEYOR_NODE = 'conveyorNode',
  FURNACE_VENT = 'furnaceVent',
  // Chapter 3 — Hive
  SPORE_POD = 'sporePod',
  EGG_SAC = 'eggSac',
  HIVE_BULB = 'hiveBulb',
  // Chapter 4 — Volcanic
  BRITTLE_BASALT_COLUMN = 'brittleBasaltColumn',
  HANGING_MAGMA_SAC = 'hangingMagmaSac',
  CRYSTAL_OUTCROP = 'crystalOutcrop',
  // v2 solid props
  HULL_BULKHEAD = 'hullBulkhead',
  COOLING_PLUG = 'coolingPlug',
  BONE_DAM = 'boneDam',
  BASALT_GATE = 'basaltGate',
}

export enum PropEffectKind {
  BULLET_CLEAR = 'bulletClear',
  SCORE_DROP = 'scoreDrop',
  POWERUP_DROP = 'powerupDrop',
  HAZARD_RELEASE = 'hazardRelease',
}

export enum PropCollisionShape {
  BOX = 'box',
  CIRCLE = 'circle',
}

export type PropSolidBounds =
  | { shape: PropCollisionShape.BOX; x: number; y: number; hw: number; hh: number }
  | { shape: PropCollisionShape.CIRCLE; x: number; y: number; radius: number };

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
  triggerCancellation?: boolean;
}

export interface PropHitResult extends Vec2 {
  propType: PropType;
  effects: readonly PropEffectKind[];
  scoreValue: number;
  dropPowerup: boolean;
  clearRadius: number;
  hazardRadius: number;
  hazardDuration: number;
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
export type PresentationContext = 'gameplay' | 'viewer';
export type EnemyPresentationContext = PresentationContext;
export type BossPresentationContext = PresentationContext;

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
  setPosition(x: number, y: number): void;
  update(dt: number): IBullet[];
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
export enum PowerUpType {
  WEAPON = 'weapon',
  BOMB = 'bomb',
}

export interface IPowerUp extends ICollidable {
  readonly isOffscreen: boolean;
  readonly type: PowerUpType;
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
  remainingPierce?: number;
  readonly isOffscreen: boolean;
  readonly type: BulletType;
  readonly sourceKey?: string;
  readonly renderUnitCount?: number;
  update(dt: number): void;
  destroy(): void;
}

// ── Enemy (non-boss) ─────────────────────────────────────────────────────────
export interface IEnemy extends ICollidable {
  y: number;
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

// ── Prop (destructible scenery; non-solid, own collection per ADR 0028) ───────
export interface IProp extends ICollidable {
  readonly propType: PropType;
  readonly isAlive: boolean;
  readonly isOffscreen: boolean;
  /** True once a Timed Burst window has expired and the prop awaits consumption. */
  readonly isBursting: boolean;
  readonly isSolid: boolean;
  readonly collisionShape: PropCollisionShape;
  readonly isFullGate: boolean;
  update(dt: number): void;
  /** Apply damage; returns a death result when destroyed by being shot. */
  hit(damage?: number): PropHitResult | null;
  /** Consume a pending Timed Burst; returns its death result, or null if not bursting. */
  consumeBurst(): PropHitResult | null;
  /** Returns the solid collision footprint for this prop, or null if it is not solid. */
  getSolidBounds(): PropSolidBounds | null;
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
  readonly maxHp: number;
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
  presentationContext?: BossPresentationContext;
}

// ── Terrain ───────────────────────────────────────────────────────────────────
export interface ITerrain {
  getWallsAt(scrollX: number): TerrainBounds;
  getCollisionWallsAt(x: number): TerrainBounds;
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

export interface IWeaponTierSink {
  setWeaponTier(tier: WeaponTierValue): void;
}
