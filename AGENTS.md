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

Automated module tests use Vitest. A GitHub Actions workflow (`.github/workflows/build-and-test.yml`) runs `npm test` and `npm run build` automatically on every pull request and push to `master`. Verification is:

1. `npm test`
2. `npm run build`
3. Browser-based playtesting at either `http://localhost:5173` for representative audio runs or `http://localhost:5173/?testAudio=off` for non-audio browser test runs

Vitest tests are co-located with the modules they protect as `src/**/*.test.ts`, run in the `node` environment, and are limited by `vitest.config.ts` to source tests so browser profile artifacts under `.tmp/` are not collected. Use plain object fakes for deterministic module seams instead of constructing full Three.js entities unless the integration itself is under test.

Detailed browser testing procedures live in [docs/testing/browser-testing.md](/home/stephanr/src/git/private/aeon-pulse/docs/testing/browser-testing.md). Read that document when the task involves manual playtesting, Playwright/browser automation, render profiling, or browser-control workflow details.

For render-performance work, see `docs/render-profiling-guide.md` and run `npm run profile`.
For the current cross-chapter draw-call baseline (including the PERF-1 per-(enemy-type, Model Render Bucket) safe-reductions analysis), see `docs/render-baseline.md`.

## Git

`git commit` is the only permitted write git command in this project. Do not run `git push`, `git merge`, `git rebase`, or any other git write command.

## Code Conventions

- Source files use LF (`\n`) line endings. Do not introduce CRLF. There is no `.gitattributes` enforcing this, so be careful when editing files on Windows or copy-pasting from editors that re-encode. If you accidentally introduce CRLF, re-save the file as LF before committing.

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
- `0012-player-glb-model-loading.md` — the player model is loaded async from `src/models/player.glb` with a procedural-geometry fallback.
- `0013-vitest-module-test-harness.md` — Vitest protects deterministic module seams and does not replace browser playtesting or CDP render profiling.
- `0014-campaign-attempt-progression-model.md` — score, lives, and weapon tier carry forward across a continuous Campaign Attempt.
- `0015-strict-projectile-spawning-seam.md` — enemy/boss bullets spawn through a projectile-factory seam, never by direct `Bullet` construction at call sites.
- `0016-tactical-database-presentation-adapter.md` — the Tactical Database renders through a presentation adapter, not directly from `Game.ts`.
- `0017-tactical-database-catalog-driven-bullet-preview.md` — viewer bullet preview, model readiness, and presentation offsets are driven by `EntityCatalog` entries, not by live fire observation or adapter-side class lookup.
- `0018-weapon-tier-balancing-and-action-pacing.md` — weapon-tier bands and Timeline Compression shape action pacing; soft tier caps gate upgrades.
- `0019-standard-enemy-model-preparation.md` — GLB standard-enemy models are prepared and cached for their presentation contexts.
- `0020-constant-point-light-count-optimization.md` — point-light count is held constant for render-cost control.
- `0021-instanced-rendering-for-popcorn-enemies.md` — active popcorn enemies are batched into instanced pools by the Enemy Instancer.
- `0022-browser-test-audio-suppression.md` — `?testAudio=off` starts an audio-suppressed browser test run without changing persisted volume.
- `0023-tactical-database-signal-acquisition-reveal.md` — viewer cards show intel immediately and reveal models via a holographic scan sweep.
- `0024-standard-enemy-model-source.md` — each GLB-backed standard enemy owns its model lifecycle (load/cache/attach) via a Standard Enemy Model Source.
- `0025-projectile-motion-stays-inline.md` — projectile motion stays inline in `Bullet.update`; there is no per-bullet motion system.
- `0026-bullet-cancellation-and-smart-bomb.md` — high-value kills and the Smart Bomb cancel enemy bullets into Cancellation Point Items.
- `0027-sector-based-environment-variation.md` — each Level maps to a Sector; mapping in `Campaign.ts`, definitions in `src/level/sectors/chapterX.ts`.
- `0028-destructible-props-as-world-entities.md` — props are a first-class `props` collection routed through collision/combat; non-solid in v1.
- `0029-sector-visuals-stay-procedural.md` — Sector identity comes from procedural landmarks via `InstancedScrollLayer`; no background GLB pipeline.
- `0030-solid-props-and-sector-corridor-margins.md` — Props can become solid obstacles and Sectors can narrow the playable corridor with `playfieldMargins`.
- `0031-corridor-relative-enemy-spawn-coordinates.md` — wave spawn positions are authored as normalized safe-corridor coordinates and resolved to screen space at level-build time.
- `0032-procedural-resource-cache-span.md` — procedural geometry/material cache spans standard enemies and the Chapter 4 finale boss via `ProceduralResourceCache`.
- `0033-deferred-level-completion.md` — finale-boss level completion is deferred out of the gameplay tick stack via `hasPendingLevelComplete`.
- `0034-projectile-lifecycle-stays-in-gameplay-run.md` — projectile create/retain/release/cancel rules stay private to `GameplayRun` rather than a separate lifecycle module.
- `0035-ambient-popcorn-stays-in-level-manager.md` — ambient popcorn spawning stays in `LevelManager` rather than a dedicated module.
- `0036-playwright-automated-browser-tests.md` — `@playwright/test` replaces CDP as the blessed browser automation layer for smoke tests, campaign validation, and render-baseline profiling.

## Agent Skills

Specialized agent skills live under `.agents/skills/`. Load one with the `skill` tool when its description matches the task.

Notable skills include:

- `grill-with-docs` — stress-test a plan against the project's domain model and documented decisions; update `CONTEXT.md` and ADRs inline as terminology and trade-offs crystallize.
- `diagnose` — disciplined reproduce/hypothesize/instrument/fix loop for hard bugs and performance regressions.
- `improve-codebase-architecture` — find consolidation and testability opportunities informed by `CONTEXT.md` and the ADRs.

See each skill's `SKILL.md` for its full workflow.

## High-Level Architecture

**Entry:** `index.html` mounts `#ui-background`, `#game-canvas`, `#ui-overlay`, and the FPS counter. `src/main.ts` imports `src/style.css`, creates `new Game(canvas, uiOverlay)`, exposes it on `window.game`, and calls `start()`.

**Language / toolchain:** The game is now fully TypeScript-first. Source files live under `src/**/*.ts`, built with Vite 5 and TypeScript 6. When updating docs or guidance, do not refer to the old `.js` entrypoints unless you are describing historical context.

**Core coordinator (`src/Game.ts`):** `Game` is now mostly a state machine and runtime orchestrator, not the full gameplay container. It owns:

- top-level state transitions (`TITLE`, `LEVEL_START`, `PLAYING`, `PAUSED`, `GAME_OVER`, `LEVEL_COMPLETE`, `GAME_COMPLETE`, `VIEWER`)
- title-screen difficulty selection, plus development-only title selectors for starting level and starting weapon tier
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
- `props`
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

Read this section when the task touches scene composition, render performance, or graphics debugging. For profiling workflow and baseline interpretation, also read [docs/render-profiling-guide.md](/home/stephanr/src/git/private/aeon-pulse/docs/render-profiling-guide.md).

**Scene (`src/Scene.ts`):** Owns the Three.js renderer, orthographic camera, resize behavior, flash overlay, and post-processing pipeline.

- Logical playfield remains `960x540` via `GAME_WIDTH` / `GAME_HEIGHT` from `src/constants.ts`.
- The active camera can be tilted for gameplay and flattened for the viewer.
- Post-processing is `RenderPass -> UnrealBloomPass -> ShaderPass` (chromatic aberration).
- The renderer tracks optional FPS/render stats for debugging.

**Projectile rendering:** Bullets are no longer rendered as ordinary scene children. Objects marked with `RenderCategory.BULLET` are intercepted by `Scene.add/remove()` and batched through `src/systems/ProjectileInstancer.ts`.

- `src/systems/ProjectilePool.ts` pools selected bullet types.
- `src/systems/ProjectileInstancer.ts` batches projectile meshes into `THREE.InstancedMesh` groups.
- If you add new projectile visuals, verify they still cooperate with pooling and instancing.

**Background & terrain scroll layers:** Backgrounds and terrain share `src/level/InstancedScrollLayer.ts`, a per-frame instancing primitive (`beginFrame` → `push` transforms → `endFrame`) used for all parallax scroll structure. This is distinct from the Enemy Instancer (popcorn enemies, ADR 0021) and the `ProjectileInstancer` (bullets). Per-Sector background landmarks (ADR 0029) are also authored through it.

**Procedural visuals:** The old sprite-generator architecture is gone. The current codebase is primarily procedural Three.js geometry/material construction per entity/background/terrain. Do not document or extend `SpriteGenerator`-style flows unless you are reintroducing them deliberately.

**Embedded GLB texture adjustment:** Use `scripts/brighten-glb-texture.mjs` when an embedded PNG texture in a GLB needs the same brightness lift previously applied to `src/models/player.glb`. Example:

```bash
node scripts/brighten-glb-texture.mjs brighten src/models/player.glb src/models/player.glb --image 0 --factor 1.74
```

The script can also `list` embedded texture dimensions/statistics and `extract` a PNG. It supports embedded, non-interlaced, 8-bit PNG textures and rebuilds the GLB BIN chunk when the rewritten PNG grows.

## Campaign And Level Structure

Read this section when the task changes progression, waves, sectors, level identity, or terrain/background/boss selection.

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

**Sectors (`src/level/sectors/`):** Each level maps to a named Sector (ADR 0027). The Level→Sector mapping is the `sector` field on the campaign level record (`Campaign.ts`, via `SECTORS_BY_CHAPTER`); Sector *definitions* live in `src/level/sectors/chapterX.ts` and are resolved by `getSectorDefinition(chapterKey, sector)`. A `SectorDefinition` carries an optional `backgroundConfig` (read by the chapter `Background` to render a per-Sector signature landmark) and a scroll-anchored `propLayout` that `LevelManager` drains alongside waves, emitting `SPAWN_PROP` events. Sector visuals stay procedural (ADR 0029); chapters without authored Sector definitions fall back to an empty default.

## Entities

Read this section when adding or changing enemies, bosses, props, or projectile definitions.

**Shared contracts:** Central interfaces and enums live in `src/types.ts`. If you add a new system-facing entity capability, update the shared contract there first.

**Entity registry / catalog:**

- `src/entities/EntityCatalog.ts` is the authoritative catalog for stage-enemy viewer ordering/presentation, spawn wiring, and viewer readiness hooks.
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

**Props:** Destructible scenery (`IProp` in `src/types.ts`) are non-solid world entities in the `props` collection (ADR 0028), not enemies. They live in their own `WorldState.props`, tick in `tickGameplay`, and route through the collision/combat seam: a `PLAYER_BULLET_PROP` contact becomes a `PROP_DESTROYED` `HitEvent`, dispatched in `GameplayRun._handleHit` (Bullet Clear radius, Score/Powerup Drop, Hazard Release; Timed Burst props self-detonate via a post-tick `consumeBurst` pass). Smart-bomb area damage hits props too. `src/entities/Prop.ts` is the base class, `PropRegistry.ts` holds the effect profiles + `createProp`, and `PropVisuals.ts` builds the per-`PropType` procedural mesh. To add a prop kind: add a `PropType` entry, a profile in `PropRegistry`, a visual in `PropVisuals`, and author placements in the Sector `propLayout`.

## Audio

Read this section when the task touches sound effects, music, or audio suppression behavior.

Audio lives under `src/systems/audio/`.

- `AudioManager.ts` is the runtime facade used by `Game`.
- `SFXLibrary.ts` owns synthesized sound effects.
- `MusicSequencer.ts` owns sequenced playback.
- `themes/registry.ts` resolves `MusicCue` values to authored chapter themes.

Music is chapter-driven. Title uses the title cue, gameplay uses the chapter cue for the selected starting level, pause ducks the active cue, and title-level preview can swap cues when advanced title options are enabled.

Browser test runs can also start with a run-scoped audio playback gate via `?testAudio=off`. That gate suppresses both music and sound effects without overwriting the persisted player volume preference.

Per ADR 0004, entities should depend on `IAudio` from `src/types.ts`, not on `AudioManager` directly.

## UI

Read this section when the task changes screens, HUD behavior, title-screen controls, or browser-test indicator states.

UI lives in `src/ui/`.

- `UI.ts` coordinates all HTML screens.
- `src/ui/screens/` contains the individual screen classes.
- `src/ui/ui.css` contains the screen styling.

Important current title-screen behavior:

- In development builds, `UP` / `DOWN` cycles implemented campaign levels.
- In development builds, `LEFT` / `RIGHT` changes starting weapon tier.
- `Tab` cycles difficulty mode.
- `M` toggles music in ordinary runs and toggles full test audio in `?testAudio=off` runs.
- `V` opens the tactical database.

The title screen now displays chapter name plus structured level ID, and high scores are stored per difficulty mode.

## Tactical Database Viewer

Read this section when the task touches viewer/catalog presentation or adds enemies/bosses that should appear in the tactical database.

The viewer is no longer rendered from `Game.ts` directly. It is owned by `src/viewer/TacticalDatabase.ts` and draws from `src/entities/EntityCatalog.ts`.

- Page 1 shows stage enemies from `getStageEnemyCatalogEntries()`.
- Page 2 shows bosses from `getBossCatalogEntries()`.
- Viewer spawn behavior reuses the real entity/boss constructors.
- Viewer clipping planes are applied per card so meshes stay inside their presentation frame.

If you add a new enemy or boss, update the catalog-driven viewer metadata so it appears in the tactical database with correct ordering, scale, centering, and model-readiness hook.

## Input Mapping

Logical keyboard mapping is defined in `src/systems/InputManager.ts`. Read that file or [docs/testing/browser-testing.md](/home/stephanr/src/git/private/aeon-pulse/docs/testing/browser-testing.md) when the task depends on controls or browser-playtest inputs.

## Runtime Flags And Debugging

Runtime flags live in `src/constants.ts`.

- `ENABLE_ADVANCED_TITLE_OPTIONS`
- `ENABLE_RENDER_STATS`
- `ENABLE_INVINCIBLE_PLAYER`
- `testAudio=off` starts an audio-suppressed browser test run with explicit test-language UI and a non-persistent full playback gate for music and SFX

Some flags can also be overridden through URL params via `isRuntimeFlagEnabled()`. If you are debugging render stats or invincibility behavior, check both the constants and the runtime query-string override path.

## Practical Guidance

- Prefer updating TypeScript contracts first, then implementation sites.
- When changing progression or level identity, update `src/campaign/Campaign.ts` first and keep `src/level/Levels.ts` focused on chapter archetype implementation.
- When changing hit behavior, keep collision detection pure, put contact-to-hit-event logic in `CombatResolution`, and handle score/audio/scene side effects in `GameplayRun`.
- When adding enemies or bosses, update the entity catalog and tactical database metadata, not just the constructor file.
- When changing projectile behavior, verify both pooling/instancing and gameplay collision behavior.
- Always run `npm test` and `npm run build` before browser verification. Major gameplay changes still require browser playtesting because module tests do not prove visual fidelity, game feel, or render performance.
