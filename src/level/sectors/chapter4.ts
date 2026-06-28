import { PropType } from '../../types.ts';
import type { PropSpawnEntry, SectorDefinition, SectorTerrainPoint } from './Sectors.ts';

// Chapter 4 — Volcanic ("Cinder Core") Sectors.
//
// Terrain control points are authored at the same raw scroll scale as Chapter 2;
// Levels.ts applies `at * 0.65` when constructing Terrain4. Each Sector carries
// its own control-point set so the chapter levels read as distinct places.
//
// Prop layouts are scroll-anchored (`at` is absolute scrollX; `x`,`y` is the
// initial playfield position, then the prop scrolls left). Per plan.md, props
// are introduced progressively and the finale Sector combines all three kinds.
// Volcanic props coexist with the existing Lava Pulse `StageEvent` and
// Stalactite enemies.

const basalt = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.BRITTLE_BASALT_COLUMN, x, y });
const magma = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.HANGING_MAGMA_SAC, x, y });
const crystal = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.CRYSTAL_OUTCROP, x, y });
const gate = (at: number, x: number, y: number, fullGate?: boolean, burstWindow?: number): PropSpawnEntry =>
  ({ at, propType: PropType.BASALT_GATE, x, y, isFullGate: fullGate, burstWindow });

const pts = (rows: Array<[number, number, number]>): readonly SectorTerrainPoint[] =>
  rows.map(([at, top, bottom]) => ({ at, top, bottom }));

export const CHAPTER_4_SECTORS: Record<string, SectorDefinition> = {
  basaltApproach: {
    sectorKey: 'basaltApproach',
    backgroundConfig: { sectorKey: 'basaltApproach' },
    playfieldMargins: { top: -16, bottom: -16 },
    // Open rocky entry with gentle lava-carved walls.
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
    // Brittle Basalt Column intro.
    propLayout: [
      basalt(1400, 505, -190),
      basalt(3600, 505, -170),
      basalt(5800, 505, -200),
    ],
  },

  magmaConduit: {
    sectorKey: 'magmaConduit',
    backgroundConfig: { sectorKey: 'magmaConduit' },
    playfieldMargins: { top: 20, bottom: 20 },
    // Choke-point: periodic narrow squeezes for magma channels.
    terrainPoints: pts([
      [0, 215, -215],
      [750, 165, -165],
      [1500, 215, -215],
      [2250, 160, -160],
      [3000, 218, -218],
      [3750, 155, -155],
      [4500, 220, -220],
      [5250, 162, -162],
      [6150, 210, -210],
      [7300, 150, -150],
    ]),
    // Hanging Magma Sac intro — the harshest volcanic hazard.
    propLayout: [
      magma(1300, 505, 180),
      magma(2900, 505, 200),
      magma(4600, 505, 170),
      magma(6200, 505, 190),
    ],
  },

  crystalCavern: {
    sectorKey: 'crystalCavern',
    backgroundConfig: { sectorKey: 'crystalCavern' },
    // Mixed: uneven top and bottom with cavernous pockets.
    terrainPoints: pts([
      [0, 220, -220],
      [800, 190, -215],
      [1600, 220, -150],
      [2400, 165, -210],
      [3200, 225, -165],
      [4000, 155, -220],
      [4800, 215, -155],
      [5600, 170, -210],
      [6400, 220, -165],
      [7300, 160, -200],
    ]),
    // Crystal Outcrop intro — reward prop.
    propLayout: [
      crystal(1500, 505, 0),
      crystal(3500, 505, 80),
      crystal(5500, 505, -60),
    ],
  },

  ashFalls: {
    sectorKey: 'ashFalls',
    backgroundConfig: { sectorKey: 'ashFalls' },
    playfieldMargins: { top: 18, bottom: 18 },
    // Broken choke-points: alternating top/bottom squeezes through ash-clogged terrain.
    terrainPoints: pts([
      [0, 215, -215],
      [750, 170, -215],
      [1500, 215, -170],
      [2250, 165, -215],
      [3000, 218, -165],
      [3750, 160, -218],
      [4500, 220, -170],
      [5250, 168, -220],
      [6150, 210, -210],
      [7300, 155, -155],
    ]),
    // All three kinds stressed/combined, plus Basalt Gates that split the lane.
    propLayout: [
      gate(1400, 500, 30),
      magma(2400, 505, 190),
      crystal(3600, 505, 40),
      basalt(5000, 505, -200),
      gate(5500, 500, -30),
      magma(6300, 505, 180),
    ],
  },

  calderaHeart: {
    sectorKey: 'calderaHeart',
    backgroundConfig: { sectorKey: 'calderaHeart' },
    playfieldMargins: { top: 26, bottom: 26 },
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
    // All three kinds combined under finale pressure. The scroll-4700 Basalt Gate
    // (isFullGate, hh 80) is a large center obstacle in the narrowed corridor, not a
    // geometrically full-span blocker — lanes remain around it. Its Timed Burst is
    // reward-only (Bullet Clear + Score + Powerup, no hazard), so it is a
    // lane-narrowing challenge rather than a destroy-or-be-punished gate.
    propLayout: [
      gate(1100, 500, -40),
      magma(2300, 505, 200),
      crystal(3400, 505, 0),
      gate(4700, 500, 0, true, 6.5),
      basalt(5200, 505, -170),
      magma(5900, 505, 190),
    ],
  },
};
