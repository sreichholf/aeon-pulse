# ADR 0037 — Chapter-Scaled Enemy Durability and Armor

**Status:** Accepted  
**Date:** 2026-06-28

## Context

ADR 0018 addressed the symptom "the game felt too easy on higher weapon levels" via tap-fire pierce limits and timeline compression. After that pass, the symptom persisted for a measurable reason: the durability ceiling of standard enemies (4 HP on `EnemySpore`/`RockDrake`, 1 HP on the popcorn roster) is below the per-tap damage floor of Tier 3+ weapons. A T5 Plasma tap deals 4 damage (plasma semi-pierce 2 + two side bullets), one-tapping every standard enemy of 4 HP or less. No amount of composition density fixes that; the player simply melts more bodies per second.

ADR 0001 §7 explicitly scoped out a shield/HP-buffer mechanic, and the Chapter Progression amendment says escalation should come "primarily from enemy composition, pattern layering, terrain pressure, and authored pacing." This ADR authorizes a **secondary durability axis** layered on top of composition, and reintroduces a scoped-out absorb mechanic on the enemy side. Both are deliberate reversals, made because composition alone proved insufficient against the high-tier per-tap overkill.

This change ships alongside a one-time weapon-coverage rebalance (T3 Spread / T5 Plasma spread narrowed from ~±20° to ±15° half-angle) that forces re-aiming without changing single-target TTK. That rebalance is easily reversible tuning and is not part of this ADR; it lives in code and test fixtures.

## Decisions

### 1. Flat HP additions per chapter, not multipliers

Standard enemy HP gains a flat bonus keyed to chapter:

| Chapter | HP addition |
|---|---|
| 1 | +0 (Chapter 1 stays the power-fantasy ramp per ADR 0001 §1) |
| 2 | +1 |
| 3 | +2 |
| 4 | +3 |

Flat additions were chosen over multipliers because the per-tier math table proved multipliers do not change hit-count for the 1-HP roster at T2+: `1 × 2.0 = 2` still dies in one T2+ tap. Flat additions cross integer thresholds for the low-HP roster where multipliers silently round away.

**Armor and HP do not stack on the same enemy.** Armored enemies (see §2) skip the HP bonus and get Armor only; the HP bonus applies solely to non-armored standard enemies. This avoids a 3-tap kill on volume popcorn (Armor + HP bonus stacked made each Swarm/Straight a 3-tap kill, which surfaced as "too hard" in Chapter 2 playtesting — the intended minimum after Armor is 2 taps).

### 2. Armor: a chapter-gated absorb layer on the low-HP roster

Standard enemies of 1 HP and 2 HP (`EnemyStraight`, `EnemySwarm`, `EnemyCharger`, `Stalactite`, `EnemySine`, `EnemyDiver`) gain **Armor** from Chapter 2 onward. Turret/Spore/RockDrake (3-4 HP) do not need Armor; HP scaling alone shifts them off the one-tap floor.

Armor is **distinct from the player Shield** (ADR 0002): same family of mechanic (absorb a hit), different owner, different regen policy, different glossary term.

### 3. Armor absorbs the entire first hit, then breaks

Armor mirrors ADR 0002 §2's player-shield rule: a shielded hit costs one Armor pip and nothing else — no HP lost. After absorption, Armor is gone and does not regenerate. This makes the minimum tap count to kill an armored low-HP enemy equal to 2 at any weapon tier.

Rejected alternatives, with the math that killed them:
- **Damage cap per hit** (e.g., max 2 dmg/hit): cannot help a 1-HP enemy survive any tap unless paired with universal HP additions that break the popcorn identity.
- **Flat damage reduction** (e.g., −1 dmg/hit): same failure on 1-HP enemies.

### 4. Smart Bomb bypasses Armor

A Smart Bomb is a screen-nuke; armored enemies caught in its area simply die. Treating Armor as an exception would make Chapter 4 + low weapon tier + bomb stock accidentally harder, contradicting the bomb's cleansing identity.

### 5. Bosses are excluded from both HP scaling and Armor

ADR 0001 §5 is explicit that boss time-to-kill is the calibrated invariant. Boss escalation stays pattern-based per existing doctrine. The spread narrowing already reflowed boss TTK slightly by reducing per-second hit chance; piling boss HP changes on top in the same pass would conflate two variables.

### 6. Armor visual: persistent tint via instance color, not an aura mesh

Armored enemies carry a persistent amber tint (`0xff8844`) applied through the Enemy Instancer's `setColorAt` channel (ADR 0021), and a bright amber break-flash (`0xffdd88`, 0.15s) on absorption that reuses the existing `_flash()` infrastructure, restoring to the unshielded color on completion.

An aura-mesh visual (the doctrinal match to ADR 0002 §5's player-shield aura) was rejected because the armored roster overlaps the instanced popcorn set (`EnemyStraight`, `EnemySwarm`, `EnemySine`, `EnemyDiver`), and a per-enemy aura mesh would either add up to ~20 draw calls at the L4-4 peak (currently 114) or require a new per-instance-matrix-mutation use case in the Enemy Instancer. The tint rides the existing, ADR-0021-blessed `setColorAt` path at zero draw-call cost.

## Consequences

- Chapter 1 is unchanged; the documented power-fantasy ramp is preserved.
- From Chapter 2, low-HP popcorn requires at least two taps at any weapon tier, and mid-HP enemies survive one T5 tap. The high-tier "screen wiper" feel is reduced by both the durability floor and the companion spread narrowing.
- Boss-summoned adds inherit the player's current chapter multiplier and Armor gating because they route through the same gameplay-context spawn path; they are not special-cased.
- The Tactical Database viewer and boot-time RenderWarmup are unaffected: HP scaling and Armor apply only in `presentationContext === 'gameplay'`.
- ADR 0001 §7's deferral of a shield/HP-buffer mechanic is superseded for the enemy side by this ADR. The player-side deferral stands; player Shield is already designed by ADR 0002 and is a different mechanic.
- If future balance work raises the durability floor further, the flat-addition table and the Armor roster should be revised together; widening Armor to the mid-HP roster would require re-checking whether HP scaling alone could handle those types instead.
