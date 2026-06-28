import { test as base } from '@playwright/test';
import { GamePage } from '../page-objects/GamePage.ts';
import { RenderStatsDriver } from '../page-objects/RenderStatsDriver.ts';

export interface AeonFixtures {
  /** High-level page object for interacting with the AEON PULSE game. */
  aeonPage: GamePage;

  /** Driver for reading runtime render stats. Only created when requested. */
  renderStats: RenderStatsDriver;
}

/**
 * Extended Playwright `test` fixture.
 *
 * Usage:
 * ```ts
 * import { test, expect } from '../fixtures/AeonPage.ts';
 *
 * test('boots', async ({ aeonPage }) => {
 *   await aeonPage.goto();
 *   await aeonPage.waitForBoot();
 * });
 * ```
 */
export const test = base.extend<AeonFixtures>({
  aeonPage: async ({ page }, use) => {
    const gamePage = new GamePage(page);
    await use(gamePage);
  },

  renderStats: async ({ page }, use) => {
    const driver = new RenderStatsDriver(page);
    await use(driver);
  },
});

export { expect } from '@playwright/test';
