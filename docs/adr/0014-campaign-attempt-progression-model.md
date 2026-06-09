# ADR 0014 — Campaign Attempt Progression Model

**Status:** Accepted  
**Date:** 2026-06-09

The progression states, level transitions, and clear reward calculations of a Campaign Attempt are consolidated in a dedicated `CampaignAttempt` module (`src/campaign/CampaignAttempt.ts`). 

By separating runtime progression logic from visual container elements (`Game.ts`) and active gameplay tick runners (`GameplayRun.ts`), the game establishes a clear, testable boundary for progression rules. Calculations of clear bonuses, lives rewards, chapter finale bonuses, and next-level traversal states are computed deterministically.

## Consequences

- Runtime progression rules and score calculations live inside `CampaignAttempt`.
- `Game.ts` and `GameplayRun.ts` consume `CampaignAttempt` as the single source of truth for progression facts and starting weapon tiers.
- Level complete screens are configured dynamically via `CampaignAttemptClearResult` structures.
- Progression math and state transitions can be fully unit tested in Node via Vitest without Three.js, audio, or UI mocks.
