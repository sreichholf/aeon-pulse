export type ChapterKey = 'Megastructure' | 'Industrial' | 'Hive' | 'Volcanic';
export type ClearType = 'level' | 'chapter';
export type LevelId = `${number}-${number}`;

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
  softTierCap: number;
  isFinale: boolean;
  clearType: ClearType;
  endAt: number;
  implemented: boolean;
  finaleBossArchetype: number | null;
}

export interface LevelLabel {
  id: LevelId;
  chapterName: string;
}

const IMPLEMENTED_LEVEL_IDS = new Set<LevelId>([
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
  { number: 1, key: 'Megastructure', name: 'The Outer Array', archetype: 1 },
  { number: 2, key: 'Industrial', name: 'Iron Vein', archetype: 2 },
  { number: 3, key: 'Hive', name: 'Hive Womb', archetype: 3 },
  { number: 4, key: 'Volcanic', name: 'Cinder Core', archetype: 4 },
] as const;

const SOFT_TIER_CAPS: Record<number, readonly number[]> = {
  1: [1, 1, 1, 1, 2],
  2: [2, 2, 2, 2, 3],
  3: [3, 3, 3, 3, 4],
  4: [4, 4, 4, 5, 5],
};

const END_AT_BY_LEVEL_NUMBER: Record<number, number> = {
  1: 8200,
  2: 2800,
  3: 3800,
  4: 4800,
  5: 0,
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
        softTierCap: SOFT_TIER_CAPS[chapter.number]?.[levelNumber - 1] ?? 5,
        isFinale,
        clearType: isFinale ? 'chapter' : 'level',
        endAt: isFinale ? 0 : END_AT_BY_LEVEL_NUMBER[levelNumber]!,
        implemented: IMPLEMENTED_LEVEL_IDS.has(`${chapter.number}-${levelNumber}` as LevelId),
        finaleBossArchetype: isFinale ? chapter.archetype : null,
      });
    }
  }

  // Programmatic verification: assert that the campaign soft tier cap progression is strictly monotonic
  let prevCap = 0;
  for (const level of levels) {
    if (level.softTierCap < prevCap) {
      throw new Error(`Campaign progression regression: Level ${level.id} softTierCap (${level.softTierCap}) is lower than preceding level's cap (${prevCap}).`);
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
