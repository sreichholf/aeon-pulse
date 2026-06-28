/// <reference types="vite/client" />

export const GAME_WIDTH  = 960;
export const GAME_HEIGHT = 540;

// Expose title-screen developer selectors in local development, but keep production clean.
// Guard the Vite-only `import.meta.env` so this file can be imported in test runners
// that execute in a plain Node/Playwright context.
export const ENABLE_ADVANCED_TITLE_OPTIONS = (() => {
  try {
    return import.meta.env.DEV === true;
  } catch {
    return false;
  }
})();
export const ENABLE_PLAYTEST_STATE_PROBE = isRuntimeFlagEnabled('testProbe', false);

export const ENABLE_RENDER_STATS = false;
export const ENABLE_INVINCIBLE_PLAYER = false;

export function getRuntimeFlagValue(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function getClampedRuntimeFlagInteger(name: string, min: number, max: number): number | null {
  const raw = getRuntimeFlagValue(name);
  if (raw === null) return null;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;

  return Math.min(max, Math.max(min, parsed));
}

export function isRuntimeFlagEnabled(name: string, fallback: boolean): boolean {
  const raw = getRuntimeFlagValue(name);
  if (raw === null) return fallback;

  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function isBrowserTestAudioSuppressedByDefault(): boolean {
  return getRuntimeFlagValue('testAudio')?.toLowerCase() === 'off';
}
