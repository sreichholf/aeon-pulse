import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameplayRun } from './GameplayRun.ts';
import { CampaignAttempt } from '../campaign/CampaignAttempt.ts';
import { getCampaignLevel } from '../campaign/Campaign.ts';
import { CHAPTER_1_PLAYFIELD_BOUNDS } from '../level/PlayfieldBounds.ts';
import { DifficultyMode, EnemyType, ITerrain } from '../types.ts';

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
      getCollisionWallsAt: vi.fn().mockReturnValue({ top: 100, bottom: -100 }),
    } as unknown as ITerrain;

    const mockLevelManager = {
      scrollX: 200,
    } as any;

    run['_terrain'] = mockTerrain;
    run['_levelManager'] = mockLevelManager;

    // 1. Spawn EnemyStraight (hh = 16) at Y = 150 (outside top wall)
    run.spawnEnemy(EnemyType.STRAIGHT, 550, 150);
    const enemy1 = run['_enemies'][0];
    expect(enemy1).toBeDefined();
    // Clamped top should be: top (100) - hh (16) = 84
    expect(enemy1!.y).toBe(84);

    // 2. Spawn EnemySine (hh = 17) at Y = -180 (outside bottom wall)
    run.spawnEnemy(EnemyType.SINE, 550, -180);
    const enemy2 = run['_enemies'][1];
    expect(enemy2).toBeDefined();
    // Clamped bottom should be: bottom (-100) + hh (17) = -83
    expect(enemy2!.y).toBe(-83);
  });

  it('does not corridor-clamp non-space enemies that author their own terrain placement', () => {
    const mockScene = createScene();
    const mockDeps = {
      scene: mockScene as any,
      sprites: {},
      input: {} as any,
      audio: { play: vi.fn() } as any,
      score: {} as any,
      onLevelComplete: vi.fn(),
    };

    const run = new GameplayRun(mockDeps);
    const mockTerrain = {
      getCollisionWallsAt: vi.fn().mockReturnValue({ top: 100, bottom: -100 }),
      getWallsAt: vi.fn().mockReturnValue({ top: 100, bottom: -100 }),
    } as unknown as ITerrain;

    run['_terrain'] = mockTerrain;
    run['_levelManager'] = { scrollX: 0 } as any;

    run.spawnEnemy(EnemyType.STALACTITE, 550, 310);

    const enemy = run['_enemies'][0];
    expect(enemy).toBeDefined();
    expect(enemy!.isSpaceShip).toBe(false);
    expect(enemy!.y).toBe(100);
  });

  it('destroys completed effects during the level-exit tick', () => {
    const mockScene = createScene();
    const mockDeps = {
      scene: mockScene as any,
      sprites: {},
      input: {} as any,
      audio: { play: vi.fn() } as any,
      score: {} as any,
      onLevelComplete: vi.fn(),
    };

    const run = new GameplayRun(mockDeps);
    const completedEffect = {
      update: vi.fn(),
      isDone: true,
      destroy: vi.fn(),
    };

    run['background'] = { update: vi.fn(), destroy: vi.fn(), baseSpeed: 100 } as any;
    run['_player'] = {
      update: vi.fn(),
      isExitComplete: false,
    } as any;
    run['_effects'] = [completedEffect as any];
    run['_bullets'] = [];
    run['_isExitingLevel'] = true;

    run.tick(0.1);

    expect(completedEffect.update).toHaveBeenCalledWith(0.1);
    expect(completedEffect.destroy).toHaveBeenCalledOnce();
    expect(run['_effects']).toEqual([]);
  });

  it('starts a Chapter 4 run with sector terrain points', () => {
    const mockScene = createScene();
    const mockDeps = {
      scene: mockScene as any,
      sprites: {},
      input: {
        isDown: vi.fn().mockReturnValue(false),
        wasJustPressed: vi.fn().mockReturnValue(false),
      } as any,
      audio: {
        play: vi.fn(),
        startChargeHum: vi.fn(),
        stopChargeHum: vi.fn(),
      } as any,
      score: {} as any,
      onLevelComplete: vi.fn(),
    };

    const run = new GameplayRun(mockDeps);
    const attempt = new CampaignAttempt(getCampaignLevel('4-1'));

    expect(() => run.start(attempt, DifficultyMode.ACE)).not.toThrow();
    expect(run['background']).toBeTruthy();
    expect(run['_terrain']).toBeTruthy();

    run.clear();
  });

  it('composes sector playfield margins with chapter playfield bounds', () => {
    const mockDeps = {
      scene: createScene() as any,
      sprites: {},
      input: {} as any,
      audio: { play: vi.fn() } as any,
      score: {} as any,
      onLevelComplete: vi.fn(),
    };

    const run = new GameplayRun(mockDeps);

    expect(run['_composePlayfieldBounds'](CHAPTER_1_PLAYFIELD_BOUNDS, { top: 30, bottom: 20 })).toEqual({
      top: CHAPTER_1_PLAYFIELD_BOUNDS.top - 30,
      bottom: CHAPTER_1_PLAYFIELD_BOUNDS.bottom + 20,
    });

    expect(run['_composePlayfieldBounds'](CHAPTER_1_PLAYFIELD_BOUNDS, null)).toBe(CHAPTER_1_PLAYFIELD_BOUNDS);
    expect(run['_composePlayfieldBounds'](null, { top: 10, bottom: 10 })).toBeNull();
  });

  it('avoids spawning enemies inside alive solid props', () => {
    const mockScene = createScene();
    const mockDeps = {
      scene: mockScene as any,
      sprites: {},
      input: {} as any,
      audio: { play: vi.fn() } as any,
      score: {} as any,
      onLevelComplete: vi.fn(),
    };

    const run = new GameplayRun(mockDeps);
    run['_playfieldBounds'] = CHAPTER_1_PLAYFIELD_BOUNDS;

    const solidProp = {
      isAlive: true,
      isSolid: true,
      x: 400,
      y: 0,
      hw: 30,
      hh: 30,
      getSolidBounds: () => ({ shape: 'box' as const, x: 400, y: 0, hw: 30, hh: 30 }),
    } as any;
    run['_props'].push(solidProp);

    run.spawnEnemy(EnemyType.STRAIGHT, 400, 0);
    const enemy = run['_enemies'][0];
    expect(enemy).toBeDefined();
    expect(Math.abs(enemy!.y)).toBeGreaterThanOrEqual(30 + enemy!.hh);
  });

  it('logs an error when a solid prop overlaps the corridor walls during spawn', () => {
    const mockScene = createScene();
    const mockDeps = {
      scene: mockScene as any,
      sprites: {},
      input: {} as any,
      audio: { play: vi.fn() } as any,
      score: {} as any,
      onLevelComplete: vi.fn(),
    };

    const run = new GameplayRun(mockDeps);
    run['_playfieldBounds'] = CHAPTER_1_PLAYFIELD_BOUNDS;

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const solidProp = {
      isSolid: true,
      isFullGate: false,
      propType: 'testSolid',
      x: 0,
      y: 0,
      hw: 10,
      hh: CHAPTER_1_PLAYFIELD_BOUNDS.top + 10,
      getSolidBounds: () => ({
        shape: 'box' as const,
        x: 0,
        y: 0,
        hw: 10,
        hh: CHAPTER_1_PLAYFIELD_BOUNDS.top + 10,
      }),
    } as any;

    run['_validateSolidPropSpawn'](solidProp);

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
