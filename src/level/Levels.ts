import { Background } from './Background.ts';
import { Background2 } from './Background2.ts';
import { Background3 } from './Background3.ts';
import { Background4 } from './Background4.ts';
import { Terrain } from './Terrain.ts';
import { Terrain3 } from './Terrain3.ts';
import { Terrain4 } from './Terrain4.ts';
import { Boss } from '../entities/Boss.ts';
import { Boss2 } from '../entities/Boss2.ts';
import { Boss3 } from '../entities/Boss3.ts';
import { Boss4 } from '../entities/Boss4.ts';
import { buildChapter0Waves } from './waves/chapter0.ts';
import { buildChapter1Waves } from './waves/chapter1.ts';
import { buildChapter2Waves } from './waves/chapter2.ts';
import { buildChapter3Waves } from './waves/chapter3.ts';
import { buildChapter4Waves } from './waves/chapter4.ts';
import { CHAPTER_1_PLAYFIELD_BOUNDS } from './PlayfieldBounds.ts';
import { type SectorBackgroundConfig, type SectorTerrainPoint } from './sectors/Sectors.ts';
import type { IBackground, IBackgroundWithSpeed, ITerrain, IBoss, IScene, BossConstructorParams, PlayfieldBounds } from '../types.ts';
import type { CampaignLevelRecord } from '../campaign/Campaign.ts';
import type { WaveEntry } from './StageEvents.ts';
import type { CorridorResolver } from './CorridorResolver.ts';
import * as THREE from 'three';

type ControlPoint = SectorTerrainPoint;

export interface LevelConfig {
  scrollSpeed: number;
  bossAt: number;
  terrainPoints: ControlPoint[];
  playfieldBounds: PlayfieldBounds | null;
  /** Scale factor applied to authored terrain control-point `at` values at runtime. */
  terrainPointScale: number;
  buildWaves: (level: CampaignLevelRecord, resolver: CorridorResolver) => WaveEntry[];
  createBackground: (scene: IScene, backgroundConfig?: SectorBackgroundConfig) => IBackgroundWithSpeed;
  createTerrain: ((scene: IScene, pts: ControlPoint[]) => ITerrain) | null;
  createBoss: (params: BossConstructorParams) => IBoss;
}

export const LEVELS: Record<number, LevelConfig> = {
  1: {
    scrollSpeed: 100,
    bossAt: 7300,
    terrainPoints: [],
    playfieldBounds: CHAPTER_1_PLAYFIELD_BOUNDS,
    terrainPointScale: 1,
    buildWaves: (level, resolver) => buildChapter1Waves(level.id, resolver),
    createBackground: (scene, backgroundConfig) => new Background(scene, 100, backgroundConfig),
    createTerrain: null,
    createBoss: (params) => new Boss(params),
  },
  2: {
    scrollSpeed: 120,
    bossAt: 7300,
    playfieldBounds: null,
    terrainPoints: [],
    terrainPointScale: 0.65,
    buildWaves: (level, resolver) => buildChapter2Waves(level.id, resolver),
    createBackground: (scene, backgroundConfig) => new Background2(scene, 120, backgroundConfig),
    createTerrain: (scene, pts) => new Terrain(scene, pts.map((pt) => ({ ...pt, at: pt.at * 0.65 }))),
    createBoss: (params) => new Boss2(params),
  },
  3: {
    scrollSpeed: 130,
    bossAt: 7300,
    playfieldBounds: null,
    terrainPoints: [],
    terrainPointScale: 0.65,
    buildWaves: (level, resolver) => buildChapter3Waves(level.id, resolver),
    createBackground: (scene, backgroundConfig) => new Background3(scene, 130, backgroundConfig),
    createTerrain: (scene, pts) => new Terrain3(scene, pts.map((pt) => ({ ...pt, at: pt.at * 0.65 }))),
    createBoss: (params) => new Boss3(params),
  },
  4: {
    scrollSpeed: 140,
    bossAt: 7300,
    playfieldBounds: null,
    terrainPoints: [],
    terrainPointScale: 0.65,
    buildWaves: (level, resolver) => buildChapter4Waves(level.id, resolver),
    createBackground: (scene, backgroundConfig) => new Background4(scene, backgroundConfig),
    createTerrain: (scene, pts) => new Terrain4(scene, pts.map((pt) => ({ ...pt, at: pt.at * 0.65 }))),
    createBoss: (params) => new Boss4(params),
  },
  0: {
    scrollSpeed: 100,
    bossAt: 8000,
    terrainPoints: [],
    playfieldBounds: CHAPTER_1_PLAYFIELD_BOUNDS,
    terrainPointScale: 1,
    buildWaves: (level, resolver) => buildChapter0Waves(level.id, resolver),
    createBackground: (scene, backgroundConfig) => new Background(scene, 100, backgroundConfig),
    createTerrain: null,
    createBoss: (params) => new Boss(params),
  },
};
