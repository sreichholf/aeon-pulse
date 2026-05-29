# AEON PULSE Level Render Stats Handoff

## Purpose

Continue performance work from the current state of `/home/stephanr/src/git/private/aeon-pulse`, focusing on Level 4 draw-call reduction.

## Current State

Pending changes add render profiling instrumentation:

- Runtime flags in `src/constants.ts`: `renderStats=1`, `invincible=1`.
- Debug HUD expansion in `src/Game.ts`.
- Fixed Three.js draw-call reporting in `src/Scene.ts` by disabling `renderer.info.autoReset` and resetting once per app frame.
- Bullet source/render-unit stats in `src/entities/Bullet.ts`, `src/systems/GameplayRun.ts`, and `src/types.ts`.
- Render ownership tagging via `src/systems/RenderStats.ts`.
- Major render roots tagged across entities, backgrounds, and terrain.

ADR note: `RenderCategory` is a regular string enum, matching `docs/adr/0003-string-enums-for-discriminators.md`.

## Verification Already Run

`npm run build` passed after the instrumentation changes.

Browser profiling was run against the user-running dev server at `http://127.0.0.1:5173/` with `?renderStats=1&invincible=1`, using temporary Chrome/CDP scripts in `/tmp`.

The profiler has also been added to the repository at `scripts/collect-render-stats.mjs`.

To rerun it:

1. Start the dev server with `npm run dev`.
2. Start Chrome with remote debugging on port 9222.
3. Run `node scripts/collect-render-stats.mjs`.

## Key Findings

Bullets are not the primary draw-call issue.

Recent profiling results:

| Scenario | Draw calls avg/max | Object units avg/max | Bullet units avg/max |
|---|---:|---:|---:|
| L1 no-fire | 263 / 324 | 290 / 367 | 3 / 7 |
| L1 tier 5 fire | 229 / 285 | 250 / 305 | 42 / 51 |
| L4 no-fire | 602 / 729 | 621 / 746 | 6 / 16 |
| L4 tier 5 fire | 557 / 644 | 566 / 687 | 42 / 57 |

Exact max category/detail owners from that run:

| Scenario | Max categories | Max details |
|---|---|---|
| L1 no-fire | `enemy:172`, `background:161`, `player:31`, `bullet:7` | `enemy:5`, `enemyDiver:5`, `enemySine:4`, `player:2` |
| L1 tier 5 fire | `background:161`, `enemy:69`, `bullet:51`, `player:32` | `player:40`, `playerWave:10`, `enemy:3`, `enemySine:1` |
| L4 no-fire | `terrain:369`, `enemy:225`, `background:125`, `player:31`, `bullet:16` | `terrain.column:270`, `terrain.backing:90`, `background.ember:75`, `background.geyserParticle:25`, `background.rockPlate:12`, `enemySine:10`, `lava:10`, `background.spire:8` |
| L4 tier 5 fire | `terrain:370`, `enemy:126`, `background:125`, `bullet:57`, `player:32` | `terrain.column:270`, `terrain.backing:90`, `background.ember:75`, `player:40`, `background.geyserParticle:25`, `background.rockPlate:12`, `background.spire:8` |

Largest Level 4 owners:

- `terrain`: up to about 370 object units.
- `terrain.column`: about 270.
- `terrain.backing`: about 90.
- `background`: about 125.
- `background.ember`: about 75.
- `background.geyserParticle`: about 25.
- bullets: max about 57.

## Recommended Next Step

Start with `src/level/Terrain4.ts`.

The most promising reduction is converting the many per-slot basalt column meshes and backing lava planes into `THREE.InstancedMesh` groups:

- one instanced mesh for top columns,
- one for bottom columns,
- one for top backings,
- one for bottom backings,
- optionally leave debris as-is until after measuring.

Keep collision/wall math unchanged. The first pass should only change presentation storage and per-frame transform updates.

After that, rerun the same profiling scenarios and compare:

- L4 no-fire,
- L4 tier 5 tap-fire.

## Suggested Skills

- `diagnose`: use for measurement loop discipline and validating performance changes.
- `grill-with-docs`: use before changing `Terrain4` architecture; document any durable decision in ADRs if the rendering model changes.
- `handoff`: use again before pausing or switching agents.

## Useful Paths

- `AGENTS.md`
- `docs/adr/0003-string-enums-for-discriminators.md`
- `src/level/Terrain4.ts`
- `src/level/Background4.ts`
- `src/systems/RenderStats.ts`
- `scripts/collect-render-stats.mjs`
- `src/Scene.ts`
- `src/Game.ts`

## Notes

No secrets or private credentials were used or recorded.
