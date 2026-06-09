import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyCharger } from './EnemyCharger.ts';
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
  };
}

describe('EnemyCharger', () => {
  it('suppresses thrust and lock-on accents while displayed in the Tactical Database viewer', () => {
    const charger = new EnemyCharger(
      createScene(),
      {},
      0,
      0,
      () => ({ x: 0, y: 0 }),
      createBullet,
      { play: vi.fn() },
    );
    const internals = charger as unknown as {
      _isViewer?: boolean;
      _topPlumeT: THREE.Mesh;
      _topPlumeA: THREE.Mesh;
      _bottomPlumeT: THREE.Mesh;
      _bottomPlumeA: THREE.Mesh;
      _topSteerPlume: THREE.Mesh;
      _bottomSteerPlume: THREE.Mesh;
      _trailMat: THREE.MeshBasicMaterial;
      _laserMesh: THREE.Mesh;
    };

    charger.update(0.16);
    expect(internals._topPlumeA.scale.x).toBeGreaterThan(0);

    internals._isViewer = true;
    charger.update(0.16);

    expect(internals._topPlumeT.scale.x).toBe(0);
    expect(internals._topPlumeA.scale.x).toBe(0);
    expect(internals._bottomPlumeT.scale.x).toBe(0);
    expect(internals._bottomPlumeA.scale.x).toBe(0);
    expect(internals._topSteerPlume.scale.x).toBe(0);
    expect(internals._bottomSteerPlume.scale.x).toBe(0);
    expect(internals._trailMat.opacity).toBe(0);
    expect(internals._laserMesh.visible).toBe(false);

    charger.destroy();
  });
});
