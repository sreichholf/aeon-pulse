# AEON PULSE

AEON PULSE is a side-scrolling arcade shooter organised around a campaign of visually and mechanically distinct level families.

## Language

**AEON PULSE**:
The game title.
_Avoid_: Using the title alone when referring specifically to the player craft

**Aeon Pulse Craft**:
The player craft's in-world designation, shown as "AEON PULSE" in the Tactical Database.
_Avoid_: Generic player ship, unnamed player craft

**Tactical Database**:
The front-end intel viewer for cataloguing the Aeon Pulse Craft, standard enemies, and finale bosses. It draws subject ordering, presentation framing, projectile previews, and model-readiness hooks from `EntityCatalog`, and renders subjects through the `TacticalDossierCard` presentation adapter.
_Avoid_: Model gallery, debug viewer

**Tactical Dossier Card**:
A restrained Tactical Database presentation that frames one subject as intel: animated subject view, nameplate, and concise readouts without turning into a marketing hero or dense spec sheet.
_Avoid_: Hangar showcase, hero section, exhaustive stat panel

**Aeon Pulse Craft Readout**:
The Tactical Dossier Card readout for the Aeon Pulse Craft. It describes identity and operational role, not enemy-style numeric stats.
_Avoid_: Player HP panel, score value, tunable stat sheet

**Primary Craft Dossier**:
The single-subject Tactical Dossier Card layout for the Aeon Pulse Craft. It shares the Tactical Database shell but does not use the enemy or boss catalog grid.
_Avoid_: Enemy grid card, boss grid card, hangar showcase

**Craft-Only Dossier Treatment**:
The current Tactical Dossier Card treatment applies only to the Aeon Pulse Craft page. Standard enemy and finale boss pages remain catalog grids unless a separate redesign decision is made.
_Avoid_: Implicit Tactical Database-wide restyle, bundled catalog redesign

**Primary Craft Dossier Elements**:
The Primary Craft Dossier uses exactly three presentation elements: a large central scan frame, a compact craft nameplate, and a compact operational readout stack.
_Avoid_: Fake gauges, dense explanatory copy, extra controls

**Dossier Overlay**:
The screen-space HTML/CSS interface layer for Tactical Dossier Card framing and readouts. The dossier subject itself remains a Three.js model.
_Avoid_: 3D UI frame geometry, world-space labels

**Passive Inspection Motion**:
The non-interactive subject animation used in a Tactical Dossier Card, limited to subtle hover and attitude drift.
_Avoid_: Manual model rotation, new viewer input mode, static stillframe

**Signal Acquisition Reveal**:
The Tactical Database loading behavior where every Tactical Dossier Card frame and its intel readouts appear immediately, the subject area shows an idle "acquiring" scan state until that subject's model finishes loading, and the subject then materializes via a holographic scanline sweep. The card never waits on the model before showing intel, and each subject reveals independently when its own model attaches. Model readiness is declared by the subject's catalog entry, so the adapter does not need entity-class-specific preload logic.
_Avoid_: Blank grid until models load, cards popping in one-by-one in load order, awaiting all models before showing any card

**Presentation Context**:
A read-only value, set at construction, that tells a gameplay entity which presentation situation it was built for — live gameplay versus Tactical Database display — so it can select the appropriate prepared model variant and resolve its presentation constants once at build time. A Presentation Context is injected through the constructor and is never written onto an entity after construction.
_Avoid_: Mutable viewer flag, per-tick viewer branch, adapter-mutated entity state, "isViewer" boolean

**Collision Footprint**:
The gameplay-facing shape used to decide whether a subject is hit or makes body contact. A Collision Footprint is tuned for fairness and readability and does not need to match the full rendered silhouette.
_Avoid_: Assuming the full visual outline is always collidable

**Side-On Spacecraft Read**:
The presentation choice where a spacecraft subject is oriented as a side view across the scrolling axis, with the nose reading forward along horizontal travel rather than as a flattened top-down token.
_Avoid_: Treating orientation-only presentation changes as a gameplay role change

**Chapter**:
A major campaign family with a shared visual identity and gameplay grammar. A chapter contains multiple levels.
_Avoid_: Stage, world

**Level**:
One playable run within a chapter, identified by chapter and level number such as `2-4`.
_Avoid_: Stage

**Level ID**:
A structured level identity made from chapter number and level number, displayed as values such as `2-4`.
_Avoid_: Flat campaign index

**Starting Level Selector**:
The title-screen control for choosing a starting level. It displays implemented levels only, with the chapter name centered above the level ID, such as "The Outer Array" above `1-5`.
_Avoid_: Starting stage selector

**Dev-Only Direct Level Launch**:
A development-only browser test affordance that starts a fresh Campaign Attempt at a selected Level ID without requiring manual title-screen selection. It bypasses the initial Title Screen only and then continues through the normal Level Start Screen and gameplay flow.
_Avoid_: Production quick start, alternate gameplay mode, chapter launch

**Dev-Only Direct Weapon Tier Override**:
A development-only browser test affordance that sets the starting weapon tier for a Dev-Only Direct Level Launch while preserving the normal Campaign Attempt flow.
_Avoid_: Permanent progression override, player-facing difficulty option

**Level Start Screen**:
The pre-level screen that displays the current chapter name centered above the level ID, matching the starting level selector convention. It auto-advances after a short delay and can be skipped with Fire or Confirm.
_Avoid_: Stage intro

**Chapter Name**:
The player-facing name of a chapter. Chapter names sit alongside chapter numbers and describe the chapter archetype.
_Avoid_: World label, stage name

**Chapter Key**:
The stable content identifier for a chapter used by campaign data. Chapter keys do not change when chapter names are renamed.
_Avoid_: Display name as ID

**Megastructure**:
The Chapter 1 key. Its provisional chapter name is "The Outer Array".
_Avoid_: Alien stage

**Industrial**:
The Chapter 2 key. Its provisional chapter name is "Iron Vein".
_Avoid_: Factory stage

**Hive**:
The Chapter 3 key. Its provisional chapter name is "Hive Womb".
_Avoid_: Organic stage

**Volcanic**:
The Chapter 4 key. Its provisional chapter name is "Cinder Core".
_Avoid_: Lava stage

**Chapter Archetype**:
The reference visual and mechanical identity for a chapter. The four current levels are the initial chapter archetypes that future chapter levels vary from.
_Avoid_: Chapter base level, template level

**Sector**:
A named place within a **Chapter** that carries its own background treatment, terrain shape, prop set, and playable-corridor identity. A chapter owns a small palette of Sectors (3–5), and each **Level** maps to one Sector so levels within a chapter read as distinct places rather than repeated passes through the same environment. A Sector may express its identity by narrowing or widening the safe corridor width in addition to its visual and prop differences.
_Avoid_: Biome, sub-stage, zone, locale, environment variant, setting

**Authored Corridor Shape**:
The wall position at a specific scroll position derived from a level's terrain control points plus a chapter-local baseline modifier (such as the Volcanic lava pulse). Returned by `ITerrain.getWallsAt`. Used by terrain rendering and per-entity anchoring. For chapters without a baseline modifier it is the pure control-point interpolation, computed by the shared `WallInterpolator` utility.
_Avoid_: Raw wall, rendered wall, "getWallsAt result" when distinguishing the concept from the collision corridor

**Gameplay Collision Corridor**:
The `ITerrain.getCollisionWallsAt` result: the **Authored Corridor Shape** further narrowed by in-corridor solid obstacles such as the Volcanic columns and crystals. For chapters without such obstacles it is identical to the Authored Corridor Shape. Used for player and enemy body collision and movement clamping. This is the terrain-only input to the **Safe Corridor**; Sector `playfieldMargins` and per-enemy **Movement Envelope**s are applied after it.
_Avoid_: Actual wall, real wall, collision wall used loosely, getActualWallsAt (renamed)

**Safe Corridor**:
The playable vertical band at a specific scroll position after applying terrain walls, playfield bounds, and Sector `playfieldMargins`. It is the space the player and spaceship enemies are allowed to occupy before per-enemy movement envelopes are considered.
_Avoid_: Tunnel, hallway, movement lane

**Safe Corridor Spawn Coordinate**:
A normalized vertical position within a Sector's **Safe Corridor** used for authoring enemy spawn positions, where `-1` is the bottom safe edge, `1` is the top safe edge, and `0` is the center. The Wave Grammar resolves a Safe Corridor Spawn Coordinate into screen-space Y by applying the corridor height and the enemy type's **Movement Envelope**.
_Avoid_: Screen Y, absolute spawn Y, normalized pixel coordinate

**Movement Envelope**:
The extra vertical clearance a specific enemy type needs beyond its collision footprint so that its authored movement pattern (such as a sine-wave oscillation) does not carry it into corridor walls. Movement Envelopes are declared in the enemy catalog and applied by the Wave Grammar when resolving **Safe Corridor Spawn Coordinate**s.
_Avoid_: Hitbox margin, spawn padding, collision buffer

**Boss Arena**:
The playable space at a **Chapter Finale** where the **Authored Corridor Shape** opens back up to stage the **Finale Boss**, after any approach narrowing. A Boss Arena is about as wide as the **Sector**'s opening rather than wider, so the finale reads as a staged arena without abandoning the chapter's claustrophobic identity. Finale Sectors narrow on the *way* to the boss and open *at* the boss; they do not clamp the fight to the narrowest approach point.
_Avoid_: Boss room, arena corridor, finale clearing

**Prop**:
A destructible scenery object placed in a **Level** that the player can shoot for a small gameplay effect such as clearing nearby bullets, dropping score or a powerup, or releasing a short-lived hazard. Most Props are non-solid, but a Prop *may* be solid, in which case it blocks movement and projectiles, deals damage on body contact, and can be destroyed to open a lane. Props live in their own world collection, route through the collision/combat seam, and belong to a **Sector**'s prop set.
_Avoid_: Destructible object, crate, barrel, generic scenery, hazard prop

**Solid Prop Physicality**:
The gameplay-facing rule set that determines how a solid **Prop** occupies corridor space, blocks movement, and displaces overlapping bodies. Solid Prop Physicality is distinct from **Prop Effect**s and from destruction outcomes.
_Avoid_: Push-out logic, blocker math, prop collision helper

**Prop Effect**:
A canonical outcome a **Prop** produces when destroyed, drawn from a fixed menu: Bullet Clear (destroy nearby enemy bullets, producing Cancellation Point Items), Score Drop, Powerup Drop, or Hazard Release (spawn a short-lived hazard-themed particle burst). In the current implementation, Hazard Release is visual-only: `hazardRadius` tunes burst spread, `hazardDuration` tunes burst lifetime, and it does not create a damaging zone, collision volume, or lingering hazard entity. A Prop's effect profile is part of its kind definition and is resolved as a `PROP_DESTROYED` hit event.
_Avoid_: Per-prop bespoke effect, prop script

**Timed Burst**:
A **Prop** lifecycle behavior where the prop self-destructs after a window if it is not shot first, then fires its **Prop Effect**s. It creates urgency to destroy hazard-themed props before they burst.
_Avoid_: Prop timer, decay, fuse

**Chapter Theme**:
The musical identity assigned to a chapter. A Chapter Theme belongs to the chapter as a whole, while individual levels may vary its arrangement without becoming separate themes.
_Avoid_: Level theme when referring to a whole chapter

**Title Theme**:
The musical identity used by non-campaign front-end surfaces such as the title screen and Tactical Database. A Title Theme is not a Chapter Theme, even if it temporarily reuses the same underlying score.
_Avoid_: Stage 1 theme when referring to front-end music

**Music Cue**:
The runtime music selection token sent by the game to the audio system. A Music Cue names the current musical context, such as the Title Theme or a Chapter Theme, without exposing playback internals.
_Avoid_: Raw track number, direct sequencer state

**Chapter Theme Preview**:
The dev-only use of the Starting Level Selector on the title screen to audition Chapter Themes before starting a Campaign Attempt. It is a testing affordance, not part of the player-facing Title Theme behavior in production builds.
_Avoid_: Production title music behavior, player-facing track select

**Browser Test Run**:
A browser-based verification run of the game used to validate behavior that module tests cannot prove, such as gameplay feel, visuals, progression, or render behavior. May be manual or automated.
_Avoid_: Module test, unit test

**Automated Browser Test**:
A Browser Test Run driven by Playwright against the production build. Automated Browser Tests use `?testAudio=off` by default and read the Playtest State Probe exposed by `?testProbe=1`.
_Avoid_: Module test, browser test run when distinguishing automation is important

**Playtest State Probe**:
A development-only, machine-readable status surface used during a Browser Test Run so automation can inspect coarse runtime state without depending on browser-console access to internal game objects. Exposed when `?testProbe=1` is present.
_Avoid_: Production telemetry, player-facing debug UI, render profiler

**Audio-Suppressed Browser Test Run**:
A Browser Test Run started by `?testAudio=off` that applies a full, non-persistent Audio Playback Gate to both music and sound effects until the tester re-enables audio for that run.
_Avoid_: Silent game mode, mute everything always, persisted mute preference

**Browser Test Audio Suppression Flag**:
A runtime browser URL flag, currently `testAudio=off`, that starts an Audio-Suppressed Browser Test Run without changing ordinary representative startup behavior.
_Avoid_: Global browser default mute, permanent test-mode audio setting, player volume preference

**Suppressed Audio**:
For an Audio-Suppressed Browser Test Run, Suppressed Audio includes both music playback and sound effects playback.
_Avoid_: Music-only mute, soundtrack-only suppression

**Audio Playback Gate**:
A runtime audio control that prevents music and sound-effect playback paths from activating at all, rather than merely reducing audible output to zero volume.
_Avoid_: Zero-volume mute, silent-but-still-playing audio

**Test Audio Indicator**:
A minimal on-screen label that explicitly shows a Browser Test Run started with the Browser Test Audio Suppression Flag active.
_Avoid_: Generic mute label, player-facing volume state

**Test Audio Toggle**:
The run-scoped control used during an Audio-Suppressed Browser Test Run to re-enable or suppress full test audio without changing persisted player volume state. In current keyboard language, `M` becomes the Test Audio Toggle for that run.
_Avoid_: Music-only toggle during test runs, permanent audio-mode switch

**Chapter Finale**:
The climactic level of a chapter. In the current campaign shape this is the fifth level, so the four current playable levels become `1-5`, `2-5`, `3-5`, and `4-5`.
_Avoid_: Boss stage, base level

**Finale Boss**:
A boss encounter that concludes a chapter finale. Non-finale levels do not require bosses.
_Avoid_: Level boss, stage boss

**Finale Boss Definition**:
The campaign data that assigns a boss encounter to a chapter finale. Current bosses are the initial finale bosses, but chapter number should not permanently imply a boss class.
_Avoid_: Chapter-to-boss hard mapping

**Boss Archetype**:
The stable factory identity for a finale boss presentation and constructor family. A Boss Archetype may currently match a chapter archetype number, but it is not a Level ID or a chapter number.
_Avoid_: Boss level, chapter-to-boss hard mapping

**Level End Event**:
The authored completion moment for a non-finale level after its required waves, enemies, and visible rewards have resolved.
_Avoid_: No-boss boss spawn, implicit timeout, fixed end position

**Level Clear Gate**:
The completion condition that must be satisfied before a non-finale Level End Event resolves. A level can clear only after its scheduled waves have spawned, no required enemies remain alive or visible, and no visible powerups remain available.
_Avoid_: Timer-only clear, instant clear, enemy-only clear

**Level Exit Window**:
A short clear-state interval after the Level Clear Gate opens where the player exits the level before the Level Complete Screen appears.
_Avoid_: Abrupt clear, fixed scroll endpoint

**Invisible Playfield Lane**:
A non-visual movement band that keeps the player and enemy lanes out of HUD or screen-edge interference without adding visible tunnel walls or changing a chapter's art direction.
_Avoid_: Hidden wall, fake tunnel

**Level Complete Screen**:
The post-clear summary screen shown after every level. It appears before the next Level Start Screen and summarizes the clear before the campaign continues.
_Avoid_: Stage clear screen

**Chapter Complete Screen**:
The post-clear summary screen shown after a chapter finale. It includes the finale reward context before advancing to the next chapter.
_Avoid_: Boss clear screen

**Clear Type**:
The label shown on a clear screen to distinguish a non-finale level clear from a chapter finale clear.
_Avoid_: Generic clear message

**Chapter Bonus**:
The additional score awarded when clearing a chapter finale, distinct from the regular level clear bonus.
_Avoid_: Clear bonus, boss reward

**Chapter Bonus Reward**:
The current chapter bonus is score-only.
_Avoid_: Extra life bonus, shield reward

**Boss Reward**:
The life reward granted when a finale boss is defeated. In the current campaign model, this reward applies only to chapter finales.
_Avoid_: Non-finale life reward

**Life Gating**:
The rule that extra lives are awarded only by chapter finale bosses for now, while future campaigns may change that.
_Avoid_: Universal life rewards

**Campaign Shape**:
The planned arrangement of chapters and levels for the current campaign. The starting shape is four chapters with five levels each, but five levels per chapter is not a permanent rule.
_Avoid_: Fixed campaign grid, hard level count

**Campaign Module**:
The dedicated source of truth for chapter, level, clear, cap, and finale-boss campaign data.
_Avoid_: Overloading `Levels.ts`

**Level Factory Layer**:
The lower-level implementation layer that creates backgrounds, terrain, and bosses for a level.
_Avoid_: Campaign data, chapter registry

**Resolved Level Content**:
The full authored package for one **Level** after its **Campaign Module** identity has been combined with its **Sector** definition and chapter-local implementation. Resolved Level Content includes the level's wave schedule, prop layout, terrain shape, background treatment, and finale timing as one coherent content package.
_Avoid_: Level bootstrap blob, runtime level config, stitched level data

**Archetype Factory Mapping**:
The current implementation rule that each chapter archetype reuses the matching existing level factory: Megastructure→Level 1, Industrial→Level 2, Hive→Level 3, Volcanic→Level 4.
_Avoid_: Permanent one-to-one content lock-in

**Wave Grammar**:
The pacing and event vocabulary used to build levels within a chapter. Wave grammars are chapter-specific rather than globally shared.
_Avoid_: Universal wave set

**Wave Timeline Compiler**:
The utility that compiles anchored beat placements into sorted `WaveEntry` schedules for a chapter wave grammar.
_Avoid_: Wave grammar, authored chapter pacing, level manager

**Pattern Literacy Level**:
An early level whose purpose is to teach the player a chapter's basic enemy patterns and movement asks without major pressure spikes.
_Avoid_: Tutorial level, easy filler

**Active Literacy Level**:
A Pattern Literacy Level that asks the player to move, aim, and prioritize almost continuously while still avoiding serious trap patterns.
_Avoid_: Empty tutorial, passive intro

**Density Literacy Level**:
A level whose main new pressure axis is having more enemies active at once while keeping pattern combinations simple enough to read.
_Avoid_: Enemy spam, mixed-wave test

**Mixed-Wave Literacy Level**:
A level whose main new pressure axis is reading two simple enemy patterns at the same time without turning the level into an endurance test.
_Avoid_: Random overlap, density level

**Endurance Recovery Level**:
A level whose main new pressure axis is sustaining play through longer pressure strings while still giving deliberate recovery gaps.
_Avoid_: Attrition slog, boss warmup

**Finale Flag**:
The level-level boolean that marks a chapter finale while keeping the finale in the regular level list.
_Avoid_: Special finale entry

**Campaign Attempt**:
A continuous arcade run through the campaign. Score, lives, and weapon tier carry forward across non-finale levels and chapter finales.
_Avoid_: Per-level run, stage attempt

**Weapon Tier Target**:
The expected weapon tier band for an average player at a specific level or finale boss. Finale bosses are the primary balance anchors; intermediate levels use target bands to shape pacing.
_Avoid_: Weapon cap, guaranteed tier

**Soft Tier Cap**:
The temporary maximum weapon tier available at a campaign position. It is defined as campaign data per level; powerups collected at the cap do not raise weapon tier, but should still provide a consolation reward.
_Avoid_: Hard cap, wasted drop

**Over-Cap Powerup Reward**:
The consolation reward when a powerup is collected at the current soft tier cap. In shielded modes it refills shield first; if shield is already full, or if the player is in Ace mode, it grants 1000 score.
_Avoid_: Wasted powerup, forced upgrade

**Focused Plasma**:
The intended Tier 5 weapon identity: a peak upgrade that preserves strong center-lane piercing damage while reducing passive full-screen coverage. It should reward positioning and aim more than broad automatic lane deletion.
_Avoid_: Screen-wide piercing coverage, passive spawn deletion

**Player Model**:
The 3D model asset (`player.glb`) used to render the player's aerospace fighter. It is loaded asynchronously at boot time and cloned when instantiating the Player entity, with a robust fallback to procedural geometry if the asset fails to load.
_Avoid_: Procedural mesh, player sprite, static mesh

**Standard Enemy Model**:
A 3D model asset used as the presentation identity for a standard non-boss enemy. Standard Enemy Models are expected to become the normal presentation path for standard enemies over time, while each enemy still keeps its authored gameplay role and wave identity.
_Avoid_: Diver-only model, enemy sprite, boss model, enemy gameplay object

**Standard Enemy Model Source**:
The per-enemy object that owns the lifecycle of a Standard Enemy Model asset: loading the GLB, caching the prepared result per presentation context, and attaching a built instance into an entity's group. One source exists per GLB-backed standard enemy, configured with that enemy's presentation profiles and Model Render Bucket config.
_Avoid_: GLB loader (too generic), model cache, per-instance loader

**Hit Flash Presentation**:
The brief visual feedback shown when an enemy takes damage. Hit Flash Presentation belongs to the enemy's runtime presentation layer rather than to the immutable Standard Enemy Model asset.
_Avoid_: Mutating model materials, baking damage feedback into model identity

**Model Render Bucket**:
A runtime grouping of enemy surfaces that share rendering rules, classified as opaque body, transparent glass, or emissive glow. For GLB-backed Standard Enemy Models, Model Render Buckets may collapse multiple authored materials into one when that preserves enemy readability while reducing draw impact. For procedurally-built enemies, each ProceduralResourceCache material carries its bucket as a label for render-cost attribution (no collapse — the materials are built explicitly). The same body/glass/glow vocabulary is used for both paths.
_Avoid_: Authored material name, one material per color, gameplay part, treating procedural bucket labels as collapse rules

**Procedural Resource Cache**:
The static caching of geometries and material templates for procedurally built entities at boot time, preventing redundant geometry processing and material allocations on spawn. Current users include standard enemies (Stalactites, Enemy Turrets, Rock Drakes, Enemy Spores, Obstacles) and the Chapter 4 Finale Boss. The pattern is open to any procedural entity, not just enemies.
_Avoid_: Lazy procedural geometry generation, runtime material instantiation, "Procedural Enemy Resource Cache" (the role-agnostic name supersedes it)

**Procedural Flash Overlay**:
A localized transparent overlay mesh attached to procedurally animated standard enemies, which displays hit feedback by toggling visibility rather than mutating shared materials.
_Avoid_: Mutating shared materials on hit, static full-body flash overlays on segmented moving parts

**Module Test Harness**:
The Vitest-based automated test layer for deterministic module seams. It protects pure or near-pure code such as collision contact detection, combat resolution, campaign helpers, and wave timeline compilation.
_Avoid_: Browser playtest replacement, render profiler

**Collision Contact**:
A pure overlap fact emitted by `checkCollisions()` before gameplay effects are applied.
_Avoid_: Hit event, score event, explosion trigger

**Combat Resolution**:
The step that converts collision contacts into typed hit events and mutates directly involved gameplay objects such as bullets, enemies, bosses, and the player.
_Avoid_: Collision detection, scene/audio side effects

**Bullet Preview Cycling**:
The Tactical Database behavior of iterating through an entity's declared projectile types one-by-one, showing each for a fixed 5-second window. Cycling is driven by the catalog-declared list and a card-owned timer, not by the entity's live fire cadence.
_Avoid_: Live bullet capture, fire-rate-driven cycling, stale-gate logic

**Viewer Projectile Key List**:
The ordered list of projectile definition source keys declared per entity in `EntityCatalog`. This list is the sole source of truth for which projectile presentations appear in the Tactical Database and in what order. An empty list means no bullet preview.
_Avoid_: Viewer bullet type list, dynamic bullet observation, entity-driven preview, implicit type detection

**Semi-Piercing Projectile**:
A player projectile (like Wave or Focused Plasma tap fire) that penetrates exactly one target and disappears on the second.
_Avoid_: Limited piercing bullet, single-piercing shot

**Timeline Compression**:
The 35% scale-down of wave timelines to increase wave density and action pacing.
_Avoid_: Speed scaling, wave squeezing

**Ambient Popcorn Spawner**:
The background system that spawns random minor enemies to keep the screen active, using spatial avoidance to prevent overlapping with scheduled wave enemies at the spawn edge. Ambient pools are chapter-specific and may include role-driven support threats such as Chapter 1 Divers rather than only rigid filler ships.
_Avoid_: Random hazard spawner, filler generator

**Level Duration Snapping**:
Shortening level scroll distances (e.g. from 11,200 to 8,000 units) to match compressed timelines.
_Avoid_: Level shrinking, scroll capping

**Popcorn Enemy**:
A low-commitment standard enemy used to maintain ambient activity or fill authored density beats. Popcorn Enemies are usually simple, but the category is broader than strictly rigid filler and can include support threats when chapter pacing needs them.
_Avoid_: Bosses, setpiece threats, assuming only Swarms or Straights qualify

**Sweeper Enemy**:
A projectile-specialist support enemy whose main gameplay value comes from claiming temporary screen space with a distinctive shot pattern rather than from direct aimed fire or body pressure. The current `EnemySine` redesign is the reference Sweeper Enemy.
_Avoid_: Baseline shooter, lane-disturber-only label, filler ship

**Enemy Instancer**:
The batching coordinator that merges the geometries of active Popcorn Enemies into instanced rendering pools during gameplay.
_Avoid_: Projectile instancer, manual mesh cloning

**Bullet Cancellation**:
The mechanic where defeating a large, high-value enemy (like a Boss or Charger) instantly neutralizes all enemy projectiles currently on the screen, converting them into point rewards or harmless visual effects.
_Avoid_: Local bullet clear, smart bomb, score items

**Cancellation Point Item**:
The physical score token created when a bullet is cancelled. These items briefly linger before magnetizing and sweeping toward the player craft, providing kinesthetic reward rather than just passive numeric score.
_Avoid_: Passive score pop, generic powerup

**Smart Bomb**:
A finite, stock-based defensive and offensive resource. When activated, it clears all enemy bullets on the screen, deals massive damage to all visible enemies (destroying popcorn/sweepers and chunking bosses), and provides a brief window of invulnerability. The Smart Bomb bypasses **Armor**. Stock resets on life loss.
_Avoid_: Cooldown ability, charge meter, purely defensive tool

**Shield**:
The player's survivability buffer in Rookie and Pilot difficulty modes. A Shield absorbs one hit entirely (no life lost, no weapon tier dropped) and regenerates after a hit-free window. Ace mode has no Shield. Distinct from **Armor**.
_Avoid_: Armor, enemy absorb, hit sponge

**Armor**:
An absorb layer on specific standard enemies that soaks the first hit entirely before the enemy takes HP damage. Armor is chapter-gated (active from Chapter 2 onward) and applies only to low-HP standard enemy types whose scaled HP would otherwise be one-tapped by high weapon tiers; it does not regenerate and is bypassed by the **Smart Bomb**. Distinct from the player **Shield**.
_Avoid_: Enemy shield, shield (reserved for the player mechanic), damage sponge

**Bullet Active-Flag Synchronization**:
The mechanism that lets bullet removal performed during the gameplay tick (cancellation, smart-bomb clear, hostile-bullet clear on level exit) survive the post-tick sync back into the run. Each affected bullet is deactivated in place rather than removed from its containing array, and the tick's post-update filter then drops inactive bullets from the shared array reference. This is why mid-tick cancellation is not reverted when the run re-reads the array.
_Avoid_: "the filter reverts cancellation", assuming the synced array is a fresh copy, treating the active flag as a render-only hint

**Deferred Level Completion**:
The contract that a level-completion request originating inside the gameplay tick (from a finale-boss death) does not invoke the level-complete transition synchronously. Instead the run sets `hasPendingLevelComplete`, and the owning `Game` flushes the transition after `tick()` returns on the same frame. Level-completion requests originating from the Level Exit Window (`_tickLevelExit`) remain synchronous because that path early-returns and cannot re-enter the tick. Deferred Level Completion preempts game-over when both would resolve on the same tick.
_Avoid_: assuming finale-boss death calls onLevelComplete on the tick stack, assuming the Level Exit Window path defers, assuming game-over wins a same-tick tie

## Example Dialogue

Dev: "Should `3-2` use the organic corridor?"
Designer: "Yes. It belongs to Chapter 3, so it follows the Chapter 3 archetype, but its wave layout and terrain rhythm can differ from `3-1`."

---

Dev: "I'm placing a Sine pair at `0.75` in the new coordinate system for `2-4`. Is that safe?"
Designer: "It depends on the Sector. `0.75` is a **Safe Corridor Spawn Coordinate**, so the **CorridorResolver** will map it to the actual corridor at that scroll position. But because **EnemySine** has a **Movement Envelope** of 35 px, the resolver will shrink the usable band by 35 px on both sides before placing it. In `pressHall` it'll fit; in `smelterCore` it might get pushed down."
Dev: "So the same authored value adapts to the corridor?"
Designer: "Exactly. The level author writes one number; the resolver makes it correct for the Sector's **Safe Corridor**.
