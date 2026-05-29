export const GAME_WIDTH  = 960;
export const GAME_HEIGHT = 540;

// Temporary build-time switch for exposing all title-screen options in production.
export const ENABLE_ADVANCED_TITLE_OPTIONS = true;

export const ENABLE_RENDER_STATS = false;
export const ENABLE_INVINCIBLE_PLAYER = false;

export function isRuntimeFlagEnabled(name: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;

  const raw = new URLSearchParams(window.location.search).get(name);
  if (raw === null) return fallback;

  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}
