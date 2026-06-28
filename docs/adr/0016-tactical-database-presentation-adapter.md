# ADR 0016 — Tactical Database Presentation Adapter

**Status:** Accepted
**Date:** 2026-06-09
**Amended:** 2026-06-24 (viewer readiness moved behind the catalog seam; viewer offsets passed via adapter options)

The Tactical Database viewer uses the `TacticalDossierCard` adapter (`src/viewer/TacticalDossierCard.ts`) to wrap spawned aerospace models and gameplay entities for database cards.

To prevent architectural leakage and maintain a strict separation of concerns, the Tactical Database must not write database-specific state, properties, or tracking variables directly onto standard gameplay entities after construction.

The one sanctioned channel for viewer-specific entity setup is **Presentation Context**: a read-only constructor input that tells an entity whether it is being built for live gameplay or Tactical Database display. Entities may use that context only during construction to:

- select a prepared model variant
- resolve presentation constants to fields
- set a static initial display pose

Entities must not branch on Presentation Context from their hot-path `update()` / `_tick()` logic. Tactical Database subjects are not gameplay-ticked in the viewer.

The `TacticalDossierCard` adapter owns all viewer runtime behavior:

- Passive Inspection Motion
- card-slot positioning and framing
- reveal timing and material fade
- projectile preview cycling

Viewer-specific facts used by the adapter — such as presentation offsets and model-readiness triggers — are declared on the catalog entry (`EnemyCatalogEntry` / `BossCatalogEntry`) and passed into `TacticalDossierCard` through its constructor options. The adapter does not import entity classes or use `instanceof` maps to derive viewer behavior.

Both `EnemyCatalogEntry` and `BossCatalogEntry` specialise a single generic `ViewerCatalogEntry<TPresentation extends ViewerPresentation>` contract, where `ViewerPresentation` carries the shared `scale` / `centering` / `viewerOffsetX` triple plus `viewerProjectileKeys` and `preloadViewerModel()`. `EnemyViewerPresentation` adds `page` / `order`; `BossViewerPresentation` adds `bossArchetype` and boss-only `offsetX` / `offsetY`. `TacticalDatabase` consumes the widened `ViewerPresentation` through one `_applyViewerPresentation(mesh, presentation, x, y)` helper for both pages, folding boss offsets into `x` / `y` at the boss call site so the shared helper stays uniform.

## Consequences

- Viewer-only runtime behavior stays in the adapter; gameplay entities remain pure after construction.
- Gameplay entities (`IEnemy`, `IBoss`, etc.) may accept Presentation Context in constructors, but they must resolve it at build time rather than carrying a mutable viewer flag.
- The Tactical Database does not mutate `_isViewer`, `_entered`, `_getPlayerPos`, or similar ad hoc viewer state onto wrapped entities.
- Tactical Database subjects are displayed via adapter-owned Passive Inspection Motion instead of combat/gameplay ticking in the viewer.
- Resource cleanup (such as disposing geometries, materials, and preview bullets when changing database pages) is handled cleanly through the adapter's `destroy()` method.
- Tactical Database layout and card behaviors remain testable in isolation, and the constructor-only rule is grep-enforceable in entity hot paths.
- Viewer presentation offsets and model-readiness hooks live on `EntityCatalog` entries, so the adapter imports only the catalog and needs no class-identity lookup.
- Stage-enemy and boss catalog entries share one generic `ViewerCatalogEntry` contract (over a common `ViewerPresentation`); the Tactical Database's presentation application code is a single shared helper, not a per-page duplicate.
