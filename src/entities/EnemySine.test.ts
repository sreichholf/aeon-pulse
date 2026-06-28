import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemySine } from './EnemySine.ts';
import {
  SINE_COLLISION_HALF_HEIGHT,
  SINE_COLLISION_HALF_WIDTH,
  SINE_COLLISION_OFFSET_X,
  SINE_MODEL_PROFILES,
  SINE_MODEL_ROTATION,
} from './EnemySineModel.ts';
import { BulletType, type IBullet, type IScene, type ProjectileSpawn } from '../types.ts';
import {
  createStandardEnemyModelInstance,
  type PreparedStandardEnemyModel,
} from '../systems/StandardEnemyModel.ts';

function createScene(): IScene {
  return {
    camera: new THREE.Camera(),
    add: vi.fn(),
    remove: vi.fn(),
    flash: vi.fn(),
  };
}

function createBullet(spawn: ProjectileSpawn): IBullet {
  return {
    active: true,
    x: spawn.x,
    y: spawn.y,
    hw: 4,
    hh: 4,
    isPlayerBullet: false,
    damage: 1,
    isPiercing: false,
    isOffscreen: false,
    type: BulletType.ENEMY,
    update: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('EnemySine', () => {
  it('keeps a broad left-facing collision footprint aligned slightly ahead of the visual root', () => {
    const enemy = new EnemySine(
      createScene(),
      {},
      100,
      20,
      () => ({ x: 0, y: 0 }),
      createBullet,
      { play: vi.fn() },
    );
    const internals = enemy as unknown as { _mesh: THREE.Group };

    expect(enemy.hw).toBe(SINE_COLLISION_HALF_WIDTH);
    expect(enemy.hh).toBe(SINE_COLLISION_HALF_HEIGHT);
    expect(enemy.x).toBe(internals._mesh.position.x + SINE_COLLISION_OFFSET_X);

    enemy.destroy();
  });

  it('applies the sine model rotation constants to prepared instances', () => {
    const prepared: PreparedStandardEnemyModel = {
      buckets: [],
      bodyGeometry: null,
      size: new THREE.Vector3(2, 2, 2),
    };

    const instance = createStandardEnemyModelInstance(prepared, {
      targetVisualHeight: SINE_MODEL_PROFILES.gameplay.targetVisualHeight,
      rotation: SINE_MODEL_ROTATION,
    });

    expect(instance.root.rotation.x).toBeCloseTo(0);
    expect(instance.root.rotation.y).toBeCloseTo(0);
    expect(instance.root.rotation.z).toBeCloseTo(0);
  });
});
