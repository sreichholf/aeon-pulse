# AEON PULSE Vitest Harness And Next Test Slice Handoff

This handoff captures the current Vitest harness work and outlines future test coverage opportunities now that all core and recommended test slices have been successfully implemented and verified.

## Current State

- Node is visible in this shell as `v24.16.0`.
- npm is visible as `11.13.0`.
- Vitest is installed: `vitest@^4.1.8`.
- `vitest.config.ts` limits collection to `src/**/*.test.ts` and uses the `node` environment, so Chrome profile artifacts under `.tmp/` are ignored.
- ADR 0013 documents the Vitest module-test harness.
- `AGENTS.md` describes `npm test` as part of normal verification.
- `CONTEXT.md` includes the core testing and gameplay vocabulary.

## Tests Already Added

The Vitest harness now includes 8 test suites protecting the core game mechanics, campaign configurations, level wave compiling, stage transitions, bullet pooling, and game tick resolution:

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

4. **Chapter Wave Builders:**
   - `src/level/waves/Waves.test.ts`
   - Verifies all 20 campaign levels compile non-empty, chronologically sorted wave entries, utilizing valid and registered `EnemyType` and `StageEventType` properties, and that invalid LevelIds throw chapter-specific errors.

5. **Level Manager:**
   - `src/level/LevelManager.test.ts`
   - Tests `scrollX` increments, sequential wave/stage event dispatching, finale boss spawning when wave timeline is exhausted, and level completion gates for non-finale chapters.

6. **Projectile Pool:**
   - `src/systems/ProjectilePool.test.ts`
   - Verifies bullet creation, recycling of released bullets, property matching (tint and damage override keys), exclusion of non-poolable bullet types (like HOMING), and memory cleanup on pool clear.

7. **Gameplay Physics and Tick System:**
   - `src/systems/Gameplay.test.ts`
   - Tests background and level manager updates, player and enemy terrain boundaries clamp updates, bullet spawning from player/enemy/boss entities, and cleanup rules for dead/offscreen entities.

Current test status:
- `npm test` passed: 8 files, 53 tests
- `npm run build` passed
- `git diff --check` passed

## Committed Baseline

All 8 test files and updated dependency configurations are committed to git. Run `git status` to confirm.

## Recommended Future Test Slices

If further module-level testing is desired, the following targets are recommended:

1. **Projectile Instancer (`src/systems/ProjectileInstancer.ts`):**
   - Test that bullet meshes are properly batched into `THREE.InstancedMesh` groups.
   - Verify index tracking and correct transformations (translation and rotation) are written to the instance matrices.

2. **Score Manager (`src/systems/ScoreManager.ts`):**
   - Test score calculation, combo multiplier scaling, high-score storage across different `DifficultyMode` values, and top-scores persistence.

## Next Recommended Steps

1. Run `npm test` to verify all 53 tests pass.
2. Run `npm run build` to verify the production bundle remains green.
3. Select any additional systems or UI components for unit testing if needed.
