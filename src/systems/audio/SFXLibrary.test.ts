import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SFXLibrary } from './SFXLibrary.ts';
import type { AudioManager } from './AudioManager.ts';

// ── MOCKS FOR WEB AUDIO API ──────────────────────────────────────────────────

class AudioParamMock {
  value = 0;
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
  length: number;
  sampleRate: number;
  numberOfChannels: number;
  duration: number;
  private _data: Float32Array;

  constructor(options: { numberOfChannels?: number, length: number, sampleRate: number }) {
    this.numberOfChannels = options.numberOfChannels ?? 1;
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this.duration = options.length / options.sampleRate;
    this._data = new Float32Array(this.length);
  }

  getChannelData(channel: number) {
    return this._data;
  }
}

class AudioBufferSourceNodeMock extends AudioNodeMock {
  buffer: any = null;
  start = vi.fn();
  stop = vi.fn();
}

class AudioContextMock {
  currentTime = 0.5;
  sampleRate = 44100;
  state = 'running';
  destination = new AudioNodeMock();

  resume = vi.fn().mockResolvedValue(undefined);
  createGain = vi.fn(() => new GainNodeMock());
  createOscillator = vi.fn(() => new OscillatorNodeMock());
  createBiquadFilter = vi.fn(() => new BiquadFilterNodeMock());
  createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => {
    return new AudioBufferMock({ numberOfChannels: channels, length, sampleRate });
  });
  createBufferSource = vi.fn(() => new AudioBufferSourceNodeMock());
}

// Stub AudioContext globally so any direct instantiations (like in AudioManager) don't throw
vi.stubGlobal('AudioContext', AudioContextMock);

// Stub localStorage globally since AudioManager accesses it
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string): string | null => store[key] !== undefined ? store[key] : null),
  setItem: vi.fn((key: string, value: string): void => { store[key] = value.toString(); }),
  removeItem: vi.fn((key: string): void => { delete store[key]; }),
  clear: vi.fn((): void => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
};
vi.stubGlobal('localStorage', localStorageMock);

describe('SFXLibrary', () => {
  let mockCtx: AudioContextMock;
  let mockAudio: any;
  let sfx: SFXLibrary;

  beforeEach(() => {
    mockCtx = new AudioContextMock();
    mockAudio = {
      _ctx_: vi.fn(() => mockCtx),
      _osc: vi.fn(),
      _noise: vi.fn(),
      _note: vi.fn(),
      _out: vi.fn(),
      volume: 0.5,
    };
    sfx = new SFXLibrary(mockAudio as unknown as AudioManager);
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('should play nothing and not throw when an unknown sound is played', () => {
    expect(() => sfx.play('nonExistentSound')).not.toThrow();
    expect(mockAudio._ctx_).not.toHaveBeenCalled();
  });

  describe('playerShoot recipes (tiers 1-5)', () => {
    it('plays tier 1 rapid laser sweep', () => {
      sfx.play('playerShoot', 1);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 1100, 0.20, 0.07, 350);
    });

    it('plays tier 2 twin laser sweep', () => {
      sfx.play('playerShoot', 2);
      expect(mockAudio._osc).toHaveBeenNthCalledWith(1, mockCtx, 'triangle', 1300, 0.14, 0.06, 450);
      expect(mockAudio._osc).toHaveBeenNthCalledWith(2, mockCtx, 'triangle', 1200, 0.14, 0.06, 400);
    });

    it('plays tier 3 spread laser sweep', () => {
      sfx.play('playerShoot', 3);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 1500, 0.18, 0.08, 300);
    });

    it('plays tier 4 wave laser sweep', () => {
      sfx.play('playerShoot', 4);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 900, 0.20, 0.09, 250);
    });

    it('plays tier 5 plasma pop sweep', () => {
      sfx.play('playerShoot', 5);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 700, 0.22, 0.12, 180);
    });
  });

  describe('playerChargeShoot recipes (tiers 1-5)', () => {
    it('plays tier 1 charged energy blast', () => {
      sfx.play('playerChargeShoot', 1);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 1000, 0.25, 0.18, 200);
      expect(mockAudio._noise).toHaveBeenCalledWith(mockCtx, 0.12, 0.15, 3000, 400);
    });

    it('plays tier 2 dual heavy charged blasts', () => {
      sfx.play('playerChargeShoot', 2);
      expect(mockAudio._osc).toHaveBeenNthCalledWith(1, mockCtx, 'triangle', 1100, 0.18, 0.18, 220);
      expect(mockAudio._osc).toHaveBeenNthCalledWith(2, mockCtx, 'triangle', 950, 0.18, 0.18, 180);
    });

    it('plays tier 3 charged scatter shock', () => {
      sfx.play('playerChargeShoot', 3);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 1200, 0.24, 0.20, 150);
      expect(mockAudio._noise).toHaveBeenCalledWith(mockCtx, 0.15, 0.16, 3500, 300);
    });

    it('plays tier 4 wave charged sweep', () => {
      sfx.play('playerChargeShoot', 4);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 800, 0.28, 0.22, 100);
    });

    it('plays tier 5 plasma charged explosion', () => {
      sfx.play('playerChargeShoot', 5);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 500, 0.30, 0.25, 80);
      expect(mockAudio._noise).toHaveBeenCalledWith(mockCtx, 0.22, 0.20, 2500, 200);
    });
  });

  describe('enemy shoot recipes', () => {
    it('plays enemy shoot', () => {
      sfx.play('shoot');
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 800, 0.04, 0.07, 200);
    });

    it('plays enemy chargeShoot', () => {
      sfx.play('chargeShoot');
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 600, 0.05, 0.16, 150);
      expect(mockAudio._noise).toHaveBeenCalledWith(mockCtx, 0.14, 0.03, 3000, 300);
    });
  });

  describe('explosion recipe', () => {
    it('plays complex explosion with 3 layered sounds', () => {
      sfx.play('explosion');

      // Verify buffer creation for the high-passed white noise layer
      expect(mockCtx.createBuffer).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();

      // Verify high-pass biquad filter is created
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();

      // Verify gain nodes and oscillators are created
      // Layer 1 noise gain, Layer 2 saw gain, Layer 3 sub gain => total 3 gains
      expect(mockCtx.createGain).toHaveBeenCalledTimes(3);
      // Layer 2 saw osc, Layer 3 sub osc => total 2 oscillators
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);

      // Verify the output connections are called for all 3 layers
      expect(mockAudio._out).toHaveBeenCalledTimes(3);
    });
  });

  describe('playerHit and powerup items recipes', () => {
    it('plays playerHit', () => {
      sfx.play('playerHit');
      expect(mockAudio._noise).toHaveBeenNthCalledWith(1, mockCtx, 0.07, 0.30, 7500, null);
      expect(mockAudio._noise).toHaveBeenNthCalledWith(2, mockCtx, 0.45, 0.22, 4500, 120);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'triangle', 160, 0.24, 0.35, 50);
    });

    it('plays powerUp chime sequence', () => {
      sfx.play('powerUp');
      expect(mockAudio._note).toHaveBeenCalledTimes(4);
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, idx) => {
        expect(mockAudio._note).toHaveBeenNthCalledWith(idx + 1, mockCtx, freq, idx * 0.08, 0.15, 'sine', 0.12);
      });
    });

    it('plays shieldRefill chime and sweep sequence', () => {
      sfx.play('shieldRefill');
      expect(mockAudio._note).toHaveBeenCalledTimes(5);
      const notes = [392, 523, 659, 880, 1175];
      notes.forEach((freq, idx) => {
        expect(mockAudio._note).toHaveBeenNthCalledWith(idx + 1, mockCtx, freq, idx * 0.05, 0.18, 'triangle', 0.08);
      });
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'sine', 200, 0.08, 0.25, 800);
    });

    it('plays scoreCollect double chime', () => {
      sfx.play('scoreCollect');
      expect(mockAudio._note).toHaveBeenNthCalledWith(1, mockCtx, 987, 0, 0.08, 'sine', 0.10);
      expect(mockAudio._note).toHaveBeenNthCalledWith(2, mockCtx, 1318, 0.06, 0.15, 'sine', 0.10);
    });
  });

  describe('boss and level/game state transition recipes', () => {
    it('plays bossAlert', () => {
      sfx.play('bossAlert');
      expect(mockAudio._osc).toHaveBeenNthCalledWith(1, mockCtx, 'triangle', 95, 0.16, 0.65, 55);
      expect(mockAudio._osc).toHaveBeenNthCalledWith(2, mockCtx, 'sine', 140, 0.10, 0.65, 100);
    });

    it('plays levelComplete fanfare', () => {
      sfx.play('levelComplete');
      expect(mockAudio._note).toHaveBeenCalledTimes(6);
      const notes = [523, 659, 784, 880, 1047, 1319];
      notes.forEach((freq, idx) => {
        expect(mockAudio._note).toHaveBeenNthCalledWith(idx + 1, mockCtx, freq, idx * 0.10, 0.22, 'triangle', 0.08);
      });
    });

    it('plays gameOver theme', () => {
      sfx.play('gameOver');
      expect(mockAudio._note).toHaveBeenCalledTimes(5);
      const notes = [523, 440, 370, 294, 220];
      notes.forEach((freq, idx) => {
        expect(mockAudio._note).toHaveBeenNthCalledWith(idx + 1, mockCtx, freq, idx * 0.15, 0.25, 'triangle', 0.09);
      });
    });

    it('plays menuSelect', () => {
      sfx.play('menuSelect');
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'sine', 880, 0.08, 0.05, 600);
    });

    it('plays scoreEntry', () => {
      sfx.play('scoreEntry');
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'sine', 784, 0.06, 0.06, 523);
    });
  });

  describe('organic / bio hazard sound effects', () => {
    it('plays laserCharge', () => {
      sfx.play('laserCharge');
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'sine', 220, 0.07, 1.2, 750);
    });

    it('plays bioLaser', () => {
      sfx.play('bioLaser');
      expect(mockAudio._osc).toHaveBeenNthCalledWith(1, mockCtx, 'triangle', 700, 0.08, 0.12, 200);
      expect(mockAudio._osc).toHaveBeenNthCalledWith(2, mockCtx, 'sine', 550, 0.06, 0.08, 150);
    });

    it('plays organicSquish', () => {
      sfx.play('organicSquish');
      expect(mockAudio._noise).toHaveBeenCalledWith(mockCtx, 0.18, 0.12, 220, null);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'sine', 70, 0.15, 0.18, 30);
    });

    it('plays turretCharge', () => {
      sfx.play('turretCharge');
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'sine', 120, 0.08, 0.8, 480);
    });

    it('plays turretFire with default and custom pitch scales', () => {
      sfx.play('turretFire');
      expect(mockAudio._osc).toHaveBeenNthCalledWith(1, mockCtx, 'triangle', 800, 0.08, 0.12, 250);
      expect(mockAudio._osc).toHaveBeenNthCalledWith(2, mockCtx, 'sine', 75, 0.15, 0.15, 35);

      vi.clearAllMocks();
      sfx.play('turretFire', 2.0);
      expect(mockAudio._osc).toHaveBeenNthCalledWith(1, mockCtx, 'triangle', 1600, 0.08, 0.12, 500);
      expect(mockAudio._osc).toHaveBeenNthCalledWith(2, mockCtx, 'sine', 150, 0.15, 0.15, 70);
    });
  });

  describe('rock rumble environment effect', () => {
    it('plays rockRumble with deep rumble and crack friction', () => {
      sfx.play('rockRumble');

      // Volcanic rumble layer
      expect(mockAudio._noise).toHaveBeenCalledWith(mockCtx, 0.45, 0.28, 150, 30);
      expect(mockAudio._osc).toHaveBeenCalledWith(mockCtx, 'sine', 85, 0.22, 0.45, 25);

      // Crack friction layer calls AudioContext methods directly
      // Verify 3 crack oscillators, filters, gains are created
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(3);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(3);

      // Verify that output connections are made for the 3 cracks
      expect(mockAudio._out).toHaveBeenCalledTimes(3);
    });
  });
});
