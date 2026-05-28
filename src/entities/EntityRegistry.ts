import { spawnCatalogBoss, spawnCatalogEnemy, type SpawnBossParams, type SpawnEnemyParams } from './EntityCatalog.ts';
import { EnemyType, type IEnemy, type IBoss } from '../types.ts';

/**
 * Spawns an enemy by its type.
 */
export function spawnEnemy(type: EnemyType, { scene, sprites, x, y, getPos, audio, getScrollX, terrain }: SpawnEnemyParams): IEnemy | null {
  return spawnCatalogEnemy(type, { scene, sprites, x, y, getPos, audio, getScrollX, terrain });
}

/**
 * Spawns a boss based on the current level archetype.
 */
export function spawnBoss(levelArchetype: number, { scene, sprites, getPos, onDeath, audio, spawnEnemyCallback }: SpawnBossParams): IBoss {
  return spawnCatalogBoss(levelArchetype, { scene, sprites, getPos, onDeath, audio, spawnEnemyCallback });
}
