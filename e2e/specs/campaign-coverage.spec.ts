import { test, expect } from '../fixtures/AeonPage.ts';
import { IMPLEMENTED_LEVELS, type CampaignLevelRecord } from '../../src/campaign/Campaign.ts';

/**
 * Campaign coverage smoke tests.
 *
 * Boots every implemented campaign level directly, lets it run under invincible,
 * render-stat-enabled conditions, and asserts the game stays alive and renders.
 * For chapter finales, additionally polls until the boss becomes active.
 */

const RUN_FLAGS = Object.freeze({
  invincible: '1',
  renderStats: '1',
});

/** Short settle time after PLAYING begins before snapshotting the run. */
const POST_PLAYING_DELAY_MS = 2500;

/** Wait for the boss to appear after fast-forwarding to its spawn trigger. */
const BOSS_SPAWN_TIMEOUT_MS = 5000;
const BOSS_POLL_INTERVAL_MS = 100;

function describeLevel(level: CampaignLevelRecord): string {
  return `${level.id} (${level.chapterName})`;
}

test.describe('campaign coverage', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const level of IMPLEMENTED_LEVELS) {
    test(`campaign coverage: ${describeLevel(level)} boots to PLAYING`, async ({
      aeonPage,
      renderStats,
      page,
    }) => {
      test.setTimeout(45000);

      await aeonPage.startLevel({
        levelId: level.id,
        weaponTier: 1,
        extraFlags: RUN_FLAGS,
      });
      await aeonPage.waitForState(['PLAYING']);

      await page.waitForTimeout(POST_PLAYING_DELAY_MS);

      const consoleErrors = await aeonPage.getConsoleErrors();
      expect(consoleErrors, `unexpected console errors in ${level.id}`).toEqual([]);

      const state = await aeonPage.getProbe<string>('state');
      expect(
        ['PLAYING', 'LEVEL_COMPLETE'],
        `expected ${level.id} to remain running, got ${state}`,
      ).toContain(state);

      const sample = await renderStats.snapshot();
      expect(sample.calls, `expected draw calls in ${level.id}`).toBeGreaterThan(0);
      expect(sample.triangles, `expected triangles in ${level.id}`).toBeGreaterThan(0);
    });
  }

  const FINALE_LEVELS = IMPLEMENTED_LEVELS.filter((level) => level.isFinale);

  for (const level of FINALE_LEVELS) {
    test(`campaign coverage: ${level.id} finale spawns the boss`, async ({
      aeonPage,
      renderStats,
      page,
    }) => {
      test.setTimeout(BOSS_SPAWN_TIMEOUT_MS + 10000);

      await aeonPage.startLevel({
        levelId: level.id,
        weaponTier: 5,
        extraFlags: RUN_FLAGS,
      });
      await aeonPage.waitForState(['PLAYING']);

      await aeonPage.skipToBoss();

      const readBossActive = () =>
        page.evaluate(() => {
          const el = document.getElementById('aeon-playtest-state');
          if (!el?.textContent) return false;
          try {
            const parsed = JSON.parse(el.textContent) as { run?: { bossActive?: unknown } };
            return parsed.run?.bossActive === true;
          } catch {
            return false;
          }
        });

      await expect
        .poll(readBossActive, {
          timeout: BOSS_SPAWN_TIMEOUT_MS,
          intervals: [BOSS_POLL_INTERVAL_MS],
        })
        .toBe(true);

      const sample = await renderStats.snapshot();
      expect(
        sample.calls,
        `expected draw calls once boss spawned in ${level.id}`,
      ).toBeGreaterThan(0);
      expect(
        sample.triangles,
        `expected triangles once boss spawned in ${level.id}`,
      ).toBeGreaterThan(0);

      const consoleErrors = await aeonPage.getConsoleErrors();
      expect(
        consoleErrors,
        `unexpected console errors in ${level.id} finale`,
      ).toEqual([]);

      const state = await aeonPage.getProbe<string>('state');
      expect(
        ['PLAYING', 'LEVEL_COMPLETE', 'GAME_OVER'],
        `expected ${level.id} to remain running after boss spawn, got ${state}`,
      ).toContain(state);
    });
  }
});
