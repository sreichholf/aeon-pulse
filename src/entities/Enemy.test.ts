import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyStraight } from './EnemyStraight.ts';
import { type IScene, type ProjectileSpawn, type IBullet, BulletType } from '../types.ts';

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

function createStraight() {
  return new EnemyStraight(
    createScene(),
    {},
    100,
    20,
    () => ({ x: 0, y: 0 }),
    createBullet,
    { play: vi.fn() },
  );
}

describe('Enemy durability scaling and Armor', () => {
  it('applyDurabilityScaling adds HP without changing the base of an unarmored enemy', () => {
    const enemy = createStraight();
    const internals = enemy as unknown as { _hp: number };
    expect(internals._hp).toBe(1);

    enemy.applyDurabilityScaling(2, false);
    expect(internals._hp).toBe(3);
    expect(enemy.isAlive).toBe(true);

    enemy.destroy();
  });

  it('Armor absorbs the first bullet hit (no HP loss) and breaks; the next bullet hit deals HP damage', () => {
    const enemy = createStraight();
    enemy.applyDurabilityScaling(0, true);

    const first = enemy.hit(1);
    expect(first).toBeNull();

    enemy.update(0.016);

    const second = enemy.hit(1);
    expect(second).not.toBeNull();
    expect(second!.dropPowerup).toBe(false);

    enemy.destroy();
  });

  it('bypassArmor=true skips the Armor absorb and deals HP damage directly', () => {
    const enemy = createStraight();
    enemy.applyDurabilityScaling(0, true);

    const bypassed = enemy.hit(1, true);
    expect(bypassed).not.toBeNull();

    enemy.destroy();
  });

  it('does not let a piercing multi-hit on the same frame break Armor and kill in one tap', () => {
    const enemy = createStraight();
    enemy.applyDurabilityScaling(0, true);

    const first = enemy.hit(1);
    expect(first).toBeNull();

    const sameFrame = enemy.hit(1);
    expect(sameFrame).toBeNull();

    enemy.update(0.016);

    const nextFrame = enemy.hit(1);
    expect(nextFrame).not.toBeNull();

    enemy.destroy();
  });

  it('a fully armored + scaled enemy survives one tap and dies only after HP is exhausted', () => {
    const enemy = createStraight();
    enemy.applyDurabilityScaling(3, true);

    expect(enemy.hit(1)).toBeNull();
    enemy.update(0.016);

    let kill = null;
    for (let i = 0; i < 3; i++) {
      kill = enemy.hit(1);
      expect(kill).toBeNull();
      enemy.update(0.016);
    }
    kill = enemy.hit(1);
    expect(kill).not.toBeNull();

    enemy.destroy();
  });

  it('marks the instanced mesh with armor tint while armored and clears it on break', () => {
    const enemy = createStraight();
    const mesh = (enemy as unknown as { _mesh: THREE.Group })._mesh;
    mesh.userData.isInstanced = true;

    enemy.applyDurabilityScaling(0, true);
    expect(mesh.userData.armorTint).toBe(true);

    enemy.hit(1);
    expect(mesh.userData.armorTint).toBe(false);
    expect(mesh.userData.armorBreak).toBe(true);

    enemy.destroy();
  });
});
