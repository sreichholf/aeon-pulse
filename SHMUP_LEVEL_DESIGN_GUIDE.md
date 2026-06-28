# Shmup Level Design Guide

Research date: 2026-06-20

This document turns shmup/STG design references into practical authoring guidance for Aeon Pulse levels. It is not an ADR. It is a design aid for future passes over `src/level/waves/chapterX.ts`, terrain pacing, enemy mixes, and browser playtests.

## Source Notes

Useful references found during research:

- [Shoot 'em up - Wikipedia](https://en.wikipedia.org/wiki/Shoot_%27em_up): genre basics, predictable enemy formations, fast reactions, memorized patterns, bullet hell collision-box expectations, and the distinction between deterministic scripted shooters and more random enemy-dispatch approaches.
- [Truxton - Wikipedia](https://en.wikipedia.org/wiki/Truxton_%28video_game%29): Toaplan-style memorization design, weapon-specific stage sections, and intentionally placed safespots/breathing room.
- [Ikaruga - Wikipedia](https://en.wikipedia.org/wiki/Ikaruga): polarity as a whole-stage design premise, puzzle-like routing, stages redesigned so optimal score routes were not too obvious, and a "mountain and valley" pacing structure.
- [Cho Ren Sha 68K - Wikipedia](https://en.wikipedia.org/wiki/Cho_Ren_Sha_68K): destruction feel as a design goal, close-range damage tension, hitbox/readability tuning, manual enemy firing accuracy, and recovery/scoring tradeoffs.
- [ZeroRanger - Wikipedia](https://en.wikipedia.org/wiki/ZeroRanger): intimidation before danger, distinct enemy patterns, accessibility without guide-reading, checkpoint learning, and avoiding scoring systems with only one correct weapon/route.
- [Game balance - Wikipedia](https://en.wikipedia.org/wiki/Game_balance): pacing as dramatic structure and the need to challenge ability without creating unfair obstacles.
- [Dynamic game difficulty balancing - Wikipedia](https://en.wikipedia.org/wiki/Dynamic_game_difficulty_balancing): challenge-function thinking: enemy speed, health, frequency, powerups, and player power are tunable difficulty levers.

## Aeon Pulse Design Terms

Use the project glossary from `CONTEXT.md`.

- `Chapter Archetype`: the visual and mechanical identity of a chapter.
- `Wave Grammar`: the chapter-specific vocabulary of named beats in `src/level/waves/chapterX.ts`.
- `Beat`: a small authored question such as `straightRowBeat`, `rockDrakeBeat`, or `lavaPulseBeat`.
- `Pattern Literacy Level`: an early level that teaches chapter threats before heavy layering.
- `Level Clear Gate`: the authored completion condition; do not tune levels as pure timer rides.
- `Browser Test Run`: required for level feel, visual readability, terrain pressure, and recovery checks.

## Core Principles

### 1. One Headline Read Per Beat

Every beat should have one dominant read: a row to sweep, a diver shape to dodge, a turret angle to respect, a terrain pulse to route around, or a setpiece enemy to identify.

Support enemies are allowed, but they should support the headline. If the player cannot name the main problem after dying, the beat is probably noise.

Bad:

- `RockDrake`, dual `Sine`, `Stalactite`, lava pulse, and `Straight` rows all entering at equal importance.
- A screen where every enemy is dangerous in a different way at the same moment.

Good:

- `RockDrake` enters first, support rows arrive after its movement language is readable.
- Lava pulse controls lane choice, then a turret tests that lane choice.

### 2. Teach, Vary, Combine, Then Intensify

Use a four-step ramp for new threats:

1. Teach the enemy or terrain ask alone.
2. Vary position, timing, or lane.
3. Combine with one compatible support threat.
4. Intensify by shortening recovery or adding a second compatible layer.

Do not introduce a new enemy and immediately use it in a finale-grade stack. This was the Chapter 4 problem we already corrected: terrain hazards, support `Sine`, and setpiece threats were being stacked at equal weight too early.

### 3. Build Mountains And Valleys

Strong shmup stages do not stay at maximum density. They peak, release, and rebuild.

Use this shape inside a level:

- `opening`: low-risk aim calibration and first movement cue.
- `literacy`: one chapter-specific skill.
- `first peak`: a clean combination of two learned asks.
- `valley`: recovery gap, simple row, or reward collection space.
- `setpiece`: one memorable authored sequence.
- `second peak`: denser but still legible mixed pressure.
- `exit`: readable clear state, reward cleanup, and Level Clear Gate resolution.

The valley is not filler. It makes the next peak readable and prevents constant stress from flattening into fatigue.

### 4. Intimidation Should Precede Contact

ZeroRanger's useful lesson is that danger can be felt before it physically reaches the player. Aeon Pulse should use warning and staging:

- Spawn setpiece enemies early enough that the player sees their silhouette before the hitbox matters.
- Let visible terrain geometry imply future lane pressure before enemies exploit it.
- Use `dx` offsets so a threat appears, tracks, or charges after the player has one beat to process it.
- Keep enemy bullets and body-contact silhouettes visually separated from decorative background motion.

Avoid "late shooting" or instant collision asks from offscreen. Surprise can be exciting once; unreadable punishment is just bad authoring.

### 5. Safespots And Breathing Room Are Design Tools

Classic memorization shooters intentionally include safe or safer spaces. They are not mistakes. They let players plan, recover, and feel clever.

For Aeon Pulse:

- Every dense beat should have at least one plausible lane for the current weapon tier and difficulty.
- The lane can move, but it must be perceivable.
- Recovery gaps should be explicit beats when the previous screen was high pressure.
- Do not remove all safe positions just because invincible playtesting can survive the section.

### 6. Distinct Patterns Beat Raw Density

Good enemy patterns are individually recognizable. If two consecutive beats feel similar, change one of these first:

- entry lane
- entry timing
- enemy role
- pressure direction
- required player position
- terrain relationship
- reward/risk placement

Do not solve blandness by adding more enemies. More density is the last lever, not the first.

### 7. Difficulty Comes From Role Layering

Layer roles, not random hazards.

Useful roles:

- `lane-shaper`: changes where the player wants to stand, such as terrain, obstacles, or lava.
- `aim-tax`: asks the player to clear something quickly.
- `dodge-tax`: asks the player to move through bullets or body lanes.
- `timer`: becomes worse if ignored.
- `punisher`: attacks predictable habits like hugging one edge.
- `reward-carrier`: gives powerup/score motivation in a risky area.

Good mixed beat:

- One lane-shaper plus one aim-tax.
- One timer plus simple support rows.

Risky mixed beat:

- Two lane-shapers plus two aim-taxes plus a punisher.

### 8. Recovery Must Be Playable

Aeon Pulse has weapon tiers, shields, lives, bombs, and powerups. A level must not only be playable at ideal power.

Check every harsh section under at least two states:

- expected chapter weapon tier
- one tier below expected, after a death or missed powerup

If recovery requires perfect memorization, redesign the beat or place a recovery opportunity before the next peak.

### 9. Scoring Should Add Routes, Not Dictate One

Scoring and collection can make a level richer, but should not create a single mandatory route unless that is the explicit level premise.

For future score routes:

- Reward aggressive positioning, but keep survival route viable.
- Avoid scoring chains that make one missed enemy invalidate the rest of the level.
- Place optional risk near readable threats, not inside visual clutter.
- If a route requires a specific weapon tier, that must be intentional and documented.

### 10. Readability Beats Spectacle

Visual spectacle is only valuable if gameplay remains parseable.

Watch for:

- bullet colors blending into terrain/background
- enemy muzzle flashes hidden under bloom or particles
- tiny point items or powerups lost in explosions
- foreground terrain silhouettes that look like collidable walls but are not
- decorative motion that mimics enemy motion
- boss parts or setpiece parts hiding the actual damage source

If a screenshot looks impressive but the player's next correct move is not clear, the beat is not done.

## Beat Authoring Checklist

Before adding or changing a beat in `src/level/waves/chapterX.ts`, answer:

- What is the headline read?
- What skill is being taught, varied, combined, or intensified?
- What is the expected safe or safer lane?
- What does a low-tier recovery attempt look like?
- What support threat, if any, reinforces the headline?
- What will the player learn from dying here?
- Is there a valley before or after this peak?
- Does this beat respect the chapter archetype?
- Does this beat preserve the Level Clear Gate and exit flow?
- Can it be validated in a Browser Test Run without relying on invincibility?

## Chapter-Specific Guidance

### Chapter 1: The Outer Array

Primary job: teach base movement, aiming, row clearing, simple dives, and swarm pressure.

Rules:

- Use `Straight`, `Sine`, `Diver`, and `Swarm` as clean vocabulary.
- Avoid presenting all movement asks simultaneously in early levels.
- Make rows and formations visually obvious enough that new players learn the grammar.

### Chapter 2: Iron Vein

Primary job: introduce industrial lane control and aimed pressure.

Rules:

- `Turret` and `Charger` should create deliberate movement choices, not random corner traps.
- Use mixed beats to make the player decide whether to clear a source or dodge through it.
- Leave recovery space after multi-charger or turret-heavy screens.

### Chapter 3: Hive Womb

Primary job: spatial hazard management and organic pressure.

Rules:

- `Spore` and `Obstacle` beats should teach how the playfield changes, not simply deny space.
- Dense hive sections need visible lanes and clean color separation.
- Use swarm accents carefully so they do not hide the actual hazard lesson.

### Chapter 4: Cinder Core

Primary job: terrain literacy, lava pressure, and endgame role layering.

Rules:

- Early levels should teach terrain and lava language before mixing in finale-grade support.
- `RockDrake` should get headline space; do not bury it in simultaneous noise.
- `Stalactite` and `Charger` combinations need clear warning time.
- Heavy `finalGauntlet`-style layering belongs late, with one dominant read per beat.
- Keep render cost visible when adding spectacle: use `renderStats=1` and watch terrain/enemy detail ownership.

## Level Review Template

Use this when reviewing a level:

```md
## Level X-Y Review

Intent:
- Chapter role:
- Level role:
- New skill or escalation:

Beat Map:
- Opening:
- Literacy:
- First peak:
- Valley:
- Setpiece:
- Second peak:
- Exit:

Problems:
- Unreadable beat:
- Missing recovery:
- Too-similar repeats:
- Weapon-tier dependency:
- Visual clutter:
- Performance risk:

Changes:
- Beat moved:
- Beat reduced:
- Beat intensified:
- Recovery added:
- Visual/readability adjustment:

Verification:
- npm test:
- npm run build:
- Browser URL:
- Difficulty:
- Weapon tier:
- Observed deaths/shield hits/bombs:
- Render stats notes:
```

## Browser Playtest Protocol

For meaningful level-design feedback:

- Test with `?testAudio=off` when audio is not under review.
- Test the target level with the expected weapon tier and one tier below.
- Use invincibility only for scouting structure, not for final feel judgment.
- Watch at gameplay scale, not only screenshots.
- Pause after a death and name the cause. If the cause is "too much stuff", the beat needs simplification.
- Record whether each peak has a recovery valley nearby.
- Use `renderStats=1` for terrain-heavy or swarm-heavy changes.

Suggested URLs:

- `http://127.0.0.1:5173/?testAudio=off&level=1-1&weaponTier=1`
- `http://127.0.0.1:5173/?testAudio=off&level=4-3&weaponTier=4`
- `http://127.0.0.1:5173/?testAudio=off&invincible=1&renderStats=1&level=0-1&weaponTier=5`

## Common Anti-Patterns

- Maximum density as default.
- A new enemy introduced only inside a mixed stack.
- Terrain plus body collisions plus aimed bullets with no readable lane.
- Decorative clutter that looks more important than the actual threat.
- Repeating the same row/cluster three times without changing the player's decision.
- Recovery that assumes max weapon tier.
- Score or collection routes that invalidate survival play.
- Offscreen enemies firing before their role is visually understood.
- Invincibility-only validation.

## Practical Rewrite Strategy

When a level feels bad, do not rewrite everything first.

1. Identify the worst 2-3 beats from browser play.
2. Name the headline read for each. If none exists, simplify.
3. Remove one role layer before changing timing.
4. Add or widen one recovery valley.
5. Re-test at expected tier and one tier below.
6. Only then increase spectacle or density.

The target is not an easy level. The target is a level where deaths feel attributable, recovery is possible, and each chapter teaches a distinct way of playing.
