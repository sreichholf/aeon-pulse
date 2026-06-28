# ADR 0022 — Browser Test Audio Suppression

**Status:** Accepted  
**Date:** 2026-06-17

Browser-based test runs need a quiet default unless audio is the subject under test, but ordinary gameplay runs must remain representative and keep normal audio behavior. Browser test audio suppression is therefore an explicit runtime concern owned by top-level game startup, activated by `?testAudio=off`, implemented as a full audio playback gate for both music and sound effects, surfaced with explicit test-only UI language, and reversible within the current run through the existing control surface rather than by persisting a muted player preference.

## Decision

- Plain `http://localhost:5173` remains the representative browser entry for ordinary gameplay and audio-sensitive runs.
- `http://localhost:5173/?testAudio=off` starts an Audio-Suppressed Browser Test Run.
- Audio suppression is a full playback gate for both music and sound effects, not `volume = 0`.
- The gate is non-persistent and must not overwrite the saved player volume posture.
- In test-scoped runs, `M` toggles full test audio for the current run instead of toggling music only.
- Browser-test UI language should be explicit test language, not generic mute wording.
- Automated non-audio browser workflows should default to the suppression flag.

## Consequences

- Browser-test docs need to present both representative and audio-suppressed manual URLs.
- Profiling and automation guidance should treat `?testAudio=off` as the default for non-audio browser runs.
- Input and UI guidance becomes context-sensitive: `M` is music-only in ordinary runs and a full Test Audio Toggle in suppressed test runs.
- The runtime policy belongs above the audio subsystem so other surfaces can reflect the same test state coherently.
- Playwright automated browser tests default to the audio-suppressed entry: every test appends `?testAudio=off` unless it is explicitly exercising audio behavior. Running `npm run test:e2e` therefore exercises the production build with audio suppression active, keeping CI fast and deterministic while leaving dedicated audio tests as the only paths that opt in to normal playback.
