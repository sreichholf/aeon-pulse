import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { InstancedScrollLayer } from './InstancedScrollLayer.ts';
import { RenderCategory } from '../systems/RenderStats.ts';

describe('InstancedScrollLayer', () => {
  it('creates and registers an instanced mesh with render metadata', () => {
    const scene = new THREE.Scene();
    const addSpy = vi.spyOn(scene, 'add');
    const layer = new InstancedScrollLayer(scene as unknown as never);

    const handle = layer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail: 'background.test',
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: new THREE.MeshBasicMaterial(),
      capacity: 4,
    });

    expect(addSpy).toHaveBeenCalledWith(handle.mesh);
    expect(handle.mesh.frustumCulled).toBe(false);
    expect(handle.mesh.userData['renderCategory']).toBe(RenderCategory.BACKGROUND);
    expect(handle.mesh.userData['renderDetail']).toBe('background.test');
  });

  it('uses zero rotation and unit scale defaults', () => {
    const scene = new THREE.Scene();
    const layer = new InstancedScrollLayer(scene as unknown as never);
    const handle = layer.createLayer({
      renderCategory: RenderCategory.TERRAIN,
      detail: 'terrain.test',
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: new THREE.MeshBasicMaterial(),
      capacity: 2,
    });

    handle.beginFrame();
    handle.push({ position: [4, 5, 6] });
    handle.endFrame();

    const matrix = new THREE.Matrix4();
    handle.mesh.getMatrixAt(0, matrix);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(pos, quat, scale);

    expect(pos.toArray()).toEqual([4, 5, 6]);
    expect(scale.toArray()).toEqual([1, 1, 1]);
    expect(quat.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
  });

  it('flushes count and matrix dirtiness on endFrame', () => {
    const scene = new THREE.Scene();
    const layer = new InstancedScrollLayer(scene as unknown as never);
    const handle = layer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail: 'background.flush',
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: new THREE.MeshBasicMaterial(),
      capacity: 3,
    });

    handle.beginFrame();
    handle.push({ position: [1, 2, 3] });
    handle.push({ position: [7, 8, 9], scale: [2, 3, 4] });
    const initialVersion = handle.mesh.instanceMatrix.version;
    handle.endFrame();

    expect(handle.mesh.count).toBe(2);
    expect(handle.mesh.instanceMatrix.version).toBeGreaterThan(initialVersion);

    handle.beginFrame();
    handle.endFrame();
    expect(handle.mesh.count).toBe(0);
  });

  it('supports prebuilt meshes and disposes owned resources on destroy', () => {
    const scene = new THREE.Scene();
    const removeSpy = vi.spyOn(scene, 'remove');
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, 2);
    const owned = { dispose: vi.fn() };
    const layer = new InstancedScrollLayer(scene as unknown as never);

    const handle = layer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail: 'background.custom',
      mesh,
      ownedResources: [owned],
    });

    expect(handle.mesh).toBe(mesh);

    layer.destroy();

    expect(removeSpy).toHaveBeenCalledWith(mesh);
    expect(owned.dispose).toHaveBeenCalledTimes(1);
  });

  it('marks instance colors dirty when colors are written', () => {
    const scene = new THREE.Scene();
    const layer = new InstancedScrollLayer(scene as unknown as never);
    const handle = layer.createLayer({
      renderCategory: RenderCategory.BACKGROUND,
      detail: 'background.color',
      geometry: new THREE.BoxGeometry(1, 1, 1),
      material: new THREE.MeshBasicMaterial({ vertexColors: true }),
      capacity: 1,
    });

    handle.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
    handle.beginFrame();
    handle.push({ position: [0, 0, 0] });
    handle.setColorAt(0, new THREE.Color(0xff5500));
    const initialVersion = handle.mesh.instanceColor.version;
    handle.endFrame();

    expect(handle.mesh.instanceColor.version).toBeGreaterThan(initialVersion);
  });
});
