import { GAME_HEIGHT } from '../../constants.ts';
import { SPAWN_X, row, vForm } from './helpers.ts';
import { EnemyType } from '../../types.ts';
import { lavaPulseEvent, spawnEnemyEvent, type WaveEntry } from '../StageEvents.ts';
import { Timeline, BeatType, type BeatPattern } from './Timeline.ts';

// --- ANCHORS ENUM ---
export enum Chapter4Anchor {
  START = 'start',
  MID = 'mid',
}

const HALF_H = GAME_HEIGHT / 2;
const STALACTITE_Y = HALF_H + 40;

// --- BEAT BUILDERS ---

export function straightRowBeat(count: number, yCenter: number, ySpread: number): BeatPattern {
  return {
    name: BeatType.STRAIGHT_ROW,
    events: row(EnemyType.STRAIGHT, count, yCenter, ySpread),
  };
}

export function supportSineBeat(y: number, dx = 0): BeatPattern {
  return {
    name: BeatType.SINE_ROW,
    events: [spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx, y)],
  };
}

export function sinePairBeat(y1: number, y2: number, dx = 120): BeatPattern {
  return {
    name: BeatType.SINE_ROW,
    events: [
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X, y1),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + dx, y2),
    ],
  };
}

export function diverVBeat(count: number, yStep = 72): BeatPattern {
  return {
    name: BeatType.DIVER_V,
    events: vForm(EnemyType.DIVER, count, yStep),
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

export function mixedDiverSineBeat(diverCount: number, diverYStep: number, sineY: number, sineDx: number): BeatPattern {
  return {
    name: BeatType.MIXED_DIVER_SINE,
    events: [
      ...vForm(EnemyType.DIVER, diverCount, diverYStep),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, sineY),
    ],
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

export function lavaPulseBeat(): BeatPattern {
  return {
    name: BeatType.LAVA_PULSE,
    events: [lavaPulseEvent()],
  };
}

export function rockDrakeBeat(y: number): BeatPattern {
  return {
    name: BeatType.ROCK_DRAKE,
    events: [spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, y)],
  };
}

export function stalactitePairBeat(dxA: number, dxB: number): BeatPattern {
  return {
    name: BeatType.MIXED_STALACTITE_MIRROR_SINE,
    events: [
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + dxA, STALACTITE_Y),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + dxB, STALACTITE_Y),
    ],
  };
}

export function stalactiteBarrageBeat(dxOffsets: number[]): BeatPattern {
  return {
    name: BeatType.MIXED_CHARGER_STALACTITE_BARRAGE,
    events: dxOffsets.map((dx) => spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + dx, STALACTITE_Y)),
  };
}

export function mixedStalactiteMirrorSineBeat(
  stalactiteDxA: number,
  stalactiteDxB: number,
  sineYA: number,
  sineYB: number,
  sineDx: number,
): BeatPattern {
  return {
    name: BeatType.MIXED_STALACTITE_MIRROR_SINE,
    events: [
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDxA, STALACTITE_Y),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDxB, STALACTITE_Y),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X, sineYA),
      spawnEnemyEvent(EnemyType.SINE, SPAWN_X + sineDx, sineYB),
    ],
  };
}

export function swarmChokepointBeat(): BeatPattern {
  return {
    name: BeatType.SWARM_CHOKEPOINT,
    events: [
      spawnEnemyEvent(EnemyType.SWARM, SPAWN_X, 20),
      spawnEnemyEvent(EnemyType.SWARM, SPAWN_X + 60, -20),
      spawnEnemyEvent(EnemyType.SWARM, SPAWN_X + 120, 0),
    ],
  };
}

export function lavaAndDrakeBeat(drakeY: number): BeatPattern {
  return {
    name: BeatType.LAVA_AND_DRAKE,
    events: [
      lavaPulseEvent(),
      spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, drakeY),
    ],
  };
}

export function mixedChargerStalactiteBarrageBeat(chargerY: number, stalactiteDxOffsets: number[]): BeatPattern {
  return {
    name: BeatType.MIXED_CHARGER_STALACTITE_BARRAGE,
    events: [
      spawnEnemyEvent(EnemyType.CHARGER, SPAWN_X, chargerY),
      ...stalactiteDxOffsets.map((dx) => spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + dx, STALACTITE_Y)),
    ],
  };
}

export function mirrorRockDrakeBeat(yA: number, yB: number): BeatPattern {
  return {
    name: BeatType.MIRROR_ROCK_DRAKE,
    events: [
      spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, yA),
      spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, yB),
    ],
  };
}

export function lavaAndTurretBeat(turretY: number): BeatPattern {
  return {
    name: BeatType.LAVA_AND_TURRET,
    events: [
      lavaPulseEvent(),
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X, turretY),
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
    events: [
      ...vForm(EnemyType.DIVER, diverCount, diverYStep),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDxA, STALACTITE_Y),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDxB, STALACTITE_Y),
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
  return {
    name: BeatType.FINAL_GAUNTLET,
    events: [
      spawnEnemyEvent(EnemyType.ROCK_DRAKE, SPAWN_X, drakeY),
      ...row(EnemyType.STRAIGHT, straightCount, straightY, straightSpread),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDx, STALACTITE_Y),
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
  return {
    name: BeatType.MIXED_STRAIGHT_TURRET,
    events: [
      ...row(EnemyType.STRAIGHT, count, yCenter, ySpread),
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X + turretDx, turretY),
    ],
  };
}

export function dualTurretStalactiteBeat(turretYA: number, turretYB: number, stalactiteDx: number): BeatPattern {
  return {
    name: BeatType.LAVA_AND_TURRET,
    events: [
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X, turretYA),
      spawnEnemyEvent(EnemyType.TURRET, SPAWN_X + 120, turretYB),
      spawnEnemyEvent(EnemyType.STALACTITE, SPAWN_X + stalactiteDx, STALACTITE_Y),
    ],
  };
}

// --- LEVEL TIMELINES ---

function chapter4_1(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 5000)
    // START
    .add(Chapter4Anchor.START, 300, straightRowBeat(4, 0, 220))
    .add(Chapter4Anchor.START, 800, stalactitePairBeat(20, 160))
    .add(Chapter4Anchor.START, 1400, supportSineBeat(-90))
    .add(Chapter4Anchor.START, 2000, mixedStraightDiverBeat(3, 85, 140, -120, 90))
    .add(Chapter4Anchor.START, 2700, supportSineBeat(90, 40))
    .add(Chapter4Anchor.START, 3400, diverVBeat(3, 72))
    .add(Chapter4Anchor.START, 4100, stalactiteBarrageBeat([30, 180]))
    .add(Chapter4Anchor.START, 4700, swarmChokepointBeat())
    // MID
    .add(Chapter4Anchor.MID, 200, straightRowBeat(4, -85, 160))
    .add(Chapter4Anchor.MID, 800, mixedDiverSineBeat(3, 68, 90, 90))
    .add(Chapter4Anchor.MID, 1600, stalactitePairBeat(40, 200))
    .add(Chapter4Anchor.MID, 2300, mixedStraightDiverBeat(4, 85, 150, -135, 80))
    .add(Chapter4Anchor.MID, 3100, supportSineBeat(-45))
    .add(Chapter4Anchor.MID, 3700, swarmChokepointBeat());
}

function chapter4_2(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 5200)
    // START
    .add(Chapter4Anchor.START, 300, straightRowBeat(4, 0, 240))
    .add(Chapter4Anchor.START, 800, lavaPulseBeat())
    .add(Chapter4Anchor.START, 1400, turretBeat(-120))
    .add(Chapter4Anchor.START, 2000, supportSineBeat(90))
    .add(Chapter4Anchor.START, 2600, stalactitePairBeat(20, 160))
    .add(Chapter4Anchor.START, 3300, mixedStraightTurretBeat(3, 85, 140, -135, 90))
    .add(Chapter4Anchor.START, 4100, diverVBeat(4, 66))
    .add(Chapter4Anchor.START, 4800, stalactiteBarrageBeat([30, 180]))
    // MID
    .add(Chapter4Anchor.MID, 160, lavaPulseBeat())
    .add(Chapter4Anchor.MID, 700, chargerBeat(0))
    .add(Chapter4Anchor.MID, 1300, mixedChargerStalactiteBarrageBeat(-45, [60, 210]))
    .add(Chapter4Anchor.MID, 2100, mixedStraightSineBeat(4, -85, 150, 90, 100))
    .add(Chapter4Anchor.MID, 2900, turretBeat(-120))
    .add(Chapter4Anchor.MID, 3600, mixedDiverVStalactiteBeat(3, 62, 50, 190));
}

function chapter4_3(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 5400)
    // START
    .add(Chapter4Anchor.START, 300, supportSineBeat(-90))
    .add(Chapter4Anchor.START, 800, rockDrakeBeat(220))
    .add(Chapter4Anchor.START, 1600, straightRowBeat(4, -80, 150))
    .add(Chapter4Anchor.START, 2200, stalactitePairBeat(40, 200))
    .add(Chapter4Anchor.START, 2800, rockDrakeBeat(-220))
    .add(Chapter4Anchor.START, 3600, mixedStraightDiverBeat(3, 80, 140, -120, 90))
    .add(Chapter4Anchor.START, 4400, lavaPulseBeat())
    // MID
    .add(Chapter4Anchor.MID, 200, sinePairBeat(90, -90))
    .add(Chapter4Anchor.MID, 1000, diverVBeat(4, 66))
    .add(Chapter4Anchor.MID, 1800, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.MID, 2600, mixedStalactiteMirrorSineBeat(40, 180, 85, -85, 110))
    .add(Chapter4Anchor.MID, 3400, finalGauntletBeat(220, 3, -60, 120, 140))
    .add(Chapter4Anchor.MID, 4300, lavaPulseBeat());
}

function chapter4_4(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 6200)
    // START
    .add(Chapter4Anchor.START, 300, sinePairBeat(90, -90))
    .add(Chapter4Anchor.START, 900, lavaPulseBeat())
    .add(Chapter4Anchor.START, 1400, mixedStalactiteMirrorSineBeat(20, 170, 80, -80, 100))
    .add(Chapter4Anchor.START, 2100, rockDrakeBeat(220))
    .add(Chapter4Anchor.START, 2800, straightRowBeat(5, 0, 240))
    .add(Chapter4Anchor.START, 3500, dualTurretStalactiteBeat(-120, 105, 180))
    .add(Chapter4Anchor.START, 4300, mixedDiverVStalactiteBeat(4, 62, 50, 200))
    .add(Chapter4Anchor.START, 5100, rockDrakeBeat(-220))
    // MID
    .add(Chapter4Anchor.MID, 200, lavaPulseBeat())
    .add(Chapter4Anchor.MID, 700, swarmChokepointBeat())
    .add(Chapter4Anchor.MID, 1400, finalGauntletBeat(220, 4, -65, 150, 120))
    .add(Chapter4Anchor.MID, 2200, mixedChargerStalactiteBarrageBeat(35, [80, 220]))
    .add(Chapter4Anchor.MID, 3000, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.MID, 3700, straightRowBeat(5, -80, 160))
    .add(Chapter4Anchor.MID, 4400, mixedDiverVStalactiteBeat(4, 62, 70, 210))
    .add(Chapter4Anchor.MID, 5100, supportSineBeat(0))
    .add(Chapter4Anchor.MID, 5700, finalGauntletBeat(-220, 4, 75, 150, 160))
    .add(Chapter4Anchor.MID, 6500, mirrorRockDrakeBeat(220, -220));
}

function chapter4_5(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>(0.65)
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 6200)
    // START
    .add(Chapter4Anchor.START, 300, straightRowBeat(5, 0, 240))
    .add(Chapter4Anchor.START, 800, lavaPulseBeat())
    .add(Chapter4Anchor.START, 1300, rockDrakeBeat(220))
    .add(Chapter4Anchor.START, 2000, mixedStalactiteMirrorSineBeat(0, 180, 70, -70, 90))
    .add(Chapter4Anchor.START, 2700, swarmChokepointBeat())
    .add(Chapter4Anchor.START, 3300, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.START, 4100, straightRowBeat(5, 80, 160))
    .add(Chapter4Anchor.START, 4800, mixedChargerStalactiteBarrageBeat(0, [60, 200]))
    .add(Chapter4Anchor.START, 5500, mirrorRockDrakeBeat(220, -220))
    // MID
    .add(Chapter4Anchor.MID, 180, dualTurretStalactiteBeat(-125, 115, 120))
    .add(Chapter4Anchor.MID, 900, mixedDiverVStalactiteBeat(4, 62, 40, 180))
    .add(Chapter4Anchor.MID, 1700, finalGauntletBeat(220, 4, -60, 140, 120))
    .add(Chapter4Anchor.MID, 2500, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.MID, 3200, sinePairBeat(90, -90))
    .add(Chapter4Anchor.MID, 3900, mixedChargerStalactiteBarrageBeat(-35, [40, 180]))
    .add(Chapter4Anchor.MID, 4600, mirrorRockDrakeBeat(220, -220))
    .add(Chapter4Anchor.MID, 5200, dualTurretStalactiteBeat(115, -115, 200))
    .add(Chapter4Anchor.MID, 5900, finalGauntletBeat(-220, 4, 70, 150, 160))
    .add(Chapter4Anchor.MID, 6500, lavaAndTurretBeat(120));
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
export function buildChapter4Waves(levelId: string): WaveEntry[] {
  const timelineFn = CHAPTER_4_BEATS[levelId as keyof typeof CHAPTER_4_BEATS];
  if (!timelineFn) {
    throw new Error(`Unknown Chapter 4 level: ${levelId}`);
  }
  return timelineFn().build();
}
