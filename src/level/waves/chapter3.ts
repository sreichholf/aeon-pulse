import { SPAWN_X, row, vForm, cluster, SWARM_SM } from './helpers.ts';
import { EnemyType } from '../../types.ts';
import { spawnEnemyEvent, type WaveEntry } from '../StageEvents.ts';
import { Timeline, BeatType, type BeatPattern } from './Timeline.ts';

// --- ANCHORS ENUM ---
export enum Chapter3Anchor {
  START = 'start',
  MID = 'mid',
}

const DANGEROUS_SWARM_OFFSETS = [
  { dx:  0, dy: 0 }, { dx: 55, dy: -50 }, { dx: 55, dy: 50 },
];

const LIGHT_SWARM_OFFSETS = [
  { dx:   0, dy:   0 },
  { dx:  60, dy: -55 },
  { dx: 120, dy:  55 },
  { dx: 180, dy:   0 },
];

// --- BEAT BUILDERS ---

export function straightRowBeat(count: number, yCenter: number, ySpread: number): BeatPattern {
  return {
    name: BeatType.STRAIGHT_ROW,
    events: row(EnemyType.STRAIGHT, count, yCenter, ySpread),
  };
}

export function sineRowBeat(count: number, yCenter: number, ySpread: number): BeatPattern {
  return {
    name: BeatType.SINE_ROW,
    events: row(EnemyType.SINE, count, yCenter, ySpread),
  };
}

export function mirrorSporeBeat(yA: number, yB: number, dx = 80): BeatPattern {
  return {
    name: BeatType.MIRROR_SPORE,
    events: [
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, yA),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + dx, yB),
    ],
  };
}

export function obstaclePairBeat(yA: number, yB: number, dx = 40): BeatPattern {
  return {
    name: BeatType.OBSTACLE_PAIR,
    events: [
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + dx, yA),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + dx, yB),
    ],
  };
}

export function obstacleGateBeat(y: number, dx = 40): BeatPattern {
  return {
    name: BeatType.OBSTACLE_PAIR,
    events: [spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + dx, y)],
  };
}

export function swarmClusterBeat(): BeatPattern {
  return {
    name: BeatType.SWARM_CLUSTER,
    events: cluster(EnemyType.SWARM, SWARM_SM, 0, 0),
  };
}

export function lightSwarmBeat(): BeatPattern {
  return {
    name: BeatType.SWARM_CLUSTER,
    events: cluster(EnemyType.SWARM, LIGHT_SWARM_OFFSETS, 0, 0),
  };
}

export function mixedMirrorSporeObstacleBeat(yA: number, yB: number, sporeDx: number, obstacleY: number, obstacleDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_MIRROR_SPORE_OBSTACLE,
    events: [
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, yA),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + sporeDx, yB),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + obstacleDx, obstacleY),
    ],
  };
}

export function diverVBeat(count: number, yStep: number): BeatPattern {
  return {
    name: BeatType.DIVER_V,
    events: vForm(EnemyType.DIVER, count, yStep),
  };
}

export function chargerBeat(y: number, dx = 0): BeatPattern {
  return {
    name: BeatType.CHARGER,
    events: [spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X + dx, y)],
  };
}

export function dangerousSporeSwarmComboBeat(): BeatPattern {
  return {
    name: BeatType.DANGEROUS_SPORE_SWARM_COMBO,
    events: [
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, 0),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + 100, 90),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + 100, -90),
      ...cluster(EnemyType.SWARM, DANGEROUS_SWARM_OFFSETS, 200, 0),
    ],
  };
}

export function mixedChargerObstacleBeat(
  chargerYA: number, chargerYB: number, chargerDx: number,
  obstacleY: number, obstacleDx: number
): BeatPattern {
  return {
    name: BeatType.MIXED_CHARGER_OBSTACLE, // wait, wait! The enum is MIXED_CHARGER_OBSTACLE, let's fix the typo in name!
    events: [
      spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X, chargerYA),
      spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X + chargerDx, chargerYB),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + obstacleDx, obstacleY),
    ],
  };
}

export function mixedStraightObstacleBeat(count: number, yCenter: number, ySpread: number, obstacleY: number, obstacleDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_MIRROR_SPORE_OBSTACLE,
    events: [
      ...row(EnemyType.STRAIGHT, count, yCenter, ySpread),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + obstacleDx, obstacleY),
    ],
  };
}

export function mixedSineObstacleBeat(count: number, yCenter: number, ySpread: number, obstacleY: number, obstacleDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_MIRROR_SPORE_OBSTACLE,
    events: [
      ...row(EnemyType.SINE, count, yCenter, ySpread),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + obstacleDx, obstacleY),
    ],
  };
}

export function sporeTriadBeat(yA: number, yB: number, yC: number, dx = 120): BeatPattern {
  return {
    name: BeatType.SPORE_TRIAD,
    events: [
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, yA),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, yB),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + dx, yC),
    ],
  };
}

// --- LEVEL TIMELINES ---

function chapter3_1(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 5000)
    .add(Chapter3Anchor.START, 300, sineRowBeat(5, 0, 250))
    .add(Chapter3Anchor.START, 860, straightRowBeat(5, -85, 170))
    .add(Chapter3Anchor.START, 1460, obstacleGateBeat(0, 60))
    .add(Chapter3Anchor.START, 2180, sineRowBeat(4, 95, 170))
    .add(Chapter3Anchor.START, 2860, mixedStraightObstacleBeat(4, -95, 160, 135, 80))
    .add(Chapter3Anchor.START, 3600, diverVBeat(4, 70))
    .add(Chapter3Anchor.START, 4320, obstaclePairBeat(145, -45, 50))
    .add(Chapter3Anchor.MID, 160, sineRowBeat(5, 0, 240))
    .add(Chapter3Anchor.MID, 900, mixedSineObstacleBeat(4, 100, 160, -135, 90))
    .add(Chapter3Anchor.MID, 1680, straightRowBeat(5, 0, 230))
    .add(Chapter3Anchor.MID, 2460, obstacleGateBeat(0, 70))
    .add(Chapter3Anchor.MID, 3220, diverVBeat(4, 66));
}

function chapter3_2(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 5200)
    .add(Chapter3Anchor.START, 300, sineRowBeat(5, 0, 260))
    .add(Chapter3Anchor.START, 840, mixedStraightObstacleBeat(4, -100, 160, 135, 80))
    .add(Chapter3Anchor.START, 1540, diverVBeat(4, 70))
    .add(Chapter3Anchor.START, 2260, obstaclePairBeat(145, -45, 60))
    .add(Chapter3Anchor.START, 3000, chargerBeat(20))
    .add(Chapter3Anchor.START, 3760, sineRowBeat(5, 85, 170))
    .add(Chapter3Anchor.START, 4520, mixedSineObstacleBeat(4, -95, 160, 135, 90))
    .add(Chapter3Anchor.MID, 220, straightRowBeat(6, 0, 260))
    .add(Chapter3Anchor.MID, 1020, mixedChargerObstacleBeat(45, -45, 120, -145, 80))
    .add(Chapter3Anchor.MID, 1860, sineRowBeat(5, 0, 240))
    .add(Chapter3Anchor.MID, 2680, obstaclePairBeat(140, -40, 60))
    .add(Chapter3Anchor.MID, 3500, diverVBeat(5, 60));
}

function chapter3_3(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 5300)
    .add(Chapter3Anchor.START, 320, sineRowBeat(5, 0, 250))
    .add(Chapter3Anchor.START, 920, obstacleGateBeat(0, 70))
    .add(Chapter3Anchor.START, 1660, mirrorSporeBeat(90, -90, 90))
    .add(Chapter3Anchor.START, 2460, straightRowBeat(5, 0, 240))
    .add(Chapter3Anchor.START, 3220, mixedMirrorSporeObstacleBeat(70, -70, 100, 145, 80))
    .add(Chapter3Anchor.START, 4020, chargerBeat(-30, 80))
    .add(Chapter3Anchor.START, 4800, sineRowBeat(4, 100, 170))
    .add(Chapter3Anchor.MID, 180, sporeTriadBeat(110, -110, 0, 120))
    .add(Chapter3Anchor.MID, 940, mixedSineObstacleBeat(4, -95, 160, 140, 80))
    .add(Chapter3Anchor.MID, 1740, mirrorSporeBeat(80, -80, 100))
    .add(Chapter3Anchor.MID, 2540, diverVBeat(4, 66))
    .add(Chapter3Anchor.MID, 3360, mixedMirrorSporeObstacleBeat(75, -75, 110, -145, 80))
    .add(Chapter3Anchor.MID, 4200, sineRowBeat(5, 0, 240))
    .add(Chapter3Anchor.MID, 5000, mixedMirrorSporeObstacleBeat(80, -80, 110, 140, 90));
}

function chapter3_4(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 6400)
    .add(Chapter3Anchor.START, 300, sineRowBeat(5, 0, 260))
    .add(Chapter3Anchor.START, 900, mixedStraightObstacleBeat(5, -95, 170, 140, 90))
    .add(Chapter3Anchor.START, 1700, chargerBeat(25))
    .add(Chapter3Anchor.START, 2500, mirrorSporeBeat(90, -90, 90))
    .add(Chapter3Anchor.START, 3300, straightRowBeat(5, 0, 240))
    .add(Chapter3Anchor.START, 4100, obstaclePairBeat(145, -45, 60))
    .add(Chapter3Anchor.START, 5000, mixedChargerObstacleBeat(45, -45, 120, -140, 90))
    .add(Chapter3Anchor.START, 5900, sineRowBeat(4, 95, 180))
    .add(Chapter3Anchor.MID, 260, sporeTriadBeat(110, -110, 0, 120))
    .add(Chapter3Anchor.MID, 1120, lightSwarmBeat())
    .add(Chapter3Anchor.MID, 1980, mixedMirrorSporeObstacleBeat(75, -75, 110, 140, 90))
    .add(Chapter3Anchor.MID, 2880, diverVBeat(5, 58))
    .add(Chapter3Anchor.MID, 3760, mixedChargerObstacleBeat(-55, 55, 130, -140, 90))
    .add(Chapter3Anchor.MID, 4620, mirrorSporeBeat(95, -95, 100));
}

function chapter3_5(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 6200)
    .add(Chapter3Anchor.START, 300, sineRowBeat(5, 0, 260))
    .add(Chapter3Anchor.START, 900, mixedStraightObstacleBeat(5, -95, 170, 140, 90))
    .add(Chapter3Anchor.START, 1620, mirrorSporeBeat(90, -90, 90))
    .add(Chapter3Anchor.START, 2360, chargerBeat(20))
    .add(Chapter3Anchor.START, 3140, obstaclePairBeat(145, -45, 60))
    .add(Chapter3Anchor.START, 3940, sporeTriadBeat(110, -110, 0, 120))
    .add(Chapter3Anchor.START, 4700, lightSwarmBeat())
    .add(Chapter3Anchor.START, 5480, mixedMirrorSporeObstacleBeat(70, -70, 110, 145, 90))
    .add(Chapter3Anchor.MID, 220, straightRowBeat(6, 0, 260))
    .add(Chapter3Anchor.MID, 980, mixedChargerObstacleBeat(45, -45, 130, -140, 90))
    .add(Chapter3Anchor.MID, 1780, mirrorSporeBeat(95, -95, 100))
    .add(Chapter3Anchor.MID, 2540, dangerousSporeSwarmComboBeat())
    .add(Chapter3Anchor.MID, 3380, diverVBeat(5, 58))
    .add(Chapter3Anchor.MID, 4200, mixedMirrorSporeObstacleBeat(75, -75, 110, -140, 90))
    .add(Chapter3Anchor.MID, 4980, dangerousSporeSwarmComboBeat())
    .add(Chapter3Anchor.MID, 5560, sporeTriadBeat(100, -100, 0, 120));
}

const CHAPTER_3_BEATS = {
  '3-1': chapter3_1,
  '3-2': chapter3_2,
  '3-3': chapter3_3,
  '3-4': chapter3_4,
  '3-5': chapter3_5,
} as const;

/**
 * Builds standard WaveEntry list for any Chapter 3 sub-level.
 * Implements the centralized Chapter 3 Wave Grammar.
 */
export function buildChapter3Waves(levelId: string): WaveEntry[] {
  const timelineFn = CHAPTER_3_BEATS[levelId as keyof typeof CHAPTER_3_BEATS];
  if (!timelineFn) {
    throw new Error(`Unknown Chapter 3 level: ${levelId}`);
  }
  return timelineFn().build();
}
