import type { Page } from '@playwright/test';
import type { RenderStatsSnapshot } from '../types.ts';

/**
 * Reads the runtime render-stats surface exposed by the game.
 *
 * Mirrors the read path in `scripts/collect-render-stats.mjs`, but talks to the
 * page through Playwright `page.evaluate` instead of CDP.
 */
export class RenderStatsDriver {
  constructor(private readonly page: Page) {}

  async snapshot(): Promise<RenderStatsSnapshot> {
    return this.page.evaluate(() => {
      const game = window.game;
      const scene = game?.scene;
      const objectStats = scene?.getSceneObjectStats?.();
      const renderInfo = scene?.getRenderInfo?.();
      const bulletStats = game?._run?.getBulletStatsSnapshot?.();
      const fpsElement = document.getElementById('fps-counter');

      return {
        fps: game?._currentFps ?? 0,
        calls: renderInfo?.calls ?? 0,
        triangles: renderInfo?.triangles ?? 0,
        objectUnits: objectStats?.total ?? 0,
        bullets: bulletStats?.total ?? 0,
        renderUnits: bulletStats?.renderUnits ?? 0,
        categories: objectStats?.byCategory ?? {},
        details: objectStats?.byDetail ?? {},
        sources: bulletStats?.bySourceKey ?? {},
        sourceRenderUnits: bulletStats?.renderUnitsBySourceKey ?? {},
        state: game?._state ?? null,
        level: game?.currentLevel?.id ?? null,
        raw: fpsElement?.innerText ?? '',
        peakComposition: game?.getPeakEnemyComposition?.() ?? null,
      };
    });
  }
}
