# Enemy Behavior Rebalance

Last updated: 2026-06-12

## Purpose

Track the enemy-behavior rebalance before rewriting chapter wave scripts.

This document is intentionally a working design note rather than an ADR. It should answer:

- What gameplay role each enemy currently fills in code
- Where roles overlap too heavily
- Which behavior changes should happen before wave redesign
- What has already been reviewed and what remains

## Progress

- [x] First-pass review of core standard enemies
- [x] First-pass review of specialist and terrain-linked enemies
- [x] Initial target-role matrix
- [x] Decide which changes are behavior-only vs wave-only
- [x] Make first concrete behavior recommendations for core enemies
- [x] Implement chosen behavior adjustments
- [x] Re-test early campaign readability after behavior changes
- [x] Rewrite Chapter 1 waves against the updated enemy roles
- [x] Rewrite Chapter 2 waves against the updated enemy roles
- [x] Rewrite Chapter 3 waves against the updated enemy roles
- [ ] Rewrite later chapter waves against the updated enemy roles

## Current Diagnosis

The main pacing problem is role overlap.

Too many enemies currently ask the same question:

- dodge an aimed shot
- while a ship moves left across the screen
- while another ship also pressures your lane

That creates noise instead of authored escalation. Before changing wave timing, each enemy needs a clearer primary job.

## Target Role Buckets

Use these as the reference buckets for future balancing:

1. `Baseline shooter` — readable aimed fire that teaches lane discipline
2. `Lane disturber` — movement pattern that bends safe lanes without being the main damage dealer
3. `Hunter` — directly pressures the player's current position
4. `Speed pressure` — compresses space and forces quick local movement
5. `Setpiece threat` — expensive, high-readability event enemy with a strong tell
6. `Death-trigger threat` — weak while alive, dangerous if ignored or killed carelessly
7. `Spatial hazard` — shapes the playfield more than it tests raw dodging

## Enemy Review

### EnemyStraight

- Status: reviewed
- Current code read: [EnemyStraight.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemyStraight.ts)
- Current behavior:
  - Moves left at `130`
  - Waits for a fire timer, slows briefly, then fires a two-gun aimed shot
  - Performs a short post-shot lunge
- Current gameplay role:
  - General-purpose readable soldier
- What it asks from the player:
  - Recognize a pause
  - Nudge out of the aimed lane
  - Re-center quickly after the shot
- Problem:
  - This role is strong already, but several other enemies also occupy the same space
- Target role:
  - `Baseline shooter`
- Recommendation:
  - Keep this enemy close to current behavior
  - Treat it as the primary early-game aimed-fire teacher
  - If other enemies keep aimed fire, they must do so for a different reason than this unit

### EnemySine

- Status: reviewed
- Current code read: [EnemySine.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemySine.ts)
- Current behavior:
  - Moves left at `110`
  - Oscillates vertically with amplitude `35` and frequency `1.2`
  - Has `2` HP
  - Fires an early sweeping `ENEMY_SINE` oscillating projectile
  - May fire a slower repeat sweep shot if it survives long enough
- Current gameplay role:
  - Projectile-specialist space-claim support enemy
- What it asks from the player:
  - Respect a wide oscillating denial shot
  - Route around contaminated space while other threats stay active
- Problem:
  - The old aimed-shot version overlapped too much with `Straight` and failed to survive long enough in Chapter 1
- Target role:
  - `Setpiece-lite support` / projectile sweeper
- Recommendation:
  - Keep it out of Chapter 1 for now
  - Reintroduce it in later chapters as a sparse support enemy whose wide wave shot is the whole reason it exists
  - Do not drift back toward generic aimed fire

### EnemyDiver

- Status: reviewed
- Current code read: [EnemyDiver.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemyDiver.ts)
- Current behavior:
  - Moves left at `150`
  - Corrects toward player Y using a preserved formation spread
  - Fires aimed shots faster than `Straight`
- Current gameplay role:
  - Direct pursuit attacker
- What it asks from the player:
  - Break rhythm and relocate
  - Respect vertical tracking, not just horizontal screen flow
- Problem:
  - Good role, but easy to dilute if used alongside too many other aimed shooters
- Target role:
  - `Hunter`
- Recommendation:
  - Preserve this as the main reactive anti-player unit
  - Keep its shot pressure secondary to its tracking identity
  - Use it when a beat needs forced repositioning rather than general density

### EnemySwarm

- Status: reviewed
- Current code read: [EnemySwarm.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemySwarm.ts)
- Current behavior:
  - Moves left at `230`
  - Occasionally pauses and fires an aimed shot
  - Has very low HP and score
- Current gameplay role:
  - Fast filler with a surprise aimed shot
- What it asks from the player:
  - React quickly to body pressure
  - Sometimes also react to aimed fire
- Problem:
  - The aimed shot muddies its best quality, which is speed and space compression
- Target role:
  - `Speed pressure`
- Recommendation:
  - Strong candidate to remove firing entirely
  - Alternative: keep firing but make it very rare so players still read it primarily as movement pressure
  - Use in waves as a tempo spike and screen-compression tool, not as a micro-shooter

### EnemyTurret

- Status: reviewed
- Current code read: [EnemyTurret.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemyTurret.ts)
- Current behavior:
  - Moves left at `120`
  - Tracks the player
  - Charges for `0.8s`
  - Fires a 3-shot high-speed volley
- Current gameplay role:
  - Anchoring suppression enemy
- What it asks from the player:
  - Read a charge tell
  - Avoid line-of-fire occupation for an extended window
  - Respect repeated follow-up shots
- Problem:
  - Strong identity already, but high cognitive load
- Target role:
  - `Setpiece threat`
- Recommendation:
  - Keep behavior mostly intact
  - Avoid mixing many of these with hunters or chargers in the same beat
  - Use sparingly as a local objective that temporarily defines the screen

### EnemyCharger

- Status: reviewed
- Current code read: [EnemyCharger.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemyCharger.ts)
- Current behavior:
  - Enters normally
  - Locks with a visible warning laser for `1.0s`
  - Then dashes at `700` with some homing before freezing
- Current gameplay role:
  - High-commitment dodge check
- What it asks from the player:
  - Notice the warning
  - Predict the lane of attack
  - Vacate that lane cleanly before the rush
- Problem:
  - None conceptually; the risk is overuse
- Target role:
  - `Setpiece threat`
- Recommendation:
  - Preserve the telegraph-heavy charge identity
  - Keep count low and spacing generous
  - Do not stack this casually with turret volleys or dense diver packs

### EnemySpore

- Status: reviewed
- Current code read: [EnemySpore.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemySpore.ts)
- Current behavior:
  - Drifts slowly with minor vertical variance
  - Has `4` HP
  - On death, emits 4 homing projectiles
- Current gameplay role:
  - Punisher for careless target selection
- What it asks from the player:
  - Decide whether to kill it now, later, or route around the death burst
- Problem:
  - Its live behavior is weak enough that waves must support it or it becomes passive clutter
- Target role:
  - `Death-trigger threat`
- Recommendation:
  - Keep the death payload as the main identity
  - Pair with spatial constraints or other enemies that make the death burst matter
  - Do not also turn it into a major shooter; that would collapse its identity

### Obstacle

- Status: reviewed
- Current code read: [Obstacle.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/Obstacle.ts)
- Current behavior:
  - Large durable body with `25` HP
  - Scrolls left steadily
- Current gameplay role:
  - Lane blocker
- What it asks from the player:
  - Route early
  - Spend fire time if a lane must be opened
- Problem:
  - None by itself, but it only becomes interesting when paired with lighter threats
- Target role:
  - `Spatial hazard`
- Recommendation:
  - Keep behavior simple
  - Use with `Straight`, `Sine`, or `Spore`, where it changes the answer to otherwise familiar problems

### RockDrake

- Status: reviewed
- Current code read: [RockDrake.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/RockDrake.ts)
- Current behavior:
  - Slides in, stops, clings for `1.5s`
  - Fires a 5-shot lava burst
  - Then charges
- Current gameplay role:
  - Mini-setpiece terrain creature
- What it asks from the player:
  - Reposition during the cling
  - Read a spread burst
  - Handle a follow-up body rush
- Problem:
  - Too behaviorally rich to be treated like ordinary wave filler
- Target role:
  - `Setpiece threat`
- Recommendation:
  - Preserve behavior identity
  - Reserve for terrain chapters and punctuation beats
  - Build surrounding waves to frame it rather than drown it in noise

### Stalactite

- Status: reviewed
- Current code read: [Stalactite.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/Stalactite.ts)
- Current behavior:
  - Hangs from terrain
  - Starts shaking when player approaches
  - Falls, shatters, and spawns lava shots upward-left
- Current gameplay role:
  - Environmental ambush trap
- What it asks from the player:
  - Respect space ahead
  - Read terrain-linked warning states
  - Avoid over-committing to a lane beneath it
- Problem:
  - Like `RockDrake`, this can lose clarity if packed into already-busy beats
- Target role:
  - `Spatial hazard`
- Recommendation:
  - Preserve current identity
  - Use as a chapter-specific rhythm change, especially where terrain already narrows the playfield

## Proposed Ordering For Rebalance

Do not rebalance every enemy at once. Use this order:

1. Lock the four core standard-enemy roles:
   - `Straight`
   - `Sine`
   - `Diver`
   - `Swarm`
2. Confirm specialist enemies are rare enough:
   - `Turret`
   - `Charger`
3. Confirm support-threat identities remain clean:
   - `Spore`
   - `Obstacle`
4. Revisit terrain setpieces:
   - `RockDrake`
   - `Stalactite`
5. Only then rewrite chapter waves

## Behavior Change Candidates

These are the most likely high-value changes before wave redesign:

- `EnemySine`
  - Lower shot frequency, lower shot accuracy, or remove the pause-shot cycle entirely
- `EnemySwarm`
  - Remove firing or make firing rare enough that speed remains the primary read
- `EnemyDiver`
  - Keep tracking prominence higher than shot prominence
- `EnemyTurret`
  - No major behavior change needed unless later playtests show over-coverage
- `EnemyCharger`
  - No major behavior change needed unless later playtests show telegraph fatigue

## Wave Usage Notes

Quick review of authored wave usage in [chapter1.ts](/E:/Develop/GitHub/aeon-pulse/src/level/waves/chapter1.ts), [chapter2.ts](/E:/Develop/GitHub/aeon-pulse/src/level/waves/chapter2.ts), [chapter3.ts](/E:/Develop/GitHub/aeon-pulse/src/level/waves/chapter3.ts), and [chapter4.ts](/E:/Develop/GitHub/aeon-pulse/src/level/waves/chapter4.ts):

- Chapter 1 is now authored primarily around `Straight`, `Diver`, and `Swarm`
- Chapter 2 introduces `Turret` and `Charger` while still using `Sine`, `Straight`, `Swarm`, and `Diver`
- Chapter 3 shifts toward `Spore`, `Obstacle`, `Swarm`, `Diver`, and `Charger`
- Chapter 4 uses terrain-driven hazards heavily and treats `Swarm` as a small accent, not a main wave backbone

Implication:

- `Sine` should no longer be treated as a Chapter 1 core enemy
- `Swarm` does not need to carry firing responsibility and can specialize more aggressively
- `Diver` is already positioned like a punctuation hunter, so it mostly needs clarity rather than reinvention

## First Concrete Recommendations

These are the current recommended behavior decisions before implementation.

### EnemyStraight

- Decision:
  - Keep current firing behavior
- Why:
  - It is already the clearest readable aimed-shooter
  - Other enemies should separate away from its role rather than forcing this one to move
- Suggested implementation:
  - No immediate behavior change

### EnemySine

- Decision:
  - Rebuild `Sine` as a sweeper around the oscillating projectile
- Why:
  - The memorable part worth saving was its broad wave shot, not its old aimed-fire overlap
  - Chapter 1 proved it should not be a baseline early-game enemy
- Expected effect:
  - `Sine` now claims temporary screen space in a way `Straight`, `Diver`, and `Swarm` do not
  - Later chapter waves can use it as a sparse support threat around stronger anchors
- Risk:
  - If the sweep shot is too weak, it still feels decorative
  - If too frequent, it becomes visual clutter
- Mitigation:
  - Keep usage sparse and verify in Chapter 2 before broad reintroduction

### EnemyDiver

- Decision:
  - Keep aimed shooting, but reduce its frequency modestly
- Why:
  - The chase behavior should remain its main identity
  - Its current `1.4s` shot interval is aggressive enough that it starts competing with `Straight`
- Suggested implementation:
  - Raise `FIRE_INTERVAL` from `1.4` toward something like `1.8` to `2.0`
  - Keep its Y-correction behavior intact
- Expected effect:
  - The player reads the diver as a relocation threat first and a shooter second
  - It preserves danger without dominating mixed beats

### EnemySwarm

- Decision:
  - Remove aimed shooting entirely
- Why:
  - Its best identity is fast body pressure at `230` speed
  - Chapter 4 already uses it more like an accent burst than a shooter
  - Surprise aimed fire from a low-value fast unit adds noise more than depth
- Expected effect:
  - `Swarm` becomes a pure tempo spike and local-space compressor
  - Dense clusters become more readable because the player only solves movement pressure
- Risk:
  - Some swarm appearances may feel less threatening in empty space
- Mitigation:
  - Use swarm in clusters, cross-lane offsets, or as support during another stable threat

## Behavior Vs Wave Responsibility

This is the current split of responsibilities.

### Behavior changes to make first

- Rebuild `EnemySine` around the sweep shot
- Remove `EnemySwarm` firing
- Reduce `EnemyDiver` shot frequency modestly

### Things to leave to wave redesign

- Whether `Sine` should re-enter Chapter 2 immediately or wait until later chapter cleanup
- Whether Chapter 2 currently stacks `Turret` and `Charger` too tightly
- Whether Chapter 3 `Spore` and `Obstacle` beats need more recovery spacing
- Whether Chapter 4 terrain hazards need quieter surrounding support

## Implementation Order

Use this order if and when behavior changes begin:

1. Remove `EnemySwarm` firing
2. Rebuild `EnemySine` around the sweep shot
3. Slow `EnemyDiver` firing modestly
4. Playtest Chapter 1
5. Playtest Chapter 2
6. Only then edit wave scripts

## Implemented In First Pass

Implemented on 2026-06-12:

- [x] `EnemySwarm`
  - Removed aimed firing entirely
  - Removed the associated pause-shot cadence so swarms now stay in pure fast movement pressure
- [x] `EnemySine`
  - Removed the old aimed-shot behavior
  - Increased HP from `1` to `2`
  - Added an early sweeping `ENEMY_SINE` projectile plus a slower repeat sweep timer
- [x] `EnemyDiver`
  - Kept aimed firing
  - Increased `FIRE_INTERVAL` from `1.4` to `1.9` so tracking remains the main read
- [x] `EnemyStraight`
  - No behavior change in this pass

Code changes:

- [EnemySine.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemySine.ts)
- [EnemySwarm.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemySwarm.ts)
- [EnemyDiver.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemyDiver.ts)

## Verification Notes

Verification completed on 2026-06-12:

- Automated checks:
  - `npm test` passed
  - `npm run build` passed
- Browser playtest:
  - In-app browser run at `http://127.0.0.1:5173/?invincible=1`
  - Corrected for dev-title default level by advancing once from `0-1` to `1-1`
  - Focus of pass: early Chapter 1 readability after behavior split

Observed results from the Chapter `1-1` pass:

- `Sine` no longer overlaps with `Straight` as another aimed shooter
- `Swarm` no longer contributes surprise aimed bullets, which keeps fast clusters cleaner
- `Diver` still contributes bullets, but the screen language reads more clearly as `tracking threat` plus `baseline shooters`
- No build or runtime issue was introduced by removing the shot-state logic from `Sine` and `Swarm`

Limits of this verification:

- This was a short readability pass, not a full chapter pacing audit
- Chapter 2 specialist stacking still needs a dedicated test
- Wave quality has not been re-authored yet, so some beats may now feel quieter or more exposed

## Chapter 1 Wave Rewrite

Updated on 2026-06-12:

- Reworked Chapter 1 wave scripts in [chapter1.ts](/E:/Develop/GitHub/aeon-pulse/src/level/waves/chapter1.ts)
- Removed `Sine` from the Chapter 1 timelines and from the Chapter 1 ambient pool
- Preserved the current enemy role split:
  - `Straight` supplies baseline bullet language
  - `Diver` supplies tracking and secondary bullet pressure
  - `Sine` is reserved for later sweeper use outside Chapter 1
  - `Swarm` remains speed pressure rather than filler gunfire

Main wave-level intent:

- Remove dead-air `Sine` showcases from early progression
- Restore bullet presence through `Straight` / `Diver` pressure rather than reverting `Sine` or `Swarm` firing
- Keep Chapter 1 readable while increasing local pressure

Follow-up decision on 2026-06-12:

- `Sine` still felt too low-impact in Chapter 1 even after mixed-beat rewrites
- Conclusion: do not keep forcing `Sine` into early progression
- Action taken: removed `Sine` almost entirely from Chapter 1 and rebuilt those beats around `Straight`, `Diver`, and `Swarm`
- New stance:
  - `Sine` is not currently a viable early-game core enemy
  - It should be redesigned later at the behavior level before re-entering the early campaign

## Post-Rewrite Spot Check

Additional verification completed on 2026-06-12:

- `npm test` passed after the Chapter 1 wave rewrite
- `npm run build` passed after the Chapter 1 wave rewrite
- In-app browser spot-check completed on `http://127.0.0.1:5173/?invincible=1`

Observed result from the visual spot-check:

- Chapter 1 still carries projectile presence without relying on `Sine`
- The denser moments still read more cleanly than the pre-split version because bullet responsibility is concentrated in fewer enemy roles

Observed result after removing `Sine` from most of Chapter 1:

- Early Chapter 1 still sustains screen pressure through `Straight` and `Diver`
- `Swarm` still works as a tempo accent without needing bullets
- Removing `Sine` did not create an obvious pressure hole in the browser sanity pass
- The remaining `Sine` problem should now be treated as a future enemy redesign problem, not a Chapter 1 wave problem

Verification caveat:

- The title-level selection could not be read back programmatically during browser automation, so this was treated as a visual spot-check rather than a strict per-level audit
- A manual or tighter scripted pass is still needed for full Chapter 1 coverage and then Chapter 2 specialist pacing

## Wave Design Implications

Once behavior is adjusted, wave design should follow these rules:

- A beat should usually test one main thing and one support thing, not three equal things
- `Straight` should teach and confirm
- `Sine` should bend space around another threat
- `Diver` should force relocation during otherwise stable beats
- `Swarm` should spike tempo and compress space
- `Turret`, `Charger`, `RockDrake`, and `Stalactite` should each temporarily become the local headline threat

## Chapter 2 Wave Rewrite

Updated on 2026-06-12:

- Reworked Chapter 2 wave scripts in [chapter2.ts](/E:/Develop/GitHub/aeon-pulse/src/level/waves/chapter2.ts)
- Removed the old Chapter 2 habit of spending many beats on mirrored `Sine` pairs
- Reintroduced `Sine` primarily as sparse support around `Turret`, `Charger`, or `Straight` beats
- Preserved Chapter 2's job as the first chapter that teaches suppression and telegraphed burst threats

Main wave-level intent:

- `Turret` should now read as the first real screen-anchor enemy rather than one more ingredient in a noisy blend
- `Charger` should arrive as a spaced dodge-check escalation, not as casual overlap with every other specialist
- `Sine` should modify the player's routing occasionally, not become ambient filler again
- `2-1` through `2-5` should climb from introduction to layered pressure without jumping straight to Chapter 3 density

Specific authoring changes:

- Added single-`Sine` support beats so the sweeper can appear without forced mirrored pairs
- Reduced multi-`Sine` usage across the chapter to sparse support placements
- Shifted more of the chapter's authored weight onto `Turret` / `Charger` pacing and mixed `Straight` pressure
- Kept swarm usage as occasional chokepoint tempo spikes rather than all-purpose density padding

## Progression Spot Check

Additional verification completed on 2026-06-12:

- `npm test` passed after the Chapter 2 rewrite
- `npm run build` passed after the Chapter 2 rewrite
- In-app browser spot-check completed on `http://127.0.0.1:5173/?invincible=1`

Representative browser pass:

- `2-1` now reads as a clearer transition out of Chapter 1, with `Turret` pressure introduced without immediate specialist pile-on
- `2-3` shows the first stronger specialist layering: the player solves a charger or turret headline while `Sine` occasionally bends the lane answer
- `2-5` is visibly busier than early Chapter 2, but still legible because the support threats are more distinct
- `3-2` remains a clear step up because `Spore` / `Obstacle` interactions create denser spatial obligations than Chapter 2
- Late Chapter 4 samples still read as the endgame escalation because terrain restriction and heavier mixed pressure exceed the Chapter 2 screen states

Current conclusion:

- The 20-level ramp appears to climb steadily enough after the Chapter 2 rewrite
- Chapter 2 no longer stalls by re-asking the Chapter 1 question with extra `Sine` bodies
- The curve also does not currently show an obvious Chapter 2-to-3 or Chapter 3-to-4 spike into unreadable soup in the sampled browser pass
- Full feel-balancing still needs more real play, but the authored structure now looks much closer to the intended campaign ramp

## Next Session Starting Point

Resume here:

1. Continue the same role-based cleanup in Chapter 4, especially where terrain hazards and support enemies overlap
2. Re-check whether any Chapter 3 beats still need micro-timing adjustments after more hands-on play
3. Keep using Chapters 1 through 3 as the baseline readability ladder
4. Treat late-chapter tuning as escalation-by-role, not escalation-by-random-density

## Chapter 3 Wave Rewrite

Updated on 2026-06-12:

- Reworked Chapter 3 wave scripts in [chapter3.ts](/E:/Develop/GitHub/aeon-pulse/src/level/waves/chapter3.ts)
- Removed the old Chapter 3 dependence on repeated `Sine` rows as a backbone
- Promoted `Obstacle` and `Spore` to the main chapter-defining threats
- Kept `Sine` only as occasional support where temporary lane contamination improves a hazard beat

Main wave-level intent:

- `Obstacle` should now read as the first persistent lane-shaping hazard of the campaign, not as set dressing
- `Spore` should become the late-clear / death-burst question that starts defining target priority in Chapter 3
- `Sine` should appear sparingly to bend routes around those hazards, not to fill time between them
- `3-1` through `3-5` should climb from obstacle literacy into spore-and-obstacle layering without collapsing into visual soup

Specific authoring changes:

- Added single-`Sine` support beats and sparse `Sine` + `Obstacle` pairings instead of full `Sine` rows
- Introduced `Straight` + `Spore` support beats so spores interact with ordinary pressure instead of appearing only in mirrored isolation
- Shifted the chapter's authored weight toward obstacle gates, obstacle pairs, spore mirrors, spore triads, and charger/obstacle punctuation
- Removed dead Chapter 3 `Sine` row helper paths after the rewrite

## Chapter 3 Spot Check

Additional verification completed on 2026-06-12:

- `npm test` passed after the Chapter 3 rewrite
- `npm run build` passed after the Chapter 3 rewrite
- In-app browser spot-check completed on `http://127.0.0.1:5173/?invincible=1`

Representative browser pass:

- Early Chapter 3 now reads more clearly as obstacle navigation with supporting enemies rather than as another `Sine` showcase
- Mid Chapter 3 shows spores and obstacles sharing the screen in a way that changes route and target-priority decisions
- Late Chapter 3 remains busier than early Chapter 3, but the pressure reads as layered hazard management rather than generic enemy density

Current conclusion:

- Chapter 3 now feels more like a real escalation from Chapter 2 because the player is solving spatial hazard and death-trigger questions instead of more specialist ships alone
- The chapter remains legible in the sampled browser states because each busy moment still has a clearer dominant read
- Further tuning can now focus on micro-timing and specific harsh beats rather than on structural identity problems

## Sine Redesign Direction

Chosen on 2026-06-12:

- Selected redesign variant: `Sweeper`
- Goal:
  - bring back the wide oscillating projectile identity
  - avoid returning to aimed-shot overlap with `Straight`
  - make `Sine` a projectile-specialist support enemy rather than early filler

First implementation target:

- Increase `EnemySine` HP from `1` to `2`
- Keep the sinusoidal movement path
- Remove aimed shots entirely
- Fire a sweeping `ENEMY_SINE` wave projectile shortly after entering the playfield
- Allow a slower repeat shot only if it survives long enough

Why this direction:

- The memorable part worth saving was the screen-space oscillating projectile
- `Sine` failed in Chapter 1 because it often died before changing the battlefield
- A reliable early sweep shot gives it a reason to exist without turning it back into another generic shooter

Implemented result:

- The sweeper behavior is now live in [EnemySine.ts](/E:/Develop/GitHub/aeon-pulse/src/entities/EnemySine.ts)
- Browser spot-checks show `Sine` getting its sweep shot on screen early enough to matter
- Chapter 1 remains the no-`Sine` baseline while Chapter 2 onward becomes the likely reintroduction path
