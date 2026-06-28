# ADR 0005 — Collision Module: Event-Driven Seam

**Status:** Accepted  
**Date:** 2026-05-24

The Collision module detects overlaps and reports typed `CollisionContact` values via a callback; it does not produce side effects or resolve combat. `checkCollisions` takes a narrow `CollisionState` (typed entity arrays, no score/audio/scene/effects) and an `onContact: (contact: CollisionContact) => void` callback.

Combat resolution is a separate module in `src/systems/CombatResolution.ts`. It turns collision contacts into combat mutations and typed `HitEvent` outcomes: enemy damage, boss damage, shield/life checks, bullet deactivation, ram damage, and powerup collection outcomes. The active gameplay runtime — `GameplayRun.ts` — remains responsible for orchestration side effects such as spawning explosions, updating score, playing audio, creating powerups, and destroying collected powerups.

The alternative was keeping side effects inside `checkCollisions`, which is how it was originally written. That required importing `Explosion`, `ScoreManager`, `IAudio`, and `IScene` into the Collision module, and passing a `GameSnapshot` containing the entire game state. The module could not be tested without constructing a Three.js scene and audio context.

## Consequences

- `checkCollisions` imports only collision-facing structural contracts and entity interfaces needed for concrete contact references.
- `IPlayer` and `IPowerUp` are added to `src/types.ts` to complete the seam.
- `IBoss.lasers` becomes `readonly lasers: ReadonlyArray<ICollidable>` — non-optional, default `[]` in `BossBase`. The `boss?.lasers` type escape hatch in Collisions is replaced by unconditional iteration.
- `CollisionContact` is a discriminated union for overlap facts: player bullet vs enemy, player bullet vs boss zone, boss laser vs player, terrain vs player, enemy bullet vs player, enemy ram vs player, and powerup vs player.
- `HitEvent` is now a combat-resolution outcome with four kinds: `enemy-killed`, `boss-hit`, `player-hit` (with `cause: 'bullet' | 'terrain' | 'ram' | 'laser'`), `powerup-collected`.
- `player-hit` still fires only for unshielded hits — `Player.hit()` returns `false` for shielded hits and handles the shield flicker internally, so no event is needed.
- The `terrain` field is omitted from `CollisionState`; `player.terrainBounds !== null` serves as the terrain-active guard.
