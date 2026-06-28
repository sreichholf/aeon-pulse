# ADR 0020 — Constant Point Light Count Optimization

**Status:** Accepted  
**Date:** 2026-06-12

To prevent mid-game WebGL shader compilation stutters (long frames) caused by dynamic changes to the count of active `PointLight` objects in the Three.js scene graph, the gameplay scene graph must maintain a constant point light count of exactly **1** (the permanent **Aeon Pulse Craft** engine light). All dynamic lighting effects on standard enemies and bosses must be achieved using material emissive pulsing patterns instead of discrete light sources.

## Consequences

- No new `THREE.PointLight` objects should be created, added, or removed from standard enemy or boss scene graph nodes during gameplay.
- Startup warm-up sequences can rely on a fixed, constant light count for pre-compilation.
- Standard Volcanic / Cinder Core enemies (such as [Stalactite.ts](file:///e:/Develop/GitHub/aeon-pulse/src/entities/Stalactite.ts) and [EnemyCharger.ts](file:///e:/Develop/GitHub/aeon-pulse/src/entities/EnemyCharger.ts)) and finale bosses (such as [Boss4.ts](file:///e:/Develop/GitHub/aeon-pulse/src/entities/Boss4.ts)) must not add local point lights to their meshes.
