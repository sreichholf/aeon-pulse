/**
 * Shared type contracts for the AEON PULSE end-to-end test layer.
 */

/** Shape of `window.__aeonTestProbe` when `?testProbe=1` is active. */
export interface ProbeShape {
  ready: boolean;
  state: string | null;
  currentLevel: string | null;
  fpsText: string;
  webglReady: boolean;
  testAudioSuppressed: boolean;
  consoleErrors: string[];
}

/** Runtime render-stats snapshot, mirroring `scripts/collect-render-stats.mjs`. */
export interface RenderStatsSnapshot {
  fps: number;
  calls: number;
  triangles: number;
  objectUnits: number;
  bullets: number;
  renderUnits: number;
  categories: Record<string, number>;
  details: Record<string, number>;
  sources: Record<string, number>;
  sourceRenderUnits: Record<string, number>;
  state: string | null;
  level: string | null;
  raw: string;
  peakComposition?: Array<{ enemyType: string; bucket: string; batchCount: number; instanceCount: number; triangleCount: number }> | null;
}

/** A single render-profiling scenario. */
export interface RenderScenario {
  name: string;
  levelId: string;
  weaponTier: number;
  durationMs: number;
  fireEveryMs: number | null;
}

declare global {
  interface Window {
    /** Test probe exposed by `?testProbe=1`. */
    __aeonTestProbe?: ProbeShape;

    /** Live game instance mounted by `src/main.ts`. */
    game?: {
      _state: string | null;
      currentLevel?: { id: string } | null;
      _currentFps?: number;
      getPeakEnemyComposition?: () => Array<{ enemyType: string; bucket: string; batchCount: number; instanceCount: number; triangleCount: number }> | null;
      _run?: {
        getBulletStatsSnapshot?: () => {
          total: number;
          renderUnits: number;
          bySourceKey?: Record<string, number>;
          renderUnitsBySourceKey?: Record<string, number>;
        } | null;
      } | null;
      scene?: {
        getRenderInfo?: () => { calls?: number; triangles?: number } | null;
        getSceneObjectStats?: () => {
          total?: number;
          byCategory?: Record<string, number>;
          byDetail?: Record<string, number>;
        } | null;
      } | null;
    };
  }
}

export {};
