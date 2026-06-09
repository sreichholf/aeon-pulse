# AEON PULSE Vitest Harness And Next Test Slice Handoff

This handoff captures the current Vitest harness work and the updated plan for the remaining test slices, following the completion of the Campaign and Wave Timeline compiler unit tests.

## Current State

- Node has been upgraded and is visible in this shell as `v24.16.0`.
- npm is visible as `11.13.0`.
- Vitest is installed on the current line: `vitest@^4.1.8`.
- `vitest.config.ts` limits collection to `src/**/*.test.ts` and uses the `node` environment, so Chrome profile artifacts under `.tmp/` are ignored.
- ADR 0013 documents the Vitest module-test harness.
- `AGENTS.md` describes `npm test` as part of normal verification.
- `CONTEXT.md` includes the core testing and gameplay vocabulary.

## Tests Already Added

The following test slices have been successfully implemented and verified:

1. **Collision & Combat Seam:**
   - `src/systems/Collisions.test.ts`
   - `src/systems/CombatResolution.test.ts`
   - Tests collision contact order, bullet piercing vs non-piercing, terrain bounds suppression, combat resolution mutations, hit events, and stale contact semantics.

2. **Campaign Module:**
   - `src/campaign/Campaign.test.ts`
   - Tests `CAMPAIGN_LEVELS` / `IMPLEMENTED_LEVELS` sizing and chapter ordering, finale/non-finale level attributes, non-decreasing soft tier caps, stable chapter metadata, music cue mapping, level traversal wrapping/bounds, and exception handling for invalid LevelIds.

3. **Wave Timeline Compiler:**
   - `src/level/waves/Timeline.test.ts`
   - Tests absolute coordinate compilation, sorting compiled entries, grouping multiple events at the same coordinate, insertion order preservation, support for both raw event arrays and `BeatPattern` objects, float scaling with rounding, and missing anchor errors.

Current test status:
- `npm test` passed: 4 files, 26 tests
- `npm run build` passed
- `git diff --check` passed

## Committed Baseline

The latest baseline is fully committed to git:
- `src/campaign/Campaign.test.ts`
- `src/level/waves/Timeline.test.ts`
- `package-lock.json` (updated dependency tree)

Run `git status` before starting the next slices to confirm the workspace is clean.

## Agreed Next Slice 3: Chapter Wave Builder Invariant Tests

Add unit tests to verify the wave building pipeline for the actual chapters (e.g., `src/level/waves/Waves.test.ts` or testing the individual chapter wave builders).

Recommended coverage:
- Every valid chapter level builds a non-empty list of wave entries.
- Wave entries are sorted chronologically by their absolute position (`at`).
- All stage events have recognized `StageEventType` values.
- Spawn events use valid, registered `EnemyType` values.
- Unknown/unsupported level IDs throw appropriate chapter-specific errors.

## Agreed Next Slice 4: LevelManager Tests

Add `src/level/LevelManager.test.ts`.

Recommended coverage:
- Level scroll updates (`scrollX`) and stage event emission.
- Finale boss spawning triggers at the correct scroll coordinates.
- Non-finale levels exit correctly after clear gate resolution.
- Playfield bounds and level completion triggers.

## Next Recommended Steps

1. Review wave builder files (`chapter1.ts` to `chapter4.ts`) and `Levels.ts` to see how waves are instantiated.
2. Implement Slice 3 wave builder invariant tests.
3. Implement Slice 4 `LevelManager` tests.
4. Run `npm test` to verify all tests pass.
5. Run `npm run build` to ensure the production build is clean.
6. Commit changes when green.
