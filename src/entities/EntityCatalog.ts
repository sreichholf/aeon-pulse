import * as THREE from 'three';
import { EnemyStraight } from './EnemyStraight.ts';
import { EnemySine } from './EnemySine.ts';
import { EnemyDiver } from './EnemyDiver.ts';
import { EnemySwarm } from './EnemySwarm.ts';
import { EnemyTurret } from './EnemyTurret.ts';
import { EnemyCharger } from './EnemyCharger.ts';
import { EnemySpore } from './EnemySpore.ts';
import { Obstacle } from './Obstacle.ts';
import { RockDrake } from './RockDrake.ts';
import { Stalactite } from './Stalactite.ts';
import { LEVELS } from '../level/Levels.ts';
import { EnemyType, ProjectileSourceKey, type BossConstructorParams, type GetPositionFn, type IAudio, type IBoss, type IEnemy, type IScene, type ITerrain, type SpawnEnemyFn, type ProjectileFactoryFn } from '../types.ts';

export interface SpawnEnemyParams {
  scene: IScene;
  sprites: Record<string, THREE.Texture>;
  x: number;
  y: number;
  getPos: GetPositionFn;
  audio: IAudio | null;
  getScrollX: () => number;
  terrain: ITerrain | null;
  projectileFactory: ProjectileFactoryFn;
}

type ViewerCentering = 'bounds' | 'origin';

export interface EnemyViewerPresentation {
  page: 'stage-enemies';
  order: number;
  scale: number;
  centering: ViewerCentering;
}

export interface EnemyCatalogEntry {
  type: EnemyType;
  viewer: EnemyViewerPresentation;
  /** Ordered list of projectile source keys to cycle through in the Tactical Database preview. Empty = no preview. */
  viewerProjectileKeys: ProjectileSourceKey[];
  spawn(params: SpawnEnemyParams): IEnemy;
}

export interface BossViewerPresentation {
  bossArchetype: number;
  scale: number;
}

export interface SpawnBossParams {
  scene: IScene;
  sprites: Record<string, THREE.Texture>;
  getPos: GetPositionFn;
  onDeath: () => void;
  audio: IAudio | null;
  spawnEnemyCallback: SpawnEnemyFn;
  projectileFactory: ProjectileFactoryFn;
}

export interface BossCatalogEntry {
  bossArchetype: number;
  viewer: BossViewerPresentation;
  /** Ordered list of projectile source keys to cycle through in the Tactical Database preview. */
  viewerProjectileKeys: ProjectileSourceKey[];
}

export const ENEMY_CATALOG: readonly EnemyCatalogEntry[] = [
  {
    type: EnemyType.STRAIGHT,
    viewer: { page: 'stage-enemies', order: 10, scale: 0.85, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.ENEMY],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemyStraight(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.SINE,
    viewer: { page: 'stage-enemies', order: 20, scale: 0.85, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.ENEMY_SINE],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemySine(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.DIVER,
    viewer: { page: 'stage-enemies', order: 30, scale: 0.85, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.ENEMY_DIVER],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemyDiver(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.SWARM,
    viewer: { page: 'stage-enemies', order: 40, scale: 0.85, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.ENEMY_SWARM],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemySwarm(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.TURRET,
    viewer: { page: 'stage-enemies', order: 50, scale: 0.85, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.BOSS_LASER],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemyTurret(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.CHARGER,
    viewer: { page: 'stage-enemies', order: 60, scale: 0.85, centering: 'origin' },
    viewerProjectileKeys: [],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemyCharger(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.SPORE,
    viewer: { page: 'stage-enemies', order: 70, scale: 0.85, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.HOMING],
    spawn: ({ scene, sprites, x, y, getPos, projectileFactory }) => new EnemySpore(scene, sprites, x, y, getPos, projectileFactory),
  },
  {
    type: EnemyType.OBSTACLE,
    viewer: { page: 'stage-enemies', order: 80, scale: 0.60, centering: 'bounds' },
    viewerProjectileKeys: [],
    spawn: ({ scene, sprites, x, y, projectileFactory }) => new Obstacle(scene, sprites, x, y, projectileFactory),
  },
  {
    type: EnemyType.ROCK_DRAKE,
    viewer: { page: 'stage-enemies', order: 90, scale: 0.75, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.LAVA],
    spawn: ({ scene, sprites, x, y, getPos, projectileFactory }) => new RockDrake(scene, sprites, x, y, getPos, projectileFactory),
  },
  {
    type: EnemyType.STALACTITE,
    viewer: { page: 'stage-enemies', order: 100, scale: 0.70, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.LAVA],
    spawn: ({ scene, sprites, x, y, getPos, getScrollX, terrain, audio, projectileFactory }) =>
      new Stalactite(scene, sprites, x, y, getPos, getScrollX, terrain, audio, projectileFactory),
  },
] as const;

export const BOSS_CATALOG: readonly BossCatalogEntry[] = [
  { bossArchetype: 1, viewer: { bossArchetype: 1, scale: 0.52 }, viewerProjectileKeys: [ProjectileSourceKey.BOSS, ProjectileSourceKey.HOMING] },
  { bossArchetype: 2, viewer: { bossArchetype: 2, scale: 0.45 }, viewerProjectileKeys: [ProjectileSourceKey.BOSS, ProjectileSourceKey.HOMING, ProjectileSourceKey.BOSS_LASER] },
  { bossArchetype: 3, viewer: { bossArchetype: 3, scale: 0.36 }, viewerProjectileKeys: [ProjectileSourceKey.BOSS_LASER, ProjectileSourceKey.HOMING, ProjectileSourceKey.WAVE] },
  { bossArchetype: 4, viewer: { bossArchetype: 4, scale: 0.33 }, viewerProjectileKeys: [ProjectileSourceKey.LAVA] },
] as const;

const ENEMY_BY_TYPE = new Map<EnemyType, EnemyCatalogEntry>(
  ENEMY_CATALOG.map((entry) => [entry.type, entry]),
);

export function getEnemyCatalogEntry(type: EnemyType): EnemyCatalogEntry | null {
  return ENEMY_BY_TYPE.get(type) ?? null;
}

export function getStageEnemyCatalogEntries(): EnemyCatalogEntry[] {
  return [...ENEMY_CATALOG]
    .filter((entry) => entry.viewer.page === 'stage-enemies')
    .sort((a, b) => a.viewer.order - b.viewer.order);
}

export function spawnCatalogEnemy(type: EnemyType, params: SpawnEnemyParams): IEnemy | null {
  return getEnemyCatalogEntry(type)?.spawn(params) ?? null;
}

export function getBossCatalogEntries(): BossCatalogEntry[] {
  return [...BOSS_CATALOG].sort((a, b) => a.bossArchetype - b.bossArchetype);
}

export function spawnCatalogBoss(bossArchetype: number, { scene, sprites, getPos, onDeath, audio, spawnEnemyCallback, projectileFactory }: SpawnBossParams): IBoss {
  const def = LEVELS[bossArchetype as keyof typeof LEVELS]!;
  const params: BossConstructorParams = {
    scene,
    sprites,
    getPlayerPos: getPos,
    onDeath,
    audio: audio ?? { play: () => {} },
    spawnEnemy: spawnEnemyCallback,
    projectileFactory,
  };
  return def.createBoss(params);
}
