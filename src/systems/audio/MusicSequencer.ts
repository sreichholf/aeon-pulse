import type { AudioManager } from './AudioManager.ts';

export class MusicSequencer {
  private _audio: AudioManager;
  private _isPlayingMusic: boolean;
  private _musicIntervalId: ReturnType<typeof setInterval> | null;
  private _nextNoteTime: number;
  private _musicCurrentStep: number;
  private _musicEnabled: boolean;
  private _musicVolumeMultiplier: number;

  constructor(audioManager: AudioManager) {
    this._audio = audioManager;
    this._isPlayingMusic = false;
    this._musicIntervalId = null;
    this._nextNoteTime = 0.0;
    this._musicCurrentStep = 0;
    this._musicEnabled = true;
    this._musicVolumeMultiplier = 1.0;
  }

  // DSP Helper Proxies
  private _out(ctx: AudioContext, gainNode: GainNode): void { return this._audio._out(ctx, gainNode); }
  private get _volume(): number { return this._audio.volume; }
  private _ctx_(): AudioContext { return this._audio._ctx_(); }

  // ── CUSTOM INSTRUMENT SYNTHESIZERS ────────────────────────────────────────

  private _playSynthKick(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.09);

    const vol = this._volume * this._musicVolumeMultiplier;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.25 * vol, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);

    osc.connect(gain);
    this._out(ctx, gain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private _playSynthSnare(ctx: AudioContext, time: number): void {
    const rate = ctx.sampleRate;
    const dur = 0.12;
    const buf = ctx.createBuffer(1, Math.ceil(rate * dur), rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, time);

    const gain = ctx.createGain();
    const vol = this._volume * this._musicVolumeMultiplier;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.15 * vol, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(filter);
    filter.connect(gain);
    this._out(ctx, gain);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  private _playSynthHat(ctx: AudioContext, time: number): void {
    const rate = ctx.sampleRate;
    const dur = 0.03;
    const buf = ctx.createBuffer(1, Math.ceil(rate * dur), rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);

    const gain = ctx.createGain();
    const vol = this._volume * this._musicVolumeMultiplier;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.06 * vol, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(filter);
    filter.connect(gain);
    this._out(ctx, gain);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  private _playSynthBass(ctx: AudioContext, time: number, freq: number, duration: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(4.0, time);
    filter.frequency.setValueAtTime(900, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + duration);

    const vol = this._volume * this._musicVolumeMultiplier;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.08 * vol, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    this._out(ctx, gain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private _playSynthLead(ctx: AudioContext, time: number, freq: number, duration: number): void {
    this._playLeadNote(ctx, time, freq, duration, 0.042);

    const stepDelay = 60.0 / 140.0 / 4.0;
    this._playLeadNote(ctx, time + stepDelay, freq, duration, 0.015, 1100);
  }

  private _playLeadNote(ctx: AudioContext, time: number, freq: number, duration: number, gainVal: number, filterFreq: number | null = null): void {
    const osc1 = ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(freq, time);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(8, time);

    const gain = ctx.createGain();
    const vol = this._volume * this._musicVolumeMultiplier;

    const peak = gainVal * vol;
    const attack = 0.015;
    const release = 0.030;
    const sustainDur = Math.max(0.01, duration - attack - release);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + attack);
    gain.gain.setValueAtTime(peak, time + attack + sustainDur);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + sustainDur + release);

    let lastNode: GainNode | BiquadFilterNode = gain;
    if (filterFreq !== null) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, time);
      gain.connect(filter);
      lastNode = filter;
    }

    osc1.connect(gain);
    osc2.connect(gain);
    // lastNode is either GainNode or BiquadFilterNode — both extend AudioNode
    this._out(ctx, lastNode as GainNode);

    osc1.start(time);
    osc1.stop(time + duration + 0.05);
    osc2.start(time);
    osc2.stop(time + duration + 0.05);
  }

  // ── SEQUENCER ENGINE ───────────────────────────────────────────────────────

  private _scheduleStep(step: number, time: number): void {
    const ctx = this._ctx_();
    const barIndex = Math.floor(step / 16);
    const stepInBar = step % 16;

    const roots = [82.41, 82.41, 130.81, 146.83, 98.00, 146.83, 130.81, 123.47];
    const rootFreq = roots[barIndex] ?? 82.41;
    const fifthFreq = rootFreq * 1.5;

    // 1. Drums
    if (stepInBar === 0 || stepInBar === 8 || stepInBar === 10) {
      this._playSynthKick(ctx, time);
    }
    if (stepInBar === 4 || stepInBar === 12) {
      this._playSynthSnare(ctx, time);
    }
    if (stepInBar % 4 === 2) {
      this._playSynthHat(ctx, time);
    }

    // 2. Bassline
    if (stepInBar % 2 === 0) {
      let bassFreq = rootFreq;
      if (stepInBar % 8 === 2 || stepInBar % 8 === 6) {
        bassFreq = fifthFreq;
      } else if (stepInBar % 8 === 4) {
        bassFreq = rootFreq * 2.0;
      }
      this._playSynthBass(ctx, time, bassFreq / 2.0, 0.20);
    }

    // 3. Heroic Capcom-style Stage Melody
    const melodyPattern = [
      64, 0, 71, 0, 76, 76, 78, 79, 0, 78, 76, 0, 71, 0, 69, 71,
      64, 0, 71, 0, 76, 76, 78, 79, 0, 79, 81, 0, 83, 0, 79, 78,
      72, 0, 76, 0, 79, 0, 81, 79, 0, 76, 72, 0, 74, 0, 76, 74,
      76, 76, 71, 0, 67, 0, 69, 71, 0, 74, 76, 0, 79, 78, 76, 71,
      79, 0, 78, 79, 0, 81, 83, 83, 0, 81, 79, 0, 78, 76, 78, 0,
      81, 0, 79, 81, 0, 83, 84, 84, 0, 83, 81, 0, 79, 78, 79, 0,
      72, 72, 74, 74, 76, 76, 79, 79, 74, 74, 76, 76, 78, 78, 81, 81,
      83, 0, 81, 0, 78, 0, 75, 0, 71, 72, 71, 72, 74, 75, 78, 83
    ];

    const note = melodyPattern[step] ?? 0;
    if (note > 0) {
      const leadFreq = 440.0 * Math.pow(2.0, (note - 69.0) / 12.0);
      this._playSynthLead(ctx, time, leadFreq, 0.18);
    }
  }

  private _scheduler(): void {
    if (!this._isPlayingMusic) return;
    const ctx = this._ctx_();
    const lookahead = 0.1;
    while (this._nextNoteTime < ctx.currentTime + lookahead) {
      this._scheduleStep(this._musicCurrentStep, this._nextNoteTime);
      this._advanceStep();
    }
  }

  private _advanceStep(): void {
    const tempo = 140;
    const secondsPerBeat = 60.0 / tempo;
    const stepDuration = secondsPerBeat / 4.0;
    this._nextNoteTime += stepDuration;
    this._musicCurrentStep = (this._musicCurrentStep + 1) % 128;
  }

  // ── LOOP CONTROLLERS ───────────────────────────────────────────────────────

  start(): void {
    if (!this._musicEnabled) return;
    if (this._isPlayingMusic) return;
    const ctx = this._ctx_();
    this._isPlayingMusic = true;
    this._nextNoteTime = ctx.currentTime + 0.05;
    this._musicCurrentStep = 0;

    if (this._musicIntervalId) {
      clearInterval(this._musicIntervalId);
    }
    this._musicIntervalId = setInterval(() => this._scheduler(), 25);
  }

  stop(): void {
    this._isPlayingMusic = false;
    if (this._musicIntervalId) {
      clearInterval(this._musicIntervalId);
      this._musicIntervalId = null;
    }
  }

  setVolumeMultiplier(m: number): void {
    this._musicVolumeMultiplier = m;
  }

  toggle(): void {
    this._musicEnabled = !this._musicEnabled;
    if (this._musicEnabled) {
      this.start();
    } else {
      this.stop();
    }
  }
}
