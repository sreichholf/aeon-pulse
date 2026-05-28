import './ui.css';

import type { AudioManager }    from '../systems/audio/AudioManager.ts';
import { TitleScreen }         from './screens/TitleScreen.ts';
import { LevelStartScreen }    from './screens/LevelStartScreen.ts';
import { HUDScreen }           from './screens/HUDScreen.ts';
import { GameOverScreen }      from './screens/GameOverScreen.ts';
import { GameCompleteScreen }  from './screens/GameCompleteScreen.ts';
import { LevelCompleteScreen } from './screens/LevelCompleteScreen.ts';
import { ViewerScreen }        from './screens/ViewerScreen.ts';
import { VolumeControl }       from './screens/VolumeControl.ts';
import type { LevelLabel } from '../campaign/Campaign.ts';
import { DifficultyMode } from '../types.ts';

/** Minimal scene surface UI needs — avoids importing Scene.ts and creating a circular dep chain */
interface SceneLike {
  readonly scale: number;
}

interface ScoreEntry {
  initials: string;
  score: number;
}

interface LevelCompleteArgs {
  title: string;
  clearTypeLabel: string;
  chapterName: string;
  levelId: string;
  baseScore: number;
  livesBonus: number;
  clearBonus: number;
  chapterBonus: number;
  onContinue?: () => void;
}

export class UI {
  private _scene: SceneLike;
  private _container: HTMLElement;
  private _bgContainer: HTMLElement | null;
  private _title: TitleScreen;
  private _levelStart: LevelStartScreen;
  private _hud: HUDScreen;
  private _gameOver: GameOverScreen;
  private _gameComplete: GameCompleteScreen;
  private _levelComplete: LevelCompleteScreen;
  private _viewer: ViewerScreen;
  private _volumeControl: VolumeControl;
  private _onResize: () => void;

  constructor(overlay: HTMLElement, scene: SceneLike, audio: AudioManager | null) {
    this._scene = scene;

    this._container = document.createElement('div');
    this._container.id = 'ui-container';
    overlay.appendChild(this._container);

    const bgOverlay = document.getElementById('ui-background');
    if (bgOverlay) {
      this._bgContainer = document.createElement('div');
      this._bgContainer.id = 'ui-bg-container';
      bgOverlay.appendChild(this._bgContainer);
    } else {
      this._bgContainer = null;
    }

    this._title         = new TitleScreen();
    this._levelStart    = new LevelStartScreen();
    this._hud           = new HUDScreen();
    this._gameOver      = new GameOverScreen();
    this._gameComplete  = new GameCompleteScreen();
    this._levelComplete = new LevelCompleteScreen();
    this._viewer        = new ViewerScreen();

    for (const s of [this._title, this._levelStart, this._hud, this._gameOver, this._gameComplete, this._levelComplete, this._viewer]) {
      this._container.appendChild(s.el);
    }

    if (this._bgContainer) this._bgContainer.appendChild(this._viewer.bgEl);

    this._volumeControl = new VolumeControl(audio);
    this._container.appendChild(this._volumeControl.el);

    this._onResize = () => this._updateScale();
    this._updateScale();
    window.addEventListener('resize', this._onResize);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _hideAll(): void {
    this._title.hide();
    this._levelStart.hide();
    this._hud.hide();
    this._gameOver.hide();
    this._gameComplete.hide();
    this._levelComplete.hide();
    this._viewer.hide();
  }

  private _updateScale(): void {
    this._container.style.transform = `scale(${this._scene.scale})`;
    if (this._bgContainer) {
      this._bgContainer.style.transform = `scale(${this._scene.scale})`;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  showTitle(topScores: ScoreEntry[] = [], currentLevel: LevelLabel, weaponTier = 1, mode: DifficultyMode = DifficultyMode.ACE): void {
    this._hideAll();
    this._title.show(topScores, currentLevel, weaponTier, mode);
  }

  updateTitleLevel(level: LevelLabel): void { this._title.updateTitleLevel(level); }
  updateTitleWeapon(tier: number): void { this._title.updateTitleWeapon(tier); }
  updateTitleMode(mode: DifficultyMode): void { this._title.updateTitleMode(mode); }
  showTitleScores(topScores: ScoreEntry[]): void { this._title.showTitleScores(topScores); }

  showLevelStart(level: LevelLabel): void {
    this._hideAll();
    this._levelStart.show(level);
  }

  showHUD(): void {
    this._hideAll();
    this._hud.show();
  }

  updateHUD(args: Parameters<HUDScreen['updateHUD']>[0]): void { this._hud.updateHUD(args); }

  showGameOver(score: number, topScores: ScoreEntry[], onSubmit?: (initials: string) => void): void {
    this._hideAll();
    this._gameOver.show(score, topScores, onSubmit);
  }

  showLevelComplete(args: LevelCompleteArgs): void {
    this._hideAll();
    this._levelComplete.show(args);
  }

  showGameComplete(score: number, topScores: ScoreEntry[], onSubmit?: (initials: string) => void): void {
    this._hideAll();
    this._gameComplete.show(score, topScores, onSubmit);
  }

  showViewer(page: number, entities: Parameters<ViewerScreen['show']>[1]): void {
    this._hideAll();
    this._viewer.show(page, entities);
  }

  hideViewer(): void { this._viewer.hide(); }

  destroy(): void {
    window.removeEventListener('resize', this._onResize);
  }
}
