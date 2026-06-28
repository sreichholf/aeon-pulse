import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicCue } from '../../types.ts';
import { AudioManager } from './AudioManager.ts';

class AudioNodeMock {
  connect = vi.fn();
  disconnect = vi.fn();
}

class AudioParamMock {
  value = 1;
  setValueAtTime = vi.fn().mockReturnThis();
  linearRampToValueAtTime = vi.fn().mockReturnThis();
  exponentialRampToValueAtTime = vi.fn().mockReturnThis();
  cancelScheduledValues = vi.fn().mockReturnThis();
}

class OscillatorNodeMock extends AudioNodeMock {
  type = 'sine';
  frequency = new AudioParamMock();
  start = vi.fn();
  stop = vi.fn();
}

class GainNodeMock extends AudioNodeMock {
  gain = new AudioParamMock();
}

let constructedContexts = 0;

class AudioContextMock {
  currentTime = 0;
  state = 'running';
  destination = new AudioNodeMock();

  constructor() {
    constructedContexts += 1;
  }

  resume = vi.fn().mockResolvedValue(undefined);
  createOscillator = vi.fn(() => new OscillatorNodeMock());
  createGain = vi.fn(() => new GainNodeMock());
  createBiquadFilter = vi.fn(() => ({
    connect: vi.fn(),
    type: 'lowpass',
    frequency: new AudioParamMock(),
    Q: new AudioParamMock(),
  }));
  createBuffer = vi.fn(() => ({
    getChannelData: () => new Float32Array(16),
  }));
  createBufferSource = vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
  }));
}

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
};

describe('AudioManager browser test audio suppression', () => {
  beforeEach(() => {
    constructedContexts = 0;
    vi.stubGlobal('AudioContext', AudioContextMock);
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts suppressed for browser test runs without creating an AudioContext', () => {
    const audio = new AudioManager({ startTestAudioSuppressed: true });

    audio.startChargeHum();
    audio.stopMusic();

    expect(audio.isBrowserTestAudioRun).toBe(true);
    expect(audio.isTestAudioSuppressed).toBe(true);
    expect(constructedContexts).toBe(0);
  });

  it('blocks sound-effect playback while test audio is suppressed', () => {
    const audio = new AudioManager({ startTestAudioSuppressed: true });
    const sfxPlay = vi.fn();
    (audio as any)._sfx = { play: sfxPlay };

    audio.play('menuSelect');

    expect(sfxPlay).not.toHaveBeenCalled();
  });

  it('replays the deferred music cue when test audio is re-enabled', () => {
    const audio = new AudioManager({ startTestAudioSuppressed: true });
    const playCue = vi.fn();
    (audio as any)._sequencer = {
      playCue,
      stop: vi.fn(),
      toggle: vi.fn(),
      setVolumeMultiplier: vi.fn(),
    };

    audio.playMusicCue(MusicCue.TITLE);
    expect(playCue).not.toHaveBeenCalled();

    audio.setTestAudioSuppressed(false);

    expect(playCue).toHaveBeenCalledTimes(1);
    expect(playCue).toHaveBeenCalledWith(MusicCue.TITLE, expect.any(Object));
    expect(audio.isTestAudioSuppressed).toBe(false);
  });

  it('emits runtime state updates for suppression and volume changes', () => {
    const audio = new AudioManager({ startTestAudioSuppressed: true });
    const states: Array<{ volume: number; isBrowserTestAudioRun: boolean; isTestAudioSuppressed: boolean }> = [];

    const unsubscribe = audio.onRuntimeStateChange((state) => {
      states.push(state);
    });

    audio.setTestAudioSuppressed(false);
    audio.setVolume(0.35);
    unsubscribe();

    expect(states[0]).toMatchObject({
      volume: 0.2,
      isBrowserTestAudioRun: true,
      isTestAudioSuppressed: true,
    });
    expect(states.some((state) => state.isTestAudioSuppressed === false)).toBe(true);
    expect(states.some((state) => state.volume === 0.35)).toBe(true);
  });
});
