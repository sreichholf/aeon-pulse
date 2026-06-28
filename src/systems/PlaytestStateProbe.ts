import { ENABLE_PLAYTEST_STATE_PROBE } from '../constants.ts';
import type { GameState } from '../types.ts';
import type { EnemyBatchAttribution } from './EnemyInstancer.ts';

export interface PlaytestStateSnapshot {
  state: GameState | null;
  level: {
    id: string;
    chapterName: string;
    chapterNumber: number;
    levelNumber: number;
    isFinale: boolean;
  };
  fps: number;
  weaponTier: number;
  score: number;
  lives: number;
  bombs: number;
  shieldPips: number;
  shieldMax: number;
  audio: {
    isBrowserTestAudioRun: boolean;
    isTestAudioSuppressed: boolean;
  };
  run: {
    scrollX: number | null;
    enemyCount: number;
    bulletCount: number;
    powerupCount: number;
    effectCount: number;
    bossActive: boolean;
    isExitingLevel: boolean;
    enemiesByType: Record<string, number>;
  } | null;
  peakEnemyComposition: EnemyBatchAttribution[] | null;
}

let outputEl: HTMLElement | null = null;

function ensureOutputElement(): HTMLElement | null {
  if (!ENABLE_PLAYTEST_STATE_PROBE || typeof document === 'undefined') return null;

  outputEl = document.getElementById('aeon-playtest-state');
  if (!outputEl) {
    outputEl = document.createElement('pre');
    outputEl.id = 'aeon-playtest-state';
    outputEl.hidden = true;
    document.body.appendChild(outputEl);
  }
  return outputEl;
}

export function initPlaytestStateProbe(): void {
  if (!ENABLE_PLAYTEST_STATE_PROBE || typeof document === 'undefined') {
    outputEl?.remove();
    outputEl = null;
    return;
  }

  const el = ensureOutputElement();
  if (el) el.textContent = JSON.stringify({ state: null, ready: false });
}

export function writePlaytestStateProbe(snapshot: PlaytestStateSnapshot): void {
  const el = ensureOutputElement();
  if (!el) return;

  el.textContent = JSON.stringify({
    ready: true,
    updatedAtMs: Math.round(performance.now()),
    ...snapshot,
  });
}
