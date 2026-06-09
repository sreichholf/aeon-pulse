import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { MusicSequencer } from './MusicSequencer.ts';
import { MusicCue } from '../../types.ts';
import type { AudioManager } from './AudioManager.ts';
import type { ThemeDefinition } from './themes/types.ts';

// ── WEB AUDIO & INTERVAL MOCKS ───────────────────────────────────────────────

class AudioParamMock {
  value = 1.0;
  setValueAtTime = vi.fn().mockReturnThis();
  linearRampToValueAtTime = vi.fn().mockReturnThis();
  exponentialRampToValueAtTime = vi.fn().mockReturnThis();
  cancelScheduledValues = vi.fn().mockReturnThis();
}

class AudioNodeMock {
  connect = vi.fn();
  disconnect = vi.fn();
}

class OscillatorNodeMock extends AudioNodeMock {
  type = 'sine';
  frequency = new AudioParamMock();
  detune = new AudioParamMock();
  start = vi.fn();
  stop = vi.fn();
}

class GainNodeMock extends AudioNodeMock {
  gain = new AudioParamMock();
}

class BiquadFilterNodeMock extends AudioNodeMock {
  type = 'lowpass';
  frequency = new AudioParamMock();
  Q = new AudioParamMock();
}

class AudioBufferMock {
  length = 1000;
  sampleRate = 44100;
  duration = 0.02;
  getChannelData = vi.fn(() => new Float32Array(1000));
}

class AudioBufferSourceNodeMock extends AudioNodeMock {
  buffer = null;
  start = vi.fn();
  stop = vi.fn();
}

class AudioContextMock {
  currentTime = 0.0;
  sampleRate = 44100;
  destination = new AudioNodeMock();

  resume = vi.fn().mockResolvedValue(undefined);
  createGain = vi.fn(() => new GainNodeMock());
  createOscillator = vi.fn(() => new OscillatorNodeMock());
  createBiquadFilter = vi.fn(() => new BiquadFilterNodeMock());
  createBuffer = vi.fn(() => new AudioBufferMock());
  createBufferSource = vi.fn(() => new AudioBufferSourceNodeMock());
}

vi.stubGlobal('AudioContext', AudioContextMock);

const dummyTheme: ThemeDefinition = {
  score: {
    tempo: 120, // 120 bpm -> 2 beats per sec -> 0.5s per beat -> 0.125s per step
    loopLength: 8,
    drums: {
      kick: [0, 4],
      snare: [2, 6],
      hat: [1, 3, 5, 7],
    },
    bass: [
      { step: 0, note: 36, length: 2 },
      { step: 4, note: 40, length: 2 },
    ],
    lead: [
      { step: 1, note: 60, length: 1 },
      { step: 5, note: 64, length: 1 },
    ],
    pad: [
      { step: 0, note: 48, length: 4 },
    ],
  },
  voices: {
    kick: {
      startFreq: 150,
      endFreq: 50,
      peak: 0.3,
      attack: 0.005,
      duration: 0.1,
    },
    snare: {
      bandpassFreq: 1200,
      peak: 0.2,
      attack: 0.006,
      duration: 0.15,
    },
    hat: {
      highpassFreq: 9000,
      peak: 0.08,
      attack: 0.003,
      duration: 0.04,
    },
    bass: {
      waveform: 'sawtooth',
      filterQ: 5.0,
      filterStartFreq: 1000,
      filterEndFreq: 200,
      peak: 0.1,
      attack: 0.008,
    },
    lead: {
      primaryWaveform: 'triangle',
      secondaryWaveform: 'square',
      secondaryDetune: 10,
      peak: 0.05,
      attack: 0.02,
      release: 0.05,
      echoGain: 0.02,
      echoFilterFreq: 1200,
      echoStepDelay: 2,
    },
    pad: {
      waveform: 'sine',
      detune: 5,
      filterFreq: 800,
      peak: 0.03,
      attack: 0.1,
      release: 0.3,
    },
  },
  mix: {
    kick: 0.9,
    snare: 0.8,
    hat: 0.7,
    bass: 0.9,
    lead: 0.8,
    pad: 0.6,
  },
};

describe('MusicSequencer', () => {
  let mockCtx: AudioContextMock;
  let mockAudio: any;
  let sequencer: MusicSequencer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCtx = new AudioContextMock();
    mockAudio = {
      _ctx_: vi.fn(() => mockCtx),
      _out: vi.fn(),
      volume: 0.5,
    };
    sequencer = new MusicSequencer(mockAudio as unknown as AudioManager);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default state values', () => {
    // Assert sequencer properties are initialized
    expect(sequencer['_isPlayingMusic']).toBe(false);
    expect(sequencer['_musicIntervalId']).toBeNull();
    expect(sequencer['_musicEnabled']).toBe(true);
    expect(sequencer['_musicVolumeMultiplier']).toBe(1.0);
    expect(sequencer['_activeCue']).toBeNull();
    expect(sequencer['_activeTheme']).toBeNull();
  });

  it('loads theme and starts scheduling when playCue is called', () => {
    sequencer.playCue(MusicCue.TITLE, dummyTheme);

    expect(sequencer['_activeCue']).toBe(MusicCue.TITLE);
    expect(sequencer['_activeTheme']).toBe(dummyTheme);
    expect(sequencer['_isPlayingMusic']).toBe(true);
    expect(sequencer['_musicIntervalId']).not.toBeNull();

    // Verify drum sets are mapped
    expect(sequencer['_kickSteps'].has(0)).toBe(true);
    expect(sequencer['_kickSteps'].has(4)).toBe(true);
    expect(sequencer['_kickSteps'].has(1)).toBe(false);

    // Verify music bus is created
    expect(mockCtx.createGain).toHaveBeenCalled();
  });

  it('stops playback and clears theme data on stop()', () => {
    sequencer.playCue(MusicCue.TITLE, dummyTheme);
    expect(sequencer['_isPlayingMusic']).toBe(true);

    sequencer.stop();

    expect(sequencer['_isPlayingMusic']).toBe(false);
    expect(sequencer['_activeCue']).toBeNull();
    expect(sequencer['_activeTheme']).toBeNull();
    expect(sequencer['_musicIntervalId']).toBeNull();
    expect(sequencer['_kickSteps'].size).toBe(0);
  });

  it('toggles the music enabled state', () => {
    sequencer.playCue(MusicCue.TITLE, dummyTheme);
    expect(sequencer['_isPlayingMusic']).toBe(true);
    expect(sequencer['_musicEnabled']).toBe(true);

    // Toggle off
    sequencer.toggle();
    expect(sequencer['_musicEnabled']).toBe(false);
    expect(sequencer['_isPlayingMusic']).toBe(false);

    // Toggle on (should resume playing the active theme)
    sequencer.toggle();
    expect(sequencer['_musicEnabled']).toBe(true);
    expect(sequencer['_isPlayingMusic']).toBe(true);
  });

  it('sets music volume multiplier and updates active bus', () => {
    sequencer.playCue(MusicCue.TITLE, dummyTheme);

    sequencer.setVolumeMultiplier(0.35);
    expect(sequencer['_musicVolumeMultiplier']).toBe(0.35);

    // Music bus gain should ramp down
    const bus = sequencer['_musicBus'] as unknown as GainNodeMock;
    expect(bus).not.toBeNull();
    expect(bus.gain.cancelScheduledValues).toHaveBeenCalled();
    expect(bus.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.35, expect.any(Number));
  });

  it('correctly schedules notes at step 0', () => {
    sequencer.playCue(MusicCue.TITLE, dummyTheme);
    mockCtx.currentTime = 0.0;

    // Clear initial gain/osc calls from playback initialization
    vi.clearAllMocks();

    // Force run the scheduler. Next note time is 0.05, lookahead is 0.1, so it should schedule step 0.
    sequencer['_scheduler']();

    // Step 0 has: Kick, Bass, Pad. (No snare, no hat, no lead)
    // Let's verify that voices are played
    // Kick: 1 oscillator
    // Bass: 1 oscillator
    // Pad: 2 oscillators
    // Total oscillators = 4
    const oscillatorsCount = mockCtx.createOscillator.mock.calls.length;
    expect(oscillatorsCount).toBe(4);

    // Snare and hat generate buffer sources
    // Total buffer sources should be 0 (none scheduled at step 0)
    expect(mockCtx.createBufferSource).not.toHaveBeenCalled();
  });

  it('advances steps and schedules step 1 notes when time progresses', () => {
    sequencer.playCue(MusicCue.TITLE, dummyTheme);

    // Clear mock calls
    vi.clearAllMocks();

    // Step duration is 0.125s (120 bpm, 4 steps per beat)
    // Progress time to 0.08s (so lookahead reaches 0.18s, covering step 0 at 0.05s and step 1 at 0.175s)
    mockCtx.currentTime = 0.08;

    sequencer['_scheduler']();

    // Step 0: Kick (1), Bass (1), Pad (2) = 4 oscillators
    // Step 1: Lead (2 oscs + 2 oscs echo) = 4 oscillators
    // Total oscillators created since step 0 & 1 scheduler ran = 8
    const oscillatorsCount = mockCtx.createOscillator.mock.calls.length;
    expect(oscillatorsCount).toBe(8);

    // Hat buffer source = 1
    expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1);
  });
});
