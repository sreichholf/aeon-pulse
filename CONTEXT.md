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
The front-end intel viewer for cataloguing the Aeon Pulse Craft, standard enemies, and finale bosses.
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

**Hit Flash Presentation**:
The brief visual feedback shown when an enemy takes damage. Hit Flash Presentation belongs to the enemy's runtime presentation layer rather than to the immutable Standard Enemy Model asset.
_Avoid_: Mutating model materials, baking damage feedback into model identity

**Model Render Bucket**:
A runtime grouping of Standard Enemy Model surfaces that share rendering rules, such as opaque body, transparent glass, or emissive glow. Model Render Buckets may collapse multiple authored GLB materials when that preserves enemy readability while reducing draw impact.
_Avoid_: Authored material name, one material per color, gameplay part

**Procedural Enemy Resource Cache**:
The static caching of geometries and material templates for procedurally built standard enemies (such as Stalactites, Enemy Turrets, and Rock Drakes) at boot time, preventing redundant geometry processing and material allocations on spawn.
_Avoid_: Lazy procedural geometry generation, runtime material instantiation

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

## Example Dialogue

Dev: "Should `3-2` use the organic corridor?"
Designer: "Yes. It belongs to Chapter 3, so it follows the Chapter 3 archetype, but its wave layout and terrain rhythm can differ from `3-1`."
