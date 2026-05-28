# ADR 0006 — Gameplay Tick Extraction

**Status:** Accepted  
**Date:** 2026-05-24

The per-frame entity update loop is extracted from `Game._updateGameplay` into a standalone `tickGameplay(world: WorldState, dt: number)` function in `src/systems/Gameplay.ts`. `Game._updateGameplay` builds a `WorldState`, calls `tickGameplay`, syncs the filtered arrays back, then calls `checkCollisions` separately.

`tickGameplay` deliberately stops before collision detection. Collision detection (ADR 0005) needs access to the game's system singletons — score, audio, scene — to handle hit outcomes. Pulling it into `tickGameplay` would require threading those singletons through `WorldState`, making the function's dependencies as wide as the original `_updateGameplay`. The split keeps `tickGameplay` testable with pure entity stubs and no audio context.

`WorldState` is a plain mutable struct. `tickGameplay` replaces the filtered arrays in place (`world.enemies = world.enemies.filter(...)`); `Game` syncs them back after the call. The alternative — returning a new `WorldState` — would allocate a fresh object every frame for no benefit at this scale.
