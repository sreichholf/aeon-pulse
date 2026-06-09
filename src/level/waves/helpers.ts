import { GAME_WIDTH } from '../../constants.ts';
import { EnemyType } from '../../types.ts';
import { spawnEnemyEvent, type SpawnEnemyStageEvent } from '../StageEvents.ts';

const HALF_W = GAME_WIDTH / 2;

export const SPAWN_X: number = HALF_W + 70;

interface Offset {
  dx: number;
  dy: number;
}

export function row(type: EnemyType, count: number, yCenter: number, ySpread: number): SpawnEnemyStageEvent[] {
  const step = count > 1 ? ySpread / (count - 1) : 0;
  const xSpacing = type === EnemyType.STRAIGHT ? 75 : 44;
  return Array.from({ length: count }, (_, i) =>
    spawnEnemyEvent(type, SPAWN_X + i * xSpacing, yCenter - ySpread / 2 + step * i)
  );
}

export function vForm(type: EnemyType, count: number, yStep: number = 72): SpawnEnemyStageEvent[] {
  const xSpacing = type === EnemyType.STRAIGHT ? 80 : 52;
  return Array.from({ length: count }, (_, i) => {
    const mid = Math.floor(count / 2), dist = Math.abs(i - mid);
    return spawnEnemyEvent(type, SPAWN_X + dist * xSpacing, (i - mid) * yStep);
  });
}

export function cluster(type: EnemyType, offsets: Offset[], cx: number, cy: number): SpawnEnemyStageEvent[] {
  return offsets.map(({ dx, dy }) => spawnEnemyEvent(type, SPAWN_X + dx + cx, cy + dy));
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
