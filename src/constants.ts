export const GAME_WIDTH  = 960;
export const GAME_HEIGHT = 540;

// Expose title-screen developer selectors in local development, but keep production clean.
export const ENABLE_ADVANCED_TITLE_OPTIONS = import.meta.env.DEV;

export const ENABLE_RENDER_STATS = false;
export const ENABLE_INVINCIBLE_PLAYER = false;

export function isRuntimeFlagEnabled(name: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;

  const raw = new URLSearchParams(window.location.search).get(name);
  if (raw === null) return fallback;

  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}
