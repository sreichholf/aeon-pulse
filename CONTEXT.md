# AEON PULSE

AEON PULSE is a side-scrolling arcade shooter organised around a campaign of visually and mechanically distinct level families.

## Language

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

**Chapter Finale**:
The climactic level of a chapter. In the current campaign shape this is the fifth level, so the four current playable levels become `1-5`, `2-5`, `3-5`, and `4-5`.
_Avoid_: Boss stage, base level

**Finale Boss**:
A boss encounter that concludes a chapter finale. Non-finale levels do not require bosses.
_Avoid_: Level boss, stage boss

**Finale Boss Definition**:
The campaign data that assigns a boss encounter to a chapter finale. Current bosses are the initial finale bosses, but chapter number should not permanently imply a boss class.
_Avoid_: Chapter-to-boss hard mapping

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

## Example Dialogue

Dev: "Should `3-2` use the organic corridor?"
Designer: "Yes. It belongs to Chapter 3, so it follows the Chapter 3 archetype, but its wave layout and terrain rhythm can differ from `3-1`."
