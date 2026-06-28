import { GAME_WIDTH } from '../../constants.ts';
import { EnemyType } from '../../types.ts';
import type { CorridorResolver } from '../CorridorResolver.ts';
import { spawnEnemyEvent, type SpawnEnemyStageEvent } from '../StageEvents.ts';

const HALF_W = GAME_WIDTH / 2;

export const SPAWN_X: number = HALF_W + 70;

/** Reference half-height for the open-corridor space used by relative spawn helpers. */
export const CORRIDOR_REFERENCE_HALF_HEIGHT = 200;
const CORRIDOR_REFERENCE_HEIGHT = CORRIDOR_REFERENCE_HALF_HEIGHT * 2;

interface Offset {
  dx: number;
  dy: number;
}

// ── Corridor-relative spawn helpers (Safe Corridor Spawn Coordinates, -1..1) ─

export function rowRel(
  resolver: CorridorResolver,
  type: EnemyType,
  at: number,
  count: number,
  yCenterRel: number,
  ySpreadRel: number,
): SpawnEnemyStageEvent[] {
  const xSpacing = type === EnemyType.STRAIGHT ? 88 : 44;
  if (count <= 1) {
    return [spawnEnemyEvent(type, SPAWN_X, resolver.getSafeSpawnY(type, at + SPAWN_X, yCenterRel))];
  }
  const stepRel = (2 * ySpreadRel) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const coord = yCenterRel - ySpreadRel + stepRel * i;
    return spawnEnemyEvent(type, SPAWN_X + i * xSpacing, resolver.getSafeSpawnY(type, at + SPAWN_X + i * xSpacing, coord));
  });
}

export function vFormRel(
  resolver: CorridorResolver,
  type: EnemyType,
  at: number,
  count: number,
  yStepRel: number = 72 / CORRIDOR_REFERENCE_HEIGHT,
): SpawnEnemyStageEvent[] {
  const xSpacing = type === EnemyType.STRAIGHT ? 92 : 52;
  const relStep = yStepRel * 2;
  return Array.from({ length: count }, (_, i) => {
    const mid = Math.floor(count / 2);
    const coord = (i - mid) * relStep;
    return spawnEnemyEvent(type, SPAWN_X + Math.abs(i - mid) * xSpacing, resolver.getSafeSpawnY(type, at + SPAWN_X + Math.abs(i - mid) * xSpacing, coord));
  });
}

export interface RelativeOffset {
  dx: number;
  dy: number;
}

export function clusterRel(
  resolver: CorridorResolver,
  type: EnemyType,
  at: number,
  offsets: RelativeOffset[],
  cxRel: number,
  cyRel: number,
): SpawnEnemyStageEvent[] {
  const cx = cxRel * CORRIDOR_REFERENCE_HALF_HEIGHT;
  return offsets.map(({ dx, dy }) =>
    spawnEnemyEvent(type, SPAWN_X + dx + cx, resolver.getSafeSpawnY(type, at + SPAWN_X + dx + cx, cyRel + dy))
  );
}

export const SWARM_SM: Offset[] = [
  { dx:   0, dy:   0 }, { dx:  55, dy: -65 }, { dx:  55, dy:  65 },
  { dx: 110, dy: -120}, { dx: 110, dy:   0 }, { dx: 110, dy: 120 },
  { dx: 165, dy: -60 }, { dx: 165, dy:  60 },
];

export const SWARM_LG: Offset[] = [
  { dx:   0, dy:   0 }, { dx:  50, dy: -85 }, { dx:  50, dy:  85 },
  { dx: 100, dy:-145 }, { dx: 100, dy: -45 }, { dx: 100, dy:  55 }, { dx: 100, dy: 155 },
  { dx: 150, dy: -80 }, { dx: 150, dy:  40 }, { dx: 200, dy:   0 },
];
