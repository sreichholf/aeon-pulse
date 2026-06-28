# ADR 0024 — Standard Enemy Model Source

**Status:** Accepted
**Date:** 2026-06-18
**Amended:** 2026-06-24

The four GLB-backed standard enemies (`EnemyStraight`, `EnemySine`, `EnemyDiver`, `EnemySwarm`) each carried an identical copy of the model-loading lifecycle — static prepared/promise caches, `preloadModel`, `_loadModel` (GLTFLoader + MeshoptDecoder + promise-cache + prepare + store), and a `_build3DModel` branch that attached either synchronously from cache or asynchronously on load. We extract that lifecycle into a single **Standard Enemy Model Source** (`src/systems/StandardEnemyModel.ts`): one source instance per enemy, configured with that enemy's presentation profiles and Model Render Bucket config. The source owns loading, per-context caching, and `attach({ target, context, isAlive, onInstance })`, which builds and parents the instance and guards `isAlive` at resolve time so no instance is built for an enemy that died before its model loaded.

`StandardEnemyModel.ts` previously owned model **preparation** (ADR 0019) but not the **loading lifecycle**; this ADR moves the lifecycle there too, so preparation and loading live in one module.

## Considered Options

- **Per-enemy Source object (chosen):** config-driven instance per enemy. Collapses ~140 lines of duplication; four configs are four adapters, so the seam is real. Each enemy keeps only what differs: where the instance is parented, capturing the flash overlay, and Swarm's instancing flag.
- **Abstract base class enemies extend:** rejected — inheritance couples the loading lifecycle to the entity class, and a static-per-subclass cache is awkward to express on a shared base.
- **Free functions over a passed-in cache:** rejected — the cache objects would still live as static fields on each enemy, so the duplication only half-collapses.
- **Generalize the Source over Boss3/Heartseer too:** rejected — Heartseer prep is bucket-free scene-cloning, so sharing would force the Source generic over the prepare step to absorb a single extra adapter. Revisit if a second GLB boss appears.
- **Inject a GLTFLoader for unit-testing dedup:** rejected for now — the load path is thin glue, prep is already unit-tested, and integration is covered by browser playtest. One real adapter is a hypothetical seam.

## Consequences

- The duplicated lifecycle is deleted from the four enemies; each keeps a one-line static `preloadModel(ctx)` delegating to its source. The Tactical Database viewer reaches that preload through the catalog entry's `preloadViewerModel()` hook, while boot warm-up (`Game.ts`) call sites are unchanged.
- The reveal in ADR 0023 relied on the enemy's own `attachModel` chaining the *same* shared promise that the viewer's `preloadModel().then()` chains, guaranteeing the model is attached before the viewer applies centering/clipping/reveal. That shared promise now lives inside the Source rather than being copy-pasted per enemy — the ordering guarantee is preserved and concentrated in one place.
- The Source is the place to change load, cache, or attach behavior for all standard enemies at once.
- Boss3 continues to own its own loader; the two loaders are intentionally not unified. Boss3's preload is also surfaced through the catalog entry's `preloadViewerModel()` hook, so the Tactical Database adapter imports no boss classes.
