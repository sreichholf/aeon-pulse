import {
  SPAWN_X,
  rowRel,
  vFormRel,
  clusterRel,
  CORRIDOR_REFERENCE_HALF_HEIGHT,
  SWARM_SM,
  type RelativeOffset,
} from './helpers.ts';
import { EnemyType } from '../../types.ts';
import type { CorridorResolver } from '../CorridorResolver.ts';
import { spawnEnemyEvent, type WaveEntry } from '../StageEvents.ts';
import { Timeline, BeatType, type BeatPattern } from './Timeline.ts';

const REL_H = CORRIDOR_REFERENCE_HALF_HEIGHT;
const REL_H_FULL = REL_H * 2;

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

function toRelativeOffsets(offsets: { dx: number; dy: number }[]): RelativeOffset[] {
  return offsets.map((o) => ({ dx: o.dx, dy: o.dy / REL_H }));
}

// --- BEAT BUILDERS ---

export function straightRowBeat(count: number, yCenter: number, ySpread: number): BeatPattern {
  return {
    name: BeatType.STRAIGHT_ROW,
    events: (resolver, at) =>
      rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
  };
}

export function supportSineBeat(y: number, dx = 0): BeatPattern {
  const yRel = y / REL_H;
  return {
    name: BeatType.SINE_ROW,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X + dx, yRel)),
    ],
  };
}

export function mirrorSporeBeat(yA: number, yB: number, dx = 80): BeatPattern {
  const yARel = yA / REL_H;
  const yBRel = yB / REL_H;
  return {
    name: BeatType.MIRROR_SPORE,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X, yARel)),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X + dx, yBRel)),
    ],
  };
}

export function obstaclePairBeat(yA: number, yB: number, dx = 40): BeatPattern {
  const yARel = yA / REL_H;
  const yBRel = yB / REL_H;
  return {
    name: BeatType.OBSTACLE_PAIR,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.OBSTACLE, at + SPAWN_X + dx, yARel)),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.OBSTACLE, at + SPAWN_X + dx, yBRel)),
    ],
  };
}

export function obstacleGateBeat(y: number, dx = 40): BeatPattern {
  const yRel = y / REL_H;
  return {
    name: BeatType.OBSTACLE_PAIR,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.OBSTACLE, at + SPAWN_X + dx, yRel)),
    ],
  };
}

export function swarmClusterBeat(): BeatPattern {
  return {
    name: BeatType.SWARM_CLUSTER,
    events: (resolver, at) => clusterRel(resolver, EnemyType.SWARM, at, toRelativeOffsets(SWARM_SM), 0, 0),
  };
}

export function lightSwarmBeat(): BeatPattern {
  return {
    name: BeatType.SWARM_CLUSTER,
    events: (resolver, at) => clusterRel(resolver, EnemyType.SWARM, at, toRelativeOffsets(LIGHT_SWARM_OFFSETS), 0, 0),
  };
}

export function recoveryGapBeat(): BeatPattern {
  return {
    name: BeatType.RECOVERY_GAP,
    events: [],
  };
}

export function mixedMirrorSporeObstacleBeat(yA: number, yB: number, sporeDx: number, obstacleY: number, obstacleDx: number): BeatPattern {
  const yARel = yA / REL_H;
  const yBRel = yB / REL_H;
  const obstacleYRel = obstacleY / REL_H;
  return {
    name: BeatType.MIXED_MIRROR_SPORE_OBSTACLE,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X, yARel)),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + sporeDx, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X + sporeDx, yBRel)),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + obstacleDx, resolver.getSafeSpawnY(EnemyType.OBSTACLE, at + SPAWN_X + obstacleDx, obstacleYRel)),
    ],
  };
}

export function diverVBeat(count: number, yStep: number): BeatPattern {
  return {
    name: BeatType.DIVER_V,
    events: (resolver, at) => vFormRel(resolver, EnemyType.DIVER, at, count, yStep / REL_H_FULL),
  };
}

export function chargerBeat(y: number, dx = 0): BeatPattern {
  const yRel = y / REL_H;
  return {
    name: BeatType.CHARGER,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.CHARGER, at + SPAWN_X + dx, yRel)),
    ],
  };
}

export function dangerousSporeSwarmComboBeat(): BeatPattern {
  return {
    name: BeatType.DANGEROUS_SPORE_SWARM_COMBO,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X, 0)),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + 100, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X + 100, 90 / REL_H)),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + 100, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X + 100, -90 / REL_H)),
      ...clusterRel(resolver, EnemyType.SWARM, at, toRelativeOffsets(DANGEROUS_SWARM_OFFSETS), 200 / REL_H, 0),
    ],
  };
}

export function sporeTriadSwarmBeat(): BeatPattern {
  return {
    name: BeatType.DANGEROUS_SPORE_SWARM_COMBO,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X, 110 / REL_H)),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X, -110 / REL_H)),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + 120, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X + 120, 0)),
      ...clusterRel(resolver, EnemyType.SWARM, at, toRelativeOffsets(DANGEROUS_SWARM_OFFSETS), 240 / REL_H, 0),
    ],
  };
}

export function mixedChargerObstacleBeat(
  chargerYA: number, chargerYB: number, chargerDx: number,
  obstacleY: number, obstacleDx: number
): BeatPattern {
  const chargerYARel = chargerYA / REL_H;
  const chargerYBRel = chargerYB / REL_H;
  const obstacleYRel = obstacleY / REL_H;
  return {
    name: BeatType.MIXED_CHARGER_OBSTACLE,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X, resolver.getSafeSpawnY(EnemyType.CHARGER, at + SPAWN_X, chargerYARel)),
      spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X + chargerDx, resolver.getSafeSpawnY(EnemyType.CHARGER, at + SPAWN_X + chargerDx, chargerYBRel)),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + obstacleDx, resolver.getSafeSpawnY(EnemyType.OBSTACLE, at + SPAWN_X + obstacleDx, obstacleYRel)),
    ],
  };
}

export function mixedStraightObstacleBeat(count: number, yCenter: number, ySpread: number, obstacleY: number, obstacleDx: number): BeatPattern {
  const obstacleYRel = obstacleY / REL_H;
  return {
    name: BeatType.MIXED_STRAIGHT_OBSTACLE,
    events: (resolver, at) => [
      ...rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + obstacleDx, resolver.getSafeSpawnY(EnemyType.OBSTACLE, at + SPAWN_X + obstacleDx, obstacleYRel)),
    ],
  };
}

export function mixedSupportSineObstacleBeat(sineY: number, sineDx: number, obstacleY: number, obstacleDx: number): BeatPattern {
  const sineYRel = sineY / REL_H;
  const obstacleYRel = obstacleY / REL_H;
  return {
    name: BeatType.MIXED_SINE_OBSTACLE,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X + sineDx, sineYRel)),
      spawnEnemyEvent(EnemyType.OBSTACLE, SPAWN_X + obstacleDx, resolver.getSafeSpawnY(EnemyType.OBSTACLE, at + SPAWN_X + obstacleDx, obstacleYRel)),
    ],
  };
}

export function mixedStraightSporeBeat(count: number, yCenter: number, ySpread: number, sporeY: number, sporeDx: number): BeatPattern {
  const sporeYRel = sporeY / REL_H;
  return {
    name: BeatType.MIXED_STRAIGHT_SPORE,
    events: (resolver, at) => [
      ...rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + sporeDx, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X + sporeDx, sporeYRel)),
    ],
  };
}

export function sporeTriadBeat(yA: number, yB: number, yC: number, dx = 120): BeatPattern {
  const yARel = yA / REL_H;
  const yBRel = yB / REL_H;
  const yCRel = yC / REL_H;
  return {
    name: BeatType.SPORE_TRIAD,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X, yARel)),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X, yBRel)),
      spawnEnemyEvent(EnemyType.SPORE, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.SPORE, at + SPAWN_X + dx, yCRel)),
    ],
  };
}

// --- LEVEL TIMELINES ---

function chapter3_1(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 5000)
    .add(Chapter3Anchor.START, 300, straightRowBeat(5, 0, 260))
    .add(Chapter3Anchor.START, 920, obstacleGateBeat(0, 60))
    .add(Chapter3Anchor.START, 1660, mixedSupportSineObstacleBeat(100, 0, -135, 90))
    .add(Chapter3Anchor.START, 2440, mixedStraightObstacleBeat(4, -95, 180, 140, 105))
    .add(Chapter3Anchor.START, 3240, diverVBeat(4, 70))
    .add(Chapter3Anchor.START, 4040, obstaclePairBeat(145, -45, 50))
    .add(Chapter3Anchor.MID, 180, supportSineBeat(-95, 40))
    .add(Chapter3Anchor.MID, 900, straightRowBeat(5, 0, 250))
    .add(Chapter3Anchor.MID, 1700, mixedSupportSineObstacleBeat(-110, 0, 135, 80))
    .add(Chapter3Anchor.MID, 2520, obstacleGateBeat(0, 70))
    .add(Chapter3Anchor.MID, 3340, diverVBeat(4, 66));
}

function chapter3_2(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 5200)
    .add(Chapter3Anchor.START, 300, mixedStraightObstacleBeat(4, -100, 180, 135, 95))
    .add(Chapter3Anchor.START, 1060, diverVBeat(4, 70))
    .add(Chapter3Anchor.START, 1820, mirrorSporeBeat(100, -100, 100))
    .add(Chapter3Anchor.START, 2620, mixedStraightSporeBeat(4, 0, 240, -115, 120))
    .add(Chapter3Anchor.START, 3420, chargerBeat(20))
    .add(Chapter3Anchor.START, 4200, mixedSupportSineObstacleBeat(95, 0, -140, 90))
    .add(Chapter3Anchor.MID, 220, straightRowBeat(6, 0, 280))
    .add(Chapter3Anchor.MID, 1040, mirrorSporeBeat(95, -95, 100))
    .add(Chapter3Anchor.MID, 1880, mixedChargerObstacleBeat(45, -45, 120, -145, 80))
    .add(Chapter3Anchor.MID, 2760, obstaclePairBeat(140, -40, 60))
    .add(Chapter3Anchor.MID, 3600, diverVBeat(5, 60));
}

function chapter3_3(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 5300)
    .add(Chapter3Anchor.START, 320, obstacleGateBeat(0, 70))
    .add(Chapter3Anchor.START, 1040, mirrorSporeBeat(90, -90, 90))
    .add(Chapter3Anchor.START, 1840, straightRowBeat(5, 0, 260))
    .add(Chapter3Anchor.START, 2620, mixedMirrorSporeObstacleBeat(70, -70, 100, 145, 80))
    .add(Chapter3Anchor.START, 3460, chargerBeat(-30, 80))
    .add(Chapter3Anchor.START, 4240, supportSineBeat(105))
    .add(Chapter3Anchor.MID, 180, sporeTriadBeat(110, -110, 0, 120))
    .add(Chapter3Anchor.MID, 980, mixedSupportSineObstacleBeat(-95, 0, 140, 80))
    .add(Chapter3Anchor.MID, 1800, mirrorSporeBeat(80, -80, 100))
    .add(Chapter3Anchor.MID, 2620, diverVBeat(4, 66))
    .add(Chapter3Anchor.MID, 3460, mixedMirrorSporeObstacleBeat(75, -75, 110, -145, 80))
    .add(Chapter3Anchor.MID, 4320, mixedStraightSporeBeat(5, 0, 250, 120, 130))
    .add(Chapter3Anchor.MID, 5140, mixedMirrorSporeObstacleBeat(80, -80, 110, 140, 90));
}

function chapter3_4(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 6400)
    .add(Chapter3Anchor.START, 300, mixedStraightObstacleBeat(5, -95, 190, 140, 105))
    .add(Chapter3Anchor.START, 1120, chargerBeat(25))
    .add(Chapter3Anchor.START, 1940, mirrorSporeBeat(90, -90, 90))
    .add(Chapter3Anchor.START, 2760, mixedStraightSporeBeat(5, 0, 250, -120, 130))
    .add(Chapter3Anchor.START, 3600, obstaclePairBeat(145, -45, 60))
    .add(Chapter3Anchor.START, 4480, mixedChargerObstacleBeat(45, -45, 135, -140, 90))
    .add(Chapter3Anchor.START, 5340, mixedSupportSineObstacleBeat(100, 0, -135, 90))
    .add(Chapter3Anchor.MID, 260, sporeTriadBeat(110, -110, 0, 120))
    .add(Chapter3Anchor.MID, 1140, lightSwarmBeat())
    .add(Chapter3Anchor.MID, 2020, mixedMirrorSporeObstacleBeat(75, -75, 110, 140, 90))
    .add(Chapter3Anchor.MID, 2940, mixedStraightSporeBeat(5, -85, 200, 120, 135))
    .add(Chapter3Anchor.MID, 3860, mixedChargerObstacleBeat(-55, 55, 145, -140, 90))
    .add(Chapter3Anchor.MID, 4740, mixedSupportSineObstacleBeat(-100, 0, 140, 90))
    .add(Chapter3Anchor.MID, 5480, diverVBeat(5, 58));
}

function chapter3_5(): Timeline<Chapter3Anchor> {
  return new Timeline<Chapter3Anchor>(0.65)
    .anchor(Chapter3Anchor.START, 0)
    .anchor(Chapter3Anchor.MID, 6200)
    .add(Chapter3Anchor.START, 300, mixedStraightObstacleBeat(5, -95, 190, 140, 105))
    .add(Chapter3Anchor.START, 1100, mirrorSporeBeat(90, -90, 90))
    .add(Chapter3Anchor.START, 1920, chargerBeat(20))
    .add(Chapter3Anchor.START, 2720, obstaclePairBeat(145, -45, 60))
    .add(Chapter3Anchor.START, 3520, sporeTriadBeat(110, -110, 0, 120))
    .add(Chapter3Anchor.START, 4320, recoveryGapBeat())
    .add(Chapter3Anchor.START, 5120, mixedMirrorSporeObstacleBeat(70, -70, 110, 145, 90))
    .add(Chapter3Anchor.MID, 220, straightRowBeat(6, 0, 280))
    .add(Chapter3Anchor.MID, 1040, mixedChargerObstacleBeat(45, -45, 130, -140, 90))
    .add(Chapter3Anchor.MID, 1880, mirrorSporeBeat(95, -95, 100))
    .add(Chapter3Anchor.MID, 2700, dangerousSporeSwarmComboBeat())
    .add(Chapter3Anchor.MID, 3560, recoveryGapBeat())
    .add(Chapter3Anchor.MID, 4400, mixedSupportSineObstacleBeat(100, 0, -140, 90))
    .add(Chapter3Anchor.MID, 5160, sporeTriadSwarmBeat())
    .add(Chapter3Anchor.MID, 5780, sporeTriadBeat(100, -100, 0, 120));
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
export function buildChapter3Waves(levelId: string, resolver: CorridorResolver): WaveEntry[] {
  const timelineFn = CHAPTER_3_BEATS[levelId as keyof typeof CHAPTER_3_BEATS];
  if (!timelineFn) {
    throw new Error(`Unknown Chapter 3 level: ${levelId}`);
  }
  return timelineFn().build(resolver);
}
