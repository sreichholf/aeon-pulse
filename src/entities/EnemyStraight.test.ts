import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyStraight } from './EnemyStraight.ts';
import {
  STRAIGHT_COLLISION_HALF_HEIGHT,
  STRAIGHT_COLLISION_HALF_WIDTH,
  STRAIGHT_COLLISION_OFFSET_X,
  STRAIGHT_ENGINE_FLAME_OFFSET,
  STRAIGHT_LEFT_GUN_OFFSET,
  STRAIGHT_RIGHT_GUN_OFFSET,
} from './EnemyStraightModel.ts';
import { BulletType, type IBullet, type IScene, type ProjectileSpawn } from '../types.ts';

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
    vx: spawn.vx,
    vy: spawn.vy,
  } as IBullet & { vx: number; vy: number };
}

describe('EnemyStraight', () => {
  it('keeps a left-facing side-on pose with a compact forward-biased collision footprint', () => {
    const enemy = new EnemyStraight(
      createScene(),
      {},
      100,
      20,
      () => ({ x: 0, y: 0 }),
      createBullet,
      { play: vi.fn() },
    );
    const internals = enemy as unknown as {
      _mesh: THREE.Group;
      _visualsGroup: THREE.Group;
      _mainFlame: THREE.Mesh;
      _leftGunPoint: THREE.Object3D;
      _rightGunPoint: THREE.Object3D;
    };

    expect(internals._visualsGroup.rotation.x).toBe(0);
    expect(enemy.hw).toBe(STRAIGHT_COLLISION_HALF_WIDTH);
    expect(enemy.hh).toBe(STRAIGHT_COLLISION_HALF_HEIGHT);
    expect(enemy.x).toBe(internals._mesh.position.x + STRAIGHT_COLLISION_OFFSET_X);

    expect(internals._mainFlame.position.toArray()).toEqual(STRAIGHT_ENGINE_FLAME_OFFSET.toArray());
    expect(internals._leftGunPoint.position.toArray()).toEqual(STRAIGHT_LEFT_GUN_OFFSET.toArray());
    expect(internals._rightGunPoint.position.toArray()).toEqual(STRAIGHT_RIGHT_GUN_OFFSET.toArray());

    expect(internals._leftGunPoint.position.x).toBeLessThan(0);
    expect(internals._rightGunPoint.position.x).toBeLessThan(0);
    expect(internals._mainFlame.position.x).toBeGreaterThan(0);

    enemy.destroy();
  });

  it('fires a slightly forked dual shot from its two muzzle points', () => {
    const enemy = new EnemyStraight(
      createScene(),
      {},
      100,
      20,
      () => ({ x: 0, y: 20 }),
      createBullet,
      { play: vi.fn() },
    );
    const internals = enemy as unknown as {
      _shootAtPlayer: () => void;
      _newBullets: Array<IBullet & { vx: number; vy: number }>;
    };

    internals._shootAtPlayer();

    expect(internals._newBullets).toHaveLength(2);
    expect(internals._newBullets[0]!.vx).toBeLessThan(0);
    expect(internals._newBullets[1]!.vx).toBeLessThan(0);
    expect(internals._newBullets[0]!.vy).toBeLessThan(0);
    expect(internals._newBullets[1]!.vy).toBeGreaterThan(0);

    enemy.destroy();
  });
});
