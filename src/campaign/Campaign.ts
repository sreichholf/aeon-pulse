import { MusicCue } from '../types.ts';
import { ENABLE_ADVANCED_TITLE_OPTIONS } from '../constants.ts';

export type ChapterKey = 'Megastructure' | 'Industrial' | 'Hive' | 'Volcanic';
export type ClearType = 'level' | 'chapter';
export type LevelId = `${number}-${number}`;
export type AmbientPressure = 'none' | 'light' | 'standard';

export interface ChapterRecord {
  number: number;
  key: ChapterKey;
  name: string;
  archetype: number;
}

export interface CampaignLevelRecord {
  id: LevelId;
  chapterNumber: number;
  levelNumber: number;
  chapterKey: ChapterKey;
  chapterName: string;
  archetype: number;
  sector: string;
  softTierCap: number;
  ambientPressure: AmbientPressure;
  isFinale: boolean;
  clearType: ClearType;
  implemented: boolean;
  finaleBossArchetype: number | null;
}

export interface LevelLabel {
  id: LevelId;
  chapterName: string;
}

const isTesting = typeof process !== 'undefined' && process.env.VITEST === 'true';
const showDevHell = ENABLE_ADVANCED_TITLE_OPTIONS && !isTesting;

const IMPLEMENTED_LEVEL_IDS = new Set<LevelId>([
  ...(showDevHell ? ['0-1'] as const : []),
  '1-1',
  '1-2',
  '1-3',
  '1-4',
  '1-5',
  '2-1',
  '2-2',
  '2-3',
  '2-4',
  '2-5',
  '3-1',
  '3-2',
  '3-3',
  '3-4',
  '3-5',
  '4-1',
  '4-2',
  '4-3',
  '4-4',
  '4-5',
]);

export const CHAPTERS: readonly ChapterRecord[] = [
  ...(showDevHell
    ? [{ number: 0, key: 'Megastructure' as const, name: "Developer's Hell", archetype: 0 }]
    : []),
  { number: 1, key: 'Megastructure', name: 'The Outer Array', archetype: 1 },
  { number: 2, key: 'Industrial', name: 'Iron Vein', archetype: 2 },
  { number: 3, key: 'Hive', name: 'Hive Womb', archetype: 3 },
  { number: 4, key: 'Volcanic', name: 'Cinder Core', archetype: 4 },
];

const SOFT_TIER_CAPS: Record<number, readonly number[]> = {
  1: [1, 1, 2, 2, 3],
  2: [2, 2, 3, 3, 4],
  3: [3, 3, 3, 4, 4],
  4: [4, 4, 4, 5, 5],
};

const AMBIENT_PRESSURE_BY_CHAPTER: Record<number, readonly AmbientPressure[]> = {
  1: ['none', 'light', 'light', 'none', 'none'],
  2: ['light', 'standard', 'standard', 'standard', 'none'],
  3: ['light', 'standard', 'standard', 'standard', 'none'],
  4: ['light', 'standard', 'standard', 'standard', 'none'],
};

// Level→Sector mapping (ADR 0027). Each level maps to one named Sector within
// its chapter; Sector *definitions* (visuals, terrain, prop layouts) live in
// src/level/sectors/. Keys are stable content identifiers, not display names.
const SECTORS_BY_CHAPTER: Record<number, readonly string[]> = {
  1: ['outerHull', 'antennaField', 'transitSpine', 'cargoLane', 'coreGate'],
  2: ['intakeManifold', 'conveyorGallery', 'pressHall', 'coolantRun', 'smelterCore'],
  3: ['outerMembrane', 'gullet', 'nursery', 'capillaryJunction', 'wombCore'],
  4: ['basaltApproach', 'magmaConduit', 'crystalCavern', 'ashFalls', 'calderaHeart'],
};

function buildCampaignLevels(): CampaignLevelRecord[] {
  const levels: CampaignLevelRecord[] = [];

  for (const chapter of CHAPTERS) {
    for (let levelNumber = 1; levelNumber <= 5; levelNumber++) {
      const isFinale = levelNumber === 5;
      levels.push({
        id: `${chapter.number}-${levelNumber}` as LevelId,
        chapterNumber: chapter.number,
        levelNumber,
        chapterKey: chapter.key,
        chapterName: chapter.name,
        archetype: chapter.archetype,
        sector: SECTORS_BY_CHAPTER[chapter.number]?.[levelNumber - 1] ?? 'default',
        softTierCap: SOFT_TIER_CAPS[chapter.number]?.[levelNumber - 1] ?? 5,
        ambientPressure: AMBIENT_PRESSURE_BY_CHAPTER[chapter.number]?.[levelNumber - 1] ?? 'none',
        isFinale,
        clearType: isFinale ? 'chapter' : 'level',
        implemented: IMPLEMENTED_LEVEL_IDS.has(`${chapter.number}-${levelNumber}` as LevelId),
        finaleBossArchetype: isFinale ? chapter.archetype : null,
      });
    }
  }

  // Programmatic verification: assert that each chapter's soft tier cap progression is non-decreasing.
  let prevChapter = -1;
  let prevCap = 0;
  for (const level of levels) {
    if (level.chapterNumber === 0) continue; // Skip dev-only levels in progression check
    if (level.chapterNumber !== prevChapter) {
      prevChapter = level.chapterNumber;
      prevCap = 0;
    }
    if (level.softTierCap < prevCap) {
      throw new Error(`Campaign progression regression: Level ${level.id} softTierCap (${level.softTierCap}) is lower than preceding level's cap within the chapter (${prevCap}).`);
    }
    prevCap = level.softTierCap;
  }

  return levels;
}

export const CAMPAIGN_LEVELS: readonly CampaignLevelRecord[] = buildCampaignLevels();
export const IMPLEMENTED_LEVELS: readonly CampaignLevelRecord[] = CAMPAIGN_LEVELS.filter((level) => level.implemented);

const LEVEL_BY_ID = new Map<LevelId, CampaignLevelRecord>(
  CAMPAIGN_LEVELS.map((level) => [level.id, level]),
);

export function getCampaignLevel(id: LevelId): CampaignLevelRecord {
  const level = LEVEL_BY_ID.get(id);
  if (!level) throw new Error(`Unknown campaign level: ${id}`);
  return level;
}

export function getImplementedLevelById(id: string): CampaignLevelRecord | null {
  const level = LEVEL_BY_ID.get(id as LevelId);
  if (!level?.implemented) return null;
  return level;
}

export function getFirstImplementedLevel(): CampaignLevelRecord {
  const level = IMPLEMENTED_LEVELS[0];
  if (!level) throw new Error('No implemented campaign levels are defined.');
  return level;
}

export function getNextImplementedLevel(current: CampaignLevelRecord): CampaignLevelRecord | null {
  const idx = IMPLEMENTED_LEVELS.findIndex((level) => level.id === current.id);
  if (idx < 0) throw new Error(`Implemented campaign level not found: ${current.id}`);
  return IMPLEMENTED_LEVELS[idx + 1] ?? null;
}

export function getPreviousImplementedLevel(current: CampaignLevelRecord): CampaignLevelRecord {
  const idx = IMPLEMENTED_LEVELS.findIndex((level) => level.id === current.id);
  if (idx < 0) throw new Error(`Implemented campaign level not found: ${current.id}`);
  return IMPLEMENTED_LEVELS[(idx - 1 + IMPLEMENTED_LEVELS.length) % IMPLEMENTED_LEVELS.length]!;
}

export function getNextTitleLevel(current: CampaignLevelRecord): CampaignLevelRecord {
  const idx = IMPLEMENTED_LEVELS.findIndex((level) => level.id === current.id);
  if (idx < 0) throw new Error(`Implemented campaign level not found: ${current.id}`);
  return IMPLEMENTED_LEVELS[(idx + 1) % IMPLEMENTED_LEVELS.length]!;
}

export function toLevelLabel(level: CampaignLevelRecord): LevelLabel {
  return {
    id: level.id,
    chapterName: level.chapterName,
  };
}

export function getMusicCueForChapterKey(chapterKey: ChapterKey): MusicCue {
  switch (chapterKey) {
    case 'Megastructure': return MusicCue.CHAPTER_MEGASTRUCTURE;
    case 'Industrial': return MusicCue.CHAPTER_INDUSTRIAL;
    case 'Hive': return MusicCue.CHAPTER_HIVE;
    case 'Volcanic': return MusicCue.CHAPTER_VOLCANIC;
  }
}
