import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { CancellationPointItem } from './CancellationPointItem.ts';

function createScene() {
  const root = new THREE.Group();
  return {
    scene: {
      camera: new THREE.Camera(),
      add: (object: THREE.Object3D) => root.add(object),
      remove: (object: THREE.Object3D) => root.remove(object),
      flash: vi.fn(),
    },
    root,
  };
}

describe('CancellationPointItem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('eventually collects even from a high-tangential initial burst', () => {
    const { scene } = createScene();
    const onCollect = vi.fn();
    const random = vi.spyOn(Math, 'random');

    // 45-degree burst at speed 170 reproduces the pre-fix orbiting case.
    random.mockReturnValueOnce(0.125);
    random.mockReturnValueOnce(0.8);

    const item = new CancellationPointItem(
      scene as any,
      100,
      0,
      () => ({ x: 0, y: 0 }),
      onCollect,
    );

    for (let i = 0; i < 10 * 60 && !item.isDone; i++) {
      item.update(1 / 60);
    }

    expect(onCollect).toHaveBeenCalledWith(50);
    expect(item.isDone).toBe(true);
  });
});
