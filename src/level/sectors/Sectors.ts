import type { ChapterKey } from '../../campaign/Campaign.ts';
import type { PropType } from '../../types.ts';
import type { TerrainPoint } from '../WallInterpolator.ts';
import { CHAPTER_1_SECTORS } from './chapter1.ts';
import { CHAPTER_2_SECTORS } from './chapter2.ts';
import { CHAPTER_3_SECTORS } from './chapter3.ts';
import { CHAPTER_4_SECTORS } from './chapter4.ts';

/**
 * One authored prop placement in a Sector's scroll-anchored layout.
 * `at` is an absolute scroll position (same convention as WaveEntry);
 * LevelManager emits a SPAWN_PROP event when scrollX reaches it.
 * `x`,`y` is the initial playfield position; the prop then scrolls left.
 */
export interface PropSpawnEntry {
  at: number;
  propType: PropType;
  x: number;
  y: number;
  /** v2: override fullGate flag for this solid prop placement. */
  isFullGate?: boolean;
  /** v2: override Timed Burst window for this placement. */
  burstWindow?: number;
}

export type SectorTerrainPoint = TerrainPoint;

/**
 * Chapter-local background/terrain variation config for a Sector.
 * Populated per chapter in Milestone 1+ (procedural landmark geometry, tint
 * palettes, element-set selection, terrain control points).
 */
export interface SectorBackgroundConfig {
  readonly sectorKey: string;
  [key: string]: unknown;
}

export interface SectorDefinition {
  readonly sectorKey: string;
  readonly backgroundConfig?: SectorBackgroundConfig;
  readonly terrainPoints?: readonly SectorTerrainPoint[];
  /** Optional corridor margin override for this Sector. Positive values narrow the corridor. */
  readonly playfieldMargins?: { top: number; bottom: number };
  readonly propLayout: readonly PropSpawnEntry[];
}

const DEFAULT_SECTOR: SectorDefinition = { sectorKey: '__default', propLayout: [] };

/**
 * Resolves the SectorDefinition for a level's (chapter, sector).
 *
 * Chapter palettes are filled in per milestone; unmapped chapters/sectors fall
 * back to an empty DEFAULT_SECTOR (no props, no background variation).
 *   - Milestone 1: Chapter 1 (Megastructure) -> `chapter1.ts`
 *   - Milestone 2: Chapter 2 (Industrial) -> `chapter2.ts`
 *   - Milestone 3: Chapter 3 (Hive) -> `chapter3.ts`
 *   - Milestone 4: Chapter 4 (Volcanic) -> `chapter4.ts`
 */
export function getSectorDefinition(chapterKey: ChapterKey, sector: string): SectorDefinition {
  switch (chapterKey) {
    case 'Megastructure':
      return CHAPTER_1_SECTORS[sector] ?? DEFAULT_SECTOR;
    case 'Industrial':
      return CHAPTER_2_SECTORS[sector] ?? DEFAULT_SECTOR;
    case 'Hive':
      return CHAPTER_3_SECTORS[sector] ?? DEFAULT_SECTOR;
    case 'Volcanic':
      return CHAPTER_4_SECTORS[sector] ?? DEFAULT_SECTOR;
    default:
      void sector;
      return DEFAULT_SECTOR;
  }
}
