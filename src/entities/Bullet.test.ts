import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { Bullet } from './Bullet.ts';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.ts';
import { ProjectileSourceKey } from '../types.ts';

function createScene() {
  return {
    camera: new THREE.Camera(),
    add: vi.fn(),
    remove: vi.fn(),
    flash: vi.fn(),
  };
}

describe('Bullet', () => {
  it('treats hostile bullets as offscreen immediately after they cross the visible bounds', () => {
    const scene = createScene();
    const halfW = GAME_WIDTH / 2;
    const halfH = GAME_HEIGHT / 2;

    const leftBullet = new Bullet(scene as any, null, ProjectileSourceKey.ENEMY, -halfW - 1, 0, 0, 0);
    const rightBullet = new Bullet(scene as any, null, ProjectileSourceKey.ENEMY, halfW + 1, 0, 0, 0);
    const topBullet = new Bullet(scene as any, null, ProjectileSourceKey.ENEMY, 0, halfH + 1, 0, 0);
    const bottomBullet = new Bullet(scene as any, null, ProjectileSourceKey.ENEMY, 0, -halfH - 1, 0, 0);

    expect(leftBullet.isOffscreen).toBe(true);
    expect(rightBullet.isOffscreen).toBe(true);
    expect(topBullet.isOffscreen).toBe(true);
    expect(bottomBullet.isOffscreen).toBe(true);

    leftBullet.destroy();
    rightBullet.destroy();
    topBullet.destroy();
    bottomBullet.destroy();
  });
});
