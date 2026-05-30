import * as THREE from 'three';
import { spawnEnemy, spawnBoss } from '../entities/EntityRegistry.ts';
import { getBossCatalogEntries, getStageEnemyCatalogEntries, type EnemyViewerPresentation } from '../entities/EntityCatalog.ts';
import type { UI } from '../ui/UI.ts';
import { type IAudio, type IBullet, type GetPositionFn, type EntityMetadata, type IScene } from '../types.ts';

type SceneRef = IScene;

interface ViewerBullet {
  update(dt: number): void;
  destroy(): void;
  _mesh: THREE.Object3D;
}

interface ViewerEntity {
  _mesh: THREE.Object3D | null;
  update?: (dt: number) => IBullet[];
  _tick?: (dt: number) => IBullet[];
  _getPlayerPos?: GetPositionFn | null;
  _viewerX?: number;
  _viewerY?: number;
  _viewerCurrentX?: number;
  _viewerCurrentY?: number;
  _isViewer?: boolean;
  _entered?: boolean;
  isBoss?: boolean;
  isMesh?: boolean;
  metadata?: EntityMetadata;
  destroy?: () => void;
  viewerXOffset?: number;
  _viewerBullet?: ViewerBullet | null;
  [key: string]: unknown;
}

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
  private _page: number;
  private _entities: ViewerEntity[];
  private _clonedMaterials: THREE.Material[];

  constructor(scene: SceneRef, sprites: Record<string, THREE.Texture>, ui: UI, audio: IAudio) {
    this._scene   = scene;
    this._sprites = sprites;
    this._ui      = ui;
    this._audio   = audio;

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

    for (const ent of this._entities) {
      if (!ent || !ent._mesh) continue;

      const hasUpdate = typeof ent.update === 'function';
      const hasTick = typeof ent._tick === 'function';
      if (!hasUpdate && !hasTick) continue;

      // Keep track of the original viewer position to lock it in its card slot
      if (ent._viewerX === undefined) {
        ent._viewerX = ent._mesh.position.x;
        ent._viewerY = ent._mesh.position.y;
        ent._isViewer = true;
      }

      // Mock player position at (0, 0) for target-locking logic in the viewer
      if (typeof ent._getPlayerPos !== 'function' || ent._getPlayerPos === null) {
        ent._getPlayerPos = () => ({ x: 0, y: 0 });
      }

      // Run the animation tick and capture bullets
      let newBullets: IBullet[] = [];
      if (hasUpdate) {
        newBullets = (ent.update as (dt: number) => IBullet[])(dt) || [];
      } else if (hasTick) {
        newBullets = (ent._tick as (dt: number) => IBullet[])(dt) || [];
      }

      // If bullets are spawned, display the first one at the bottom and destroy any others
      if (Array.isArray(newBullets) && newBullets.length > 0) {
        const firstBullet = newBullets[0] as unknown as ViewerBullet | undefined; // viewer-internal duck-type
        if (firstBullet) {
          // Clean up previous bullet for this card to prevent stacking
          ent._viewerBullet?.destroy();
          ent._viewerBullet = firstBullet;
          // DO NOT push firstBullet into this._entities!
          // It will be cleaned up properly in _clear via ent._viewerBullet.destroy()
        }
        // Dispose of excess bullets immediately
        for (let idx = 1; idx < newBullets.length; idx++) {
          (newBullets[idx] as unknown as ViewerBullet | undefined)?.destroy(); // viewer-internal duck-type
        }
      }

      // Force position lock, shifting the enemy model UP a bit to place it at the top of the card if it shoots,
      // or centering it perfectly in the empty card space above the name if it does not shoot.
      const isBoss = ent.isBoss ?? false;
      const viewerY = ent._viewerY ?? 0;
      const viewerX = ent._viewerX ?? 0;
      const targetY = viewerY + (ent._viewerBullet ? (isBoss ? 24 : 22) : (isBoss ? 8 : 6));

      // Symmetrically center the Charger across all rotation angles by applying a dynamic,
      // rotation-aware offset matching the projection of its asymmetrical features (nose and trails) on the screen X-axis!
      const targetX = viewerX + (ent.viewerXOffset ?? 0);

      // Use dedicated, physics-independent virtual coordinates to prevent active charging velocity from pulling the ship off-screen!
      if (ent._viewerCurrentX === undefined) {
        ent._viewerCurrentX = targetX;
        ent._viewerCurrentY = targetY;
      } else {
        ent._viewerCurrentX += (targetX - ent._viewerCurrentX) * 10 * dt;
        ent._viewerCurrentY = (ent._viewerCurrentY ?? targetY) + (targetY - (ent._viewerCurrentY ?? targetY)) * 10 * dt;
      }

      const mesh = ent._mesh;
      if (!mesh) continue;
      mesh.position.x = ent._viewerCurrentX;
      mesh.position.y = ent._viewerCurrentY ?? 0;
      mesh.position.z = 0;

      // Slowly rotate the mesh around the Y-axis to show off its full 3D shape
      mesh.rotation.y += dt * 0.45;

      // Handle the card's shot/bullet preview if it exists
      if (ent._viewerBullet) {
        // Run the bullet's internal animation tick
        ent._viewerBullet.update(dt);

        // Move bullet exactly between the enemy model and the bottom text (shifted up a tiny bit)
        const bulletY = viewerY - (isBoss ? 42 : 37);
        ent._viewerBullet._mesh.position.set(viewerX, bulletY, 0);

        // Scale the bullet 40% larger for high-visibility preview
        ent._viewerBullet._mesh.scale.set(1.4, 1.4, 1.4);

        // Slowly rotate the bullet mesh Y-axis as well for dynamic depth
        ent._viewerBullet._mesh.rotation.y += dt * 0.45;
      }
    }
  }

  // ── Page navigation ──────────────────────────────────────────────────────

  changePage(dir: number): void {
    this._audio.play('menuSelect');
    this._page = this._page === 1 ? 2 : 1;
    this._renderPage();
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private _renderPage(): void {
    this._clear();
    const getPos = () => ({ x: 0, y: 0 });

    if (this._page === 1) {
      this._renderEnemyPage(getPos);
    } else {
      this._renderBossPage(getPos);
    }
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
      });
      const enemy = spawnedEnemy as unknown as ViewerEntity | null; // viewer-internal duck-type

      if (enemy && enemy._mesh) {
        this._applyEnemyViewerPresentation(enemy._mesh, entry.viewer, x, y);

        enemy._isViewer = true;
        enemy._entered = true;
        this._entities.push(enemy);

        // Setup holographic clipping planes to restrict enemy meshes to their card boundaries (with premium inside padding)
        const halfW = 67; // 73 - 6 units padding
        const halfH = 72; // 80 - 8 units padding to clear margins and text cleanly
        const cardCenterX = x;
        const cardCenterY = y - 20;

        this._applyClippingPlanes(enemy._mesh, cardCenterX, cardCenterY, halfW, halfH);

        const meta = enemy.metadata;
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
      });
      const boss = spawnedBoss as unknown as ViewerEntity | null; // viewer-internal duck-type

      if (boss && boss._mesh) {
        boss._mesh.position.set(x, y, 0);
        boss._mesh.scale.set(scale, scale, scale);

        boss._mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(boss._mesh);
        const center = new THREE.Vector3();
        box.getCenter(center);
        boss._mesh.position.x -= (center.x - x);
        boss._mesh.position.y -= (center.y - y);

        boss._isViewer = true;
        boss._entered = true;
        this._entities.push(boss);

        // Setup holographic clipping planes to restrict boss meshes to their card boundaries (with premium inside padding)
        const halfW = 125; // 135 - 10 units padding
        const halfH = 77.5; // 87.5 - 10 units padding
        const cardCenterX = x;
        const cardCenterY = y - 25;

        this._applyClippingPlanes(boss._mesh, cardCenterX, cardCenterY, halfW, halfH);

        const meta = boss.metadata;
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
      for (const ent of this._entities) {
        if (ent && ent._viewerBullet) {
          ent._viewerBullet.destroy();
          ent._viewerBullet = null;
        }

        if (typeof ent.destroy === 'function') {
          ent.destroy();
        } else if (ent.isMesh && ent._mesh instanceof THREE.Mesh) {
          this._scene.remove(ent._mesh);
          ent._mesh.geometry?.dispose();
          if (Array.isArray(ent._mesh.material)) {
            for (const mat of ent._mesh.material) mat.dispose();
          } else {
            (ent._mesh.material as THREE.Material | undefined)?.dispose();
          }
        }
      }
    }
    this._entities = [];
  }
}
