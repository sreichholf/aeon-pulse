# AEON PULSE Projectile Pooling Handoff

## Current Objective

Continue implementing finding 3 from the 3D rendering performance review: reduce projectile allocation churn before addressing draw-call count.

## Relevant Prior Work

- Finding 1 was implemented and committed as `042f427 Remove charged projectile lights`.
- Finding 2 was discussed and intentionally skipped for now because it is best treated as an optional performance fallback, not a new default visual direction.
- Projectile pooling design decisions were captured in `docs/adr/0003-string-enums-for-discriminators.md` under `Amendment — Projectile Pooling Boundary`.

## Decisions From Grill Session

- Solve allocation churn first, not draw-call count.
- Use a run-scoped projectile factory/pool owned by `GameplayRun`, not a global pool.
- First pass should pool only basic linear/simple-presentation projectiles.
- Initial poolable types: basic `player` and `enemy` shots only.
- Keep direct `new Bullet(...)` available for non-pooled and special projectiles.
- Inactive pooled projectiles should be removed from the Three scene, then re-added on reuse.
- Keep `destroy()` as the gameplay-facing lifecycle method. Pooling can use internal acquire/release vocabulary.
- `Bullet` should not know about its pool. The pool owns recycling externally. `Bullet` may expose reset/reinitialize behavior.

## Implementation Pointers

- `src/entities/Bullet.ts` currently constructs and owns projectile mesh state directly.
- `src/systems/Gameplay.ts` updates bullets and destroys inactive/offscreen bullets.
- `src/systems/GameplayRun.ts` owns `_bullets`, run cleanup, and hostile-bullet clearing.
- `src/entities/Player.ts` spawns player bullets via its private `_spawn()`.
- `src/entities/Enemy.ts` spawns basic enemy shots via `_shootAtPlayer()` and `_shootBurst()`.
- ADR 0003 says projectile `presentation` remains the source for mesh construction and animation callbacks.

## Suggested Skills

- `grill-with-docs`: use again if implementation reveals an architectural trade-off not covered by the current ADR amendment.
- `diagnose`: use if pooling introduces lifecycle bugs, missing scene removals, stale collision state, or visual duplication.

## Verification

- Run `npm run build`.
- Manual check at `http://localhost:5173` is recommended because there is no test suite.
