# ADR 0023 — Tactical Database Signal Acquisition Reveal

**Status:** Accepted (supersedes the streaming enemy-load behavior introduced in commit `d974fe9`)
**Date:** 2026-06-18
**Amended:** 2026-06-24

The Tactical Database now constructs every dossier subject immediately instead of awaiting each model's GLB preload before spawning. Because standard-enemy and boss entities set their intel (display name, HP, score) as synchronous constructor constants and already attach their GLB asynchronously via `_loadModel().then(attachModel)`, the viewer can render all Tactical Dossier Card frames and readouts at once and let each subject materialize independently when its own model attaches. This is the **Signal Acquisition Reveal** behavior in `CONTEXT.md`.

## Considered Options

- **Streaming pop-in (previous, `d974fe9`):** `await` each model preload, then spawn and re-render the card grid as each entity arrives. Cards appeared one-by-one in load-completion order over a blank grid, and every arrival rebuilt the whole card DOM. Rejected as the source of the janky load feel.
- **Hoist HP/score/name into `EntityCatalog`:** render cards from static catalog data and spawn entities only for meshes. Rejected — it duplicates gameplay-authoritative HP/score into a second source that can drift; the entity constructor already exposes this metadata synchronously, so no duplication is needed.
- **3D shader dissolve reveal:** per-material `onBeforeCompile` dissolve with an emissive edge band. Rejected as high-risk — it must coexist with each model's existing `onBeforeCompile`, its Model Render Buckets, and the viewer's clipping planes. A CSS scanline sweep plus a model opacity fade gives the same materialize read with no shader/clipping conflict.

## Consequences

- The viewer no longer `await`s model preload before spawning. Each subject is constructed up front so its Tactical Dossier Card (frame, name, HP, score) renders immediately; the model area shows an idle "ACQUIRING" scan state until the GLB attaches.
- Presentation centering (`Box3.setFromObject`) and clipping-plane application move from spawn-time to a **model-attached hook**, since the GLB now arrives after construction rather than synchronously. The previous code only worked because the `await` guaranteed the model was already attached at spawn time. The model-attached hook now triggers readiness via the catalog entry's declared `preloadViewerModel()` hook, so `TacticalDatabase` imports no entity classes.
- The reveal — a CSS scanline sweep over the card plus an opacity fade — animates only the viewer-owned cloned clipping-plane materials, which are disposed on page change. No shared gameplay materials are mutated, preserving ADR 0016 (no viewer state on gameplay entities).
- Bullet Preview Cycling (ADR 0017) starts only after a subject's reveal completes, so a projectile preview never floats beside a not-yet-materialized frame.
- Applies to both the stage-enemy page and the boss page for consistent Tactical Database behavior.
