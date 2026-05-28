# ADR 0002 — Difficulty Modes and Shield Mechanic

**Status:** Accepted  
**Date:** 2026-05-23

## Context

The game currently has a single difficulty: any hit causes an instant life loss and a weapon tier drop. This is appropriate for experienced shmup players but is too punishing for newcomers. ADR 0001 scoped out a shield/HP buffer mechanic; this ADR designs it.

## Decisions

### 1. Three named difficulty modes: Rookie / Pilot / Ace

Modes are chosen on the title screen via a MODE selector in the existing selector row (alongside Stage and Weapon Tier). Three modes rather than two gives a clear gradient; thematic names avoid the "Easy = embarrassing" framing of plain-language labels.

- **Rookie** — shield + no weapon-tier penalty ever. For players who want to focus on learning movement and patterns.
- **Pilot** — single-pip shield + tier drop on unshielded hits. Safety net for one mistake; still punishes sustained sloppiness.
- **Ace** — no shield; current rules unchanged. The purist experience.

### 2. Shield mechanic (Rookie and Pilot only)

A shield is a separate buffer that absorbs hits before lives are affected. Key properties:

| Property | Rookie | Pilot |
|---|---|---|
| Shield pips | 2 | 1 |
| Regen time | 4s | 7s |
| Regen style | All-at-once | All-at-once |
| Regen timer | Resets on each hit | Resets on each hit |
| Tier drop on shielded hit | Never | Never |
| Tier drop on unshielded hit | Never | Yes (−1, same as Ace) |
| Shield at level start | Full | Full |

A shielded hit costs one shield pip and nothing else — no life lost, no tier dropped. When the shield is depleted, the next hit behaves like an Ace hit for that mode (life lost; tier dropped in Pilot, not in Rookie).

Regen starts after the last hit and resets on any new hit, encouraging the player to find safety before recovering.

### 3. Shield absorbs everything on a shielded hit

The alternatives were: shield absorbs life only (tier still drops) or shield absorbs both. "Absorbs everything" was chosen for Rookie because split consequences (shield down + tier drop) add cognitive load that contradicts the mode's purpose. Pilot's tier-drop-on-unshielded-hit provides differentiation without complicating the shielded-hit case.

### 4. Separate leaderboards per mode

Each mode has its own localStorage key:

- `aeon-pulse-scores-rookie`
- `aeon-pulse-scores-pilot`
- `aeon-pulse-scores-ace`

Score multipliers were rejected — "your score doesn't count fully" feels punishing. Unified leaderboards were rejected — a Rookie score and an Ace score are not comparable.

### 5. Visual representation

**Ship:** A translucent emissive aura mesh around the player ship, visible when shield is active. Flickers on a shielded hit; disappears entirely when depleted. No aura in Ace mode.

**HUD:** Shield pips rendered alongside the lives display (2 pips for Rookie, 1 for Pilot). A regen progress indicator shows the countdown to shield restore. No mode label displayed during play — the presence or absence of shield pips is the implicit mode indicator.

### 6. No mode indicator in HUD

The shield pips (or their absence) already signal which mode the player is in. A redundant text label clutters the HUD.

## Consequences

- Rookie players can learn patterns without the game collapsing after two mistakes.
- Pilot mode preserves meaningful tension — the shield buys one reprieve, not immunity.
- Ace mode is completely unchanged; no existing behavior is disrupted.
- Each mode's leaderboard starts empty; no cross-mode score inheritance.
- If enemy bullet damage values are ever made meaningful (see ADR 0001 §7), the shield mechanic will need to decide whether it absorbs damage-without-life-loss or only life-loss hits — that design is deferred.
