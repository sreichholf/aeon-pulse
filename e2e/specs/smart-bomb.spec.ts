import { test, expect } from '../fixtures/AeonPage.ts';
import type { Page } from '@playwright/test';

/**
 * Smoke test for the Smart Bomb (Action.BOMB / Shift).
 *
 * Boots a dense enemy level directly, lets bullets and enemies spawn, reads the
 * playtest probe's bullet count, triggers the bomb, and asserts that bullets are
 * cleared, the console is clean, and the renderer stays alive.
 */

const LEVEL_ID = '4-4';
const WEAPON_TIER = 5;
const SPAWN_DURATION_MS = 5000;
const POST_BOMB_WAIT_MS = 2000;
const MOVE_SEQUENCE = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

const FLAGS = Object.freeze({
  invincible: '1',
  renderStats: '1',
});

interface PlaytestStateRun {
  bulletCount: number;
  enemyCount: number;
  bossActive: boolean;
}

interface PlaytestState {
  state: string | null;
  bombs: number;
  run: PlaytestStateRun | null;
}

async function readPlaytestState(page: Page): Promise<PlaytestState> {
  return page.evaluate(() => {
    const el = document.getElementById('aeon-playtest-state');
    const raw = el?.textContent ?? '{}';
    return JSON.parse(raw) as PlaytestState;
  });
}

test('smart bomb clears enemy bullets', async ({ aeonPage, renderStats, page }) => {
  test.setTimeout(60000);

  await aeonPage.startLevel({ levelId: LEVEL_ID, weaponTier: WEAPON_TIER, extraFlags: FLAGS });
  await aeonPage.waitForState(['PLAYING']);

  // Move around and let bullets/enemies spawn for a few seconds.
  const started = Date.now();
  while (Date.now() - started < SPAWN_DURATION_MS) {
    const tick = Math.floor((Date.now() - started) / 250);
    await page.keyboard.press(MOVE_SEQUENCE[tick % MOVE_SEQUENCE.length]!);
    await page.waitForTimeout(250);
  }

  const baselineState = await readPlaytestState(page);
  const baselineBulletCount = baselineState.run?.bulletCount ?? 0;
  expect(
    baselineBulletCount,
    'expected enemy bullets to exist before triggering smart bomb',
  ).toBeGreaterThan(0);
  expect(baselineState.bombs, 'expected a bomb to be available before triggering').toBeGreaterThan(0);

  // Trigger the Smart Bomb.
  await page.keyboard.press('Shift');

  await expect
    .poll(async () => (await readPlaytestState(page)).bombs, {
      timeout: POST_BOMB_WAIT_MS,
      intervals: [100],
    })
    .toBe(baselineState.bombs - 1);

  const postBombState = await readPlaytestState(page);
  expect(postBombState.state).toBe('PLAYING');
  expect(postBombState.run?.bulletCount ?? Infinity).toBeLessThan(baselineBulletCount);

  // Confirm the renderer stayed alive.
  const finalStats = await renderStats.snapshot();
  expect(finalStats.calls).toBeGreaterThan(0);
  expect(finalStats.triangles).toBeGreaterThan(0);

  // No console errors during the run.
  const consoleErrors = await aeonPage.getConsoleErrors();
  expect(consoleErrors).toEqual([]);
});
