# ADR 0001 — Game Balance Principles

**Status:** Accepted  
**Date:** 2026-05-23

## Context

The game has a campaign of four chapters, five weapon tiers earned through powerup drops, and three lives. The original balance pass was written against a four-stage campaign; the campaign model now treats those four playable encounters as the initial chapter finales (`1-5`, `2-5`, `3-5`, and `4-5`). Before this ADR, balance was ad hoc: boss HP barely scaled (50 → 55 → 80 → 150), the hit penalty was steep (-2 tiers), and several late-game enemies dropped nothing. The result was an uneven difficulty curve and a punishing recovery loop.

## Decisions

### 1. Hit penalty: -1 weapon tier (was -2)

Each hit drops the player's weapon tier by 1 instead of 2. This makes recovery realistic — one drop restores the tier — without removing the penalty entirely. The alternative (-2) was retained for late-game feel but proved too punishing when late enemies drop less frequently.

### 2. Target weapon tier at each chapter finale

Average player (1–2 deaths per chapter) should arrive at each chapter finale boss at:

| Chapter finale | Target tier |
|----------------|-------------|
| 1-5            | 2–3         |
| 2-5            | 3           |
| 3-5            | 3–4         |
| 4-5            | 4–5         |

Skilled players arrive higher; struggling players lower. The drop economy and hit penalty are calibrated around this average, not the extremes.

### 3. Drop rates: fixed per enemy type, not per level

Drop chances are properties of enemy types, not level configurations. Level difficulty scales through enemy *composition* (harder types introduced across the campaign) rather than drop rate modifiers. The expanded chapter campaign has longer levels and higher enemy density than the original four-stage prototype, so fixed per-enemy drop rates are lower than the prototype values.

- `EnemyStraight`: **7%**
- `EnemySine`: **6%**
- `EnemyDiver`: **7%**
- `EnemyTurret`: **7%**
- `EnemySpore`: **6%**
- `EnemyCharger`: **5%**
- `RockDrake`: **6%**

Swarm, Stalactite, and Obstacle remain at 0%.

### 4. Finale boss defeat grants +1 life (capped at MAX_LIVES)

Defeating a finale boss restores one life up to the maximum (3). This gives players who struggled through a chapter a cushion before the next. The reward is unconditional — it does not require a no-death run (that would be a score bonus, not a life bonus). Non-finale levels do not grant boss life rewards in the current campaign model.

### 5. Boss HP scaled to maintain consistent time-to-kill

Boss HP is calibrated so that a player at the expected weapon tier spends roughly the same effective time killing each finale boss. Attack patterns — not HP — are the primary difficulty axis. Phase transitions scale proportionally.

| Boss | Old HP | New HP |
|------|--------|--------|
| Boss 1 (1-5) | 50 | **45** |
| Boss 2 (2-5) | 55 | **75** |
| Boss 3 (3-5) | 80 | **100** |
| Boss 4 (4-5) | 150 (30+30+90) | unchanged |

Constraint: no later boss may ever feel easier than an earlier one.

### 6. Boss 1 phase restructure

The homing attack in Phase 2 was identified as too threatening for a first-stage boss. Restructured:

- **Phase 1** (>67% HP): 3-bullet spread, 2.0s interval, speed 175 — unchanged
- **Phase 2** (33–67% HP): 3-bullet spread, 1.5s interval, speed 225 + single aimed shot (non-tracking, ~2.8s interval, speed ~160)
- **Phase 3** (<33% HP): 5-bullet spread, 0.95s interval, speed 265 + homing (replaces circular burst)

### 7. Shield/HP buffer mechanic: scoped out

Enemy bullet damage is currently irrelevant because any hit causes instant life loss. A shield or HP buffer mechanic would make damage values meaningful but is a significant feature requiring its own balance surface. Deferred to a future pass.

## Consequences

- Recovery after a hit feels fair rather than punishing.
- Late-stage enemies (Charger, RockDrake) are worth engaging aggressively.
- Finale boss fights have a predictable feel regardless of which chapter they appear in.
- Boss 1 now has a clear three-act structure with each phase introducing exactly one new threat.
- If a shield mechanic is added later, enemy bullet damage values will need revisiting alongside it.
