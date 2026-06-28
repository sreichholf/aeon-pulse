import { MusicCue } from '../../../types.ts';
import { hiveTheme } from './hiveTheme.ts';
import { industrialTheme } from './industrialTheme.ts';
import { megastructureTheme } from './megastructureTheme.ts';
import { ThemeId, type NoteEvent, type ThemeDefinition } from './types.ts';
import { volcanicTheme } from './volcanicTheme.ts';

const THEME_DEFINITIONS: Record<ThemeId, ThemeDefinition> = {
  [ThemeId.MEGASTRUCTURE]: megastructureTheme,
  [ThemeId.INDUSTRIAL]: industrialTheme,
  [ThemeId.HIVE]: hiveTheme,
  [ThemeId.VOLCANIC]: volcanicTheme,
};

const MUSIC_CUE_TO_THEME_ID: Record<MusicCue, ThemeId> = {
  [MusicCue.TITLE]: ThemeId.MEGASTRUCTURE,
  [MusicCue.CHAPTER_MEGASTRUCTURE]: ThemeId.MEGASTRUCTURE,
  [MusicCue.CHAPTER_INDUSTRIAL]: ThemeId.INDUSTRIAL,
  [MusicCue.CHAPTER_HIVE]: ThemeId.HIVE,
  [MusicCue.CHAPTER_VOLCANIC]: ThemeId.VOLCANIC,
};

function assertStep(step: number, loopLength: number, lane: string, themeId: ThemeId): void {
  if (!Number.isInteger(step) || step < 0 || step >= loopLength) {
    throw new Error(`Theme ${themeId} has invalid ${lane} step ${step} for loop length ${loopLength}.`);
  }
}

function assertNoteEvent(event: NoteEvent, loopLength: number, lane: string, themeId: ThemeId): void {
  assertStep(event.step, loopLength, lane, themeId);
  if (!Number.isInteger(event.note) || event.note < 0 || event.note > 127) {
    throw new Error(`Theme ${themeId} has invalid ${lane} note ${event.note} at step ${event.step}.`);
  }
  if (!Number.isFinite(event.length) || event.length <= 0) {
    throw new Error(`Theme ${themeId} has invalid ${lane} note length ${event.length} at step ${event.step}.`);
  }
}

function validateThemeDefinition(theme: ThemeDefinition): void {
  const { id, score, mix } = theme;

  if (!Number.isInteger(score.loopLength) || score.loopLength <= 0) {
    throw new Error(`Theme ${id} has invalid loop length ${score.loopLength}.`);
  }
  if (!Number.isFinite(score.tempo) || score.tempo <= 0) {
    throw new Error(`Theme ${id} has invalid tempo ${score.tempo}.`);
  }

  for (const step of score.drums.kick) assertStep(step, score.loopLength, 'kick', id);
  for (const step of score.drums.snare) assertStep(step, score.loopLength, 'snare', id);
  for (const step of score.drums.hat) assertStep(step, score.loopLength, 'hat', id);

  for (const event of score.bass) assertNoteEvent(event, score.loopLength, 'bass', id);
  for (const event of score.lead) assertNoteEvent(event, score.loopLength, 'lead', id);
  for (const event of score.pad ?? []) assertNoteEvent(event, score.loopLength, 'pad', id);

  for (const [lane, value] of Object.entries(mix)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Theme ${id} has invalid mix level ${value} for lane ${lane}.`);
    }
  }
}

function validateThemeRegistry(): void {
  for (const cue of Object.values(MusicCue)) {
    const themeId = MUSIC_CUE_TO_THEME_ID[cue];
    if (!themeId) {
      throw new Error(`Music cue ${cue} is missing a theme mapping.`);
    }
    if (!THEME_DEFINITIONS[themeId]) {
      throw new Error(`Music cue ${cue} resolves to missing theme ${themeId}.`);
    }
  }

  for (const [themeId, theme] of Object.entries(THEME_DEFINITIONS)) {
    if (theme.id !== themeId) {
      throw new Error(`Theme registry mismatch: key ${themeId} does not match definition id ${theme.id}.`);
    }
    validateThemeDefinition(theme);
  }
}

validateThemeRegistry();

export function resolveThemeDefinition(cue: MusicCue): ThemeDefinition {
  const themeId = MUSIC_CUE_TO_THEME_ID[cue];
  if (!themeId) {
    throw new Error(`Unknown music cue: ${cue}`);
  }

  const theme = THEME_DEFINITIONS[themeId];
  if (!theme) {
    throw new Error(`Missing theme definition for music cue ${cue} -> ${themeId}.`);
  }

  return theme;
}
