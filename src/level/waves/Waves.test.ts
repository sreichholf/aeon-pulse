import { describe, expect, it } from 'vitest';
import { buildChapter1Waves } from './chapter1.ts';
import {
  buildChapter2Waves,
  mixedStraightSineBeat as chapter2MixedStraightSineBeat,
  mixedSupportSineChargerBeat,
  mixedTurretChargerBeat,
  supportSineBeat as chapter2SupportSineBeat,
} from './chapter2.ts';
import {
  buildChapter3Waves,
  mixedStraightObstacleBeat,
  mixedStraightSporeBeat,
  mixedSupportSineObstacleBeat,
} from './chapter3.ts';
import {
  buildChapter4Waves,
  dualTurretStalactiteBeat,
  stalactiteBarrageBeat,
  stalactitePairBeat,
} from './chapter4.ts';
import { BeatType } from './Timeline.ts';
import { StageEventType, type WaveEntry } from '../StageEvents.ts';
import { EnemyType } from '../../types.ts';
import type { CorridorResolver } from '../CorridorResolver.ts';

function fakeResolver(): CorridorResolver {
  return {
    getBoundsAt: () => ({ top: 200, bottom: -200 }),
    getSafeSpawnY: (_type, _at, coord) => coord * 200,
  };
}

const VALID_ENEMY_TYPES = new Set<string>(Object.values(EnemyType));
const VALID_EVENT_TYPES = new Set<string>(Object.values(StageEventType));

function validateWaveEntries(waves: WaveEntry[], chapterNum: number, levelNum: number) {
  const levelId = `${chapterNum}-${levelNum}`;
  
  // 1. Every valid chapter level builds a non-empty list of wave entries.
  expect(waves.length, `Level ${levelId} wave entries should not be empty`).toBeGreaterThan(0);

  // 2. Wave entries are sorted chronologically by their absolute position (at).
  let lastAt = -1;
  for (const entry of waves) {
    expect(entry.at, `Level ${levelId} wave entry position should be non-negative`).toBeGreaterThanOrEqual(0);
    expect(entry.at, `Level ${levelId} wave entries must be sorted chronologically`).toBeGreaterThanOrEqual(lastAt);
    lastAt = entry.at;

    // 3. All stage events have recognized StageEventType values.
    for (const event of entry.events) {
      expect(VALID_EVENT_TYPES.has(event.kind), `Event kind "${event.kind}" in level ${levelId} must be valid`).toBe(true);

      // 4. Spawn events use valid, registered EnemyType values.
      if (event.kind === StageEventType.SPAWN_ENEMY) {
        expect(VALID_ENEMY_TYPES.has(event.enemyType), `Enemy type "${event.enemyType}" in level ${levelId} must be valid`).toBe(true);
        expect(typeof event.x).toBe('number');
        expect(typeof event.y).toBe('number');
      }
    }
  }
}

function countRecoveryGaps(waves: WaveEntry[]): number {
  return waves.filter((entry) => entry.events.length === 0).length;
}

function getSpawnEvents(entry: WaveEntry) {
  return entry.events.filter((event) => event.kind === StageEventType.SPAWN_ENEMY);
}

function countSpawnedEnemies(entry: WaveEntry) {
  return getSpawnEvents(entry).reduce<Record<string, number>>((counts, event) => {
    counts[event.enemyType] = (counts[event.enemyType] ?? 0) + 1;
    return counts;
  }, {});
}

function hasEnemyType(entry: WaveEntry, enemyType: EnemyType): boolean {
  return getSpawnEvents(entry).some((event) => event.enemyType === enemyType);
}

function isFinalGauntletShapedEntry(entry: WaveEntry): boolean {
  const spawnEvents = getSpawnEvents(entry);
  if (spawnEvents.length !== entry.events.length || spawnEvents.length !== 6) {
    return false;
  }

  const counts = countSpawnedEnemies(entry);
  return counts[EnemyType.ROCK_DRAKE] === 1
    && counts[EnemyType.STRAIGHT] === 4
    && counts[EnemyType.STALACTITE] === 1;
}

describe('Chapter Wave Builders', () => {
  describe('Chapter 1 Wave Builder', () => {
    it('generates valid, non-empty, sorted waves for all chapter 1 levels', () => {
      for (let levelNum = 1; levelNum <= 5; levelNum++) {
        const waves = buildChapter1Waves(`1-${levelNum}`, fakeResolver());
        validateWaveEntries(waves, 1, levelNum);
      }
    });

    it('throws error for unknown level IDs', () => {
      expect(() => buildChapter1Waves('1-6', fakeResolver())).toThrow('Unknown Chapter 1 level: 1-6');
      expect(() => buildChapter1Waves('foo', fakeResolver())).toThrow('Unknown Chapter 1 level: foo');
    });

    it('compiles explicit recovery valleys in the Chapter 1 finale', () => {
      expect(countRecoveryGaps(buildChapter1Waves('1-5', fakeResolver()))).toBeGreaterThanOrEqual(2);
    });

    it('builds a distinct dual-diver split read in level 1-3', () => {
      const dualDiverSplit = buildChapter1Waves('1-3', fakeResolver()).find((entry) => {
        const spawnEvents = getSpawnEvents(entry);
        if (spawnEvents.length !== 5 || spawnEvents.length !== entry.events.length) {
          return false;
        }

        const counts = countSpawnedEnemies(entry);
        if (counts[EnemyType.STRAIGHT] !== 3 || counts[EnemyType.DIVER] !== 2) {
          return false;
        }

        const diverYPositions = spawnEvents
          .filter((event) => event.enemyType === EnemyType.DIVER)
          .map((event) => event.y)
          .sort((a, b) => a - b);

        return diverYPositions[0] === -140 && diverYPositions[1] === 140;
      });

      expect(dualDiverSplit).toBeDefined();
    });
  });

  describe('Chapter 2 Wave Builder', () => {
    it('generates valid, non-empty, sorted waves for all chapter 2 levels', () => {
      for (let levelNum = 1; levelNum <= 5; levelNum++) {
        const waves = buildChapter2Waves(`2-${levelNum}`, fakeResolver());
        validateWaveEntries(waves, 2, levelNum);
      }
    });

    it('throws error for unknown level IDs', () => {
      expect(() => buildChapter2Waves('2-6', fakeResolver())).toThrow('Unknown Chapter 2 level: 2-6');
      expect(() => buildChapter2Waves('foo', fakeResolver())).toThrow('Unknown Chapter 2 level: foo');
    });

    it('uses truthful beat labels for Chapter 2 mixed patterns', () => {
      expect(chapter2SupportSineBeat(0).name).toBe(BeatType.SINE_ROW);
      expect(mixedTurretChargerBeat(0, 0, 0, 0).name).toBe(BeatType.MIXED_TURRET_CHARGER);
      expect(mixedSupportSineChargerBeat(0, 0, 0, 0).name).toBe(BeatType.MIXED_SINE_CHARGER);
      expect(chapter2MixedStraightSineBeat(3, 0, 120, 0, 0).name).toBe(BeatType.MIXED_STRAIGHT_SINE);
    });
  });

  describe('Chapter 3 Wave Builder', () => {
    it('generates valid, non-empty, sorted waves for all chapter 3 levels', () => {
      for (let levelNum = 1; levelNum <= 5; levelNum++) {
        const waves = buildChapter3Waves(`3-${levelNum}`, fakeResolver());
        validateWaveEntries(waves, 3, levelNum);
      }
    });

    it('throws error for unknown level IDs', () => {
      expect(() => buildChapter3Waves('3-6', fakeResolver())).toThrow('Unknown Chapter 3 level: 3-6');
      expect(() => buildChapter3Waves('foo', fakeResolver())).toThrow('Unknown Chapter 3 level: foo');
    });

    it('uses truthful beat labels for Chapter 3 mixed patterns', () => {
      expect(mixedStraightObstacleBeat(3, 0, 120, 0, 0).name).toBe(BeatType.MIXED_STRAIGHT_OBSTACLE);
      expect(mixedSupportSineObstacleBeat(0, 0, 0, 0).name).toBe(BeatType.MIXED_SINE_OBSTACLE);
      expect(mixedStraightSporeBeat(3, 0, 120, 0, 0).name).toBe(BeatType.MIXED_STRAIGHT_SPORE);
    });

    it('compiles explicit recovery valleys in the Chapter 3 finale', () => {
      expect(countRecoveryGaps(buildChapter3Waves('3-5', fakeResolver()))).toBeGreaterThanOrEqual(2);
    });

    it('introduces a spore-only beat before any mixed spore beat in level 3-2', () => {
      const waves = buildChapter3Waves('3-2', fakeResolver());
      const firstSporeEntry = waves.find((entry) => hasEnemyType(entry, EnemyType.SPORE));
      const firstMixedSporeEntry = waves.find((entry) => {
        const spawnEvents = getSpawnEvents(entry);
        return spawnEvents.some((event) => event.enemyType === EnemyType.SPORE)
          && spawnEvents.some((event) => event.enemyType !== EnemyType.SPORE);
      });

      expect(firstSporeEntry).toBeDefined();
      expect(firstMixedSporeEntry).toBeDefined();
      expect(firstSporeEntry!.at).toBeLessThan(firstMixedSporeEntry!.at);
      expect(getSpawnEvents(firstSporeEntry!).every((event) => event.enemyType === EnemyType.SPORE)).toBe(true);
    });
  });

  describe('Chapter 4 Wave Builder', () => {
    it('generates valid, non-empty, sorted waves for all chapter 4 levels', () => {
      for (let levelNum = 1; levelNum <= 5; levelNum++) {
        const waves = buildChapter4Waves(`4-${levelNum}`, fakeResolver());
        validateWaveEntries(waves, 4, levelNum);
      }
    });

    it('throws error for unknown level IDs', () => {
      expect(() => buildChapter4Waves('4-6', fakeResolver())).toThrow('Unknown Chapter 4 level: 4-6');
      expect(() => buildChapter4Waves('foo', fakeResolver())).toThrow('Unknown Chapter 4 level: foo');
    });

    it('uses truthful beat labels for Chapter 4 setpiece patterns', () => {
      expect(stalactitePairBeat(0, 120).name).toBe(BeatType.STALACTITE_PAIR);
      expect(stalactiteBarrageBeat([0, 120]).name).toBe(BeatType.STALACTITE_BARRAGE);
      expect(dualTurretStalactiteBeat(-120, 120, 80).name).toBe(BeatType.DUAL_TURRET_STALACTITE);
    });

    it('compiles explicit recovery valleys in late Chapter 4 levels', () => {
      expect(countRecoveryGaps(buildChapter4Waves('4-4', fakeResolver()))).toBeGreaterThanOrEqual(2);
      expect(countRecoveryGaps(buildChapter4Waves('4-5', fakeResolver()))).toBeGreaterThanOrEqual(3);
    });

    it('compiles exactly one final-gauntlet-shaped stack in level 4-4 after de-dup', () => {
      const finalGauntletStacks = buildChapter4Waves('4-4', fakeResolver()).filter(isFinalGauntletShapedEntry);
      expect(finalGauntletStacks).toHaveLength(1);
    });

    it('compiles exactly one final-gauntlet-shaped stack in level 4-5 after de-dup', () => {
      const finalGauntletStacks = buildChapter4Waves('4-5', fakeResolver()).filter(isFinalGauntletShapedEntry);
      expect(finalGauntletStacks).toHaveLength(1);
    });
  });
});

