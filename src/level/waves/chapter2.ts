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

export function mirrorSineBeat(yA: number, yB: number, dx = 80): BeatPattern {
  return {
    name: BeatType.MIRROR_SINE,
    events: [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X, yA),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx, yB),
    ],
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

export function mixedMirrorSineTurretBeat(yA: number, yB: number, sineDx: number, turretY: number, turretDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_MIRROR_SINE_TURRET,
    events: [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X, yA),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, yB),
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
    .add(Chapter2Anchor.START, 820, mirrorSineBeat(125, -125, 80))
    .add(Chapter2Anchor.START, 1360, turretBeat(-150))
    .add(Chapter2Anchor.START, 1980, straightRowBeat(4, 95, 150))
    .add(Chapter2Anchor.START, 2580, mixedStraightTurretBeat(3, -75, 150, 145, 90))
    .add(Chapter2Anchor.START, 3260, mirrorSineBeat(110, -110, 80))
    .add(Chapter2Anchor.START, 3920, straightRowBeat(5, 0, 230))
    .add(Chapter2Anchor.START, 4480, turretBeat(130, 40))
    .add(Chapter2Anchor.MID, 280, mixedStraightTurretBeat(4, 0, 210, -135, 90))
    .add(Chapter2Anchor.MID, 980, mirrorSineBeat(105, -105, 90))
    .add(Chapter2Anchor.MID, 1680, swarmClusterBeat('chokepoint-1'))
    .add(Chapter2Anchor.MID, 2440, mixedMirrorSineTurretBeat(95, -95, 90, 135, 80))
    .add(Chapter2Anchor.MID, 3220, straightRowBeat(5, 0, 240));
}

function chapter2_2(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 5000)
    .add(Chapter2Anchor.START, 300, straightRowBeat(5, 0, 260))
    .add(Chapter2Anchor.START, 780, turretBeat(-150))
    .add(Chapter2Anchor.START, 1260, mirrorSineBeat(125, -125, 75))
    .add(Chapter2Anchor.START, 1780, mixedStraightTurretBeat(4, 105, 170, -145, 90))
    .add(Chapter2Anchor.START, 2360, straightRowBeat(5, -85, 170))
    .add(Chapter2Anchor.START, 2920, turretBeat(145, 60))
    .add(Chapter2Anchor.START, 3500, sparseSwarmBeat())
    .add(Chapter2Anchor.START, 4200, mixedMirrorSineTurretBeat(110, -110, 80, -140, 80))
    .add(Chapter2Anchor.MID, 120, straightRowBeat(6, 0, 270))
    .add(Chapter2Anchor.MID, 780, mixedStraightTurretBeat(4, -100, 150, 135, 100))
    .add(Chapter2Anchor.MID, 1420, mirrorSineBeat(100, -100, 90))
    .add(Chapter2Anchor.MID, 2040, swarmClusterBeat('chokepoint-2'))
    .add(Chapter2Anchor.MID, 2760, mixedStraightTurretBeat(5, 0, 220, -130, 90))
    .add(Chapter2Anchor.MID, 3520, dualDiverSineRowBeat(3, 82, 2, 0, 130));
}

function chapter2_3(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 5000)
    .add(Chapter2Anchor.START, 320, straightRowBeat(5, 0, 250))
    .add(Chapter2Anchor.START, 860, turretBeat(-145))
    .add(Chapter2Anchor.START, 1440, mirrorSineBeat(120, -120, 85))
    .add(Chapter2Anchor.START, 2100, chargerBeat(0))
    .add(Chapter2Anchor.START, 2860, straightRowBeat(4, 95, 170))
    .add(Chapter2Anchor.START, 3500, mixedStraightTurretBeat(4, -95, 170, 140, 100))
    .add(Chapter2Anchor.START, 4240, chargerBeat(-45, 70))
    .add(Chapter2Anchor.MID, 120, mirrorSineBeat(100, -100, 90))
    .add(Chapter2Anchor.MID, 760, mixedTurretChargerBeat(-135, 70, 45, 150))
    .add(Chapter2Anchor.MID, 1500, sparseSwarmBeat())
    .add(Chapter2Anchor.MID, 2220, mixedMirrorSineTurretBeat(105, -105, 85, 135, 80))
    .add(Chapter2Anchor.MID, 2940, chargerBeat(0, 90))
    .add(Chapter2Anchor.MID, 3660, dualDiverSineRowBeat(3, 82, 3, 0, 170));
}

function chapter2_4(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 6100)
    .add(Chapter2Anchor.START, 300, straightRowBeat(5, 0, 260))
    .add(Chapter2Anchor.START, 820, mixedStraightTurretBeat(4, -100, 170, 145, 90))
    .add(Chapter2Anchor.START, 1540, mirrorSineBeat(120, -120, 80))
    .add(Chapter2Anchor.START, 2240, chargerBeat(20))
    .add(Chapter2Anchor.START, 3000, straightRowBeat(5, 95, 180))
    .add(Chapter2Anchor.START, 3720, turretBeat(-140, 60))
    .add(Chapter2Anchor.START, 4460, multiChargerBeat([
      { y: 45, dx: 0 },
      { y: -45, dx: 140 },
    ]))
    .add(Chapter2Anchor.START, 5300, sparseSwarmBeat())
    .add(Chapter2Anchor.MID, 220, mixedMirrorSineTurretBeat(105, -105, 90, 135, 100))
    .add(Chapter2Anchor.MID, 1060, straightRowBeat(6, 0, 270))
    .add(Chapter2Anchor.MID, 1900, mixedTurretChargerBeat(-130, 70, 55, 160))
    .add(Chapter2Anchor.MID, 2740, mirrorSineBeat(95, -95, 95))
    .add(Chapter2Anchor.MID, 3540, multiChargerBeat([
      { y: -55, dx: 0 },
      { y: 55, dx: 130 },
    ]))
    .add(Chapter2Anchor.MID, 4340, dualDiverSineRowBeat(4, 70, 3, 0, 160));
}

function chapter2_5(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 6000)
    .add(Chapter2Anchor.START, 300, straightRowBeat(5, 0, 260))
    .add(Chapter2Anchor.START, 820, mixedStraightTurretBeat(4, -105, 170, 145, 90))
    .add(Chapter2Anchor.START, 1440, mirrorSineBeat(120, -120, 85))
    .add(Chapter2Anchor.START, 2100, chargerBeat(0))
    .add(Chapter2Anchor.START, 2780, sparseSwarmBeat())
    .add(Chapter2Anchor.START, 3440, mixedMirrorSineTurretBeat(110, -110, 90, -140, 80))
    .add(Chapter2Anchor.START, 4180, multiChargerBeat([
      { y: 45, dx: 0 },
      { y: -45, dx: 140 },
    ]))
    .add(Chapter2Anchor.START, 5000, mixedStraightTurretBeat(5, 0, 230, 135, 100))
    .add(Chapter2Anchor.START, 5600, swarmClusterBeat('chokepoint-1'))
    .add(Chapter2Anchor.MID, 180, straightRowBeat(6, 0, 270))
    .add(Chapter2Anchor.MID, 900, mixedTurretChargerBeat(-135, 70, 50, 160))
    .add(Chapter2Anchor.MID, 1660, mirrorSineBeat(105, -105, 90))
    .add(Chapter2Anchor.MID, 2380, swarmClusterBeat('chokepoint-2'))
    .add(Chapter2Anchor.MID, 3060, multiChargerBeat([
      { y: -60, dx: 0 },
      { y: 0, dx: 110 },
      { y: 60, dx: 220 },
    ]))
    .add(Chapter2Anchor.MID, 3820, mixedMirrorSineTurretBeat(100, -100, 90, 130, 90))
    .add(Chapter2Anchor.MID, 4560, dualDiverSineRowBeat(4, 70, 3, 0, 170))
    .add(Chapter2Anchor.MID, 5120, mixedTurretChargerBeat(135, 80, -45, 170));
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
