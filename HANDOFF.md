# AEON PULSE Game Action & Balance Overhaul Handoff

This handoff outlines the design decisions and implementation plan for the Game Action and Balance Overhaul. The design has been fully aligned and grilled using the `/grill-with-docs` process.

## Summary of Grilled Decisions

### 1. Weapon Progression & Recovery Balance
*   **Tier 1 (Rapid) Buff:** Firing cooldown reduced from `0.14s` to `0.08s` (12.5 shots/sec) to make it a fast, narrow laser stream. This prevents the "recovery slog" where dying and returning to Tier 1 feels unplayable.
*   **Differentiated Cooldowns:**
    *   Tier 1 (Rapid): `0.08s`
    *   Tier 2 (Twin): `0.10s`
    *   Tier 3 (Spread): `0.12s`
    *   Tier 4 (Wave) & Tier 5 (Focused Plasma): `0.14s`
*   **Tap-Fire Piercing Limit:** Basic tap-fired Wave and Plasma bullets will no longer have infinite piercing. Instead, they will be **Semi-Piercing Projectiles** (piercing exactly `1` enemy, disappearing on the second).
*   **Charge Shot Pierce:** Infinite piercing remains exclusive to **Charge Shots**, giving players a strategic choice to hold charge for sweeping lanes.

### 2. Pacing & Level Action Density
*   **Timeline Compression:** Wave timeline absolute offsets in all chapters (`chapter1.ts` to `chapter4.ts`) will be scaled down by **35%** (a timeline scale factor of `0.65`).
*   **Level Duration Snapping:** Shorten standard levels to match compressed timelines. `bossAt` scroll distance across all chapters will be reduced from `11200` to `7300` units.
*   **Terrain Alignment:** Terrain control points (`terrainPoints` in `Levels.ts`) will have their `at` coordinates scaled inline by `0.65` during instantiation (e.g., inside `Levels.ts` factory methods) to preserve spatial layout.
*   **Ambient Popcorn Spawner:** To remove "nothing happens" dead periods on screen, `LevelManager.ts` will implement a timer-based spawner that trickles minor enemies into the game at random Y heights every `2.5s to 4.0s` (randomized).
    *   **Chapter 1 Pool:** `Straight` (70%), `Sine` (30%)
    *   **Chapter 2 Pool:** `Straight` (40%), `Sine` (40%), `Charger` (20%)
    *   **Chapter 3 Pool:** `Straight` (30%), `Sine` (30%), `Swarm` (40%)
    *   **Chapter 4 Pool:** `Straight` (30%), `Sine` (30%), `Charger` (20%), `Swarm` (20%)

---

## Proposed Codebase Changes

### [MODIFY] [types.ts](file:///e:/Develop/GitHub/aeon-pulse/src/types.ts)
*   Add `remainingPierce?: number` to `IBullet` interface to track finite penetrations.

### [MODIFY] [BulletsPlayer.ts](file:///e:/Develop/GitHub/aeon-pulse/src/entities/BulletsPlayer.ts)
*   Add `pierceCount?: number` option to `BulletDef`.
*   Set `piercing: true` and `pierceCount: 1` on `ProjectileSourceKey.PLAYER_WAVE` and `ProjectileSourceKey.PLAYER_PLASMA`.
*   Verify that `PLAYER_CHARGE` (and other heavy charge bullets) keep `piercing: true` with `pierceCount: undefined` (infinite).

### [MODIFY] [BulletsEnemy.ts] / [ProjectileDefinitions.ts](file:///e:/Develop/GitHub/aeon-pulse/src/entities/ProjectileDefinitions.ts)
*   Extend `ProjectileDamage` and `deepenDefinition` to carry and pass `pierceCount` through to `Bullet` instantiation.

### [MODIFY] [Bullet.ts](file:///e:/Develop/GitHub/aeon-pulse/src/entities/Bullet.ts)
*   Store `remainingPierce` mutable variable on bullet construction, reading from the projectile definition.

### [MODIFY] [CombatResolution.ts](file:///e:/Develop/GitHub/aeon-pulse/src/systems/CombatResolution.ts)
*   In `PLAYER_BULLET_ENEMY` resolution:
    *   If `bullet.isPiercing` is true:
        *   If `bullet.remainingPierce` is defined, decrement it. If it reaches `0`, set `bullet.active = false`.
        *   Otherwise (infinite pierce), keep it active.
    *   If `bullet.isPiercing` is false, set `bullet.active = false`.

### [MODIFY] [Player.ts](file:///e:/Develop/GitHub/aeon-pulse/src/entities/Player.ts)
*   Modify `_fireTap()` and `_fireCharged()` to use the appropriate bullet source keys:
    *   Use new `PLAYER_WAVE_TAP` (semi-piercing) for basic tap fires, or construct them with a damage/pierce override.
*   Update `RAPID_COOLDOWN` dynamically depending on `this.weaponTier` (0.08s for Tier 1, 0.10s for Tier 2, 0.12s for Tier 3, 0.14s for Tiers 4/5).

### [MODIFY] [chapter1.ts] / [chapter2.ts] / [chapter3.ts] / [chapter4.ts]
*   Pass `0.65` into the `Timeline` constructors in each chapter file:
    ```typescript
    new Timeline<ChapterXAnchor>(0.65)
    ```

### [MODIFY] [Levels.ts](file:///e:/Develop/GitHub/aeon-pulse/src/level/Levels.ts)
*   Change `bossAt: 11200` to `7300` across all chapters.
*   Update `createTerrain` definitions to scale `pts` inline:
    ```typescript
    createTerrain: (scene, pts) => new Terrain(scene, pts.map(pt => ({ ...pt, at: pt.at * 0.65 })))
    ```

### [MODIFY] [LevelManager.ts](file:///e:/Develop/GitHub/aeon-pulse/src/level/LevelManager.ts)
*   Implement `_popcornTimer` in `update()`.
*   Define chapter popcorn lists and spawn a random popcorn enemy at a random Y location when the timer fires, resetting to `2.5s + Math.random() * 1.5s`.

---

## Suggested Skills

*   **diagnose**: Use this skill if any of the three-point lighting, bullet instancing, or collision event mutations throw runtime errors.
*   **prototype**: Useful if you want to test the feel of `0.08s` fire rate or the popcorn trickle before committing the full timeline compression.

---

## Verification Plan

1.  **Compiler & Test Verification:**
    *   Run `npm run build` to verify clean build bundles.
    *   Run `npm test` to ensure Vitest suites pass.
2.  **Tactical Database Check:**
    *   Press `V` on the Title screen to check that the Aeon Pulse Craft and enemies render correctly and previews cycle without issue.
3.  **Manual Playtesting Smoke Checklist:**
    *   Verify Tier 1 Rapid fire rate feels fast and handles single targets cleanly.
    *   Confirm Timeline Compression has removed empty scroll stretches in early levels.
    *   Verify that basic Wave and Focused Plasma bullets only pierce one enemy and vanish on the second, but Charge Shots still clear columns infinitely.
    *   Check that random popcorn enemies spawn in gaps to keep the screen active.
