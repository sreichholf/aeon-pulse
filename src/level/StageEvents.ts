import type { EnemyType } from '../types.ts';

export enum StageEventType {
  SPAWN_ENEMY = 'spawnEnemy',
  LAVA_PULSE = 'lavaPulse',
}

export interface SpawnEnemyStageEvent {
  kind: StageEventType.SPAWN_ENEMY;
  enemyType: EnemyType;
  x: number;
  y: number;
}

export interface LavaPulseStageEvent {
  kind: StageEventType.LAVA_PULSE;
}

export type StageEvent = SpawnEnemyStageEvent | LavaPulseStageEvent;

export interface WaveEntry {
  at: number;
  events: StageEvent[];
}

export function spawnEnemyEvent(enemyType: EnemyType, x: number, y: number): SpawnEnemyStageEvent {
  return { kind: StageEventType.SPAWN_ENEMY, enemyType, x, y };
}

export function lavaPulseEvent(): LavaPulseStageEvent {
  return { kind: StageEventType.LAVA_PULSE };
}
