# AGENTS.md

This file provides guidance to agents working in this repository.

## Commands

```bash
npm run dev      # start dev server at http://localhost:5173 (HMR enabled)
npm test         # run Vitest module tests
npm run test:watch # run Vitest in watch mode
npm run build    # production build to dist/
npm run preview  # serve the production build locally
```

Automated module tests use Vitest. Verification is:

1. `npm test`
2. `npm run build`
3. Browser-based playtesting at `http://localhost:5173`

Vitest tests are co-located with the modules they protect as `src/**/*.test.ts`, run in the `node` environment, and are limited by `vitest.config.ts` to source tests so browser profile artifacts under `.tmp/` are not collected. Use plain object fakes for deterministic module seams instead of constructing full Three.js entities unless the integration itself is under test.

For render-performance work, see `docs/render-optimization-notes.md` and `scripts/collect-render-stats.mjs`.

### Manual Playtesting

Use manual browser playtesting to verify gameplay feel, visuals, progression, and any change that touches entities, rendering, input, audio, UI, waves, terrain, or campaign flow.

**Setup**:
1. Run `npm run build` first. Fix build errors before opening the browser.
2. Start the dev server with `npm run dev`.
3. Open `http://localhost:5173`.
4. If another process owns port `5173`, use the alternate Vite URL printed by the command instead.
5. Use a fresh page load after code changes if HMR state may hide startup or constructor problems.

**Starting a focused test run**:
- On the title screen, press `Tab` to cycle difficulty mode.
- When advanced title options are enabled, press `UP` / `DOWN` to choose a campaign level and `LEFT` / `RIGHT` to choose the starting weapon tier.
- Press `Enter` or `Space` to start.
- Use `M` to mute/unmute music when audio is not the test target.
- Use `V` from the title screen to open the tactical database when validating entity or boss presentation.

**Core controls during play**:
- Move with `W` / `A` / `S` / `D` or arrow keys.
- Fire or charge with `Space`.
- Pause/unpause with `Escape` or `P`.
- Continue through interstitial screens with `Enter` or `Space`.

**Gameplay smoke checklist**:
- Start at least one early level, one terrain-heavy level, and any level directly affected by the change.
- Confirm the player can move, fire, take hits, collect powerups, pause, resume, die, and continue/restart without console errors.
- For level or wave changes, play until the authored clear gate, exit flyout, boss spawn, or level-complete screen is reached.
- For boss changes, verify entrance, phase transitions, attacks, hit flash, death sequence, scoring, and post-boss progression.
- For difficulty changes, test at least Rookie and Ace if shields, damage, scoring, or high scores are involved.

**Visual/render smoke checklist**:
- Watch changed entities at gameplay scale and in the tactical database when cataloged there.
- Verify moving parts still animate independently: claws, wings, recoil groups, nozzles, flames, warning lights, pupils, trails, and boss sub-groups should not be frozen by geometry merging.
- Verify transparent pieces still blend correctly and are not hidden behind merged opaque geometry.
- Verify damage flashes, charge pulses, muzzle flashes, and emissive warning states affect only the intended parts.
- Watch for z-fighting, missing geometry, wrong pivots, inverted rotations, oversized hit visuals, blank meshes, or objects that remain after death.

**Render-stat playtesting**:
- Use the FPS/render counter when `ENABLE_RENDER_STATS` is enabled or via the runtime flag query-string override.
- Exercise dense scenes with no-fire and tier-5 tap-fire patterns.
- Compare draw-call peaks against recent profiler runs before declaring a render optimization complete.
- If the in-app browser cannot start, fall back to the authorized CDP profiler workflow below and report that manual visual inspection was not completed.

### Automated Browser Testing (Windows)

For render-performance profiling, a headless browser run using the Chrome DevTools Protocol (CDP) is the authorized way to capture automated gameplay render metrics.

**Authorized Windows Workflow**:
1. Ensure the development server is active at `http://localhost:5173` (start manually via `npm run dev`).
2. Run the pre-authorized profiling orchestrator using the absolute path to the primary runtime Node executable. This bypasses system sandbox permission restrictions
3. The orchestrator script will:
   - Programmatically spawn a headless Google Chrome instance on port `9222` using a dedicated profile folder (`.tmp/chrome-profile`) to avoid conflicts with active desktop sessions.
   - Connect via WebSockets and execute `scripts/collect-render-stats.mjs`.
   - Cycle through all 4 dense gameplay scenarios, gather FPS/draw calls, print the JSON results, and cleanly kill the browser process on completion.

For further render-performance work, see `docs/render-optimization-notes.md` for detailed scenario guidelines and historical benchmark datasets.

## Git

`git commit` is the only permitted write git command in this project. Do not run `git push`, `git merge`, `git rebase`, or any other git write command.

## Architecture Decision Records

Key design decisions live in `docs/adr/`. Read the relevant ADR before modifying code in its domain.

- `0001-game-balance-principles.md` — weapon-loss rules, drop rates, boss HP targets, extra-life reward policy.
- `0002-difficulty-modes-and-shield.md` — Rookie / Pilot / Ace behavior, shield rules, per-mode scoreboards.
- `0003-string-enums-for-discriminators.md` — discriminators such as `GameState`, `EnemyType`, `BulletType`, `DifficultyMode`, and render-category metadata use enums in `src/types.ts`.
- `0004-audio-dependency-injection.md` — entities depend on `IAudio`, never `AudioManager` directly.
- `0005-collision-module-event-driven-seam.md` — `checkCollisions()` reports typed hit events and does not own side effects.
- `0006-gameplay-tick-extraction.md` — per-frame world stepping lives in `tickGameplay()` in `src/systems/Gameplay.ts`.
- `0007-campaign-structure-and-module.md` — campaign progression is chapter/level based and owned by `src/campaign/Campaign.ts`.
- `0008-chapter-wave-grammar-modules.md` — waves are authored per chapter in `src/level/waves/chapterX.ts` using semantic beat helpers.
- `0009-non-finale-level-exit-window.md` — non-finale levels use a clear gate plus an authored exit flyout.
- `0010-music-cues-and-chapter-themes.md` — music is cue-based and chapter-themed, not one global track.
- `0011-projectile-instanced-rendering.md` — projectile rendering uses centralized instancing, not one scene mesh per bullet.
- `0013-vitest-module-test-harness.md` — Vitest protects deterministic module seams and does not replace browser playtesting or CDP render profiling.

## High-Level Architecture

**Entry:** `index.html` mounts `#ui-background`, `#game-canvas`, `#ui-overlay`, and the FPS counter. `src/main.ts` imports `src/style.css`, creates `new Game(canvas, uiOverlay)`, exposes it on `window.game`, and calls `start()`.

**Language / toolchain:** The game is now fully TypeScript-first. Source files live under `src/**/*.ts`, built with Vite 5 and TypeScript 6. When updating docs or guidance, do not refer to the old `.js` entrypoints unless you are describing historical context.

**Core coordinator (`src/Game.ts`):** `Game` is now mostly a state machine and runtime orchestrator, not the full gameplay container. It owns:

- top-level state transitions (`TITLE`, `LEVEL_START`, `PLAYING`, `PAUSED`, `GAME_OVER`, `LEVEL_COMPLETE`, `GAME_COMPLETE`, `VIEWER`)
- title-screen selections for starting level, starting weapon tier, and difficulty mode
- music cue selection
- the active `GameplayRun`
- the `TacticalDatabase`
- the `UI`, `Scene`, `InputManager`, `AudioManager`, and `ScoreManager`

**Gameplay runtime (`src/systems/GameplayRun.ts`):** Active gameplay has been extracted out of `Game`. `GameplayRun` owns the live world state for a run:

- `player`
- `enemies`
- `boss`
- `bullets`
- `powerups`
- `effects`
- `background`
- `terrain`
- `levelManager`
- `ProjectilePool`

`GameplayRun.tick()` builds a `WorldState`, calls `tickGameplay()` from `src/systems/Gameplay.ts`, calls `checkCollisions()` from `src/systems/Collisions.ts` to collect collision contacts, then calls `resolveCollisionContacts()` from `src/systems/CombatResolution.ts` before handling the resulting hit events.

**Gameplay seam:** Keep these responsibilities separated:

- `src/systems/Gameplay.ts` updates entities and filters dead/offscreen objects.
- `src/systems/Collisions.ts` detects overlaps and emits typed collision contacts.
- `src/systems/CombatResolution.ts` resolves collision contacts into typed hit events.
- `src/systems/GameplayRun.ts` owns side effects such as score changes, explosions, audio, powerup resolution, and level transitions.

Do not push score/audio/scene side effects back down into `Collisions.ts`.

## Rendering

**Scene (`src/Scene.ts`):** Owns the Three.js renderer, orthographic camera, resize behavior, flash overlay, and post-processing pipeline.

- Logical playfield remains `960x540` via `GAME_WIDTH` / `GAME_HEIGHT` from `src/constants.ts`.
- The active camera can be tilted for gameplay and flattened for the viewer.
- Post-processing is `RenderPass -> UnrealBloomPass -> ShaderPass` (chromatic aberration).
- The renderer tracks optional FPS/render stats for debugging.

**Projectile rendering:** Bullets are no longer rendered as ordinary scene children. Objects marked with `RenderCategory.BULLET` are intercepted by `Scene.add/remove()` and batched through `src/systems/ProjectileInstancer.ts`.

- `src/systems/ProjectilePool.ts` pools selected bullet types.
- `src/systems/ProjectileInstancer.ts` batches projectile meshes into `THREE.InstancedMesh` groups.
- If you add new projectile visuals, verify they still cooperate with pooling and instancing.

**Procedural visuals:** The old sprite-generator architecture is gone. The current codebase is primarily procedural Three.js geometry/material construction per entity/background/terrain. Do not document or extend `SpriteGenerator`-style flows unless you are reintroducing them deliberately.

**Embedded GLB texture adjustment:** Use `scripts/brighten-glb-texture.mjs` when an embedded PNG texture in a GLB needs the same brightness lift previously applied to `src/models/player.glb`. Example:

```bash
node scripts/brighten-glb-texture.mjs brighten src/models/player.glb src/models/player.glb --image 0 --factor 1.74
```

The script can also `list` embedded texture dimensions/statistics and `extract` a PNG. It supports embedded, non-interlaced, 8-bit PNG textures and rebuilds the GLB BIN chunk when the rewritten PNG grows.

## Campaign And Level Structure

**Campaign module (`src/campaign/Campaign.ts`):** The game now uses a chapter/level campaign model instead of a flat four-level loop.

- There are currently 4 chapters.
- Each chapter currently has 5 implemented levels, for 20 implemented campaign levels total.
- Level IDs use the form `chapter-level` such as `1-1` or `4-5`.
- Chapter archetype determines which background, terrain, wave grammar, boss, and music cue are used.
- `Campaign.ts` is the source of truth for level identity, chapter names, soft weapon-tier caps, finale flags, and progression helpers.

**Level factory layer (`src/level/Levels.ts`):** `LEVELS` maps chapter archetype to the implementation package for that chapter:

- `createBackground()`
- `createTerrain()`
- `buildWaves()`
- `createBoss()`
- scroll speed / boss trigger / terrain control points / playfield bounds

**Level manager (`src/level/LevelManager.ts`):**

- advances `scrollX`
- emits `StageEvent`s when wave entries trigger
- spawns finale bosses for chapter-finale levels
- opens non-finale completion only after the clear gate resolves

**Wave authoring (`src/level/waves/`):** Waves are organized per chapter in:

- `chapter1.ts`
- `chapter2.ts`
- `chapter3.ts`
- `chapter4.ts`

They compile down to `WaveEntry[]` using `Timeline.ts` and chapter-local semantic beat helpers. Prefer extending those modules instead of hardcoding more per-level builders in `Levels.ts`.

**Terrain / playfield:** `src/level/Terrain.ts`, `Terrain3.ts`, and `Terrain4.ts` provide wall interpolation and special hazards. `src/level/PlayfieldBounds.ts` supplies static bounds where appropriate. `Gameplay.ts` computes actual terrain bounds per frame and passes them to the player and terrain-aware enemies.

## Entities

**Shared contracts:** Central interfaces and enums live in `src/types.ts`. If you add a new system-facing entity capability, update the shared contract there first.

**Entity registry / catalog:**

- `src/entities/EntityCatalog.ts` is the authoritative catalog for stage-enemy viewer ordering/presentation and spawn wiring.
- `src/entities/EntityRegistry.ts` is a thin spawn facade over the catalog.

If you add a new standard enemy:

1. Add the enum entry in `EnemyType`.
2. Add the spawn definition in `EntityCatalog.ts`.
3. Add any needed wave usage.
4. Add tactical database presentation metadata.

**Enemy set:** Current standard hazards include `EnemyStraight`, `EnemySine`, `EnemyDiver`, `EnemySwarm`, `EnemyTurret`, `EnemyCharger`, `EnemySpore`, `Obstacle`, `RockDrake`, and `Stalactite`.

**Bosses:** Boss implementations live in `src/entities/Boss.ts`, `Boss2.ts`, `Boss3.ts`, and `Boss4.ts`, with shared behavior in `BossBase.ts`. Boss constructors receive normalized `BossConstructorParams`.

**Projectile definitions:** Projectile behavior is split across:

- `src/entities/Bullet.ts`
- `src/entities/BulletsPlayer.ts`
- `src/entities/BulletsEnemy.ts`
- `src/entities/ProjectileDefinitions.ts`

When modifying projectile behavior, check both gameplay semantics and render-path implications.

## Audio

Audio lives under `src/systems/audio/`.

- `AudioManager.ts` is the runtime facade used by `Game`.
- `SFXLibrary.ts` owns synthesized sound effects.
- `MusicSequencer.ts` owns sequenced playback.
- `themes/registry.ts` resolves `MusicCue` values to authored chapter themes.

Music is chapter-driven. Title uses the title cue, gameplay uses the chapter cue for the selected starting level, pause ducks the active cue, and title-level preview can swap cues when advanced title options are enabled.

Per ADR 0004, entities should depend on `IAudio` from `src/types.ts`, not on `AudioManager` directly.

## UI

UI lives in `src/ui/`.

- `UI.ts` coordinates all HTML screens.
- `src/ui/screens/` contains the individual screen classes.
- `src/ui/ui.css` contains the screen styling.

Important current title-screen behavior:

- `UP` / `DOWN` cycles implemented campaign levels when advanced title options are enabled.
- `LEFT` / `RIGHT` changes starting weapon tier when advanced title options are enabled.
- `Tab` cycles difficulty mode.
- `M` toggles music.
- `V` opens the tactical database when advanced title options are enabled.

The title screen now displays chapter name plus structured level ID, and high scores are stored per difficulty mode.

## Tactical Database Viewer

The viewer is no longer rendered from `Game.ts` directly. It is owned by `src/viewer/TacticalDatabase.ts` and draws from `src/entities/EntityCatalog.ts`.

- Page 1 shows stage enemies from `getStageEnemyCatalogEntries()`.
- Page 2 shows bosses from `getBossCatalogEntries()`.
- Viewer spawn behavior reuses the real entity/boss constructors.
- Viewer clipping planes are applied per card so meshes stay inside their presentation frame.

If you add a new enemy or boss, update the catalog-driven viewer metadata so it appears in the tactical database with correct ordering, scale, and centering.

## Input Mapping

Logical keyboard mapping is defined in `src/systems/InputManager.ts`:

- `W` / `A` / `S` / `D` or arrow keys — movement and menu navigation
- `Space` — fire / charge / select
- `Enter` — confirm / continue
- `Escape` or `P` — pause / unpause, exit database
- `V` — tactical database from title when enabled
- `Tab` — cycle difficulty mode on the title screen
- `M` — toggle music

## Runtime Flags And Debugging

Runtime flags live in `src/constants.ts`.

- `ENABLE_ADVANCED_TITLE_OPTIONS`
- `ENABLE_RENDER_STATS`
- `ENABLE_INVINCIBLE_PLAYER`

Some flags can also be overridden through URL params via `isRuntimeFlagEnabled()`. If you are debugging render stats or invincibility behavior, check both the constants and the runtime query-string override path.

## Agent Skills

Repository-local skills are installed under `.agents/skills/`. Use the relevant skill instructions when the task matches.

- `diagnose` — disciplined debugging loop
- `grill-me`
- `grill-with-docs`
- `handoff`
- `improve-codebase-architecture`
- `prototype`
- `zoom-out`

## Practical Guidance

- Prefer updating TypeScript contracts first, then implementation sites.
- When changing progression or level identity, update `src/campaign/Campaign.ts` first and keep `src/level/Levels.ts` focused on chapter archetype implementation.
- When changing hit behavior, keep collision detection pure, put contact-to-hit-event logic in `CombatResolution`, and handle score/audio/scene side effects in `GameplayRun`.
- When adding enemies or bosses, update the entity catalog and tactical database metadata, not just the constructor file.
- When changing projectile behavior, verify both pooling/instancing and gameplay collision behavior.
- Always run `npm test` and `npm run build` before browser verification. Major gameplay changes still require browser playtesting because module tests do not prove visual fidelity, game feel, or render performance.
