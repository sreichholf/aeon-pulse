# Ambient popcorn spawning stays in LevelManager

ARCH-5 ("Pull Ambient Popcorn out of `LevelManager`") proposed a dedicated `AmbientPopcorn` module owning the popcorn timer, the pressure→delay tables, the per-chapter enemy pool, and the spawn-avoidance logic, so `LevelManager` could focus on scroll progression and scheduled events. Inspection shows the ambient code is stable, single-consumer, frozen-vocabulary, and under no growth pressure. The one genuine purity issue — an ADR 0007 split between pressure metadata in `Campaign.ts` and the enemy pool inline in `LevelManager` — has never bitten and only fully resolves if the extraction's scope doubles. We decline to extract.

## Decision

The ambient popcorn timer (`_popcornTimer`), the pressure→delay tables (`_initialPopcornDelay` / `_nextPopcornDelay`), the per-chapter enemy pool (`_spawnAmbientPopcorn`), and the spawn-near-avoidance loop stay in `LevelManager`. Rationale:

- **One consumer.** Only `LevelManager.update()` drives the spawn. No other module reads or mutates the timer, the pool, or the avoidance state. There is no second consumer to justify a seam. A module with one consumer is a hypothetical seam, not a real one.
- **Frozen vocabulary, no growth pressure.** Three pressures (`none`/`light`/`standard`), four chapter pools, no new pressure level planned, no new spawn constraint planned, no new consumer planned. The vocabulary has been stable since authoring. Same shape as the ADR 0025 motion-adapters decline and the ADR 0034 bullet-filter decline.
- **No propagation risk.** The `EnemyInstancer` reads enemy type from `userData` at `addEnemy` time, not from a chapter pool, so no future runtime module inherits this pool knowledge. Leaving the pool inline does not seed a fork that propagates to other systems.
- **The split-brain is real but unexercised.** Pressure metadata lives in `Campaign.ts` (`AMBIENT_PRESSURE_BY_CHAPTER`); the enemy pool lives inline in `LevelManager._spawnAmbientPopcorn`. This is a genuine ADR 0007 boundary split — half the ambient authoring in campaign data, half in a level-progression module. It has never bitten: the ambient code has been stable and green, no new chapter has tripped over the split, and no support threat has been added that needed to find the pool. It is a future-trap, not a present bug.
- **The split only fully resolves by doubling the scope.** Moving the runtime to `AmbientPopcorn` while leaving the pool inline relocates the split-brain — it does not fix it. The full ADR 0007 fix requires also relocating the pool into `Campaign.ts` (`AMBIENT_POOLS_BY_CHAPTER`), so both authoring halves live in campaign data and `AmbientPopcorn` (runtime) reads both. The single-touch version is the worst option: it adds a module seam without purifying the split.
- **Determinism benefit is illusory.** The existing ambient tests (`LevelManager.test.ts`) pass deterministically: the timer math drives the spawn; the random parts (pool pick / Y-avoidance retry loop) are not asserted. Injecting a deterministic random source would be a nice-to-have, not a fix for flakiness, and no replay/recording system is in scope.

## Considered options

- **Lazy version: extract `AmbientPopcorn` runtime, pool stays inline in the new module.** Rejected: relocates the split-brain without fixing it; worst of both (−1 purity win, +1 module seam, lateral move of ~70 lines). This was the literal tasklist-recommended shape.
- **Full version: extract `AmbientPopcorn` runtime AND relocate the chapter pool into `Campaign.ts` as `AMBIENT_POOLS_BY_CHAPTER`.** Considered: this is the only variant that yields genuine ADR 0007 conformance (both ambient-authoring halves in campaign data). Cost: 2 module touches + new `AmbientPopcorn.test.ts` + `Campaign.ts` data growth. Declined because the split-brain has never bitten, growth pressure is low, and the win is positional purity, not a bug fix or a forward-looking capability.
- **Inject a deterministic random source into `_spawnAmbientPopcorn` only.** Considered as a narrow improvement that does not require extraction. Rejected standalone: the existing tests do not fail non-deterministically, and the random source would have to be threaded into `LevelManager` just to surface values nobody asserts on. Worth revisiting only if a replay or deterministic-seed system lands (then the ambient `Math.random` calls become a determinism seam the inline code cannot provide cleanly).

## When to revisit

Reopen this if any of these becomes true:

1. **A second consumer of the chapter pool appears.** For example, an adaptive director/AI that needs to know which enemy types belong to a chapter, or a debug overlay that reports ambient pool contents. Then the pool legitimately becomes shared data and the extraction (or a `Campaign`-level data home) clears the deletion test.
2. **A new pressure level or spawn constraint lands.** If `heavy` pressure, formation-based ambient spawns, or per-sector pool variation is added, the vocabulary stops being frozen and centralization earns its keep.
3. **The split-brain actually bites.** If a contributor adding a new chapter authors the ambient pool in the wrong place, or a pool/pressure mismatch causes a runtime bug, the split becomes a present bug rather than a future-trap.
4. **A replay or deterministic-seed system lands.** Then the ambient spawn's internal `Math.random` calls need a determinism seam, which the inline code cannot provide cleanly without extraction.