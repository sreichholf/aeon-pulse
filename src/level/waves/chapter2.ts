import {
  SPAWN_X,
  rowRel,
  vFormRel,
  clusterRel,
  CORRIDOR_REFERENCE_HALF_HEIGHT,
  type RelativeOffset,
} from './helpers.ts';
import { EnemyType } from '../../types.ts';
import type { CorridorResolver } from '../CorridorResolver.ts';
import { spawnEnemyEvent, type WaveEntry } from '../StageEvents.ts';
import { Timeline, BeatType, type BeatPattern } from './Timeline.ts';

const REL_H = CORRIDOR_REFERENCE_HALF_HEIGHT;
const REL_H_FULL = REL_H * 2;

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

export function turretBeat(y: number, dx = 0): BeatPattern {
  const yRel = y / REL_H;
  return {
    name: BeatType.TURRET,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.TURRET, at + SPAWN_X + dx, yRel)),
    ],
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

function toRelativeOffsets(offsets: { dx: number; dy: number }[]): RelativeOffset[] {
  return offsets.map((o) => ({ dx: o.dx, dy: o.dy / REL_H }));
}

export function swarmClusterBeat(density: 'chokepoint-1' | 'chokepoint-2'): BeatPattern {
  const offsets = density === 'chokepoint-1' ? SWARM_CP_1 : SWARM_CP_2;
  return {
    name: BeatType.SWARM_CLUSTER,
    events: (resolver, at) => clusterRel(resolver, EnemyType.SWARM, at, toRelativeOffsets(offsets), 0, 0),
  };
}

export function sparseSwarmBeat(): BeatPattern {
  return {
    name: BeatType.SWARM_CLUSTER,
    events: (resolver, at) => clusterRel(resolver, EnemyType.SWARM, at, toRelativeOffsets(SWARM_CP_3), 0, 0),
  };
}

export function mixedStraightTurretBeat(count: number, yCenter: number, ySpread: number, turretY: number, turretDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_STRAIGHT_TURRET,
    events: (resolver, at) => [
      ...rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
      spawnEnemyEvent(
        EnemyType.TURRET,
        SPAWN_X + turretDx,
        resolver.getSafeSpawnY(EnemyType.TURRET, at + SPAWN_X + turretDx, turretY / REL_H),
      ),
    ],
  };
}

export function mixedSupportSineTurretBeat(sineY: number, sineDx: number, turretY: number, turretDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_MIRROR_SINE_TURRET,
    events: (resolver, at) => [
      spawnEnemyEvent(
        EnemyType.SINE,
        SPAWN_X + sineDx,
        resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X + sineDx, sineY / REL_H),
      ),
      spawnEnemyEvent(
        EnemyType.TURRET,
        SPAWN_X + turretDx,
        resolver.getSafeSpawnY(EnemyType.TURRET, at + SPAWN_X + turretDx, turretY / REL_H),
      ),
    ],
  };
}

export function multiChargerBeat(chargers: { y: number; dx: number }[]): BeatPattern {
  return {
    name: BeatType.MULTI_CHARGER,
    events: (resolver, at) =>
      chargers.map(({ y, dx }) =>
        spawnEnemyEvent(
          EnemyType.CHARGER,
          SPAWN_X + dx,
          resolver.getSafeSpawnY(EnemyType.CHARGER, at + SPAWN_X + dx, y / REL_H),
        )
      ),
  };
}

export function mixedTurretChargerBeat(turretY: number, turretDx: number, chargerY: number, chargerDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_TURRET_CHARGER,
    events: (resolver, at) => [
      spawnEnemyEvent(
        EnemyType.TURRET,
        SPAWN_X + turretDx,
        resolver.getSafeSpawnY(EnemyType.TURRET, at + SPAWN_X + turretDx, turretY / REL_H),
      ),
      spawnEnemyEvent(
        EnemyType.CHARGER,
        SPAWN_X + chargerDx,
        resolver.getSafeSpawnY(EnemyType.CHARGER, at + SPAWN_X + chargerDx, chargerY / REL_H),
      ),
    ],
  };
}

export function mixedSupportSineChargerBeat(sineY: number, sineDx: number, chargerY: number, chargerDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_SINE_CHARGER,
    events: (resolver, at) => [
      spawnEnemyEvent(
        EnemyType.SINE,
        SPAWN_X + sineDx,
        resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X + sineDx, sineY / REL_H),
      ),
      spawnEnemyEvent(
        EnemyType.CHARGER,
        SPAWN_X + chargerDx,
        resolver.getSafeSpawnY(EnemyType.CHARGER, at + SPAWN_X + chargerDx, chargerY / REL_H),
      ),
    ],
  };
}

export function mixedStraightSineBeat(count: number, yCenter: number, ySpread: number, sineY: number, sineDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_STRAIGHT_SINE,
    events: (resolver, at) => [
      ...rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
      spawnEnemyEvent(
        EnemyType.SINE,
        SPAWN_X + sineDx,
        resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X + sineDx, sineY / REL_H),
      ),
    ],
  };
}

export function dualDiverSineRowBeat(diverCount: number, diverYStep: number, sineCount: number, sineY: number, sineSpread: number): BeatPattern {
  return {
    name: BeatType.DUAL_DIVER_SINE_ROW,
    events: (resolver, at) => [
      ...vFormRel(resolver, EnemyType.DIVER, at, diverCount, diverYStep / REL_H_FULL),
      ...rowRel(resolver, EnemyType.SINE, at, sineCount, sineY / REL_H, sineSpread / REL_H_FULL),
    ],
  };
}

// --- LEVEL TIMELINES ---

function chapter2_1(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 4800)
    .add(Chapter2Anchor.START, 320, straightRowBeat(5, 0, 270))
    .add(Chapter2Anchor.START, 900, supportSineBeat(110))
    .add(Chapter2Anchor.START, 1360, turretBeat(-150))
    .add(Chapter2Anchor.START, 2040, straightRowBeat(4, 95, 170))
    .add(Chapter2Anchor.START, 2680, mixedStraightTurretBeat(3, -75, 165, 145, 105))
    .add(Chapter2Anchor.START, 3440, mixedStraightSineBeat(4, 0, 240, -125, 120))
    .add(Chapter2Anchor.START, 4200, turretBeat(130, 40))
    .add(Chapter2Anchor.MID, 280, mixedStraightTurretBeat(4, 0, 230, -135, 105))
    .add(Chapter2Anchor.MID, 1100, supportSineBeat(-105, 50))
    .add(Chapter2Anchor.MID, 1680, swarmClusterBeat('chokepoint-1'))
    .add(Chapter2Anchor.MID, 2500, mixedSupportSineTurretBeat(95, 0, 135, 90))
    .add(Chapter2Anchor.MID, 3300, straightRowBeat(5, 0, 260));
}

function chapter2_2(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 5000)
    .add(Chapter2Anchor.START, 300, straightRowBeat(5, 0, 280))
    .add(Chapter2Anchor.START, 780, turretBeat(-150))
    .add(Chapter2Anchor.START, 1400, mixedStraightSineBeat(4, 105, 190, -125, 120))
    .add(Chapter2Anchor.START, 2100, mixedStraightTurretBeat(4, -95, 180, 145, 105))
    .add(Chapter2Anchor.START, 2800, straightRowBeat(5, -85, 190))
    .add(Chapter2Anchor.START, 3460, sparseSwarmBeat())
    .add(Chapter2Anchor.START, 4160, mixedSupportSineTurretBeat(110, 0, -140, 90))
    .add(Chapter2Anchor.MID, 120, straightRowBeat(6, 0, 290))
    .add(Chapter2Anchor.MID, 900, mixedStraightTurretBeat(4, -100, 170, 135, 115))
    .add(Chapter2Anchor.MID, 1640, supportSineBeat(-95, 60))
    .add(Chapter2Anchor.MID, 2240, swarmClusterBeat('chokepoint-2'))
    .add(Chapter2Anchor.MID, 2960, mixedSupportSineTurretBeat(95, 0, -130, 90))
    .add(Chapter2Anchor.MID, 3780, dualDiverSineRowBeat(3, 82, 1, 0, 0));
}

function chapter2_3(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 5000)
    .add(Chapter2Anchor.START, 320, straightRowBeat(5, 0, 270))
    .add(Chapter2Anchor.START, 900, mixedSupportSineTurretBeat(120, 0, -145, 90))
    .add(Chapter2Anchor.START, 1660, chargerBeat(0))
    .add(Chapter2Anchor.START, 2440, straightRowBeat(4, 95, 190))
    .add(Chapter2Anchor.START, 3160, mixedStraightTurretBeat(4, -95, 190, 140, 115))
    .add(Chapter2Anchor.START, 3940, mixedSupportSineChargerBeat(-120, 0, 40, 120))
    .add(Chapter2Anchor.MID, 120, supportSineBeat(95))
    .add(Chapter2Anchor.MID, 820, mixedTurretChargerBeat(-135, 70, 45, 170))
    .add(Chapter2Anchor.MID, 1660, sparseSwarmBeat())
    .add(Chapter2Anchor.MID, 2420, mixedStraightSineBeat(5, 0, 250, -110, 120))
    .add(Chapter2Anchor.MID, 3200, chargerBeat(0, 90))
    .add(Chapter2Anchor.MID, 3980, dualDiverSineRowBeat(3, 82, 1, 0, 0));
}

function chapter2_4(): Timeline<Chapter2Anchor> {
  return new Timeline<Chapter2Anchor>(0.65)
    .anchor(Chapter2Anchor.START, 0)
    .anchor(Chapter2Anchor.MID, 6100)
    .add(Chapter2Anchor.START, 300, straightRowBeat(5, 0, 280))
    .add(Chapter2Anchor.START, 820, mixedStraightTurretBeat(4, -100, 190, 145, 105))
    .add(Chapter2Anchor.START, 1560, mixedSupportSineChargerBeat(120, 0, -20, 110))
    .add(Chapter2Anchor.START, 2360, straightRowBeat(5, 95, 200))
    .add(Chapter2Anchor.START, 3120, mixedSupportSineTurretBeat(-115, 0, -140, 60))
    .add(Chapter2Anchor.START, 3940, multiChargerBeat([
      { y: 45, dx: 0 },
      { y: -45, dx: 140 },
    ]))
    .add(Chapter2Anchor.START, 4820, sparseSwarmBeat())
    .add(Chapter2Anchor.START, 5600, mixedStraightTurretBeat(5, 0, 240, 135, 125))
    .add(Chapter2Anchor.MID, 220, mixedSupportSineTurretBeat(105, 0, -135, 110))
    .add(Chapter2Anchor.MID, 1100, straightRowBeat(6, 0, 290))
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
    .add(Chapter2Anchor.START, 300, straightRowBeat(5, 0, 280))
    .add(Chapter2Anchor.START, 820, mixedStraightTurretBeat(4, -105, 190, 145, 105))
    .add(Chapter2Anchor.START, 1480, mixedSupportSineChargerBeat(115, 0, 0, 110))
    .add(Chapter2Anchor.START, 2260, sparseSwarmBeat())
    .add(Chapter2Anchor.START, 2980, mixedSupportSineTurretBeat(-110, 0, -140, 90))
    .add(Chapter2Anchor.START, 3780, multiChargerBeat([
      { y: 45, dx: 0 },
      { y: -45, dx: 140 },
    ]))
    .add(Chapter2Anchor.START, 4620, mixedStraightTurretBeat(5, 0, 250, 135, 115))
    .add(Chapter2Anchor.START, 5360, swarmClusterBeat('chokepoint-1'))
    .add(Chapter2Anchor.MID, 180, straightRowBeat(6, 0, 290))
    .add(Chapter2Anchor.MID, 920, mixedTurretChargerBeat(-135, 70, 50, 170))
    .add(Chapter2Anchor.MID, 1760, mixedStraightSineBeat(5, -90, 200, 120, 130))
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
export function buildChapter2Waves(levelId: string, resolver: CorridorResolver): WaveEntry[] {
  const timelineFn = CHAPTER_2_BEATS[levelId as keyof typeof CHAPTER_2_BEATS];
  if (!timelineFn) {
    throw new Error(`Unknown Chapter 2 level: ${levelId}`);
  }
  return timelineFn().build(resolver);
}
