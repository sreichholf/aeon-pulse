import type { RenderScenario } from '../types.ts';

const DEFAULT_FLAGS: Record<string, string> = Object.freeze({
  testAudio: 'off',
  testProbe: '1',
});

/**
 * Build a URL with the default browser-test flags applied.
 *
 * Defaults:
 * - `testAudio=off`
 * - `testProbe=1`
 *
 * Explicit entries in `flags` override the defaults. When `baseUrl` is omitted a
 * relative URL is returned, which Playwright resolves against `use.baseURL`.
 */
export function buildUrl(
  path = '/',
  flags: Record<string, string> = {},
  baseUrl?: string,
): string {
  const resolvedPath = path.startsWith('/') ? path : `/${path}`;
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(DEFAULT_FLAGS)) {
    if (!(key in flags)) {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(flags)) {
    params.set(key, value);
  }

  const query = params.toString();
  const relativeUrl = query ? `${resolvedPath}?${query}` : resolvedPath;

  if (!baseUrl) {
    return relativeUrl;
  }

  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${relativeUrl}`;
}

/**
 * Build a scenario URL, applying level/weapon-tier flags plus any extra runtime
 * flags (e.g. `renderStats=1`, `invincible=1`).
 */
export function buildScenarioUrl(
  scenario: RenderScenario,
  extraFlags: Record<string, string> = {},
): string {
  return buildUrl('/', {
    ...extraFlags,
    level: scenario.levelId,
    weaponTier: String(scenario.weaponTier),
  });
}
