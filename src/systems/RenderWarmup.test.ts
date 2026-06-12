import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { spawnEnemy } from '../entities/EntityRegistry.ts';
import { EnemyType } from '../types.ts';
import { STANDARD_ENEMY_WARMUP_TYPES, withStandardEnemyRenderWarmup } from './RenderWarmup.ts';

vi.mock('../entities/EntityRegistry.ts', () => ({
  spawnEnemy: vi.fn(),
}));

describe('withStandardEnemyRenderWarmup', () => {
  it('spawns the standard warmup enemy set, runs the callback, and destroys all spawned enemies', async () => {
    const destroy = vi.fn();
    const warmupCallback = vi.fn();

    vi.mocked(spawnEnemy).mockImplementation((type) => ({
      isBoss: false,
      isAlive: true,
      isOffscreen: false,
      isSpaceShip: true,
      score: 0,
      metadata: { displayName: type, hp: 1, score: 0, isBoss: false },
      terrainBounds: null,
      x: 0,
      y: 0,
      hw: 1,
      hh: 1,
      update: () => [],
      hit: () => null,
      destroy,
    }));

    const result = await withStandardEnemyRenderWarmup(
      {
        camera: new THREE.Camera(),
        add: vi.fn(),
        remove: vi.fn(),
        flash: vi.fn(),
      },
      {},
      null,
      warmupCallback,
    );

    expect(spawnEnemy).toHaveBeenCalledTimes(STANDARD_ENEMY_WARMUP_TYPES.length);
    expect(warmupCallback).toHaveBeenCalledTimes(1);
    expect(STANDARD_ENEMY_WARMUP_TYPES).toEqual([
      EnemyType.STRAIGHT,
      EnemyType.SINE,
      EnemyType.DIVER,
      EnemyType.SWARM,
      EnemyType.TURRET,
      EnemyType.CHARGER,
      EnemyType.ROCK_DRAKE,
      EnemyType.STALACTITE,
    ]);
    expect(result.spawnedCount).toBe(STANDARD_ENEMY_WARMUP_TYPES.length);
    expect(result.warmedEnemyTypes).toEqual(STANDARD_ENEMY_WARMUP_TYPES);
    expect(destroy).toHaveBeenCalledTimes(STANDARD_ENEMY_WARMUP_TYPES.length);
  });
});
