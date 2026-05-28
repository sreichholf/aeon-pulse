# AEON PULSE Handoff — Chapter Theme Architecture and Implementation

## Purpose

Continue from the completed design grill and implement the music-cue / chapter-theme architecture for AEON PULSE.

## Current state

- The design decisions from the grilling session are now documented in:
  - [CONTEXT.md](/home/stephanr/src/git/private/aeon-pulse/CONTEXT.md)
  - [docs/adr/0010-music-cues-and-chapter-themes.md](/home/stephanr/src/git/private/aeon-pulse/docs/adr/0010-music-cues-and-chapter-themes.md)
- No implementation for the music-cue architecture has been started yet in this session.
- Recent unrelated completed commits in the repo:
  - `b94cf31` — pause feature
  - `f721381` — hide title options in production builds

## Key decisions already made

- Use **Chapter Theme**, not Level Theme.
- Theme identity is keyed by `chapterKey`, not archetype number.
- One **Title Theme** concept exists, distinct from Chapter Themes.
- In v1, `Title Theme` aliases to the Megastructure theme.
- `Game` owns runtime music selection and sends explicit `MusicCue` values to audio.
- `MusicCue` should be a string enum in `src/types.ts`.
- `Theme ID` stays internal to the audio layer.
- Audio owns a registry that resolves `MusicCue -> Theme ID` directly; no alias chains.
- Validation is eager, fail-hard, and runs in production too.
- Chapter Themes are hand-authored synthesized themes, not external audio files.
- Theme modules are declarative data only.
- Theme definitions include score data, voice preset overrides, per-theme tempo, loop length, and per-lane mix levels.
- Score format:
  - step-sequencer model
  - MIDI-style notes
  - explicit drum step arrays
  - sparse melodic event lists
  - per-note durations
  - optional `pad` lane
- Immediate cue changes are correct, but with a short global release tail.
- Pause is not a cue; it ducks the active cue.
- Pause / Level Complete / Game Complete preserve the active cue without reissuing it.
- Game Over stops music.
- Level Start selects the chapter cue; entering Playing should continue seamlessly if unchanged.
- Game Complete keeps the Chapter 4 theme until title.
- Entering Title always restores the Title Theme baseline.
- In non-production builds only, the Starting Level Selector acts as **Chapter Theme Preview**:
  - selector movement can preview chapter music on Title
  - preview reacts only to chapter changes, not level changes within a chapter
  - weapon-tier changes do not affect music
  - preview carries into Tactical Database in non-production builds
  - preview starts only after selector interaction
  - returning from Tactical Database to Title restores Title Theme
  - preview obeys music mute/toggle state
  - preview state is ephemeral and owned by `Game`
- Implementation order:
  - first refactor architecture
  - extract current single theme unchanged as Megastructure
  - then add Industrial, Hive, Volcanic incrementally in campaign order

## Likely implementation shape

- `src/types.ts`
  - add `MusicCue` string enum
- `src/campaign/`
  - add helper for `chapterKey -> MusicCue`
- `src/systems/audio/`
  - replace generic single-track `startMusic()` assumptions with explicit cue playback
  - keep `stopMusic()`, toggle, volume multiplier
- `src/systems/audio/themes/`
  - central registry
  - validator(s)
  - one module per theme
  - initial Megastructure theme extracted from current `MusicSequencer.ts`
- `src/Game.ts`
  - centralize cue changes in state-entry methods
  - Title, Viewer, Level Start, Game Over logic updated per ADR
  - non-production Chapter Theme Preview state handled here

## Important references

- Campaign/domain language:
  - [CONTEXT.md](/home/stephanr/src/git/private/aeon-pulse/CONTEXT.md)
  - [docs/adr/0007-campaign-structure-and-module.md](/home/stephanr/src/git/private/aeon-pulse/docs/adr/0007-campaign-structure-and-module.md)
- New architecture decision:
  - [docs/adr/0010-music-cues-and-chapter-themes.md](/home/stephanr/src/git/private/aeon-pulse/docs/adr/0010-music-cues-and-chapter-themes.md)
- Existing audio code:
  - [src/systems/audio/AudioManager.ts](/home/stephanr/src/git/private/aeon-pulse/src/systems/audio/AudioManager.ts)
  - [src/systems/audio/MusicSequencer.ts](/home/stephanr/src/git/private/aeon-pulse/src/systems/audio/MusicSequencer.ts)
- Title / state flow:
  - [src/Game.ts](/home/stephanr/src/git/private/aeon-pulse/src/Game.ts)
  - [src/ui/screens/TitleScreen.ts](/home/stephanr/src/git/private/aeon-pulse/src/ui/screens/TitleScreen.ts)

## Suggested skills

- `grill-with-docs`
  - Only if new musical scope decisions appear and the implementation session starts changing the agreed domain language.
- `handoff`
  - Use again if the implementation spans multiple sessions.
- `zoom-out`
  - Useful before restructuring `MusicSequencer.ts` if the next agent needs a broader map of audio/state interactions.

## Notes for the next agent

- Do not re-open already settled choices unless the user explicitly changes scope.
- Treat the ADR and glossary as the source of truth for terms like `Chapter Theme`, `Title Theme`, `Music Cue`, and `Chapter Theme Preview`.
- Avoid pulling campaign internals into audio or audio internals into campaign beyond the agreed helper boundary.
