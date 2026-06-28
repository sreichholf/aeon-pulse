import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test } from '../fixtures/AeonPage.ts';
import { getEffectiveScenarios } from '../data/renderScenarios.ts';
import { summarize } from '../helpers/summarize.ts';

const SAMPLE_INTERVAL_MS = 1000;
const LOOP_SLEEP_MS = 50;
const PROFILE_FLAGS = Object.freeze({
  renderStats: '1',
  invincible: '1',
});

const scenarios = getEffectiveScenarios();

test.describe.serial('render baseline', () => {
  if (scenarios.length === 0) {
    test('no scenarios selected', () => {
      test.skip(true, 'No scenarios are effective');
    });
    return;
  }

  for (const scenario of scenarios) {
    test(`${scenario.name} (${scenario.levelId}, tier ${scenario.weaponTier})`, async ({
      aeonPage,
      renderStats,
      page,
    }) => {
      test.setTimeout(scenario.durationMs + 30000);

      await aeonPage.startLevel({
        levelId: scenario.levelId,
        weaponTier: scenario.weaponTier,
        extraFlags: PROFILE_FLAGS,
      });

      const samples = [];
      const start = Date.now();
      let nextFire = 0;
      let nextSample = 0;

      while (Date.now() - start < scenario.durationMs) {
        const elapsed = Date.now() - start;

        if (scenario.fireEveryMs && elapsed >= nextFire) {
          await aeonPage.pressKey('Space');
          nextFire += scenario.fireEveryMs;
        }

        if (elapsed >= nextSample) {
          const parsed = await renderStats.snapshot();
          samples.push({ t: Math.round(elapsed / SAMPLE_INTERVAL_MS), ...parsed });
          nextSample += SAMPLE_INTERVAL_MS;
        }

        await page.waitForTimeout(LOOP_SLEEP_MS);
      }

      if (samples.length === 0) {
        throw new Error(`No render stats samples captured for ${scenario.name}`);
      }

      const summary = summarize(samples, scenario.name);
      const profile = { profileMode: 'baseline' as const, ...summary };

      const outPath = `.tmp/playwright-profile/${scenario.name}.json`;
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, JSON.stringify(profile, null, 2));

      console.log(JSON.stringify(profile));
    });
  }
});
