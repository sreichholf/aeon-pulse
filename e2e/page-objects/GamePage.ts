import type { Page } from '@playwright/test';
import { buildUrl } from '../helpers/urls.ts';
import type { ProbeShape } from '../types.ts';

const BOOT_TIMEOUT_MS = 15000;
const DEFAULT_STATE_TIMEOUT_MS = 10000;
const START_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 100;

/**
 * Page object wrapping the AEON PULSE game surface.
 *
 * All navigation defaults to `?testAudio=off&testProbe=1`. Use the helper
 * fixtures in `e2e/fixtures/AeonPage.ts` to inject this into tests.
 */
export class GamePage {
  constructor(private readonly page: Page) {}

  /** Navigate to the game with default browser-test flags plus any overrides. */
  async goto(flags: Record<string, string> = {}): Promise<void> {
    const url = buildUrl('/', flags);
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  /** Wait until the test probe reports the game is ready and WebGL is up. */
  async waitForBoot(timeoutMs = BOOT_TIMEOUT_MS): Promise<void> {
    await this._poll(
      async () => {
        const probe = await this._readProbe();
        return probe?.ready === true && probe?.webglReady === true ? true : undefined;
      },
      timeoutMs,
      'game boot',
    );
  }

  /**
   * Wait until `probe.state` is one of the provided states.
   */
  async waitForState(states: string[], timeoutMs = DEFAULT_STATE_TIMEOUT_MS): Promise<void> {
    const expected = new Set(states);
    await this._poll(
      async () => {
        const state = await this.getProbe<string>('state').catch(() => null);
        return state !== null && expected.has(state) ? true : undefined;
      },
      timeoutMs,
      `state to be one of: ${states.join(', ')}`,
    );
  }

  /** Read any field from `window.__aeonTestProbe` by name. */
  async getProbe<T = unknown>(key: keyof ProbeShape): Promise<T> {
    return this.page.evaluate((k) => {
      const probe = window.__aeonTestProbe as Record<string, unknown> | undefined;
      return (probe?.[k] ?? null) as T;
    }, key);
  }

  /** Read accumulated console errors captured by the test probe. */
  async getConsoleErrors(): Promise<string[]> {
    return this.page.evaluate(() => window.__aeonTestProbe?.consoleErrors ?? []);
  }

  /**
   * Start a level directly via query-string flags.
   *
   * Navigates to `/?level=<levelId>&weaponTier=<weaponTier>` (plus defaults),
   * waits for boot, then waits for PLAYING (pressing Space if the game pauses
   * on LEVEL_START).
   */
  async startLevel(
    opts: { levelId?: string; weaponTier?: number; extraFlags?: Record<string, string> } = {},
  ): Promise<void> {
    const flags: Record<string, string> = { ...(opts.extraFlags ?? {}) };
    if (opts.levelId) {
      flags.level = opts.levelId;
    }
    if (opts.weaponTier !== undefined) {
      flags.weaponTier = String(opts.weaponTier);
    }

    await this.goto(flags);
    await this.waitForBoot();
    await this.waitForState(
      ['LEVEL_START', 'PLAYING', 'LEVEL_COMPLETE', 'GAME_OVER'],
      START_TIMEOUT_MS,
    );

    const state = await this.getProbe<string>('state').catch(() => null);
    if (state === 'LEVEL_START') {
      await this.pressKey('Space');
      await this.waitForState(
        ['PLAYING', 'LEVEL_COMPLETE', 'GAME_OVER'],
        DEFAULT_STATE_TIMEOUT_MS,
      );
    }
  }

  /** Read the on-screen FPS/render-counter text. Falls back to probe.fpsText. */
  async readFpsCounter(): Promise<string> {
    const fromDom = await this.getFpsCounterLocator().textContent().catch(() => null);
    if (fromDom !== null && fromDom.length > 0) {
      return fromDom;
    }
    return this.getProbe<string>('fpsText').catch(() => '');
  }

  /** Locate the on-screen FPS/render-counter element. */
  getFpsCounterLocator() {
    return this.page.locator('#fps-counter');
  }

  /**
   * Fast-forward the current finale level to its boss spawn trigger.
   *
   * This is test-only: it reaches into the live `LevelManager` and advances
   * `scrollX` past `bossAt` while marking all waves as drained, so the next
   * update immediately calls `spawnBoss()`.
   */
  async skipToBoss(): Promise<void> {
    await this.page.evaluate(() => {
      const game = window.game as Record<string, unknown> | undefined;
      const run = game?._run as Record<string, unknown> | undefined;
      const levelManager = run?._levelManager as
        | {
            _bossAt: number;
            _scrollX: number;
            _waveIdx: number;
            _waves: { length: number };
          }
        | undefined;

      if (!levelManager) {
        throw new Error('LevelManager not available for skipToBoss');
      }

      levelManager._scrollX = levelManager._bossAt;
      levelManager._waveIdx = levelManager._waves.length;
    });
  }

  /** Dispatch a single key press (keyDown + keyUp) through Playwright. */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /** Locate the on-screen Test Audio Indicator (browser-test runs only). */
  getTestAudioIndicator() {
    return this.page.locator('#volume-control .test-audio-indicator');
  }

  private async _readProbe(): Promise<ProbeShape | undefined> {
    return this.page.evaluate(() => window.__aeonTestProbe);
  }

  private async _poll<T>(
    predicate: () => Promise<T | undefined | false>,
    timeoutMs: number,
    label: string,
  ): Promise<NonNullable<T>> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await predicate().catch(() => undefined);
      if (result !== undefined && result !== false) {
        return result as NonNullable<T>;
      }
      await this.page.waitForTimeout(POLL_INTERVAL_MS);
    }
    throw new Error(`Timed out waiting for ${label}`);
  }
}
