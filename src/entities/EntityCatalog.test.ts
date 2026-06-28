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
  type ViewerCatalogEntry,
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
    getCollisionWallsAt: () => ({ top: 220, bottom: -220 }),
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

  it('keeps viewer readiness and offset facts on the catalog entry', () => {
    const charger = getEnemyCatalogEntry(EnemyType.CHARGER)!;
    expect(charger.viewer.viewerOffsetX).toBe(18);
    expect(typeof charger.preloadViewerModel).toBe('function');

    const obstacle = getEnemyCatalogEntry(EnemyType.OBSTACLE)!;
    expect(obstacle.viewer.viewerOffsetX).toBeUndefined();
    expect(typeof obstacle.preloadViewerModel).toBe('function');

    const heartseer = getBossCatalogEntries().find((b) => b.bossArchetype === 3)!;
    expect(heartseer.viewer.viewerOffsetX).toBe(0);
    expect(typeof heartseer.preloadViewerModel).toBe('function');
  });

  it('exposes a shared ViewerCatalogEntry contract across enemy and boss entries', () => {
    // Compile-time check: both specialisations satisfy the common contract. The widened
    // ViewerPresentation shape is what TacticalDatabase consumes uniformly.
    const _enemySatisfies: ViewerCatalogEntry = ENEMY_CATALOG[0]!;
    const _bossSatisfies: ViewerCatalogEntry = BOSS_CATALOG[0]!;
    void _enemySatisfies;
    void _bossSatisfies;

    for (const entry of [...ENEMY_CATALOG, ...BOSS_CATALOG]) {
      expect(typeof entry.viewer.scale).toBe('number');
      expect(entry.viewer.centering === 'bounds' || entry.viewer.centering === 'origin').toBe(true);
      expect(Array.isArray(entry.viewerProjectileKeys)).toBe(true);
      expect(typeof entry.preloadViewerModel).toBe('function');
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
      expect(entry.viewer.centering === 'origin' || entry.viewer.centering === 'bounds').toBe(true);
    }
  });

  it('keeps Heartseer scaled to fit the boss viewer card', () => {
    const viewerByArchetype = new Map(
      BOSS_CATALOG.map((entry) => [entry.bossArchetype, entry.viewer]),
    );

    expect(viewerByArchetype.get(1)?.centering).toBe('bounds');
    expect(viewerByArchetype.get(2)?.centering).toBe('bounds');
    expect(viewerByArchetype.get(3)?.centering).toBe('bounds');
    expect(viewerByArchetype.get(4)?.centering).toBe('bounds');
    expect(viewerByArchetype.get(3)?.scale).toBe(0.40);
    expect(viewerByArchetype.get(3)?.viewerOffsetX).toBe(0);
    expect(viewerByArchetype.get(3)?.offsetX).toBe(0);
    expect(viewerByArchetype.get(3)?.offsetY).toBe(-10);
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
