# ADR 0021 — Instanced Rendering for Popcorn Enemies

**Status:** Accepted  
**Date:** 2026-06-12

To support high-density waves (such as a swarm of 40+ units) without hitting CPU-bound WebGL draw call bottlenecks, standard high-density popcorn enemies must be rendered using `THREE.InstancedMesh` instead of adding individual group meshes to the active Three.js scene graph.

## Context

Standard enemies currently add unique mesh groups directly to the scene graph. While this works well for low-count complex enemies with procedural parts (e.g., Rock Drakes), spawning 40+ Swarms or Straight enemies drives the scene draw calls past 100+, causing WebGL API overhead to throttle the rendering main thread.

## Decision

- Create a shared `EnemyInstancer` in `Scene.ts` with a capacity of 512 per geometry-material key.
- Popcorn enemies (like `EnemySwarm` and `EnemyStraight`) will flag their 3D groups with `group.userData.isInstanced = true`.
- In `Scene.add()`, if the game state is not `GameState.VIEWER` and `isInstanced` is true, the group will be intercepted and fed to the `EnemyInstancer` rather than direct scene insertion.
- Visual hit flashes for instanced enemies will use `THREE.InstancedMesh.setColorAt` for full-body tinting to preserve single-draw-call performance.
- When the game state is `GameState.VIEWER`, the instancer is bypassed to allow the Tactical Database to apply holographic clipping planes to individual cards.

## Consequences

- Draw calls for a swarm of 40–100 popcorn enemies are collapsed from 80–200 down to exactly **2 draw calls** (one for the body mesh, one for the glow mesh).
- Hit flashes on popcorn enemies will affect the entire mesh (full-body tint) instead of just the hull body.
- Popcorn enemies must remain structurally rigid (no procedural segment wiggling or independent moving parts).
