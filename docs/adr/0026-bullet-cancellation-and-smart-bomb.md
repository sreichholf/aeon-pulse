# ADR 0026 — Bullet Cancellation and Smart Bomb Mechanics

**Status:** Accepted  
**Date:** 2026-06-19

## Context

Following a review of the game's difficulty loop and taking inspiration from traditional shoot-'em-ups (shmups), we identified the need for more spectacle and a pressure-release valve for the player. The game's strict 1-hit life system creates high tension, but players lack a dedicated defensive panic button, and defeating large threatening enemies lacks the visual reward of "clearing the board."

## Decisions

### 1. Bullet Cancellation
When a high-value enemy (specifically Bosses, `EnemyCharger`, or `RockDrake`) is killed, the game will instantly neutralize all active enemy projectiles on the screen.
- **Trigger**: The `HitResult` interface and `HitEventKind.ENEMY_KILLED` will be extended with a `triggerCancellation?: boolean` flag.
- **Resolution**: `GameplayRun.ts` will listen for this flag. Upon detection, it will iterate through all hostile bullets in the active pool, release them, and spawn a `CancellationPointItem` at each bullet's coordinates.
- **Point Items**: Instead of a passive score pop, cancelled bullets transform into physical point items. These items will briefly linger, then aggressively magnetize toward the player craft. To keep the collision matrix pure (ADR 0005), these items will be implemented as `IEffect` entities that manage their own distance-to-player checks rather than participating in the primary `Collisions.ts` sweep. Crucially, to prevent stalling and score-farming, bullets cancelled by a Smart Bomb are worth 0 points (acting purely as a visual clear), while bullets cancelled by killing a high-value enemy grant standard points.

### 2. Smart Bomb (Overdrive)
The player craft will be equipped with a finite "Smart Bomb" resource.
- **Input**: Triggered by the `Shift` key. A strict 75ms "death-bomb" grace period exists: if the player takes a lethal hit, they have exactly 75ms to press the bomb key to consume a bomb, save their life, and trigger the overdrive effect.
- **Stock**: The player spawns with a fixed stock (e.g., 2 per life). Stock resets to 2 upon death. Players can acquire additional bombs during a life via a rare "Bomb Item" drop, but the total stock is hard-capped (e.g., maximum of 4) to prevent hoarding.
- **Effect**: Activation provides 2 seconds of player invulnerability, clears all enemy bullets on screen (via the same Bullet Cancellation point-item conversion), and deals massive damage (e.g., 200 HP) to all active standard enemies. Boss hit zones are capped to receive a maximum of 20% of their total HP in damage from a single bomb.
- **Implementation**: Handled in `GameplayRun.ts`, listening to `input.isJustPressed('bomb')`. It will iterate through `_enemies` and `_boss` to apply damage directly via `.hit()`, respecting the cap for bosses.

## Consequences

- The `CombatResolution` seam remains clean by only passing a boolean flag rather than owning the screen-clear side effects.
- The player gains a finite, highly destructive panic button that increases tactical depth without trivializing the 1-hit kill mechanic.
- The `ProjectilePool` and `GameplayRun` take on the responsibility of managing bullet-to-point-item conversion.
- By making `CancellationPointItem` an `IEffect`, we avoid adding potentially hundreds of new AABB checks per frame to the core `checkCollisions` function.
