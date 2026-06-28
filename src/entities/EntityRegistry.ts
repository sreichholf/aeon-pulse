import { spawnCatalogBoss, spawnCatalogEnemy, type SpawnBossParams, type SpawnEnemyParams } from './EntityCatalog.ts';
import { EnemyType, type IEnemy, type IBoss } from '../types.ts';

/**
 * Spawns an enemy by its type.
 */
export function spawnEnemy(type: EnemyType, params: SpawnEnemyParams): IEnemy | null {
  return spawnCatalogEnemy(type, params);
}

/**
 * Spawns a boss based on the current boss archetype.
 */
export function spawnBoss(bossArchetype: number, params: SpawnBossParams): IBoss {
  return spawnCatalogBoss(bossArchetype, params);
}
