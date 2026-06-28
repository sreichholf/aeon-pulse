# Render Baseline

Cross-chapter render baseline.
This file is the current measured snapshot and should be replaced in full on each fresh full-suite rerun.

**Measured:** 2026-06-27
**Tool:** `npx playwright test --project=render-baseline --headed`
**Aggregate output:** `node scripts/aggregate-profile.mjs`
**Browser:** Headed Playwright Chromium on the active desktop display (hardware WebGL)
**Scenarios:** Level 4 of each chapter (dense non-finale), no-fire + tier-5 tap-fire forced, plus Chapter 4 sweep
**Sample counts:** 30 samples per no-fire scenario, 45 per tap-fire scenario
**Per-scenario JSON:** `.tmp/playwright-profile/*.json`

> On this machine, in-game headless Playwright browser runs can fail before `window.game` boots with `THREE.WebGLRenderer: Error creating WebGL context.` Use a headed Playwright browser run for hardware-WebGL render profiling unless the headless path has already been verified locally.

PERF-1 attribution: each scenario's `.tmp/playwright-profile/*.json` now includes a `peakComposition` array (per enemy-type × Model Render Bucket: `batchCount`, `instanceCount`, `triangleCount`) captured as the median of the top-N worst frames by draw calls. The per-scenario peak-composition sub-tables below show it; the analysis and prioritized safe-reductions list are in the [PERF-1 Findings & Safe Reductions](#perf-1-findings--safe-reductions) section at the end of this file.

---

## Summary Table

| Scenario | Avg calls | Max calls | Avg FPS | Min FPS (Lows) | Max objects | Max triangles | Top category (max units) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **L1-4 no-fire** | 47 | 52 | 72 | 1 | 39 | 299k | background 23 |
| **L1-4 tier5 tap-fire** | 73 | 83 | 74 | 21 | 76 | 116k | bullet 30 |
| **L2-4 no-fire** | 61 | 90 | 71 | 0 | 77 | 192k | enemy 37 |
| **L2-4 tier5 tap-fire** | 80 | 105 | 73 | 0 | 89 | 139k | bullet 34 |
| **L3-4 no-fire** | 57 | 68 | 71 | 0 | 59 | 153k | enemy 26 |
| **L3-4 tier5 tap-fire** | 76 | 98 | 73 | 0 | 91 | 133k | bullet 32 |
| **L4-4 no-fire** | 67 | 91 | 72 | 0 | 91 | 150k | enemy 40 |
| **L4-4 tier5 tap-fire** | 79 | 114 | 73 | 0 | 110 | 100k | enemy 40, bullet 35 |
| **L4-1 no-fire** | 54 | 70 | 72 | 0 | 59 | 200k | enemy 20 |
| **L4-2 no-fire** | 58 | 75 | 72 | 0 | 61 | 137k | enemy 27 |
| **L4-3 no-fire** | 65 | 82 | 72 | 0 | 75 | 150k | enemy 33 |
| **L4-5 no-fire** | 63 | 84 | 72 | 0 | 75 | 110k | enemy 27 |

---

## Chapter Notes

### L1-4 no-fire

```text
calls     avg 47  max 52
fps       avg 72  max 76  (min 1)
objects   avg 34  max 39
triangles avg 149300  max 298768
```

Measured ownership peaked at `background 23`, `prop 6`, `enemy 4`, `player 3`, `bullet 2`.
Top sector/detail markers: `prop.sensorPod: 6`, `background.arch: 5`, `background.tower: 4`, `background.dust: 4`, `prop.cargoCanister: 4`.

Peak composition (max calls = 52):

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 16 | 127640 |
| diver | body | 1 | 3 | 56352 |
| swarm | body | 1 | 8 | 28512 |

### L1-4 tier5 tap-fire

```text
calls     avg 73  max 83
fps       avg 74  max 76  (min 21)
objects   avg 65  max 76
triangles avg 53784  max 116015
bullets   avg 26  max 36  (render units avg 41 max 51)
```

Top ownership peaked at `bullet 30`, `background 23`, `effect 14`, `prop 6`, `enemy 4`.
Player projectile ownership peaked at `player 17 / 34 render units` plus `playerWave 9 / 9`.

Peak composition (max calls = 83):

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 6 | 47865 |
| swarm | body | 1 | 6 | 21384 |

### L2-4 no-fire

```text
calls     avg 61  max 90
fps       avg 71  max 76  (min 0)
objects   avg 49  max 77
triangles avg 110796  max 192400
```

Measured ownership peaked at `enemy 37`, `background 20`, `prop 9`, `bullet 6`, `terrain 5`, `player 3`, `effect 3`.
Top detail owners were `enemy.charger: 24`, `prop.fuelTank: 9`, `prop.furnaceVent: 6`, `background.turbine: 4`.

Peak composition (max calls = 90):

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 4 | 31910 |
| sine | body | 1 | 1 | 3402 |
| turret | glow | 7 | 7 | 2936 |
| turret | body | 3 | 3 | 1912 |

> The `turret glow` row shows 7 batches for 7 instances — one draw call per glow material per turret because each `EnemyTurret` clones its coil material per-coil (`EnemyTurret.ts:395`). See PERF-1 Findings.

### L2-4 tier5 tap-fire

```text
calls     avg 80  max 105
fps       avg 73  max 76  (min 0)
objects   avg 74  max 89
triangles avg 56131  max 139097
bullets   avg 26  max 37  (render units avg 41 max 56)
```

Top ownership peaked at `bullet 34`, `enemy 22`, `background 20`, `prop 9`, `uncategorized 6`.

Peak composition (max calls = 105):

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 6 | 47865 |
| sine | body | 1 | 1 | 3402 |
| turret | glow | 7 | 7 | 2936 |
| turret | body | 3 | 3 | 1912 |

### L3-4 no-fire

```text
calls     avg 57  max 68
fps       avg 71  max 76  (min 0)
objects   avg 46  max 59
triangles avg 107200  max 152868
```

Measured ownership peaked at `enemy 26`, `background 20`, `prop 9`, `terrain 7`, `player 3`, `effect 3`, `bullet 2`.
Top detail owners were `enemy.charger: 17`, `prop.hiveBulb: 9`, `background.womb: 4`, `background.spore: 4`.

Peak composition (max calls = 68):

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 6 | 47865 |
| swarm | body | 1 | 1 | 3564 |
| sine | body | 1 | 1 | 3402 |
| obstacle | glow | 2 | 6 | 2844 |
| spore | body | 1 | 3 | 240 |
| spore | glow | 1 | 3 | 108 |
| obstacle | body | 1 | 3 | 72 |

### L3-4 tier5 tap-fire

```text
calls     avg 76  max 98
fps       avg 73  max 76  (min 0)
objects   avg 71  max 91
triangles avg 68513  max 132787
bullets   avg 25  max 36  (render units avg 52 max 111)
```

Top ownership peaked at `bullet 32`, `enemy 23`, `background 20`, `prop 9`, `uncategorized 9`, `effect 8`.

Peak composition (max calls = 98):

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 6 | 47865 |
| spore | body | 1 | 2 | 160 |
| spore | glow | 1 | 2 | 72 |

### L4-4 no-fire

```text
calls     avg 67  max 91
fps       avg 72  max 76  (min 0)
objects   avg 65  max 91
triangles avg 67300  max 150482
```

Measured ownership peaked at `enemy 40`, `background 13`, `terrain 11`, `prop 10`, `bullet 5`, `player 3`, `effect 3`.
Top detail owners were `prop.brittleBasaltColumn: 10`, `enemy.charger: 8`, `background.geyser: 4`.

Peak composition (max calls = 91):

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| diver | body | 1 | 4 | 75136 |
| straight | body | 2 | 2 | 15955 |
| turret | glow | 14 | 14 | 5872 |
| turret | body | 3 | 6 | 3824 |
| sine | body | 1 | 1 | 3402 |
| stalactite | glow | 6 | 6 | 1008 |
| rockDrake | glow | 5 | 5 | 672 |
| rockDrake | body | 11 | 11 | 396 |
| stalactite | body | 3 | 9 | 366 |

> `turret glow: 14 batches / 14 instances` is the standout fragmentation: two turrets each clone 7 distinct glow materials (4 coils + vent + muzzle + ring) → 14 one-instance batches. `rockDrake body: 11 batches` is structural (11 distinct geometry+material compositions across 5 animated segments) and must stay separate to preserve per-segment ripples. See PERF-1 Findings.

### L4-4 tier5 tap-fire

```text
calls     avg 79  max 114
fps       avg 73  max 76  (min 0)
objects   avg 82  max 110
triangles avg 45500  max 99690
bullets   avg 24  max 31  (render units avg 39 max 52)
```

Top ownership peaked at `enemy 40`, `bullet 35`, `background 13`, `effect 13`, `terrain 11`, `prop 10`.
Player projectile ownership peaked at `player 16 / 32 render units` plus `playerWave 9 / 9`.

Peak composition (max calls = 114):

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| sine | body | 1 | 1 | 3402 |
| rockDrake | glow | 9 | 10 | 1344 |
| rockDrake | body | 11 | 22 | 792 |
| stalactite | glow | 2 | 2 | 336 |
| stalactite | body | 3 | 3 | 122 |

> `rockDrake body: 11 batches / 22 instances` confirms the 11 distinct (geometry, body-material) keys batch across instances (same key → grouped into one batch with 2 instances each), so the instancing is working correctly; the 11 batch count is the inherent number of animated sub-meshes and must stay separate to preserve the per-segment rippling animation.

### L4-1, L4-2, L4-3, L4-5 no-fire

```text
L4-1  calls avg 54 max 70 | fps avg 72 max 76 (min 0) | triangles avg 107068 max 200034
L4-2  calls avg 58 max 75 | fps avg 72 max 76 (min 0) | triangles avg 94416  max 136590
L4-3  calls avg 65 max 82 | fps avg 72 max 76 (min 0) | triangles avg 99500  max 150334
L4-5  calls avg 63 max 84 | fps avg 72 max 76 (min 0) | triangles avg 56226  max 110153
```

Volcanic-sector landmark/detail markers confirmed:
- `4-1`: `background.sector.basaltApproach: 2`
- `4-2`: `background.sector.magmaConduit: 2`
- `4-3`: `background.sector.crystalCavern` (no sample; sector renders under `background`)
- `4-5`: `background.sector.calderaHeart` (no sample; sector renders under `background`)

#### L4-1 no-fire peak composition (max calls = 70)

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 8 | 63820 |
| diver | body | 1 | 1 | 18784 |
| sine | body | 1 | 1 | 3402 |
| stalactite | glow | 2 | 2 | 336 |
| stalactite | body | 3 | 3 | 122 |

#### L4-2 no-fire peak composition (max calls = 75)

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 4 | 31910 |
| sine | body | 1 | 1 | 3402 |
| turret | glow | 7 | 7 | 2936 |
| turret | body | 3 | 3 | 1912 |
| stalactite | glow | 4 | 4 | 672 |
| stalactite | body | 3 | 6 | 244 |

#### L4-3 no-fire peak composition (max calls = 82)

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 8 | 63820 |
| diver | body | 1 | 1 | 18784 |
| sine | body | 1 | 1 | 3402 |
| rockDrake | glow | 5 | 5 | 672 |
| rockDrake | body | 11 | 11 | 396 |

#### L4-5 no-fire peak composition (max calls = 84)

| enemy-type | bucket | batches | instances | triangles |
|---|---|:---:|:---:|:---:|
| straight | body | 2 | 2 | 15955 |
| sine | body | 1 | 2 | 6804 |
| rockDrake | glow | 5 | 5 | 672 |
| stalactite | glow | 4 | 4 | 672 |
| rockDrake | body | 11 | 11 | 396 |
| stalactite | body | 3 | 6 | 244 |

---

## Current Takeaways

- This is the current authoritative cross-chapter baseline (2026-06-27 rerun). Numbers are within run-to-run variance of the 2026-06-22 baseline; the small upward drift in `L2-4 no-fire` max calls (84 → 90) and `L4-4 no-fire` max calls (87 → 91) reflects normal enemy-formation variation, not a regression.
- `4-4` remains the chapter draw-call peak. Its no-fire peak (`91`) and tap-fire peak (`114`) are both the highest in the chapter.
- Chapter 1 remains background-heavy in no-fire scenarios.
- Chapters 2 and 4 are strongly `enemy`-dominated in no-fire scenarios, especially `enemy.charger`.
- Tier-5 tap-fire scenarios remain bullet-heavy across all chapters, with Chapter 4 `4-4` producing the highest measured max draw-call peak at `114`.
- **PERF-1 attribution now live:** the `peakComposition` sub-tables above name the worst per-(enemy-type, Model Render Bucket) offenders. The standout finding is `EnemyTurret` glow fragmentation (7-14 one-instance batches per peak frame) caused by per-coil material clones; see [PERF-1 Findings & Safe Reductions](#perf-1-findings--safe-reductions) below for the prioritized list.

---

## PERF-1 Findings & Safe Reductions

This section is the one-time analysis of the per-scenario `peakComposition` sub-tables above: which (enemy-type, Model Render Bucket) pairs dominate draw-call and triangle cost at peak frames, and the prioritized list of safe reductions. The cold-start 500-600 ms first-use stalls that originally motivated the investigation were already eliminated by the boot-time `RenderWarmup` pass; the warmed steady-state peak (~91-114 calls at 72 avg FPS on hardware WebGL) is within frame budget, so the reductions below are candidate cleanups, not urgent fixes.

### How the instrumentation works

The profiler reads the *post-batch* draw cost from `EnemyInstancer._instancedMeshes`, keyed by `${geometry.uuid}_${material.uuid}` — i.e. the real number of `InstancedMesh` draw calls, not the source-mesh count. Each batch is attributed back to its source `EnemyType` via `userData[UserDataKey.ENEMY_TYPE]` on the enemy root group, and to its Model Render Bucket via the mesh's `userData.modelBucket` (GLB path, set by `StandardEnemyModel.ts:151`) falling back to the material's bucket (`proceduralResourceCache` templates stamped via `setMaterialBucket`). The Game tracks the top-N worst frames by `renderer.info.render.calls` in-process (gated on `_showRenderStats`, zero cost in normal play) and exposes the median per-(type,bucket) composition; the Playwright sampler reads it at the peak-calls sample.

`batchCount` is the number of distinct `InstancedMesh` draw calls for that (type, bucket) pair. `instanceCount` is the number of enemy instances contributing to those batches. `triangleCount` is the per-instance triangle sum × instance count. The efficiency signal is `instanceCount / batchCount`: a ratio of 1.0 means each instance is its own batch (no batching), a ratio > 1 means instances are sharing batches.

### Biggest buckets — the L4-4 focus (max calls = 91 no-fire / 114 tap-fire)

The `peakComposition` snapshot at L4-4's worst no-fire frame (91 calls):

| enemy-type | bucket | batches | instances | tris | batch efficiency |
|---|---|:---:|:---:|:---:|:---:|
| diver | body | 1 | 4 | 75136 | 4.0 (excellent) |
| straight | body | 2 | 2 | 15955 | 1.0 |
| turret | glow | 14 | 14 | 5872 | **1.0 (worst)** |
| turret | body | 3 | 6 | 3824 | 2.0 |
| sine | body | 1 | 1 | 3402 | 1.0 |
| stalactite | glow | 6 | 6 | 1008 | 1.0 |
| rockDrake | glow | 5 | 5 | 672 | 1.0 |
| rockDrake | body | 11 | 11 | 396 | 1.0 |
| stalactite | body | 3 | 9 | 366 | 3.0 |

The tap-fire frame (114 calls) drops the turret/stalactite rows (enemies die faster under tier-5) but keeps `rockDrake body: 11/22` and `rockDrake glow: 9/10`, confirming those 11 body batches genuinely batch across instances (same geo+material key → grouped, 2 instances per batch) — so the instancing is working; those 11 batch counts are the inherent number of distinct sub-meshes.

Across the wider sweep (`L4-1`..`L4-5`), the same signatures recur:
- `turret glow: 7` (1 turret) or `14` (2 turrets) one-instance batches whenever a turret is on screen.
- `rockDrake body: 11` batches whenever a RockDrake is on screen (structural; batches across instances at 2+).
- `stalactite glow: 2/4/6` one-instance batches scaling with stalactite count.

### Prioritized list of safe reductions

Ordered by achievable batch-count reduction × confidence that the change preserves the authored visual.

1. **EnemyTurret coil material — share one material across all 4 coils of a turret (and across turrets).** Today `EnemyTurret.ts:395` does `const cMat = this._coilMat!.clone();` inside the 4-iteration coil loop, producing 4 unique materials per turret; with 2 turrets that's 8 one-instance coil batches plus vent/muzzle/ring clones = 14 glow batches with 14 instances (efficiency 1.0). Sharing one coil material would collapse the 4 coil batches per turret to 1 (efficiency 4.0), and sharing it across turrets would further collapse to 1 batch with `4 × turretCount` instances. *Blocker:* the per-frame coil chase animation (`EnemyTurret.ts:451-459`) sets a different `targetEmissive` per coil per frame and discriminates on `chaseIdx === i`. A shared material would make all 4 coils flash identically, losing the chase. To keep the visual, the chase must move from per-material `emissive` to the instanced `instanceColor` channel (`setColorAt`), which the EnemyInstancer already supports. *Size of refactor:* medium (one visual system on one enemy). *Batch saving:* up to 7 → 1 glow batch per turret on screen; realistically drops the L4-4 glow batch count from 14+5+6 = 25 to ~1+1+6 = 8. **Highest-value safe reduction, but it is a visual-system refactor, not a one-line change.**

2. **EnemyTurret remove the unused intermediate `_coilMat` clone.** `EnemyTurret.ts:339` clones `mats.coilTemplate` into `this._coilMat`, but every coil then clones `_coilMat` again into its own `cMat` — the intermediate `_coilMat` is never put on a mesh. Deleting it does not change batching (the per-coil clones are the bottleneck), but it removes one wasted material allocation per turret and a misleading code path. *Zero-risk cleanup.* (No batch saving; correctness/clarity only.)

3. **Stalactite `jointMat` + `lavaTipMat` — defer the per-instance clone decision.** Today `Stalactite.ts:296-297` clones `jointTemplate`/`lavaTipTemplate` per instance so the thermal-heartbeat (`_tick` lines 390/393) and the shaking warning (`_tick` lines 433/436) can mutate `emissive` per stalactite with each stalactite's own `_time`. Sharing the templates across stalactites would sync every stalactite's pulse to the same phase, which reads as a less lively cave. *Not a safe reduction* unless the pulse desync is re-expressed via instance color or per-instance `_time` offsets baked into the shared material's shader uniforms. Defer; revisit only if stalactites become a measured bottleneck (they are cheap in absolute triangle terms: ~366 body + ~1008 glow per peak frame).

4. **RockDrake `jointMat` — same defer as Stalactite.** `RockDrake.ts:339` clones `jointTemplate` per instance for the cling-phase pulse (`_tick:544`) and burst flare (`_tick:551`). Sharing would sync the pulse. Defer for the same reason; RockDrake glow is ~672-1344 tris per peak frame, not dominant.

5. **RockDrake body (11 batches) — explicitly NOT safe to merge.** The 11 distinct (geometry, body-material) keys are the head, chestRock, chestClaw, chestPlate, mid, midPlate, midSpine, rearRock, rearClaw, rearPlate, and tail. Each segment group is independently rippled in `_tick` (`_segmentMeshes.forEach` moves `seg.position.y` and `seg.position.z` per segment per frame). Merging them into one geometry would freeze the per-segment crawl/wiggle animation, which is the RockDrake's signature read. The measurement confirms batching already collapses same-key instances across RockDrakes (`L4-4 tap-fire: rockDrake body 11 batches / 22 instances`), so the instancing is doing its job; the 11 batch count is the irreducible number of animated sub-meshes. Keep as-is.

6. **EnemyDiver — already optimal.** 1 body batch with up to 4 instances (efficiency 4.0). No action. (`diver` glass/glow buckets declared in `DIVER_MODEL_BUCKET_CONFIG` did not surface as separate batches in the peak frames captured; this is consistent with the diver GLB loading body first and glass/glow populating shortly after the peak moment — non-blocking, since `diver body` is the dominant triangle owner at 75k per peak frame.)

7. **EnemyStraight / EnemySwarm — already optimal.** Body batches collapse across instances (`L1-4: straight 2 batches / 16 instances`, `L4-1: straight 2 batches / 8 instances`). No action.

### Recommendation

Pursue #1 (turret coil shared material + instance-color chase) only if `4-4` peaks re-emerge as a felt hitch after the render-warm-up pass already shipped. The cold 500-600 ms first-use stalls are already gone (see boot-time `RenderWarmup`); the warmed steady-state peak of ~91-114 calls at 72 avg FPS on hardware WebGL is well within frame budget, and the worst offender by absolute cost is `diver body` at 75k triangles (a geometry-density issue, not a batching issue). The turret glow fragmentation is a real inefficiency but its absolute triangle cost (5.8k) is small, so it is a candidate cleanup rather than an urgent fix. Track a follow-up as a separate optimization task if felt-playtesting flags turret-heavy scenes.