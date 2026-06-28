import * as THREE from 'three';
import { Boss } from './Boss.ts';
import { Boss2 } from './Boss2.ts';
import { Boss3 } from './Boss3.ts';
import { Boss4 } from './Boss4.ts';
import { EnemyCharger } from './EnemyCharger.ts';
import { EnemyDiver } from './EnemyDiver.ts';
import { EnemySine } from './EnemySine.ts';
import { EnemySpore } from './EnemySpore.ts';
import { EnemyStraight } from './EnemyStraight.ts';
import { EnemySwarm } from './EnemySwarm.ts';
import { EnemyTurret } from './EnemyTurret.ts';
import { Obstacle } from './Obstacle.ts';
import { RockDrake } from './RockDrake.ts';
import { Stalactite } from './Stalactite.ts';
import { LEVELS } from '../level/Levels.ts';
import { EnemyType, ProjectileSourceKey, type BossConstructorParams, type BossPresentationContext, type EnemyPresentationContext, type GetPositionFn, type IAudio, type IBoss, type IEnemy, type IScene, type ITerrain, type SpawnEnemyFn, type ProjectileFactoryFn } from '../types.ts';
import { RenderCategory, markRenderCategory } from '../systems/RenderStats.ts';

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
  presentationContext?: EnemyPresentationContext;
}

export type ViewerCentering = 'bounds' | 'origin';

/**
 * Shared presentation fields consumed identically by the Tactical Database for both
 * stage enemies and bosses. Specialised presentations extend this to carry their own
 * page/archetype/offset facts.
 */
export interface ViewerPresentation {
  scale: number;
  centering: ViewerCentering;
  viewerOffsetX?: number;
}

export interface EnemyViewerPresentation extends ViewerPresentation {
  page: 'stage-enemies';
  order: number;
}

export interface BossViewerPresentation extends ViewerPresentation {
  bossArchetype: number;
  offsetX?: number;
  offsetY?: number;
}

/**
 * Common contract shared by every catalog entry that the Tactical Database can present.
 * Stage-enemy and boss entry types specialise the presentation through the generic
 * parameter while reusing the same viewer/preview/readiness triple.
 */
export interface ViewerCatalogEntry<TPresentation extends ViewerPresentation = ViewerPresentation> {
  viewer: TPresentation;
  /** Ordered list of projectile source keys to cycle through in the Tactical Database preview. Empty = no preview. */
  viewerProjectileKeys: ProjectileSourceKey[];
  /** Trigger asynchronous viewer model readiness (e.g. GLB preload). Resolves immediately for procedural subjects. */
  preloadViewerModel(): Promise<unknown>;
}

export interface EnemyCatalogEntry extends ViewerCatalogEntry<EnemyViewerPresentation> {
  type: EnemyType;
  /** Extra symmetric vertical clearance this enemy needs for its authored movement pattern. */
  movementEnvelope?: number;
  spawn(params: SpawnEnemyParams): IEnemy;
}

export interface SpawnBossParams {
  scene: IScene;
  sprites: Record<string, THREE.Texture>;
  getPos: GetPositionFn;
  onDeath: () => void;
  audio: IAudio | null;
  spawnEnemyCallback: SpawnEnemyFn;
  projectileFactory: ProjectileFactoryFn;
  presentationContext?: BossPresentationContext;
}

export interface BossCatalogEntry extends ViewerCatalogEntry<BossViewerPresentation> {
  bossArchetype: number;
}

export const ENEMY_CATALOG: readonly EnemyCatalogEntry[] = [
  {
    type: EnemyType.STRAIGHT,
    viewer: { page: 'stage-enemies', order: 10, scale: 1.20, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.ENEMY],
    preloadViewerModel: () => EnemyStraight.preloadModel('viewer'),
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory, presentationContext }) =>
      new EnemyStraight(scene, sprites, x, y, getPos, projectileFactory, audio, { presentationContext }),
  },
  {
    type: EnemyType.SINE,
    movementEnvelope: 35,
    viewer: { page: 'stage-enemies', order: 20, scale: 1.22, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.ENEMY_SINE],
    preloadViewerModel: () => EnemySine.preloadModel('viewer'),
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory, presentationContext }) =>
      new EnemySine(scene, sprites, x, y, getPos, projectileFactory, audio, { presentationContext }),
  },
  {
    type: EnemyType.DIVER,
    viewer: { page: 'stage-enemies', order: 30, scale: 1.0, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.ENEMY_DIVER],
    preloadViewerModel: () => EnemyDiver.preloadModel('viewer'),
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory, presentationContext }) =>
      new EnemyDiver(scene, sprites, x, y, getPos, projectileFactory, audio, { presentationContext }),
  },
  {
    type: EnemyType.SWARM,
    viewer: { page: 'stage-enemies', order: 40, scale: 0.85, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.ENEMY_SWARM],
    preloadViewerModel: () => EnemySwarm.preloadModel('viewer'),
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory, presentationContext }) =>
      new EnemySwarm(scene, sprites, x, y, getPos, projectileFactory, audio, { presentationContext }),
  },
  {
    type: EnemyType.TURRET,
    viewer: { page: 'stage-enemies', order: 50, scale: 0.85, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.BOSS_LASER],
    preloadViewerModel: () => Promise.resolve(),
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory }) => new EnemyTurret(scene, sprites, x, y, getPos, projectileFactory, audio),
  },
  {
    type: EnemyType.CHARGER,
    viewer: { page: 'stage-enemies', order: 60, scale: 0.85, centering: 'origin', viewerOffsetX: 18 },
    viewerProjectileKeys: [],
    preloadViewerModel: () => Promise.resolve(),
    spawn: ({ scene, sprites, x, y, getPos, audio, projectileFactory, presentationContext }) =>
      new EnemyCharger(scene, sprites, x, y, getPos, projectileFactory, audio, { presentationContext }),
  },
  {
    type: EnemyType.SPORE,
    viewer: { page: 'stage-enemies', order: 70, scale: 0.85, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.HOMING],
    preloadViewerModel: () => Promise.resolve(),
    spawn: ({ scene, sprites, x, y, getPos, projectileFactory }) => new EnemySpore(scene, sprites, x, y, getPos, projectileFactory),
  },
  {
    type: EnemyType.OBSTACLE,
    viewer: { page: 'stage-enemies', order: 80, scale: 0.60, centering: 'bounds' },
    viewerProjectileKeys: [],
    preloadViewerModel: () => Promise.resolve(),
    spawn: ({ scene, sprites, x, y, projectileFactory }) => new Obstacle(scene, sprites, x, y, projectileFactory),
  },
  {
    type: EnemyType.ROCK_DRAKE,
    viewer: { page: 'stage-enemies', order: 90, scale: 0.75, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.LAVA],
    preloadViewerModel: () => Promise.resolve(),
    spawn: ({ scene, sprites, x, y, getPos, projectileFactory }) => new RockDrake(scene, sprites, x, y, getPos, projectileFactory),
  },
  {
    type: EnemyType.STALACTITE,
    viewer: { page: 'stage-enemies', order: 100, scale: 0.70, centering: 'bounds' },
    viewerProjectileKeys: [ProjectileSourceKey.LAVA],
    preloadViewerModel: () => Promise.resolve(),
    spawn: ({ scene, sprites, x, y, getPos, getScrollX, terrain, audio, projectileFactory }) =>
      new Stalactite(scene, sprites, x, y, getPos, getScrollX, terrain, audio, projectileFactory),
  },
] as const;

export const BOSS_CATALOG: readonly BossCatalogEntry[] = [
  { bossArchetype: 1, viewer: { bossArchetype: 1, scale: 0.45, centering: 'bounds' }, viewerProjectileKeys: [ProjectileSourceKey.BOSS, ProjectileSourceKey.HOMING], preloadViewerModel: () => Promise.resolve() },
  { bossArchetype: 2, viewer: { bossArchetype: 2, scale: 0.45, centering: 'bounds' }, viewerProjectileKeys: [ProjectileSourceKey.BOSS, ProjectileSourceKey.HOMING, ProjectileSourceKey.BOSS_LASER], preloadViewerModel: () => Promise.resolve() },
  { bossArchetype: 3, viewer: { bossArchetype: 3, scale: 0.40, centering: 'bounds', viewerOffsetX: 0, offsetX: 0, offsetY: -10 }, viewerProjectileKeys: [ProjectileSourceKey.BOSS_LASER, ProjectileSourceKey.HOMING, ProjectileSourceKey.WAVE], preloadViewerModel: () => Boss3.preloadModel() },
  { bossArchetype: 4, viewer: { bossArchetype: 4, scale: 0.45, centering: 'bounds' }, viewerProjectileKeys: [ProjectileSourceKey.LAVA], preloadViewerModel: () => Promise.resolve() },
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
  const enemy = getEnemyCatalogEntry(type)?.spawn(params) ?? null;
  const mesh = (enemy as any)?._mesh;
  if (mesh instanceof THREE.Object3D) {
    markRenderCategory(mesh, RenderCategory.ENEMY, `enemy.${type}`);
  }
  return enemy;
}

export function getBossCatalogEntries(): BossCatalogEntry[] {
  return [...BOSS_CATALOG].sort((a, b) => a.bossArchetype - b.bossArchetype);
}

export function spawnCatalogBoss(bossArchetype: number, { scene, sprites, getPos, onDeath, audio, spawnEnemyCallback, projectileFactory, presentationContext }: SpawnBossParams) {
  const def = LEVELS[bossArchetype as keyof typeof LEVELS]!;
  const params: BossConstructorParams = {
    scene,
    sprites,
    getPlayerPos: getPos,
    onDeath,
    audio: audio ?? { play: () => {} },
    spawnEnemy: spawnEnemyCallback,
    projectileFactory,
    presentationContext,
  };
  return def.createBoss(params);
}
