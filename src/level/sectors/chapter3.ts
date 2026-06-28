import { PropType } from '../../types.ts';
import type { PropSpawnEntry, SectorDefinition, SectorTerrainPoint } from './Sectors.ts';

// Chapter 3 — Hive ("Hive Womb") organic Sectors.
//
// Terrain control points are authored at the same raw scroll scale as Chapter 2;
// Levels.ts applies `at * 0.65` when constructing Terrain3. Each Sector carries
// its own control-point set so the chapter levels read as distinct places.
//
// Prop layouts are scroll-anchored (`at` is absolute scrollX; `x`,`y` is the
// initial playfield position, then the prop scrolls left). Per plan.md, props
// are introduced progressively and the finale Sector combines all three kinds.

const spore = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.SPORE_POD, x, y });
const egg = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.EGG_SAC, x, y });
const bulb = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.HIVE_BULB, x, y });
const bone = (at: number, x: number, y: number, burstWindow?: number): PropSpawnEntry =>
  ({ at, propType: PropType.BONE_DAM, x, y, burstWindow });

const pts = (rows: Array<[number, number, number]>): readonly SectorTerrainPoint[] =>
  rows.map(([at, top, bottom]) => ({ at, top, bottom }));

export const CHAPTER_3_SECTORS: Record<string, SectorDefinition> = {
  outerMembrane: {
    sectorKey: 'outerMembrane',
    backgroundConfig: { sectorKey: 'outerMembrane' },
    playfieldMargins: { top: -18, bottom: -18 },
    // Open organic entry: wide, gently undulating membrane walls.
    terrainPoints: pts([
      [0, 220, -220],
      [900, 215, -215],
      [1800, 225, -225],
      [2700, 210, -210],
      [3600, 222, -218],
      [4500, 212, -212],
      [5400, 226, -220],
      [6200, 210, -206],
      [7300, 215, -215],
    ]),
    // Spore Pod intro.
    propLayout: [
      spore(1400, 505, 120),
      spore(3600, 505, -100),
      spore(5800, 505, 80),
    ],
  },

  gullet: {
    sectorKey: 'gullet',
    backgroundConfig: { sectorKey: 'gullet' },
    playfieldMargins: { top: 18, bottom: 18 },
    // Narrow, rhythmic: periodic squeezes that evoke a pulsing gullet.
    terrainPoints: pts([
      [0, 215, -215],
      [750, 175, -175],
      [1500, 215, -215],
      [2250, 170, -170],
      [3000, 218, -218],
      [3750, 165, -165],
      [4500, 220, -220],
      [5250, 172, -172],
      [6150, 210, -210],
      [7300, 160, -160],
    ]),
    // Egg Sac intro — the "restraint" prop.
    propLayout: [
      egg(1300, 505, -80),
      egg(2900, 505, 100),
      egg(4600, 505, -110),
      egg(6200, 505, 60),
    ],
  },

  nursery: {
    sectorKey: 'nursery',
    backgroundConfig: { sectorKey: 'nursery' },
    playfieldMargins: { top: 20, bottom: 20 },
    // Tight: consistently narrow corridor through dense egg clusters.
    terrainPoints: pts([
      [0, 195, -195],
      [650, 165, -165],
      [1300, 150, -150],
      [2000, 180, -160],
      [2700, 140, -140],
      [3500, 175, -155],
      [4300, 138, -138],
      [5100, 170, -150],
      [5900, 135, -135],
      [6600, 165, -145],
      [7300, 130, -130],
    ]),
    // Spore Pod + Egg Sac stress; Bone Dam (solid) introduced.
    propLayout: [
      spore(1200, 505, 130),
      egg(2100, 505, -90),
      spore(3300, 505, 80),
      bone(4500, 505, -110),
      egg(5800, 505, 60),
    ],
  },

  capillaryJunction: {
    sectorKey: 'capillaryJunction',
    backgroundConfig: { sectorKey: 'capillaryJunction' },
    // Broken alternating: top and bottom walls swap which side is squeezed.
    terrainPoints: pts([
      [0, 220, -220],
      [800, 180, -215],
      [1600, 220, -150],
      [2400, 160, -210],
      [3200, 225, -165],
      [4000, 155, -220],
      [4800, 215, -155],
      [5600, 170, -210],
      [6400, 220, -165],
      [7300, 160, -200],
    ]),
    // Hive Bulb intro.
    propLayout: [
      bulb(1600, 505, 110),
      bulb(3600, 505, -70),
      bulb(5600, 505, 90),
    ],
  },

  wombCore: {
    sectorKey: 'wombCore',
    backgroundConfig: { sectorKey: 'wombCore' },
    playfieldMargins: { top: 24, bottom: 24 },
    // Narrows on approach, then opens into the Boss Arena (±220) for the finale.
    terrainPoints: pts([
      [0, 210, -210],
      [800, 190, -190],
      [1650, 165, -165],
      [2500, 145, -145],
      [3350, 175, -170],
      [4200, 130, -130],
      [5050, 155, -150],
      [5950, 115, -115],
      [6500, 155, -155],
      [7100, 195, -195],
      [7800, 220, -220],
    ]),
    // All combined under finale pressure. Bone Dams add ticking gates (one Timed Burst).
    propLayout: [
      spore(1200, 505, 125),
      bone(2400, 505, -100),
      bulb(3700, 505, 0),
      bone(4900, 505, 110),
      egg(6100, 505, 95),
      bone(6900, 505, -50, 6.5),
    ],
  },
};
