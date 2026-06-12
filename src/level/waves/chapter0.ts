import { EnemyType } from '../../types.ts';
import { spawnEnemyEvent } from '../StageEvents.ts';
import type { WaveEntry, StageEvent } from '../StageEvents.ts';

/**
 * Builds the Dev-only WaveEntry list for the Developer's Hell stress test level (0-1).
 * Spawns exactly 512 Swarm enemies in a 32x16 matrix grid at scrollX = 400.
 */
export function buildChapter0Waves(levelId: string): WaveEntry[] {
  if (levelId !== '0-1') return [];

  const events: StageEvent[] = [];
  
  const startX = 500;
  const cols = 32;
  const rows = 16;
  const dx = 25;
  const dy = 20;

  for (let col = 0; col < cols; col++) {
    for (let r = 0; r < rows; r++) {
      const x = startX + col * dx;
      const y = -150 + r * dy;
      
      events.push(spawnEnemyEvent(EnemyType.SWARM, x, y));
    }
  }

  return [
    {
      at: 400,
      events,
    }
  ];
}
