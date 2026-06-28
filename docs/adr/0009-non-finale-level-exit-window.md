# ADR 0009 — Non-Finale Level Exit Window

**Status:** Accepted  
**Date:** 2026-05-28

Non-finale levels end through a Level Clear Gate followed by a short non-interactive Level Exit Window. The gate opens only after all scheduled waves have spawned, no required enemies remain alive or visible, and no visible powerups remain available; then hostile bullets are cleared, normal player control is disabled, the ship holds for a readable clear beat, and the player ship performs an authored flyout before the Level Complete Screen appears.

## Context and Problem

Chapter 1 non-finale levels previously completed as soon as the last required enemy was gone after the scheduled waves had spawned. This could make newly dropped powerups impossible to collect, because the screen transitioned before the player had a chance to reach them. A fixed scroll endpoint was also rejected because it makes level length brittle and can disconnect completion from the actual resolved combat state.

## Decision

The Level Clear Gate for non-finale levels includes visible powerups as part of the resolved play state. A powerup can resolve either by being collected or by drifting offscreen. Once the gate opens, the level enters a Level Exit Window: the player is no longer vulnerable, hostile bullets are removed immediately, visual effects may finish naturally, the ship holds for a readable clear beat, and then accelerates out under authored control.

Chapter finales do not use the Level Exit Window. Finale boss death remains the authored climax and transitions through the chapter-complete flow.

## Considered Options

- **Enemy-only clear:** Simple, but it can deny late drops and makes the level end feel abrupt.
- **Fixed end position:** Gives an authored endpoint, but it is brittle against tuning changes and can clear at a moment unrelated to combat resolution.
- **Manual player control during exit:** Preserves agency, but creates avoidable edge cases once gameplay pressure has already resolved.
