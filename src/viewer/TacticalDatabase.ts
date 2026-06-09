import * as THREE from 'three';
import { spawnEnemy, spawnBoss } from '../entities/EntityRegistry.ts';
import { Bullet } from '../entities/Bullet.ts';
import { getBossCatalogEntries, getStageEnemyCatalogEntries, type EnemyViewerPresentation } from '../entities/EntityCatalog.ts';
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
  private _clonedMaterials: THREE.Material[];

  constructor(scene: SceneRef, sprites: Record<string, THREE.Texture>, ui: UI, audio: IAudio, getPlayerModel: PlayerModelProvider) {
    this._scene   = scene;
    this._sprites = sprites;
    this._ui      = ui;
    this._audio   = audio;
    this._getPlayerModel = getPlayerModel;

    this._page              = 1;
    this._entities          = [];
    this._clonedMaterials   = [];
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  enter() {
    this._page = 1;
    this._entities = [];
    this._clonedMaterials = [];
    this._renderPage();
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
    this._renderPage();
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
    this._clear();
    const getPos = () => ({ x: 0, y: 0 });

    if (this._page === 1) {
      this._renderPlayerPage();
    } else if (this._page === 2) {
      this._renderEnemyPage(getPos);
    } else {
      this._renderBossPage(getPos);
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

  private _renderEnemyPage(getPos: GetPositionFn): void {
    const enemyEntries = getStageEnemyCatalogEntries();
    const entitiesData = [];

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
        // No-op: entity fires into the void; bullet previews are catalog-driven (ADR 0017)
        projectileFactory: () => null as never,
      });
      if (spawnedEnemy && spawnedEnemy._mesh) {
        this._applyEnemyViewerPresentation(spawnedEnemy._mesh, entry.viewer, x, y);

        const card = new TacticalDossierCard(spawnedEnemy, this._scene, {
          projectileKeys: entry.viewerProjectileKeys,
          bulletFactory: this._makeBulletFactory(x, y),
        });
        this._entities.push(card);

        // Setup holographic clipping planes to restrict enemy meshes to their card boundaries (with premium inside padding)
        const halfW = 67; // 73 - 6 units padding
        const halfH = 72; // 80 - 8 units padding to clear margins and text cleanly
        const cardCenterX = x;
        const cardCenterY = y - 20;

        this._applyClippingPlanes(spawnedEnemy._mesh, cardCenterX, cardCenterY, halfW, halfH);

        const meta = spawnedEnemy.metadata;
        entitiesData.push({
          name: meta?.displayName,
          hp: meta?.hp ?? 0,
          score: meta?.score ?? 0,
          x,
          y,
        });
      }
    }

    this._ui.showViewer(this._page, entitiesData);
  }

  private _renderBossPage(getPos: GetPositionFn): void {
    const bossesData = [];
    const bossEntries = getBossCatalogEntries();

    for (let i = 0; i < bossEntries.length; i++) {
      const entry = bossEntries[i]!;
      const { level } = entry;
      const { scale } = entry.viewer;
      const col = i % 2;
      const row = Math.floor(i / 2);

      const x = (col - 0.5) * 320;
      const y = (0.5 - row) * 190;

      const spawnedBoss = spawnBoss(level, {
        scene: this._scene,
        sprites: this._sprites,
        getPos,
        onDeath: () => { },
        audio: { play: () => { } },
        spawnEnemyCallback: () => { },
        // No-op: entity fires into the void; bullet previews are catalog-driven (ADR 0017)
        projectileFactory: () => null as never,
      });
      if (spawnedBoss && spawnedBoss._mesh) {
        spawnedBoss._mesh.position.set(x, y, 0);
        spawnedBoss._mesh.scale.set(scale, scale, scale);

        spawnedBoss._mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(spawnedBoss._mesh);
        const center = new THREE.Vector3();
        box.getCenter(center);
        spawnedBoss._mesh.position.x -= (center.x - x);
        spawnedBoss._mesh.position.y -= (center.y - y);

        const card = new TacticalDossierCard(spawnedBoss, this._scene, {
          projectileKeys: entry.viewerProjectileKeys,
          bulletFactory: this._makeBulletFactory(x, y),
        });
        this._entities.push(card);

        // Setup holographic clipping planes to restrict boss meshes to their card boundaries (with premium inside padding)
        const halfW = 125; // 135 - 10 units padding
        const halfH = 77.5; // 87.5 - 10 units padding
        const cardCenterX = x;
        const cardCenterY = y - 25;

        this._applyClippingPlanes(spawnedBoss._mesh, cardCenterX, cardCenterY, halfW, halfH);

        const meta = spawnedBoss.metadata;
        bossesData.push({
          name: meta?.displayName,
          hp: meta?.hp ?? 0,
          score: meta?.score ?? 0,
          x,
          y,
        });
      }
    }

    this._ui.showViewer(this._page, bossesData);
  }

  // ── Shared helpers ───────────────────────────────────────────────────────

  private _applyEnemyViewerPresentation(
    mesh: THREE.Object3D,
    presentation: EnemyViewerPresentation,
    x: number,
    y: number,
  ): void {
    mesh.scale.set(presentation.scale, presentation.scale, presentation.scale);

    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);

    if (presentation.centering === 'origin') {
      mesh.position.x = x;
      mesh.position.y = y;
      return;
    }

    mesh.position.x -= center.x - x;
    mesh.position.y -= center.y - y;
  }

  private _applyClippingPlanes(mesh: THREE.Object3D, cx: number, cy: number, halfW: number, halfH: number): void {
    const planes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -(cx - halfW)),   // Left
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), cx + halfW),     // Right
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -(cy - halfH)),   // Bottom
      new THREE.Plane(new THREE.Vector3(0, -1, 0), cy + halfH),     // Top
    ];

    mesh.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!child.material) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat: THREE.Material) => {
          const m = mat.clone();
          m.onBeforeCompile = mat.onBeforeCompile;
          m.customProgramCacheKey = mat.customProgramCacheKey;
          m.clippingPlanes = planes;
          m.clipShadows = true;
          this._clonedMaterials.push(m);
          return m;
        });
      } else {
        const mat = child.material as THREE.Material;
        const m = mat.clone();
        m.onBeforeCompile = mat.onBeforeCompile;
        m.customProgramCacheKey = mat.customProgramCacheKey;
        m.clippingPlanes = planes;
        m.clipShadows = true;
        child.material = m;
        this._clonedMaterials.push(m);
      }
    });
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
  }
}
