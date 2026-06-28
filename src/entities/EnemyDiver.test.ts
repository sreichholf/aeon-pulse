import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyDiver } from './EnemyDiver.ts';
import {
  DIVER_COLLISION_HALF_HEIGHT,
  DIVER_COLLISION_HALF_WIDTH,
  DIVER_COLLISION_OFFSET_X,
  DIVER_MODEL_PROFILES,
  DIVER_MODEL_ROTATION,
} from './EnemyDiverModel.ts';
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

describe('EnemyDiver', () => {
  it('keeps a compact forward-biased collision footprint', () => {
    const enemy = new EnemyDiver(
      createScene(),
      {},
      100,
      20,
      () => ({ x: 0, y: 0 }),
      createBullet,
      { play: vi.fn() },
    );
    const internals = enemy as unknown as { _mesh: THREE.Group };

    expect(enemy.hw).toBe(DIVER_COLLISION_HALF_WIDTH);
    expect(enemy.hh).toBe(DIVER_COLLISION_HALF_HEIGHT);
    expect(enemy.x).toBe(internals._mesh.position.x + DIVER_COLLISION_OFFSET_X);

    enemy.destroy();
  });

  it('applies the diver model rotation constants to prepared instances', () => {
    const prepared: PreparedStandardEnemyModel = {
      buckets: [],
      bodyGeometry: null,
      size: new THREE.Vector3(2, 2, 2),
    };

    const instance = createStandardEnemyModelInstance(prepared, {
      targetVisualHeight: DIVER_MODEL_PROFILES.gameplay.targetVisualHeight,
      rotation: DIVER_MODEL_ROTATION,
    });

    expect(instance.root.rotation.x).toBeCloseTo(0);
    expect(instance.root.rotation.y).toBeCloseTo(0);
    expect(instance.root.rotation.z).toBeCloseTo(0);
  });
});
