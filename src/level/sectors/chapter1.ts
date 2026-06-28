import { PropType } from '../../types.ts';
import type { SectorDefinition, PropSpawnEntry } from './Sectors.ts';

// Chapter 1 — Megastructure ("The Outer Array") — pilot Sectors.
//
// Prop layouts are scroll-anchored on the same contract as waves (`at` is an
// absolute scrollX position; `x`,`y` is the initial playfield position, then
// the prop scrolls left at the level scrollSpeed). Props enter from the right
// edge (x≈500, just off the +480 playfield edge) so they read as part of the
// scrolling world. See plan.md for the per-Sector identity + prop budget.
//
// Progressive introduction along the chapter literacy arc:
//   1-1 Outer Hull    — none (clean baseline read)
//   1-2 Antenna Field — Sensor Pod (intro)
//   1-3 Transit Spine — Cargo Canister (intro)
//   1-4 Cargo Lane    — Sensor Pod + Cargo Canister (stress)
//   1-5 Core Gate     — all combined + Shield Relay under finale pressure
//
// `backgroundConfig.sectorKey` selects the per-Sector signature landmark
// rendered by Background.ts (antenna array, transit truss, cargo containers,
// core gate; outerHull = clean baseline).

const sensor = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.SENSOR_POD, x, y });
const cargo = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.CARGO_CANISTER, x, y });
const relay = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.SHIELD_RELAY, x, y });
const bulkhead = (at: number, x: number, y: number): PropSpawnEntry =>
  ({ at, propType: PropType.HULL_BULKHEAD, x, y });

export const CHAPTER_1_SECTORS: Record<string, SectorDefinition> = {
  outerHull: {
    sectorKey: 'outerHull',
    backgroundConfig: { sectorKey: 'outerHull' },
    playfieldMargins: { top: -20, bottom: -20 },
    propLayout: [],
  },

  antennaField: {
    sectorKey: 'antennaField',
    backgroundConfig: { sectorKey: 'antennaField' },
    // Sensor Pod intro — top-heavy placement echoing the antenna landmarks.
    propLayout: [
      sensor(1500, 510, 130),
      sensor(3000, 510, 150),
      sensor(4400, 510, 110),
    ],
  },

  transitSpine: {
    sectorKey: 'transitSpine',
    backgroundConfig: { sectorKey: 'transitSpine' },
    // Cargo Canister intro — broken/alternating placement down the spine.
    propLayout: [
      cargo(1600, 500, -90),
      cargo(3500, 500, 90),
      cargo(5200, 500, 0),
    ],
  },

  cargoLane: {
    sectorKey: 'cargoLane',
    backgroundConfig: { sectorKey: 'cargoLane' },
    // Sensor Pod + Cargo Canister stress — center-corridor density.
    // Hull Bulkhead is introduced here, blocking one side and leaving a clear lane.
    propLayout: [
      sensor(1500, 500, 0),
      cargo(2600, 500, -60),
      sensor(3700, 500, 60),
      cargo(4600, 500, 0),
      sensor(5500, 500, -40),
      bulkhead(6200, 500, 125),
    ],
  },

  coreGate: {
    sectorKey: 'coreGate',
    backgroundConfig: { sectorKey: 'coreGate' },
    playfieldMargins: { top: 15, bottom: 15 },
    // All combined + Shield Relay (Timed Burst hazard) under finale pressure.
    // Hull Bulkheads narrow the corridor on opposite sides to force lane swaps.
    propLayout: [
      bulkhead(1600, 500, 130),
      relay(2800, 500, 0),
      cargo(3600, 500, -90),
      bulkhead(4400, 500, -130),
      sensor(5200, 500, 90),
      relay(5800, 500, 0),
    ],
  },
};
