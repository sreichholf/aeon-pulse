# ADR 0025 — Projectile motion stays inline in Bullet

**Status:** Accepted
**Date:** 2026-06-18

Projectile motion math (linear integration, homing steering + evasion despawn + velocity alignment, and the linear-wave wobble) stays inline in `Bullet.update()` rather than being extracted into per-kind movement behavior adapters. An architecture review surfaced the split between motion *selection* (`movementFor()` in `ProjectileDefinitions.ts`, which maps `BulletDef` flags to `ProjectileMovement` params) and motion *math* (`Bullet.update()`) as a possible deepening. We deliberately decline it.

## Considered Options

- **Leave motion inline (chosen).** The motion math is ~30 cohesive lines in one place. Projectile motion is a fixed set of exactly three kinds — `LINEAR`, `HOMING`, `LINEAR_WAVE` — that saturate all 14 projectile definitions, with no bespoke motion anywhere: every projectile (including BOSS_LASER, LAVA, WAVE) moves only through `Bullet.update()`, and bosses never touch projectile position after spawn. There is no growth signal in history (no new-motion requests, no motion bugs).
- **Per-kind behavior adapters + MovementHost interface (rejected).** Extracting the three kinds into adapters would mostly *move* the 30 lines and *add* an interface plus three classes — complexity does not vanish, it relocates. For a frozen three-kind set with no extensibility pressure, this is a shallow split, not a deepening.

## When to revisit

Reopen this if either becomes true:

1. A fourth (or composed) motion kind is needed — e.g. spiral, accelerating, boomerang. Then per-kind adapters earn their keep and `Bullet.update()` stops accreting branches.
2. Motion-math correctness needs regression protection. Motion is currently untested and cannot be unit-tested without constructing a full `Bullet` (scene + presentation). If that protection is wanted, introduce a narrow `MovementHost` seam so a fake host can drive homing/wave/linear math in Vitest — and write those tests as the reason the seam exists.
