import { test, expect } from '../fixtures/AeonPage.ts';

/**
 * Smoke tests for the Tactical Database viewer.
 *
 * These tests verify that the viewer can be opened from the title screen,
 * renders real geometry, and can be cycled without surfacing console errors.
 */

const VIEWER_SETTLE_MS = 3000;
const SAMPLE_INTERVAL_MS = 750;

test('tactical database: opens from title and renders', async ({
  aeonPage,
  renderStats,
}) => {
  test.setTimeout(30000);

  await aeonPage.goto();
  await aeonPage.waitForState(['TITLE']);

  await aeonPage.pressKey('v');
  await aeonPage.waitForState(['VIEWER']);

  // Let the viewer settle and render a few frames.
  await new Promise((resolve) => setTimeout(resolve, VIEWER_SETTLE_MS));

  const stats = await renderStats.snapshot();
  expect(stats.state).toBe('VIEWER');
  expect(stats.calls).toBeGreaterThan(0);
  expect(stats.triangles).toBeGreaterThan(0);

  await aeonPage.pressKey('Escape');
  await aeonPage.waitForState(['TITLE']);

  expect(await aeonPage.getConsoleErrors()).toEqual([]);
});

test('tactical database: cycles without console errors', async ({
  aeonPage,
  renderStats,
  page,
}) => {
  test.setTimeout(30000);

  await aeonPage.goto();
  await aeonPage.waitForState(['TITLE']);

  await aeonPage.pressKey('v');
  await aeonPage.waitForState(['VIEWER']);

  const samples: Awaited<ReturnType<typeof renderStats.snapshot>>[] = [];
  for (let i = 0; i < 3; i++) {
    const sample = await renderStats.snapshot();
    samples.push(sample);
    expect(
      sample.calls,
      `sample ${i + 1} should have rendered draw calls`,
    ).toBeGreaterThan(0);
    expect(
      sample.triangles,
      `sample ${i + 1} should have rendered triangles`,
    ).toBeGreaterThan(0);

    if (i < 2) {
      await page.waitForTimeout(SAMPLE_INTERVAL_MS);
    }
  }

  // Cycle pages back and forth; both directions should remain error-free.
  await aeonPage.pressKey('ArrowRight');
  await page.waitForTimeout(500);
  await aeonPage.pressKey('ArrowLeft');
  await page.waitForTimeout(500);

  const final = await renderStats.snapshot();
  expect(final.calls).toBeGreaterThan(0);
  expect(final.triangles).toBeGreaterThan(0);

  expect(await aeonPage.getConsoleErrors()).toEqual([]);
});
