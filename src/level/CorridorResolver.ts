import { GAME_HEIGHT } from '../constants.ts';
import { getEnemyCatalogEntry } from '../entities/EntityCatalog.ts';
import { EnemyType } from '../types.ts';
import { interpolateWalls, type TerrainPoint } from './WallInterpolator.ts';
import type { ResolvedLevelContent } from './ResolvedLevelContent.ts';

/**
 * Minimal subset of ResolvedLevelContent that the corridor resolver reads.
 * Keeping this narrow avoids forcing callers to stub unrelated factories.
 */
export type CorridorResolverInput = Pick<
  ResolvedLevelContent,
  'terrainPoints' | 'playfieldMargins' | 'playfieldBounds' | 'terrainPointScale'
>;

export interface CorridorResolver {
  /** Return the safe corridor top/bottom at a given scroll position. */
  getBoundsAt(scrollX: number): { top: number; bottom: number };
  /** Map a normalized Safe Corridor Spawn Coordinate (-1..1) to a screen Y. */
  getSafeSpawnY(enemyType: EnemyType, scrollX: number, coord: number): number;
}

function composePlayfieldBounds(
  base: { top: number; bottom: number } | null,
  margins: { top: number; bottom: number } | null,
): { top: number; bottom: number } {
  if (!base) {
    const half = GAME_HEIGHT / 2;
    return { top: half, bottom: -half };
  }

  if (!margins) {
    return { top: base.top, bottom: base.bottom };
  }

  return {
    top: base.top - margins.top,
    bottom: base.bottom + margins.bottom,
  };
}

export function createCorridorResolver(resolvedContent: CorridorResolverInput): CorridorResolver {
  const scale = resolvedContent.terrainPointScale ?? 1;
  const points: TerrainPoint[] = resolvedContent.terrainPoints.map((pt) => ({
    at: pt.at * scale,
    top: pt.top,
    bottom: pt.bottom,
  }));
  const margins = resolvedContent.playfieldMargins;
  const baseBounds = resolvedContent.playfieldBounds;

  return {
    getBoundsAt(scrollX: number): { top: number; bottom: number } {
      const walls = points.length > 0 ? interpolateWalls(points, scrollX) : baseBounds;
      return composePlayfieldBounds(walls, margins);
    },

    getSafeSpawnY(enemyType: EnemyType, scrollX: number, coord: number): number {
      const bounds = this.getBoundsAt(scrollX);
      const entry = getEnemyCatalogEntry(enemyType);
      const envelope = entry?.movementEnvelope ?? 0;

      const usableTop = bounds.top - envelope;
      const usableBottom = bounds.bottom + envelope;
      const usableHeight = usableTop - usableBottom;

      if (usableHeight <= 0) {
        return 0;
      }

      return coord * (usableHeight / 2);
    },
  };
}
