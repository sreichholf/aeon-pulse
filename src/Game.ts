import * as THREE from 'three';
import { Scene } from './Scene.ts';
import { InputManager, Action } from './systems/InputManager.ts';
import { AudioManager } from './systems/audio/AudioManager.ts';
import { ScoreManager } from './systems/ScoreManager.ts';
import { GameplayRun } from './systems/GameplayRun.ts';
import { UI } from './ui/UI.ts';
import { TacticalDatabase } from './viewer/TacticalDatabase.ts';
import {
  ENABLE_ADVANCED_TITLE_OPTIONS,
  ENABLE_INVINCIBLE_PLAYER,
  ENABLE_RENDER_STATS,
  isRuntimeFlagEnabled,
} from './constants.ts';
import { GameState, DifficultyMode, MusicCue } from './types.ts';
import {
  getFirstImplementedLevel,
  getMusicCueForChapterKey,
  getNextTitleLevel,
  getPreviousImplementedLevel,
  toLevelLabel,
  type CampaignLevelRecord,
} from './campaign/Campaign.ts';
import { CampaignAttempt } from './campaign/CampaignAttempt.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import playerGlbUrl from './models/player.glb';




export class Game {
  scene: Scene;
  input: InputManager;
  audio: AudioManager;
  playerModel: THREE.Group | null = null;

  private _showAdvancedTitleOptions: boolean;
  private _showRenderStats: boolean;
  private _debugInvinciblePlayer: boolean;
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

  // Performance overlay (renderStats=1 / allocStats=1)
  private _showAllocStats: boolean;
  private _panelMode: boolean;         // true when any perf flag is active
  private _currentFps: number;         // updated once/sec for display
  private _lastHeapBytes: number;
  private _allocDeltaKb: number;
  private _peakAllocKb: number;
  // Cached once/sec to avoid per-frame scene traversal
  private _cachedRenderCalls: number;
  private _cachedObjectStats: { total: number; byCategory: Record<string, number> } | null;
  private _cachedBulletStats: { total: number; renderUnits: number } | null;

  currentLevel: CampaignLevelRecord;
  private _savedWeaponTier: number;
  private _startWeaponTier: number;
  private _nextLevelState: GameState | null;
  private _nextLevel: CampaignLevelRecord | null;
  private _attempt: CampaignAttempt | null;
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
    this._showRenderStats = isRuntimeFlagEnabled('renderStats', ENABLE_RENDER_STATS);
    this._debugInvinciblePlayer = isRuntimeFlagEnabled('invincible', ENABLE_INVINCIBLE_PLAYER);
    this._mode = DifficultyMode.ROOKIE;
    this.score = new ScoreManager(this._mode);
    this.ui = new UI(uiOverlay, this.scene, this.audio, this._showAdvancedTitleOptions);
    this.sprites = {};

    this._state = null;
    this._running = false;
    this._lastTime = 0;

    this._fpsElement = document.getElementById('fps-counter');
    this._frameCount  = 0;
    this._lastFpsTime = 0;

    this._showAllocStats    = isRuntimeFlagEnabled('allocStats', false);
    this._panelMode         = this._showRenderStats || this._showAllocStats;
    this._currentFps        = 0;
    this._lastHeapBytes     = 0;
    this._allocDeltaKb      = 0;
    this._peakAllocKb       = 0;
    this._cachedRenderCalls = 0;
    this._cachedObjectStats = null;
    this._cachedBulletStats = null;

    // Upgrade the fps-counter element to a styled panel when any perf flag is active
    if (this._panelMode && this._fpsElement) {
      Object.assign(this._fpsElement.style, {
        top: '10px',
        right: '10px',
        left: 'auto',
        color: '#e0fff8',
        fontSize: '12px',
        fontWeight: 'normal',
        textShadow: 'none',
        background: 'rgba(0,0,0,0.72)',
        borderRadius: '8px',
        padding: '10px 14px',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        minWidth: '210px',
        lineHeight: '1',
        border: '1px solid rgba(255,255,255,0.08)',
      });
    }

    this.currentLevel = getFirstImplementedLevel();
    this._savedWeaponTier = 1;
    this._startWeaponTier = 1; // weapon tier chosen on title screen
    this._nextLevelState = null;
    this._nextLevel = null;
    this._attempt = null;
    this._levelStartTimer = 0;
    this._waitingForRestart = false;
    this._waitingForReturn = false;
    this._titlePreviewCue = null;

    this._run = null;
    this._viewer = new TacticalDatabase(this.scene, this.sprites, this.ui, this.audio, () => this.playerModel);
  }

  // ── BOOT ───────────────────────────────────────────────────────────────────

  start() {
    this._running = true;
    this._preloadAssets();
    this._setState(GameState.TITLE);
    requestAnimationFrame((t) => this._loop(t));
  }

  private _preloadAssets(): void {
    const loader = new GLTFLoader();
    loader.load(
      playerGlbUrl,
      (gltf) => {
        this.playerModel = gltf.scene;
        console.log('Player GLB model preloaded successfully');
      },
      undefined,
      (error) => {
        console.error('Failed to preload player GLB model:', error);
      }
    );
  }


  // ── LOOP ───────────────────────────────────────────────────────────────────

  _loop(timestamp: number): void {
    if (!this._running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;

    this._frameCount++;

    // Sample JS heap delta every frame (Chrome-only; no-op elsewhere)
    if (this._showAllocStats) {
      const mem = (performance as any).memory as { usedJSHeapSize: number } | undefined;
      if (mem) {
        const current = mem.usedJSHeapSize;
        if (this._lastHeapBytes !== 0) {
          const delta = current - this._lastHeapBytes;
          this._allocDeltaKb = delta / 1024;
          if (this._allocDeltaKb > this._peakAllocKb) {
            this._peakAllocKb = this._allocDeltaKb;
          }
        }
        this._lastHeapBytes = current;
      }
    }

    // Once-per-second: snapshot expensive stats and update fps count
    if (timestamp - this._lastFpsTime >= 1000) {
      this._currentFps = this._frameCount;
      if (this._showRenderStats) {
        this._cachedRenderCalls = this.scene.getRenderInfo().calls;
        this._cachedObjectStats = this.scene.getSceneObjectStats();
        const bs = this._run?.getBulletStatsSnapshot();
        this._cachedBulletStats = bs ? { total: bs.total, renderUnits: bs.renderUnits } : null;
      }
      if (!this._panelMode && this._fpsElement) {
        this._fpsElement.innerText = `${this._currentFps} FPS`;
      }
      this._frameCount  = 0;
      this._lastFpsTime = timestamp;
    }

    // Panel mode: rebuild HTML every frame (alloc delta must be live)
    if (this._panelMode && this._fpsElement) {
      this._fpsElement.innerHTML = this._buildPanelHtml();
    }

    this._update(dt);
    this.input.update();
    this.scene.render(dt);

    requestAnimationFrame((t) => this._loop(t));
  }

  private _buildPanelHtml(): string {
    // Shared helpers ─────────────────────────────────────────────────────────
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const row = (label: string, value: string, valueColor = '#00ffcc') =>
      `<div style="display:flex;justify-content:space-between;align-items:baseline;` +
      `gap:16px;padding:3px 0;">`+
      `<span style="color:#8899aa;font-size:11px;text-transform:uppercase;` +
      `letter-spacing:0.06em;white-space:nowrap">${esc(label)}</span>`+
      `<span style="color:${valueColor};font-weight:bold;white-space:nowrap">${value}</span>`+
      `</div>`;
    const sep = () =>
      `<div style="border-top:1px solid rgba(255,255,255,0.1);margin:4px 0"></div>`;

    const parts: string[] = [];

    // FPS ─────────────────────────────────────────────────────────────────────
    const fpsColor = this._currentFps < 30 ? '#ff4444' : this._currentFps < 50 ? '#ffcc00' : '#00ffcc';
    parts.push(row('FPS', `${this._currentFps}`, fpsColor));

    // Render stats ────────────────────────────────────────────────────────────
    if (this._showRenderStats && this._cachedObjectStats) {
      parts.push(sep());
      parts.push(row('Draw calls', `${this._cachedRenderCalls}`));
      parts.push(row('Objects', `${this._cachedObjectStats.total}`));
      if (this._cachedBulletStats) {
        parts.push(row('Bullets', `${this._cachedBulletStats.total} / ${this._cachedBulletStats.renderUnits}`));
      }
      const cats = Object.entries(this._cachedObjectStats.byCategory)
        .sort((a, b) => b[1] - a[1]);
      if (cats.length > 0) {
        parts.push(sep());
        for (const [key, units] of cats) {
          parts.push(row(key, `${units}`, '#7fd8c8'));
        }
      }
    }

    // Alloc stats ─────────────────────────────────────────────────────────────
    if (this._showAllocStats) {
      parts.push(sep());
      const delta = this._allocDeltaKb;
      const sign  = delta >= 0 ? '+' : '';
      const allocColor = delta > 200 ? '#ff4444' : delta > 50 ? '#ffcc00' : '#00cc66';
      parts.push(row('Alloc / frame', `${sign}${delta.toFixed(0)} KB`, allocColor));
      parts.push(row('Peak alloc',   `+${this._peakAllocKb.toFixed(0)} KB`, '#ff9955'));
      const mem = (performance as any).memory as { usedJSHeapSize: number } | undefined;
      if (mem) {
        const heapMb = (mem.usedJSHeapSize / 1048576).toFixed(1);
        parts.push(row('Heap used', `${heapMb} MB`, '#aaaaaa'));
      }
    }

    return parts.join('');
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
    this._attempt = null;
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
      this._attempt = new CampaignAttempt(this.currentLevel, this._startWeaponTier);
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

    if (!this._attempt) {
      this._attempt = new CampaignAttempt(this.currentLevel, this._savedWeaponTier);
    }

    if (this._attempt.level.id === getFirstImplementedLevel().id) {
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
      invinciblePlayer: this._debugInvinciblePlayer,
      playerModel: this.playerModel,
    });

    this._run.start(this._attempt, this._mode);
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
    if (!this._attempt) {
      this._attempt = new CampaignAttempt(this.currentLevel, this._savedWeaponTier);
    }
    this._nextLevel = this._attempt.getNextLevel();
    this._nextLevelState = this._attempt.getNextGameState();
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
    if (!this._attempt) {
      this._attempt = new CampaignAttempt(this.currentLevel, this._savedWeaponTier);
    }
    this._attempt.weaponTier = this._run?.getSavedWeaponTier() ?? 1;
    this._savedWeaponTier = this._attempt.weaponTier;
    this._clearGameplay();

    const preBonusScore = this.score.score;
    const clearScores = this._attempt.calculateClearScores(this.score.lives, preBonusScore);
    this.score.addScore(clearScores.clearBonus + clearScores.livesBonus + clearScores.chapterBonus);

    const nextState = this._nextLevelState ?? GameState.TITLE;

    this.ui.showLevelComplete({
      title: this._attempt.level.isFinale ? 'CHAPTER COMPLETE' : 'LEVEL COMPLETE',
      clearTypeLabel: this._attempt.level.clearType === 'chapter' ? 'CHAPTER FINALE CLEAR' : 'LEVEL CLEAR',
      chapterName: this._attempt.level.chapterName,
      levelId: this._attempt.level.id,
      baseScore: clearScores.baseScore,
      clearBonus: clearScores.clearBonus,
      livesBonus: clearScores.livesBonus,
      chapterBonus: clearScores.chapterBonus,
      onContinue: () => {
        this.audio.play('menuSelect');
        if (nextState === GameState.LEVEL_START && this._attempt) {
          this._attempt.advance(this._attempt.weaponTier);
          this.currentLevel = this._attempt.level;
          this._savedWeaponTier = this._attempt.weaponTier;
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
      this._attempt = null;
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
