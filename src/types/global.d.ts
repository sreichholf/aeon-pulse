import type { GameState } from '../types.ts';

export {};

declare global {
  interface Window {
    __aeonTestProbe?: {
      readonly ready: boolean;
      readonly state: GameState | null;
      readonly currentLevel: string | null;
      readonly fpsText: string;
      readonly webglReady: boolean;
      readonly testAudioSuppressed: boolean;
      readonly consoleErrors: readonly string[];
    };
  }
}
