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
    };

    tickGameplay(world, 0.1);

    expect(background.update).toHaveBeenCalledWith(0.1);
    expect(levelManager.update).toHaveBeenCalledWith(0.1);
  });

  it('updates terrain and assigns terrainBounds to the player and spaceship enemies', () => {
    const levelManager = { update: vi.fn(), scrollX: 100 } as unknown as ILevelManager;
    
    // Test case 1: terrain has getActualWallsAt
    const terrainWithActual = {
      update: vi.fn(),
      getActualWallsAt: vi.fn().mockReturnValue({ top: 150, bottom: -150 }),
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
    };

    tickGameplay(world1, 0.1);

    expect(terrainWithActual.update).toHaveBeenCalledWith(100, 0.1);
    // Player world X is scrollX (100) + player.x (50) = 150
    expect(terrainWithActual.getActualWallsAt).toHaveBeenCalledWith(150);
    expect(player.terrainBounds).toEqual({ top: 150, bottom: -150 });

    // Spaceship enemy world X is 100 + 80 = 180
    expect(terrainWithActual.getActualWallsAt).toHaveBeenCalledWith(180);
    expect(enemySpaceShip.terrainBounds).toEqual({ top: 150, bottom: -150 });

    // Non-spaceship enemy terrain bounds should remain null
    expect(enemyNonSpaceShip.terrainBounds).toBeNull();

    // Test case 2: fallback to getWallsAt if getActualWallsAt is not defined
    const terrainClassic = {
      update: vi.fn(),
      getWallsAt: vi.fn().mockReturnValue({ top: 120, bottom: -120 }),
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
    };

    tickGameplay(world2, 0.1);
    expect(terrainClassic.getWallsAt).toHaveBeenCalledWith(150); // Player
    expect(terrainClassic.getWallsAt).toHaveBeenCalledWith(180); // Spaceship enemy
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
    };

    tickGameplay(world, 0.1);

    expect(aliveEnemy.update).toHaveBeenCalledWith(0.1);
    expect(deadEnemy.update).toHaveBeenCalledWith(0.1);
    expect(offscreenEnemy.update).toHaveBeenCalledWith(0.1);

    expect(deadEnemy.destroy).toHaveBeenCalled();
    expect(offscreenEnemy.destroy).toHaveBeenCalled();
    expect(world.enemies).toEqual([aliveEnemy]);
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
    };

    tickGameplay(world, 0.1);

    expect(activePowerup.update).toHaveBeenCalledWith(0.1);
    expect(offscreenPowerup.update).toHaveBeenCalledWith(0.1);

    expect(offscreenPowerup.destroy).toHaveBeenCalled();
    expect(world.powerups).toEqual([activePowerup]);
  });

  it('updates effects and filters out completed effects', () => {
    const runningEffect = { update: vi.fn(), isDone: false } as unknown as IEffect;
    const completedEffect = { update: vi.fn(), isDone: true } as unknown as IEffect;

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
    };

    tickGameplay(world, 0.1);

    expect(runningEffect.update).toHaveBeenCalledWith(0.1);
    expect(completedEffect.update).toHaveBeenCalledWith(0.1);

    expect(world.effects).toEqual([runningEffect]);
  });
});
