# Render Baseline

Cross-chapter render snapshot. Replace this file in full on each new measurement run.
Do not edit manually — numbers come from `scripts/run-profiler.mjs`.

**Measured:** 2026-06-12  
**Tool:** `node scripts/run-profiler.mjs`  
**Browser:** Headless Edge 149 (Hardware GPU WebGL)  
**Scenarios:** Level 4 of each chapter (dense non-finale), no-fire + tier-5 tap-fire forced  
**Sample counts:** 30 samples per no-fire scenario, 45 per tap-fire scenario

---

## Summary Table

| Scenario | Avg calls | Max calls | Avg FPS | Min FPS (Lows) | Max objects | Top category (max units) |
|---|:---:|:---:|:---:|:---:|:---:|:---|
| **L1-4 no-fire** | 78 | 106 | 75 | 71 | 92 | enemy 63 |
| **L1-4 tier5 tap-fire** | 74 | 92 | 75 | 75 | 83 | bullet 34, enemy 26 |
| **L2-4 no-fire** | 77 | 108 | 75 | 75 | 85 | enemy 52 |
| **L2-4 tier5 tap-fire** | 80 | 98 | 75 | 75 | 91 | bullet 36, enemy 31 |
| **L3-4 no-fire** | 72 | 100 | 75 | 74 | 77 | enemy 45 |
| **L3-4 tier5 tap-fire** | 78 | 91 | 75 | 74 | 80 | bullet 35, enemy 21 |
| **L4-4 no-fire** | 81 | 118 | 75 | 75 | 110 | enemy 80 |
| **L4-4 tier5 tap-fire** | 79 | 106 | 75 | 75 | 109 | enemy 47, bullet 41 |

---

## Chapter 1 — The Outer Array (Megastructure)

### L1-4 no-fire

```
calls   avg 78  max 106
fps     avg 75  max 76  (min 71)
objects avg 65  max 92
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 63 |
| background | 21 |
| bullet | 6 |
| player | 3 |
| uncategorized | 3 |
| effect | 1 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 36 |
| enemy.swarm | 16 |
| enemy.sine | 15 |
| enemy.diver | 12 |
| background.arch | 5 |
| background.tower | 4 |
| background.dust | 4 |
| background.pipe | 3 |
| background.spire | 2 |
| background.ring | 2 |
| background.nebula | 1 |

### L1-4 tier5 tap-fire

```
calls   avg 74  max 92
fps     avg 75  max 76  (min 75)
objects avg 65  max 83
bullets avg 31  max 38  (render units avg 49 max 57)
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| bullet | 34 |
| enemy | 26 |
| background | 21 |
| player | 3 |
| effect | 2 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 15 |
| enemy.swarm | 14 |
| enemy.diver | 12 |
| enemy.sine | 6 |
| background.arch | 5 |
| background.tower | 4 |
| background.dust | 4 |
| background.pipe | 3 |
| background.spire | 2 |
| background.ring | 2 |
| background.nebula | 1 |

**Max bullet sources (render units):**

| Source | Max bullets | Max render units |
|---|:---:|:---:|
| player | 20 | 40 |
| enemy | 11 | 11 |
| playerWave | 10 | 10 |
| enemySwarm | 4 | 4 |
| enemySine | 2 | 2 |

---

## Chapter 2 — Iron Vein (Industrial)

### L2-4 no-fire

```
calls   avg 77  max 108
fps     avg 75  max 76  (min 75)
objects avg 65  max 85
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 52 |
| background | 17 |
| bullet | 8 |
| terrain | 5 |
| player | 3 |
| effect | 1 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 30 |
| enemy.charger | 17 |
| enemy.sine | 12 |
| enemy.turret | 10 |
| enemy.swarm | 8 |
| background.turbine | 4 |
| background.spark | 4 |
| background.column | 3 |
| background.pipe | 3 |
| terrain.panel | 3 |
| background.gear | 2 |
| terrain.pillar | 2 |
| background.backdrop | 1 |

### L2-4 tier5 tap-fire

```
calls   avg 80  max 98
fps     avg 75  max 76  (min 75)
objects avg 72  max 91
bullets avg 30  max 37  (render units avg 48 max 59)
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| bullet | 36 |
| enemy | 31 |
| background | 17 |
| uncategorized | 9 |
| terrain | 5 |
| player | 3 |
| effect | 2 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 18 |
| enemy.turret | 10 |
| enemy.charger | 8 |
| enemy.sine | 6 |
| background.turbine | 4 |
| background.spark | 4 |
| background.column | 3 |
| background.pipe | 3 |
| terrain.panel | 3 |
| background.gear | 2 |
| terrain.pillar | 2 |
| enemy.swarm | 2 |
| background.backdrop | 1 |

**Max bullet sources (render units):**

| Source | Max bullets | Max render units |
|---|:---:|:---:|
| player | 20 | 40 |
| playerWave | 9 | 9 |
| enemy | 8 | 8 |
| bossLaser | 3 | 6 |
| enemySine | 2 | 2 |

---

## Chapter 3 — Hive Womb (Hive)

### L3-4 no-fire

```
calls   avg 72  max 100
fps     avg 75  max 76  (min 74)
objects avg 59  max 77
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 45 |
| background | 17 |
| terrain | 7 |
| bullet | 5 |
| player | 3 |
| effect | 1 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 21 |
| enemy.sine | 15 |
| enemy.charger | 15 |
| enemy.obstacle | 9 |
| background.womb | 4 |
| background.spore | 4 |
| terrain.panel | 4 |
| enemy.spore | 4 |
| background.vein | 3 |
| background.pod | 3 |
| terrain.spike | 3 |
| background.column | 2 |
| enemy.swarm | 2 |
| background.backdrop | 1 |

### L3-4 tier5 tap-fire

```
calls   avg 78  max 91
fps     avg 75  max 76  (min 74)
objects avg 69  max 80
bullets avg 30  max 39  (render units avg 61 max 109)
```

> **Note:** Homing missiles (`homing` source) dominate render units at **max 70** despite only 10 active missiles. Each homing missile currently costs ~7 render units (70 / 10). This is the most significant per-unit overhead visible in this baseline.

**Max category ownership:**

| Category | Max units |
|---|:---:|
| bullet | 35 |
| enemy | 21 |
| background | 17 |
| terrain | 7 |
| player | 3 |
| uncategorized | 3 |
| effect | 2 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 12 |
| enemy.sine | 9 |
| enemy.charger | 7 |
| enemy.obstacle | 6 |
| enemy.spore | 6 |
| background.womb | 4 |
| background.spore | 4 |
| terrain.panel | 4 |
| background.vein | 3 |
| background.pod | 3 |
| terrain.spike | 3 |
| background.column | 2 |
| enemy.swarm | 2 |
| background.backdrop | 1 |

**Max bullet sources (render units):**

| Source | Max bullets | Max render units |
|---|:---:|:---:|
| homing | 10 | 70 |
| player | 20 | 40 |
| playerWave | 9 | 9 |
| enemySine | 5 | 5 |
| enemy | 4 | 4 |
| enemySwarm | 1 | 1 |

---

## Chapter 4 — Cinder Core (Volcanic)

### L4-4 no-fire

```
calls   avg 81  max 118
fps     avg 75  max 76  (min 75)
objects avg 72  max 110
```

> Chapter 4 carries the widest enemy set. `enemy` dominates at **max 80 units** — roughly 7–8× the background cost. Following optimizations to cache procedural resources and maintain a constant PointLight count, FPS remains completely stable with a minimum of 75 FPS throughout peak frames.

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 80 |
| bullet | 15 |
| background | 11 |
| terrain | 5 |
| player | 3 |
| effect | 3 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.sine | 24 |
| enemy.straight | 24 |
| enemy.turret | 20 |
| enemy.diver | 18 |
| enemy.rockDrake | 16 |
| enemy.stalactite | 15 |
| enemy.charger | 8 |
| background.geyser | 4 |
| background.spire | 2 |
| background.rockPlate | 2 |
| terrain.column | 2 |
| terrain.backing | 2 |
| enemy.swarm | 2 |
| background.backdrop | 1 |
| background.geyserParticle | 1 |
| background.ember | 1 |
| terrain.debris | 1 |

### L4-4 tier5 tap-fire

```
calls   avg 79  max 106
fps     avg 75  max 76  (min 75)
objects avg 74  max 109
bullets avg 30  max 38  (render units avg 49 max 63)
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 47 |
| bullet | 41 |
| background | 11 |
| terrain | 5 |
| player | 3 |
| uncategorized | 3 |
| effect | 2 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.turret | 22 |
| enemy.stalactite | 20 |
| enemy.sine | 18 |
| enemy.straight | 18 |
| enemy.rockDrake | 16 |
| enemy.diver | 12 |
| enemy.charger | 8 |
| background.geyser | 4 |
| background.spire | 2 |
| background.rockPlate | 2 |
| terrain.column | 2 |
| terrain.backing | 2 |
| enemy.swarm | 2 |
| background.backdrop | 1 |
| background.geyserParticle | 1 |
| background.ember | 1 |
| terrain.debris | 1 |

**Max bullet sources (render units):**

| Source | Max bullets | Max render units |
|---|:---:|:---:|
| player | 20 | 40 |
| bossLaser | 6 | 12 |
| playerWave | 10 | 10 |
| lava | 5 | 10 |
| enemySine | 4 | 4 |
| enemy | 4 | 4 |

---

## Cross-Chapter Observations

- **All chapters are enemy-bound**, not background- or terrain-bound. The prior background instancing work has been effective — background max ownership is 21 (Ch1), 17 (Ch2/3), 11 (Ch4).
- **FPS lows are completely resolved** across all chapters, with the minimum recorded framerate now locked at **71 FPS** or above (stable around 75 FPS throughout), compared to baseline drops as low as 33–34 FPS.
- **Bullet rendering is well-controlled** in Chapters 1/2/4. Chapter 3 homing missiles are the standout outlier (~7 render units per missile vs ~2 for other projectile types).
- **Uncategorized objects** appear in tier5 scenarios (max 9 in Ch2, max 3 in Ch3/Ch4) — these are meshes not yet tagged with a `RenderCategory` and should be investigated.
- The next optimization target across all chapters is most likely `enemy.*` draw call consolidation or the homing missile render unit cost in Chapter 3.
