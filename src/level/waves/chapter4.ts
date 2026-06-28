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
import { lavaPulseEvent, spawnEnemyEvent, type WaveEntry } from '../StageEvents.ts';
import { Timeline, BeatType, type BeatPattern } from './Timeline.ts';

const REL_H = CORRIDOR_REFERENCE_HALF_HEIGHT;
const REL_H_FULL = REL_H * 2;

const STALACTITE_Y_REL = 310 / REL_H;

// --- ANCHORS ENUM ---
export enum Chapter4Anchor {
  START = 'start',
  MID = 'mid',
}

const SWARM_CHOKEPOINT_OFFSETS: RelativeOffset[] = [
  { dx: 0, dy: 20 / REL_H },
  { dx: 60, dy: -20 / REL_H },
  { dx: 120, dy: 0 },
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

export function sinePairBeat(y1: number, y2: number, dx = 120): BeatPattern {
  const y1Rel = y1 / REL_H;
  const y2Rel = y2 / REL_H;
  return {
    name: BeatType.SINE_ROW,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X, y1Rel)),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X + dx, y2Rel)),
    ],
  };
}

export function diverVBeat(count: number, yStep = 72): BeatPattern {
  return {
    name: BeatType.DIVER_V,
    events: (resolver, at) => vFormRel(resolver, EnemyType.DIVER, at, count, yStep / REL_H_FULL),
  };
}

export function mixedStraightSineBeat(count: number, yCenter: number, ySpread: number, sineY: number, sineDx: number): BeatPattern {
  const sineYRel = sineY / REL_H;
  return {
    name: BeatType.MIXED_STRAIGHT_SINE,
    events: (resolver, at) => [
      ...rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X + sineDx, sineYRel)),
    ],
  };
}

export function mixedDiverSineBeat(diverCount: number, diverYStep: number, sineY: number, sineDx: number): BeatPattern {
  const sineYRel = sineY / REL_H;
  return {
    name: BeatType.MIXED_DIVER_SINE,
    events: (resolver, at) => [
      ...vFormRel(resolver, EnemyType.DIVER, at, diverCount, diverYStep / REL_H_FULL),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X + sineDx, sineYRel)),
    ],
  };
}

export function mixedStraightDiverBeat(count: number, yCenter: number, ySpread: number, diverY: number, diverDx: number): BeatPattern {
  const diverYRel = diverY / REL_H;
  return {
    name: BeatType.MIXED_STRAIGHT_DIVER,
    events: (resolver, at) => [
      ...rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
      spawnEnemyEvent(EnemyType.DIVER, SPAWN_X + diverDx, resolver.getSafeSpawnY(EnemyType.DIVER, at + SPAWN_X + diverDx, diverYRel)),
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

export function lavaPulseBeat(): BeatPattern {
  return {
    name: BeatType.LAVA_PULSE,
    events: [lavaPulseEvent()],
  };
}

export function rockDrakeBeat(y: number): BeatPattern {
  const yRel = y / REL_H;
  return {
    name: BeatType.ROCK_DRAKE,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.ROCK_DRAKE, at + SPAWN_X, yRel)),
    ],
  };
}

export function stalactitePairBeat(dxA: number, dxB: number): BeatPattern {
  return {
    name: BeatType.STALACTITE_PAIR,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + dxA, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + dxA, STALACTITE_Y_REL)),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + dxB, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + dxB, STALACTITE_Y_REL)),
    ],
  };
}

export function stalactiteBarrageBeat(dxOffsets: number[]): BeatPattern {
  return {
    name: BeatType.STALACTITE_BARRAGE,
    events: (resolver, at) =>
      dxOffsets.map((dx) => spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + dx, STALACTITE_Y_REL))),
  };
}

export function mixedStalactiteMirrorSineBeat(
  stalactiteDxA: number,
  stalactiteDxB: number,
  sineYA: number,
  sineYB: number,
  sineDx: number,
): BeatPattern {
  const sineYARel = sineYA / REL_H;
  const sineYBRel = sineYB / REL_H;
  return {
    name: BeatType.MIXED_STALACTITE_MIRROR_SINE,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDxA, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + stalactiteDxA, STALACTITE_Y_REL)),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDxB, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + stalactiteDxB, STALACTITE_Y_REL)),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X, sineYARel)),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, resolver.getSafeSpawnY(EnemyType.SINE, at + SPAWN_X + sineDx, sineYBRel)),
    ],
  };
}

export function swarmChokepointBeat(): BeatPattern {
  return {
    name: BeatType.SWARM_CHOKEPOINT,
    events: (resolver, at) => clusterRel(resolver, EnemyType.SWARM, at, SWARM_CHOKEPOINT_OFFSETS, 0, 0),
  };
}

export function recoveryGapBeat(): BeatPattern {
  return {
    name: BeatType.RECOVERY_GAP,
    events: [],
  };
}

export function lavaAndDrakeBeat(drakeY: number): BeatPattern {
  const drakeYRel = drakeY / REL_H;
  return {
    name: BeatType.LAVA_AND_DRAKE,
    events: (resolver, at) => [
      lavaPulseEvent(),
      spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.ROCK_DRAKE, at + SPAWN_X, drakeYRel)),
    ],
  };
}

export function mixedChargerStalactiteBarrageBeat(chargerY: number, stalactiteDxOffsets: number[]): BeatPattern {
  const chargerYRel = chargerY / REL_H;
  return {
    name: BeatType.MIXED_CHARGER_STALACTITE_BARRAGE,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X, resolver.getSafeSpawnY(EnemyType.CHARGER, at + SPAWN_X, chargerYRel)),
      ...stalactiteDxOffsets.map((dx) => spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + dx, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + dx, STALACTITE_Y_REL))),
    ],
  };
}

export function mirrorRockDrakeBeat(yA: number, yB: number): BeatPattern {
  const yARel = yA / REL_H;
  const yBRel = yB / REL_H;
  return {
    name: BeatType.MIRROR_ROCK_DRAKE,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.ROCK_DRAKE, at + SPAWN_X, yARel)),
      spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.ROCK_DRAKE, at + SPAWN_X, yBRel)),
    ],
  };
}

export function lavaAndTurretBeat(turretY: number): BeatPattern {
  const turretYRel = turretY / REL_H;
  return {
    name: BeatType.LAVA_AND_TURRET,
    events: (resolver, at) => [
      lavaPulseEvent(),
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X, resolver.getSafeSpawnY(EnemyType.TURRET, at + SPAWN_X, turretYRel)),
    ],
  };
}

export function mixedDiverVStalactiteBeat(
  diverCount: number,
  diverYStep: number,
  stalactiteDxA: number,
  stalactiteDxB: number,
): BeatPattern {
  return {
    name: BeatType.MIXED_DIVER_V_STALACTITE,
    events: (resolver, at) => [
      ...vFormRel(resolver, EnemyType.DIVER, at, diverCount, diverYStep / REL_H_FULL),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDxA, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + stalactiteDxA, STALACTITE_Y_REL)),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDxB, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + stalactiteDxB, STALACTITE_Y_REL)),
    ],
  };
}

export function finalGauntletBeat(
  drakeY: number,
  straightCount: number,
  straightY: number,
  straightSpread: number,
  stalactiteDx: number,
): BeatPattern {
  const drakeYRel = drakeY / REL_H;
  return {
    name: BeatType.FINAL_GAUNTLET,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, resolver.getSafeSpawnY(EnemyType.ROCK_DRAKE, at + SPAWN_X, drakeYRel)),
      ...rowRel(resolver, EnemyType.STRAIGHT, at, straightCount, straightY / REL_H, straightSpread / REL_H_FULL),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDx, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + stalactiteDx, STALACTITE_Y_REL)),
    ],
  };
}

export function mixedStraightTurretBeat(
  count: number,
  yCenter: number,
  ySpread: number,
  turretY: number,
  turretDx: number,
): BeatPattern {
  const turretYRel = turretY / REL_H;
  return {
    name: BeatType.MIXED_STRAIGHT_TURRET,
    events: (resolver, at) => [
      ...rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X + turretDx, resolver.getSafeSpawnY(EnemyType.TURRET, at + SPAWN_X + turretDx, turretYRel)),
    ],
  };
}

export function dualTurretStalactiteBeat(turretYA: number, turretYB: number, stalactiteDx: number): BeatPattern {
  const turretYARel = turretYA / REL_H;
  const turretYBRel = turretYB / REL_H;
  return {
    name: BeatType.DUAL_TURRET_STALACTITE,
    events: (resolver, at) => [
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X, resolver.getSafeSpawnY(EnemyType.TURRET, at + SPAWN_X, turretYARel)),
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X + 120, resolver.getSafeSpawnY(EnemyType.TURRET, at + SPAWN_X + 120, turretYBRel)),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDx, resolver.getSafeSpawnY(EnemyType.STALACTITE, at + SPAWN_X + stalactiteDx, STALACTITE_Y_REL)),
    ],
  };
}

// --- LEVEL TIMELINES ---

function chapter4_1(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 5000)
    // START
    .add(Chapter4Anchor.START, 300, straightRowBeat(4, 0, 230))
    .add(Chapter4Anchor.START, 980, stalactitePairBeat(30, 180))
    .add(Chapter4Anchor.START, 1880, supportSineBeat(-90))
    .add(Chapter4Anchor.START, 2720, mixedStraightDiverBeat(3, 85, 145, -120, 105))
    .add(Chapter4Anchor.START, 3640, stalactiteBarrageBeat([40, 190]))
    .add(Chapter4Anchor.START, 4540, diverVBeat(3, 72))
    // MID
    .add(Chapter4Anchor.MID, 220, straightRowBeat(4, -80, 170))
    .add(Chapter4Anchor.MID, 1040, mixedDiverSineBeat(3, 68, 90, 90))
    .add(Chapter4Anchor.MID, 1920, stalactitePairBeat(50, 210))
    .add(Chapter4Anchor.MID, 2860, mixedStraightDiverBeat(4, 85, 155, -135, 105))
    .add(Chapter4Anchor.MID, 3780, swarmChokepointBeat());
}

function chapter4_2(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 5200)
    // START
    .add(Chapter4Anchor.START, 300, straightRowBeat(4, 0, 250))
    .add(Chapter4Anchor.START, 980, lavaPulseBeat())
    .add(Chapter4Anchor.START, 1660, turretBeat(-120))
    .add(Chapter4Anchor.START, 2520, stalactitePairBeat(30, 180))
    .add(Chapter4Anchor.START, 3400, mixedStraightTurretBeat(3, 85, 150, -135, 105))
    .add(Chapter4Anchor.START, 4300, supportSineBeat(90))
    // MID
    .add(Chapter4Anchor.MID, 160, lavaPulseBeat())
    .add(Chapter4Anchor.MID, 820, chargerBeat(0))
    .add(Chapter4Anchor.MID, 1620, mixedChargerStalactiteBarrageBeat(-45, [70, 220]))
    .add(Chapter4Anchor.MID, 2560, mixedStraightSineBeat(4, -85, 160, 90, 120))
    .add(Chapter4Anchor.MID, 3460, turretBeat(-120))
    .add(Chapter4Anchor.MID, 4320, mixedDiverVStalactiteBeat(3, 62, 60, 210));
}

function chapter4_3(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 5400)
    // START
    .add(Chapter4Anchor.START, 300, supportSineBeat(-90))
    .add(Chapter4Anchor.START, 980, rockDrakeBeat(220))
    .add(Chapter4Anchor.START, 1920, straightRowBeat(4, -80, 160))
    .add(Chapter4Anchor.START, 2780, stalactitePairBeat(40, 200))
    .add(Chapter4Anchor.START, 3560, mixedStraightDiverBeat(3, 80, 150, -120, 105))
    .add(Chapter4Anchor.START, 4400, rockDrakeBeat(-220))
    .add(Chapter4Anchor.START, 5200, lavaPulseBeat())
    // MID
    .add(Chapter4Anchor.MID, 220, diverVBeat(4, 66))
    .add(Chapter4Anchor.MID, 1080, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.MID, 1980, mixedStalactiteMirrorSineBeat(50, 200, 85, -85, 120))
    .add(Chapter4Anchor.MID, 2860, mixedStraightDiverBeat(4, -80, 170, 120, 115))
    .add(Chapter4Anchor.MID, 3780, finalGauntletBeat(220, 4, -60, 140, 150))
    .add(Chapter4Anchor.MID, 4700, lavaPulseBeat());
}

function chapter4_4(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 6200)
    // START
    .add(Chapter4Anchor.START, 300, supportSineBeat(90))
    .add(Chapter4Anchor.START, 900, lavaPulseBeat())
    .add(Chapter4Anchor.START, 1580, mixedStalactiteMirrorSineBeat(30, 190, 80, -80, 110))
    .add(Chapter4Anchor.START, 2460, rockDrakeBeat(220))
    .add(Chapter4Anchor.START, 3380, recoveryGapBeat())
    .add(Chapter4Anchor.START, 4240, dualTurretStalactiteBeat(-120, 105, 190))
    .add(Chapter4Anchor.START, 5160, mixedDiverVStalactiteBeat(4, 62, 70, 220))
    // MID
    .add(Chapter4Anchor.MID, 220, lavaPulseBeat())
    .add(Chapter4Anchor.MID, 880, swarmChokepointBeat())
    .add(Chapter4Anchor.MID, 1600, mirrorRockDrakeBeat(220, -220))
    .add(Chapter4Anchor.MID, 2540, mixedChargerStalactiteBarrageBeat(35, [90, 230]))
    .add(Chapter4Anchor.MID, 3480, lavaAndTurretBeat(-120))
    .add(Chapter4Anchor.MID, 4480, recoveryGapBeat())
    .add(Chapter4Anchor.MID, 5320, supportSineBeat(0))
    .add(Chapter4Anchor.MID, 6100, finalGauntletBeat(-220, 4, 75, 150, 170));
}

function chapter4_5(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 6200)
    // START
    .add(Chapter4Anchor.START, 300, straightRowBeat(5, 0, 260))
    .add(Chapter4Anchor.START, 980, lavaPulseBeat())
    .add(Chapter4Anchor.START, 1700, rockDrakeBeat(220))
    .add(Chapter4Anchor.START, 2560, mixedStalactiteMirrorSineBeat(10, 190, 70, -70, 100))
    .add(Chapter4Anchor.START, 3460, recoveryGapBeat())
    .add(Chapter4Anchor.START, 4180, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.START, 5160, mixedChargerStalactiteBarrageBeat(0, [70, 220]))
    // MID
    .add(Chapter4Anchor.MID, 180, dualTurretStalactiteBeat(-125, 115, 130))
    .add(Chapter4Anchor.MID, 1060, mixedDiverVStalactiteBeat(4, 62, 50, 190))
    .add(Chapter4Anchor.MID, 1980, mirrorRockDrakeBeat(220, -220))
    .add(Chapter4Anchor.MID, 2920, recoveryGapBeat())
    .add(Chapter4Anchor.MID, 3880, mixedChargerStalactiteBarrageBeat(-35, [50, 190]))
    .add(Chapter4Anchor.MID, 4800, mixedStraightTurretBeat(4, 70, 150, -120, 140))
    .add(Chapter4Anchor.MID, 5660, recoveryGapBeat())
    .add(Chapter4Anchor.MID, 6500, finalGauntletBeat(-220, 4, 70, 150, 180));
}

const CHAPTER_4_BEATS = {
  '4-1': chapter4_1,
  '4-2': chapter4_2,
  '4-3': chapter4_3,
  '4-4': chapter4_4,
  '4-5': chapter4_5,
} as const;

/**
 * Builds standard WaveEntry list for any Chapter 4 sub-level.
 * Implements the centralized Chapter 4 Wave Grammar.
 */
export function buildChapter4Waves(levelId: string, resolver: CorridorResolver): WaveEntry[] {
  const timelineFn = CHAPTER_4_BEATS[levelId as keyof typeof CHAPTER_4_BEATS];
  if (!timelineFn) {
    throw new Error(`Unknown Chapter 4 level: ${levelId}`);
  }
  return timelineFn().build(resolver);
}
