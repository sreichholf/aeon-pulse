import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ScoreManager } from './ScoreManager.ts';
import { DifficultyMode } from '../types.ts';

// In-memory mock for localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string): string | null => {
    return store[key] !== undefined ? store[key] : null;
  }),
  setItem: vi.fn((key: string, value: string): void => {
    store[key] = value.toString();
  }),
  removeItem: vi.fn((key: string): void => {
    delete store[key];
  }),
  clear: vi.fn((): void => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
};

vi.stubGlobal('localStorage', localStorageMock);

describe('ScoreManager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('initializes with default values and Rookie mode', () => {
      const manager = new ScoreManager();
      expect(manager.score).toBe(0);
      expect(manager.hiScore).toBe(0);
      expect(manager.lives).toBe(3);
      expect(manager.isGameOver).toBe(false);
    });

    it('initializes with the specified difficulty mode', () => {
      const manager = new ScoreManager(DifficultyMode.ACE);
      expect(manager.score).toBe(0);
      expect(manager.hiScore).toBe(0);
      expect(manager.lives).toBe(3);
    });

    it('loads the high score from localStorage on initialization', () => {
      // Setup: Save a score history in localStorage for Rookie mode
      const rookieKey = 'aeon-pulse-scores-rookie';
      const initialScores = [
        { initials: 'XYZ', score: 1000 },
        { initials: 'ABC', score: 500 },
      ];
      store[rookieKey] = JSON.stringify(initialScores);

      const manager = new ScoreManager(DifficultyMode.ROOKIE);
      expect(manager.hiScore).toBe(1000);
      expect(manager.score).toBe(0);
    });

    it('sets high score to 0 if localStorage has no saved scores', () => {
      const manager = new ScoreManager(DifficultyMode.PILOT);
      expect(manager.hiScore).toBe(0);
    });
  });

  describe('Score Management', () => {
    it('increases score and updates high score dynamically', () => {
      const manager = new ScoreManager(DifficultyMode.ROOKIE);
      
      manager.addScore(100);
      expect(manager.score).toBe(100);
      expect(manager.hiScore).toBe(100);

      manager.addScore(50);
      expect(manager.score).toBe(150);
      expect(manager.hiScore).toBe(150);
    });

    it('does not update high score if current score is lower than high score', () => {
      // Setup pre-existing high score of 500
      const rookieKey = 'aeon-pulse-scores-rookie';
      store[rookieKey] = JSON.stringify([{ initials: 'AAA', score: 500 }]);

      const manager = new ScoreManager(DifficultyMode.ROOKIE);
      expect(manager.hiScore).toBe(500);

      manager.addScore(100);
      expect(manager.score).toBe(100);
      expect(manager.hiScore).toBe(500);

      manager.addScore(450); // total 550
      expect(manager.score).toBe(550);
      expect(manager.hiScore).toBe(550);
    });

    it('resets current score and lives, but retains the high score', () => {
      const manager = new ScoreManager(DifficultyMode.ROOKIE);
      manager.addScore(300);
      manager.loseLife();

      expect(manager.score).toBe(300);
      expect(manager.lives).toBe(2);
      expect(manager.hiScore).toBe(300);

      manager.reset();
      expect(manager.score).toBe(0);
      expect(manager.lives).toBe(3);
      expect(manager.hiScore).toBe(300);
    });
  });

  describe('Life Management & Boundary Constraints', () => {
    it('caps maximum lives at 3', () => {
      const manager = new ScoreManager();
      expect(manager.lives).toBe(3);

      manager.gainLife();
      expect(manager.lives).toBe(3); // capped at 3
    });

    it('decrements lives normally', () => {
      const manager = new ScoreManager();
      manager.loseLife();
      expect(manager.lives).toBe(2);

      manager.loseLife();
      expect(manager.lives).toBe(1);
    });

    it('caps minimum lives at 0 and handles game over correctly', () => {
      const manager = new ScoreManager();
      expect(manager.isGameOver).toBe(false);

      manager.loseLife(); // 2
      expect(manager.isGameOver).toBe(false);

      manager.loseLife(); // 1
      expect(manager.isGameOver).toBe(false);

      manager.loseLife(); // 0
      expect(manager.lives).toBe(0);
      expect(manager.isGameOver).toBe(true);

      // Try losing another life when already at 0
      manager.loseLife();
      expect(manager.lives).toBe(0); // remains 0
      expect(manager.isGameOver).toBe(true);
    });

    it('allows recovering lives from 0 but updates game over status', () => {
      const manager = new ScoreManager();
      manager.loseLife();
      manager.loseLife();
      manager.loseLife();
      expect(manager.isGameOver).toBe(true);

      manager.gainLife();
      expect(manager.lives).toBe(1);
      expect(manager.isGameOver).toBe(false);
    });
  });

  describe('Leaderboard Persisting and Sorting', () => {
    it('saves initials correctly formatted (upper cased and trimmed)', () => {
      const manager = new ScoreManager(DifficultyMode.ROOKIE);
      manager.addScore(200);

      manager.saveScore('abc');
      let scores = manager.getTopScores();
      expect(scores.length).toBe(1);
      expect(scores[0]).toEqual({ initials: 'ABC', score: 200 });

      // Test long initials
      manager.addScore(100); // score = 300
      manager.saveScore('xyzlmnop');
      scores = manager.getTopScores();
      expect(scores.length).toBe(2);
      expect(scores[0]).toEqual({ initials: 'XYZ', score: 300 });

      // Test fallback to AAA on null initials
      manager.addScore(100); // score = 400
      manager.saveScore(null as any);
      scores = manager.getTopScores();
      expect(scores[0]).toEqual({ initials: 'AAA', score: 400 });
    });

    it('sorts top scores in descending order', () => {
      const manager = new ScoreManager(DifficultyMode.ROOKIE);

      manager.addScore(100);
      manager.saveScore('AAA');

      manager.reset();
      manager.addScore(300);
      manager.saveScore('BBB');

      manager.reset();
      manager.addScore(200);
      manager.saveScore('CCC');

      const scores = manager.getTopScores();
      expect(scores).toEqual([
        { initials: 'BBB', score: 300 },
        { initials: 'CCC', score: 200 },
        { initials: 'AAA', score: 100 },
      ]);
    });

    it('caps leaderboard entries to a maximum of 10', () => {
      const manager = new ScoreManager(DifficultyMode.ROOKIE);

      // Save 12 scores
      for (let i = 1; i <= 12; i++) {
        manager.reset();
        manager.addScore(i * 100);
        manager.saveScore(`P${i}`);
      }

      const scores = manager.getTopScores();
      expect(scores.length).toBe(10);
      // The lowest scores (100 and 200) should be dropped.
      // Top score should be 1200 (P12), bottom score should be 300 (P3)
      expect(scores[0]).toEqual({ initials: 'P12', score: 1200 });
      expect(scores[9]).toEqual({ initials: 'P3', score: 300 });
    });

    it('isolates leaderboards between difficulty modes', () => {
      const rookieManager = new ScoreManager(DifficultyMode.ROOKIE);
      rookieManager.addScore(500);
      rookieManager.saveScore('ROO');

      const pilotManager = new ScoreManager(DifficultyMode.PILOT);
      pilotManager.addScore(800);
      pilotManager.saveScore('PIL');

      const aceManager = new ScoreManager(DifficultyMode.ACE);
      aceManager.addScore(1200);
      aceManager.saveScore('ACE');

      // Verify each only gets their respective scores
      expect(rookieManager.getTopScores()).toEqual([{ initials: 'ROO', score: 500 }]);
      expect(pilotManager.getTopScores()).toEqual([{ initials: 'PIL', score: 800 }]);
      expect(aceManager.getTopScores()).toEqual([{ initials: 'ACE', score: 1200 }]);

      // Verify loading on initialization works per mode
      const rookie2 = new ScoreManager(DifficultyMode.ROOKIE);
      expect(rookie2.hiScore).toBe(500);

      const pilot2 = new ScoreManager(DifficultyMode.PILOT);
      expect(pilot2.hiScore).toBe(800);

      const ace2 = new ScoreManager(DifficultyMode.ACE);
      expect(ace2.hiScore).toBe(1200);
    });

    it('gracefully handles corrupted JSON in localStorage', () => {
      const rookieKey = 'aeon-pulse-scores-rookie';
      store[rookieKey] = 'corrupted-non-json';

      const manager = new ScoreManager(DifficultyMode.ROOKIE);
      // Should not throw on init, and hiScore should be 0
      expect(manager.hiScore).toBe(0);
      expect(manager.getTopScores()).toEqual([]);
    });

    it('gracefully handles localStorage exceptions on write', () => {
      const manager = new ScoreManager(DifficultyMode.ROOKIE);
      manager.addScore(200);

      // Force setItem to throw
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not crash when saving
      expect(() => manager.saveScore('AAA')).not.toThrow();
    });
  });
});
