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
  ENABLE_PLAYTEST_STATE_PROBE,
  ENABLE_RENDER_STATS,
  getClampedRuntimeFlagInteger,
  getRuntimeFlagValue,
  isBrowserTestAudioSuppressedByDefault,
  isRuntimeFlagEnabled,
} from './constants.ts';
import { GameState, DifficultyMode, MusicCue, WeaponTier } from './types.ts';
import {
  getFirstImplementedLevel,
  getImplementedLevelById,
  getMusicCueForChapterKey,
  getNextTitleLevel,
  getPreviousImplementedLevel,
  toLevelLabel,
  type CampaignLevelRecord,
} from './campaign/Campaign.ts';
import { CampaignAttempt } from './campaign/CampaignAttempt.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import playerGlbUrl from './models/player.glb';
import { EnemyDiver } from './entities/EnemyDiver.ts';
import { EnemyStraight } from './entities/EnemyStraight.ts';
import { EnemySine } from './entities/EnemySine.ts';
import { EnemySwarm } from './entities/EnemySwarm.ts';
import { Boss3 } from './entities/Boss3.ts';
import { Boss4 } from './entities/Boss4.ts';
import { Stalactite } from './entities/Stalactite.ts';
import { EnemyTurret } from './entities/EnemyTurret.ts';
import { RockDrake } from './entities/RockDrake.ts';
import { EnemySpore } from './entities/EnemySpore.ts';
import { Obstacle } from './entities/Obstacle.ts';
import {
  beginPerfFrame,
  endPerfFrame,
  initPerfProbe,
  measurePerfPhase,
  setPerfCount,
  setPerfLabel,
} from './systems/PerfProbe.ts';
import { withStandardEnemyRenderWarmup } from './systems/RenderWarmup.ts';
import {
  initPlaytestStateProbe,
  writePlaytestStateProbe,
  type PlaytestStateSnapshot,
} from './systems/PlaytestStateProbe.ts';
import type { EnemyBatchAttribution, EnemyInstancerSnapshot } from './systems/EnemyInstancer.ts';




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
  private _lastPanelUpdateTime: number;
  private _panelHtml: string;
  private _lastPlaytestProbeUpdateTime: number;
  // Cached once/sec to avoid per-frame scene traversal
  private _cachedRenderCalls: number;
  private _cachedObjectStats: { total: number; byCategory: Record<string, number> } | null;
  private _cachedBulletStats: { total: number; renderUnits: number } | null;
  private _consoleErrors: string[];

  // PERF-1: peak-frame enemy batch composition (renderStats=1 only)
  private _peakCompositionSamples: Array<{ calls: number; snapshot: EnemyInstancerSnapshot }> = [];
  private readonly _PEAK_COMPOSITION_MAX = 20;
  private _cachedPeakComposition: EnemyBatchAttribution[] | null = null;
  private _peakCompositionDirty = false;

  currentLevel: CampaignLevelRecord;
  private _startWeaponTier: number;
  private _nextLevelState: GameState | null;
  private _nextLevel: CampaignLevelRecord | null;
  private _attempt: CampaignAttempt | null;
  private _levelStartTimer: number;
  private _waitingForRestart: boolean;
  private _waitingForReturn: boolean;
  private _titlePreviewCue: MusicCue | null;
  private _pendingDirectLaunch: { level: CampaignLevelRecord; weaponTier: number } | null;

  private _run: GameplayRun | null;
  private _viewer: TacticalDatabase;

  constructor(canvas: HTMLCanvasElement, uiOverlay: HTMLElement) {
    this.scene = new Scene(canvas);
    this.input = new InputManager();
    this.audio = new AudioManager({
      startTestAudioSuppressed: isBrowserTestAudioSuppressedByDefault(),
    });
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
    this._lastPanelUpdateTime = 0;
    this._panelHtml = '';
    this._lastPlaytestProbeUpdateTime = 0;
    this._cachedRenderCalls = 0;
    this._cachedObjectStats = null;
    this._cachedBulletStats = null;
    this._consoleErrors = [];
    initPerfProbe();
    initPlaytestStateProbe();
    this._attachTestProbe();

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
    this._startWeaponTier = 1; // weapon tier chosen on title screen
    this._nextLevelState = null;
    this._nextLevel = null;
    this._attempt = null;
    this._levelStartTimer = 0;
    this._waitingForRestart = false;
    this._waitingForReturn = false;
    this._titlePreviewCue = null;
    this._pendingDirectLaunch = this._resolveDirectLaunch();

    this._run = null;
    this._viewer = new TacticalDatabase(this.scene, this.sprites, this.ui, this.audio, () => this.playerModel);
  }

  // ── BOOT ───────────────────────────────────────────────────────────────────

  start() {
    this._running = true;
    this._preloadAssets()
      .then(() => this._warmupGameplayRender())
      .catch((error) => {
        console.error('Failed during startup warmup sequence:', error);
      })
      .finally(() => {
        const directLaunch = this._consumeDirectLaunch();
        if (directLaunch) {
          this.currentLevel = directLaunch.level;
          this._startWeaponTier = directLaunch.weaponTier;
          this._attempt = new CampaignAttempt(directLaunch.level, directLaunch.weaponTier);
          this._setState(GameState.LEVEL_START);
        } else {
          this._setState(GameState.TITLE);
        }
        requestAnimationFrame((t) => this._loop(t));
      });
  }

  private _resolveDirectLaunch(): { level: CampaignLevelRecord; weaponTier: number } | null {
    if (!this._showAdvancedTitleOptions && !ENABLE_PLAYTEST_STATE_PROBE) return null;

    const requestedLevelId = getRuntimeFlagValue('level');
    if (!requestedLevelId) return null;

    const level = getImplementedLevelById(requestedLevelId);
    if (!level) return null;

    return {
      level,
      weaponTier: getClampedRuntimeFlagInteger('weaponTier', 1, 5) ?? 1,
    };
  }

  private _consumeDirectLaunch(): { level: CampaignLevelRecord; weaponTier: number } | null {
    const launch = this._pendingDirectLaunch;
    this._pendingDirectLaunch = null;
    return launch;
  }

  private async _warmupGameplayRender(): Promise<void> {
    const startedAt = performance.now();
    const warmup = await withStandardEnemyRenderWarmup(
      this.scene,
      this.sprites,
      this.playerModel,
      () => this.scene.warmupRenderPaths(),
    );

    if (this._showRenderStats || isRuntimeFlagEnabled('perfProbe', false)) {
      const totalDurationMs = performance.now() - startedAt;
      console.log('Render warmup complete', {
        durationMs: Number(totalDurationMs.toFixed(1)),
        spawnDurationMs: Number(warmup.durationMs.toFixed(1)),
        spawnedCount: warmup.spawnedCount,
        warmedEnemyTypes: warmup.warmedEnemyTypes,
      });
    }
  }

  private async _preloadAssets(): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const playerModelPromise = new Promise<void>((resolve) => {
      loader.load(
        playerGlbUrl,
        (gltf) => {
          this.playerModel = gltf.scene;
          console.log('Player GLB model preloaded successfully');
          resolve();
        },
        undefined,
        (error) => {
          console.error('Failed to preload player GLB model:', error);
          resolve();
        }
      );
    });

    const diverModelPromise = EnemyDiver.preloadModel()
      .then(() => undefined)
      .catch((error) => {
        console.error('Failed to preload diver GLB model:', error);
      });

    const straightModelPromise = EnemyStraight.preloadModel()
      .then(() => undefined)
      .catch((error) => {
        console.error('Failed to preload straight GLB model:', error);
      });

    const sineModelPromise = EnemySine.preloadModel()
      .then(() => undefined)
      .catch((error) => {
        console.error('Failed to preload sine GLB model:', error);
      });

    const swarmModelPromise = EnemySwarm.preloadModel()
      .then(() => undefined)
      .catch((error) => {
        console.error('Failed to preload swarm GLB model:', error);
      });

    const heartseerModelPromise = Boss3.preloadModel()
      .then(() => undefined)
      .catch((error) => {
        console.error('Failed to preload Heartseer GLB model:', error);
      });

    // Initialize static caches for optimized procedural enemies
    try {
      Stalactite.initSharedResources();
      EnemyTurret.initSharedResources();
      RockDrake.initSharedResources();
      EnemySpore.initSharedResources();
      Obstacle.initSharedResources();
      Boss4.initSharedResources();
    } catch (error) {
      console.error('Failed to initialize procedural shared resources:', error);
    }

    await Promise.all([
      playerModelPromise,
      diverModelPromise,
      straightModelPromise,
      sineModelPromise,
      swarmModelPromise,
      heartseerModelPromise,
    ]);
  }


  // ── LOOP ───────────────────────────────────────────────────────────────────

  _loop(timestamp: number): void {
    if (!this._running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;
    beginPerfFrame(timestamp, dt);

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

    // Panel mode: update DOM at a fixed cadence. Heap is still sampled every
    // frame above, but rebuilding/inserting HTML every RAF creates avoidable
    // allocation and style work while profiling.
    if (this._panelMode && this._fpsElement && timestamp - this._lastPanelUpdateTime >= 250) {
      measurePerfPhase('game.panel', () => {
        this._panelHtml = this._buildPanelHtml();
        this._fpsElement!.innerHTML = this._panelHtml;
      });
      this._lastPanelUpdateTime = timestamp;
    }

    measurePerfPhase('game.update', () => this._update(dt));
    measurePerfPhase('game.input', () => this.input.update());
    measurePerfPhase('game.render', () => this.scene.render(dt));

    if (this._showRenderStats && this._state === GameState.PLAYING) {
      const calls = this.scene.getRenderInfo().calls;
      const snapshot = this.scene.getEnemyAttributionSnapshot();
      this._insertPeakCompositionSample(calls, snapshot);
      if (this._peakCompositionDirty) {
        this._cachedPeakComposition = this._computeMedianPeakComposition();
        this._peakCompositionDirty = false;
      }
    }

    setPerfCount('state.playing', this._state === GameState.PLAYING ? 1 : 0);
    setPerfLabel('game.state', this._state ?? 'UNKNOWN');
    if (timestamp - this._lastPlaytestProbeUpdateTime >= 250) {
      writePlaytestStateProbe(this._buildPlaytestStateSnapshot());
      this._lastPlaytestProbeUpdateTime = timestamp;
    }
    endPerfFrame();

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

  getPeakEnemyComposition(): EnemyBatchAttribution[] | null {
    return this._cachedPeakComposition;
  }

  private _insertPeakCompositionSample(calls: number, snapshot: EnemyInstancerSnapshot): void {
    const samples = this._peakCompositionSamples;
    if (samples.length < this._PEAK_COMPOSITION_MAX) {
      samples.push({ calls, snapshot });
      samples.sort((a, b) => b.calls - a.calls);
      this._peakCompositionDirty = true;
      return;
    }

    const lastIndex = samples.length - 1;
    if (calls > samples[lastIndex]!.calls) {
      samples[lastIndex] = { calls, snapshot };
      samples.sort((a, b) => b.calls - a.calls);
      this._peakCompositionDirty = true;
    }
  }

  private _computeMedianPeakComposition(): EnemyBatchAttribution[] {
    const samples = this._peakCompositionSamples;
    if (samples.length === 0) return [];

    const valuesByKey = new Map<string, { enemyType: string; bucket: string; batchCounts: number[]; instanceCounts: number[]; triangleCounts: number[] }>();

    for (const sample of samples) {
      for (const attribution of sample.snapshot.byTypeBucket) {
        const mapKey = `${attribution.enemyType}|${attribution.bucket}`;
        let entry = valuesByKey.get(mapKey);
        if (!entry) {
          entry = {
            enemyType: attribution.enemyType,
            bucket: attribution.bucket,
            batchCounts: [],
            instanceCounts: [],
            triangleCounts: [],
          };
          valuesByKey.set(mapKey, entry);
        }
        entry.batchCounts.push(attribution.batchCount);
        entry.instanceCounts.push(attribution.instanceCount);
        entry.triangleCounts.push(attribution.triangleCount);
      }
    }

    const result: EnemyBatchAttribution[] = [];
    for (const entry of valuesByKey.values()) {
      result.push({
        enemyType: entry.enemyType,
        bucket: entry.bucket,
        batchCount: Math.round(median(entry.batchCounts)),
        instanceCount: Math.round(median(entry.instanceCounts)),
        triangleCount: Math.round(median(entry.triangleCounts)),
      });
    }

    return result.sort((a, b) => b.triangleCount - a.triangleCount);
  }

  private _buildPlaytestStateSnapshot(): PlaytestStateSnapshot {
    const hud = this._run?.getHUDSnapshot();
    return {
      state: this._state,
      level: {
        id: this.currentLevel.id,
        chapterName: this.currentLevel.chapterName,
        chapterNumber: this.currentLevel.chapterNumber,
        levelNumber: this.currentLevel.levelNumber,
        isFinale: this.currentLevel.isFinale,
      },
      fps: this._currentFps,
      weaponTier: hud?.weaponTier ?? this._attempt?.weaponTier ?? WeaponTier.RAPID,
      score: hud?.score ?? this.score.score,
      lives: hud?.lives ?? this.score.lives,
      bombs: hud?.bombs ?? 0,
      shieldPips: hud?.shieldPips ?? 0,
      shieldMax: hud?.shieldMax ?? 0,
      audio: {
        isBrowserTestAudioRun: this.audio.isBrowserTestAudioRun,
        isTestAudioSuppressed: this.audio.isTestAudioSuppressed,
      },
      run: this._run?.getPlaytestSnapshot() ?? null,
      peakEnemyComposition: this._cachedPeakComposition,
    };
  }

  private _attachTestProbe(): void {
    if (!ENABLE_PLAYTEST_STATE_PROBE || typeof window === 'undefined') return;

    const maxErrors = 200;
    const pushError = (message: string) => {
      this._consoleErrors.push(message);
      if (this._consoleErrors.length > maxErrors) {
        this._consoleErrors.shift();
      }
    };

    window.addEventListener('error', (event: ErrorEvent) => {
      const message = event.error instanceof Error
        ? `${event.message}\n${event.error.stack ?? ''}`
        : event.message;
      pushError(message);
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error
        ? `Unhandled promise rejection: ${reason.message}\n${reason.stack ?? ''}`
        : `Unhandled promise rejection: ${String(reason)}`;
      pushError(message);
    });

    const game = this;
    window.__aeonTestProbe = {
      get ready() {
        return typeof window !== 'undefined' && (window as { game?: Game }).game === game && game._state !== null;
      },
      get state() {
        return game._state;
      },
      get currentLevel() {
        return game.currentLevel?.id ?? null;
      },
      get fpsText() {
        return document.getElementById('fps-counter')?.innerText ?? '';
      },
      get webglReady() {
        return game.scene?.renderer != null;
      },
      get testAudioSuppressed() {
        return isBrowserTestAudioSuppressedByDefault();
      },
      get consoleErrors() {
        return game._consoleErrors.slice();
      },
    };
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
      if (this.audio.isBrowserTestAudioRun) {
        this.audio.toggleTestAudioForRun();
      } else {
        this.audio.toggleMusic();
      }
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
    if (this.input.wasJustPressed(Action.VIEWER)) {
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

    if (this._run?.hasPendingLevelComplete) {
      this.onLevelComplete();
      return;
    }

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
          this._attempt.advance();
          this.currentLevel = this._attempt.level;
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

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}
