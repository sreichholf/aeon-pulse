import type { CampaignLevelRecord } from '../campaign/Campaign.ts';
import type {
  BossConstructorParams,
  IBackgroundWithSpeed,
  IBoss,
  IScene,
  ITerrain,
  PlayfieldBounds,
} from '../types.ts';
import { LEVELS } from './Levels.ts';
import { createCorridorResolver, type CorridorResolverInput } from './CorridorResolver.ts';
import { getSectorDefinition, type PropSpawnEntry, type SectorBackgroundConfig, type SectorTerrainPoint } from './sectors/Sectors.ts';
import type { WaveEntry } from './StageEvents.ts';

export interface ResolvedLevelContent {
  readonly level: CampaignLevelRecord;
  readonly scrollSpeed: number;
  readonly bossAt: number;
  readonly waves: readonly WaveEntry[];
  readonly propLayout: readonly PropSpawnEntry[];
  readonly terrainPoints: readonly SectorTerrainPoint[];
  readonly playfieldMargins: { top: number; bottom: number } | null;
  readonly playfieldBounds: PlayfieldBounds | null;
  readonly terrainPointScale: number;
  readonly backgroundConfig?: SectorBackgroundConfig;
  createBackground(scene: IScene): IBackgroundWithSpeed;
  createTerrain(scene: IScene): ITerrain | null;
  createBoss(params: BossConstructorParams): IBoss;
}

export function resolveLevelContent(level: CampaignLevelRecord): ResolvedLevelContent {
  const levelDef = LEVELS[level.archetype]!;
  const sectorDef = getSectorDefinition(level.chapterKey, level.sector);
  const terrainPoints = sectorDef.terrainPoints ?? levelDef.terrainPoints;
  const playfieldMargins = sectorDef.playfieldMargins ?? null;
  const playfieldBounds = levelDef.playfieldBounds;
  const terrainPointScale = levelDef.terrainPointScale;

  // Build the resolver from the narrow corridor facts it actually reads. Passing only
  // these fields (instead of stubbing unrelated factories) keeps the dependency explicit
  // and avoids `as unknown as` casts that would hide future missing fields.
  const resolver = createCorridorResolver({
    terrainPoints,
    playfieldMargins,
    playfieldBounds,
    terrainPointScale,
  } satisfies CorridorResolverInput);

  return {
    level,
    scrollSpeed: levelDef.scrollSpeed,
    bossAt: levelDef.bossAt,
    waves: levelDef.buildWaves(level, resolver),
    propLayout: sectorDef.propLayout,
    terrainPoints,
    playfieldMargins,
    playfieldBounds,
    terrainPointScale,
    backgroundConfig: sectorDef.backgroundConfig,
    createBackground: (scene) => levelDef.createBackground(scene, sectorDef.backgroundConfig),
    createTerrain: (scene) => levelDef.createTerrain?.(scene, [...terrainPoints]) ?? null,
    createBoss: (params) => levelDef.createBoss(params),
  };
}
