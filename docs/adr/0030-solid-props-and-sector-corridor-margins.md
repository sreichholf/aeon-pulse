# Solid Props and Sector corridor margins (v2 environment variation)

In v1, every Prop is non-solid and Sector "vertical distribution" only affects where background landmarks appear visually. v2 extends the Sector framework so that individual Sectors can change the playable corridor width, and individual Props can become solid obstacles that block movement and projectiles, damage the player on contact, and are destroyed to open a lane.

## Decision

Props gain an optional `isSolid` property. A solid Prop blocks the player, enemies, and all projectiles (both player and enemy). Touching a solid Prop from any side deals the same `PLAYER_HIT` consequence as terrain or enemy contact, with a soft push away from the Prop center so the player cannot remain inside it and take repeated damage. Solid Props are destroyed by accumulated damage and disappear, permanently opening the lane they occupied. Piercing player projectiles penetrate a solid Prop but consume one pierce charge, preserving the `Focused Plasma` Tier-5 identity.

Sector definitions gain an optional `playfieldMargins` value (`{ top: number; bottom: number }`) that widens or narrows the safe corridor for that Sector. This lives on `SectorDefinition` beside terrain points and prop layouts, and is applied to the player's `terrainBounds` and to enemy spawn clamping. In terrain chapters it composes with the terrain wall shape; in open chapters it becomes the actual clamp bounds.

## Considered options

- **Solid props as terrain mutation.** Rejected: mutating the terrain control-point geometry would couple Props to the Terrain implementation and make the collision seam much harder to reason about. Standalone floating props are simpler and support the "barrier in an open corridor" use case that terrain alone cannot.
- **Player-only blocking.** Rejected: letting enemies or enemy bullets pass through solid props would make them behave like player-only traps and undermine their readability as physical objects.
- **No piercing penetration.** Rejected: a piercing weapon that stops at a Prop contradicts the established `Focused Plasma` identity and removes a meaningful tactical choice.

## Consequences

- Prop profiles must communicate solidity, and v2 will ship one dedicated solid prop kind per chapter while leaving existing v1 props non-solid.
- A shared visual cue (heavier silhouette / occlusion shadow / hardened material treatment) is required so players can distinguish solid from non-solid props at a glance, layered on top of chapter-specific geometry.
- Spawn validation is required to ensure solid props do not overlap terrain walls or spawn in positions that immediately crush the player against the screen edge.
- `Collisions.ts`, `CombatResolution.ts`, `Player.ts`, `Prop.ts`, `SectorDefinition`, and `GameplayRun` all need small seams to support solid prop collision, push-out, pierce handling, and corridor-margin application.
