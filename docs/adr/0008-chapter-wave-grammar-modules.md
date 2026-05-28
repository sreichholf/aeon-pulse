# ADR 0008 — Chapter Wave Grammar Modules

**Status:** Accepted  
**Date:** 2026-05-27

Chapter-specific wave grammar is structured and authored using consolidated chapter wave modules that map level roles to semantic named beats. The `Levels.ts` file acts as the generic Level Factory Layer and consumes a single chapter-wide wave-building interface per chapter rather than importing and switching over individual per-level builders. 

## Context and Problem

Previously, waves for Chapter 1 levels were imported as individual, hardcoded functions in `Levels.ts` (e.g., `buildLevel1_1Waves()`, `buildLevel1_2Waves()`, etc.), while other chapters imported flat unstructured builders. The compositions within these builders were expressed as unstructured arrays of spawn events with duplicate raw geometry patterns and literal offset maps. This made it difficult to see level pacing, reuse composite patterns, or maintain consistent balance.

## Decision

We consolidate each chapter's level waves into a single Wave Grammar module in `src/level/waves/chapterX.ts` (where X is 1, 2, 3, or 4).

1. **Semantic Beats:** We hide low-level spatial and event generation math behind descriptive named beats (e.g., `straightRowBeat`, `mirrorSineBeat`, `swarmClusterBeat`, `sporeTriadBeat`, `rockDrakeBeat`). Pacing and patterns are readable at a high level.
2. **Unified Interface:** We expose a structured, chapter-level interface. `Levels.ts` consumes these high-level exports rather than direct sub-level listings.
3. **No External Changes:** Low-level `WaveEntry[]` remains the exact output consumed by `LevelManager` and the rest of the game engine, preserving original game balance and level spacing.

## Considered Options

- **Per-Level Separate Files:** Splitting each sub-level into its own file (e.g. `level1_1.ts`) would create shallow files with highly repetitive spatial math and noise, fragmenting chapter progression.
- **Generic Engine Wave DSL:** Designing an engine-level runtime scripting or serialization format. Rejected for now because compile-time TypeScript composition is faster, more robust, and keeps wave files highly readable.
- **Global Shared Beats (De-duplication):** Moving generic beat builders (e.g., straight lines, mirror sines) into a global shared beats helper file. Rejected to **preserve absolute chapter independence**. Keeping beat builders strictly local to each chapter's file ensures that adjustments to generic spacing, stagger patterns, or speed offsets in one chapter's corridors do not introduce regression risks or break layouts in another chapter.

## Decision Appendix — Scaled Anchor & Offset Timeline Module

We have successfully implemented the **Scaled Anchor & Offset Timeline Module** (`src/level/waves/Timeline.ts`) to solve absolute coordinate brittleness:

1. **Chapter Encapsulation:** Absolute anchors (e.g., `start: 0`, `mid: 5000`) are defined locally within each chapter's file, keeping chapters decoupled and independent.
2. **Anchor Alignment:** Wave beats are composed relative to these anchors, locking critical spawns directly to key terrain milestones while allowing intermediate skirmishes to be defined at relative offsets.
3. **Pacing Scale Factors:** The `Timeline` class supports a dynamic scale multiplier that compresses or stretches offset-based intermediate beats (e.g. for fine-grained difficulty adjustments) while leaving absolute milestones perfectly aligned to the terrain.



