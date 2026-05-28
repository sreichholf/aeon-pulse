import type { AudioManager } from './AudioManager.ts';

export class SFXLibrary {
  private _audio: AudioManager;

  constructor(audioManager: AudioManager) {
    this._audio = audioManager;
  }

  play(sound: string, ...args: unknown[]): void {
    const fn = (this as Record<string, unknown>)['_' + sound];
    if (typeof fn === 'function') {
      const ctx = this._audio._ctx_();
      (fn as (ctx: AudioContext, ...a: unknown[]) => void).call(this, ctx, ...args);
    }
  }

  // DSP Helper Proxies
  private _osc(ctx: AudioContext, type: OscillatorType, freq: number, startGain: number, duration: number, freqEnd?: number | null): void { return this._audio._osc(ctx, type, freq, startGain, duration, freqEnd ?? null); }
  private _noise(ctx: AudioContext, duration: number, gainVal: number, freqCutoff?: number, freqCutoffEnd?: number | null): void { return this._audio._noise(ctx, duration, gainVal, freqCutoff, freqCutoffEnd ?? null); }
  private _note(ctx: AudioContext, freq: number, startTime: number, duration: number, type?: OscillatorType, gainVal?: number): void { return this._audio._note(ctx, freq, startTime, duration, type, gainVal); }
  private _out(ctx: AudioContext, gainNode: GainNode): void { return this._audio._out(ctx, gainNode); }
  private get _volume(): number { return this._audio.volume; }

  // ── SOUND EFFECTS RECIPES ──────────────────────────────────────────────────

  private _playerShoot(ctx: AudioContext, tier: number): void {
    if (tier === 1) {
      // Tier 1 (RAPID): Classic triangle laser sweep.
      this._osc(ctx, 'triangle', 1100, 0.20, 0.07, 350);
    } else if (tier === 2) {
      // Tier 2 (TWIN): Dual overlapping triangle sweeps.
      this._osc(ctx, 'triangle', 1300, 0.14, 0.06, 450);
      this._osc(ctx, 'triangle', 1200, 0.14, 0.06, 400);
    } else if (tier === 3) {
      // Tier 3 (SPREAD): Powerful spread zap.
      this._osc(ctx, 'triangle', 1500, 0.18, 0.08, 300);
    } else if (tier === 4) {
      // Tier 4 (WAVE): Smooth energetic wave laser sweep.
      this._osc(ctx, 'triangle', 900, 0.20, 0.09, 250);
    } else if (tier === 5) {
      // Tier 5 (PLASMA): Deep, energetic plasma pop sweep.
      this._osc(ctx, 'triangle', 700, 0.22, 0.12, 180);
    }
  }

  private _playerChargeShoot(ctx: AudioContext, tier: number): void {
    if (tier === 1) {
      // Tier 1 (RAPID): Large charged energy blast.
      this._osc(ctx, 'triangle', 1000, 0.25, 0.18, 200);
      this._noise(ctx, 0.12, 0.15, 3000, 400);
    } else if (tier === 2) {
      // Tier 2 (TWIN): Dual heavy charged blasts.
      this._osc(ctx, 'triangle', 1100, 0.18, 0.18, 220);
      this._osc(ctx, 'triangle', 950, 0.18, 0.18, 180);
    } else if (tier === 3) {
      // Tier 3 (SPREAD): Intense charged scatter shock.
      this._osc(ctx, 'triangle', 1200, 0.24, 0.20, 150);
      this._noise(ctx, 0.15, 0.16, 3500, 300);
    } else if (tier === 4) {
      // Tier 4 (WAVE): Massive sweeping wave release.
      this._osc(ctx, 'triangle', 800, 0.28, 0.22, 100);
    } else if (tier === 5) {
      // Tier 5 (PLASMA): Heavy plasma orb explosion.
      this._osc(ctx, 'triangle', 500, 0.30, 0.25, 80);
      this._noise(ctx, 0.22, 0.20, 2500, 200);
    }
  }

  private _shoot(ctx: AudioContext): void {
    // Enemy fire: Crisp classic triangle laser sweep.
    this._osc(ctx, 'triangle', 800, 0.04, 0.07, 200);
  }

  private _chargeShoot(ctx: AudioContext): void {
    // Enemy charge shoot: Heavy sci-fi triangle energy sweep.
    this._osc(ctx, 'triangle', 600, 0.05, 0.16, 150);
    this._noise(ctx, 0.14, 0.03, 3000, 300);
  }

  private _explosion(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const vol = this._volume;

    // 1. High-Passed White Noise Layer (Sizzling Debris, 0.5s duration)
    const rate = ctx.sampleRate;
    const noiseDuration = 0.5;
    const noiseBuf = ctx.createBuffer(1, Math.ceil(rate * noiseDuration), rate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(900, now);

    const noiseGain = ctx.createGain();
    const peakNoise = Math.max(0.0001, 0.22 * vol);
    const midNoise  = Math.max(0.0001, 0.055 * vol);

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(peakNoise, now + 0.005);
    noiseGain.gain.linearRampToValueAtTime(midNoise, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDuration);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    this._out(ctx, noiseGain);

    noiseSrc.start(now);
    noiseSrc.stop(now + noiseDuration + 0.02);

    // 2. Gritty Sawtooth Down-Sweep Layer (Tearing crunch)
    const sawOsc = ctx.createOscillator();
    sawOsc.type = 'sawtooth';
    sawOsc.frequency.setValueAtTime(1200, now);
    sawOsc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const sawGain = ctx.createGain();
    const peakSaw = Math.max(0.0001, 0.08 * vol);
    sawGain.gain.setValueAtTime(0.0001, now);
    sawGain.gain.linearRampToValueAtTime(peakSaw, now + 0.006);
    sawGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    sawOsc.connect(sawGain);
    this._out(ctx, sawGain);

    sawOsc.start(now);
    sawOsc.stop(now + 0.17);

    // 3. Layered Sub-Bass Sine Thump (Deep weight)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(100, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

    const subGain = ctx.createGain();
    const peakSub = Math.max(0.0001, 0.14 * vol);
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(peakSub, now + 0.01);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    subOsc.connect(subGain);
    this._out(ctx, subGain);

    subOsc.start(now);
    subOsc.stop(now + 0.20);
  }

  private _playerHit(ctx: AudioContext): void {
    // Dramatic structural impact
    this._noise(ctx, 0.07, 0.30, 7500);
    this._noise(ctx, 0.45, 0.22, 4500, 120);
    this._osc(ctx, 'triangle', 160, 0.24, 0.35, 50);
  }

  private _powerUp(ctx: AudioContext): void {
    // Soft happy ascending chime
    [523, 659, 784, 1047].forEach((f, i) => this._note(ctx, f, i * 0.08, 0.15, 'sine', 0.12));
  }

  private _shieldRefill(ctx: AudioContext): void {
    // Futuristic sci-fi shield charging surge: rapid ascending triangle notes + pitch sweep
    [392, 523, 659, 880, 1175].forEach((f, i) => this._note(ctx, f, i * 0.05, 0.18, 'triangle', 0.08));
    this._osc(ctx, 'sine', 200, 0.08, 0.25, 800);
  }

  private _scoreCollect(ctx: AudioContext): void {
    // Crisp twin-tone arcade coin collect chime
    this._note(ctx, 987, 0, 0.08, 'sine', 0.10);      // B5
    this._note(ctx, 1318, 0.06, 0.15, 'sine', 0.10);  // E6
  }

  private _bossAlert(ctx: AudioContext): void {
    // Deep dramatic warning sweep
    this._osc(ctx, 'triangle', 95, 0.16, 0.65, 55);
    this._osc(ctx, 'sine',     140, 0.10, 0.65, 100);
  }

  private _levelComplete(ctx: AudioContext): void {
    // Ascending warm retro fanfare
    [523, 659, 784, 880, 1047, 1319].forEach((f, i) =>
      this._note(ctx, f, i * 0.10, 0.22, 'triangle', 0.08),
    );
  }

  private _gameOver(ctx: AudioContext): void {
    // Descending retro triangle theme
    [523, 440, 370, 294, 220].forEach((f, i) =>
      this._note(ctx, f, i * 0.15, 0.25, 'triangle', 0.09),
    );
  }

  private _menuSelect(ctx: AudioContext): void {
    // Crisp rapid menu chirp sweep
    this._osc(ctx, 'sine', 880, 0.08, 0.05, 600);
  }

  private _scoreEntry(ctx: AudioContext): void {
    // Sweet quick chime
    this._osc(ctx, 'sine', 784, 0.06, 0.06, 523);
  }

  private _laserCharge(ctx: AudioContext): void {
    // Smooth bioluminescent charging sweep
    this._osc(ctx, 'sine', 220, 0.07, 1.2, 750);
  }

  private _bioLaser(ctx: AudioContext): void {
    // Warm wet biological pop
    this._osc(ctx, 'triangle', 700, 0.08, 0.12, 200);
    this._osc(ctx, 'sine', 550, 0.06, 0.08, 150);
  }

  private _organicSquish(ctx: AudioContext): void {
    // Fleshy squash
    this._noise(ctx, 0.18, 0.12, 220);
    this._osc(ctx, 'sine', 70, 0.15, 0.18, 30);
  }

  private _turretCharge(ctx: AudioContext): void {
    // Soft magnetic frequency escalate
    this._osc(ctx, 'sine', 120, 0.08, 0.8, 480);
  }

  private _turretFire(ctx: AudioContext, pitchScale = 1.0): void {
    const crackStart = 800 * pitchScale;
    const crackEnd   = 250 * pitchScale;
    const thumpStart = 75 * pitchScale;
    const thumpEnd   = 35 * pitchScale;
    this._osc(ctx, 'triangle', crackStart, 0.08, 0.12, crackEnd);
    this._osc(ctx, 'sine',     thumpStart, 0.15, 0.15, thumpEnd);
  }

  private _rockRumble(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const vol = this._volume;
    const duration = 0.45;

    // 1. Deep Volcanic Rumble
    this._noise(ctx, duration, 0.28, 150, 30);
    this._osc(ctx, 'sine', 85, 0.22, duration, 25);

    // 2. High-Frequency Rock Crack Friction
    const crackTimes = [0.05, 0.15, 0.28];
    crackTimes.forEach((delay, index) => {
      const sawOsc = ctx.createOscillator();
      sawOsc.type = 'sawtooth';
      sawOsc.frequency.setValueAtTime(350 + index * 100, now + delay);
      sawOsc.frequency.exponentialRampToValueAtTime(80, now + delay + 0.03);

      const sawFilter = ctx.createBiquadFilter();
      sawFilter.type = 'highpass';
      sawFilter.frequency.setValueAtTime(400, now + delay);

      const sawGain = ctx.createGain();
      const peakSaw = Math.max(0.0001, 0.15 * vol);
      sawGain.gain.setValueAtTime(0.0001, now + delay);
      sawGain.gain.linearRampToValueAtTime(peakSaw, now + delay + 0.003);
      sawGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.03);

      sawOsc.connect(sawFilter);
      sawFilter.connect(sawGain);
      this._out(ctx, sawGain);

      sawOsc.start(now + delay);
      sawOsc.stop(now + delay + 0.032);
    });
  }
}
