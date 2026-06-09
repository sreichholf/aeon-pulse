import { describe, expect, it } from 'vitest';
import { buildChapter1Waves } from './chapter1.ts';
import { buildChapter2Waves } from './chapter2.ts';
import { buildChapter3Waves } from './chapter3.ts';
import { buildChapter4Waves } from './chapter4.ts';
import { StageEventType, type WaveEntry } from '../StageEvents.ts';
import { EnemyType } from '../../types.ts';

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

describe('Chapter Wave Builders', () => {
  describe('Chapter 1 Wave Builder', () => {
    it('generates valid, non-empty, sorted waves for all chapter 1 levels', () => {
      for (let levelNum = 1; levelNum <= 5; levelNum++) {
        const waves = buildChapter1Waves(`1-${levelNum}`);
        validateWaveEntries(waves, 1, levelNum);
      }
    });

    it('throws error for unknown level IDs', () => {
      expect(() => buildChapter1Waves('1-6')).toThrow('Unknown Chapter 1 level: 1-6');
      expect(() => buildChapter1Waves('foo')).toThrow('Unknown Chapter 1 level: foo');
    });
  });

  describe('Chapter 2 Wave Builder', () => {
    it('generates valid, non-empty, sorted waves for all chapter 2 levels', () => {
      for (let levelNum = 1; levelNum <= 5; levelNum++) {
        const waves = buildChapter2Waves(`2-${levelNum}`);
        validateWaveEntries(waves, 2, levelNum);
      }
    });

    it('throws error for unknown level IDs', () => {
      expect(() => buildChapter2Waves('2-6')).toThrow('Unknown Chapter 2 level: 2-6');
      expect(() => buildChapter2Waves('foo')).toThrow('Unknown Chapter 2 level: foo');
    });
  });

  describe('Chapter 3 Wave Builder', () => {
    it('generates valid, non-empty, sorted waves for all chapter 3 levels', () => {
      for (let levelNum = 1; levelNum <= 5; levelNum++) {
        const waves = buildChapter3Waves(`3-${levelNum}`);
        validateWaveEntries(waves, 3, levelNum);
      }
    });

    it('throws error for unknown level IDs', () => {
      expect(() => buildChapter3Waves('3-6')).toThrow('Unknown Chapter 3 level: 3-6');
      expect(() => buildChapter3Waves('foo')).toThrow('Unknown Chapter 3 level: foo');
    });
  });

  describe('Chapter 4 Wave Builder', () => {
    it('generates valid, non-empty, sorted waves for all chapter 4 levels', () => {
      for (let levelNum = 1; levelNum <= 5; levelNum++) {
        const waves = buildChapter4Waves(`4-${levelNum}`);
        validateWaveEntries(waves, 4, levelNum);
      }
    });

    it('throws error for unknown level IDs', () => {
      expect(() => buildChapter4Waves('4-6')).toThrow('Unknown Chapter 4 level: 4-6');
      expect(() => buildChapter4Waves('foo')).toThrow('Unknown Chapter 4 level: foo');
    });
  });
});
