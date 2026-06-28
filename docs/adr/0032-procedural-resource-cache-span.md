# Procedural Resource Cache spans standard enemies and finale bosses

Five procedurally built standard enemies (Stalactite, EnemyTurret, RockDrake, EnemySpore, Obstacle) share a byte-identical init-once cache pattern — `static _cachedGeometries` / `static _cachedMaterials` / `static initSharedResources()`, all booted from `Game.ts`. The Chapter 4 Finale Boss (Boss4) builds its materials per-instance inside `_build3DModel` and does not use the cache, even though its static materials (rock, facet, plate) are constructed from the same Volcanic hex colors as Stalactite and RockDrake. We extract the cache pattern into a shared `ProceduralResourceCache` in `src/utils/ProceduralToolkit.ts` and migrate Boss4 into it, so the cache pattern has one shape across all procedural entities rather than a popcorn-enemy variant and a boss variant that future bosses would copy.

## Decision

- `ProceduralResourceCache` holds `{ geometries: Map<string, BufferGeometry>, materialTemplates: Map<string, MeshPhongMaterial> }` with an init-once guard. Entities own their key names; the cache is dumb about what it stores.
- Boss4's static materials (rock, facet, plate) become cached templates. Its animated materials (`_headJointMat`, `_headEyeMat`, `_jointMats`, `coreMat`) stay per-instance because they mutate every tick.
- A `VOLCANIC_COLORS` constant in `ProceduralToolkit.ts` shares the hex color values across Stalactite, RockDrake, and Boss4. The *materials* are not shared as templates across those three because Boss4 uses `flatShading + vertexColors` while the other two do not — only the color values are shared.
- No flash-overlay helper is introduced. `DEFAULT_FLASH_MATERIAL` is already shared from `StandardEnemyModel.ts`; per-entity toggle wiring (`_flash()` / `_restoreFlash()`) stays local because overlay count and shape vary per entity (Stalactite: 1, RockDrake: 7, Boss4: 0).

## Considered options

- **Extract the cache for the five standard enemies only; leave Boss4 as a documented outlier.** Rejected: it establishes a cache-pattern fork — popcorn enemies cache, bosses don't — that future bosses would inherit by copying Boss4. The conservative instinct to skip Boss4 underweights the cost of future divergence.
- **Introduce a `VolcanicPalette` chapter-scoped concept.** Rejected: only two entities (Stalactite, RockDrake) share byte-identical material construction; Boss4's material construction differs. Elevating that to a chapter-level palette over-abstracts a narrow coincidence, and the existing **Procedural Resource Cache** glossary term already names the cross-entity concept without a chapter qualifier.
- **Flash-overlay helper/mixin.** Rejected: the material is already shared; the per-entity toggle wiring is small and varies in shape (single overlay vs array vs none), so a helper would have to be parametric enough to handle all three shapes — more abstraction than the duplication warrants.

## Consequences

- The **Procedural Resource Cache** glossary term (renamed from "Procedural Enemy Resource Cache") now covers standard enemies and finale bosses; its example list expands to include Boss4.
- Boss4's static materials move from per-instance construction to cached templates. Its animated materials remain per-instance and are cloned from templates where helpful, matching the pattern Stalactite already uses (`mats.jointTemplate.clone()`).
- Future procedural finale bosses should adopt the cache pattern rather than copy Boss4's pre-migration per-instance construction.
- Orthogonal to ADR 0024: GLB-backed bosses (Boss3 / Heartseer) remain on their own loader and are unaffected.
