# Level Design Audit

A point-in-time audit of all 20 implemented campaign levels against [SHMUP_LEVEL_DESIGN_GUIDE.md](../SHMUP_LEVEL_DESIGN_GUIDE.md). The findings below are the durable record of where the authored wave timelines in `src/level/waves/chapterX.ts` comply with or diverge from the guide's ten core principles. All findings have been addressed in code and are guarded by `Waves.test.ts` where structural.

## Scope

- Wave authoring: `src/level/waves/chapter1.ts` ... `chapter4.ts`
- Timeline/grammar: `src/level/waves/Timeline.ts`, `src/level/waves/helpers.ts`
- Campaign/progression metadata: `src/campaign/Campaign.ts`
- Chapter pacing config (scroll speed, boss trigger, terrain): `src/level/Levels.ts`
- Reference: `SHMUP_LEVEL_DESIGN_GUIDE.md`

Boss fights, terrain geometry, and per-enemy combat tuning are out of scope here except where they directly affect wave readability or recovery.

## Cross-Cutting Findings

### 1. Recovery valleys between peaks (Principles 3 & 5)

The guide requires explicit recovery gaps between peaks. A `recoveryGapBeat()` exists in the grammar but is used sparingly across the campaign. Status: addressed for the highest-risk levels. Explicit empty-event recovery valleys compile in `1-5`, `3-5`, `4-4`, and `4-5`, with `Waves.test.ts` coverage verifying those entries remain present.

Implemented changes:

- `1-5`: replaced two lower-value row/diver beats with recovery valleys.
- `3-5`: replaced one light swarm filler beat and one diver filler beat with recovery valleys.
- `4-4`: replaced two filler rows/support beats with recovery valleys.
- `4-5`: replaced three repeated/filler pressure beats with recovery valleys, including one repeated `lavaAndDrakeBeat` and one repeated `dualTurretStalactiteBeat`.

### 2. Beat-name drift across Chapters 2-4 broke "headline read" tracking (Principle 1)

The guide requires each beat to have one nameable headline, and the `BeatType` name is the canonical headline label. Corrected cases (covered by `Waves.test.ts`):

- `chapter2.ts:39` `supportSineBeat` → `SINE_ROW` (was `MIRROR_SINE`).
- `chapter2.ts:102` `mixedTurretChargerBeat` → `MIXED_TURRET_CHARGER` (was `MULTI_CHARGER`).
- `chapter2.ts:112` `mixedSupportSineChargerBeat` → `MIXED_SINE_CHARGER` (was `MULTI_CHARGER`).
- `chapter2.ts:122` `mixedStraightSineBeat` → `MIXED_STRAIGHT_SINE` (was `MIXED_MIRROR_SINE_TURRET`).
- `chapter3.ts:131` `mixedStraightObstacleBeat` → `MIXED_STRAIGHT_OBSTACLE` (was `MIXED_MIRROR_SPORE_OBSTACLE`).
- `chapter3.ts:141` `mixedSupportSineObstacleBeat` → `MIXED_SINE_OBSTACLE` (was `MIXED_MIRROR_SPORE_OBSTACLE`).
- `chapter3.ts:151` `mixedStraightSporeBeat` → `MIXED_STRAIGHT_SPORE` (was `MIRROR_SPORE`).
- `chapter4.ts:107` `stalactitePairBeat` → `STALACTITE_PAIR` (was `MIXED_STALACTITE_MIRROR_SINE`).
- `chapter4.ts:117` `stalactiteBarrageBeat` → `STALACTITE_BARRAGE` (was `MIXED_CHARGER_STALACTITE_BARRAGE`).
- `chapter4.ts:242` `dualTurretStalactiteBeat` → `DUAL_TURRET_STALACTITE` (was `LAVA_AND_TURRET`).

### 3. Setpiece beats repeated within single levels (Principle 6)

Status: addressed in code. `3-5` varies the second late spore/swarm peak with `sporeTriadSwarmBeat()`, and `4-4` / `4-5` compile exactly one final-gauntlet-shaped stack each, with `Waves.test.ts` assertions guarding that shape.

### 4. Spore is introduced inside a mixed stack (anti-pattern)

The guide's anti-pattern: *"A new enemy introduced only inside a mixed stack."* Status: addressed. `3-2` introduces `Spore` with a solo `mirrorSporeBeat(...)` before the first `mixedStraightSporeBeat(...)`, verified by `Waves.test.ts`. For comparison, Chapter 4 correctly teaches each new threat alone first (`Stalactite` in 4-1, `Lava` in 4-2, `RockDrake` in 4-3).

### 5. Chapter 1 is vocabulary-correct but bland in places (Principle 6)

- **1-3** (`chapter1.ts:138`) is ~10 `mixedStraightDiver` variants that differ only in y-offsets — the guide's *"too-similar repeats"* risk.
- **1-2** (`chapter1.ts:117`) is similar with straight/diver repeats, solved by count/density rather than by changing the player's decision.

## Per-Chapter Assessment

### Chapter 1 - The Outer Array - Mostly compliant

| Level | Verdict |
|-------|---------|
| 1-1 | Clean teach-vary-combine ramp; swarm tutorial late. Good. |
| 1-2 | Density escalation fine, but repetitive row/diver beats. |
| 1-3 | Improved - now includes a distinct dual-diver split read and a cleaner row reset instead of only `mixedStraightDiver` variants. |
| 1-4 | Best-structured in chapter - only level with explicit `recoveryGapBeat`, finale swarm setpiece, dual-diver intensification. Model for the guide. |
| 1-5 | Dense finale, now has explicit valleys. |

### Chapter 2 - Iron Vein - Strongest adherence

- Teaches `Turret` alone (2-1, `chapter2.ts:150`) and `Charger` alone (2-3, `chapter2.ts:187`) before combining - textbook Principle 2.
- `multiChargerBeat` escalation: 1 charger -> 2 -> 3 across the chapter.
- Staggered `dx` offsets on chargers/turrets aid readability (Principle 4).
- Beat labels now distinguish true `multiChargerBeat` from mixed turret/charger and sine/charger patterns.
- Minor: `dualDiverSineRowBeat` is the closing beat of 2-2, 2-4, and 2-5 - a recurring authoring crutch.

### Chapter 3 - Hive Womb

- Progressive obstacle/spore vocabulary now includes a solo `Spore` introduction before the first mixed `Spore` stack.
- Beat-name corruption was fixed as a prerequisite for reliable follow-up review (finding 2).
- `dangerousSporeSwarmComboBeat` no longer repeats verbatim in 3-5; the second late pressure beat now asks for a different read while preserving finale intensity.

### Chapter 4 - Cinder Core - The corrected chapter

- **4-1** teaches stalactite language with **no lava** - clean literacy.
- **4-2** introduces `lavaPulseBeat` alone (`chapter4.ts:280`) then combines.
- **4-3** gives `RockDrake` headline space: solo (`chapter4.ts:300`), solo again (`chapter4.ts:304`), then `lavaAndDrakeBeat` combines - exactly Principle 2.
- **4-4** and **4-5** keep one dominant final-gauntlet-shaped stack each; `4-5` retains explicit valleys around its late pressure sections.
- `mixedStalactiteMirrorSineBeat` at 4-4 remains a borderline early 3-role combination to watch in future feel passes.

## Structural Positives

These aspects already comply with the guide and should be preserved:

- **Soft tier caps non-decreasing** per chapter (`Campaign.ts:73`), enforced by the build assertion at `Campaign.ts:110`. Supports Principle 8 (recovery at a tier below expected).
- **Scroll/tail gap before boss**: waves end around 5000-6500 scroll units while `bossAt = 7300` (`Levels.ts:43`), leaving an exit/cleanup window - matches Principle 3's "exit" beat.
- **`dx` stagger offsets** used throughout for intimidation-before-contact (Principle 4).
- **Ambient pressure** metadata (`Campaign.ts:80`) gives finale levels a `'none'` pressure marker, consistent with reserving the heaviest authored pressure for non-finale peaks.

## Solid-Prop Finale Re-Audit (post-ADR 0030, 2026-06-28)

The per-chapter finale verdicts above were authored before solid props shipped (ADR 0030). EV-3 verified solid props *behave* correctly; it did not verify they *feel* fair under finale wave pressure at one-tier-below. This section re-audits the four solid-prop finales against Principles 5 (Safespots) and 8 (Recovery Must Be Playable) by combining each prop's geometry (hp / `hw`,`hh` / effects) with the wave beat that co-occurs at its scroll anchor (props and waves share the same compressed scrollX space — `new Timeline(0.65)`).

Soft tier caps for the finales: `1-5`=3, `2-5`=4, `3-5`=4, `4-5`=5. "One-tier-below" is therefore tier 2 / 3 / 3 / 4 respectively.

### 1-5 `coreGate` — SAFE

- Two Hull Bulkheads (hp 4, `hh` 46 → 92 tall), on **opposite** sides at scroll 1600 (y=130) and 4400 (y=-130), never simultaneous.
- Chapter 1 has no terrain (open playfield + `PlayfieldBounds`); margins {15,15} leave a ~510-tall corridor. Each bulkhead blocks ~92, leaving ~339 of open lane on the opposite side.
- hp 4 is trivially destroyed at any tier. No Timed Burst, no hazard.
- **Verdict:** no Principle 5/8 concern. Open lane is huge; the prop is a lane-swap cue, not a choke.

### 2-5 `smelterCore` — PLACEMENT BUG (prop under-delivers, not over-punishes)

- Two Cooling Plugs (hp 7, `hh` 22 → 44 tall): scroll 1250 (y=120) and **scroll 6350 (y=-120)**.
- The late plug at y=-120 sits in terrain that has narrowed to ~+129/-127 by scroll 6350; with margins {22,22} the safe corridor is ~+107/-105. The plug spans y=-98 to -142, so its center (-120) and lower half are **below the safe floor (-105)** — only ~7-14px of the 44-tall box actually pokes into the playable corridor. The prop is ~85-95% buried in the bottom wall.
- Net effect: the late Cooling Plug reads visually as a 44-tall lane blocker but functions as a ~10px lip. It is decorative, not a Principle 5 obstacle.
- hp 7 at one-tier-below (tier 3) is non-trivial but fair *if* the prop actually blocked; as placed it barely matters.
- **Proposed fix (needs playtest confirmation):** raise the late plug's y from -120 to ~-78 so a 44-tall plug spans -56 to -100, sitting squarely in the lower corridor against the -105 floor. This makes the prop function as authored. Flagged, not applied — it changes 2-5 feel.
- **Verdict:** not a difficulty risk in the "too hard" direction. A clarity/placement bug.

### 3-5 `wombCore` — FEEL-PASS CANDIDATE (the one genuine hazard-releasing Timed Burst)

- **Three** Bone Dams (hp 5, circle r18, `HAZARD_RELEASE` radius 100 / duration 2.5 on death) — the most solid props of any finale, and the **only solid prop kind whose burst is punishing**.
- The Timed Burst Bone Dam at **scroll 6900** (`burstWindow` 6.5) sits exactly on the `mixedSupportSineObstacleBeat` wave (compressed scroll 6890), inside terrain narrowing from ~265 tall (scroll 6750) toward ~210 tall (scroll 7300); with margins {24,24} the effective corridor is ~162-217 tall at that window.
- If the player does not kill the 5-hp Bone Dam within 6.5s, it bursts and releases a radius-100 hazard — in a ~162-217-tall corridor, that hazard covers most of the vertical space for 2.5s, on top of the concurrent sine+obstacle beat.
- At one-tier-below (tier 3) the player can output 5 hp of damage well inside 6.5s *if they focus the prop*, but focusing it means ignoring the sine sweep + obstacle for that window.
- **Verdict:** the structural math says "tight but plausibly fair." This is the one finale that needs a non-invincible feel pass at tier 3 to confirm the hazard-burst window is survivable and the death is attributable (Principle 8). Not pre-emptively changed.

### 4-5 `calderaHeart` — COMMENT FIXED; STRUCTURE OK

- Two Basalt Gates (hp 9, `hh` 80 → 160 tall): scroll 1100 (y=-40) and **scroll 4700 (y=0, `isFullGate`, `burstWindow` 6.5)**.
- The scroll-4700 gate co-occurs with the `mixedDiverVStalactiteBeat` wave (compressed scroll 4719: 4 divers in a V + stalactites). At scroll 4700 the effective corridor is ~228 tall (terrain ~280, margins {26,26}); a 160-tall center gate leaves **~32px lanes top and bottom**. The gate is **not geometrically full-span** despite the `isFullGate` flag — `isFullGate` is a validation tag (`SolidPropPhysicality.ts:109`), not a gameplay mechanic; actual blocking is purely the `hw`/`hh` geometry.
- Critically, BASALT_GATE's effects are `BULLET_CLEAR + SCORE_DROP + POWERUP_DROP` — **no `HAZARD_RELEASE`**. Its Timed Burst is reward-only, so the player is *not punished* for letting it burst. The real pressure at scroll 4700 is the concurrent diver+stalactite wave compounding the 32px lane choice, not the prop's burst.
- The sector comment previously claimed a "full-span Basalt Gate and a ticking gate (Timed Burst) to force destruction before the corridor chokes" — doubly misleading. Fixed in `chapter4.ts` to accurately describe the gate as a lane-narrowing challenge, not a destroy-or-be-punished gate.
- hp 9 at one-tier-below (tier 4, Focused Plasma tier) is very killable; the question is whether the player *must* kill it, and they do not (lanes exist; burst is safe).
- **Verdict:** structure is fair. The 32px-lane + diver-V + stalactite compound is the readable headline (Principle 1); the gate is a lane-narrowing support threat, not the headline. Worth a non-invincible confirmation at tier 4 but no structural red flag.

### Actionable outcomes

1. **Applied:** `chapter4.ts` sector comment corrected (no gameplay change).
2. **Proposed (needs playtest):** raise the 2-5 late Cooling Plug `y` from -120 to ~-78 so it actually occupies the lower corridor instead of sitting in the wall.
3. **Flagged for feel pass:** 3-5 `wombCore` at tier 3 — confirm the scroll-6900 Timed Burst Bone Dam's hazard window is survivable and attributable.

### Re-audit playtest URLs

- `http://127.0.0.1:5173/?testAudio=off&level=3-5&weaponTier=3` (3-5 one-tier-below — the hazard-burst Bone Dam window; primary)
- `http://127.0.0.1:5173/?testAudio=off&level=4-5&weaponTier=4` (4-5 one-tier-below — the 32px-lane + diver-V compound at the scroll-4700 gate)
- `http://127.0.0.1:5173/?testAudio=off&level=2-5&weaponTier=3` (2-5 — observe the late Cooling Plug is effectively decorative pre-fix)
- `http://127.0.0.1:5173/?testAudio=off&level=1-5&weaponTier=2` (1-5 one-tier-below — sanity, expected safe)

## Verification Plan

Follow the guide's Browser Playtest Protocol. Suggested entry URLs:

- `http://127.0.0.1:5173/?testAudio=off&level=3-2&weaponTier=3` (Spore intro)
- `http://127.0.0.1:5173/?testAudio=off&level=3-5&weaponTier=4` (spore/swarm stack)
- `http://127.0.0.1:5173/?testAudio=off&level=4-4&weaponTier=4` (finale-grade stack)
- `http://127.0.0.1:5173/?testAudio=off&level=4-5&weaponTier=5` (game finale)
- `http://127.0.0.1:5173/?testAudio=off&invincible=1&renderStats=1&level=4-5&weaponTier=5` (scouting + render cost)

For each level under review, test at the expected weapon tier and one tier below, and confirm:

- Each peak has a recovery valley nearby.
- Deaths are attributable to a nameable headline read.
- Low-tier recovery does not require perfect memorization.

Always run `npm test` and `npm run build` before browser verification per `AGENTS.md`.
