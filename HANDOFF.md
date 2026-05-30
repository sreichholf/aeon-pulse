# AEON PULSE — Enemy & Boss Render Optimization Handoff

This document details the architecture, design choices, verified benchmarks, and precise step-by-step blueprints for continuing the geometry-merging draw-call collapse optimizations across the remaining standard enemy types and all four chapter bosses. 

---

## 🏁 1. Current Progress & Optimizations Completed
We have successfully implemented and committed the following render optimization passes:
- **Phase 1 (Central Projectile Instancer)**: Transparent rendering interception in [Scene.ts](file:///e:/Develop/GitHub/aeon-pulse/src/Scene.ts) via [ProjectileInstancer.ts](file:///e:/Develop/GitHub/aeon-pulse/src/systems/ProjectileInstancer.ts), routing all `RenderCategory.BULLET` objects into centralized `THREE.InstancedMesh` batches.
- **Phase 2 (Rock Drake Merge)**: Removed splayed leg duplicates and merged geometry inside [RockDrake.ts](file:///e:/Develop/GitHub/aeon-pulse/src/entities/RockDrake.ts), collapsing draw calls from **21 to 5 per instance** with zero z-fighting.
- **Phase 3 (Terrain4 Debris Instancing)**: Converted 30 falling rock meshes in [Terrain4.ts](file:///e:/Develop/GitHub/aeon-pulse/src/level/Terrain4.ts) to a single `THREE.InstancedMesh`.
- **Phase 4 (EnemyStraight Collapse & Subtle Recoil)**: Collapsed [EnemyStraight.ts](file:///e:/Develop/GitHub/aeon-pulse/src/entities/EnemyStraight.ts) from 8 draw calls to **exactly 3** (Hull Mesh, Visor Canopy Mesh, and merged Exhaust Flames). Fixed a visual double-rotation bug on the cockpit canopy, and implemented a 75%-scaled underdamped spring visual recoil (`2.0` displacement, `-21.25` velocity) matched with a physical lunge speed recovery (`SPEED * 0.79` pause compensated by `SPEED * 1.21` lunge).

### Final Benchmark Results (Working Tree Clean & Committed)
*Headless browser profiling CDP stats capture (1eeda27):*
- **Level 1: Tier 5 Tap-Fire**: Collapsed peak draw calls from **319 to 93 (-71% Peak Reduction)**.
- **Level 4: Tier 5 Tap-Fire**: Collapsed peak draw calls from **644 to 95 (-85% Peak Reduction)**.
- **Level 4: No-Fire**: Collapsed peak draw calls from **729 to 192 (-74% Peak Reduction)**.

---

## 📐 2. Architecture & Design Rules for Geometry Merging
When refactoring models in this repository, always preserve **100% visual replication** and **fluid dynamic animations** by adhering to these strict boundaries:

1. **Static Parts (Share Opaque Materials)**: Merge structural elements (matte steel, gunmetal plating, copper gear rims) into a **single static vertex-colored Mesh** using `mergeGeometries()`. Use `ensureNonIndexed()` to index-align geometries and `addVertexColor(geo, hex)` to encode native specular/emissive values directly into vertices.
2. **Transparent Elements**: Keep transparent parts (glass lens domes, glowing windshield shields) separate to ensure correct rendering order and transparency blending.
3. **Dynamic Emissive/Flash Animations**: Any part that pulses emissively upon taking damage, charging up, or firing (such as tactical visors, laser eyes, or railgun muzzle tips) **must remain as a separate mesh** so it can change materials/emissive values individually without lighting up the entire ship frame.
4. **Procedurally Animated / Scaling Elements**: Keep wings that flap, nozzles that tilt (thrust vectoring), claws that rotate, and flames that scale on X/Y/Z as **separate meshes or sub-groups** to prevent scaling or rotational distortion.

---

## 🛠️ 3. Optimization Blueprints for Standard Enemy Types

### 1. `EnemySine.ts` (Sine Interceptors)
*A high-density Level 1 bio-mechanical interceptor. Current draw calls: 14+ per active instance.*
- **Static Core Group (3 -> 1 draw calls)**: Merge `coreMesh` (dark metal), carapace `panelsMesh` (green), and `rearPanel` (bright green) into a single vertex-colored Mesh at `(0, 0, 0)`.
- **Procedural Claws (8 -> 4 draw calls)**: Sine interceptors have four banking/flexing claws (`_clawTF`, `_clawTB`, `_clawBF`, `_clawBB`) rotating on Z. Do not merge claws with the core. Instead, **merge the components of each claw internally** (green claw shield + dark metal spikes/hinges) into a **single vertex-colored Mesh per claw**.
- **Apterous Optic Eye (3 -> 3 draw calls)**: Keep the glass outer lens (transparent cockpitMat), glowing iris (dynamic emissive pulsing warning flare), and pupil (dynamic scaling pupilScale) as separate meshes.
- **Thrust Vectoring**: Keep the top/bottom vectoring nozzles and exhaust flames as separate groups/meshes to allow procedurally animated banking.

### 2. `EnemyDiver.ts` (Diver Heavy Bombers)
*A heavy Level 1/4 bomber spawned in V-formations. Current draw calls: 6 per active instance.*
- **Static Fuselage Assembly (4 -> 1 draw calls)**: The fatter fuselage belly, outer wing tips, swept dorsal/ventral fins, and cockpit dome rotate as a single unit in Z. Since the cockpit dome has no warning pulses or firing flares, **merge the fuselage, wing tips, fins, cockpit, and engine nozzles into a single vertex-colored Mesh**.
- **Dual Exhaust Flames (2 -> 1 draw calls)**: Translate the two exhaust cone geometries to `(20, 5, 0)` and `(20, -5, 0)`, and merge them into a **single merged engine flame Mesh** positioned at `(0, 0, 0)`. Scaling this merged mesh dynamically in `_tick` will scale both flames uniformly with zero translation offset.
- **Outcome**: Collapses Diver bomber overhead down to **exactly 2 draw calls** (Hull Mesh + merged Flames).

### 3. `EnemyTurret.ts` (Heavy Railgun Turrets)
*A stationary railgun with sequential charging coils. Current draw calls: ~11 per active instance.*
- **Axle Mounting (2 -> 2 draw calls)**: The axle cylinder (base steel) and axle rings (pulsing ringMat) are static, but since the axle rings have a dynamic emissive pulse, keep them as 2 separate meshes.
- **Cannon Recoil Assembly (2 -> 1 draw calls)**: Inside `_cannonGroup` (which slides along X during firing recoil), the central barrel (base steel) and outer `sleeveMesh` (slate steel) are static. **Merge them into a single vertex-colored Mesh**.
- **Granular Chasing Elements**: The warning heat vents, muzzle tip, and 4 copper coils must remain separate because the muzzle flashes dynamically and the 4 coils chase sequentially (lighting up one-by-one in emissive scale).

### 4. `EnemyCharger.ts` (Glaive-Class Interceptors)
*Level 4 plasma interceptors with overcharged vertical scissor wings. Current draw calls: 14+ per active instance.*
- **Static Fuselage Core (3 -> 1 draw calls)**: The dark matte body and reactor vent ring are static relative to `_shipGroup`. **Merge them into a single vertex-colored fuselage Mesh**. Keep the energy spine (`energyMesh` with `neonMat`) separate, as it pulses emissively like a heartbeat during locking.
- **Scissor Wings (6 -> 2 draw calls)**: The top and bottom wings rotate independently on Z (opening up to 36 degrees during lock-on/charging). Merge the elements of each wing group (metal blade + wingtip thruster housing) into a **single vertex-colored Mesh per wing** (1 for top wing, 1 for bottom wing). Keep neon energy channels and thruster plumes separate to allow lock-on pulse and charging flares.

---

## 👹 4. Optimization Blueprints for All 4 Chapter Bosses

### 1. `Boss.ts` (Titan I - Chapter 1 Boss)
*A high-specular mechanical fortress. Current draw calls: 24 per active instance.*
- **Static Opaque Hull (12 -> 1 draw calls)**: Merge the main fuselage lathe, side ridges, wings, canards, front prongs, engine nacelles, and central engine port into a **single, static vertex-colored Mesh** at `(0, 0, 0)`.
- **Static Energy Lights (4 -> 1 draw calls)**: Merge the static wing tips and front prong rings (which share the pulsing `_energyMat`) into a **single static energy-light Mesh**. When the emissive warn-flash triggers, all parts will flash together cleanly!
- **Transparent Conduits (4 -> 1 draw calls)**: Merge the conduit stripes and exhaust nacelle rings (which both share `conduitMat` with `opacity: 0.9`) into a **single transparent Mesh**.
- **Exhaust Flames (3 -> 1 draw calls)**: Merge the two nacelle flames and the central exhaust flame into a **single exhaust-flames Mesh** (using `coreGlowMat` at `opacity: 0.5`).
- **Dynamic Core Group (2 -> 2 draw calls)**: Keep the rotating core group `_coreGroup` separate. It will continue to hold the Octahedron and the outer Glow Sphere, rotating dynamically as a sub-group.
- **Outcome**: Collapses the L1 Boss from **24 down to exactly 6 draw calls** (a **75% reduction**).

### 2. `Boss2.ts` (Industrial Titan - Chapter 2 Boss)
*A steel-plated industrial ship with a massive spinning drill. Current draw calls: 27 per active instance.*
- **Static Plated Body (18 -> 1 draw calls)**: Fuselage cylinder, backing plates, panels, horizontal pods, hazard orange bands, weapon ports, arms, lenses, and engine vents are static relative to the ship frame. **Merge them into a single, vertex-colored Mesh**. The color flashes dynamically inside `_setMeshColor` via child traversal, which remains 100% compatible.
- **Spinning Nose Drill (5 -> 1 draw calls)**: The nose drill cone and its 4 spiral blades spin as a single unit in `_tickBoss`. **Merge them into a single vertex-colored Drill Mesh** inside the spinning group.
- **Exhaust Flames (3 -> 1 draw calls)**: Merge the 3 exhaust flame spheres into a **single flame Mesh**.
- **Outcome**: Collapses the L2 Boss from **27 down to exactly 3 draw calls** (an **88% reduction**).

### 3. `Boss3.ts` (Hive Heart - Chapter 3 Boss)
*An organic biological eye with wiggling tentacles and teeth. Current draw calls: ~92 per active instance.*
- **Armored Claw Teeth (32 -> 8 draw calls)**: 8 armored claws pivot individually to open/close. Each claw group contains a claw shaft, base joint, mid joint, and yellow stinger. These 4 elements are static relative to the claw pivot. **Merge the 4 parts of each claw into a single vertex-colored tooth Mesh** (8 meshes total). Saves **24 draw calls**.
- **Organic Animate Parts (Keep Separate)**: Keep the 4 wiggling tentacles (7 joints each, total 28 meshes), 20 base lobes, and 12 pustules separate. They wiggle and pulsate individually with distinct phase offsets to represent a realistic beating bio-organism.
- **Pulsing Central Eye**: Keep the sclera and pupil separate as they dilate and scale during charging warnings.

### 4. `Boss4.ts` (Volcanic Titan - Chapter 4 Boss)
*A volcanic slithering beast with destructible armor. Current draw calls: ~55 per active instance.*
- **Crawling Legs (16 -> 4 draw calls)**: 4 crawling legs. Each leg has a thigh, shin, and 2 claws. **Merge the 4 parts of each leg into a single vertex-colored leg Mesh** (1 per leg). Saves **12 draw calls**.
- **Destructible Armor Plates (10 -> 2 draw calls)**: 2 back carapace plates can be shot and destroyed independently. Each plate has a box plate, lava seam, and 3 volcanic spires. **Merge the 5 parts of each armor plate into a single vertex-colored plate Mesh** (1 for Left, 1 for Right). Saves **8 draw calls**.
- **Slithering Segments (10 body/tail meshes -> 6 draw calls)**: 5 body segments and 1 tail segment wiggle on Y with distinct phases. For each body segment, merge its core sphere and scale cone into a **single vertex-colored segment Mesh**. For the tail, merge the tail cone and 2 spikes. Saves **6 draw calls**.
- **Head Segments (13 meshes -> 3 draw calls)**: The head is made of 3 sub-groups (`_headSeg1`, `_headSeg2`, `_headSeg3`) that wiggle and shake. **Merge each head segment internally** into a single vertex-colored Mesh. Saves **10 draw calls**.
- **Outcome**: Collapses the final boss's structural elements from **55 meshes down to just 15 draw calls** (saving **40 draw calls**).

---

## 📊 5. Estimated Draw Call Savings (Remaining Work)

### Standard Enemies

| Target | Current Draw Calls | After Merge | Savings |
|---|---|---|---|
| `EnemySine.ts` | 14+ | ~7 | ~50% |
| `EnemyDiver.ts` | 6 | **2** | **-67%** |
| `EnemyTurret.ts` | ~11 | ~8 | ~27% |
| `EnemyCharger.ts` | 14+ | ~6 | ~57% |

### Bosses

| Target | Current Draw Calls | After Merge | Savings |
|---|---|---|---|
| `Boss.ts` (Chapter 1) | 24 | **6** | **-75%** |
| `Boss2.ts` (Chapter 2) | 27 | **3** | **-88%** |
| `Boss3.ts` (Chapter 3) | ~92 | ~68 | -26% |
| `Boss4.ts` (Chapter 4) | ~55 | **15** | **-73%** |

---

## 🚀 6. Workflow for Next Agent / Developer
1. **Develop/Run Server**: Start the local development server at `http://localhost:5173` via `npm run dev`.
2. **Execute Refactoring**: Modify target files according to the blueprints above. Ensure to dispose of all temporary/cloned geometries to prevent GPU memory leaks!
3. **Verify Build**: Always run `npm run build` to verify there are no TypeScript or bundler errors.
4. **Gather Performance Stats**: Trigger the pre-authorized Windows headless Chrome profiler orchestrator:
   ```powershell
   & "C:\Users\Stephan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "C:\Users\Stephan\.gemini\antigravity-ide\scratch\run-profiler.js"
   ```
   Verify that average/peak draw calls remain low and average FPS remains locked at `60+`.
5. **Playtest**: Open `http://localhost:5173` to verify visually that claws bank, nozzles vector, wings scissors, and engines flare correctly with 100% visual fidelity.
