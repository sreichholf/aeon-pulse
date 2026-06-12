import * as THREE from 'three';
import { spawnEnemy } from '../entities/EntityRegistry.ts';
import { EnemyType, type GetPositionFn, type IAudio, type IEnemy, type IScene, type ProjectileFactoryFn } from '../types.ts';

const NO_OP_AUDIO: IAudio = {
  play: () => {},
};

const NO_OP_PROJECTILE_FACTORY: ProjectileFactoryFn = () => null as never;
const NO_OP_GET_POSITION: GetPositionFn = () => ({ x: 0, y: 0 });

export const STANDARD_ENEMY_WARMUP_TYPES: readonly EnemyType[] = [
  EnemyType.STRAIGHT,
  EnemyType.SINE,
  EnemyType.DIVER,
  EnemyType.SWARM,
  EnemyType.TURRET,
  EnemyType.CHARGER,
  EnemyType.ROCK_DRAKE,
  EnemyType.STALACTITE,
] as const;

const WARMUP_LAYOUT: ReadonlyArray<{ x: number; y: number }> = [
  { x: -280, y: 110 },
  { x: -120, y: 110 },
  { x: 40, y: 110 },
  { x: 200, y: 110 },
  { x: -280, y: -30 },
  { x: -120, y: -30 },
  { x: 40, y: -30 },
  { x: 200, y: -30 },
];

export interface RenderWarmupResult {
  durationMs: number;
  spawnedCount: number;
  warmedEnemyTypes: EnemyType[];
}

export async function withStandardEnemyRenderWarmup(
  scene: IScene,
  sprites: Record<string, THREE.Texture>,
  warmup: () => Promise<void> | void,
): Promise<RenderWarmupResult> {
  const startedAt = performance.now();
  const spawnedEnemies: IEnemy[] = [];
  const warmedEnemyTypes: EnemyType[] = [];

  try {
    for (const [index, enemyType] of STANDARD_ENEMY_WARMUP_TYPES.entries()) {
      const layout = WARMUP_LAYOUT[index] ?? WARMUP_LAYOUT.at(-1)!;
      const enemy = spawnEnemy(enemyType, {
        scene,
        sprites,
        x: layout.x,
        y: layout.y,
        getPos: NO_OP_GET_POSITION,
        audio: NO_OP_AUDIO,
        getScrollX: () => 0,
        terrain: null,
        projectileFactory: NO_OP_PROJECTILE_FACTORY,
      });

      if (!enemy) continue;
      spawnedEnemies.push(enemy);
      warmedEnemyTypes.push(enemyType);
    }

    await warmup();

    return {
      durationMs: performance.now() - startedAt,
      spawnedCount: spawnedEnemies.length,
      warmedEnemyTypes,
    };
  } finally {
    for (const enemy of spawnedEnemies) {
      enemy.destroy();
    }
  }
}
