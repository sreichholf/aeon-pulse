# ADR 0016 — Tactical Database Presentation Adapter

**Status:** Accepted  
**Date:** 2026-06-09

The Tactical Database viewer uses the `TacticalDossierCard` adapter (`src/viewer/TacticalDossierCard.ts`) to wrap spawned aerospace models and gameplay entities for database cards. 

To prevent architectural leakage and maintain a strict separation of concerns, the Tactical Database must not write database-specific states, properties, or tracking variables (such as card coordinates, bullet previews, or idle hover timers) directly onto standard gameplay entities.

## Consequences

- Viewer-only behavior, float animations, bullet previews, and card-slot positioning are entirely managed by the `TacticalDossierCard` adapter.
- Gameplay entities (`IEnemy`, `IBoss`, etc.) remain pure and carry no database-specific properties or runtime states.
- Resource cleanup (such as disposing of geometries, materials, and preview bullets when changing database pages) is handled cleanly through the adapter's `destroy()` method.
- Tactical database layout and card behaviors are testable in isolation.
