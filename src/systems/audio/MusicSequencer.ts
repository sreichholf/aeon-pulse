import { MusicCue } from '../../types.ts';
import type { AudioManager } from './AudioManager.ts';
import type { NoteEvent, ThemeDefinition, VoicePresets } from './themes/types.ts';

const RELEASE_TAIL_SECONDS = 0.08;
const SCHEDULER_LOOKAHEAD_SECONDS = 0.1;
const SCHEDULER_TICK_MS = 25;

const DEFAULT_VOICES: Required<VoicePresets> = {
  kick: {
    startFreq: 130,
    endFreq: 40,
    peak: 0.25,
    attack: 0.004,
    duration: 0.09,
  },
  snare: {
    bandpassFreq: 1000,
    peak: 0.15,
    attack: 0.005,
    duration: 0.12,
  },
  hat: {
    highpassFreq: 8000,
    peak: 0.06,
    attack: 0.002,
    duration: 0.03,
  },
  bass: {
    waveform: 'sawtooth',
    filterQ: 4.0,
    filterStartFreq: 900,
    filterEndFreq: 140,
    peak: 0.08,
    attack: 0.005,
  },
  lead: {
    primaryWaveform: 'square',
    secondaryWaveform: 'sawtooth',
    secondaryDetune: 8,
    peak: 0.042,
    attack: 0.015,
    release: 0.03,
    echoGain: 0.015,
    echoFilterFreq: 1100,
    echoStepDelay: 1,
  },
  pad: {
    waveform: 'triangle',
    detune: 7,
    filterFreq: 900,
    peak: 0.025,
    attack: 0.08,
    release: 0.25,
  },
};

function midiToFrequency(note: number): number {
  return 440.0 * Math.pow(2.0, (note - 69.0) / 12.0);
}

function createStepEventMap(events: readonly NoteEvent[]): Map<number, NoteEvent[]> {
  const stepMap = new Map<number, NoteEvent[]>();
  for (const event of events) {
    const bucket = stepMap.get(event.step) ?? [];
    bucket.push(event);
    stepMap.set(event.step, bucket);
  }
  return stepMap;
}

export class MusicSequencer {
  private _audio: AudioManager;
  private _isPlayingMusic: boolean;
  private _musicIntervalId: ReturnType<typeof setInterval> | null;
  private _nextNoteTime: number;
  private _musicCurrentStep: number;
  private _musicEnabled: boolean;
  private _musicVolumeMultiplier: number;
  private _activeCue: MusicCue | null;
  private _activeTheme: ThemeDefinition | null;
  private _kickSteps: Set<number>;
  private _snareSteps: Set<number>;
  private _hatSteps: Set<number>;
  private _bassEventsByStep: Map<number, NoteEvent[]>;
  private _leadEventsByStep: Map<number, NoteEvent[]>;
  private _padEventsByStep: Map<number, NoteEvent[]>;
  private _musicBus: GainNode | null;

  constructor(audioManager: AudioManager) {
    this._audio = audioManager;
    this._isPlayingMusic = false;
    this._musicIntervalId = null;
    this._nextNoteTime = 0.0;
    this._musicCurrentStep = 0;
    this._musicEnabled = true;
    this._musicVolumeMultiplier = 1.0;
    this._activeCue = null;
    this._activeTheme = null;
    this._kickSteps = new Set();
    this._snareSteps = new Set();
    this._hatSteps = new Set();
    this._bassEventsByStep = new Map();
    this._leadEventsByStep = new Map();
    this._padEventsByStep = new Map();
    this._musicBus = null;
  }

  private _connectToMusicBus(ctx: AudioContext, node: AudioNode): void {
    if (!this._musicBus) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(this._musicVolumeMultiplier, ctx.currentTime);
      this._audio._out(ctx, gain);
      this._musicBus = gain;
    }
    node.connect(this._musicBus);
  }

  private get _volume(): number { return this._audio.volume; }
  private _ctx_(): AudioContext { return this._audio._ctx_(); }

  private _kickVoice() {
    return {
      ...DEFAULT_VOICES.kick,
      ...this._activeTheme?.voices.kick,
    };
  }

  private _snareVoice() {
    return {
      ...DEFAULT_VOICES.snare,
      ...this._activeTheme?.voices.snare,
    };
  }

  private _hatVoice() {
    return {
      ...DEFAULT_VOICES.hat,
      ...this._activeTheme?.voices.hat,
    };
  }

  private _bassVoice() {
    return {
      ...DEFAULT_VOICES.bass,
      ...this._activeTheme?.voices.bass,
    };
  }

  private _leadVoice() {
    return {
      ...DEFAULT_VOICES.lead,
      ...this._activeTheme?.voices.lead,
    };
  }

  private _padVoice() {
    return {
      ...DEFAULT_VOICES.pad,
      ...this._activeTheme?.voices.pad,
    };
  }

  private _laneMix(lane: keyof ThemeDefinition['mix']): number {
    return this._activeTheme?.mix[lane] ?? 1.0;
  }

  private _fadeOutBus(bus: GainNode | null, time: number): void {
    if (!bus) return;
    try {
      bus.gain.cancelScheduledValues(time);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), time);
      bus.gain.exponentialRampToValueAtTime(0.0001, time + RELEASE_TAIL_SECONDS);
      setTimeout(() => {
        try {
          bus.disconnect();
        } catch (_) {}
      }, Math.ceil((RELEASE_TAIL_SECONDS + 0.02) * 1000));
    } catch (_) {}
  }

  private _clearPlayback(clearCue: boolean): void {
    this._isPlayingMusic = false;
    if (this._musicIntervalId) {
      clearInterval(this._musicIntervalId);
      this._musicIntervalId = null;
    }

    const ctx = this._ctx_();
    const oldBus = this._musicBus;
    this._musicBus = null;
    this._fadeOutBus(oldBus, ctx.currentTime);

    if (clearCue) {
      this._activeCue = null;
      this._activeTheme = null;
      this._kickSteps = new Set();
      this._snareSteps = new Set();
      this._hatSteps = new Set();
      this._bassEventsByStep = new Map();
      this._leadEventsByStep = new Map();
      this._padEventsByStep = new Map();
    }
  }

  private _loadTheme(theme: ThemeDefinition): void {
    this._activeTheme = theme;
    this._kickSteps = new Set(theme.score.drums.kick);
    this._snareSteps = new Set(theme.score.drums.snare);
    this._hatSteps = new Set(theme.score.drums.hat);
    this._bassEventsByStep = createStepEventMap(theme.score.bass);
    this._leadEventsByStep = createStepEventMap(theme.score.lead);
    this._padEventsByStep = createStepEventMap(theme.score.pad ?? []);
  }

  private _startPlayback(resetStep = true): void {
    if (!this._activeTheme || !this._musicEnabled) return;

    const ctx = this._ctx_();
    this._isPlayingMusic = true;
    this._nextNoteTime = ctx.currentTime + 0.05;
    if (resetStep) {
      this._musicCurrentStep = 0;
    }

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(this._musicVolumeMultiplier, ctx.currentTime);
    this._audio._out(ctx, bus);
    this._musicBus = bus;

    if (this._musicIntervalId) {
      clearInterval(this._musicIntervalId);
    }
    this._musicIntervalId = setInterval(() => this._scheduler(), SCHEDULER_TICK_MS);
  }

  private _playSynthKick(ctx: AudioContext, time: number): void {
    const voice = this._kickVoice();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(voice.startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(voice.endFreq, time + voice.duration);

    const peak = voice.peak * this._volume * this._laneMix('kick');
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + voice.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + voice.duration);

    osc.connect(gain);
    this._connectToMusicBus(ctx, gain);
    osc.start(time);
    osc.stop(time + voice.duration + 0.01);
  }

  private _playSynthSnare(ctx: AudioContext, time: number): void {
    const voice = this._snareVoice();
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.ceil(rate * voice.duration), rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(voice.bandpassFreq, time);

    const gain = ctx.createGain();
    const peak = voice.peak * this._volume * this._laneMix('snare');
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + voice.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + voice.duration);

    src.connect(filter);
    filter.connect(gain);
    this._connectToMusicBus(ctx, gain);
    src.start(time);
    src.stop(time + voice.duration + 0.02);
  }

  private _playSynthHat(ctx: AudioContext, time: number): void {
    const voice = this._hatVoice();
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.ceil(rate * voice.duration), rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(voice.highpassFreq, time);

    const gain = ctx.createGain();
    const peak = voice.peak * this._volume * this._laneMix('hat');
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + voice.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + voice.duration);

    src.connect(filter);
    filter.connect(gain);
    this._connectToMusicBus(ctx, gain);
    src.start(time);
    src.stop(time + voice.duration + 0.02);
  }

  private _playSynthBass(ctx: AudioContext, time: number, freq: number, duration: number): void {
    const voice = this._bassVoice();
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = voice.waveform;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(voice.filterQ, time);
    filter.frequency.setValueAtTime(voice.filterStartFreq, time);
    filter.frequency.exponentialRampToValueAtTime(voice.filterEndFreq, time + duration);

    const peak = voice.peak * this._volume * this._laneMix('bass');
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + voice.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    this._connectToMusicBus(ctx, gain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private _playLeadNote(
    ctx: AudioContext,
    time: number,
    freq: number,
    duration: number,
    peak: number,
    attack: number,
    release: number,
    filterFreq: number | null = null,
  ): void {
    const voice = this._leadVoice();

    const osc1 = ctx.createOscillator();
    osc1.type = voice.primaryWaveform;
    osc1.frequency.setValueAtTime(freq, time);

    const osc2 = ctx.createOscillator();
    osc2.type = voice.secondaryWaveform;
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(voice.secondaryDetune, time);

    const gain = ctx.createGain();
    const scaledPeak = peak * this._volume * this._laneMix('lead');
    const sustainDur = Math.max(0.01, duration - attack - release);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(scaledPeak, time + attack);
    gain.gain.setValueAtTime(scaledPeak, time + attack + sustainDur);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + sustainDur + release);

    let outputNode: AudioNode = gain;
    if (filterFreq !== null) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, time);
      gain.connect(filter);
      outputNode = filter;
    }

    osc1.connect(gain);
    osc2.connect(gain);
    this._connectToMusicBus(ctx, outputNode);

    osc1.start(time);
    osc1.stop(time + duration + 0.05);
    osc2.start(time);
    osc2.stop(time + duration + 0.05);
  }

  private _playSynthLead(ctx: AudioContext, time: number, freq: number, duration: number): void {
    const voice = this._leadVoice();
    this._playLeadNote(ctx, time, freq, duration, voice.peak, voice.attack, voice.release);

    if (voice.echoGain > 0) {
      const echoDelaySeconds = this._stepDuration() * voice.echoStepDelay;
      this._playLeadNote(
        ctx,
        time + echoDelaySeconds,
        freq,
        duration,
        voice.echoGain,
        voice.attack,
        voice.release,
        voice.echoFilterFreq,
      );
    }
  }

  private _playSynthPad(ctx: AudioContext, time: number, freq: number, duration: number): void {
    const voice = this._padVoice();

    const osc1 = ctx.createOscillator();
    osc1.type = voice.waveform;
    osc1.frequency.setValueAtTime(freq, time);

    const osc2 = ctx.createOscillator();
    osc2.type = voice.waveform;
    osc2.frequency.setValueAtTime(freq * 0.5, time);
    osc2.detune.setValueAtTime(voice.detune, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(voice.filterFreq, time);

    const gain = ctx.createGain();
    const peak = voice.peak * this._volume * this._laneMix('pad');
    const sustainDur = Math.max(0.01, duration - voice.attack - voice.release);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + voice.attack);
    gain.gain.setValueAtTime(peak, time + voice.attack + sustainDur);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + voice.attack + sustainDur + voice.release);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    this._connectToMusicBus(ctx, gain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + voice.release + 0.05);
    osc2.stop(time + duration + voice.release + 0.05);
  }

  private _stepDuration(): number {
    if (!this._activeTheme) return 60.0 / 140.0 / 4.0;
    const secondsPerBeat = 60.0 / this._activeTheme.score.tempo;
    return secondsPerBeat / 4.0;
  }

  private _scheduleStep(step: number, time: number): void {
    if (!this._activeTheme) return;
    const ctx = this._ctx_();

    if (this._kickSteps.has(step)) this._playSynthKick(ctx, time);
    if (this._snareSteps.has(step)) this._playSynthSnare(ctx, time);
    if (this._hatSteps.has(step)) this._playSynthHat(ctx, time);

    for (const event of this._bassEventsByStep.get(step) ?? []) {
      this._playSynthBass(ctx, time, midiToFrequency(event.note), event.length * this._stepDuration());
    }

    for (const event of this._leadEventsByStep.get(step) ?? []) {
      this._playSynthLead(ctx, time, midiToFrequency(event.note), event.length * this._stepDuration());
    }

    for (const event of this._padEventsByStep.get(step) ?? []) {
      this._playSynthPad(ctx, time, midiToFrequency(event.note), event.length * this._stepDuration());
    }
  }

  private _scheduler(): void {
    if (!this._isPlayingMusic || !this._activeTheme) return;
    const ctx = this._ctx_();
    while (this._nextNoteTime < ctx.currentTime + SCHEDULER_LOOKAHEAD_SECONDS) {
      this._scheduleStep(this._musicCurrentStep, this._nextNoteTime);
      this._advanceStep();
    }
  }

  private _advanceStep(): void {
    if (!this._activeTheme) return;
    this._nextNoteTime += this._stepDuration();
    this._musicCurrentStep = (this._musicCurrentStep + 1) % this._activeTheme.score.loopLength;
  }

  playCue(cue: MusicCue, theme: ThemeDefinition): void {
    const isSameCue = this._activeCue === cue;

    this._activeCue = cue;
    this._loadTheme(theme);

    if (!this._musicEnabled) return;

    if (isSameCue && this._isPlayingMusic) {
      return;
    }

    this._clearPlayback(false);
    this._startPlayback(true);
  }

  stop(): void {
    this._clearPlayback(true);
  }

  setVolumeMultiplier(m: number): void {
    this._musicVolumeMultiplier = m;
    if (!this._musicBus) return;

    const ctx = this._ctx_();
    this._musicBus.gain.cancelScheduledValues(ctx.currentTime);
    this._musicBus.gain.setValueAtTime(this._musicBus.gain.value, ctx.currentTime);
    this._musicBus.gain.linearRampToValueAtTime(this._musicVolumeMultiplier, ctx.currentTime + 0.02);
  }

  toggle(): void {
    this._musicEnabled = !this._musicEnabled;
    if (this._musicEnabled) {
      if (this._activeTheme && !this._isPlayingMusic) {
        this._startPlayback(true);
      }
      return;
    }

    this._clearPlayback(false);
  }
}
