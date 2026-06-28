import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Scene } from './Scene.ts';
import { GameState, RenderCategory, UserDataKey } from './types.ts';

describe('Scene add/remove routing', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('removes viewer-mode instanced enemies from the underlying Three scene', () => {
    const sceneAdd = vi.fn();
    const sceneRemove = vi.fn();
    const scene = Object.create(Scene.prototype) as Scene & {
      scene: { add: (object: THREE.Object3D) => void; remove: (object: THREE.Object3D) => void };
      _activeBullets: Set<THREE.Object3D>;
      _activeInstancedEnemies: Set<THREE.Object3D>;
    };

    scene.scene = { add: sceneAdd, remove: sceneRemove };
    scene._activeBullets = new Set();
    scene._activeInstancedEnemies = new Set();

    (globalThis as { window?: { game?: { _state: GameState } } }).window = {
      game: { _state: GameState.VIEWER },
    };

    const swarmDisplay = new THREE.Group();
    swarmDisplay.userData.isInstanced = true;
    scene.add(swarmDisplay);

    expect(sceneAdd).toHaveBeenCalledWith(swarmDisplay);
    expect(scene._activeInstancedEnemies.has(swarmDisplay)).toBe(false);

    swarmDisplay.parent = scene.scene as unknown as THREE.Object3D;
    scene.remove(swarmDisplay);

    expect(sceneRemove).toHaveBeenCalledWith(swarmDisplay);
  });

  it('keeps gameplay-mode instanced enemies on the instancer path', () => {
    const sceneAdd = vi.fn();
    const sceneRemove = vi.fn();
    const scene = Object.create(Scene.prototype) as Scene & {
      scene: { add: (object: THREE.Object3D) => void; remove: (object: THREE.Object3D) => void };
      _activeBullets: Set<THREE.Object3D>;
      _activeInstancedEnemies: Set<THREE.Object3D>;
    };

    scene.scene = { add: sceneAdd, remove: sceneRemove };
    scene._activeBullets = new Set();
    scene._activeInstancedEnemies = new Set();

    (globalThis as { window?: { game?: { _state: GameState } } }).window = {
      game: { _state: GameState.PLAYING },
    };

    const swarmDisplay = new THREE.Group();
    swarmDisplay.userData.isInstanced = true;
    scene.add(swarmDisplay);

    expect(sceneAdd).not.toHaveBeenCalled();
    expect(scene._activeInstancedEnemies.has(swarmDisplay)).toBe(true);

    scene.remove(swarmDisplay);

    expect(scene._activeInstancedEnemies.has(swarmDisplay)).toBe(false);
    expect(sceneRemove).not.toHaveBeenCalled();
  });

  it('continues routing bullets through the projectile instancer path', () => {
    const sceneAdd = vi.fn();
    const sceneRemove = vi.fn();
    const scene = Object.create(Scene.prototype) as Scene & {
      scene: { add: (object: THREE.Object3D) => void; remove: (object: THREE.Object3D) => void };
      _activeBullets: Set<THREE.Object3D>;
      _activeInstancedEnemies: Set<THREE.Object3D>;
    };

    scene.scene = { add: sceneAdd, remove: sceneRemove };
    scene._activeBullets = new Set();
    scene._activeInstancedEnemies = new Set();

    const bullet = new THREE.Group();
    bullet.userData[UserDataKey.RENDER_CATEGORY] = RenderCategory.BULLET;
    scene.add(bullet);

    expect(scene._activeBullets.has(bullet)).toBe(true);
    expect(sceneAdd).not.toHaveBeenCalled();

    scene.remove(bullet);

    expect(scene._activeBullets.has(bullet)).toBe(false);
    expect(sceneRemove).not.toHaveBeenCalled();
  });
});
