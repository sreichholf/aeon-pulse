import { EnemyType } from '../../types.ts';
import type { CorridorResolver } from '../CorridorResolver.ts';
import { spawnEnemyEvent, type StageEvent, type WaveEntry } from '../StageEvents.ts';
import { Timeline, BeatType, type BeatPattern } from './Timeline.ts';
import { CORRIDOR_REFERENCE_HALF_HEIGHT } from './helpers.ts';

const REL_H = CORRIDOR_REFERENCE_HALF_HEIGHT;

// --- BEAT BUILDERS ---

/**
 * Dense Swarm matrix for the Developer's Hell stress test.
 * Public signature stays in absolute pixels for designer familiarity.
 */
export function swarmMatrixBeat(
  cols: number,
  rows: number,
  startX: number,
  dx: number,
  dy: number,
  yCenter: number,
): BeatPattern {
  return {
    name: BeatType.SWARM_CLUSTER,
    events: (resolver, at) => {
      const events: StageEvent[] = [];
      const yBaseRel = (yCenter - ((rows - 1) * dy) / 2) / REL_H;
      const dyRel = dy / REL_H;

      for (let col = 0; col < cols; col++) {
        for (let r = 0; r < rows; r++) {
          const x = startX + col * dx;
          const yRel = yBaseRel + r * dyRel;
          events.push(
            spawnEnemyEvent(
              EnemyType.SWARM,
              x,
              resolver.getSafeSpawnY(EnemyType.SWARM, at + x, yRel),
            ),
          );
        }
      }

      return events;
    },
  };
}

// --- LEVEL TIMELINES ---

function chapter0_1(): Timeline<'start'> {
  return new Timeline<'start'>(1.0)
    .anchor('start', 0)
    .add('start', 400, swarmMatrixBeat(32, 16, 1000, 60, 30, 0));
}

/**
 * Builds the Dev-only WaveEntry list for the Developer's Hell stress test level (0-1).
 * Spawns exactly 512 Swarm enemies in a 32x16 matrix grid at scrollX = 400.
 */
export function buildChapter0Waves(levelId: string, resolver: CorridorResolver): WaveEntry[] {
  if (levelId !== '0-1') return [];
  return chapter0_1().build(resolver);
}
