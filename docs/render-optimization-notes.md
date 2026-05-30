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
- category ownership via `cats`
- top detail ownership via `details`
- bullet ownership and bullet render units

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

This table tracks the overall rendering gains starting from the **unoptimized baseline (Before Everything)**, through the **Scenery-Optimized baseline**, and finally down to our **Projectile Instanced System**:

| Scenario / Profiling Step | 1. Before Everything (avg/max) | 2. After Scenery-Instanced (avg/max) | 3. After Projectiles-Instanced (avg/max) | **Total Peak Draw Call Reduction** |
|---|:---:|:---:|:---:|:---:|
| **Level 1: Tier 5 Tap-Fire** | 249 / 319 | 137 / 196 | **78 / 99** | **-69% (Average) / -71% (Peak)** |
| **Level 4: Tier 5 Tap-Fire** | 557 / 644 | 119 / 193 | **74 / 99** | **-87% (Average) / -85% (Peak)** |
| **Level 4: No-Fire** | 602 / 729 | 166 / 275 | **107 / 192** | **-82% (Average) / -74% (Peak)** |

- **Draw Calls Kept Under 100**: Even during highly intensive Tier 5 weapon firing sequences on Level 4, the average draw call count collapsed to just **74** (down from **119** after scenery optimization, and down from **557** originally), and maximum draw calls remained strictly capped below **100** (exactly **99** max).
- **Zero GC Overhead**: The pre-compiled flat mesh list pattern completely avoided dynamic closure and string concatenation allocations, resulting in a flawless **61 FPS / 60 FPS** flatline.
- **Leak-Free Memory Profile**: Dynamic resources and WebGL instanced buffers were fully garbage collected via the material `'dispose'` event listener.

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
