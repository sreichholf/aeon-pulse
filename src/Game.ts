import * as THREE from 'three';
import { Scene } from './Scene.ts';
import { InputManager, Action } from './systems/InputManager.ts';
import { AudioManager } from './systems/audio/AudioManager.ts';
import { ScoreManager } from './systems/ScoreManager.ts';
import { GameplayRun } from './systems/GameplayRun.ts';
import { UI } from './ui/UI.ts';
import { TacticalDatabase } from './viewer/TacticalDatabase.ts';
import { ENABLE_ADVANCED_TITLE_OPTIONS } from './constants.ts';
import { GameState, DifficultyMode, MusicCue } from './types.ts';
import {
  getFirstImplementedLevel,
  getMusicCueForChapterKey,
  getNextImplementedLevel,
  getNextTitleLevel,
  getPreviousImplementedLevel,
  toLevelLabel,
  type CampaignLevelRecord,
} from './campaign/Campaign.ts';

const CLEAR_BONUS = 10000;
const LIVES_BONUS = 2000;
const CHAPTER_BONUS = 25000;



export class Game {
  scene: Scene;
  input: InputManager;
  audio: AudioManager;
  private _showAdvancedTitleOptions: boolean;
  private _mode: DifficultyMode;
  score: ScoreManager;
  ui: UI;
  sprites: Record<string, THREE.Texture>;

  private _state: GameState | null;
  private _running: boolean;
  private _lastTime: number;
  private _fpsElement: HTMLElement | null;
  private _frameCount: number;
  private _lastFpsTime: number;

  currentLevel: CampaignLevelRecord;
  private _savedWeaponTier: number;
  private _startWeaponTier: number;
  private _nextLevelState: GameState | null;
  private _nextLevel: CampaignLevelRecord | null;
  private _levelStartTimer: number;
  private _waitingForRestart: boolean;
  private _waitingForReturn: boolean;
  private _titlePreviewCue: MusicCue | null;

  private _run: GameplayRun | null;
  private _viewer: TacticalDatabase;

  constructor(canvas: HTMLCanvasElement, uiOverlay: HTMLElement) {
    this.scene = new Scene(canvas);
    this.input = new InputManager();
    this.audio = new AudioManager();
    this._showAdvancedTitleOptions = ENABLE_ADVANCED_TITLE_OPTIONS;
    this._mode = DifficultyMode.ROOKIE;
    this.score = new ScoreManager(this._mode);
    this.ui = new UI(uiOverlay, this.scene, this.audio, this._showAdvancedTitleOptions);
    this.sprites = {};

    this._state = null;
    this._running = false;
    this._lastTime = 0;

    this._fpsElement = document.getElementById('fps-counter');
    this._frameCount = 0;
    this._lastFpsTime = 0;

    this.currentLevel = getFirstImplementedLevel();
    this._savedWeaponTier = 1;
    this._startWeaponTier = 1; // weapon tier chosen on title screen
    this._nextLevelState = null;
    this._nextLevel = null;
    this._levelStartTimer = 0;
    this._waitingForRestart = false;
    this._waitingForReturn = false;
    this._titlePreviewCue = null;

    this._run = null;
    this._viewer = new TacticalDatabase(this.scene, this.sprites, this.ui, this.audio);
  }

  // ── BOOT ───────────────────────────────────────────────────────────────────

  start() {
    this._running = true;
    this._setState(GameState.TITLE);
    requestAnimationFrame((t) => this._loop(t));
  }

  // ── LOOP ───────────────────────────────────────────────────────────────────

  _loop(timestamp: number): void {
    if (!this._running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;

    this._frameCount++;
    if (timestamp - this._lastFpsTime >= 1000) {
      if (this._fpsElement) {
        this._fpsElement.innerText = `${this._frameCount} FPS`;
      }
      this._frameCount = 0;
      this._lastFpsTime = timestamp;
    }

    this._update(dt);
    this.input.update();
    this.scene.render(dt);

    requestAnimationFrame((t) => this._loop(t));
  }

  // ── STATE MACHINE ──────────────────────────────────────────────────────────

  _setState(next: GameState): void {
    if (this._state === GameState.VIEWER) {
      this._viewer.exit();
      this.scene.setClearAlpha(1);
      this.scene.renderer.localClippingEnabled = false;
    }

    this._state = next;
    this.scene.setTilted(next !== GameState.VIEWER);
    switch (next) {
      case GameState.TITLE: this._enterTitle(); break;
      case GameState.LEVEL_START: this._enterLevelStart(); break;
      case GameState.PLAYING: this._enterPlaying(); break;
      case GameState.PAUSED: this._enterPaused(); break;
      case GameState.GAME_OVER: this._enterGameOver(); break;
      case GameState.LEVEL_COMPLETE: this._enterLevelComplete(); break;
      case GameState.GAME_COMPLETE: this._enterGameComplete(); break;
      case GameState.VIEWER:
        this.scene.renderer.localClippingEnabled = true;
        this.scene.setClearAlpha(0);
        this._enterViewer();
        break;
    }
  }

  _update(dt: number): void {
    if (this.input.wasJustPressed(Action.TOGGLE_MUSIC)) {
      this.audio.toggleMusic();
    }

    switch (this._state) {
      case GameState.TITLE: this._updateTitle(dt); break;
      case GameState.LEVEL_START: this._updateLevelStart(dt); break;
      case GameState.PLAYING: this._updatePlaying(dt); break;
      case GameState.PAUSED: this._updatePaused(dt); break;
      case GameState.GAME_OVER: this._updateGameOver(dt); break;
      case GameState.LEVEL_COMPLETE: this._updateLevelComplete(dt); break;
      case GameState.GAME_COMPLETE: this._updateGameComplete(dt); break;
      case GameState.VIEWER: this._updateViewer(dt); break;
    }
  }

  // ── TITLE ──────────────────────────────────────────────────────────────────

  _enterTitle() {
    this.currentLevel = getFirstImplementedLevel();
    this._savedWeaponTier = 1;
    this._startWeaponTier = 1;
    this._mode = DifficultyMode.ROOKIE;
    this._titlePreviewCue = null;
    this.score = new ScoreManager(this._mode);
    this.ui.showTitle(this.score.getTopScores(), toLevelLabel(this.currentLevel), this._startWeaponTier, this._mode);
    this.audio.setMusicVolumeMultiplier(1.0);
    this.audio.playMusicCue(MusicCue.TITLE);
  }

  _updateTitle(_dt: number): void {
    if (this._showAdvancedTitleOptions && this.input.wasJustPressed(Action.VIEWER)) {
      this.audio.play('menuSelect');
      this._setState(GameState.VIEWER);
      return;
    }

    if (this._showAdvancedTitleOptions && this.input.wasJustPressed(Action.UP)) {
      this.currentLevel = getNextTitleLevel(this.currentLevel);
      this.ui.updateTitleLevel(toLevelLabel(this.currentLevel));
      this.audio.play('menuSelect');
      this._previewTitleChapterTheme();
    } else if (this._showAdvancedTitleOptions && this.input.wasJustPressed(Action.DOWN)) {
      this.currentLevel = getPreviousImplementedLevel(this.currentLevel);
      this.ui.updateTitleLevel(toLevelLabel(this.currentLevel));
      this.audio.play('menuSelect');
      this._previewTitleChapterTheme();
    }

    if (this._showAdvancedTitleOptions && this.input.wasJustPressed(Action.RIGHT)) {
      this._startWeaponTier = this._startWeaponTier === 5 ? 1 : this._startWeaponTier + 1;
      this.ui.updateTitleWeapon(this._startWeaponTier);
      this.audio.play('menuSelect');
    } else if (this._showAdvancedTitleOptions && this.input.wasJustPressed(Action.LEFT)) {
      this._startWeaponTier = this._startWeaponTier === 1 ? 5 : this._startWeaponTier - 1;
      this.ui.updateTitleWeapon(this._startWeaponTier);
      this.audio.play('menuSelect');
    }

    if (this.input.wasJustPressed(Action.MODE)) {
      const modes = [DifficultyMode.ROOKIE, DifficultyMode.PILOT, DifficultyMode.ACE];
      const currentIdx = modes.indexOf(this._mode);
      this._mode = modes[(currentIdx + 1) % modes.length]!;
      this.score = new ScoreManager(this._mode);
      this.ui.updateTitleMode(this._mode);
      this.ui.showTitleScores(this.score.getTopScores());
      this.audio.play('menuSelect');
    }

    if (this.input.wasJustPressed(Action.FIRE) ||
      this.input.wasJustPressed(Action.CONFIRM)) {
      this.audio.play('menuSelect');
      this._savedWeaponTier = this._startWeaponTier; // commit chosen tier before gameplay starts
      this._setState(GameState.LEVEL_START);
    }
  }

  // ── LEVEL START ───────────────────────────────────────────────────────────

  _enterLevelStart(): void {
    this.ui.showLevelStart(toLevelLabel(this.currentLevel));
    this._levelStartTimer = 1.2;
    this.audio.playMusicCue(getMusicCueForChapterKey(this.currentLevel.chapterKey));
  }

  _updateLevelStart(dt: number): void {
    this._levelStartTimer -= dt;
    if (
      this._levelStartTimer <= 0 ||
      this.input.wasJustPressed(Action.FIRE) ||
      this.input.wasJustPressed(Action.CONFIRM)
    ) {
      this._setState(GameState.PLAYING);
    }
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────

  _enterPlaying() {
    if (this._run) {
      this.audio.setMusicVolumeMultiplier(0.3);
      this.ui.showHUD();
      this.ui.updateHUD(this._run.getHUDSnapshot());
      return;
    }

    if (this.currentLevel.id === getFirstImplementedLevel().id) {
      this.score.reset();
    }
    this.audio.setMusicVolumeMultiplier(0.3);
    this.ui.showHUD();
    this._run = new GameplayRun({
      scene: this.scene,
      sprites: this.sprites,
      input: this.input,
      audio: this.audio,
      score: this.score,
      onLevelComplete: () => this.onLevelComplete(),
    });
    this._run.start(this.currentLevel, this._savedWeaponTier, this._mode);
    this.ui.updateHUD(this._run.getHUDSnapshot());
  }

  _updatePlaying(dt: number): void {
    if (this.input.wasJustPressed(Action.PAUSE)) {
      this.audio.play('menuSelect');
      this._setState(GameState.PAUSED);
      return;
    }

    this._run?.tick(dt);
    this.ui.updateHUD(this._run?.getHUDSnapshot() ?? {});

    if (this.score.isGameOver) {
      this._setState(GameState.GAME_OVER);
    }
  }

  // ── PAUSED ────────────────────────────────────────────────────────────────

  _enterPaused(): void {
    this.audio.stopChargeHum();
    this.audio.setMusicVolumeMultiplier(0.08);
    this.ui.showPause();
    this.ui.updateHUD(this._run?.getHUDSnapshot() ?? {});
  }

  _updatePaused(_dt: number): void {
    this.ui.updateHUD(this._run?.getHUDSnapshot() ?? {});

    if (
      this.input.wasJustPressed(Action.PAUSE) ||
      this.input.wasJustPressed(Action.FIRE) ||
      this.input.wasJustPressed(Action.CONFIRM)
    ) {
      this.audio.play('menuSelect');
      this._setState(GameState.PLAYING);
    }
  }

  // Called by LevelManager when the boss is defeated
  onLevelComplete() {
    this._nextLevel = getNextImplementedLevel(this.currentLevel);
    this._nextLevelState = this._nextLevel ? GameState.LEVEL_START : GameState.GAME_COMPLETE;
    this._setState(GameState.LEVEL_COMPLETE);
  }

  // ── GAME OVER ──────────────────────────────────────────────────────────────

  _enterGameOver() {
    this.audio.stopMusic();
    this.audio.play('gameOver');
    this._clearGameplay();

    this.ui.showGameOver(
      this.score.score,
      this.score.getTopScores(),
      (initials) => {
        this.score.saveScore(initials);
        this.audio.play('scoreEntry');
      },
    );

    this._waitingForRestart = false;
    // Allow restart only after a short delay to prevent accidental skip
    setTimeout(() => { this._waitingForRestart = true; }, 1500);
  }

  _updateGameOver(_dt: number): void {
    if (this._waitingForRestart &&
      (this.input.wasJustPressed(Action.FIRE) ||
        this.input.wasJustPressed(Action.CONFIRM))) {
      this.audio.play('menuSelect');
      this._setState(GameState.TITLE);
    }
  }

  // ── LEVEL COMPLETE ─────────────────────────────────────────────────────────

  _enterLevelComplete() {
    this.audio.play('levelComplete');
    this._savedWeaponTier = this._run?.getSavedWeaponTier() ?? 1;
    this._clearGameplay();

    const livesBonus = this.score.lives * LIVES_BONUS;
    const chapterBonus = this.currentLevel.isFinale ? CHAPTER_BONUS : 0;
    const preBonusScore = this.score.score;
    this.score.addScore(CLEAR_BONUS + livesBonus + chapterBonus);

    const nextState = this._nextLevelState ?? GameState.TITLE;

    this.ui.showLevelComplete({
      title: this.currentLevel.isFinale ? 'CHAPTER COMPLETE' : 'LEVEL COMPLETE',
      clearTypeLabel: this.currentLevel.clearType === 'chapter' ? 'CHAPTER FINALE CLEAR' : 'LEVEL CLEAR',
      chapterName: this.currentLevel.chapterName,
      levelId: this.currentLevel.id,
      baseScore: preBonusScore,
      clearBonus: CLEAR_BONUS,
      livesBonus,
      chapterBonus,
      onContinue: () => {
        this.audio.play('menuSelect');
        if (nextState === GameState.LEVEL_START && this._nextLevel) {
          this.currentLevel = this._nextLevel;
        }
        setTimeout(() => this._setState(nextState), 400);
      },
    });
  }

  _updateLevelComplete(_dt: number): void { }

  // ── GAME COMPLETE ──────────────────────────────────────────────────────────

  _enterGameComplete() {
    this.audio.play('levelComplete');
    this.ui.showGameComplete(
      this.score.score,
      this.score.getTopScores(),
      (initials) => {
        this.score.saveScore(initials);
        this.audio.play('scoreEntry');
      }
    );
    this._waitingForReturn = false;
    setTimeout(() => { this._waitingForReturn = true; }, 1500);
  }

  _updateGameComplete(_dt: number): void {
    if (this._waitingForReturn &&
      (this.input.wasJustPressed(Action.FIRE) ||
        this.input.wasJustPressed(Action.CONFIRM))) {
      this.audio.play('menuSelect');
      this.currentLevel = getFirstImplementedLevel();
      this._savedWeaponTier = 1;
      this._setState(GameState.TITLE);
    }
  }

  // ── GAMEPLAY RUN ──────────────────────────────────────────────────────────

  _clearGameplay() {
    this._run?.clear();
    this._run = null;
  }

  // ── VIEWER ─────────────────────────────────────────────────────────────────

  _enterViewer() {
    this._clearGameplay();
    this._viewer.enter();
  }

  _updateViewer(dt: number): void {
    if (this.input.wasJustPressed(Action.PAUSE)) {
      this.audio.play('menuSelect');
      this._setState(GameState.TITLE);
      return;
    }

    if (this.input.wasJustPressed(Action.LEFT)) {
      this._viewer.changePage(-1);
    } else if (this.input.wasJustPressed(Action.RIGHT)) {
      this._viewer.changePage(1);
    }

    this._viewer.update(dt);
  }

  private _previewTitleChapterTheme(): void {
    if (!this._showAdvancedTitleOptions) return;

    const nextCue = getMusicCueForChapterKey(this.currentLevel.chapterKey);
    if (nextCue === this._titlePreviewCue) return;

    this._titlePreviewCue = nextCue;
    this.audio.playMusicCue(nextCue);
  }
}
