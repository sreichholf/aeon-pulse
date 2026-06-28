import * as THREE from 'three';
import { spawnEnemy } from '../entities/EntityRegistry.ts';
import { Player } from '../entities/Player.ts';
import { DifficultyMode, EnemyType, type GetPositionFn, type IAudio, type IEnemy, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { Background } from '../level/Background.ts';
import { Background2 } from '../level/Background2.ts';
import { Background3 } from '../level/Background3.ts';
import { Background4 } from '../level/Background4.ts';
import { Terrain } from '../level/Terrain.ts';
import { Terrain3 } from '../level/Terrain3.ts';
import { Terrain4 } from '../level/Terrain4.ts';

const NO_OP_AUDIO: IAudio = {
  play: () => {},
};

const NO_OP_PROJECTILE_FACTORY: ProjectileFactoryFn = () => null as never;
const NO_OP_GET_POSITION: GetPositionFn = () => ({ x: 0, y: 0 });

export const STANDARD_ENEMY_WARMUP_TYPES: readonly EnemyType[] = [
  EnemyType.STRAIGHT,
  EnemyType.SINE,
  EnemyType.DIVER,
  EnemyType.SWARM,
  EnemyType.TURRET,
  EnemyType.CHARGER,
  EnemyType.ROCK_DRAKE,
  EnemyType.STALACTITE,
] as const;

const WARMUP_LAYOUT: ReadonlyArray<{ x: number; y: number }> = [
  { x: -280, y: 110 },
  { x: -120, y: 110 },
  { x: 40, y: 110 },
  { x: 200, y: 110 },
  { x: -280, y: -30 },
  { x: -120, y: -30 },
  { x: 40, y: -30 },
  { x: 200, y: -30 },
];

export interface RenderWarmupResult {
  durationMs: number;
  spawnedCount: number;
  warmedEnemyTypes: EnemyType[];
}

export async function withStandardEnemyRenderWarmup(
  scene: IScene,
  sprites: Record<string, THREE.Texture>,
  playerModel: THREE.Group | null,
  warmup: () => Promise<void> | void,
): Promise<RenderWarmupResult> {
  const startedAt = performance.now();
  const spawnedEnemies: IEnemy[] = [];
  const warmedEnemyTypes: EnemyType[] = [];
  const spawnedBackgrounds: any[] = [];
  const spawnedTerrains: any[] = [];
  let dummyPlayer: Player | null = null;

  try {
    // 1. Spawn standard enemies
    for (const [index, enemyType] of STANDARD_ENEMY_WARMUP_TYPES.entries()) {
      const layout = WARMUP_LAYOUT[index] ?? WARMUP_LAYOUT.at(-1)!;
      const enemy = spawnEnemy(enemyType, {
        scene,
        sprites,
        x: layout.x,
        y: layout.y,
        getPos: NO_OP_GET_POSITION,
        audio: NO_OP_AUDIO,
        getScrollX: () => 0,
        terrain: null,
        projectileFactory: NO_OP_PROJECTILE_FACTORY,
      });

      if (!enemy) continue;
      spawnedEnemies.push(enemy);
      warmedEnemyTypes.push(enemyType);
    }

    // 2. Spawn dummy player craft with its GLB model and instanced particle systems
    if (playerModel) {
      dummyPlayer = new Player(
        scene,
        sprites,
        { isDown: () => false, wasJustPressed: () => false }, // dummy input
        { play: () => {}, startChargeHum: () => {}, stopChargeHum: () => {} }, // dummy audio
        NO_OP_PROJECTILE_FACTORY,
        DifficultyMode.ACE,
        false,
        playerModel,
      );
    }

    // 3. Spawn background managers for all archetypes
    try {
      spawnedBackgrounds.push(new Background(scene));
      spawnedBackgrounds.push(new Background2(scene, 0));
      spawnedBackgrounds.push(new Background3(scene));
      spawnedBackgrounds.push(new Background4(scene));
    } catch (error) {
      console.warn('Render warmup background creation failed:', error);
    }

    // 4. Spawn terrain meshes for all archetypes using dummy control points
    try {
      const dummyPts = [
        { at: 0, top: 200, bottom: -200 },
        { at: 1000, top: 200, bottom: -200 }
      ];
      spawnedTerrains.push(new Terrain(scene, dummyPts));
      spawnedTerrains.push(new Terrain3(scene, dummyPts));
      spawnedTerrains.push(new Terrain4(scene, dummyPts));
    } catch (error) {
      console.warn('Render warmup terrain creation failed:', error);
    }

    // 5. Force compilation and single-pass post-processing rendering
    await warmup();

    return {
      durationMs: performance.now() - startedAt,
      spawnedCount: spawnedEnemies.length,
      warmedEnemyTypes,
    };
  } finally {
    for (const enemy of spawnedEnemies) {
      enemy.destroy();
    }
    if (dummyPlayer) {
      dummyPlayer.destroy();
    }
    for (const bg of spawnedBackgrounds) {
      bg.destroy();
    }
    for (const terr of spawnedTerrains) {
      terr.destroy?.();
    }
  }
}
