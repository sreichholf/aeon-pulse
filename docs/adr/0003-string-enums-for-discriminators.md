# ADR 0003 — String Enums for Discriminators

**Status:** Accepted  
**Date:** 2026-05-24

## Context

The TypeScript migration (MIGRATION_PLAN.md Decision 5) originally chose string literal unions for all game discriminators and `as const` objects for sets needing runtime iteration. In practice this produced two concrete problems:

1. **Dual declaration for `GameState`.** `types.ts` exported `type GameState = 'TITLE' | 'PLAYING' | ...` while `Game.ts` independently maintained `const State = { TITLE: 'TITLE', ... } as const` so that call sites could write `State.PLAYING` instead of the bare string. Two sources of truth for the same six values.

2. **Untyped enemy spawn calls.** `SpawnEnemyFn` accepted `type: string`, meaning a typo in any wave definition (e.g. `'strait'` for `'straight'`) would silently fail at runtime. TypeScript could not catch it.

String literal unions solve neither problem: they are type-only (erased at compile time), so they cannot serve as runtime values, and they do not constrain a `string` parameter without a separate union type threaded through every call site.

## Decision

Replace the three string literal union discriminators with string enums. Member names use SCREAMING_SNAKE_CASE; string values preserve the existing runtime strings so no serialised or audio-keyed data changes.

```ts
export enum GameState {
  TITLE          = 'TITLE',
  PLAYING        = 'PLAYING',
  GAME_OVER      = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_COMPLETE  = 'GAME_COMPLETE',
  VIEWER         = 'VIEWER',
}

export enum EnemyType {
  STRAIGHT   = 'straight',
  SINE       = 'sine',
  DIVER      = 'diver',
  SWARM      = 'swarm',
  TURRET     = 'turret',
  CHARGER    = 'charger',
  SPORE      = 'spore',
  OBSTACLE   = 'obstacle',
  ROCK_DRAKE = 'rockDrake',
  STALACTITE = 'stalactite',
}

export enum BulletType {
  PLAYER        = 'player',
  PLAYER_CHARGE = 'playerCharge',
  PLAYER_WAVE   = 'playerWave',
  PLAYER_PLASMA = 'playerPlasma',
  ENEMY         = 'enemy',
  HOMING        = 'homing',
  BOSS          = 'boss',
  BOSS_LASER    = 'bossLaser',
  WAVE          = 'wave',
  LAVA          = 'lava',
}
```

`BulletTypeName` and `EnemyTypeName` are retired; callers use `BulletType` and `EnemyType`.  
`SpawnEnemyFn` becomes `(type: EnemyType, x: number, y: number) => void`.  
The `const State` object in `Game.ts` is deleted; call sites use `GameState.PLAYING` etc.

Regular string enums (not `const enum`) compile to a plain object and are compatible with Vite's `isolatedModules` constraint.

## Alternatives considered

**String literal unions only** — type-safe at interface boundaries but cannot serve as runtime values, cannot constrain a loose `string` parameter, and require duplicating the value set in an `as const` object if call sites need member access. Rejected because it fails both problems above.

**`as const` + derived type** — `export const State = {...} as const; export type GameState = typeof State[keyof typeof State]` — eliminates the dual-declaration problem for GameState without changing call sites, but does nothing for the untyped `SpawnEnemyFn`. Rejected in favour of a single consistent pattern across all three discriminators.

**`const enum`** — inlines values at compile time but does not work reliably across file boundaries with Vite's `isolatedModules`. Rejected.

## Consequences

- `Game.ts` drops the `State` const object; two files (`Game.ts`, `InputManager.ts`) need state comparisons updated to `GameState.*`.
- Four wave files and three entity files need enemy type literals updated to `EnemyType.*`.
- Thirteen entity files need bullet type literals updated to `BulletType.*`.
- Future discriminators (new game states, enemy types, bullet types) are added to the relevant enum in `types.ts` — one place, one change.
- A typo in a wave definition is now a compile error, not a silent runtime no-op.

## Amendment — Projectile Definitions

**Date:** 2026-05-26

`BulletType` remains the canonical discriminator for projectiles that cross entity, collision, and HUD-facing boundaries. Projectile behavior is no longer encoded directly as flat booleans on `BulletDef` inside `Bullet.ts`.

Projectile definitions are deepened into `ProjectileDefinition` records with explicit sections:

- `faction` — whether collision should treat the projectile as player-fired or hostile.
- `collision` — AABB half-extents and offscreen padding.
- `damage` — damage amount and piercing behavior.
- `movement` — a discriminated movement strategy such as linear, homing, or linear wave.
- `presentation` — mesh construction and animation callbacks.

Internal projectile variants may still use non-canonical source keys, such as `enemySine`, when they need distinct presentation or movement while still reporting a canonical `IBullet.type` like `BulletType.ENEMY`. This keeps `BulletType` stable as the public discriminator while allowing the projectile catalog to describe richer implementation details.

Future projectile variants should be added through the projectile definition catalog. Avoid adding new `Bullet.ts` booleans such as `isAcid`, `wiggles`, or `spins`; represent those as named movement or presentation definitions instead.

## Amendment — Difficulty Mode Enum

**Date:** 2026-05-28

The difficulty mode values (`'rookie'`, `'pilot'`, `'ace'`) are extracted to a string enum `DifficultyMode` in `types.ts`. All loose string types across `Game.ts`, `Player.ts`, `ScoreManager.ts`, and `UI.ts` are refactored to use `DifficultyMode` for complete compile-time type-safety.
