# ADR 0017 — Catalog-Driven Bullet Preview Cycling in the Tactical Database

**Status:** Accepted  
**Date:** 2026-06-09

## Context

The Tactical Database viewer displays a "bullet preview" on each entity card so the player can see what projectile type an enemy or boss fires. The original approach spawned the real gameplay entity and captured whatever bullets it fired during its normal tick cycle. This caused two problems:

1. **Load delay** — enemies initialise their fire timers to a random fraction of their fire interval (0.4–1.0×), so the first preview bullet could take several seconds to appear.
2. **Inconsistent cycling rate** — fast-firing entities (e.g. Boss 2 at 1.1–2.2 s between shots) cycled through bullet types much faster than slow-firing entities, making the display feel erratic rather than deliberate.

Attempts to fix this by zeroing fire timers and gating replacement with a staleness flag added significant complexity to `TacticalDossierCard` without addressing the root cause.

## Decision

The Tactical Database uses **catalog-driven bullet preview cycling** rather than capturing bullets from the live entity tick.

1. `EnemyCatalogEntry` and `BossCatalogEntry` each gain a `viewerBulletTypes: BulletType[]` field listing the projectile types the entity can fire, in the order they should cycle. An empty array means no bullet preview.
2. The entity's `projectileFactory` in the viewer is replaced with a **no-op** that never allocates a `Bullet`. The entity still ticks for visual animation (recoil, wing flaps, etc.) but its firing output is ignored.
3. `TacticalDossierCard` receives a `bulletFactory: (type: BulletType) => ViewerBullet` callback in its constructor options, closed over the scene and sprites by `TacticalDatabase`. The card constructs preview bullets itself via this callback, independently of entity firing.
4. The card cycles through `viewerBulletTypes` on a fixed **5-second timer**. The first preview bullet is shown immediately on the first `update()` tick (timer initialised to the lifetime on construction). The timer resets and the index advances each time a new bullet is shown.

## Consequences

- Bullet preview timing is always exactly 5 seconds per type, independent of fire cadence.
- The entity's `_fireTimer`-zeroing logic and the stale/gate complexity in `TacticalDossierCard` are fully removed.
- Adding a new enemy or boss to the viewer requires declaring its `viewerBulletTypes` in `EntityCatalog`, which is already the required update point for all viewer metadata.
- Entities with no bullet preview (Charger, Obstacle, player page) use `viewerBulletTypes: []` and the card simply shows no preview, consistent with current behaviour.
- `TacticalDatabase` remains the only site that calls `new Bullet(...)` directly in the viewer (ADR 0015 sandbox exception).
