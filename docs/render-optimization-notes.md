# Render Optimization Notes

This document records the current render-profiling workflow and the optimization pattern that has already paid off in the codebase.

It is intentionally not an ADR. These notes describe a useful implementation approach, not a hard architectural commitment.

## Profiling Workflow

Use the runtime flags already wired into the game:

- `renderStats=1`
- `invincible=1`

Open the game with:

- `http://localhost:5173/?renderStats=1&invincible=1`

The FPS/debug HUD in [src/Game.ts](/E:/Develop/GitHub/aeon-pulse/src/Game.ts) reports:

- draw calls
- total visible object render units
- category ownership
- bullet ownership and bullet render units

The scripted collector samples the runtime render APIs directly, including detail ownership and bullet source ownership.

The supporting plumbing for this lives in:

- [src/Scene.ts](/E:/Develop/GitHub/aeon-pulse/src/Scene.ts)
- [src/systems/RenderStats.ts](/E:/Develop/GitHub/aeon-pulse/src/systems/RenderStats.ts)
- [src/systems/GameplayRun.ts](/E:/Develop/GitHub/aeon-pulse/src/systems/GameplayRun.ts)
- [src/entities/Bullet.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/Bullet.ts)

For scripted capture, use:

- [scripts/collect-render-stats.mjs](/E:/Develop/GitHub/aeon-pulse/scripts/collect-render-stats.mjs)

## Current Heuristic

When a chapter is draw-call bound, start with the largest `background.*` or `terrain.*` detail owners before touching shared gameplay systems.

Prefer `THREE.InstancedMesh` when all of the following are true:

- many repeated decorative meshes share the same geometry and material
- the objects differ mostly by transform, visibility, or instance color
- gameplay logic can stay data-driven and unchanged

Avoid mixing render-only optimization with gameplay rewrites. The winning pattern so far has been:

1. identify the dominant render owner from `cats` and `details`
2. convert repeated meshes to instanced storage
3. preserve collision, wave timing, and movement behavior
4. rerun the same measurement and compare ownership again

## What Worked

### Chapter 4

Chapter 4 was originally dominated by terrain and then by repeated background pieces.

The following modules were reduced with instancing:

- [src/level/Terrain4.ts](/E:/Develop/GitHub/aeon-pulse/src/level/Terrain4.ts)
- [src/level/Background4.ts](/E:/Develop/GitHub/aeon-pulse/src/level/Background4.ts)

Converted groups included:

- `terrain.column`
- `terrain.backing`
- `background.ember`
- `background.geyserParticle`
- `background.rockPlate`
- `background.spire`

Measured Chapter 4 result after those passes:

- `L4 no-fire`: `166 / 275` avg/max draw calls
- `L4 tier5 tap-fire`: `119 / 193`
- `background` max ownership: `11`
- `background.spire`: `2`
- `background.rockPlate`: `2`

At that point, Chapter 4 stopped being scenery-bound and shifted toward shared `enemy` and `bullet` cost.

### Chapter 1

Chapter 1 background ownership was a flat `161` render units across scenarios before optimization.

The repeated Megastructure scenery in [src/level/Background.ts](/E:/Develop/GitHub/aeon-pulse/src/level/Background.ts) was converted to instanced meshes:

- hangar arches
- cooling towers
- pipelines
- spires
- station rings
- crystalline dust

Measured Chapter 1 result after that pass:

- `1-5 no-fire`: `308 / 394` avg/max draw calls down to `201 / 285`
- `1-5 tier5 tap-fire`: `249 / 319` down to `137 / 196`
- `1-1 no-fire`: `262 / 315` down to `151 / 199`
- `background` max ownership: `161` down to `21`

Current Chapter 1 background detail ownership is roughly:

- `background.arch`: `5`
- `background.tower`: `4`
- `background.dust`: `4`
- `background.pipe`: `3`
- `background.spire`: `2`
- `background.ring`: `2`

That means Chapter 1 is no longer background-bound. Further optimization there should likely target shared enemies or bullet-heavy systems, not more Megastructure scenery.

### Shared Systems: Projectile Instancing

Under Tier 5 weapons and high bullet density, active projectiles (bullets, waves, plasma, lasers, homing missiles) were causing substantial draw call overhead and frametime stuttering due to:
1. Every individual projectile costing 1–2 independent WebGL draw calls.
2. Dynamic object and closure allocations on every frame.

**Optimizations Implemented**:
1. **Transparent Interception Renderer**: Intercepted `scene.add` and `scene.remove` inside `src/Scene.ts` for `RenderCategory.BULLET` objects, redirecting them from the active Three.js scene graph to a centralized `ProjectileInstancer`.
2. **Zero-Allocation compiled batches**: Pre-compiled children meshes and geometry/material UUID keys upon bullet registration, caching the flat mesh list in `userData['compiledMeshes']` to run in a flat, closure-free and concatenation-free `for`-loop every frame.
3. **Self-cleaning material dispose event**: Listened for Three.js `'dispose'` events on projectile materials to automatically garbage collect corresponding `THREE.InstancedMesh` buffers and free GPU memory.

**Overall Journey Results**:

This table tracks the overall rendering gains starting from the **unoptimized baseline (Before Everything)**, through the **Scenery-Optimized baseline**, the **Projectile Instancing pass**, and finally down to our **Phase 3 (Rock Drake legs merge + Terrain4 falling debris instancing)**:

| Scenario / Profiling Step | 1. Before Everything (avg/max) | 2. After Scenery-Instanced (avg/max) | 3. After Projectiles-Instanced (avg/max) | **4. OUR PASS: Rock Drake & Debris (avg/max)** | **Total Peak Draw Call Reduction** |
|---|:---:|:---:|:---:|:---:|:---:|
| **Level 1: Tier 5 Tap-Fire** | 249 / 319 | 137 / 196 | 78 / 99 | **77 / 96** | **-69% (Average) / -70% (Peak)** |
| **Level 4: Tier 5 Tap-Fire** | 557 / 644 | 119 / 193 | 74 / 99 | **74 / 105** | **-87% (Average) / -84% (Peak)** |
| **Level 4: No-Fire** | 602 / 729 | 166 / 275 | 107 / 192 | **108 / 192** | **-82% (Average) / -74% (Peak)** |

### Performance Outcomes by Pass

#### 1. Projectile Instancing (Phase 1)
- **Draw Call Collapse**: Collapse player/enemy bullets of the same style into exactly **2 draw calls** (inner + outer core) instead of scaling linearly, keeping dense Level 4 Tier 5 tap-firing strictly below **100** average draw calls.
- **Zero GC / Leak-Free**: Pre-compiled compiled meshes list in `userData` completely avoids runtime closure/string concatenations (rock-solid **61 FPS**), while material `'dispose'` event triggers successfully garbage collect WebGL instanced mesh buffers on recycling.

#### 2. Rock Drake Geometry Merge (Phase 2)
- **Draw Call Shrinikage**: Merged redundant leg meshes directly into the main segmented basalt rock and claw geometries. This successfully collapsed draw call overhead from **21 to 5 draw calls per active Rock Drake** (a **76% reduction per instance**).
- **Z-Fighting Elimination**: Removed the duplicate leg groups that were drawing splayed legs on top of already-merged geometries, resulting in a cleaner leg texture with **zero visual or gameplay changes**.

#### 3. Terrain4 Falling Debris Instancing (Phase 3)
- **Debris Draw Call Collapse**: Converted the pool of 30 individual rock meshes inside [Terrain4.ts](file:///e:/Develop/GitHub/aeon-pulse/src/level/Terrain4.ts) into a single `THREE.InstancedMesh`.
- **Details Peak Elimination**: Active falling volcanic debris now renders in **exactly 1 draw call** instead of up to 30. When tectonic events are inactive, the mesh count is set to `0`, contributing **0 draw calls**, completely erasing `terrain.debris` from the `MaxDetails` overhead list.

#### 4. Diver Standard Enemy Model Preparation
- **Runtime Bucket Collapse**: The Diver GLB now prepares into 3 runtime render buckets (`body`, `glass`, `glow`) instead of preserving 9 authored GLB materials as 9 runtime render units per active Diver.
- **Hit Flash Isolation**: Diver hit feedback uses a per-instance overlay shell instead of mutating model materials, allowing prepared geometry and materials to stay shared across active Diver instances.
- **Measured Result**: `enemy.diver` dropped from **27 to 9** max detail units in `L1-1 no-fire` with 3 active Divers, and from **54 to 18** in `L4-4 no-fire` with 6 active Divers.

## Scenario Guidance

The detailed stats reduce the need to always measure both no-fire and tap-fire.

Recommended default:

- for chapter-local scenery work, use one dense representative no-fire scenario first
- add a tap-fire spot check only if the change could affect bullets, player effects, update order, or other shared gameplay rendering
- for shared systems such as enemies, bullets, or projectile pooling, keep gameplay-fire scenarios in the loop

## Scope Boundary

These notes do not establish a rule that all background code must use instancing.

They do establish a practical preference:

- if a chapter hotspot is mostly repeated visual decoration, instancing is the first optimization tool to try
- if the hotspot has shifted to `enemy`, `bullet`, or `player`, treat that as a separate shared-systems pass rather than continuing chapter-local background cleanup
