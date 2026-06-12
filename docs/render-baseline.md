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

| Scenario | Avg calls | Max calls | Avg FPS | Max objects | Top category (max units) |
|---|:---:|:---:|:---:|:---:|:---|
| **L1-4 no-fire** | 77 | 105 | 73 | 89 | enemy 60 |
| **L1-4 tier5 tap-fire** | 78 | 98 | 75 | 90 | bullet 33, enemy 26 |
| **L2-4 no-fire** | 75 | 103 | 75 | 81 | enemy 49 |
| **L2-4 tier5 tap-fire** | 83 | 105 | 75 | 99 | bullet 36, enemy 28 |
| **L3-4 no-fire** | 72 | 94 | 75 | 79 | enemy 47 |
| **L3-4 tier5 tap-fire** | 79 | 95 | 75 | 86 | bullet 35, enemy 24 |
| **L4-4 no-fire** | 82 | 120 | 72 | 113 | enemy 83 |
| **L4-4 tier5 tap-fire** | 84 | 116 | 74 | 111 | enemy 47, bullet 43 |

---

## Chapter 1 — The Outer Array (Megastructure)

### L1-4 no-fire

```
calls   avg 77  max 105
fps     avg 73  max 76
objects avg 63  max 89
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 60 |
| background | 21 |
| bullet | 6 |
| player | 3 |
| effect | 1 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 42 |
| enemy.swarm | 16 |
| enemy.diver | 12 |
| enemy.sine | 6 |
| background.arch | 5 |
| background.tower | 4 |
| background.dust | 4 |
| background.pipe | 3 |
| background.spire | 2 |
| background.ring | 2 |
| background.nebula | 1 |

### L1-4 tier5 tap-fire

```
calls   avg 78  max 98
fps     avg 75  max 76
objects avg 69  max 90
bullets avg 31  max 39  (render units avg 49 max 59)
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| bullet | 33 |
| enemy | 26 |
| background | 21 |
| uncategorized | 6 |
| player | 3 |
| effect | 3 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 18 |
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
| enemySine | 3 | 3 |

---

## Chapter 2 — Iron Vein (Industrial)

### L2-4 no-fire

```
calls   avg 75  max 103
fps     avg 75  max 76
objects avg 63  max 81
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 49 |
| background | 17 |
| bullet | 8 |
| terrain | 5 |
| player | 3 |
| effect | 1 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 30 |
| enemy.charger | 16 |
| enemy.sine | 12 |
| enemy.turret | 10 |
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
calls   avg 83  max 105
fps     avg 75  max 76
objects avg 75  max 99
bullets avg 30  max 38  (render units avg 49 max 60)
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| bullet | 36 |
| enemy | 28 |
| background | 17 |
| uncategorized | 12 |
| terrain | 5 |
| player | 3 |
| effect | 2 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 15 |
| enemy.turret | 10 |
| enemy.sine | 9 |
| enemy.charger | 8 |
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
| playerWave | 10 | 10 |
| enemy | 8 | 8 |
| bossLaser | 3 | 6 |
| enemySine | 3 | 3 |

---

## Chapter 3 — Hive Womb (Hive)

### L3-4 no-fire

```
calls   avg 72  max 94
fps     avg 75  max 76  (min 66 — terrain-heavy frames)
objects avg 60  max 79
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 47 |
| background | 17 |
| terrain | 7 |
| bullet | 5 |
| player | 3 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 18 |
| enemy.charger | 17 |
| enemy.sine | 12 |
| enemy.obstacle | 9 |
| background.womb | 4 |
| background.spore | 4 |
| terrain.panel | 4 |
| enemy.swarm | 4 |
| enemy.spore | 4 |
| background.vein | 3 |
| background.pod | 3 |
| terrain.spike | 3 |
| background.column | 2 |
| background.backdrop | 1 |

### L3-4 tier5 tap-fire

```
calls   avg 79  max 95
fps     avg 75  max 76  (min 73)
objects avg 71  max 86
bullets avg 29  max 37  (render units avg 54 max 114)
```

> **Note:** Homing missiles (`homing` source) dominate render units at **max 77** despite only 11 active missiles. Each homing missile currently costs ~7 render units (77 / 11). This is the most significant per-unit overhead visible in this baseline.

**Max category ownership:**

| Category | Max units |
|---|:---:|
| bullet | 35 |
| enemy | 24 |
| background | 17 |
| terrain | 7 |
| player | 3 |
| uncategorized | 3 |
| effect | 1 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.straight | 15 |
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
| homing | 11 | 77 |
| player | 20 | 40 |
| playerWave | 10 | 10 |
| enemy | 8 | 8 |
| enemySine | 4 | 4 |
| enemySwarm | 1 | 1 |

---

## Chapter 4 — Cinder Core (Volcanic)

### L4-4 no-fire

```
calls   avg 82  max 120
fps     avg 72  max 76  (min 34 — heaviest terrain + enemy load)
objects avg 71  max 113
```

> Chapter 4 carries the widest enemy set. `enemy` dominates at **max 83 units** — roughly 7–8× the background cost. FPS dips to 34 on peak frames, driven by terrain geometry and the full enemy mix (stalactites, rock drakes, divers, sine, turrets).

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 83 |
| bullet | 13 |
| background | 11 |
| terrain | 5 |
| player | 3 |
| effect | 1 |

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
| background.backdrop | 1 |
| background.geyserParticle | 1 |
| background.ember | 1 |
| terrain.debris | 1 |

### L4-4 tier5 tap-fire

```
calls   avg 84  max 116
fps     avg 74  max 76  (min 33)
objects avg 82  max 111
bullets avg 31  max 39  (render units avg 50 max 65)
```

**Max category ownership:**

| Category | Max units |
|---|:---:|
| enemy | 47 |
| bullet | 43 |
| background | 11 |
| uncategorized | 6 |
| terrain | 5 |
| player | 3 |
| effect | 3 |

**Top detail owners:**

| Detail | Max units |
|---|:---:|
| enemy.stalactite | 20 |
| enemy.turret | 20 |
| enemy.sine | 18 |
| enemy.straight | 18 |
| enemy.rockDrake | 16 |
| enemy.charger | 14 |
| enemy.diver | 12 |
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
| player | 22 | 44 |
| bossLaser | 6 | 12 |
| playerWave | 11 | 11 |
| lava | 5 | 10 |
| enemy | 6 | 6 |
| enemySine | 4 | 4 |

---

## Cross-Chapter Observations

- **All chapters are enemy-bound**, not background- or terrain-bound. The prior background instancing work has been effective — background max ownership is 21 (Ch1), 17 (Ch2/3), 11 (Ch4).
- **Chapter 4 is the hardest chapter** for the renderer in no-fire scenarios (avg 82 calls, min FPS 34), driven by its full enemy mix including rock drakes and stalactites.
- **Bullet rendering is well-controlled** in Chapters 1/2/4. Chapter 3 homing missiles are the standout outlier (~7 render units per missile vs ~2 for other projectile types).
- **Uncategorized objects** appear in all tier5 scenarios (max 6 in Ch1, max 12 in Ch2, max 3 in Ch3, max 6 in Ch4) — these are meshes not yet tagged with a `RenderCategory` and should be investigated.
- The next optimization target across all chapters is most likely `enemy.*` draw call consolidation or the homing missile render unit cost in Chapter 3.
