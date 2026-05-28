# AGENTS.md
 
This file provides guidance to AGENTS when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at http://localhost:5173 (HMR enabled)
npm run build    # production build to dist/
npm run preview  # serve the production build locally
```

There is no test suite. Verification is manual browser testing at http://localhost:5173.

## Git

`git commit` is the only permitted write git command in this project. Do not run `git push`, `git merge`, `git rebase`, or any other git write command.

## Architecture Decision Records

Key design decisions are documented in `docs/adr/`. Read the relevant ADR before modifying code in its domain.

- **[ADR 0001 — Game Balance Principles](docs/adr/0001-game-balance-principles.md)** — Hit penalty = -1 tier (not -2), target weapon tier per boss, drop rates fixed per enemy type, boss defeat grants +1 life (capped), boss HP scaled for consistent time-to-kill, Boss 1 phase restructure, shield mechanic scoped out.
- **[ADR 0002 — Difficulty Modes and Shield Mechanic](docs/adr/0002-difficulty-modes-and-shield.md)** — Three modes (Rookie/Pilot/Ace) with per-mode shield rules. Rookie: 2-pip shield, no tier drop, 4s regen. Pilot: 1-pip shield, tier drop on unshielded hits, 7s regen. Ace: no shield. Separate leaderboards per mode. Shield aura on ship mesh + HUD pips.
- **[ADR 0003 — String Enums for Discriminators](docs/adr/0003-string-enums-for-discriminators.md)** — `GameState`, `EnemyType`, and `BulletType` are string enums in `types.ts`, not string literal unions. `SpawnEnemyFn` uses `EnemyType` (was `string`). The `const State` object in `Game.ts` is deleted; call sites use `GameState.PLAYING`.
- **[ADR 0004 — Audio Dependency Injection](docs/adr/0004-audio-dependency-injection.md)** — Entities accept `IAudio | null` in their constructor and use `audio?.play('soundName')`. Never import `AudioManager` directly in entities. The `IAudio` interface lives in `types.ts`.

## Architecture

**Entry:** `index.html` mounts two sibling elements — `#game-canvas` (Three.js renderer target) and `#ui-overlay` (HTML screens rendered on top). `src/main.js` instantiates `Game` and calls `game.start()`.

**Rendering:** `src/Scene.js` owns the Three.js `WebGLRenderer`, orthographic camera (960×540 logical units, z=100), and an `EffectComposer` pipeline: `RenderPass → UnrealBloomPass(strength=0.5) → ShaderPass` (chromatic aberration). The canvas scales to fill the browser window while preserving aspect ratio. All gameplay objects call `scene.add(mesh)` / `scene.remove(mesh)` to enter and leave the Three.js scene. `GAME_WIDTH` / `GAME_HEIGHT` constants are exported from `Scene.js` and imported everywhere that needs coordinate math.

**State machine (`src/Game.js`):** Central coordinator. States: `TITLE → PLAYING → LEVEL_COMPLETE → PLAYING` (advancing level, cycling 1→2→3→4) or `LEVEL_COMPLETE → GAME_COMPLETE` (after Level 4) or `PLAYING → GAME_OVER → TITLE` (when lives run out), or entering the Tactical Database via the `VIEWER` state. The game has **4 levels**; `currentLevel` cycles 1→2→3→4, and completing Level 4 triggers `GAME_COMPLETE`. `Game` holds the master arrays for `bullets`, `enemies`, `powerups`, and `effects`. Every frame calls each entity's `update(dt)`, collects returned bullet arrays, then calls `checkCollisions(this)`.

**Title screen selectors:** On the title screen, `UP`/`DOWN` selects the starting stage (1–4) and `LEFT`/`RIGHT` selects the starting weapon tier (1–5). Both selections are stored on `Game` (`currentLevel`, `_startWeaponTier`) and committed to `_savedWeaponTier` the moment the player presses Fire to start.

**Sprite system (`src/systems/SpriteGenerator.js`):** All sprites are procedurally generated at startup by drawing to Canvas 2D contexts and converting to `THREE.CanvasTexture`. `SpriteGenerator.generate()` returns a plain object keyed by sprite name. Adding a new sprite requires a `draw*` function and a matching entry in `generate()`. Color palettes for each entity are defined as `CP` (player), `CS` (straight enemy), `CSN` (sine enemy), `CD` (diver enemy), `CW` (swarm enemy), `CB` (boss 1), `CB2` (boss 2) constants at the top of the file.

**Entity pattern:** Each entity class owns its Three.js mesh, exposes `x`, `y`, `hw`, `hh` for AABB collision, and implements:
- `update(dt)` — returns a `Bullet[]` of newly spawned projectiles (empty array if none)
- `destroy()` — removes mesh from scene, disposes geometry **and** material

`Game` manages entity lifecycle: entities are spliced from their arrays when `!isAlive || isOffscreen`, then `destroy()` is called. `EnemySpore` is a special case — it uses a `_pendingBullets` buffer that is flushed on the *next* `update()` call after `hit()` triggers the burst, to avoid the bullets being lost when `_newBullets` is reset.

**Collision (`src/systems/Collisions.js`):** Pure function `checkCollisions(game)` receives the full `Game` instance and performs all AABB overlap checks: player bullets vs. enemies/boss, enemy bullets vs. player, powerups vs. player, terrain walls vs. player. Boss3 immunity when closed is enforced inside `Boss3.hit()` (returns `false` without applying damage), so no special collision logic is needed.

**Levels (`src/level/`):**
- `LevelManager.js` — tracks `scrollX` (auto-advances each frame), wave queue per level, boss spawn trigger. `buildLevel1Waves()` / `buildLevel2Waves()` / `buildLevel3Waves()` / `buildLevel4Waves()` define all enemy formations. Boss is spawned when `scrollX > config.bossAt`. Per-level config: scroll speeds 100/120/130/140 and boss triggers at 5000/5200/5800/6200. `LEVEL2_TERRAIN`, `LEVEL3_TERRAIN`, and `LEVEL4_TERRAIN` control-point arrays are exported for the respective `Terrain` classes. Level 4 waves also include `lavaEvent` entries that call `terrain.triggerLavaPulse()`.
- `Terrain.js` (Level 2) — industrial corridor walls defined by `LEVEL2_TERRAIN` control points; `getWallsAt(scrollX)` interpolates `{ top, bottom }` between points. `Game` passes this to `player.terrainBounds` every frame for movement clamping and collision.
- `Terrain3.js` (Level 3) — organic fleshy corridor shader, same interface as `Terrain.js`, uses `LEVEL3_TERRAIN` points.
- `Terrain4.js` (Level 4) — asymmetric volcanic cavern, same `getWallsAt(scrollX)` interface; uses `LEVEL4_TERRAIN` points. Implements `triggerLavaPulse()` for lava event hazards.
- `Background.js` — alien megastructure GLSL shader (Level 1).
- `Background2.js` — 3D industrial tunnel GLSL shader (Level 2).
- `Background3.js` — pulsing organic vein/flesh GLSL shader (Level 3), uses simplex noise.
- `Background4.js` — volcanic cavern GLSL shader (Level 4).

**Enemies (`src/entities/`):**
- `Enemy.js` — base class only. Owns the Three.js mesh, handles hit/flash logic, and exposes `x`, `y`, `hw`, `hh`, `isAlive`, `isOffscreen`. Each enemy type is its own subclass file; drop chance and score are defined per-class. `Game.SIMPLE_ENEMIES` maps type string → class for `spawnEnemy()` routing.
- `EnemyStraight.js`, `EnemySine.js`, `EnemyDiver.js`, `EnemySwarm.js`, `EnemyTurret.js`, `EnemyCharger.js` ── the six core enemy types (Levels 1–3).
- `EnemySpore.js` — slow drifting biological orb (Level 3). On death, bursts into 4 homing projectiles stored in `_pendingBullets`.
- `Obstacle.js` — destructible fleshy barrier (Level 3). High HP (25), blocks movement, does not shoot. Scrolls left like a regular enemy.
- `RockDrake.js` — volcanic lizard (Level 4). 4 HP, 400 pts. Slides in to a random stop position, clings briefly, bursts 5 lava bullets in a spread, then charges left off-screen. Spawns from top or bottom of screen; mesh is flipped vertically when spawning from the bottom.
- `Stalactite.js` — falling ceiling spike (Level 4). 1 HP, 150 pts. Falls downward while scrolling left; kills player on contact.

**Bosses:**
- `Boss.js` (Level 1) — 3-phase mobile boss: oscillating + spread/homing/circular patterns. ~Level 1/10 difficulty baseline (50 HP).
- `Boss2.js` (Level 2) — stationary industrial boss: dual laser ports + aimed spread shots + homing missiles across 3 phases. ~Level 3/10 difficulty (55 HP). Phase config lives in the `PHASES` array at the top of the file.
- `Boss3.js` (Level 3) — "Hive Heart": stationary biological boss. Ribcage toggles open/closed; only vulnerable when open. Spawns minions (spores/swarms) when closed. Phase 3 desperation fires large acid wave bullets. ~Level 6/10 difficulty (80 HP). Accepts a `spawnEnemy(type, x, y)` callback injected by `Game`.
- `Boss4.js` (Level 4) — "Volcanic Titan": stationary multi-hitbox boss. Two destructible side plates (20 HP each) protect a central core (90 HP). Phase 1 (both plates intact): lava spread + RockDrake summons. Phase 2 (one plate destroyed): geyser fan attack added. Phase 3 (both plates gone): core exposed, all attacks intensify. ~Level 8/10 difficulty. 20,000 points. Accepts a `spawnEnemy` callback like Boss3.

**Bullet types (`src/entities/Bullet.js`):** Defined in the `DEFS` map: `player`, `playerCharge`, `enemy`, `homing`, `boss`, `bossLaser`, `playerWave`, `playerPlasma`, `wave`, `lava`. Homing bullets auto-deactivate once they fly past the target (evasion). The `wave` type is used by Boss3's acid ring attack. The `lava` type (32×32, damage 2, non-piercing) is used by RockDrake burst attacks and Boss4.

**Audio (`src/systems/AudioManager.js`):** Web Audio API only — no audio files. Each sound is a `_snd_*` method that synthesizes oscillators and noise programmatically. `audio.play('soundName')` is the call site.

**UI & Styling (`src/ui/`):**
- `UI.js` — manages HTML screen transitions (Title, HUD, Game Over, Level Complete, Game Complete, Tactical Database Viewer) injected into `#ui-overlay`.
- `ui.css` — imports directly at the top of `UI.js` (`import './ui.css'`), integrated into the Vite build.
- **Glassmorphic Layout System**: All non-gameplay screens float beautifully centered over the 3D gameplay canvas with a precise **5% padding** gap on all sides (`top: 5%; left: 5%; width: 90%; height: 90%;`). Active gameplay and the HUD remain fully edge-to-edge at 100% viewport width/height.
- **Interactive Volume Control**: A sleek, glassmorphic audio control panel floats in the UI container. Click the icon button to toggle mute/unmute, or slide the smooth input range slider (0% to 100%) to dynamically scale volume values mapped to `AudioManager`.
- **Theme Color Palette**: Deep dark blues (`#3d6cb3`, `#1d3d6b`) for frames and labels, high-visibility neon red (`#ff3300`) for accents, and glowing gold/orange (`#ffaa00`) for selection states, active weapon tier pips, and highlights.
- **Scoreboards**: Initials entry and high-score boards are presented on **Game Over** and **Game Complete** screens. Top-10 records persist in `localStorage` via `src/systems/ScoreManager.js`.

## Input Mapping (`src/systems/InputManager.js`)

Logical keyboard mapping to in-game actions:
- `W` / `S` / `A` / `D` or **Arrow Keys** — Ship movement, selectors on Title, Weapon selector, and Database page navigation.
- **Space** (`' '`) — Fire bullet, charge energy, select option, or start level.
- **Enter** — Confirm/Next.
- **Escape** / `P` — Pause/Unpause active game; exits Tactical Database back to Title screen.
- `V` — Enters/Exits the Tactical Database Viewer from the Title screen.

## Tactical Database Viewer

The tactical database displays interactive, detailed cards showing statistics (Name, HP, Score) alongside perfectly scaled, animated, procedurally generated 3D meshes of all hazards in the game.

### Page Layouts
- **Page 1: Stage Enemies** (2x5 Grid) — Displays `straight`, `sine`, `diver`, `swarm`, `turret`, `charger`, `spore`, `obstacle`, `rockDrake`, and `stalactite`.
- **Page 2: Level Bosses** (2x2 Grid) — Displays `Titan I (L1)` (Boss 1), `Industrial (L2)` (Boss 2), `Hive Heart (L3)` (Boss 3), and `Volcanic Titan (L4)` (Boss 4).

### Three.js Overlap/Z-Index Resolution
Because `#ui-overlay` is layered entirely on top of `#game-canvas`, an HTML-level semi-translucent CSS background would overlap and tint the 3D entity models. To solve this:
1. The HTML screen overlay background is set to **fully transparent** (`background: transparent`) in `ui.css`.
2. A single large, dark translucent backdrop plane (`THREE.PlaneGeometry(864, 486)`) is programmatically added at `z = -10` behind the cards inside the Three.js scene.
3. Behind each card slot, an individual textured Three.js backdrop card plane is spawned at `z = -5` (`color: 0x1d3d6b` with `0.16` opacity for standard enemies; `color: 0xff3300` with `0.05` opacity for bosses) to highlight the entities.
4. When entering the viewer or switching pages, all active viewer meshes, backdrops, and card planes are pushed to a `_viewerEntities` master array. On page change or viewer exit, `_clearViewer()` iterates over this array, removes them from the scene, and disposes of all geometries and materials to prevent memory leaks.
5. Pagination helpers and footer elements are absolutely positioned (`bottom: 14px`) to center perfectly inside the vertical gap between the lower card row and the lower screen boundary.

### Database Requirement
> [!IMPORTANT]
> Whenever a new type of enemy or boss is created, it **MUST** be added to the tactical database viewer in `src/Game.js`'s `_renderViewerPage()` method under the corresponding page (Page 1 for standard stage enemies, Page 2 for level bosses), scaled appropriately, and registered so that its 3D model, stats, and name render correctly in the visual card layout.

## Agent Skills

Custom agent workflows and design patterns are installed in `.agents/skills/` in the user's homedir (`/home/reichi/.agents/skills/`). Agents should read the instructions in these folders when triggered:

- **`grill-with-docs`** — Focuses on stress-testing design plans against canonical terminology in `CONTEXT.md` and writing new ADRs as decisions crystallize.
- **`improve-codebase-architecture`** — Focuses on refactoring shallow pass-through modules into deep interfaces, generating before/after graphs in temp HTML reports.
- **`diagnose`** — Implements a disciplined debugging loop (reproduce $\to$ minimize $\to$ falsifiable hypotheses $\to$ instrument $\to$ fix $\to$ regression-test).
- **`grill-me`** / **`zoom-out`** / **`prototype`** / **`handoff`** — Governing workflows for sequential interviews, system map abstractions, throwaway UI/logic prototypes, and conversation compaction respectively.

