import { test, expect } from '../fixtures/AeonPage.ts';

/**
 * Smoke test for v2 solid props and Sector corridor margins.
 *
 * Boots levels that contain solid prop placements, lets them run for a few
 * seconds, and asserts the game does not crash, console stays clean, and
 * render stats show prop objects. This is not a substitute for manual feel
 * playtesting, but it verifies the new seams do not break boot, collision,
 * or render paths.
 */

const SOLID_PROP_LEVELS = [
  { levelId: '1-4', sector: 'cargoLane', propKind: 'Hull Bulkhead' },
  { levelId: '2-3', sector: 'pressHall', propKind: 'Cooling Plug' },
  { levelId: '3-3', sector: 'nursery', propKind: 'Bone Dam' },
  { levelId: '4-4', sector: 'ashFalls', propKind: 'Basalt Gate' },
  { levelId: '4-5', sector: 'calderaHeart', propKind: 'Basalt Gate (fullGate)' },
];

const MAX_WAIT_MS = 25000;
const TICK_MS = 500;
const MOVE_SEQUENCE = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

const FLAGS = Object.freeze({
  invincible: '1',
  renderStats: '1',
});

for (const { levelId, sector, propKind } of SOLID_PROP_LEVELS) {
  test(`solid prop smoke: ${levelId} ${sector} (${propKind})`, async ({ aeonPage, renderStats, page }) => {
    test.setTimeout(MAX_WAIT_MS + 30000);

    await aeonPage.startLevel({ levelId, weaponTier: 5, extraFlags: FLAGS });
    await aeonPage.waitForState(['PLAYING']);

    const samples: Awaited<ReturnType<typeof renderStats.snapshot>>[] = [];
    let maxPropObjects = 0;
    let firing = false;

    // Move around without firing at first.  Once a prop renders, hold fire so
    // bullets/body can actually interact with it.  Keep sampling until the prop
    // scrolls onscreen or we hit the max wait.
    const started = Date.now();
    while (Date.now() - started < MAX_WAIT_MS) {
      const sample = await renderStats.snapshot();
      samples.push(sample);
      maxPropObjects = Math.max(maxPropObjects, sample.categories['prop'] ?? 0);

      if (!firing && maxPropObjects > 0) {
        firing = true;
        await page.keyboard.down('Space');
      }

      const tick = Math.floor((Date.now() - started) / TICK_MS);
      await page.keyboard.press(MOVE_SEQUENCE[tick % MOVE_SEQUENCE.length]!);
      await page.waitForTimeout(TICK_MS);
    }

    if (firing) {
      await page.keyboard.up('Space');
    }

    // The level should still be running.
    const finalState = await aeonPage.getProbe<string>('state');
    expect(finalState).toBe('PLAYING');

    // No console errors during the run.
    const consoleErrors = await aeonPage.getConsoleErrors();
    expect(consoleErrors).toEqual([]);

    // Props should have rendered at some point.
    expect(
      maxPropObjects,
      `expected props to render in ${levelId} ${sector} (${propKind})`,
    ).toBeGreaterThan(0);

    // Basic sanity: WebGL stayed alive and objects were rendered.
    const lastSample = samples[samples.length - 1]!;
    expect(lastSample.calls).toBeGreaterThan(0);
    expect(lastSample.triangles).toBeGreaterThan(0);
  });
}
