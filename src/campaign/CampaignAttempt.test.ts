import { describe, expect, it } from 'vitest';
import { CampaignAttempt } from './CampaignAttempt.ts';
import { getCampaignLevel } from './Campaign.ts';
import { GameState } from '../types.ts';

describe('CampaignAttempt', () => {
  it('should initialize with given level and weapon tier', () => {
    const level = getCampaignLevel('1-1');
    const attempt = new CampaignAttempt(level, 3);

    expect(attempt.level).toBe(level);
    expect(attempt.weaponTier).toBe(3);
  });

  it('should default to weapon tier 1 if not specified', () => {
    const level = getCampaignLevel('1-1');
    const attempt = new CampaignAttempt(level);

    expect(attempt.weaponTier).toBe(1);
  });

  it('should allow updating level and weapon tier via setters', () => {
    const level1 = getCampaignLevel('1-1');
    const level2 = getCampaignLevel('1-2');
    const attempt = new CampaignAttempt(level1, 1);

    attempt.level = level2;
    attempt.weaponTier = 4;

    expect(attempt.level).toBe(level2);
    expect(attempt.weaponTier).toBe(4);
  });

  describe('calculateClearScores', () => {
    it('should calculate correct scores for a non-finale level', () => {
      const level = getCampaignLevel('1-1'); // isFinale is false
      const attempt = new CampaignAttempt(level);

      const result = attempt.calculateClearScores(3, 5000); // 3 lives, baseScore 5000

      // CLEAR_BONUS = 10000
      // LIVES_BONUS = 2000 => 3 * 2000 = 6000
      // CHAPTER_BONUS = 0 (not finale)
      // totalScore = 5000 + 10000 + 6000 + 0 = 21000
      expect(result.baseScore).toBe(5000);
      expect(result.clearBonus).toBe(10000);
      expect(result.livesBonus).toBe(6000);
      expect(result.chapterBonus).toBe(0);
      expect(result.totalScore).toBe(21000);
    });

    it('should calculate correct scores for a finale level', () => {
      const level = getCampaignLevel('1-5'); // isFinale is true
      const attempt = new CampaignAttempt(level);

      const result = attempt.calculateClearScores(2, 10000); // 2 lives, baseScore 10000

      // CLEAR_BONUS = 10000
      // LIVES_BONUS = 2000 => 2 * 2000 = 4000
      // CHAPTER_BONUS = 25000
      // totalScore = 10000 + 10000 + 4000 + 25000 = 49000
      expect(result.baseScore).toBe(10000);
      expect(result.clearBonus).toBe(10000);
      expect(result.livesBonus).toBe(4000);
      expect(result.chapterBonus).toBe(25000);
      expect(result.totalScore).toBe(49000);
    });
  });

  describe('getNextLevel', () => {
    it('should return the next implemented level record', () => {
      const level = getCampaignLevel('1-1');
      const attempt = new CampaignAttempt(level);

      const nextLevel = attempt.getNextLevel();
      expect(nextLevel).not.toBeNull();
      expect(nextLevel!.id).toBe('1-2');
    });

    it('should return null when there is no next level', () => {
      const level = getCampaignLevel('4-5'); // last level in campaign
      const attempt = new CampaignAttempt(level);

      const nextLevel = attempt.getNextLevel();
      expect(nextLevel).toBeNull();
    });
  });

  describe('getNextGameState', () => {
    it('should return GameState.LEVEL_START if next level exists', () => {
      const level = getCampaignLevel('1-1');
      const attempt = new CampaignAttempt(level);

      expect(attempt.getNextGameState()).toBe(GameState.LEVEL_START);
    });

    it('should return GameState.GAME_COMPLETE if next level does not exist', () => {
      const level = getCampaignLevel('4-5');
      const attempt = new CampaignAttempt(level);

      expect(attempt.getNextGameState()).toBe(GameState.GAME_COMPLETE);
    });
  });

  describe('advance', () => {
    it('should advance to the next level and update the weapon tier', () => {
      const level = getCampaignLevel('1-1');
      const attempt = new CampaignAttempt(level, 2);

      attempt.advance(4);

      expect(attempt.level.id).toBe('1-2');
      expect(attempt.weaponTier).toBe(4);
    });

    it('should throw an error when trying to advance past the final level', () => {
      const level = getCampaignLevel('4-5');
      const attempt = new CampaignAttempt(level, 5);

      expect(() => attempt.advance(5)).toThrowError('No next level to advance to.');
    });
  });
});
