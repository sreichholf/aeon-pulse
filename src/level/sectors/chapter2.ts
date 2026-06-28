import { PropType } from '../../types.ts';
import type { PropSpawnEntry, SectorDefinition, SectorTerrainPoint } from './Sectors.ts';

const fuel = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.FUEL_TANK, x, y });
const node = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.CONVEYOR_NODE, x, y });
const vent = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.FURNACE_VENT, x, y });
const plug = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.COOLING_PLUG, x, y });

const pts = (rows: Array<[number, number, number]>): readonly SectorTerrainPoint[] =>
  rows.map(([at, top, bottom]) => ({ at, top, bottom }));

export const CHAPTER_2_SECTORS: Record<string, SectorDefinition> = {
  intakeManifold: {
    sectorKey: 'intakeManifold',
    backgroundConfig: { sectorKey: 'intakeManifold' },
    playfieldMargins: { top: -18, bottom: -18 },
    terrainPoints: pts([
      [0, 228, -228],
      [900, 220, -220],
      [1800, 210, -210],
      [2800, 218, -214],
      [3900, 205, -205],
      [5000, 214, -212],
      [6200, 202, -202],
      [7300, 196, -196],
    ]),
    propLayout: [
      fuel(1450, 505, -70),
      fuel(3250, 505, 95),
      fuel(5200, 505, -10),
    ],
  },

  conveyorGallery: {
    sectorKey: 'conveyorGallery',
    backgroundConfig: { sectorKey: 'conveyorGallery' },
    terrainPoints: pts([
      [0, 220, -220],
      [850, 192, -210],
      [1650, 175, -185],
      [2550, 205, -172],
      [3400, 182, -200],
      [4350, 210, -176],
      [5250, 188, -190],
      [6200, 206, -174],
      [7300, 194, -184],
    ]),
    propLayout: [
      node(1500, 505, 110),
      node(2800, 505, -95),
      node(4300, 505, 85),
      node(5750, 505, -70),
    ],
  },

  pressHall: {
    sectorKey: 'pressHall',
    backgroundConfig: { sectorKey: 'pressHall' },
    playfieldMargins: { top: 18, bottom: 18 },
    terrainPoints: pts([
      [0, 205, -205],
      [700, 170, -185],
      [1350, 145, -165],
      [2050, 190, -150],
      [2800, 142, -142],
      [3550, 182, -148],
      [4350, 150, -175],
      [5150, 188, -150],
      [5950, 148, -148],
      [6800, 176, -140],
      [7300, 166, -136],
    ]),
    propLayout: [
      fuel(1200, 505, -105),
      node(2250, 505, 95),
      fuel(3550, 505, 0),
      node(4850, 505, -95),
      fuel(6120, 505, 110),
      plug(6800, 505, -110),
    ],
  },

  coolantRun: {
    sectorKey: 'coolantRun',
    backgroundConfig: { sectorKey: 'coolantRun' },
    terrainPoints: pts([
      [0, 225, -205],
      [760, 168, -220],
      [1460, 200, -150],
      [2180, 150, -198],
      [2940, 214, -164],
      [3720, 160, -220],
      [4550, 206, -150],
      [5380, 148, -192],
      [6200, 198, -158],
      [7000, 170, -210],
      [7300, 160, -190],
    ]),
    propLayout: [
      vent(1550, 505, -105),
      fuel(2920, 505, 115),
      vent(4300, 505, 95),
      node(5600, 505, -90),
      vent(6400, 505, 0),
    ],
  },

  smelterCore: {
    sectorKey: 'smelterCore',
    backgroundConfig: { sectorKey: 'smelterCore' },
    playfieldMargins: { top: 22, bottom: 22 },
    terrainPoints: pts([
      [0, 210, -210],
      [820, 190, -198],
      [1640, 168, -186],
      [2480, 150, -170],
      [3340, 172, -158],
      [4200, 146, -152],
      [5050, 168, -140],
      [5900, 136, -134],
      [6700, 124, -122],
      [7300, 112, -112],
    ]),
    propLayout: [
      plug(1250, 505, 120),
      node(2350, 505, -95),
      vent(3450, 505, 0),
      fuel(4550, 505, -118),
      node(5550, 505, 100),
      plug(6350, 505, -120),
    ],
  },
};
