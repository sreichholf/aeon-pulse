# Chapter 4 FPS Diagnosis Log

This log records the current Chapter 4 FPS investigation so future agents can resume from evidence instead of re-running the same exploratory steps.

## Goal

Diagnose what is actually causing Chapter 4 FPS dips before choosing an optimization target.

The working question was whether the dips came from gameplay CPU, collision work, projectile pressure, post-processing, first-use GPU warm-up, specific enemy visuals, or wave overlap.

## Tooling Added

The existing profiler was extended instead of creating a separate profiler.

- `src/systems/PerfProbe.ts`
  - Captures per-frame labels and bounded events in addition to phases and counts.
  - Supports `setPerfLabel()` and `recordPerfEvent()`.
- `src/Game.ts`
  - Records `game.state`.
- `src/systems/GameplayRun.ts`
  - Records `level.id`, `level.chapter`, `level.scrollX`.
  - Tracks live enemy counts by `EnemyType`.
  - Records `stageEvent` and `enemySpawned` events.
- `scripts/collect-render-stats.mjs`
  - Supports `PROFILE_MODE=baseline|long-frames`.
  - In long-frame mode, adds `renderStats=1`, `invincible=1`, and `perfProbe=1`.
  - Includes hidden `#aeon-perf-probe` output in scenario summaries.
  - Supports `BYPASS_POSTPROCESSING=1` to add `noPost=1`.
- `src/Scene.ts`
  - Supports runtime flag `noPost=1`, bypassing `EffectComposer` and using direct `renderer.render()` while leaving gameplay scene contents intact.
- `scripts/run-profiler.mjs`
  - Documents `PROFILE_MODE`.
  - Supports `BROWSER_EXE=<path>` for browser executable override.

## Browser And Environment Notes

The Codex in-app browser was initially blocked because the Node-backed browser control path failed on Windows with:

```text
CreateProcessAsUserW failed: 5
```

The related upstream Codex issues found in `openai/codex` were:

- `#27313` - Node REPL kernel fails to start on Windows with `CreateProcessAsUserW failed: 5`
- `#25436` - Windows local runner cannot start, same error family
- `#9062` - related `CreateProcessWithLogonW failed: 5`

The local workaround was changing `C:\Users\Stephan\.codex\config.toml`:

```toml
[windows]
sandbox = "unelevated"
```

A backup was created at:

```text
C:\Users\Stephan\.codex\config.toml.bak-20260612-174322
```

After that change, the Browser plugin bootstrap path worked and the in-app browser could drive `http://localhost:5173`.

## Manual In-App Browser Runs

The tested URL pattern was:

```text
http://localhost:5173/?renderStats=1&invincible=1&perfProbe=1
```

For post-processing isolation:

```text
http://localhost:5173/?renderStats=1&invincible=1&perfProbe=1&noPost=1
```

Level selection:

- From title screen, press `ArrowUp` 18 times to select `4-4` (`Cinder Core`).
- Press `ArrowRight` 4 times for tier-5 tap-fire scenarios.
- Press `Enter` or `Space` to start.

## Captured Evidence

### L4-4 No-Fire, Normal Post-Processing, Cold-ish Run

Approximate probe result:

- Long frames: `19`
- Worst frame gap: about `667 ms`
- `scene.composer.max`: about `668 ms`
- `game.render.max`: about `668 ms`
- `game.update.max`: about `12 ms`
- `run.collisions.max`: about `0.2 ms`
- Peak draw calls: `124`
- Peak triangles: about `1.51M`
- Peak visible object units: `119`
- Peak enemy units: `87`
- Peak enemies: `22`

Hot band:

- `scrollX ~= 3088`
- Enemy mix: `straight`, `turret`, `diver`, `stalactite`
- Detail units included roughly `straight:21`, `turret:20`, `diver:18`, `stalactite:15`

Interpretation: the worst long frames were render-bound, not collision/update-bound.

### L4-4 Tier-5 Tap-Fire, Normal Post-Processing

Approximate probe result:

- Long frames: `7`
- Worst frame gap: about `67 ms`
- `scene.composer.max`: about `68 ms`
- `game.update.max`: about `10 ms`
- `run.collisions.max`: about `0.2 ms`
- Peak draw calls: `110`
- Peak triangles: about `510k`
- Peak enemy units: `52`
- Peak bullet units: `36`

Worst hot band:

- `scrollX ~= 5507`
- Enemy mix: `rockDrake`, `stalactite`, `charger`, `straight`
- Detail units included roughly `stalactite:20`, `rockDrake:16`, `charger:7`, `straight:3`

Interpretation: tier-5 fire increases bullet pressure, but this run reduced enemy lifetime and had smaller worst stalls than no-fire.

### L4-4 No-Fire, `noPost=1`, Cold Run

Approximate probe result:

- Long frames: `15`
- Worst frame gap: about `573 ms`
- `scene.renderer.max`: about `578 ms`
- `game.render.max`: about `578 ms`
- `game.update.max`: about `14.5 ms`
- `run.collisions.max`: about `0.3 ms`

Hot bands repeated around:

- `scrollX ~= 840`
- `scrollX ~= 3080-3120`
- `scrollX ~= 3580`

Interpretation: bypassing post-processing did not remove the massive cold stalls. They moved from `scene.composer` to `scene.renderer`, which means post-processing is not the root cause.

### L4-4 No-Fire, `noPost=1`, Warmed Rerun

Approximate probe result:

- Long frames: `6`
- Worst frame gap: about `54 ms`
- `scene.renderer.max`: about `57 ms`
- `game.render.max`: about `57 ms`
- `game.update.max`: about `10 ms`
- `run.collisions.max`: about `0.2 ms`
- Peak triangles: about `1.84M`
- Peak enemy units: `89`
- Peak enemies: `21`

Worst hot band:

- `scrollX ~= 1685`
- Enemy mix: `rockDrake`, many `sine`, `stalactite`
- Detail units included roughly `rockDrake:16`, `sine:33`, `stalactite:5`

Another repeatable hot band:

- `scrollX ~= 3088`
- Enemy mix: `diver`, `turret`, `stalactite`, `straight`
- Enemy units around `89`

Interpretation: first-use GPU/material/shader warm-up likely explains the huge 500-600 ms cold stalls. Warmed render cost remains high but much smaller.

### L4-4 No-Fire, Normal Post-Processing, Warmed Rerun

Approximate probe result:

- Long frames: `7`
- Worst frame gap: about `67 ms`
- `scene.composer.max`: about `72 ms`
- `game.render.max`: about `72 ms`
- `game.update.max`: about `11 ms`
- `run.collisions.max`: about `0.2 ms`
- Peak draw calls: `117`
- Peak triangles: about `1.31M`
- Peak enemy units: `83`

Worst hot band:

- `scrollX ~= 1683`
- Enemy mix: `rockDrake`, `sine`, `stalactite`, `straight`
- Detail units included roughly `rockDrake:16`, `sine:21`, `stalactite:5`, `straight:6`

Interpretation: post-processing is additive after warm-up, but it is not the primary cause. Warmed normal-post max was only about 15 ms worse than warmed `noPost`.

## Current Conclusion

Chapter 4 dips are not primarily collision, gameplay update, or projectile CPU work.

The likely causes, in order:

1. **First-use GPU/material/shader warm-up** for enemy-heavy Chapter 4 visual combinations. This explains the 500-600 ms cold render stalls.
2. **Steady-state standard-enemy visual cost** in specific overlap bands, especially:
   - `rockDrake` + many `sine`
   - `diver` + `turret` + `stalactite` + `straight`
3. **Post-processing overhead** adds cost after warm-up, but it is secondary.
4. **Wave overlap** contributes by producing high enemy render density, but should not be changed before investigating visual cost.

## Render Warm-Up Pass Implemented

Implementation completed on `2026-06-12`.

- `src/systems/RenderWarmup.ts` now stages representative standard enemy visuals through the real catalog spawn path.
- `src/Scene.ts` now exposes `warmupRenderPaths()`, which compiles and renders both the direct renderer path and the composer path.
- `src/Game.ts` now runs the warm-up sequence after startup asset preload and before entering `TITLE`.
- `src/systems/RenderWarmup.test.ts` covers the helper contract: spawn the selected enemy set, run the warm-up callback, and destroy all staged enemies.

Important implementation note:

- The first integration attempt accidentally destroyed staged enemies before the render warm-up pass ran, so it did not actually warm gameplay visuals.
- That bug was fixed by keeping staged enemies alive through the warm-up callback and only destroying them afterward.

### Post-Implementation Measurement

Cold in-app browser rerun of `L4-4 no-fire` at:

```text
http://localhost:5173/?renderStats=1&invincible=1&perfProbe=1
```

Approximate result after the fixed warm-up implementation:

- Long frames: `7`
- Worst frame gap: about `53 ms`
- `scene.composer.max`: about `63 ms`
- `game.render.max`: about `63 ms`
- `game.update.max`: about `7.4 ms`
- `run.collisions.max`: about `0.2 ms`
- Peak draw calls: `115`
- Peak triangles: about `1.34M`
- Peak enemy units: `83`
- Peak enemies: `21`

Worst hot band:

- `scrollX ~= 1625`
- Enemy mix: `rockDrake`, `sine`, `stalactite`
- No large cold-start 500-600 ms stall remained in this run

Interpretation: the boot-time render warm-up pass appears to have removed the giant first-use cold hitch class and moved cold behavior near the previously observed warmed behavior.

## Recommended Next Steps

1. Inspect runtime render buckets and triangle/material ownership for `EnemySine`, `Stalactite`, `EnemyTurret`, `RockDrake`, and `EnemyDiver`.
2. Keep projectile warm-up as a follow-up only if a later cold run shows projectile-specific first-use hitches. The current evidence says enemy visual warm-up was the first lever that mattered.
3. Prefer visual-cost reductions before wave grammar changes:
   - share materials where safe
   - reduce material buckets
   - merge static sub-meshes when hit flash and animation semantics allow it
   - preserve independently animated parts
4. Re-run:

```bash
PROFILE_MODE=long-frames SCENARIOS="L4-4 no-fire,L4-4 tier5 tap-fire" node scripts/run-profiler.mjs
```

For post-processing isolation:

```bash
BYPASS_POSTPROCESSING=1 PROFILE_MODE=long-frames SCENARIOS="L4-4 no-fire" node scripts/run-profiler.mjs
```

## Verification Already Run

After the profiler and diagnostic flag changes:

```bash
npm test
npm run build
node --check scripts\collect-render-stats.mjs
node --check scripts\run-profiler.mjs
```

Results:

- Vitest passed: `21` files, `166` tests.
- Production build passed.
- Script syntax checks passed.
