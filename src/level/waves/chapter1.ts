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
import { spawnEnemyEvent, type StageEvent, type WaveEntry } from '../StageEvents.ts';
import { Timeline, BeatType, type BeatPattern } from './Timeline.ts';

const REL_H = CORRIDOR_REFERENCE_HALF_HEIGHT;
const REL_H_FULL = REL_H * 2;

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

export function diverVBeat(count: number, yStep = 72): BeatPattern {
  return {
    name: BeatType.DIVER_V,
    events: (resolver, at) =>
      vFormRel(resolver, EnemyType.DIVER, at, count, yStep / REL_H_FULL),
  };
}

export function swarmClusterBeat(density: 'light' | 'heavy' | 'tutorial' | 'finale'): BeatPattern {
  let offsets = toRelativeOffsets([
    { dx:   0, dy:   0 }, { dx:  55, dy: -65 }, { dx:  55, dy:  65 },
    { dx: 110, dy: -120}, { dx: 110, dy:   0 }, { dx: 110, dy: 120 },
    { dx: 165, dy: -60 }, { dx: 165, dy:  60 },
  ]);
  if (density === 'tutorial') {
    offsets = toRelativeOffsets(SWARM_MD_5);
  } else if (density === 'heavy') {
    offsets = toRelativeOffsets([
      { dx:   0, dy:   0 }, { dx:  50, dy: -85 }, { dx:  50, dy:  85 },
      { dx: 100, dy:-145 }, { dx: 100, dy: -45 }, { dx: 100, dy:  55 }, { dx: 100, dy: 155 },
      { dx: 150, dy: -80 }, { dx: 150, dy:  40 }, { dx: 200, dy:   0 },
    ]);
  } else if (density === 'finale') {
    offsets = toRelativeOffsets(SWARM_MD_7);
  }
  return {
    name: BeatType.SWARM_CLUSTER,
    events: (resolver, at) => clusterRel(resolver, EnemyType.SWARM, at, offsets, 0, 0),
  };
}

export function recoveryGapBeat(): BeatPattern {
  return {
    name: BeatType.RECOVERY_GAP,
    events: () => [],
  };
}

export function mixedStraightDiverBeat(
  count: number, yCenter: number, ySpread: number, diverY: number, diverDx: number
): BeatPattern {
  return {
    name: BeatType.MIXED_STRAIGHT_DIVER,
    events: (resolver, at) => [
      ...rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
      spawnEnemyEvent(
        EnemyType.DIVER,
        SPAWN_X + diverDx,
        resolver.getSafeSpawnY(EnemyType.DIVER, at + SPAWN_X + diverDx, diverY / REL_H),
      ),
    ],
  };
}

export function mixedStraightDualDiverBeat(
  count: number, yCenter: number, ySpread: number,
  diverY1: number, diverY2: number, diverDx: number
): BeatPattern {
  return {
    name: BeatType.MIXED_STRAIGHT_DUAL_DIVER,
    events: (resolver, at) => [
      ...rowRel(resolver, EnemyType.STRAIGHT, at, count, yCenter / REL_H, ySpread / REL_H_FULL),
      spawnEnemyEvent(
        EnemyType.DIVER,
        SPAWN_X + diverDx,
        resolver.getSafeSpawnY(EnemyType.DIVER, at + SPAWN_X + diverDx, diverY1 / REL_H),
      ),
      spawnEnemyEvent(
        EnemyType.DIVER,
        SPAWN_X + diverDx,
        resolver.getSafeSpawnY(EnemyType.DIVER, at + SPAWN_X + diverDx, diverY2 / REL_H),
      ),
    ],
  };
}

// --- LEVEL TIMELINES ---

// Level 1-1 (Rookie / Pattern Literacy)
function chapter1_1(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>(0.65)
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 5000)
    .add(Chapter1Anchor.START, 320, straightRowBeat(4, 0, 240))
    .add(Chapter1Anchor.START, 760, straightRowBeat(4, 20, 220))
    .add(Chapter1Anchor.START, 1210, straightRowBeat(3, -120, 145))
    .add(Chapter1Anchor.START, 1690, diverVBeat(3, 76))
    .add(Chapter1Anchor.START, 2210, straightRowBeat(4, 105, 180))
    .add(Chapter1Anchor.START, 2760, mixedStraightDiverBeat(4, 0, 240, 0, 110))
    .add(Chapter1Anchor.START, 3330, straightRowBeat(5, 0, 270))
    .add(Chapter1Anchor.START, 3920, diverVBeat(3, 68))
    .add(Chapter1Anchor.START, 4540, swarmClusterBeat('tutorial'))
    .add(Chapter1Anchor.MID, 260, straightRowBeat(4, -90, 200))
    .add(Chapter1Anchor.MID, 900, diverVBeat(4, 68))
    .add(Chapter1Anchor.MID, 1560, straightRowBeat(5, 0, 260))
    .add(Chapter1Anchor.MID, 2180, mixedStraightDiverBeat(4, -95, 170, 145, 90))
    .add(Chapter1Anchor.MID, 2800, straightRowBeat(5, 0, 250));
}

// Level 1-2 (Density Literacy)
function chapter1_2(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>(0.65)
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 5000)
    .add(Chapter1Anchor.START, 300, straightRowBeat(5, 0, 270))
    .add(Chapter1Anchor.START, 760, straightRowBeat(4, -95, 190))
    .add(Chapter1Anchor.START, 1220, mixedStraightDiverBeat(4, 0, 240, 135, 110))
    .add(Chapter1Anchor.START, 1700, straightRowBeat(5, 95, 190))
    .add(Chapter1Anchor.START, 2220, diverVBeat(4, 66))
    .add(Chapter1Anchor.START, 2800, straightRowBeat(6, 0, 300))
    .add(Chapter1Anchor.START, 3400, diverVBeat(5, 62))
    .add(Chapter1Anchor.START, 4020, straightRowBeat(4, -130, 140))
    .add(Chapter1Anchor.START, 4540, straightRowBeat(4, 130, 140))
    .add(Chapter1Anchor.MID, 120, swarmClusterBeat('light'))
    .add(Chapter1Anchor.MID, 1000, mixedStraightDiverBeat(5, 0, 260, -150, 105))
    .add(Chapter1Anchor.MID, 1760, straightRowBeat(5, 0, 280))
    .add(Chapter1Anchor.MID, 2380, diverVBeat(4, 62))
    .add(Chapter1Anchor.MID, 3000, straightRowBeat(6, 0, 280));
}

// Level 1-3 (Mixed-Wave Literacy)
function chapter1_3(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>(0.65)
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 4500)
    .add(Chapter1Anchor.START, 300, straightRowBeat(4, 0, 240))
    .add(Chapter1Anchor.START, 780, mixedStraightDiverBeat(3, -115, 155, 120, 105))
    .add(Chapter1Anchor.START, 1320, mixedStraightDiverBeat(3, 115, 155, -120, 105))
    .add(Chapter1Anchor.START, 1900, mixedStraightDiverBeat(4, 0, 240, 0, 125))
    .add(Chapter1Anchor.START, 2540, straightRowBeat(5, 0, 270))
    .add(Chapter1Anchor.START, 3160, mixedStraightDualDiverBeat(3, 0, 180, -140, 140, 95))
    .add(Chapter1Anchor.START, 3780, diverVBeat(5, 62))
    .add(Chapter1Anchor.MID, 20, swarmClusterBeat('light'))
    .add(Chapter1Anchor.MID, 820, straightRowBeat(4, 0, 200))
    .add(Chapter1Anchor.MID, 1540, mixedStraightDiverBeat(4, 110, 170, -125, 105))
    .add(Chapter1Anchor.MID, 2240, mixedStraightDiverBeat(4, -110, 170, 135, 105))
    .add(Chapter1Anchor.MID, 2940, straightRowBeat(6, 0, 280));
}

// Level 1-4 (Endurance Recovery)
function chapter1_4(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>(0.65)
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 6500)
    .add(Chapter1Anchor.START, 280, straightRowBeat(5, 0, 280))
    .add(Chapter1Anchor.START, 700, mixedStraightDiverBeat(4, 0, 240, 130, 115))
    .add(Chapter1Anchor.START, 1120, straightRowBeat(5, -95, 200))
    .add(Chapter1Anchor.START, 1560, diverVBeat(4, 66))
    .add(Chapter1Anchor.START, 2100, straightRowBeat(6, 95, 210))
    .add(Chapter1Anchor.START, 2640, swarmClusterBeat('light'))
    .add(Chapter1Anchor.START, 3420, recoveryGapBeat())
    .add(Chapter1Anchor.START, 3820, mixedStraightDiverBeat(5, 0, 280, -150, 105))
    .add(Chapter1Anchor.START, 4480, diverVBeat(5, 60))
    .add(Chapter1Anchor.START, 5120, diverVBeat(5, 58))
    .add(Chapter1Anchor.START, 5800, straightRowBeat(6, 0, 300))
    .add(Chapter1Anchor.MID, 0, recoveryGapBeat())
    .add(Chapter1Anchor.MID, 420, swarmClusterBeat('finale'))
    .add(Chapter1Anchor.MID, 1360, mixedStraightDualDiverBeat(4, 0, 250, 130, -130, 110))
    .add(Chapter1Anchor.MID, 2220, mixedStraightDiverBeat(5, 0, 260, 0, 125))
    .add(Chapter1Anchor.MID, 3000, straightRowBeat(6, 0, 280));
}

// Level 1-5 (Chapter Finale)
function chapter1_5(): Timeline<Chapter1Anchor> {
  return new Timeline<Chapter1Anchor>(0.65)
    .anchor(Chapter1Anchor.START, 0)
    .anchor(Chapter1Anchor.MID, 6000)
    .add(Chapter1Anchor.START, 320, straightRowBeat(5, 0, 280))
    .add(Chapter1Anchor.START, 780, mixedStraightDiverBeat(4, -105, 180, 125, 110))
    .add(Chapter1Anchor.START, 1320, mixedStraightDiverBeat(4, 105, 180, -125, 110))
    .add(Chapter1Anchor.START, 1900, mixedStraightDiverBeat(5, 0, 260, 0, 135))
    .add(Chapter1Anchor.START, 2240, straightRowBeat(4, -120, 170))
    .add(Chapter1Anchor.START, 2540, swarmClusterBeat('light'))
    .add(Chapter1Anchor.START, 2920, mixedStraightDiverBeat(4, 0, 240, -125, 115))
    .add(Chapter1Anchor.START, 3300, recoveryGapBeat())
    .add(Chapter1Anchor.START, 3960, mixedStraightDualDiverBeat(5, 0, 270, -150, 150, 125))
    .add(Chapter1Anchor.START, 4340, diverVBeat(4, 62))
    .add(Chapter1Anchor.START, 4720, mixedStraightDiverBeat(5, -95, 200, 145, 115))
    .add(Chapter1Anchor.START, 5120, mixedStraightDiverBeat(4, 110, 170, -125, 110))
    .add(Chapter1Anchor.START, 5460, swarmClusterBeat('heavy'))
    .add(Chapter1Anchor.MID, 100, straightRowBeat(5, 0, 270))
    .add(Chapter1Anchor.MID, 820, mixedStraightDiverBeat(5, 0, 270, 0, 135))
    .add(Chapter1Anchor.MID, 1240, mixedStraightDiverBeat(4, 0, 240, 130, 115))
    .add(Chapter1Anchor.MID, 1600, mixedStraightDualDiverBeat(4, 0, 260, -115, 115, 115))
    .add(Chapter1Anchor.MID, 2420, swarmClusterBeat('finale'))
    .add(Chapter1Anchor.MID, 3020, recoveryGapBeat())
    .add(Chapter1Anchor.MID, 3400, mixedStraightDualDiverBeat(6, 0, 290, 150, -150, 115))
    .add(Chapter1Anchor.MID, 3920, straightRowBeat(5, 0, 260))
    .add(Chapter1Anchor.MID, 4300, mixedStraightDualDiverBeat(4, 0, 250, 135, -135, 110))
    .add(Chapter1Anchor.MID, 4840, mixedStraightDiverBeat(4, -105, 170, 110, 115));
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
export function buildChapter1Waves(levelId: string, resolver: CorridorResolver): WaveEntry[] {
  const timelineFn = CHAPTER_1_BEATS[levelId as keyof typeof CHAPTER_1_BEATS];
  if (!timelineFn) {
    throw new Error(`Unknown Chapter 1 level: ${levelId}`);
  }
  return timelineFn().build(resolver);
}
