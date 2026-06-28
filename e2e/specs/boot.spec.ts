import { test, expect } from '../fixtures/AeonPage.ts';

test('loads the game and exposes a ready probe', async ({ aeonPage }) => {
  await aeonPage.goto();
  await aeonPage.waitForBoot(30000);

  await expect.poll(() => aeonPage.getProbe('webglReady')).toBe(true);

  const consoleErrors = await aeonPage.getConsoleErrors();
  expect(consoleErrors).toEqual([]);

  const fpsCounter = aeonPage.getFpsCounterLocator();
  await expect(fpsCounter).toBeVisible();
});
