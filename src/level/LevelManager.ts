import { LEVELS, type LevelConfig } from './Levels.ts';
import type { CampaignLevelRecord } from '../campaign/Campaign.ts';
import type { IBackgroundWithSpeed } from '../types.ts';
import type { StageEvent, WaveEntry } from './StageEvents.ts';

// Minimal interface for the game host — avoids importing Game.ts directly
export interface LevelGameHost {
  background: IBackgroundWithSpeed | null;
  handleStageEvent(event: StageEvent): void;
  spawnBoss(): void;
  completeLevel(): void;
  isLevelClearGateOpen(): boolean;
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
  private _config: LevelConfig;

  constructor(game: LevelGameHost, level: CampaignLevelRecord) {
    this._game        = game;
    this._level       = level;
    const def         = LEVELS[level.archetype]!;
    this._config      = def;
    this._scrollSpeed = def.scrollSpeed;
    this._bossAt      = def.bossAt;
    this._scrollX     = 0;
    this._waveIdx     = 0;
    this._bossSpawned = false;
    this._levelCompleted = false;
    this._waves       = def.buildWaves(level);

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
  }

  destroy(): void {}
}
