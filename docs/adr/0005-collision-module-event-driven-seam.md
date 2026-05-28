# ADR 0005 — Collision Module: Event-Driven Seam

**Status:** Accepted  
**Date:** 2026-05-24

The Collision module detects overlaps and reports typed `HitEvent` values via a callback; it does not produce side effects. `checkCollisions` takes a narrow `CollisionState` (typed entity arrays, no score/audio/scene/effects) and an `onHit: (e: HitEvent) => void` callback. The caller — `Game.ts` — handles all orchestration: spawning explosions, updating score, playing audio, destroying collected powerups.

The alternative was keeping side effects inside `checkCollisions`, which is how it was originally written. That required importing `Explosion`, `ScoreManager`, `IAudio`, and `IScene` into the Collision module, and passing a `GameSnapshot` containing the entire game state. The module could not be tested without constructing a Three.js scene and audio context.

## Consequences

- `checkCollisions` imports only interfaces: `IPlayer`, `IEnemy`, `IBoss`, `IBullet`, `IPowerUp`.
- `IPlayer` and `IPowerUp` are added to `src/types.ts` to complete the seam.
- `IBoss.lasers` becomes `readonly lasers: ReadonlyArray<ICollidable>` — non-optional, default `[]` in `BossBase`. The `boss?.lasers` type escape hatch in Collisions is replaced by unconditional iteration.
- `HitEvent` is a discriminated union with four kinds: `enemy-killed`, `boss-hit`, `player-hit` (with `cause: 'bullet' | 'terrain' | 'ram' | 'laser'`), `powerup-collected`.
- `player-hit` fires only for unshielded hits — `Player.hit()` returns `false` for shielded hits and handles the shield flicker internally, so no event is needed.
- The `terrain` field is omitted from `CollisionState`; `player.terrainBounds !== null` serves as the terrain-active guard.
