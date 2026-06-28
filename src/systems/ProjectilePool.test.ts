import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ProjectilePool } from './ProjectilePool.ts';
import { Bullet } from '../entities/Bullet.ts';
import { BulletType, IScene, ProjectileSpawn } from '../types.ts';

function createMockScene(): IScene {
  return {
    camera: new THREE.Camera(),
    add: vi.fn(),
    remove: vi.fn(),
    flash: vi.fn(),
  };
}

describe('ProjectilePool', () => {
  it('creates and adds a new bullet to the scene when pool is empty', () => {
    const scene = createMockScene();
    const pool = new ProjectilePool(scene, null);
    
    const spawn: ProjectileSpawn = {
      type: BulletType.PLAYER,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
    };

    const bullet = pool.create(spawn);
    
    expect(bullet).toBeInstanceOf(Bullet);
    expect(bullet.active).toBe(true);
    expect(bullet.x).toBe(10);
    expect(bullet.y).toBe(20);
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('reuses/recycles a released bullet with matching keys', () => {
    const scene = createMockScene();
    const pool = new ProjectilePool(scene, null);
    
    const spawn: ProjectileSpawn = {
      type: BulletType.PLAYER,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
    };

    const bullet1 = pool.create(spawn);
    expect(scene.add).toHaveBeenCalledTimes(1);

    // Release bullet1 back to the pool
    const released = pool.release(bullet1);
    expect(released).toBe(true);
    expect(bullet1.active).toBe(false);
    expect(scene.remove).toHaveBeenCalledTimes(1);

    // Create a new bullet with same spawn properties
    const bullet2 = pool.create({
      ...spawn,
      x: 50,
      y: 60,
    });

    // It should be the exact same instance, reset to new position
    expect(bullet2).toBe(bullet1);
    expect(bullet2.active).toBe(true);
    expect(bullet2.x).toBe(50);
    expect(bullet2.y).toBe(60);
    expect(scene.add).toHaveBeenCalledTimes(2); // Initial add + reset add
  });

  it('creates a new bullet instead of recycling if tint or damageOverride keys do not match', () => {
    const scene = createMockScene();
    const pool = new ProjectilePool(scene, null);
    
    const bullet1 = pool.create({
      type: BulletType.PLAYER,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
      tint: 0xff0000,
    });

    pool.release(bullet1);

    // Request with different tint
    const bullet2 = pool.create({
      type: BulletType.PLAYER,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
      tint: 0x00ff00,
    });

    expect(bullet2).not.toBe(bullet1);

    pool.release(bullet2);

    // Request with different damageOverride
    const bullet3 = pool.create({
      type: BulletType.PLAYER,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
      tint: 0x00ff00,
      damageOverride: 10,
    });

    expect(bullet3).not.toBe(bullet2);
  });

  it('does not pool non-poolable bullet types', () => {
    const scene = createMockScene();
    const pool = new ProjectilePool(scene, null);
    
    // HOMING is not in POOLABLE_TYPES (only PLAYER and ENEMY are)
    const spawn: ProjectileSpawn = {
      type: BulletType.HOMING,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
    };

    const bullet1 = pool.create(spawn);
    const released = pool.release(bullet1);
    
    // Release should return false since it was never tracked in the active pool
    expect(released).toBe(false);

    // Creating again should be a new instance
    const bullet2 = pool.create(spawn);
    expect(bullet2).not.toBe(bullet1);
  });

  it('does not pool bullets that have getTargetPos callback defined', () => {
    const scene = createMockScene();
    const pool = new ProjectilePool(scene, null);
    
    const spawn: ProjectileSpawn = {
      type: BulletType.PLAYER,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
      getTargetPos: () => ({ x: 0, y: 0 }),
    };

    const bullet1 = pool.create(spawn);
    const released = pool.release(bullet1);
    
    // Bullet should not be poolable because getTargetPos is defined
    expect(released).toBe(false);
  });

  it('destroys bullets correctly on clear()', () => {
    const scene = createMockScene();
    const pool = new ProjectilePool(scene, null);
    
    const bulletActive = pool.create({
      type: BulletType.PLAYER,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
    });

    const bulletInactive = pool.create({
      type: BulletType.PLAYER,
      x: 30,
      y: 40,
      vx: 100,
      vy: 0,
    });
    pool.release(bulletInactive);

    // Spy on destroy
    const activeDestroySpy = vi.spyOn(bulletActive, 'destroy');
    const inactiveDestroySpy = vi.spyOn(bulletInactive, 'destroy');

    pool.clear();

    expect(activeDestroySpy).toHaveBeenCalled();
    expect(inactiveDestroySpy).toHaveBeenCalled();
  });

  it('handles destroyOrRelease correctly', () => {
    const scene = createMockScene();
    const pool = new ProjectilePool(scene, null);
    
    // Poolable bullet
    const bullet1 = pool.create({
      type: BulletType.PLAYER,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
    });
    
    const destroySpy1 = vi.spyOn(bullet1, 'destroy');
    pool.destroyOrRelease(bullet1);
    
    // Should be released, not destroyed
    expect(destroySpy1).not.toHaveBeenCalled();
    expect(bullet1.active).toBe(false);

    // Non-poolable bullet
    const bullet2 = pool.create({
      type: BulletType.HOMING,
      x: 10,
      y: 20,
      vx: 100,
      vy: 0,
    });
    
    const destroySpy2 = vi.spyOn(bullet2, 'destroy');
    pool.destroyOrRelease(bullet2);
    
    // Should be destroyed because it is not poolable
    expect(destroySpy2).toHaveBeenCalled();
  });
});
