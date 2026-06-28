# ADR 0011 — Projectile Instanced Rendering

**Status:** Accepted  
**Date:** 2026-05-30

The game shifts from individual separate meshes and groups for active projectiles (which scales draw calls and garbage collection linearly with bullet counts) to a transparent, zero-allocation projectile instanced rendering system. The `Scene` class intercept `add` and `remove` operations on all objects marked with `RenderCategory.BULLET` (satisfying ADR 0003's string enum requirement), redirecting them from the active Three.js scene graph to a centralized `ProjectileInstancer`. The `ProjectileInstancer` manages a dynamic pool of `THREE.InstancedMesh` batches, keyed by geometry and material UUID combinations, and updates their instance matrices every frame in a highly optimized loop. To keep allocations and garbage collection overhead at absolute zero, a flat list of renderable meshes and their pre-computed keys are compiled only once upon bullet registration and cached on the parent mesh's `userData['compiledMeshes']` property, enabling plain `for`-loop iterations during active gameplay frames without closures or string concatenations. To prevent memory leaks, a listener is bound to the material's `'dispose'` event to automatically clean up and dispose of corresponding instanced meshes when cloned or tinted bullet materials are garbage collected.

## Considered Options

**Individual separate meshes (original)** — Simple and uses standard Three.js scene graph, but incurs massive CPU-to-GPU draw call overhead (over 50+ draw calls under Tier 5 fire) and causes severe frametime micro-stutter due to continuous dynamic allocations and disposals.

**Full Projectile Pool expansion only** — Solves garbage collection spikes by reusing bullet objects, but fails to address the visual draw call bottleneck since each active bullet remains an independent drawable element in the Three.js scene.

**Manual matrix math inside Bullet update** — Low draw calls, but requires rebuilding bullet physics, movement tracking, and collision detection to operate on flat array structures, tightly coupling rendering optimization with gameplay behavior and violating the repository's separation-of-concerns heuristic.
