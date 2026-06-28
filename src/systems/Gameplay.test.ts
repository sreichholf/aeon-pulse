import { describe, expect, it, vi } from 'vitest';
import { tickGameplay, WorldState } from './Gameplay.ts';
import type {
  IPlayer,
  IEnemy,
  IBoss,
  IBullet,
  IPowerUp,
  IEffect,
  IBackgroundWithSpeed,
  ITerrain,
  ILevelManager
} from '../types.ts';

describe('tickGameplay', () => {
  it('updates the background and levelManager if present', () => {
    const background = { update: vi.fn(), destroy: vi.fn(), baseSpeed: 100 } as unknown as IBackgroundWithSpeed;
    const levelManager = { update: vi.fn(), scrollX: 200 } as unknown as ILevelManager;

    const world: WorldState = {
      background,
      terrain: null,
      levelManager,
      player: null,
      enemies: [],
      boss: null,
      bullets: [],
      powerups: [],
      effects: [],
      props: [],
    };

    tickGameplay(world, 0.1);

    expect(background.update).toHaveBeenCalledWith(0.1);
    expect(levelManager.update).toHaveBeenCalledWith(0.1);
  });

  it('updates terrain and assigns terrainBounds to the player and spaceship enemies', () => {
    const levelManager = { update: vi.fn(), scrollX: 100 } as unknown as ILevelManager;
    
    // Test case 1: terrain has getCollisionWallsAt
    const terrainWithActual = {
      update: vi.fn(),
      getCollisionWallsAt: vi.fn().mockReturnValue({ top: 150, bottom: -150 }),
      getWallsAt: vi.fn(),
    } as unknown as ITerrain;

    const player = { x: 50, terrainBounds: null, update: vi.fn().mockReturnValue([]) } as unknown as IPlayer;
    const enemySpaceShip = { x: 80, isSpaceShip: true, terrainBounds: null, update: vi.fn().mockReturnValue([]), isAlive: true, isOffscreen: false, destroy: vi.fn() } as unknown as IEnemy;
    const enemyNonSpaceShip = { x: 90, isSpaceShip: false, terrainBounds: null, update: vi.fn().mockReturnValue([]), isAlive: true, isOffscreen: false, destroy: vi.fn() } as unknown as IEnemy;

    const world1: WorldState = {
      background: null,
      terrain: terrainWithActual,
      levelManager,
      player,
      enemies: [enemySpaceShip, enemyNonSpaceShip],
      boss: null,
      bullets: [],
      powerups: [],
      effects: [],
      props: [],
    };

    tickGameplay(world1, 0.1);

    expect(terrainWithActual.update).toHaveBeenCalledWith(100, 0.1);
    // Player world X is scrollX (100) + player.x (50) = 150
    expect(terrainWithActual.getCollisionWallsAt).toHaveBeenCalledWith(150);
    expect(player.terrainBounds).toEqual({ top: 150, bottom: -150 });

    // Spaceship enemy world X is 100 + 80 = 180
    expect(terrainWithActual.getCollisionWallsAt).toHaveBeenCalledWith(180);
    expect(enemySpaceShip.terrainBounds).toEqual({ top: 150, bottom: -150 });

    // Non-spaceship enemy terrain bounds should remain null
    expect(enemyNonSpaceShip.terrainBounds).toBeNull();

    // Test case 2: verify getCollisionWallsAt is called for all terrain implementations
    const terrainClassic = {
      update: vi.fn(),
      getCollisionWallsAt: vi.fn().mockReturnValue({ top: 120, bottom: -120 }),
      getWallsAt: vi.fn(),
    } as unknown as ITerrain;

    const world2: WorldState = {
      background: null,
      terrain: terrainClassic,
      levelManager,
      player,
      enemies: [enemySpaceShip],
      boss: null,
      bullets: [],
      powerups: [],
      effects: [],
      props: [],
    };

    tickGameplay(world2, 0.1);
    expect(terrainClassic.getCollisionWallsAt).toHaveBeenCalledWith(150); // Player
    expect(terrainClassic.getCollisionWallsAt).toHaveBeenCalledWith(180); // Spaceship enemy
    expect(player.terrainBounds).toEqual({ top: 120, bottom: -120 });
  });

  it('collects newly spawned bullets from player, enemies, and boss updates', () => {
    const playerBullet = { update: vi.fn(), active: true, isOffscreen: false, destroy: vi.fn() } as unknown as IBullet;
    const player = { x: 0, update: vi.fn().mockReturnValue([playerBullet]) } as unknown as IPlayer;

    const enemyBullet = { update: vi.fn(), active: true, isOffscreen: false, destroy: vi.fn() } as unknown as IBullet;
    const enemy = { x: 0, isSpaceShip: false, update: vi.fn().mockReturnValue([enemyBullet]), isAlive: true, isOffscreen: false } as unknown as IEnemy;

    const bossBullet = { update: vi.fn(), active: true, isOffscreen: false, destroy: vi.fn() } as unknown as IBullet;
    const boss = { update: vi.fn().mockReturnValue([bossBullet]) } as unknown as IBoss;

    const world: WorldState = {
      background: null,
      terrain: null,
      levelManager: null,
      player,
      enemies: [enemy],
      boss,
      bullets: [],
      powerups: [],
      effects: [],
      props: [],
    };

    tickGameplay(world, 0.1);

    expect(player.update).toHaveBeenCalledWith(0.1);
    expect(enemy.update).toHaveBeenCalledWith(0.1);
    expect(boss.update).toHaveBeenCalledWith(0.1);

    // Bullets spawned should be collected and kept in world.bullets (along with their updates)
    expect(world.bullets).toContain(playerBullet);
    expect(world.bullets).toContain(enemyBullet);
    expect(world.bullets).toContain(bossBullet);
  });

  it('updates bullets and prunes offscreen or inactive bullets', () => {
    const activeBullet = { update: vi.fn(), isOffscreen: false, active: true, destroy: vi.fn() } as unknown as IBullet;
    const offscreenBullet = { update: vi.fn(), isOffscreen: true, active: true, destroy: vi.fn() } as unknown as IBullet;
    const inactiveBullet = { update: vi.fn(), isOffscreen: false, active: false, destroy: vi.fn() } as unknown as IBullet;

    const world: WorldState = {
      background: null,
      terrain: null,
      levelManager: null,
      player: null,
      enemies: [],
      boss: null,
      bullets: [activeBullet, offscreenBullet, inactiveBullet],
      powerups: [],
      effects: [],
      props: [],
    };

    // Test case 1: destroyOrReleaseBullet not provided (falls back to destroy)
    tickGameplay(world, 0.1);

    expect(activeBullet.update).toHaveBeenCalledWith(0.1);
    expect(offscreenBullet.update).toHaveBeenCalledWith(0.1);
    expect(inactiveBullet.update).toHaveBeenCalledWith(0.1);

    expect(offscreenBullet.destroy).toHaveBeenCalled();
    expect(inactiveBullet.destroy).toHaveBeenCalled();
    expect(world.bullets).toEqual([activeBullet]);

    // Test case 2: destroyOrReleaseBullet is provided
    const destroyOrReleaseBullet = vi.fn();
    const newOffscreenBullet = { update: vi.fn(), isOffscreen: true, active: true, destroy: vi.fn() } as unknown as IBullet;
    const worldWithRelease: WorldState = {
      ...world,
      bullets: [newOffscreenBullet],
      destroyOrReleaseBullet,
    };

    tickGameplay(worldWithRelease, 0.1);
    expect(destroyOrReleaseBullet).toHaveBeenCalledWith(newOffscreenBullet);
    expect(newOffscreenBullet.destroy).not.toHaveBeenCalled();
    expect(worldWithRelease.bullets.length).toBe(0);
  });

  it('updates enemies and filters out dead or offscreen enemies', () => {
    const aliveEnemy = { x: 0, isSpaceShip: false, update: vi.fn().mockReturnValue([]), isAlive: true, isOffscreen: false, destroy: vi.fn() } as unknown as IEnemy;
    const deadEnemy = { x: 0, isSpaceShip: false, update: vi.fn().mockReturnValue([]), isAlive: false, isOffscreen: false, destroy: vi.fn() } as unknown as IEnemy;
    const offscreenEnemy = { x: 0, isSpaceShip: false, update: vi.fn().mockReturnValue([]), isAlive: true, isOffscreen: true, destroy: vi.fn() } as unknown as IEnemy;

    const world: WorldState = {
      background: null,
      terrain: null,
      levelManager: null,
      player: null,
      enemies: [aliveEnemy, deadEnemy, offscreenEnemy],
      boss: null,
      bullets: [],
      powerups: [],
      effects: [],
      props: [],
    };

    tickGameplay(world, 0.1);

    expect(aliveEnemy.update).toHaveBeenCalledWith(0.1);
    expect(deadEnemy.update).toHaveBeenCalledWith(0.1);
    expect(offscreenEnemy.update).toHaveBeenCalledWith(0.1);

    expect(deadEnemy.destroy).toHaveBeenCalled();
    expect(offscreenEnemy.destroy).toHaveBeenCalled();
    expect(world.enemies).toEqual([aliveEnemy]);
  });

  it('removes offscreen enemies without turning them into kill-like outcomes', () => {
    const offscreenHighValueEnemy = {
      x: 0,
      isSpaceShip: false,
      update: vi.fn().mockReturnValue([]),
      isAlive: true,
      isOffscreen: true,
      destroy: vi.fn(),
      hit: vi.fn(() => ({ x: 0, y: 0, dropPowerup: false, triggerCancellation: true })),
      score: 400,
    } as unknown as IEnemy;

    const world: WorldState = {
      background: null,
      terrain: null,
      levelManager: null,
      player: null,
      enemies: [offscreenHighValueEnemy],
      boss: null,
      bullets: [],
      powerups: [],
      effects: [],
      props: [],
    };

    tickGameplay(world, 0.1);

    expect(offscreenHighValueEnemy.update).toHaveBeenCalledWith(0.1);
    expect(offscreenHighValueEnemy.hit).not.toHaveBeenCalled();
    expect(offscreenHighValueEnemy.destroy).toHaveBeenCalledOnce();
    expect(world.enemies).toEqual([]);
  });

  it('keeps enemies spawned by the boss during its update in world.enemies after the filter', () => {
    // Regression: the boss update previously ran AFTER the enemy filter,
    // so enemies spawned by the boss (e.g. Stalactites, Rock Drakes) were
    // pushed to the stale this._enemies array and orphaned — visible in the
    // scene but never ticked or destroyed.
    const existingEnemy = { x: 0, isSpaceShip: false, update: vi.fn().mockReturnValue([]), isAlive: true, isOffscreen: false, destroy: vi.fn() } as unknown as IEnemy;

    const bossSpawnedEnemy = { x: 100, isSpaceShip: false, update: vi.fn().mockReturnValue([]), isAlive: true, isOffscreen: false, destroy: vi.fn() } as unknown as IEnemy;

    // Simulate GameplayRun: this._enemies is the array passed as world.enemies.
    // spawnEnemy pushes to this._enemies, NOT to world.enemies directly.
    // The bug occurs when the filter reassigns world.enemies to a new array
    // before the boss pushes to the original this._enemies reference.
    const runEnemies: IEnemy[] = [existingEnemy];

    const boss = {
      update: vi.fn().mockImplementation(() => {
        // Boss spawns an enemy mid-update (like Boss4's _triggerStalactiteTremor).
        // GameplayRun.spawnEnemy pushes to this._enemies (runEnemies), which
        // may be a stale reference if the filter already reassigned world.enemies.
        runEnemies.push(bossSpawnedEnemy);
        return [];
      }),
    } as unknown as IBoss;

    const world: WorldState = {
      background: null,
      terrain: null,
      levelManager: null,
      player: null,
      enemies: runEnemies,
      boss,
      bullets: [],
      powerups: [],
      effects: [],
      props: [],
    };

    tickGameplay(world, 0.1);

    expect(boss.update).toHaveBeenCalledWith(0.1);
    expect(world.enemies).toContain(bossSpawnedEnemy);
    expect(world.enemies).toContain(existingEnemy);
    expect(bossSpawnedEnemy.destroy).not.toHaveBeenCalled();
  });

  it('updates powerups and filters out offscreen powerups', () => {
    const activePowerup = { update: vi.fn(), isOffscreen: false, destroy: vi.fn() } as unknown as IPowerUp;
    const offscreenPowerup = { update: vi.fn(), isOffscreen: true, destroy: vi.fn() } as unknown as IPowerUp;

    const world: WorldState = {
      background: null,
      terrain: null,
      levelManager: null,
      player: null,
      enemies: [],
      boss: null,
      bullets: [],
      powerups: [activePowerup, offscreenPowerup],
      effects: [],
      props: [],
    };

    tickGameplay(world, 0.1);

    expect(activePowerup.update).toHaveBeenCalledWith(0.1);
    expect(offscreenPowerup.update).toHaveBeenCalledWith(0.1);

    expect(offscreenPowerup.destroy).toHaveBeenCalled();
    expect(world.powerups).toEqual([activePowerup]);
  });

  it('updates effects, destroys completed effects, and filters them out', () => {
    const runningEffect = { update: vi.fn(), isDone: false, destroy: vi.fn() } as unknown as IEffect;
    const completedEffect = { update: vi.fn(), isDone: true, destroy: vi.fn() } as unknown as IEffect;

    const world: WorldState = {
      background: null,
      terrain: null,
      levelManager: null,
      player: null,
      enemies: [],
      boss: null,
      bullets: [],
      powerups: [],
      effects: [runningEffect, completedEffect],
      props: [],
    };

    tickGameplay(world, 0.1);

    expect(runningEffect.update).toHaveBeenCalledWith(0.1);
    expect(completedEffect.update).toHaveBeenCalledWith(0.1);

    expect(runningEffect.destroy).not.toHaveBeenCalled();
    expect(completedEffect.destroy).toHaveBeenCalled();
    expect(world.effects).toEqual([runningEffect]);
  });
});
