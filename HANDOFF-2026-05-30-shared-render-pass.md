# AEON PULSE Shared Render Pass Handoff

## Purpose

Continue performance work in `E:\Develop\GitHub\aeon-pulse`, shifting from chapter-local scenery optimization to shared rendering systems, especially:

- enemies
- player rendering
- player bullets and player-fired effects

## What Is Already Done

The original Level 4 scenery handoff in [LEVEL_RENDER_STATS_HANDOFF.md](E:/Develop/GitHub/aeon-pulse/LEVEL_RENDER_STATS_HANDOFF.md) is complete.

Chapter-local scenery passes have been completed for:

- Chapter 4 in [src/level/Terrain4.ts](E:/Develop/GitHub/aeon-pulse/src/level/Terrain4.ts) and [src/level/Background4.ts](E:/Develop/GitHub/aeon-pulse/src/level/Background4.ts)
- Chapter 1 in [src/level/Background.ts](E:/Develop/GitHub/aeon-pulse/src/level/Background.ts)
- Chapter 2 in [src/level/Terrain.ts](E:/Develop/GitHub/aeon-pulse/src/level/Terrain.ts) and [src/level/Background2.ts](E:/Develop/GitHub/aeon-pulse/src/level/Background2.ts)
- Chapter 3 in [src/level/Terrain3.ts](E:/Develop/GitHub/aeon-pulse/src/level/Terrain3.ts) and [src/level/Background3.ts](E:/Develop/GitHub/aeon-pulse/src/level/Background3.ts)

The reusable workflow and results are documented in [docs/render-optimization-notes.md](E:/Develop/GitHub/aeon-pulse/docs/render-optimization-notes.md).

## Current Outcome

Scenery is no longer the dominant draw-call problem.

Recent end-state chapter results from this session and prior passes:

- Chapter 4: `L4 no-fire` `166 / 275`, `L4 tier5 tap-fire` `119 / 193`
- Chapter 2: `2-5 no-fire` `157 / 301`
- Chapter 3: `3-1 no-fire` `188 / 299`, `3-5 no-fire` `150 / 306`

The important shift is ownership, not just totals:

- Chapter 3 before: `terrain:504`, `uncategorized:194`
- Chapter 3 after: `terrain:7`, `background:17`, with `enemy:227` now dominant

That same pattern now holds across chapters: the biggest remaining render owners are shared systems rather than chapter-specific scenery.

## Most Relevant Commits

- `ce80f4b` `level rendering`
- `3917b6e` `chapter1 level rendering`
- `e9820a6` `chapter2 level rendering`
- `e4f871d` `chapter3 level rendering`
- `557c8b2` `render optimization notes`

## Verification Workflow

Use the existing runtime profiler and browser-based verification described in:

- [AGENTS.md](E:/Develop/GitHub/aeon-pulse/AGENTS.md)
- [docs/render-optimization-notes.md](E:/Develop/GitHub/aeon-pulse/docs/render-optimization-notes.md)
- [scripts/collect-render-stats.mjs](E:/Develop/GitHub/aeon-pulse/scripts/collect-render-stats.mjs)

Important practical note from this session:

- `http://localhost:5173` worked reliably for Chrome/CDP capture
- `http://127.0.0.1:5173` was not reliable on this machine and produced `ERR_CONNECTION_REFUSED` during headless capture even when the app was otherwise available
- the most reliable measurement loop was a one-shot headless Chrome run with remote debugging on port `9222`
- the bundled Node runtime at `C:\Users\Stephan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` worked for the CDP script because it provides `WebSocket`; the system `node` did not

## Suggested Next Step

Start a new shared-systems profiling pass rather than more chapter background cleanup.

Recommended order:

1. Re-profile a dense no-fire scenario and one player-fire scenario with the current code.
2. Identify whether `enemy`, `player`, `bullet`, or player-specific detail owners such as `playerWave` dominate.
3. Tackle the largest shared owner first.

A likely first target is player-fire rendering because earlier stats already showed player-driven details becoming prominent during firing scenarios, but this should be confirmed with a fresh run before editing.

## Constraints And Notes

- Do not revert unrelated worktree changes.
- Browser verification is allowed directly.
- `npm run build` is the available build verification.
- Keep render-only optimization separate from gameplay behavior changes.
- If introducing any durable workflow note, prefer updating [docs/render-optimization-notes.md](E:/Develop/GitHub/aeon-pulse/docs/render-optimization-notes.md) rather than creating an ADR unless the decision becomes architectural.

## Suggested Skills

- `diagnose` for a disciplined measure -> isolate -> fix -> remeasure loop
- `grill-with-docs` if the shared rendering pass starts changing cross-cutting architecture or needs documentation updates
- `handoff` again before pausing or switching away from the shared-systems pass
