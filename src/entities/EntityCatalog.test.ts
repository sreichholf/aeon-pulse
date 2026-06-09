import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CAMPAIGN_LEVELS } from '../campaign/Campaign.ts';
import { getProjectileDefinition } from './ProjectileDefinitions.ts';
import {
  BOSS_CATALOG,
  ENEMY_CATALOG,
  getBossCatalogEntries,
  getEnemyCatalogEntry,
  getStageEnemyCatalogEntries,
  spawnCatalogBoss,
  spawnCatalogEnemy,
} from './EntityCatalog.ts';
import {
  BulletType,
  EnemyType,
  type IBullet,
  type IScene,
  type ITerrain,
  type ProjectileSpawn,
} from '../types.ts';

function createScene(): IScene {
  return {
    camera: new THREE.Camera(),
    add: vi.fn(),
    remove: vi.fn(),
    flash: vi.fn(),
  };
}

function createTerrain(): ITerrain {
  return {
    getWallsAt: () => ({ top: 220, bottom: -220 }),
    getActualWallsAt: () => ({ top: 220, bottom: -220 }),
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
    damage: spawn.damageOverride ?? 1,
    isPiercing: false,
    isOffscreen: false,
    type: BulletType.ENEMY,
    sourceKey: String(spawn.type),
    update: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('EntityCatalog', () => {
  it('has exactly one stage catalog entry for every EnemyType', () => {
    const catalogTypes = ENEMY_CATALOG.map((entry) => entry.type);

    expect(new Set(catalogTypes).size).toBe(catalogTypes.length);
    expect(catalogTypes.toSorted()).toEqual(Object.values(EnemyType).toSorted());

    for (const enemyType of Object.values(EnemyType)) {
      expect(getEnemyCatalogEntry(enemyType)?.type).toBe(enemyType);
    }
  });

  it('returns stage enemy entries in unique viewer order', () => {
    const entries = getStageEnemyCatalogEntries();
    const orders = entries.map((entry) => entry.viewer.order);

    expect(orders).toEqual([...orders].toSorted((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('keeps all viewer projectile key lists resolvable and duplicate-free', () => {
    const entries = [...ENEMY_CATALOG, ...BOSS_CATALOG];

    for (const entry of entries) {
      expect(new Set(entry.viewerProjectileKeys).size).toBe(entry.viewerProjectileKeys.length);

      for (const projectileKey of entry.viewerProjectileKeys) {
        expect(getProjectileDefinition(projectileKey).sourceKey).toBe(projectileKey);
      }
    }
  });

  it('spawns every catalog enemy through the catalog facade', () => {
    for (const entry of ENEMY_CATALOG) {
      const enemy = spawnCatalogEnemy(entry.type, {
        scene: createScene(),
        sprites: {},
        x: 100,
        y: 40,
        getPos: () => ({ x: 0, y: 0 }),
        audio: { play: vi.fn() },
        getScrollX: () => 0,
        terrain: createTerrain(),
        projectileFactory: createBullet,
      });

      expect(enemy).not.toBeNull();
      expect(enemy?.isBoss).toBe(false);
      expect(enemy?.metadata.displayName).toBeTruthy();
      enemy?.destroy();
    }
  });

  it('aligns boss catalog archetypes with campaign finale boss definitions', () => {
    const finaleBossArchetypes = CAMPAIGN_LEVELS
      .filter((level) => level.isFinale)
      .map((level) => level.finaleBossArchetype)
      .filter((bossArchetype): bossArchetype is number => bossArchetype !== null);
    const catalogArchetypes = BOSS_CATALOG.map((entry) => entry.bossArchetype);

    expect(new Set(catalogArchetypes).size).toBe(catalogArchetypes.length);
    expect(catalogArchetypes.toSorted((a, b) => a - b)).toEqual(finaleBossArchetypes.toSorted((a, b) => a - b));

    for (const entry of BOSS_CATALOG) {
      expect(entry.viewer.bossArchetype).toBe(entry.bossArchetype);
    }
  });

  it('returns boss catalog entries in archetype order and spawns each boss', () => {
    const entries = getBossCatalogEntries();
    expect(entries.map((entry) => entry.bossArchetype)).toEqual([1, 2, 3, 4]);

    for (const entry of entries) {
      const boss = spawnCatalogBoss(entry.bossArchetype, {
        scene: createScene(),
        sprites: {},
        getPos: () => ({ x: 0, y: 0 }),
        onDeath: vi.fn(),
        audio: { play: vi.fn() },
        spawnEnemyCallback: vi.fn(),
        projectileFactory: createBullet,
      });

      expect(boss.isBoss).toBe(true);
      expect(boss.metadata.displayName).toBeTruthy();
      boss.destroy();
    }
  });
});
