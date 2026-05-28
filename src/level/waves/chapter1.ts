import { SPAWN_X, row, vForm, cluster, SWARM_SM, SWARM_LG } from './helpers.ts';
import { EnemyType } from '../../types.ts';
import { spawnEnemyEvent, type StageEvent, type WaveEntry } from '../StageEvents.ts';
import { Timeline, BeatType, type BeatPattern } from './Timeline.ts';

// --- ANCHORS ENUM ---
export enum Chapter1Anchor {
  START = 'start',
  MID = 'mid',
}

// Custom mid-sized swarm configurations
const SWARM_MD_5 = [
  { dx:   0, dy:   0 },
  { dx:  55, dy: -65 },
  { dx:  55, dy:  65 },
  { dx: 110, dy: -25 },
  { dx: 110, dy:  95 },
];

const SWARM_MD_7 = [
  { dx:   0, dy:   0 },
  { dx:  50, dy: -80 },
  { dx:  50, dy:  80 },
  { dx: 100, dy:-135 },
  { dx: 100, dy: -35 },
  { dx: 100, dy:  65 },
  { dx: 150, dy:   0 },
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

export function sineTriadBeat(yA: number, yB: number, yC: number, dx1 = 70, dx2 = 140): BeatPattern {
  return {
    name: BeatType.SINE_TRIAD,
    events: [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X, yA),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx1, yB),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx2, yC),
    ],
  };
}

export function diverVBeat(count: number, yStep = 72): BeatPattern {
  return {
    name: BeatType.DIVER_V,
    events: vForm(EnemyType.DIVER, count, yStep),
  };
}

export function swarmClusterBeat(density: 'light' | 'heavy' | 'tutorial' | 'finale'): BeatPattern {
  let offsets = SWARM_SM;
  if (density === 'tutorial') {
    offsets = SWARM_MD_5;
  } else if (density === 'heavy') {
    offsets = SWARM_LG;
  } else if (density === 'finale') {
    offsets = SWARM_MD_7;
  }
  return {
    name: BeatType.SWARM_CLUSTER,
    events: cluster(EnemyType.SWARM, offsets, 0, 0),
  };
}

export function recoveryGapBeat(): BeatPattern {
  return {
    name: BeatType.RECOVERY_GAP,
    events: [],
  };
}

export function mixedStraightDiverBeat(count: number, yCenter: number, ySpread: number, diverY: number, diverDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_STRAIGHT_DIVER,
    events: [
      ...row(EnemyType.STRAIGHT, count, yCenter, ySpread),
      spawnEnemyEvent(EnemyType.DIVER, SPAWN_X + diverDx, diverY),
    ],
  };
}

export function mixedStraightSineBeat(count: number, yCenter: number, ySpread: number, sineY: number, sineDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_STRAIGHT_SINE,
    events: [
      ...row(EnemyType.STRAIGHT, count, yCenter, ySpread),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, sineY),
    ],
  };
}

export function mixedDiverSineBeat(count: number, yStep: number, sineY: number, sineDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_DIVER_SINE,
    events: [
      ...vForm(EnemyType.DIVER, count, yStep),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, sineY),
    ],
  };
}

export function mixedSineDiverBeat(yA: number, yB: number, yC: number, dx1: number, dx2: number, diverY: number, diverDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_SINE_DIVER,
    events: [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X, yA),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx1, yB),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx2, yC),
      spawnEnemyEvent(EnemyType.DIVER, SPAWN_X + diverDx, diverY),
    ],
  };
}

export function dualStraightSineRowBeat(
  straightCount: number, straightY: number, straightSpread: number,
  sineCount: number, sineY: number, sineSpread: number
): BeatPattern {
  return {
    name: BeatType.DUAL_STRAIGHT_SINE_ROW,
    events: [
      ...row(EnemyType.STRAIGHT, straightCount, straightY, straightSpread),
      ...row(EnemyType.SINE, sineCount, sineY, sineSpread),
    ],
  };
}

export function mixedStraightDualDiverBeat(
  count: number, yCenter: number, ySpread: number,
  diverY1: number, diverY2: number, diverDx: number
): BeatPattern {
  return {
    name: BeatType.MIXED_STRAIGHT_DUAL_DIVER,
    events: [
      ...row(EnemyType.STRAIGHT, count, yCenter, ySpread),
      spawnEnemyEvent(EnemyType.DIVER, SPAWN_X + diverDx, diverY1),
      spawnEnemyEvent(EnemyType.DIVER, SPAWN_X + diverDx, diverY2),
    ],
  };
}

export function mixedMirrorSineDiverVBeat(
  sineYA: number, sineYB: number, sineDx: number,
  diverCount: number, diverYStep: number
): BeatPattern {
  return {
    name: BeatType.MIXED_MIRROR_SINE_DIVER_V,
    events: [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X, sineYA),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, sineYB),
      ...vForm(EnemyType.DIVER, diverCount, diverYStep),
    ],
  };
}

// --- LEVEL TIMELINES ---

// Level 1-1 (Rookie / Pattern Literacy)
function chapter1_1(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>()
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 5000)
    .add(Chapter1Anchor.START, 320, straightRowBeat(4, 0, 220))
    .add(Chapter1Anchor.START, 760, mirrorSineBeat(115, -115, 80))
    .add(Chapter1Anchor.START, 1210, straightRowBeat(3, -120, 130))
    .add(Chapter1Anchor.START, 1690, diverVBeat(3, 76))
    .add(Chapter1Anchor.START, 2210, straightRowBeat(4, 105, 160))
    .add(Chapter1Anchor.START, 2760, sineTriadBeat(-130, 0, 130, 70, 140))
    .add(Chapter1Anchor.START, 3330, straightRowBeat(5, 0, 250))
    .add(Chapter1Anchor.START, 3920, diverVBeat(3, 68))
    .add(Chapter1Anchor.START, 4540, swarmClusterBeat('tutorial'))
    .add(Chapter1Anchor.MID, 260, straightRowBeat(4, -90, 180))
    .add(Chapter1Anchor.MID, 900, diverVBeat(4, 68))
    .add(Chapter1Anchor.MID, 1560, mirrorSineBeat(100, -100, 80))
    .add(Chapter1Anchor.MID, 2180, mixedStraightDiverBeat(4, -95, 150, 145, 75))
    .add(Chapter1Anchor.MID, 2800, straightRowBeat(5, 0, 230));
}

// Level 1-2 (Density Literacy)
function chapter1_2(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>()
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 5000)
    .add(Chapter1Anchor.START, 300, straightRowBeat(5, 0, 250))
    .add(Chapter1Anchor.START, 760, straightRowBeat(4, -95, 170))
    .add(Chapter1Anchor.START, 1220, mirrorSineBeat(130, -130, 70))
    .add(Chapter1Anchor.START, 1700, straightRowBeat(5, 95, 170))
    .add(Chapter1Anchor.START, 2220, diverVBeat(4, 66))
    .add(Chapter1Anchor.START, 2800, straightRowBeat(6, 0, 280))
    .add(Chapter1Anchor.START, 3400, sineTriadBeat(-145, 0, 145, 70, 140))
    .add(Chapter1Anchor.START, 4020, straightRowBeat(4, -130, 120))
    .add(Chapter1Anchor.START, 4540, straightRowBeat(4, 130, 120))
    .add(Chapter1Anchor.MID, 120, swarmClusterBeat('light'))
    .add(Chapter1Anchor.MID, 1000, mixedStraightDiverBeat(5, 0, 240, -150, 90))
    .add(Chapter1Anchor.MID, 1760, mirrorSineBeat(120, -120, 80))
    .add(Chapter1Anchor.MID, 2380, diverVBeat(4, 62))
    .add(Chapter1Anchor.MID, 3000, straightRowBeat(6, 0, 260));
}

// Level 1-3 (Mixed-Wave Literacy)
function chapter1_3(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>()
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 4500)
    .add(Chapter1Anchor.START, 300, straightRowBeat(4, 0, 220))
    .add(Chapter1Anchor.START, 780, mixedStraightSineBeat(3, -115, 140, 120, 80))
    .add(Chapter1Anchor.START, 1320, mixedStraightSineBeat(3, 115, 140, -120, 80))
    .add(Chapter1Anchor.START, 1900, mixedDiverSineBeat(3, 76, 0, 120))
    .add(Chapter1Anchor.START, 2540, straightRowBeat(5, 0, 250))
    .add(Chapter1Anchor.START, 3160, mixedStraightDiverBeat(4, -95, 150, 145, 90))
    .add(Chapter1Anchor.START, 3780, mixedSineDiverBeat(-135, 0, 135, 70, 140, 155, 80))
    .add(Chapter1Anchor.MID, 20, swarmClusterBeat('light'))
    .add(Chapter1Anchor.MID, 820, mixedDiverSineBeat(4, 62, -120, 130))
    .add(Chapter1Anchor.MID, 1540, mixedStraightSineBeat(4, 110, 150, -125, 80))
    .add(Chapter1Anchor.MID, 2240, mixedStraightDiverBeat(4, -110, 150, 135, 90))
    .add(Chapter1Anchor.MID, 2940, mixedStraightSineBeat(5, 0, 240, 0, 140));
}

// Level 1-4 (Endurance Recovery)
function chapter1_4(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>()
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 6500)
    .add(Chapter1Anchor.START, 280, straightRowBeat(5, 0, 260))
    .add(Chapter1Anchor.START, 700, mirrorSineBeat(130, -130, 80))
    .add(Chapter1Anchor.START, 1120, straightRowBeat(5, -95, 180))
    .add(Chapter1Anchor.START, 1560, diverVBeat(4, 66))
    .add(Chapter1Anchor.START, 2100, straightRowBeat(6, 95, 190))
    .add(Chapter1Anchor.START, 2640, swarmClusterBeat('light'))
    .add(Chapter1Anchor.START, 3420, recoveryGapBeat())
    .add(Chapter1Anchor.START, 3820, mixedStraightDiverBeat(5, 0, 260, -150, 90))
    .add(Chapter1Anchor.START, 4480, sineTriadBeat(-145, 0, 145, 70, 140))
    .add(Chapter1Anchor.START, 5120, diverVBeat(5, 58))
    .add(Chapter1Anchor.START, 5800, straightRowBeat(6, 0, 280))
    .add(Chapter1Anchor.MID, 0, recoveryGapBeat())
    .add(Chapter1Anchor.MID, 420, swarmClusterBeat('finale'))
    .add(Chapter1Anchor.MID, 1360, dualStraightSineRowBeat(4, -115, 150, 3, 115, 150))
    .add(Chapter1Anchor.MID, 2220, mixedDiverSineBeat(4, 62, 0, 120))
    .add(Chapter1Anchor.MID, 3000, straightRowBeat(6, 0, 260));
}

// Level 1-5 (Chapter Finale)
function chapter1_5(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>()
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 6000)
    .add(Chapter1Anchor.START, 320, straightRowBeat(5, 0, 260))
    .add(Chapter1Anchor.START, 780, mixedStraightSineBeat(4, -105, 160, 125, 90))
    .add(Chapter1Anchor.START, 1320, mixedStraightSineBeat(4, 105, 160, -125, 90))
    .add(Chapter1Anchor.START, 1900, mixedDiverSineBeat(4, 68, 0, 130))
    .add(Chapter1Anchor.START, 2240, straightRowBeat(4, -120, 150))
    .add(Chapter1Anchor.START, 2540, swarmClusterBeat('light'))
    .add(Chapter1Anchor.START, 2920, mirrorSineBeat(125, -125, 80))
    .add(Chapter1Anchor.START, 3300, straightRowBeat(6, 0, 280))
    .add(Chapter1Anchor.START, 3960, mixedSineDiverBeat(-145, 0, 145, 70, 140, -150, 120))
    .add(Chapter1Anchor.START, 4340, diverVBeat(4, 62))
    .add(Chapter1Anchor.START, 4720, mixedStraightDiverBeat(5, -95, 180, 145, 100))
    .add(Chapter1Anchor.START, 5120, mixedStraightSineBeat(4, 110, 150, -125, 90))
    .add(Chapter1Anchor.START, 5460, swarmClusterBeat('heavy'))
    .add(Chapter1Anchor.MID, 100, straightRowBeat(5, 0, 250))
    .add(Chapter1Anchor.MID, 820, mixedDiverSineBeat(5, 58, 0, 140))
    .add(Chapter1Anchor.MID, 1240, mirrorSineBeat(-130, 130, 80))
    .add(Chapter1Anchor.MID, 1600, dualStraightSineRowBeat(4, 115, 160, 3, -115, 160))
    .add(Chapter1Anchor.MID, 2420, swarmClusterBeat('finale'))
    .add(Chapter1Anchor.MID, 3020, mixedStraightSineBeat(4, -120, 160, 130, 100))
    .add(Chapter1Anchor.MID, 3400, mixedStraightDualDiverBeat(6, 0, 270, 150, -150, 100))
    .add(Chapter1Anchor.MID, 3920, straightRowBeat(5, 0, 240))
    .add(Chapter1Anchor.MID, 4300, mixedMirrorSineDiverVBeat(135, -135, 70, 3, 70))
    .add(Chapter1Anchor.MID, 4840, dualStraightSineRowBeat(4, -105, 150, 2, 110, 140));
}

const CHAPTER_1_BEATS = {
  '1-1': chapter1_1,
  '1-2': chapter1_2,
  '1-3': chapter1_3,
  '1-4': chapter1_4,
  '1-5': chapter1_5,
} as const;

/**
 * Builds standard WaveEntry list for any Chapter 1 sub-level.
 * Implements the centralized Chapter 1 Wave Grammar.
 */
export function buildChapter1Waves(levelId: string): WaveEntry[] {
  const timelineFn = CHAPTER_1_BEATS[levelId as keyof typeof CHAPTER_1_BEATS];
  if (!timelineFn) {
    throw new Error(`Unknown Chapter 1 level: ${levelId}`);
  }
  return timelineFn().build();
}
