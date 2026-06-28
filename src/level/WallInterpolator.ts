import { GAME_HEIGHT } from '../constants.ts';
import type { TerrainBounds } from '../types.ts';

export interface TerrainPoint {
  readonly at: number;
  readonly top: number;
  readonly bottom: number;
}

export function interpolateWalls(points: readonly TerrainPoint[], scrollX: number): TerrainBounds {
  if (!points || points.length === 0) {
    return { top: GAME_HEIGHT / 2, bottom: -GAME_HEIGHT / 2 };
  }
  const first = points[0]!;
  if (points.length < 2) {
    return { top: first.top, bottom: first.bottom };
  }
  const last = points[points.length - 1]!;
  if (scrollX <= first.at) return { top: first.top, bottom: first.bottom };
  if (scrollX >= last.at) return { top: last.top, bottom: last.bottom };

  let low = 0;
  let high = points.length - 2;
  let idx = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (scrollX >= points[mid]!.at && scrollX <= points[mid + 1]!.at) {
      idx = mid;
      break;
    } else if (scrollX < points[mid]!.at) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  const prev = points[idx]!;
  const cur = points[idx + 1]!;
  const t = (scrollX - prev.at) / (cur.at - prev.at);
  return {
    top: prev.top + (cur.top - prev.top) * t,
    bottom: prev.bottom + (cur.bottom - prev.bottom) * t,
  };
}
