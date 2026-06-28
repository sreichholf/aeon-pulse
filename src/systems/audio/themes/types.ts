export enum ThemeId {
  MEGASTRUCTURE = 'megastructure',
  INDUSTRIAL = 'industrial',
  HIVE = 'hive',
  VOLCANIC = 'volcanic',
}

export interface DrumScore {
  kick: number[];
  snare: number[];
  hat: number[];
}

export interface NoteEvent {
  step: number;
  note: number;
  length: number;
}

export interface VoicePresets {
  kick?: {
    startFreq?: number;
    endFreq?: number;
    peak?: number;
    attack?: number;
    duration?: number;
  };
  snare?: {
    bandpassFreq?: number;
    peak?: number;
    attack?: number;
    duration?: number;
  };
  hat?: {
    highpassFreq?: number;
    peak?: number;
    attack?: number;
    duration?: number;
  };
  bass?: {
    waveform?: OscillatorType;
    filterQ?: number;
    filterStartFreq?: number;
    filterEndFreq?: number;
    peak?: number;
    attack?: number;
  };
  lead?: {
    primaryWaveform?: OscillatorType;
    secondaryWaveform?: OscillatorType;
    secondaryDetune?: number;
    peak?: number;
    attack?: number;
    release?: number;
    echoGain?: number;
    echoFilterFreq?: number | null;
    echoStepDelay?: number;
  };
  pad?: {
    waveform?: OscillatorType;
    detune?: number;
    filterFreq?: number;
    peak?: number;
    attack?: number;
    release?: number;
  };
}

export interface ThemeScore {
  loopLength: number;
  tempo: number;
  drums: DrumScore;
  bass: NoteEvent[];
  lead: NoteEvent[];
  pad?: NoteEvent[];
}

export interface ThemeDefinition {
  id: ThemeId;
  score: ThemeScore;
  mix: {
    kick: number;
    snare: number;
    hat: number;
    bass: number;
    lead: number;
    pad: number;
  };
  voices: VoicePresets;
}
