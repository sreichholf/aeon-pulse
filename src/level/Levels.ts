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
import { buildChapter1Waves } from './waves/chapter1.ts';
import { buildChapter2Waves } from './waves/chapter2.ts';
import { buildChapter3Waves } from './waves/chapter3.ts';
import { buildChapter4Waves } from './waves/chapter4.ts';
import { CHAPTER_1_PLAYFIELD_BOUNDS } from './PlayfieldBounds.ts';
import type { IBackground, IBackgroundWithSpeed, ITerrain, IBoss, IScene, BossConstructorParams, PlayfieldBounds } from '../types.ts';
import type { CampaignLevelRecord } from '../campaign/Campaign.ts';
import type { WaveEntry } from './StageEvents.ts';
import * as THREE from 'three';

interface ControlPoint {
  at: number;
  top: number;
  bottom: number;
}

export interface LevelConfig {
  scrollSpeed: number;
  bossAt: number;
  terrainPoints: ControlPoint[];
  playfieldBounds: PlayfieldBounds | null;
  buildWaves: (level: CampaignLevelRecord) => WaveEntry[];
  createBackground: (scene: IScene) => IBackgroundWithSpeed;
  createTerrain: ((scene: IScene, pts: ControlPoint[]) => ITerrain) | null;
  createBoss: (params: BossConstructorParams) => IBoss;
}

export const LEVELS: Record<number, LevelConfig> = {
  1: {
    scrollSpeed: 100,
    bossAt: 11200,
    terrainPoints: [],
    playfieldBounds: CHAPTER_1_PLAYFIELD_BOUNDS,
    buildWaves: (level) => buildChapter1Waves(level.id),
    createBackground: (scene) => new Background(scene),
    createTerrain: null,
    createBoss: (params) => new Boss(params),
  },
  2: {
    scrollSpeed: 120,
    bossAt: 11200,
    playfieldBounds: null,
    terrainPoints: [
      { at: 0,    top:  230, bottom: -230 },
      { at: 700,  top:  220, bottom: -220 },
      { at: 1300, top:  190, bottom: -190 },
      { at: 1900, top:  170, bottom: -170 },
      { at: 2600, top:  205, bottom: -185 },
      { at: 3300, top:  150, bottom: -150 },
      { at: 4000, top:  180, bottom: -165 },
      { at: 4800, top:  125, bottom: -125 },
      { at: 5600, top:  185, bottom: -180 },
      { at: 6500, top:  165, bottom: -150 },
      { at: 7400, top:  105, bottom: -105 },
      { at: 8200, top:  180, bottom: -170 },
      { at: 9200, top:  155, bottom: -155 },
      { at: 10100, top:  195, bottom: -185 },
      { at: 11600, top:  200, bottom: -200 },
    ],
    buildWaves: (level) => buildChapter2Waves(level.id),
    createBackground: (scene) => new Background2(scene, 120),
    createTerrain: (scene, pts) => new Terrain(scene, pts),
    createBoss: (params) => new Boss2(params),
  },
  3: {
    scrollSpeed: 130,
    bossAt: 11200,
    playfieldBounds: null,
    terrainPoints: [
      { at: 0,    top:  200, bottom: -200 },
      { at: 700,  top:  185, bottom: -185 },
      { at: 1400, top:  150, bottom: -150 },
      { at: 2100, top:  195, bottom: -165 },
      { at: 2900, top:  135, bottom: -135 },
      { at: 3700, top:  180, bottom: -180 },
      { at: 4600, top:  120, bottom: -120 },
      { at: 5400, top:  190, bottom: -170 },
      { at: 6300, top:  145, bottom: -145 },
      { at: 7300, top:  115, bottom: -115 },
      { at: 8200, top:  180, bottom: -180 },
      { at: 9200, top:  135, bottom: -150 },
      { at: 10100, top:  195, bottom: -185 },
      { at: 11600, top:  200, bottom: -200 },
    ],
    buildWaves: (level) => buildChapter3Waves(level.id),
    createBackground: (scene) => new Background3(scene),
    createTerrain: (scene, pts) => new Terrain3(scene, pts),
    createBoss: (params) => new Boss3(params),
  },
  4: {
    scrollSpeed: 140,
    bossAt: 11200,
    playfieldBounds: null,
    terrainPoints: [
      { at: 0,    top:  215, bottom: -210 },
      { at: 500,  top:  160, bottom: -215 },
      { at: 900,  top:  150, bottom: -130 },
      { at: 1200, top:  185, bottom:  -75 },
      { at: 1500, top:  185, bottom: -185 },
      { at: 1800, top:  100, bottom: -180 },
      { at: 2100, top:  110, bottom: -110 },
      { at: 2400, top:  200, bottom:  -95 },
      { at: 2700, top:  195, bottom: -195 },
      { at: 3100, top:  130, bottom: -195 },
      { at: 3400, top:  140, bottom:  -90 },
      { at: 3700, top:  175, bottom: -165 },
      { at: 4100, top:  100, bottom: -155 },
      { at: 4400, top:  195, bottom: -150 },
      { at: 4800, top:  200, bottom: -200 },
      { at: 5600, top:  145, bottom: -185 },
      { at: 6400, top:  120, bottom: -125 },
      { at: 7300, top:  175, bottom: -105 },
      { at: 8200, top:  115, bottom: -175 },
      { at: 9200, top:  190, bottom: -160 },
      { at: 10100, top:  135, bottom: -135 },
      { at: 11600, top:  200, bottom: -200 },
    ],
    buildWaves: (level) => buildChapter4Waves(level.id),
    createBackground: (scene) => new Background4(scene),
    createTerrain: (scene, pts) => new Terrain4(scene, pts),
    createBoss: (params) => new Boss4(params),
  },
};
