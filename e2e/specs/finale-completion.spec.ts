import { test, expect } from '../fixtures/AeonPage.ts';
import { IMPLEMENTED_LEVELS } from '../../src/campaign/Campaign.ts';

/**
 * ARCH-7 verification: boss-death level completion is deferred out of the tick
 * stack. These specs kill the finale boss directly and assert the run reaches
 * LEVEL_COMPLETE without console errors, plus a non-finale exit-window
 * regression check.
 */

const RUN_FLAGS = Object.freeze({
  invincible: '1',
  renderStats: '1',
});

const BOSS_SPAWN_TIMEOUT_MS = 12000;
const LEVEL_COMPLETE_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 100;

const FINALE_LEVELS = IMPLEMENTED_LEVELS.filter((level) => level.isFinale);

test.describe('finale boss completion (ARCH-7)', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const level of FINALE_LEVELS) {
    test(`${level.id} finale boss death transitions to LEVEL_COMPLETE`, async ({
      aeonPage,
      page,
    }) => {
      test.setTimeout(LEVEL_COMPLETE_TIMEOUT_MS + BOSS_SPAWN_TIMEOUT_MS);

      await aeonPage.startLevel({
        levelId: level.id,
        weaponTier: 5,
        extraFlags: RUN_FLAGS,
      });
      await aeonPage.waitForState(['PLAYING']);
      await aeonPage.skipToBoss();

      await expect.poll(
        async () =>
          page.evaluate(() => {
            const run = window.game?._run as Record<string, unknown> | undefined;
            const boss = run?._boss as { _alive?: boolean; _dying?: boolean } | null | undefined;
            return boss != null && boss._alive === true && boss._dying !== true;
          }),
        { timeout: BOSS_SPAWN_TIMEOUT_MS, intervals: [POLL_INTERVAL_MS] },
      ).toBe(true);

      await page.evaluate(() => {
        const run = window.game?._run as Record<string, unknown> | undefined;
        const boss = run?._boss as
          | { _startDying: () => void }
          | null
          | undefined;
        if (!boss) throw new Error('boss missing at kill time');
        boss._startDying();
      });

      await aeonPage.waitForState(['LEVEL_COMPLETE'], LEVEL_COMPLETE_TIMEOUT_MS);

      const consoleErrors = await aeonPage.getConsoleErrors();
      expect(consoleErrors, `unexpected console errors in ${level.id} finale death`).toEqual([]);
    });
  }

  test('1-1 non-finale exit window transitions to LEVEL_COMPLETE (regression)', async ({
    aeonPage,
    page,
  }) => {
    test.setTimeout(LEVEL_COMPLETE_TIMEOUT_MS + 15000);

    await aeonPage.startLevel({
      levelId: '1-1',
      weaponTier: 5,
      extraFlags: RUN_FLAGS,
    });
    await aeonPage.waitForState(['PLAYING']);

    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      const run = window.game?._run as { completeLevel?: () => void } | undefined;
      if (!run?.completeLevel) throw new Error('completeLevel missing on run');
      run.completeLevel();
    });

    await aeonPage.waitForState(['LEVEL_COMPLETE'], LEVEL_COMPLETE_TIMEOUT_MS);

    const consoleErrors = await aeonPage.getConsoleErrors();
    expect(consoleErrors, 'unexpected console errors in 1-1 exit window').toEqual([]);
  });
});
