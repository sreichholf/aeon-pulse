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
import { EnemyType, BulletType, type BossConstructorParams, type GetPositionFn, type IAudio, type IBoss, type IEnemy, type IScene, type ITerrain, type SpawnEnemyFn, type ProjectileFactoryFn } from '../types.ts';

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
  /** Ordered list of bullet types to cycle through in the Tactical Database preview. Empty = no preview. */
  viewerBulletTypes: BulletType[];
  spawn(params: SpawnEnemyParams): IEnemy;
}

export interface BossViewerPresentation {
  level: number;
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
  level: number;
  viewer: BossViewerPresentation;
  /** Ordered list of bullet types to cycle through in the Tactical Database preview. */
  viewerBulletTypes: BulletType[];
}

export const ENEMY_CATALOG: readonly EnemyCatalogEntry[] = [
  {
    type: EnemyType.STRAIGHT,
    viewer: { page: 'stage-enemies', order: 10, scale: 0.85, centering: 'bounds' },
    viewerBulletTypes: [BulletType.ENEMY],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemyStraight(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.SINE,
    viewer: { page: 'stage-enemies', order: 20, scale: 0.85, centering: 'bounds' },
    viewerBulletTypes: [BulletType.ENEMY],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemySine(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.DIVER,
    viewer: { page: 'stage-enemies', order: 30, scale: 0.85, centering: 'bounds' },
    viewerBulletTypes: [BulletType.ENEMY],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemyDiver(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.SWARM,
    viewer: { page: 'stage-enemies', order: 40, scale: 0.85, centering: 'bounds' },
    viewerBulletTypes: [BulletType.ENEMY],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemySwarm(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.TURRET,
    viewer: { page: 'stage-enemies', order: 50, scale: 0.85, centering: 'bounds' },
    viewerBulletTypes: [BulletType.ENEMY, BulletType.BOSS_LASER],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemyTurret(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.CHARGER,
    viewer: { page: 'stage-enemies', order: 60, scale: 0.85, centering: 'origin' },
    viewerBulletTypes: [],
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemyCharger(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.SPORE,
    viewer: { page: 'stage-enemies', order: 70, scale: 0.85, centering: 'bounds' },
    viewerBulletTypes: [BulletType.HOMING],
    spawn: ({ scene, sprites, x, y, getPos, projectileFactory }) => new EnemySpore(scene, sprites, x, y, getPos, projectileFactory),
  },
  {
    type: EnemyType.OBSTACLE,
    viewer: { page: 'stage-enemies', order: 80, scale: 0.60, centering: 'bounds' },
    viewerBulletTypes: [],
    spawn: ({ scene, sprites, x, y, projectileFactory }) => new Obstacle(scene, sprites, x, y, projectileFactory),
  },
  {
    type: EnemyType.ROCK_DRAKE,
    viewer: { page: 'stage-enemies', order: 90, scale: 0.75, centering: 'bounds' },
    viewerBulletTypes: [BulletType.LAVA],
    spawn: ({ scene, sprites, x, y, getPos, projectileFactory }) => new RockDrake(scene, sprites, x, y, getPos, projectileFactory),
  },
  {
    type: EnemyType.STALACTITE,
    viewer: { page: 'stage-enemies', order: 100, scale: 0.70, centering: 'bounds' },
    viewerBulletTypes: [BulletType.LAVA],
    spawn: ({ scene, sprites, x, y, getPos, getScrollX, terrain, audio, projectileFactory }) =>
      new Stalactite(scene, sprites, x, y, getPos, getScrollX, terrain, audio, projectileFactory),
  },
] as const;

export const BOSS_CATALOG: readonly BossCatalogEntry[] = [
  { level: 1, viewer: { level: 1, scale: 0.52 }, viewerBulletTypes: [BulletType.BOSS, BulletType.HOMING] },
  { level: 2, viewer: { level: 2, scale: 0.45 }, viewerBulletTypes: [BulletType.BOSS, BulletType.HOMING, BulletType.BOSS_LASER] },
  { level: 3, viewer: { level: 3, scale: 0.36 }, viewerBulletTypes: [BulletType.BOSS_LASER, BulletType.HOMING, BulletType.WAVE] },
  { level: 4, viewer: { level: 4, scale: 0.33 }, viewerBulletTypes: [BulletType.LAVA] },
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
  return [...BOSS_CATALOG].sort((a, b) => a.level - b.level);
}

export function spawnCatalogBoss(level: number, { scene, sprites, getPos, onDeath, audio, spawnEnemyCallback, projectileFactory }: SpawnBossParams): IBoss {
  const def = LEVELS[level as keyof typeof LEVELS]!;
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
