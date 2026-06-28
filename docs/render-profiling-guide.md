# Render Profiling Guide

How to measure render cost and the heuristic for choosing instancing. For the **current cross-chapter draw-call baseline** (the live measured snapshot), see [render-baseline.md](./render-baseline.md).

## Profiling Workflow

Use the runtime flags already wired into the game:

- `renderStats=1`
- `invincible=1`
- `testAudio=off` for non-audio profiling runs

Open the game with:

- `http://localhost:5173/?renderStats=1&invincible=1&testAudio=off`

Use the plain representative URL only when audio behavior is part of the profiling concern.

The FPS/debug HUD in [src/Game.ts](../src/Game.ts) reports:

- draw calls
- total visible object render units
- category ownership
- bullet ownership and bullet render units

For scripted capture, use:

```bash
npm run profile
```

`npm run profile` runs the Playwright `render-baseline` project (`e2e/specs/render-baseline.spec.ts`), which samples each scenario on a fixed cadence and writes per-scenario JSON summaries to `.tmp/playwright-profile/`. Aggregate them with `node scripts/aggregate-profile.mjs`.

Important execution note: for **in-game** Playwright profiling on developer machines, prefer a **headed Chrome/Chromium browser** so the run uses hardware-accelerated WebGL. The headless Playwright browser path can succeed for DOM-level automation yet still fail before `window.game` boots with `THREE.WebGLRenderer: Error creating WebGL context.` The common failure signature is a black page with only the FPS counter visible, plus no `window.game` / `window.__aeonTestProbe`. If you hit that condition, rerun headed rather than switching the profiler to SwiftShader by default.

Baseline acceptance rule: reject profiler output that looks like a broken or unpopulated scene instead of a real gameplay sample. Examples include suspiciously low triangles or draw calls for the scenario, `OBJECTS 0`, missing enemy/bullet ownership, or `PLAYING` without a live gameplay run. In those cases, inspect the browser console and runtime probe before treating the JSON summary as valid baseline data.

### Baseline vs Long-Frame Diagnosis

Use the profiler in two passes:

1. **Baseline mode** records the cross-scenario draw-call/FPS ownership snapshot:
   ```bash
   npm run profile
   ```
   Baseline is the default mode for the Playwright render-baseline spec. Scenario filters such as `SCENARIOS` can still be supplied via environment variables. When the machine requires hardware WebGL, run the Playwright project headed, for example:
   ```bash
   npx playwright test --project=render-baseline --headed
   ```
   Headed Playwright Chromium is a valid hardware-WebGL path; do not document system Chrome as a requirement unless Playwright Chromium itself fails on that machine.

2. **Long-frame mode** is a targeted second pass when baseline results show bad minimum FPS or visible stutter. Long-frame profiling remains available by adding `perfProbe=1` to the browser URL (e.g. `http://localhost:5173/?renderStats=1&invincible=1&perfProbe=1&testAudio=off`). It has not been ported to the Playwright `npm run profile` flow and stays manual; see ADR 0035 for the recorded decision.

Long-frame mode adds `perfProbe=1` to the runtime URL and captures hidden `PerfProbe` output for each scenario, including long-frame records, phase timings, level labels, `scrollX`, enemy counts by type, stage events, collision contacts, render calls, triangles, render categories/details, and bullet source counts.

To isolate post-processing cost from raw scene rendering, add `noPost=1` to the URL (e.g. `http://localhost:5173/?renderStats=1&invincible=1&perfProbe=1&noPost=1&testAudio=off`). This keeps the gameplay camera tilt and scene contents intact while bypassing `EffectComposer` for a direct `renderer.render()` path.

## Current Heuristic

When a chapter is draw-call bound, start with the largest current ownership bucket from `cats` and `details`. Earlier Chapter 1/4 passes were scenery-bound, so `background.*` and `terrain.*` were the right first targets. The current cross-chapter baseline has shifted toward `enemy.*`, so run long-frame diagnosis before choosing a shared enemy, projectile, terrain, or wave-density optimization. The per-(enemy-type, Model Render Bucket) `peakComposition` sub-tables in [render-baseline.md](./render-baseline.md) name the specific offenders directly.

Prefer `THREE.InstancedMesh` when all of the following are true:

- many repeated decorative meshes share the same geometry and material
- the objects differ mostly by transform, visibility, or instance color
- gameplay logic can stay data-driven and unchanged

Avoid mixing render-only optimization with gameplay rewrites. The winning pattern so far has been:

1. identify the dominant render owner from `cats` and `details`
2. convert repeated meshes to instanced storage
3. preserve collision, wave timing, and movement behavior
4. rerun the same measurement and compare ownership again

## Scenario Guidance

The detailed stats reduce the need to always measure both no-fire and tap-fire.

Recommended default:

- for chapter-local scenery work, use one dense representative no-fire scenario first
- add a tap-fire spot check only if the change could affect bullets, player effects, update order, or other shared gameplay rendering
- for shared systems such as enemies, bullets, or projectile pooling, keep gameplay-fire scenarios in the loop

## Scope Boundary

This guide does not establish a rule that all background code must use instancing.

It does establish a practical preference:

- if a chapter hotspot is mostly repeated visual decoration, instancing is the first optimization tool to try
- if the hotspot has shifted to `enemy`, `bullet`, or `player`, treat that as a separate shared-systems pass rather than continuing chapter-local background cleanup
