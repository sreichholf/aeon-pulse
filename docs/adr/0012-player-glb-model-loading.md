# ADR 0012 — Player GLB Model Loading

**Status:** Accepted  
**Date:** 2026-06-01

The game shifts from purely procedurally constructed player ship geometry to a model-based approach loading `@/src/models/player.glb` at runtime. To maintain the game's premium feel and smooth arcade experience, we adopt a background preloading pattern combined with a normalization wrapper and a robust procedural fallback.

The `Game` class initiates asynchronous loading of the GLB asset using Three.js `GLTFLoader` during the startup phase (`Game.start()`). Since player interaction on the title screen is required before entering gameplay, the asset loading comfortably finishes in the background prior to `GameplayRun` starting. When active gameplay is initiated, the loaded model is passed to `GameplayRun` and then to the `Player` entity, where it is cloned.

To handle arbitrary GLB scale, rotation, and offset changes from modeling software without requiring manual geometry manipulation, the `Player` class encapsulates the cloned model inside a normalization wrapper. This wrapper computes the model's bounding box and size to dynamically center it and scale it to match the original procedural ship's length (72 units). Highly visible procedural animations and effects—such as plasma thrusters, the engine light, the weapon charge energy orb, and the shield aura—are preserved and anchored to this wrapper using local position offsets. If loading fails or takes too long, the system automatically falls back to the original procedural ship generator, guaranteeing robustness.

## Considered Options

**Asynchronous dynamic loading on demand** — Loading the model inside the `Player` constructor when the run starts. This is simpler to wire up but causes a noticeable "pop" or visual flicker where the player ship remains invisible or represented by a crude placeholder for the first few frames of the level.

**Pre-blocking loader screen** — Halting game boot with a loading bar until all assets are loaded. This is robust but adds unnecessary friction and wait time at startup when the title screen options selection phase offers a natural, zero-friction background loading window.

**Pure asset-based rendering only (no fallback)** — Discarding the procedural ship builder entirely. While this reduces codebase size, it makes the game fragile to missing assets or loading errors. Maintaining a clean procedural fallback ensures the game remains robust and playable in all development and testing environments.
