import type { AmbientPressure, CampaignLevelRecord } from '../campaign/Campaign.ts';
import { type IBackgroundWithSpeed, EnemyType } from '../types.ts';
import { spawnPropEvent, type StageEvent, type WaveEntry } from './StageEvents.ts';
import type { PropSpawnEntry } from './sectors/Sectors.ts';
import type { ResolvedLevelContent } from './ResolvedLevelContent.ts';

// Minimal interface for the game host — avoids importing Game.ts directly
export interface LevelGameHost {
  background: IBackgroundWithSpeed | null;
  handleStageEvent(event: StageEvent): void;
  spawnBoss(): void;
  completeLevel(): void;
  isLevelClearGateOpen(): boolean;
  spawnEnemy(type: EnemyType, x: number, y: number): void;
  hasEnemyNear(x: number, y: number, radius: number): boolean;
}

export class LevelManager {
  private _game: LevelGameHost;
  private _level: CampaignLevelRecord;
  private _scrollSpeed: number;
  private _bossAt: number;
  private _scrollX: number;
  private _waveIdx: number;
  private _bossSpawned: boolean;
  private _levelCompleted: boolean;
  private _waves: WaveEntry[];
  private _propLayout: readonly PropSpawnEntry[];
  private _propIdx: number;
  private _popcornTimer: number;
  private _ambientPressure: AmbientPressure;

  constructor(game: LevelGameHost, content: ResolvedLevelContent) {
    this._game        = game;
    this._level       = content.level;
    this._scrollSpeed = content.scrollSpeed;
    this._bossAt      = content.bossAt;
    this._scrollX     = 0;
    this._waveIdx     = 0;
    this._bossSpawned = false;
    this._levelCompleted = false;
    this._waves       = [...content.waves];
    this._propLayout  = content.propLayout;
    this._propIdx     = 0;
    this._ambientPressure = content.level.ambientPressure;
    this._popcornTimer = this._initialPopcornDelay(content.level.ambientPressure);

    if (game.background) game.background.baseSpeed = this._scrollSpeed;
  }

  get scrollX(): number { return this._scrollX; }

  update(dt: number): void {
    this._scrollX += this._scrollSpeed * dt;

    while (
      this._waveIdx < this._waves.length! &&
      this._scrollX >= this._waves[this._waveIdx]!.at
    ) {
      for (const event of this._waves[this._waveIdx]!.events) {
        this._game.handleStageEvent(event);
      }
      this._waveIdx++;
    }

    // Sector prop layout drains on the same scroll-anchor contract as waves.
    while (
      this._propIdx < this._propLayout.length &&
      this._scrollX >= this._propLayout[this._propIdx]!.at
    ) {
      const entry = this._propLayout[this._propIdx]!;
      this._game.handleStageEvent(spawnPropEvent(entry.propType, entry.x, entry.y, entry.isFullGate, entry.burstWindow));
      this._propIdx++;
    }

    if (this._level.isFinale && !this._bossSpawned && this._waveIdx >= this._waves.length && this._scrollX >= this._bossAt) {
      this._game.spawnBoss();
      this._bossSpawned = true;
    } else if (
      !this._level.isFinale &&
      !this._levelCompleted &&
      this._waveIdx >= this._waves.length &&
      this._game.isLevelClearGateOpen()
    ) {
      this._levelCompleted = true;
      this._game.completeLevel();
    }

    if (this._ambientPressure !== 'none' && !this._levelCompleted && !this._bossSpawned) {
      this._popcornTimer -= dt;
      if (this._popcornTimer <= 0) {
        this._spawnAmbientPopcorn();
        this._popcornTimer = this._nextPopcornDelay(this._ambientPressure);
      }
    }
  }

  private _initialPopcornDelay(pressure: AmbientPressure): number {
    switch (pressure) {
      case 'light':
        return 2.6;
      case 'standard':
        return 1.5;
      case 'none':
      default:
        return Number.POSITIVE_INFINITY;
    }
  }

  private _nextPopcornDelay(pressure: AmbientPressure): number {
    switch (pressure) {
      case 'light':
        return 3.5 + Math.random() * 1.5;
      case 'standard':
        return 2.5 + Math.random() * 1.5;
      case 'none':
      default:
        return Number.POSITIVE_INFINITY;
    }
  }

  private _spawnAmbientPopcorn(): void {
    const chapter = this._level.chapterNumber;
    let pool: { type: EnemyType; weight: number }[] = [];

    if (chapter === 1) {
      pool = [
        { type: EnemyType.STRAIGHT, weight: 0.7 },
        { type: EnemyType.DIVER, weight: 0.3 }
      ];
    } else if (chapter === 2) {
      pool = [
        { type: EnemyType.STRAIGHT, weight: 0.4 },
        { type: EnemyType.SINE, weight: 0.4 },
        { type: EnemyType.CHARGER, weight: 0.2 }
      ];
    } else if (chapter === 3) {
      pool = [
        { type: EnemyType.STRAIGHT, weight: 0.3 },
        { type: EnemyType.SINE, weight: 0.3 },
        { type: EnemyType.SWARM, weight: 0.4 }
      ];
    } else {
      pool = [
        { type: EnemyType.STRAIGHT, weight: 0.3 },
        { type: EnemyType.SINE, weight: 0.3 },
        { type: EnemyType.CHARGER, weight: 0.2 },
        { type: EnemyType.SWARM, weight: 0.2 }
      ];
    }

    const rand = Math.random();
    let cumulative = 0;
    let selectedType = EnemyType.STRAIGHT;

    for (const item of pool) {
      cumulative += item.weight;
      if (rand <= cumulative) {
        selectedType = item.type;
        break;
      }
    }

    const spawnX = 550;
    let spawnY = 0;
    let attempts = 0;
    const maxAttempts = 10;
    const avoidRadius = 50;

    do {
      spawnY = (Math.random() - 0.5) * 400; // range -200 to 200
      attempts++;
    } while (attempts < maxAttempts && this._game.hasEnemyNear(spawnX, spawnY, avoidRadius));

    this._game.spawnEnemy(selectedType, spawnX, spawnY);
  }

  destroy(): void {}
}
