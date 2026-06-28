# Enemy Roles

The canonical gameplay-role taxonomy for standard enemies and the per-enemy role assignments used by wave authoring. This is the reference for future balance or wave work, not an in-progress rebalance.

The main pacing concern this taxonomy resolves is role overlap: too many enemies asking the same question (dodge an aimed shot while a ship moves left across the screen while another ship pressures the lane). Before changing wave timing, each enemy needs a clearer primary job.

## Target Role Buckets

Use these as the reference buckets for future balancing:

1. `Baseline shooter` — readable aimed fire that teaches lane discipline
2. `Lane disturber` — movement pattern that bends safe lanes without being the main damage dealer
3. `Hunter` — directly pressures the player's current position
4. `Speed pressure` — compresses space and forces quick local movement
5. `Setpiece threat` — expensive, high-readability event enemy with a strong tell
6. `Death-trigger threat` — weak while alive, dangerous if ignored or killed carelessly
7. `Spatial hazard` — shapes the playfield more than it tests raw dodging

## Per-Enemy Role Assignments

### EnemyStraight — `Baseline shooter`
- Current behavior: moves left at `130`; waits for a fire timer, slows briefly, then fires a two-gun aimed shot; performs a short post-shot lunge.
- What it asks: recognize a pause, nudge out of the aimed lane, re-center quickly after the shot.
- Guard rail: this is the primary early-game aimed-fire teacher. Other enemies that keep aimed fire must do so for a different reason than this unit. Keep close to current behavior.

### EnemySine — `Lane disturber` / projectile sweeper
- Current behavior: moves left at `110`; oscillates vertically with amplitude `35` and frequency `1.2`; `2` HP; fires an early sweeping `ENEMY_SINE` oscillating projectile; may fire a slower repeat sweep shot if it survives long enough.
- What it asks: respect a wide oscillating denial shot, route around contaminated space while other threats stay active.
- Guard rail: the sweeper identity is the whole reason this enemy exists. Keep it out of Chapter 1 (it failed as a baseline early-game enemy). Do not drift back toward generic aimed fire. Reintroduce in later chapters as a sparse support enemy.

### EnemyDiver — `Hunter`
- Current behavior: moves left at `150`; corrects toward player Y using a preserved formation spread; fires aimed shots (`FIRE_INTERVAL` ~`1.9`).
- What it asks: break rhythm and relocate, respect vertical tracking not just horizontal screen flow.
- Guard rail: preserve this as the main reactive anti-player unit. Keep its shot pressure secondary to its tracking identity. Use it when a beat needs forced repositioning rather than general density.

### EnemySwarm — `Speed pressure`
- Current behavior: moves left at `230`; **no aimed firing** (removed); very low HP and score.
- What it asks: react quickly to body pressure.
- Guard rail: its best identity is fast body pressure. Surprise aimed fire from a low-value fast unit added noise, so firing was removed entirely. Use in waves as a tempo spike and screen-compression tool, not as a micro-shooter. Use in clusters, cross-lane offsets, or as support during another stable threat so empty-space appearances still feel threatening.

### EnemyTurret — `Setpiece threat`
- Current behavior: moves left at `120`; tracks the player; charges for `0.8s`; fires a 3-shot high-speed volley.
- What it asks: read a charge tell, avoid line-of-fire occupation for an extended window, respect repeated follow-up shots.
- Guard rail: strong identity, but high cognitive load. Avoid mixing many of these with hunters or chargers in the same beat. Use sparingly as a local objective that temporarily defines the screen.

### EnemyCharger — `Setpiece threat`
- Current behavior: enters normally; locks with a visible warning laser for `1.0s`; then dashes at `700` with some homing before freezing.
- What it asks: notice the warning, predict the lane of attack, vacate that lane cleanly before the rush.
- Guard rail: preserve the telegraph-heavy charge identity. Keep count low and spacing generous. Do not stack casually with turret volleys or dense diver packs.

### EnemySpore — `Death-trigger threat`
- Current behavior: drifts slowly with minor vertical variance; `4` HP; on death, emits 4 homing projectiles.
- What it asks: decide whether to kill it now, later, or route around the death burst.
- Guard rail: keep the death payload as the main identity. Pair with spatial constraints or other enemies that make the death burst matter. Do not also turn it into a major shooter — that collapses its identity.

### Obstacle — `Spatial hazard`
- Current behavior: large durable body (`25` HP); scrolls left steadily.
- What it asks: route early, spend fire time if a lane must be opened.
- Guard rail: keep behavior simple. Use with `Straight`, `Sine`, or `Spore`, where it changes the answer to otherwise familiar problems.

### RockDrake — `Setpiece threat`
- Current behavior: slides in, stops, clings for `1.5s`; fires a 5-shot lava burst; then charges.
- What it asks: reposition during the cling, read a spread burst, handle a follow-up body rush.
- Guard rail: too behaviorally rich to be treated like ordinary wave filler. Preserve behavior identity. Reserve for terrain chapters and punctuation beats. Build surrounding waves to frame it rather than drown it in noise.

### Stalactite — `Spatial hazard`
- Current behavior: hangs from terrain; starts shaking when player approaches; falls, shatters, and spawns lava shots upward-left.
- What it asks: respect space ahead, read terrain-linked warning states, avoid over-committing to a lane beneath it.
- Guard rail: preserve current identity. Use as a chapter-specific rhythm change, especially where terrain already narrows the playfield. Like `RockDrake`, loses clarity if packed into already-busy beats.

## Behavior vs Wave Responsibility

Behavior changes belong to the entity; density and pacing belong to the wave grammar. Keep the split explicit:

- **Behavior-owned:** each enemy's movement, fire cadence, telegraph, death payload, HP. Changes here ripple across every chapter that uses the enemy.
- **Wave-owned:** which enemy appears on which beat, at what density, in what combination, with what spacing. Changes here are chapter-local.

### Wave-design rules that follow from the taxonomy

- A beat should usually test one main thing and one support thing, not three equal things.
- `Straight` should teach and confirm.
- `Sine` should bend space around another threat.
- `Diver` should force relocation during otherwise stable beats.
- `Swarm` should spike tempo and compress space.
- `Turret`, `Charger`, `RockDrake`, and `Stalactite` should each temporarily become the local headline threat.
