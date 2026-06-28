import { test, expect } from '../fixtures/AeonPage.ts';

/**
 * Weapon tier smoke test.
 *
 * Boots a calm level at weapon tiers 1, 3, and 5, holds fire briefly, and
 * verifies that player projectiles render, WebGL stays alive, the game
 * remains in PLAYING, and the console is clean.
 */

const FLAGS = Object.freeze({
  invincible: '1',
  renderStats: '1',
});

const WEAPON_TIERS = [1, 3, 5] as const;

function expectedPlayerSourceForTier(weaponTier: (typeof WEAPON_TIERS)[number]): string {
  return weaponTier === 5 ? 'playerWave' : 'player';
}

for (const weaponTier of WEAPON_TIERS) {
  test(`weapon tier ${weaponTier} fires and renders projectiles`, async ({ aeonPage, renderStats, page }) => {
    test.setTimeout(30000);

    await aeonPage.startLevel({ levelId: '1-1', weaponTier, extraFlags: FLAGS });
    await aeonPage.waitForState(['PLAYING']);

    await page.keyboard.down('Space');
    await page.waitForTimeout(1000);
    await page.keyboard.up('Space');

    const sample = await renderStats.snapshot();
    const expectedSource = expectedPlayerSourceForTier(weaponTier);

    const consoleErrors = await aeonPage.getConsoleErrors();
    expect(consoleErrors).toEqual([]);

    expect(
      sample.sources[expectedSource] ?? 0,
      `expected tier ${weaponTier} to emit ${expectedSource} projectiles`,
    ).toBeGreaterThan(0);

    expect(sample.triangles).toBeGreaterThan(0);
    expect(sample.calls).toBeGreaterThan(0);

    const gameState = await aeonPage.getProbe<string>('state');
    expect(gameState).toBe('PLAYING');

  });
}
