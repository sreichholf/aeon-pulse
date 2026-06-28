# ADR 0010 — Music Cues and Chapter Themes

**Status:** Accepted  
**Date:** 2026-05-28

The game moves from one global synthesized track to an explicit music-cue architecture. `Game` owns runtime music context and selects a `MusicCue` from state entry, using the `Title Theme` for front-end surfaces and `Chapter Theme`s keyed by `chapterKey` for campaign play. The audio system owns a registry that resolves `MusicCue` values directly to internal `Theme ID`s, with eager fail-hard validation, a synthesized step-sequencer playback engine, per-theme score data, voice preset overrides, tempo, loop length, per-lane mix levels, and a short global release tail on immediate cue changes. The first implementation extracts the current composition unchanged as the Megastructure theme, aliases the Title Theme to it, keeps Pause as ducking on the active cue, keeps chapter music continuous through pause and clear screens, stops music on Game Over, and supports a non-production-only Chapter Theme Preview where the Starting Level Selector previews chapter music on title/database screens for testing.

## Considered Options

**One global track** — simpler, but does not express chapter identity and collapses Title/Chapter music contexts into one implementation.

**Level themes instead of chapter themes** — more granular, but conflicts with the current campaign language and expands content scope from four core themes to twenty level identities.

**Archetype-number or raw-string keyed music** — convenient short-term, but ignores the Campaign Module as the stable source of chapter identity and drifts from the repository's string-enum discriminator pattern.

**Hardcoded composition inside `MusicSequencer`** — preserves the current file shape, but turns authored music into imperative scheduler code and does not scale to multiple themes with validation and aliasing.
