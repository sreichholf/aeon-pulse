import type { EnemyType, PropType } from '../types.ts';

export enum StageEventType {
  SPAWN_ENEMY = 'spawnEnemy',
  SPAWN_PROP = 'spawnProp',
  LAVA_PULSE = 'lavaPulse',
}

export interface SpawnEnemyStageEvent {
  kind: StageEventType.SPAWN_ENEMY;
  enemyType: EnemyType;
  x: number;
  y: number;
}

export interface SpawnPropStageEvent {
  kind: StageEventType.SPAWN_PROP;
  propType: PropType;
  x: number;
  y: number;
  /** Optional per-placement overrides (v2 solid prop content authoring). */
  isFullGate?: boolean;
  burstWindow?: number;
}

export interface LavaPulseStageEvent {
  kind: StageEventType.LAVA_PULSE;
}

export type StageEvent = SpawnEnemyStageEvent | SpawnPropStageEvent | LavaPulseStageEvent;

export interface WaveEntry {
  at: number;
  events: StageEvent[];
}

export function spawnEnemyEvent(enemyType: EnemyType, x: number, y: number): SpawnEnemyStageEvent {
  return { kind: StageEventType.SPAWN_ENEMY, enemyType, x, y };
}

export function spawnPropEvent(
  propType: PropType,
  x: number,
  y: number,
  isFullGate?: boolean,
  burstWindow?: number,
): SpawnPropStageEvent {
  return { kind: StageEventType.SPAWN_PROP, propType, x, y, isFullGate, burstWindow };
}

export function lavaPulseEvent(): LavaPulseStageEvent {
  return { kind: StageEventType.LAVA_PULSE };
}
