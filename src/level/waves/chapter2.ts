import { SPAWN_X, row, vForm, cluster } from './helpers.ts';
import { EnemyType } from '../../types.ts';
import { spawnEnemyEvent, type WaveEntry } from '../StageEvents.ts';
import { Timeline, BeatType, type BeatPattern } from './Timeline.ts';

// --- ANCHORS ENUM ---
export enum Chapter2Anchor {
  START = 'start',
  MID = 'mid',
}

const SWARM_CP_1 = [
  { dx:   0, dy:  30 },
  { dx:  60, dy: -30 },
  { dx: 120, dy:   0 },
];

const SWARM_CP_2 = [
  { dx:   0, dy:  15 },
  { dx:  70, dy: -15 },
];

const SWARM_CP_3 = [
  { dx:   0, dy:   0 },
  { dx:  60, dy: -45 },
  { dx: 120, dy:  45 },
  { dx: 180, dy:   0 },
];

// --- BEAT BUILDERS ---

export function straightRowBeat(count: number, yCenter: number, ySpread: number): BeatPattern {
  return {
    name: BeatType.STRAIGHT_ROW,
    events: row(EnemyType.STRAIGHT, count, yCenter, ySpread),
  };
}

export function supportSineBeat(y: number, dx = 0): BeatPattern {
  return {
    name: BeatType.MIRROR_SINE,
    events: [spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx, y)],
  };
}

export function turretBeat(y: number, dx = 0): BeatPattern {
  return {
    name: BeatType.TURRET,
    events: [spawnEnemyEvent(EnemyType.TURRET, SPAWN_X + dx, y)],
  };
}

export function chargerBeat(y: number, dx = 0): BeatPattern {
  return {
    name: BeatType.CHARGER,
    events: [spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X + dx, y)],
  };
}

export function swarmClusterBeat(density: 'chokepoint-1' | 'chokepoint-2'): BeatPattern {
  const offsets = density === 'chokepoint-1' ? SWARM_CP_1 : SWARM_CP_2;
  return {
    name: BeatType.SWARM_CLUSTER,
    events: cluster(EnemyType.SWARM, offsets, 0, 0),
  };
}

export function sparseSwarmBeat(): BeatPattern {
  return {
    name: BeatType.SWARM_CLUSTER,
    events: cluster(EnemyType.SWARM, SWARM_CP_3, 0, 0),
  };
}

export function mixedStraightTurretBeat(count: number, yCenter: number, ySpread: number, turretY: number, turretDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_STRAIGHT_TURRET,
    events: [
      ...row(EnemyType.STRAIGHT, count, yCenter, ySpread),
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X + turretDx, turretY),
    ],
  };
}

export function mixedSupportSineTurretBeat(sineY: number, sineDx: number, turretY: number, turretDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_MIRROR_SINE_TURRET,
    events: [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, sineY),
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X + turretDx, turretY),
    ],
  };
}

export function multiChargerBeat(chargers: { y: number; dx: number }[]): BeatPattern {
  return {
    name: BeatType.MULTI_CHARGER,
    events: chargers.map(({ y, dx }) => spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X + dx, y)),
  };
}

export function mixedTurretChargerBeat(turretY: number, turretDx: number, chargerY: number, chargerDx: number): BeatPattern {
  return {
    name: BeatType.MULTI_CHARGER,
    events: [
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X + turretDx, turretY),
      spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X + chargerDx, chargerY),
    ],
  };
}

export function mixedSupportSineChargerBeat(sineY: number, sineDx: number, chargerY: number, chargerDx: number): BeatPattern {
  return {
    name: BeatType.MULTI_CHARGER,
    events: [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, sineY),
      spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X + chargerDx, chargerY),
    ],
  };
}

export function mixedStraightSineBeat(count: number, yCenter: number, ySpread: number, sineY: number, sineDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_MIRROR_SINE_TURRET,
    events: [
      ...row(EnemyType.STRAIGHT, count, yCenter, ySpread),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, sineY),
    ],
  };
}

export function dualDiverSineRowBeat(diverCount: number, diverYStep: number, sineCount: number, sineY: number, sineSpread: number): BeatPattern {
  return {
    name: BeatType.DUAL_DIVER_SINE_ROW,
    events: [
      ...vForm(EnemyType.DIVER, diverCount, diverYStep),
      ...row(EnemyType.SINE, sineCount, sineY, sineSpread),
    ],
  };
}

// --- LEVEL TIMELINES ---

function chapter2_1(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 4800)
    .add(Chapter2Anchor.START, 320, straightRowBeat(5, 0, 250))
    .add(Chapter2Anchor.START, 900, supportSineBeat(110))
    .add(Chapter2Anchor.START, 1360, turretBeat(-150))
    .add(Chapter2Anchor.START, 2040, straightRowBeat(4, 95, 150))
    .add(Chapter2Anchor.START, 2680, mixedStraightTurretBeat(3, -75, 150, 145, 90))
    .add(Chapter2Anchor.START, 3440, mixedStraightSineBeat(4, 0, 220, -125, 110))
    .add(Chapter2Anchor.START, 4200, turretBeat(130, 40))
    .add(Chapter2Anchor.MID, 280, mixedStraightTurretBeat(4, 0, 210, -135, 90))
    .add(Chapter2Anchor.MID, 1100, supportSineBeat(-105, 50))
    .add(Chapter2Anchor.MID, 1680, swarmClusterBeat('chokepoint-1'))
    .add(Chapter2Anchor.MID, 2500, mixedSupportSineTurretBeat(95, 0, 135, 90))
    .add(Chapter2Anchor.MID, 3300, straightRowBeat(5, 0, 240));
}

function chapter2_2(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 5000)
    .add(Chapter2Anchor.START, 300, straightRowBeat(5, 0, 260))
    .add(Chapter2Anchor.START, 780, turretBeat(-150))
    .add(Chapter2Anchor.START, 1400, mixedStraightSineBeat(4, 105, 170, -125, 110))
    .add(Chapter2Anchor.START, 2100, mixedStraightTurretBeat(4, -95, 160, 145, 90))
    .add(Chapter2Anchor.START, 2800, straightRowBeat(5, -85, 170))
    .add(Chapter2Anchor.START, 3460, sparseSwarmBeat())
    .add(Chapter2Anchor.START, 4160, mixedSupportSineTurretBeat(110, 0, -140, 90))
    .add(Chapter2Anchor.MID, 120, straightRowBeat(6, 0, 270))
    .add(Chapter2Anchor.MID, 900, mixedStraightTurretBeat(4, -100, 150, 135, 100))
    .add(Chapter2Anchor.MID, 1640, supportSineBeat(-95, 60))
    .add(Chapter2Anchor.MID, 2240, swarmClusterBeat('chokepoint-2'))
    .add(Chapter2Anchor.MID, 2960, mixedSupportSineTurretBeat(95, 0, -130, 90))
    .add(Chapter2Anchor.MID, 3780, dualDiverSineRowBeat(3, 82, 1, 0, 0));
}

function chapter2_3(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 5000)
    .add(Chapter2Anchor.START, 320, straightRowBeat(5, 0, 250))
    .add(Chapter2Anchor.START, 900, mixedSupportSineTurretBeat(120, 0, -145, 90))
    .add(Chapter2Anchor.START, 1660, chargerBeat(0))
    .add(Chapter2Anchor.START, 2440, straightRowBeat(4, 95, 170))
    .add(Chapter2Anchor.START, 3160, mixedStraightTurretBeat(4, -95, 170, 140, 100))
    .add(Chapter2Anchor.START, 3940, mixedSupportSineChargerBeat(-120, 0, 40, 120))
    .add(Chapter2Anchor.MID, 120, supportSineBeat(95))
    .add(Chapter2Anchor.MID, 820, mixedTurretChargerBeat(-135, 70, 45, 170))
    .add(Chapter2Anchor.MID, 1660, sparseSwarmBeat())
    .add(Chapter2Anchor.MID, 2420, mixedStraightSineBeat(5, 0, 230, -110, 110))
    .add(Chapter2Anchor.MID, 3200, chargerBeat(0, 90))
    .add(Chapter2Anchor.MID, 3980, dualDiverSineRowBeat(3, 82, 1, 0, 0));
}

function chapter2_4(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 6100)
    .add(Chapter2Anchor.START, 300, straightRowBeat(5, 0, 260))
    .add(Chapter2Anchor.START, 820, mixedStraightTurretBeat(4, -100, 170, 145, 90))
    .add(Chapter2Anchor.START, 1560, mixedSupportSineChargerBeat(120, 0, -20, 110))
    .add(Chapter2Anchor.START, 2360, straightRowBeat(5, 95, 180))
    .add(Chapter2Anchor.START, 3120, mixedSupportSineTurretBeat(-115, 0, -140, 60))
    .add(Chapter2Anchor.START, 3940, multiChargerBeat([
      { y: 45, dx: 0 },
      { y: -45, dx: 140 },
    ]))
    .add(Chapter2Anchor.START, 4820, sparseSwarmBeat())
    .add(Chapter2Anchor.START, 5600, mixedStraightTurretBeat(5, 0, 220, 135, 110))
    .add(Chapter2Anchor.MID, 220, mixedSupportSineTurretBeat(105, 0, -135, 110))
    .add(Chapter2Anchor.MID, 1100, straightRowBeat(6, 0, 270))
    .add(Chapter2Anchor.MID, 1980, mixedTurretChargerBeat(-130, 70, 55, 170))
    .add(Chapter2Anchor.MID, 2860, supportSineBeat(-95, 40))
    .add(Chapter2Anchor.MID, 3620, multiChargerBeat([
      { y: -55, dx: 0 },
      { y: 55, dx: 130 },
    ]))
    .add(Chapter2Anchor.MID, 4480, dualDiverSineRowBeat(4, 70, 1, 0, 0));
}

function chapter2_5(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 6000)
    .add(Chapter2Anchor.START, 300, straightRowBeat(5, 0, 260))
    .add(Chapter2Anchor.START, 820, mixedStraightTurretBeat(4, -105, 170, 145, 90))
    .add(Chapter2Anchor.START, 1480, mixedSupportSineChargerBeat(115, 0, 0, 110))
    .add(Chapter2Anchor.START, 2260, sparseSwarmBeat())
    .add(Chapter2Anchor.START, 2980, mixedSupportSineTurretBeat(-110, 0, -140, 90))
    .add(Chapter2Anchor.START, 3780, multiChargerBeat([
      { y: 45, dx: 0 },
      { y: -45, dx: 140 },
    ]))
    .add(Chapter2Anchor.START, 4620, mixedStraightTurretBeat(5, 0, 230, 135, 100))
    .add(Chapter2Anchor.START, 5360, swarmClusterBeat('chokepoint-1'))
    .add(Chapter2Anchor.MID, 180, straightRowBeat(6, 0, 270))
    .add(Chapter2Anchor.MID, 920, mixedTurretChargerBeat(-135, 70, 50, 170))
    .add(Chapter2Anchor.MID, 1760, mixedStraightSineBeat(5, -90, 180, 120, 120))
    .add(Chapter2Anchor.MID, 2520, swarmClusterBeat('chokepoint-2'))
    .add(Chapter2Anchor.MID, 3240, multiChargerBeat([
      { y: -60, dx: 0 },
      { y: 0, dx: 110 },
      { y: 60, dx: 220 },
    ]))
    .add(Chapter2Anchor.MID, 4100, mixedSupportSineTurretBeat(-100, 0, 130, 100))
    .add(Chapter2Anchor.MID, 4860, dualDiverSineRowBeat(4, 70, 1, 0, 0))
    .add(Chapter2Anchor.MID, 5480, mixedTurretChargerBeat(135, 80, -45, 180));
}

const CHAPTER_2_BEATS = {
  '2-1': chapter2_1,
  '2-2': chapter2_2,
  '2-3': chapter2_3,
  '2-4': chapter2_4,
  '2-5': chapter2_5,
} as const;

/**
 * Builds standard WaveEntry list for any Chapter 2 sub-level.
 * Implements the centralized Chapter 2 Wave Grammar.
 */
export function buildChapter2Waves(levelId: string): WaveEntry[] {
  const timelineFn = CHAPTER_2_BEATS[levelId as keyof typeof CHAPTER_2_BEATS];
  if (!timelineFn) {
    throw new Error(`Unknown Chapter 2 level: ${levelId}`);
  }
  return timelineFn().build();
}
