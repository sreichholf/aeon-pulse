# ADR 0018 — Weapon Tier Balancing and Action Pacing

**Status:** Accepted  
**Date:** 2026-06-09

## Context

The game felt too easy on higher weapon levels, particularly because Tier 4 (Wave) and Tier 5 (Focused Plasma) weapons possessed infinite piercing, allowing players to passively sweep whole screens. Additionally, level scrolling was slow (112 seconds of scroll time) with significant empty gaps (4–5 seconds) between wave entries, resulting in low action density.

## Decisions

### 1. Weapon Progression & Recovery
*   **Tier 1 (Rapid) Buff:** The firing rate of Tier 1 is increased (cooldown reduced from `0.14s` to `0.08s`) to make recovery after life loss viable. Higher tiers scale in cooldown: Tier 2 (`0.10s`), Tier 3 (`0.12s`), Tiers 4/5 (`0.14s`).
*   **Tap-Fire Piercing Limit:** Basic tap-fire Wave and Plasma projectiles are limited to **semi-piercing** (`pierceCount = 1`, i.e., hitting up to 2 enemies max before disappearing). Infinite piercing is restricted to fully charged shots, forcing a tactical trade-off.

### 2. Action Density & Snappy Pacing
*   **Timeline Compression:** Wave timelines are scaled down by 35% (Timeline scale factor `0.65`) to increase enemy spawn density.
*   **Level Duration Snapping:** Levels are snapped from `11200` to `7300` scroll units to match the compressed waves, with terrain control points scaled inline by `0.65` to preserve alignment.
*   **Ambient Popcorn Spawner:** A time-based spawner is added to `LevelManager.ts` to trickle in minor, chapter-specific enemies during wave gaps, eliminating dead screen time.

## Consequences

*   Low-tier gameplay is highly responsive.
*   High-tier gameplay requires active charging to clear columns, preventing passive center-lane camping.
*   Level pacing is shorter, snappier, and has a continuous flow of target engagement.
