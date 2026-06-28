import { test, expect } from '../fixtures/AeonPage.ts';

test('title screen starts level 1-1', async ({ aeonPage }) => {
  await aeonPage.goto();
  await aeonPage.waitForState(['TITLE']);

  await aeonPage.pressKey('Space');
  await aeonPage.waitForState(['LEVEL_START', 'PLAYING', 'LEVEL_COMPLETE', 'GAME_OVER']);

  const state = await aeonPage.getProbe<string>('state').catch(() => null);
  if (state === 'LEVEL_START') {
    await aeonPage.pressKey('Space');
  }

  await aeonPage.waitForState(['PLAYING']);

  await expect.poll(() => aeonPage.getProbe('currentLevel')).toBe('1-1');

  const consoleErrors = await aeonPage.getConsoleErrors();
  expect(consoleErrors).toEqual([]);
});
