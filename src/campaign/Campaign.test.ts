import { describe, expect, it } from 'vitest';
import {
  CHAPTERS,
  CAMPAIGN_LEVELS,
  IMPLEMENTED_LEVELS,
  getCampaignLevel,
  getFirstImplementedLevel,
  getNextImplementedLevel,
  getPreviousImplementedLevel,
  getNextTitleLevel,
  getMusicCueForChapterKey,
  LevelId,
  CampaignLevelRecord
} from './Campaign.ts';
import { MusicCue } from '../types.ts';

describe('Campaign Module', () => {
  it('contains exactly 20 levels in chapter/level order', () => {
    expect(CAMPAIGN_LEVELS.length).toBe(20);
    for (let i = 0; i < 20; i++) {
      const chapterNum = Math.floor(i / 5) + 1;
      const levelNum = (i % 5) + 1;
      expect(CAMPAIGN_LEVELS[i].id).toBe(`${chapterNum}-${levelNum}`);
      expect(CAMPAIGN_LEVELS[i].chapterNumber).toBe(chapterNum);
      expect(CAMPAIGN_LEVELS[i].levelNumber).toBe(levelNum);
    }
  });

  it('contains all 20 levels in IMPLEMENTED_LEVELS', () => {
    expect(IMPLEMENTED_LEVELS.length).toBe(20);
    expect(IMPLEMENTED_LEVELS.map((level) => level.id)).toEqual(
      CAMPAIGN_LEVELS.map((level) => level.id)
    );
  });

  it('satisfies invariants for finale and non-finale levels', () => {
    for (const level of CAMPAIGN_LEVELS) {
      if (level.levelNumber === 5) {
        expect(level.isFinale).toBe(true);
        expect(level.clearType).toBe('chapter');
        expect(level.endAt).toBe(0);
        expect(level.finaleBossArchetype).not.toBeNull();
      } else {
        expect(level.isFinale).toBe(false);
        expect(level.clearType).toBe('level');
        expect(level.endAt).toBeGreaterThan(0);
        expect(level.finaleBossArchetype).toBeNull();
      }
    }
  });

  it('has non-decreasing soft tier caps across the campaign', () => {
    let prevCap = 0;
    for (const level of CAMPAIGN_LEVELS) {
      expect(level.softTierCap).toBeGreaterThanOrEqual(prevCap);
      prevCap = level.softTierCap;
    }
  });

  it('has stable and correct chapter configurations', () => {
    expect(CHAPTERS).toEqual([
      { number: 1, key: 'Megastructure', name: 'The Outer Array', archetype: 1 },
      { number: 2, key: 'Industrial', name: 'Iron Vein', archetype: 2 },
      { number: 3, key: 'Hive', name: 'Hive Womb', archetype: 3 },
      { number: 4, key: 'Volcanic', name: 'Cinder Core', archetype: 4 },
    ]);
  });

  it('maps chapter keys to correct MusicCues', () => {
    expect(getMusicCueForChapterKey('Megastructure')).toBe(MusicCue.CHAPTER_MEGASTRUCTURE);
    expect(getMusicCueForChapterKey('Industrial')).toBe(MusicCue.CHAPTER_INDUSTRIAL);
    expect(getMusicCueForChapterKey('Hive')).toBe(MusicCue.CHAPTER_HIVE);
    expect(getMusicCueForChapterKey('Volcanic')).toBe(MusicCue.CHAPTER_VOLCANIC);
  });

  it('handles implemented level traversal correctly', () => {
    const firstLevel = getFirstImplementedLevel();
    expect(firstLevel.id).toBe('1-1');

    const lastLevel = IMPLEMENTED_LEVELS[IMPLEMENTED_LEVELS.length - 1];
    expect(lastLevel.id).toBe('4-5');

    // getNextImplementedLevel
    expect(getNextImplementedLevel(lastLevel)).toBeNull();
    const nextOfFirst = getNextImplementedLevel(firstLevel);
    expect(nextOfFirst).not.toBeNull();
    expect(nextOfFirst!.id).toBe('1-2');

    // getNextTitleLevel wrapping
    expect(getNextTitleLevel(lastLevel).id).toBe(firstLevel.id);

    // getPreviousImplementedLevel wrapping
    expect(getPreviousImplementedLevel(firstLevel).id).toBe(lastLevel.id);
  });

  it('throws correct errors for unknown level operations', () => {
    expect(() => getCampaignLevel('9-9' as LevelId)).toThrow('Unknown campaign level');

    const fakeLevel: CampaignLevelRecord = {
      id: '9-9' as LevelId,
      chapterNumber: 9,
      levelNumber: 9,
      chapterKey: 'Megastructure',
      chapterName: 'Fake Chapter',
      archetype: 1,
      softTierCap: 5,
      isFinale: false,
      clearType: 'level',
      endAt: 1000,
      implemented: false,
      finaleBossArchetype: null,
    };

    expect(() => getNextImplementedLevel(fakeLevel)).toThrow('Implemented campaign level not found');
    expect(() => getPreviousImplementedLevel(fakeLevel)).toThrow('Implemented campaign level not found');
    expect(() => getNextTitleLevel(fakeLevel)).toThrow('Implemented campaign level not found');
  });
});
