import { MusicCue, type IAudio } from '../../types.ts';
import { SFXLibrary }     from './SFXLibrary.ts';
import { MusicSequencer } from './MusicSequencer.ts';
import { resolveThemeDefinition } from './themes/registry.ts';

export class AudioManager implements IAudio {
  private _ctx: AudioContext | null;
  private _lastPlay: Record<string, number>;
  _volume: number;
  private _chargeOsc: OscillatorNode | null;
  private _chargeGain: GainNode | null;
  private _chargeLfo: OscillatorNode | null;
  private _chargeLfoGain: GainNode | null;
  private _sfx: SFXLibrary;
  private _sequencer: MusicSequencer;

  constructor() {
    this._ctx = null;
    this._lastPlay = {};
    const savedVol = localStorage.getItem('aeon_pulse_volume');
    this._volume = savedVol !== null ? parseFloat(savedVol) : 0.20;

    this._chargeOsc = null;
    this._chargeGain = null;
    this._chargeLfo = null;
    this._chargeLfoGain = null;

    // Instantiate modular sound effect library and music timing engine
    this._sfx = new SFXLibrary(this);
    this._sequencer = new MusicSequencer(this);
  }

  _ctx_(): AudioContext {
    if (!this._ctx) this._ctx = new AudioContext();
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  // ── PUBLIC CONTROL APIS ────────────────────────────────────────────────────

  play(sound: string, ...args: unknown[]): void {
    const now = performance.now();
    if (now - (this._lastPlay[sound] || 0) < 50) return;
    this._lastPlay[sound] = now;
    try {
      this._sfx.play(sound, ...args);
    } catch (_) {}
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('aeon_pulse_volume', String(this._volume));
    // Adjust active charge hum gain node dynamically if playing
    if (this._chargeGain && this._ctx) {
      try {
        this._chargeGain.gain.setValueAtTime(0.006 * this._volume, this._ctx.currentTime);
      } catch (_) {}
    }
  }

  get volume(): number {
    return this._volume;
  }

  // Music sequencer delegation
  playMusicCue(cue: MusicCue): void {
    try {
      this._sequencer.playCue(cue, resolveThemeDefinition(cue));
    } catch (_) {}
  }

  stopMusic(): void {
    try {
      this._sequencer.stop();
    } catch (_) {}
  }

  toggleMusic(): void {
    try {
      this._sequencer.toggle();
    } catch (_) {}
  }

  setMusicVolumeMultiplier(m: number): void {
    try {
      this._sequencer.setVolumeMultiplier(m);
    } catch (_) {}
  }

  // ── LOW LEVEL DSP UTILITIES (Exposed to SFX and Sequencer engines) ────────

  _out(ctx: AudioContext, gainNode: GainNode): void {
    gainNode.connect(ctx.destination);
  }

  _osc(ctx: AudioContext, type: OscillatorType, freq: number, startGain: number, duration: number, freqEnd: number | null = null): void {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    }

    // Smooth 6ms attack phase to eliminate pops/clicks
    const attack = 0.006;
    const startVal = Math.max(0.0001, startGain * this._volume);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(startVal, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    this._out(ctx, gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  _noise(ctx: AudioContext, duration: number, gainVal: number, freqCutoff = 800, freqCutoffEnd: number | null = null): void {
    const rate   = ctx.sampleRate;
    const buf    = ctx.createBuffer(1, Math.ceil(rate * duration), rate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    const filter = ctx.createBiquadFilter();
    filter.type  = 'lowpass';
    filter.frequency.setValueAtTime(freqCutoff, ctx.currentTime);
    if (freqCutoffEnd !== null) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqCutoffEnd), ctx.currentTime + duration);
    }
    const gain   = ctx.createGain();

    // Smooth 10ms attack phase to prevent noise start pops
    const attack = 0.01;
    const startVal = Math.max(0.0001, gainVal * this._volume);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(startVal, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    this._out(ctx, gain);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + duration + 0.02);
  }

  _note(ctx: AudioContext, freq: number, startTime: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.3): void {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    // Smooth 10ms attack
    const attack = 0.01;
    const targetVal = Math.max(0.0001, gainVal * this._volume);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime + startTime);
    gain.gain.linearRampToValueAtTime(targetVal, ctx.currentTime + startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);

    osc.connect(gain);
    this._out(ctx, gain);
    osc.start(ctx.currentTime + startTime);
    osc.stop(ctx.currentTime + startTime + duration + 0.03);
  }

  // ── LOOPING GAMEPLAY CHARGE HUM ───────────────────────────────────────────

  startChargeHum(): void {
    if (this._chargeOsc) return;
    const ctx = this._ctx_();

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 1.5);

    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.006 * this._volume, ctx.currentTime + 0.20);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.01, ctx.currentTime);
    lfoGain.gain.exponentialRampToValueAtTime(2, ctx.currentTime + 1.5);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    osc.connect(gainNode);
    this._out(ctx, gainNode);

    osc.start(ctx.currentTime);
    lfo.start(ctx.currentTime);

    this._chargeOsc = osc;
    this._chargeGain = gainNode;
    this._chargeLfo = lfo;
    this._chargeLfoGain = lfoGain;
  }

  stopChargeHum(): void {
    if (!this._chargeOsc) return;
    const ctx = this._ctx;
    if (!ctx) return;

    const osc = this._chargeOsc;
    const gainNode = this._chargeGain;
    const lfo = this._chargeLfo;

    this._chargeOsc = null;
    this._chargeGain = null;
    this._chargeLfo = null;
    this._chargeLfoGain = null;

    try {
      const now = ctx.currentTime;
      gainNode!.gain.cancelScheduledValues(now);
      let startVal = 0.006 * this._volume;
      try {
        startVal = gainNode!.gain.value;
      } catch (e) {}
      gainNode!.gain.setValueAtTime(startVal, now);
      gainNode!.gain.linearRampToValueAtTime(0.0001, now + 0.08);

      osc.stop(now + 0.09);
      if (lfo) lfo.stop(now + 0.09);
    } catch (_) {}
  }
}
