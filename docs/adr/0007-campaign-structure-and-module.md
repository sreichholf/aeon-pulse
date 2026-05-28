# ADR 0007 — Campaign Structure and Campaign Module

**Status:** Accepted  
**Date:** 2026-05-27

The campaign is structured as chapters containing levels, identified by structured Level IDs such as `2-4`, rather than by a flat campaign index. The starting Campaign Shape is four chapters with five levels each, but five levels per chapter is not a permanent rule.

Campaign data lives in a dedicated Campaign Module that owns chapter records, level records, clear types, soft tier caps, level-end data, Finale Flags, and Finale Boss Definitions. `Levels.ts` remains the Level Factory Layer: it creates backgrounds, terrain, waves, and boss instances for a chapter archetype, but it is not the source of truth for campaign progression.

Chapter finales are ordinary level records marked by a Finale Flag rather than entries in a separate special-case list. This keeps progression, the Starting Level Selector, clear screens, rewards, and future non-finale level-end events on one campaign path while still allowing finale-only behavior such as Finale Bosses and Boss Rewards.

## Considered Options

**Flat campaign index** — simpler for a four-level prototype, but loses the chapter/level identity needed by the Starting Level Selector, chapter names, and future insertion of additional levels inside a chapter.

**Overload the Level Factory Layer** — keeps data near rendering and terrain construction, but makes campaign progression depend on factory numbering and makes chapter renaming, finale flags, and soft tier caps harder to reason about.

**Separate finale list** — makes boss levels feel special in code, but creates two progression paths for screens and rewards. Rejected because a Chapter Finale is still a Level.
