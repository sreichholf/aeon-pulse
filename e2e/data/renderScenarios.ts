import type { RenderScenario } from '../types.ts';

/**
 * Cross-chapter render-profiling scenarios.
 *
 * Mirrors the scenario list in `scripts/collect-render-stats.mjs`. Use
 * `getEffectiveScenarios()` to respect `SCENARIOS` and `DURATION_SCALE`
 * environment overrides.
 */
export const RENDER_SCENARIOS: RenderScenario[] = [
  // Cross-chapter baseline: level 4 of each chapter, no-fire + tier5 tap-fire.
  { name: 'L1-4 no-fire', levelId: '1-4', weaponTier: 1, durationMs: 30000, fireEveryMs: null },
  { name: 'L1-4 tier5 tap-fire', levelId: '1-4', weaponTier: 5, durationMs: 45000, fireEveryMs: 190 },
  { name: 'L2-4 no-fire', levelId: '2-4', weaponTier: 1, durationMs: 30000, fireEveryMs: null },
  { name: 'L2-4 tier5 tap-fire', levelId: '2-4', weaponTier: 5, durationMs: 45000, fireEveryMs: 190 },
  { name: 'L3-4 no-fire', levelId: '3-4', weaponTier: 1, durationMs: 30000, fireEveryMs: null },
  { name: 'L3-4 tier5 tap-fire', levelId: '3-4', weaponTier: 5, durationMs: 45000, fireEveryMs: 190 },
  { name: 'L4-4 no-fire', levelId: '4-4', weaponTier: 1, durationMs: 30000, fireEveryMs: null },
  { name: 'L4-4 tier5 tap-fire', levelId: '4-4', weaponTier: 5, durationMs: 45000, fireEveryMs: 190 },

  // Chapter 4 extension: full Volcanic chapter sweep at no-fire.
  { name: 'L4-1 no-fire', levelId: '4-1', weaponTier: 1, durationMs: 30000, fireEveryMs: null },
  { name: 'L4-2 no-fire', levelId: '4-2', weaponTier: 1, durationMs: 30000, fireEveryMs: null },
  { name: 'L4-3 no-fire', levelId: '4-3', weaponTier: 1, durationMs: 30000, fireEveryMs: null },
  { name: 'L4-5 no-fire', levelId: '4-5', weaponTier: 1, durationMs: 30000, fireEveryMs: null },
];

/** Parse `SCENARIOS` comma-separated env override (e.g. `L4-4 no-fire,L4-4 tier5 tap-fire`). */
export function getSelectedScenarioNames(): string[] {
  return (process.env.SCENARIOS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Parse `DURATION_SCALE` env override for shorter or longer profiling runs. */
export function getDurationScale(): number {
  const raw = Number.parseFloat(process.env.DURATION_SCALE ?? '1');
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

/**
 * Resolve the effective scenario list.
 *
 * When `SCENARIOS` is empty, all scenarios are returned. Durations are scaled
 * by `DURATION_SCALE` (default 1, minimum 1s).
 */
export function getEffectiveScenarios(): RenderScenario[] {
  const selected = new Set(getSelectedScenarioNames());
  const scale = getDurationScale();
  const scenarios =
    selected.size === 0
      ? RENDER_SCENARIOS
      : RENDER_SCENARIOS.filter((scenario) => selected.has(scenario.name));

  return scenarios.map((scenario) => ({
    ...scenario,
    durationMs: Math.max(1000, Math.round(scenario.durationMs * scale)),
  }));
}
