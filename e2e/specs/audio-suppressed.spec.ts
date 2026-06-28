import { test, expect } from '../fixtures/AeonPage.ts';

test('audio-suppressed run shows the test indicator and can toggle audio', async ({ aeonPage }) => {
  await aeonPage.goto();
  await aeonPage.waitForBoot();

  await expect.poll(() => aeonPage.getProbe('testAudioSuppressed')).toBe(true);

  const indicator = aeonPage.getTestAudioIndicator();
  await expect(indicator).toBeVisible();
  await expect(indicator).toContainText('TEST AUDIO OFF');

  await aeonPage.pressKey('M');

  await expect.poll(async () => aeonPage.getTestAudioIndicator().textContent()).toContain('TEST AUDIO ON');
});
