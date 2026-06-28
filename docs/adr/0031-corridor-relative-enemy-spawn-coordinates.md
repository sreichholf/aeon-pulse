# Corridor-Relative Enemy Spawn Coordinates

Wave-authored enemy spawn positions were historically expressed as absolute screen-space Y coordinates in `src/level/waves/helpers.ts`. Those coordinates assumed a fixed full-height corridor and did not account for Sector-specific terrain walls, `playfieldMargins`, or the extra clearance needed by movement patterns such as `EnemySine`'s oscillation. Runtime clamping in `GameplayRun.spawnEnemy()` kept enemies inside the corridor reactively, but it distorted authored formations and did not help level designers reason about narrow Sectors at authoring time.

## Decision

The Wave Grammar now authors enemy spawn positions as **Safe Corridor Spawn Coordinates**: normalized values in the range `[-1, 1]`, where `-1` is the bottom safe edge, `1` is the top safe edge, and `0` is the corridor center. A `CorridorResolver` resolves those coordinates to screen-space Y at level-build time using the Sector's terrain walls, `playfieldBounds`, and `playfieldMargins`, and then further shrinks the usable band by each enemy type's **Movement Envelope**. The resolved `WaveEntry` events still carry absolute screen Y values, so runtime spawning does not need to change.

Key implementation points:

- `CorridorResolver` is a small abstraction passed into `buildWaves(level, resolver)`. It exposes `getBoundsAt(scrollX)` and `getSafeSpawnY(enemyType, scrollX, coord)`.
- **Movement Envelope** is a single symmetric pixel clearance stored on each enemy entry in `EntityCatalog.ts`. It represents the extra vertical room an enemy needs beyond its collision footprint for its authored pattern. Most enemies use `0`; `EnemySine` uses its oscillation amplitude.
- New relative helper functions (`rowRel`, `vFormRel`, `clusterRel`) replace the legacy absolute helpers; all chapters have been migrated.
- Existing runtime clamping in `GameplayRun.spawnEnemy()` remains as a safety net, so even malformed relative coordinates cannot spawn an enemy inside a wall.
- Migration is complete: Chapter 2 served as the reference migration, followed by Chapters 0, 1, 3, and 4.

## Considered options

- **Absolute coords + build-time validation only.** Rejected: it leaves authors thinking in pixels that do not mean the same thing across Sectors, and formations still get clipped rather than adapting.
- **Sector-specific wave builders.** Rejected: it multiplies authoring effort and undermines the goal of a portable Wave Grammar.
- **Runtime resolution of relative coords.** Rejected: it makes build-time validation and debugging harder without adding flexibility the game currently needs.

## Consequences

- `Levels.ts`, `ResolvedLevelContent.ts`, and every `buildChapterXWaves` signature must accept a `CorridorResolver`.
- `EntityCatalog.ts` gains a `movementEnvelope` field and becomes the source of truth for per-enemy movement clearance.
- All chapter wave files must migrate to the new helper API; legacy helpers are removed once migration is complete.
- Module tests for wave compilation should use a fake `CorridorResolver` with deterministic corridor dimensions.
