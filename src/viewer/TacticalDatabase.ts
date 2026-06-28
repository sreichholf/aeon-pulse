import * as THREE from 'three';
import { spawnEnemy, spawnBoss } from '../entities/EntityRegistry.ts';
import { Bullet } from '../entities/Bullet.ts';
import { getBossCatalogEntries, getStageEnemyCatalogEntries, type ViewerPresentation } from '../entities/EntityCatalog.ts';
import type { UI } from '../ui/UI.ts';
import { type IAudio, type IBullet, type GetPositionFn, type EntityMetadata, type IScene } from '../types.ts';
import { TacticalDossierCard, type ViewerBulletFactory } from './TacticalDossierCard.ts';

type SceneRef = IScene;
type PlayerModelProvider = () => THREE.Group | null;


/**
 * TacticalDatabase — manages the interactive 3D entity viewer.
 *
 * Owns all viewer state: page tracking, entity spawning/positioning,
 * clipping planes, per-frame animation, bullet previews, and cleanup.
 */
export class TacticalDatabase {
  private _scene: SceneRef;
  private _sprites: Record<string, THREE.Texture>;
  private _ui: UI;
  private _audio: IAudio;
  private _getPlayerModel: PlayerModelProvider;
  private _page: number;
  private _entities: TacticalDossierCard[];
  /** Entities constructed but not yet promoted to a card (model still attaching). Tracked for cleanup. */
  private _pendingEntities: Array<{ destroy?: () => void }>;
  private _clonedMaterials: THREE.Material[];
  private _renderGeneration: number;

  constructor(scene: SceneRef, sprites: Record<string, THREE.Texture>, ui: UI, audio: IAudio, getPlayerModel: PlayerModelProvider) {
    this._scene   = scene;
    this._sprites = sprites;
    this._ui      = ui;
    this._audio   = audio;
    this._getPlayerModel = getPlayerModel;

    this._page              = 1;
    this._entities          = [];
    this._pendingEntities   = [];
    this._clonedMaterials   = [];
    this._renderGeneration  = 0;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  enter() {
    this._page = 1;
    this._entities = [];
    this._pendingEntities = [];
    this._clonedMaterials = [];
    void this._renderPage();
  }

  exit() {
    this._clear();
    this._ui.hideViewer();
  }

  // ── Per-frame update ─────────────────────────────────────────────────────

  update(dt: number): void {
    if (!this._entities) return;

    for (const card of this._entities) {
      if (card) {
        card.update(dt);
      }
    }
  }

  // ── Page navigation ──────────────────────────────────────────────────────

  changePage(dir: number): void {
    this._audio.play('menuSelect');
    const pageCount = 3;
    this._page = ((this._page - 1 + dir + pageCount) % pageCount) + 1;
    void this._renderPage();
  }

  // ── Bullet factory helper (ADR 0017) ─────────────────────────────────────

  /**
   * Returns a ViewerBulletFactory that constructs a static Bullet preview
   * at the card's position, closed over the current scene and sprites.
   * Velocity points left so directional projectiles have the same orientation as hostile shots.
   * The card pins the bullet's position every frame, so preview velocity does not create drift.
   */
  private _makeBulletFactory(x: number, y: number): ViewerBulletFactory {
    return (projectileKey) => new Bullet(
      this._scene,
      this._sprites,
      projectileKey,
      x,
      y,
      -1,
      0,
      null,
      null,
      null,
    );
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private _renderPage(): void {
    const renderGeneration = ++this._renderGeneration;
    this._clear();
    const getPos = () => ({ x: 0, y: 0 });

    if (this._page === 1) {
      this._renderPlayerPage();
    } else if (this._page === 2) {
      this._renderEnemyPage(getPos, renderGeneration);
    } else {
      this._renderBossPage(getPos, renderGeneration);
    }
  }

  private _renderPlayerPage(): void {
    const sourceModel = this._getPlayerModel();
    if (!sourceModel) {
      this._ui.showViewer(this._page, []);
      return;
    }

    const shipModel = sourceModel.clone();
    const display = new THREE.Group();
    display.add(shipModel);

    const box = new THREE.Box3().setFromObject(shipModel);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    shipModel.position.set(-center.x, -center.y, -center.z);
    display.rotation.set(THREE.MathUtils.degToRad(30), -Math.PI / 2 + 0.23, -0.03);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 385 / maxDim : 1;
    display.scale.set(scale, scale, scale);
    display.position.set(0, 54, 8);

    this._scene.add(display);
    this._entities.push(
      new TacticalDossierCard(display, this._scene, {
        viewerIdle: true,
      })
    );

    this._ui.showViewer(this._page, []);
  }

  private _renderEnemyPage(getPos: GetPositionFn, renderGeneration: number): void {
    const enemyEntries = getStageEnemyCatalogEntries();
    const cardData: Array<{ name: string | undefined; hp: number; score: number; x: number; y: number }> = [];

    // Construct every enemy immediately. Metadata (name/HP/score) is synchronous, so all dossier
    // cards render at once; each GLB self-attaches and the card materializes on its own (ADR 0023).
    for (let i = 0; i < enemyEntries.length; i++) {
      const entry = enemyEntries[i]!;
      const col = i % 5;
      const row = Math.floor(i / 5);

      const x = (col - 2) * 165;
      const y = (0.5 - row) * 180 - 10;

      const spawnedEnemy = spawnEnemy(entry.type, {
        scene: this._scene,
        sprites: this._sprites,
        x,
        y,
        getPos,
        audio: { play: () => { } },
        getScrollX: () => 0,
        terrain: null,
        presentationContext: 'viewer',
        // No-op: entity fires into the void; bullet previews are catalog-driven (ADR 0017)
        projectileFactory: () => null as never,
      });
      if (!spawnedEnemy || !spawnedEnemy._mesh) continue;

      this._pendingEntities.push(spawnedEnemy);
      const meta = spawnedEnemy.metadata;
      const cardIndex = cardData.length;
      cardData.push({ name: meta?.displayName, hp: meta?.hp ?? 0, score: meta?.score ?? 0, x, y });

      entry.preloadViewerModel()
        .then(() => {
          if (renderGeneration !== this._renderGeneration || this._page !== 2) return;
          this._activateEnemyCard(spawnedEnemy, entry, x, y, cardIndex);
        })
        .catch((error) => console.error(`Failed to load viewer model for enemy ${entry.type}:`, error));
    }

    this._ui.showViewer(this._page, cardData);
  }

  private _activateEnemyCard(
    spawnedEnemy: ReturnType<typeof spawnEnemy>,
    entry: ReturnType<typeof getStageEnemyCatalogEntries>[number],
    x: number,
    y: number,
    cardIndex: number,
  ): void {
    if (!spawnedEnemy._mesh) return;

    // Centering must run before card construction so the card captures the centered position.
    this._applyViewerPresentation(spawnedEnemy._mesh, entry.viewer, x, y);

    const halfW = 67;
    const halfH = 72;
    const clones = this._applyClippingPlanes(spawnedEnemy._mesh, x, y - 20, halfW, halfH);

    const card = new TacticalDossierCard(spawnedEnemy, this._scene, {
      projectileKeys: entry.viewerProjectileKeys,
      bulletFactory: this._makeBulletFactory(x, y),
      viewerOffsetX: entry.viewer.viewerOffsetX,
    });
    card.beginReveal(clones);
    this._promoteToCard(spawnedEnemy, card);
    this._ui.revealViewerCard(cardIndex);
  }

  /** Move an entity from the pending list to a live card and trigger its reveal. */
  private _promoteToCard(entity: { destroy?: () => void }, card: TacticalDossierCard): void {
    const idx = this._pendingEntities.indexOf(entity);
    if (idx >= 0) this._pendingEntities.splice(idx, 1);
    this._entities.push(card);
  }

  private _renderBossPage(getPos: GetPositionFn, renderGeneration: number): void {
    const bossEntries = getBossCatalogEntries();
    const cardData: Array<{ name: string | undefined; hp: number; score: number; x: number; y: number }> = [];

    for (let i = 0; i < bossEntries.length; i++) {
      const entry = bossEntries[i]!;
      const { bossArchetype } = entry;
      const col = i % 2;
      const row = Math.floor(i / 2);

      const x = (col - 0.5) * 320;
      const y = (0.5 - row) * 190;

      const spawnedBoss = spawnBoss(bossArchetype, {
        scene: this._scene,
        sprites: this._sprites,
        getPos,
        onDeath: () => { },
        audio: { play: () => { } },
        spawnEnemyCallback: () => { },
        presentationContext: 'viewer',
        // No-op: entity fires into the void; bullet previews are catalog-driven (ADR 0017)
        projectileFactory: () => null as never,
      });
      if (!spawnedBoss || !spawnedBoss._mesh) continue;
      spawnedBoss._mesh.position.set(x, y, 0);

      this._pendingEntities.push(spawnedBoss);
      const meta = spawnedBoss.metadata;
      const cardIndex = cardData.length;
      cardData.push({ name: meta?.displayName, hp: meta?.hp ?? 0, score: meta?.score ?? 0, x, y });

      entry.preloadViewerModel()
        .then(() => {
          if (renderGeneration !== this._renderGeneration || this._page !== 3) return;
          this._activateBossCard(spawnedBoss, entry, x, y, cardIndex);
        })
        .catch((error) => console.error(`Failed to load viewer model for boss ${bossArchetype}:`, error));
    }

    this._ui.showViewer(this._page, cardData);
  }

  private _activateBossCard(
    spawnedBoss: ReturnType<typeof spawnBoss>,
    entry: ReturnType<typeof getBossCatalogEntries>[number],
    x: number,
    y: number,
    cardIndex: number,
  ): void {
    if (!spawnedBoss._mesh) return;

    const targetX = x + (entry.viewer.offsetX ?? 0);
    const targetY = y + (entry.viewer.offsetY ?? 0);
    this._applyViewerPresentation(spawnedBoss._mesh, entry.viewer, targetX, targetY);

    // Holographic clipping planes restrict boss meshes to their card boundaries (with inside padding).
    const halfW = 125; // 135 - 10 units padding
    const halfH = 77.5; // 87.5 - 10 units padding
    const clones = this._applyClippingPlanes(spawnedBoss._mesh, x, y - 25, halfW, halfH);

    const card = new TacticalDossierCard(spawnedBoss, this._scene, {
      projectileKeys: entry.viewerProjectileKeys,
      bulletFactory: this._makeBulletFactory(x, y),
      viewerOffsetX: entry.viewer.viewerOffsetX,
    });
    card.beginReveal(clones);
    this._promoteToCard(spawnedBoss, card);
    this._ui.revealViewerCard(cardIndex);
  }

  // ── Shared helpers ───────────────────────────────────────────────────────

  /**
   * Apply the shared `ViewerPresentation` triple (scale + centering) shared by both
   * stage enemies and bosses. Page-specific offsets (e.g. boss `offsetX/offsetY`) must
   * be folded into `x`/`y` at the call site so this helper stays uniform over the
   * common presentation contract.
   */
  private _applyViewerPresentation(
    mesh: THREE.Object3D,
    presentation: ViewerPresentation,
    x: number,
    y: number,
  ): void {
    mesh.scale.set(presentation.scale, presentation.scale, presentation.scale);

    if (presentation.centering === 'origin') {
      mesh.position.x = x;
      mesh.position.y = y;
      return;
    }

    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);

    mesh.position.x -= center.x - x;
    mesh.position.y -= center.y - y;
  }

  /**
   * Clone each material on the subject, pin it to the card's clipping planes, and return the clones.
   * The clones are viewer-owned (disposed on page change), so the card can safely animate their
   * opacity for the Signal Acquisition Reveal (ADR 0023) without touching shared gameplay materials.
   */
  private _applyClippingPlanes(mesh: THREE.Object3D, cx: number, cy: number, halfW: number, halfH: number): THREE.Material[] {
    const planes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -(cx - halfW)),   // Left
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), cx + halfW),     // Right
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -(cy - halfH)),   // Bottom
      new THREE.Plane(new THREE.Vector3(0, -1, 0), cy + halfH),     // Top
    ];

    const clones: THREE.Material[] = [];
    const cloneMaterial = (mat: THREE.Material): THREE.Material => {
      const m = mat.clone();
      m.onBeforeCompile = mat.onBeforeCompile;
      m.customProgramCacheKey = mat.customProgramCacheKey;
      m.clippingPlanes = planes;
      m.clipShadows = true;
      this._clonedMaterials.push(m);
      clones.push(m);
      return m;
    };

    mesh.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!child.material) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map(cloneMaterial);
      } else {
        child.material = cloneMaterial(child.material as THREE.Material);
      }
    });

    return clones;
  }

  private _clear(): void {
    if (this._clonedMaterials) {
      for (const mat of this._clonedMaterials) {
        mat.dispose();
      }
    }
    this._clonedMaterials = [];

    if (this._entities) {
      for (const card of this._entities) {
        card.destroy();
      }
    }
    this._entities = [];

    // Entities whose model never finished attaching (no card built yet) are still in the scene.
    if (this._pendingEntities) {
      for (const entity of this._pendingEntities) {
        entity.destroy?.();
      }
    }
    this._pendingEntities = [];
  }
}
