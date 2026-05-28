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

export function sineRowBeat(count: number, yCenter: number, ySpread: number): BeatPattern {
  return {
    name: BeatType.SINE_ROW,
    events: row(EnemyType.SINE, count, yCenter, ySpread),
  };
}

export function diverVBeat(count: number, yStep: number): BeatPattern {
  return {
    name: BeatType.DIVER_V,
    events: vForm(EnemyType.DIVER, count, yStep),
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
  return new Timeline<Chapter4Anchor>()
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 5000)
    .add(Chapter4Anchor.START, 320, sineRowBeat(5, 0, 250))
    .add(Chapter4Anchor.START, 900, straightRowBeat(5, -85, 170))
    .add(Chapter4Anchor.START, 1540, stalactitePairBeat(40, 180))
    .add(Chapter4Anchor.START, 2240, sineRowBeat(4, 90, 170))
    .add(Chapter4Anchor.START, 2980, mixedStalactiteMirrorSineBeat(20, 160, -75, 75, 90))
    .add(Chapter4Anchor.START, 3760, diverVBeat(4, 66))
    .add(Chapter4Anchor.START, 4540, stalactiteBarrageBeat([20, 150, 280]))
    .add(Chapter4Anchor.MID, 220, straightRowBeat(5, 0, 240))
    .add(Chapter4Anchor.MID, 960, mixedDiverVStalactiteBeat(4, 62, 70, 210))
    .add(Chapter4Anchor.MID, 1760, sineRowBeat(5, -70, 170))
    .add(Chapter4Anchor.MID, 2540, stalactitePairBeat(30, 210))
    .add(Chapter4Anchor.MID, 3340, swarmChokepointBeat());
}

function chapter4_2(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>()
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 5200)
    .add(Chapter4Anchor.START, 300, sineRowBeat(5, 0, 250))
    .add(Chapter4Anchor.START, 820, lavaPulseBeat())
    .add(Chapter4Anchor.START, 1120, straightRowBeat(5, -90, 170))
    .add(Chapter4Anchor.START, 1860, mixedStalactiteMirrorSineBeat(0, 150, 75, -75, 100))
    .add(Chapter4Anchor.START, 2660, lavaAndTurretBeat(120))
    .add(Chapter4Anchor.START, 3460, diverVBeat(4, 66))
    .add(Chapter4Anchor.START, 4280, stalactiteBarrageBeat([30, 170, 310]))
    .add(Chapter4Anchor.MID, 160, lavaPulseBeat())
    .add(Chapter4Anchor.MID, 520, sineRowBeat(5, 85, 170))
    .add(Chapter4Anchor.MID, 1320, mixedChargerStalactiteBarrageBeat(-35, [70, 200]))
    .add(Chapter4Anchor.MID, 2180, straightRowBeat(6, 0, 250))
    .add(Chapter4Anchor.MID, 3000, lavaAndTurretBeat(-120))
    .add(Chapter4Anchor.MID, 3820, mixedDiverVStalactiteBeat(5, 58, 60, 220));
}

function chapter4_3(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>()
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 5400)
    .add(Chapter4Anchor.START, 300, sineRowBeat(5, 0, 250))
    .add(Chapter4Anchor.START, 920, rockDrakeBeat(220))
    .add(Chapter4Anchor.START, 1760, straightRowBeat(5, -80, 170))
    .add(Chapter4Anchor.START, 2540, stalactitePairBeat(60, 220))
    .add(Chapter4Anchor.START, 3340, rockDrakeBeat(-220))
    .add(Chapter4Anchor.START, 4200, lavaPulseBeat())
    .add(Chapter4Anchor.START, 4560, sineRowBeat(4, 80, 170))
    .add(Chapter4Anchor.MID, 200, finalGauntletBeat(220, 4, -70, 150, 120))
    .add(Chapter4Anchor.MID, 1040, diverVBeat(5, 58))
    .add(Chapter4Anchor.MID, 1900, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.MID, 2780, mixedStalactiteMirrorSineBeat(40, 190, 85, -85, 110))
    .add(Chapter4Anchor.MID, 3660, finalGauntletBeat(220, 5, 0, 210, 180))
    .add(Chapter4Anchor.MID, 4520, lavaPulseBeat());
}

function chapter4_4(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>()
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 6200)
    .add(Chapter4Anchor.START, 300, sineRowBeat(6, 0, 270))
    .add(Chapter4Anchor.START, 900, lavaPulseBeat())
    .add(Chapter4Anchor.START, 1280, mixedStalactiteMirrorSineBeat(20, 170, 80, -80, 100))
    .add(Chapter4Anchor.START, 2140, rockDrakeBeat(220))
    .add(Chapter4Anchor.START, 3000, straightRowBeat(7, 0, 260))
    .add(Chapter4Anchor.START, 3860, dualTurretStalactiteBeat(-120, 105, 180))
    .add(Chapter4Anchor.START, 4740, mixedDiverVStalactiteBeat(6, 54, 50, 210))
    .add(Chapter4Anchor.START, 5600, rockDrakeBeat(-220))
    .add(Chapter4Anchor.MID, 260, lavaPulseBeat())
    .add(Chapter4Anchor.MID, 620, swarmChokepointBeat())
    .add(Chapter4Anchor.MID, 1420, finalGauntletBeat(220, 6, -65, 180, 120))
    .add(Chapter4Anchor.MID, 2260, mixedChargerStalactiteBarrageBeat(35, [80, 220, 340, 460]))
    .add(Chapter4Anchor.MID, 3180, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.MID, 3720, straightRowBeat(6, -90, 180))
    .add(Chapter4Anchor.MID, 4240, mixedDiverVStalactiteBeat(5, 56, 70, 230))
    .add(Chapter4Anchor.MID, 4820, sineRowBeat(6, 70, 190))
    .add(Chapter4Anchor.MID, 5420, finalGauntletBeat(-220, 5, 80, 170, 160))
    .add(Chapter4Anchor.MID, 5900, mirrorRockDrakeBeat(220, -220));
}

function chapter4_5(): Timeline<Chapter4Anchor> {
  return new Timeline<Chapter4Anchor>()
    .anchor(Chapter4Anchor.START, 0)
    .anchor(Chapter4Anchor.MID, 6200)
    .add(Chapter4Anchor.START, 320, straightRowBeat(6, 0, 250))
    .add(Chapter4Anchor.START, 860, lavaPulseBeat())
    .add(Chapter4Anchor.START, 1160, rockDrakeBeat(220))
    .add(Chapter4Anchor.START, 1960, mixedStalactiteMirrorSineBeat(0, 180, 70, -70, 90))
    .add(Chapter4Anchor.START, 2800, swarmChokepointBeat())
    .add(Chapter4Anchor.START, 3540, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.START, 4240, straightRowBeat(5, 90, 170))
    .add(Chapter4Anchor.START, 4860, mixedChargerStalactiteBarrageBeat(0, [60, 180, 300, 420]))
    .add(Chapter4Anchor.START, 5320, mirrorRockDrakeBeat(220, -220))
    .add(Chapter4Anchor.MID, 180, dualTurretStalactiteBeat(-125, 115, 120))
    .add(Chapter4Anchor.MID, 940, mixedDiverVStalactiteBeat(6, 54, 40, 180))
    .add(Chapter4Anchor.MID, 1800, finalGauntletBeat(220, 6, 0, 230, 100))
    .add(Chapter4Anchor.MID, 2640, lavaAndDrakeBeat(-220))
    .add(Chapter4Anchor.MID, 3240, sineRowBeat(5, -85, 170))
    .add(Chapter4Anchor.MID, 3780, mixedChargerStalactiteBarrageBeat(-35, [40, 160, 280, 400]))
    .add(Chapter4Anchor.MID, 4260, mirrorRockDrakeBeat(220, -220))
    .add(Chapter4Anchor.MID, 4800, dualTurretStalactiteBeat(115, -115, 200))
    .add(Chapter4Anchor.MID, 5320, finalGauntletBeat(-220, 6, 70, 190, 160))
    .add(Chapter4Anchor.MID, 5860, lavaAndTurretBeat(120));
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
