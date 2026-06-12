# AEON PULSE Render Warm-Up Handoff

Updated: 2026-06-12

## Current Objective

Implement the first Chapter 4 FPS mitigation pass: a boot-time **render warm-up pass** for standard enemy visuals.

The design decision is resolved: this is render warm-up, not asset preload. Existing preload loads GLB data, but the measured stalls are first-use GPU/material/shader/render work.

## Suggested Skills

- `diagnose` — use when validating whether the warm-up actually removes cold long frames.
- `grill-with-docs` — use if the implementation scope drifts into a broader render-resource lifecycle decision.
- `handoff` — use again if stopping before implementation or measurement is complete.

## Must-Read References

- `docs/chapter4-fps-diagnosis.md` — full diagnosis log, measurements, resolved warm-up plan, guardrails, and acceptance target.
- `docs/render-optimization-notes.md` — profiler workflow and long-frame mode commands.
- `AGENTS.md` — current test/browser/profiler guidance.
- `src/Game.ts` — existing boot preload flow.
- `src/Scene.ts` — renderer/composer ownership and `noPost=1` diagnostic switch.
- `src/entities/EntityCatalog.ts` — source-of-truth spawn path for standard enemies.

## Resolved Design

Do not create an ADR for this first pass. Keep it documented in `docs/chapter4-fps-diagnosis.md` and `docs/render-optimization-notes.md`.

Warm-up should:

- Run after `Game._preloadAssets()` and before entering `TITLE`.
- Use the real `EntityCatalog` / `spawnEnemy()` path.
- Start with `straight`, `sine`, `diver`, `swarm`, `turret`, `charger`, `rockDrake`, and `stalactite`.
- Exclude projectile warm-up initially. Add it later only if measurements show projectile-specific cold stalls.
- Keep warm-up entities visible to the camera during compile/render work, then destroy them before the title screen appears.
- Use no-op audio and projectile seams.
- Avoid creating a fake `GameplayRun`.
- Log warm-up duration when profiling/debug flags are enabled.

## Acceptance Criteria

- Cold `L4-4 no-fire` no longer shows 500-600 ms render frames.
- First target for worst cold long frame is roughly `<= 100 ms`, near warmed behavior.
- No title/gameplay state changes after warm-up.
- No visible title flicker or enemy flash.
- Scene counts return to normal after cleanup.
- Warm-up duration is observable in logs/probe output.
- Remaining warmed 50-75 ms enemy-render dips are treated as a separate visual-cost optimization task.

## Implementation Sketch

Likely add `src/systems/RenderWarmup.ts`.

Potential shape:

1. Receive `Scene`, `sprites`, and no-op seams.
2. Spawn selected standard enemies through `spawnEnemy()`.
3. Place them in a compact visible grid inside the gameplay camera frustum.
4. Call `scene.renderer.compileAsync(...)` if usable for the real scene/camera.
5. Force one or two `scene.render(0)` calls, including composer path when normal post-processing is active.
6. Destroy all spawned enemies and verify cleanup.
7. Return duration/status for logging.

Be careful not to set warm-up objects `visible = false`; Three.js may skip invisible objects and fail to compile/upload the target render paths.

## Verification Plan

Run:

```bash
npm test
npm run build
node --check scripts\collect-render-stats.mjs
node --check scripts\run-profiler.mjs
```

Then use the in-app browser or profiler flow:

```bash
PROFILE_MODE=long-frames SCENARIOS="L4-4 no-fire,L4-4 tier5 tap-fire" node scripts/run-profiler.mjs
```

For post-processing isolation:

```bash
BYPASS_POSTPROCESSING=1 PROFILE_MODE=long-frames SCENARIOS="L4-4 no-fire" node scripts/run-profiler.mjs
```

Compare against the measurements in `docs/chapter4-fps-diagnosis.md`.

## Current Working Tree Context

There are already uncommitted diagnostic changes:

- `AGENTS.md`
- `docs/chapter4-fps-diagnosis.md`
- `docs/render-optimization-notes.md`
- `scripts/collect-render-stats.mjs`
- `scripts/run-profiler.mjs`
- `src/Game.ts`
- `src/Scene.ts`
- `src/systems/GameplayRun.ts`
- `src/systems/PerfProbe.ts`
- `HANDOFF.md`

Do not revert these unless explicitly asked. They are part of the current diagnosis/profiler work.
