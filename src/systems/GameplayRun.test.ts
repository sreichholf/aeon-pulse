import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameplayRun } from './GameplayRun.ts';
import { EnemyType, ITerrain } from '../types.ts';

function createScene() {
  return {
    camera: new THREE.Camera(),
    add: vi.fn(),
    remove: vi.fn(),
    flash: vi.fn(),
  };
}

describe('GameplayRun', () => {
  it('clamps spawned enemy Y positions to stay within active terrain walls', () => {
    const mockScene = createScene();
    const mockAudio = {
      play: vi.fn(),
    };
    const mockDeps = {
      scene: mockScene as any,
      sprites: {},
      input: {} as any,
      audio: mockAudio as any,
      score: {} as any,
      onLevelComplete: vi.fn(),
    };

    const run = new GameplayRun(mockDeps);

    // Setup active terrain and level manager mocks
    const mockTerrain = {
      getActualWallsAt: vi.fn().mockReturnValue({ top: 100, bottom: -100 }),
    } as unknown as ITerrain;

    const mockLevelManager = {
      scrollX: 200,
    } as any;

    run['_terrain'] = mockTerrain;
    run['_levelManager'] = mockLevelManager;

    // 1. Spawn EnemyStraight (hh = 34) at Y = 150 (outside top wall)
    run.spawnEnemy(EnemyType.STRAIGHT, 550, 150);
    const enemy1 = run['_enemies'][0];
    expect(enemy1).toBeDefined();
    // Clamped top should be: top (100) - hh (34) = 66
    expect(enemy1!.y).toBe(66);

    // 2. Spawn EnemySine (hh = 17) at Y = -180 (outside bottom wall)
    run.spawnEnemy(EnemyType.SINE, 550, -180);
    const enemy2 = run['_enemies'][1];
    expect(enemy2).toBeDefined();
    // Clamped bottom should be: bottom (-100) + hh (17) = -83
    expect(enemy2!.y).toBe(-83);
  });
});
