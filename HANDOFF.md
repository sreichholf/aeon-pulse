# AEON PULSE Chapter 4 Stutter Investigation Handoff

Updated: 2026-06-10

## Current State

Chapter 4 stutter investigation has moved from diagnosis into a first render-cost reduction pass. Keep the probe for now; it is still useful and query-gated behind `?perfProbe=1`.

The strongest finding remains: the stutter is render/compositor-side, not Terrain4, Background4, collision, or general gameplay update work. The worst spikes now appear lower after batching selected enemy visuals, but they are not fully eliminated.

## Files Changed

- `src/Game.ts`
- `src/Scene.ts`
- `src/entities/EntityCatalog.ts`
- `src/entities/EnemySine.ts`
- `src/entities/EnemyStraight.ts`
- `src/systems/Gameplay.ts`
- `src/systems/GameplayRun.ts`
- `src/systems/PerfProbe.ts` new
- `vite.config.js`

## Implemented

1. Perf overlay/probe

- `Game.ts` now updates the visible allocation/perf panel DOM every 250 ms instead of every RAF.
- Heap sampling still happens per frame.
- `PerfProbe.ts` adds hidden JSON output in `#aeon-perf-probe` when `?perfProbe=1`.
- Probe records frame gaps, previous-frame timing, phase maxima, heap deltas, entity counts, render counts, and render ownership.

2. Render ownership instrumentation

- `Scene.ts` records projectile, flash, and composer/render timings.
- `Scene.ts` records render calls, triangles, active bullets, and category/detail render ownership when probe is enabled.
- `Gameplay.ts` / `GameplayRun.ts` record update-side timings and active object counts.
- `EntityCatalog.ts` marks spawned enemies with detail labels like `enemy.sine` and `enemy.straight`.

3. Vite dev-server stability

- `vite.config.js` ignores `.tmp/**` in the file watcher.
- This prevents Chrome/CDP profile files under `.tmp` from crashing Vite with locked cookie/cache files.

4. `EnemySine` render reduction

- Top/bottom nozzle meshes are now one 2-instance `InstancedMesh`.
- Top/bottom flame meshes are now one 2-instance `InstancedMesh`.
- Existing vectoring and flame jitter behavior is preserved through per-frame instance matrix updates.
- Claws, iris, pupil, recoil, and banking remain independent.

5. `EnemyStraight` render reduction

- A worker subagent was assigned `EnemyStraight`; it did not return a final message before shutdown, but visible local edits were reviewed and verified.
- The kept changes merge the red visor strip into the hull geometry and drive its glow through the hull shader uniform.
- Flame outer cones and hot cores are merged into one animated flame mesh using vertex colors.
- Recoil, flame scaling, visor pulse, gun-point world positions, projectile semantics, and cockpit transparency are preserved.
- A local experiment to remove the full procedural decal shader was reverted because it did not improve measured spikes and downgraded visible detail.

## Measurements

In-app browser was used first. It loads the app and probe with no console errors, but keyboard automation still does not advance the game past the title screen. CDP fallback was used only for automated gameplay timing.

Final CDP run against `http://127.0.0.1:5174/?renderStats=1&perfProbe=1&invincible=1`:

- `4-4` no-fire, 35 s:
  - long frames: 6
  - long-frame rate: 0.0021
  - worst gap: 58.1 ms
  - max render/composer: 59.1 / 59.0 ms
  - max render calls: 156
  - max render objects: 157
  - max enemy units: 133
  - max `enemy.sine`: 90
  - max `enemy.straight`: 24

- `4-4` tier-5 tap-fire, 45 s:
  - long frames: 8
  - long-frame rate: 0.0023
  - worst gap: 43.5 ms
  - max render/composer: 39.6 / 39.4 ms
  - max render calls: 135
  - max render objects: 123
  - max enemy units: 70
  - max bullets: 42 active render units

Earlier CDP runs before these enemy reductions had render/composer spikes in the 90 ms to 500 ms range depending on run variance. The current result is better, but still has occasional >25 ms frames.

## Verification

Passing after the latest changes:

```bash
npm test
npm run build
```

`npm test` passed with 160/160 tests.

In-app browser smoke:

- Loaded `http://127.0.0.1:5174/?perfProbe=1&invincible=1`.
- Canvas present.
- Hidden probe present.
- No browser console errors.
- Automated in-app keyboard input still did not reach gameplay, so CDP was used for play/probe automation.

## Important Failed Experiments

Do not repeat these without a new reason:

- `Scene.precompile()` / level-start warm-up: tried and removed; did not reduce active-play stalls.
- `noPost=1` render bypass: tried and removed; direct `renderer.render()` still exhibited stalls.
- Removing `EnemyStraight` procedural decals: tried and reverted; no measured benefit, visible detail loss.

## Recommended Next Steps

1. Keep `PerfProbe.ts` for now.

It is query-gated, low overhead when off, and gives useful phase/render ownership data.

2. Manually inspect visuals.

Use the in-app browser visually or a controlled Chrome session:

- `EnemySine` in gameplay scale and tactical database
- `EnemyStraight` in gameplay scale and tactical database
- Check Sine nozzles/flames still vector and pulse
- Check Straight visor pulse, flame scale, recoil, and gun firing positions

3. If stutter remains visible, optimize the next shared render offenders.

The final probe still shows high enemy render ownership during dense Chapter 4 windows. Next likely targets:

- `EnemyTurret` at up to 20 render units
- `Stalactite` at up to 20 render units
- `RockDrake` at 16 render units
- remaining `EnemySine` claws if visual fidelity allows a per-enemy claw instancing pass

4. Consider a shared enemy visual batching strategy only after one more targeted pass.

Several enemies repeat small static meshes with independent animation. A shared helper for per-entity 2-instance or 4-instance mesh parts may be worth it, but only if another concrete entity optimization repeats the same pattern.
