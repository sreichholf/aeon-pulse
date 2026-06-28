import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ProjectileInstancer } from './ProjectileInstancer.ts';
import { UserDataKey, RenderCategory } from '../types.ts';

describe('ProjectileInstancer', () => {
  it('compiles and caches userData[COMPILED_MESHES] on first registration', () => {
    const scene = new THREE.Scene();
    const instancer = new ProjectileInstancer(scene);

    const bulletMesh = new THREE.Object3D();
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const childMesh = new THREE.Mesh(geo, mat);
    bulletMesh.add(childMesh);

    // Ensure compile cache is empty initially
    expect(bulletMesh.userData[UserDataKey.COMPILED_MESHES]).toBeUndefined();

    const traverseSpy = vi.spyOn(bulletMesh, 'traverse');

    instancer.beginFrame();
    instancer.addBullet(bulletMesh);

    // Verify compile cache is created
    const compiled = bulletMesh.userData[UserDataKey.COMPILED_MESHES];
    expect(compiled).toBeDefined();
    expect(compiled).toHaveLength(1);
    expect(compiled[0].mesh).toBe(childMesh);
    expect(compiled[0].geo).toBe(geo);
    expect(compiled[0].mat).toBe(mat);
    expect(compiled[0].key).toBe(`${geo.uuid}_${mat.uuid}`);
    expect(traverseSpy).toHaveBeenCalledTimes(1);

    // Verify that on subsequent registration, cached list is reused and traverse is not called again
    instancer.addBullet(bulletMesh);
    expect(traverseSpy).toHaveBeenCalledTimes(1);
  });

  it('creates THREE.InstancedMesh and adds it to the scene for new geometry/material combinations', () => {
    const scene = new THREE.Scene();
    const addSpy = vi.spyOn(scene, 'add');
    const instancer = new ProjectileInstancer(scene);

    const bulletMesh1 = new THREE.Object3D();
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const childMesh1 = new THREE.Mesh(geo, mat);
    bulletMesh1.add(childMesh1);

    instancer.beginFrame();
    instancer.addBullet(bulletMesh1);

    // InstancedMesh should be added to the scene
    expect(addSpy).toHaveBeenCalledTimes(1);
    const instancedMesh1 = addSpy.mock.calls[0][0] as THREE.InstancedMesh;
    expect(instancedMesh1).toBeInstanceOf(THREE.InstancedMesh);
    expect(instancedMesh1.geometry).toBe(geo);
    expect(instancedMesh1.material).toBe(mat);
    expect(instancedMesh1.userData['renderCategory']).toBe(RenderCategory.BULLET);

    // Reusing the same geometry and material should not create a new InstancedMesh
    const bulletMesh2 = new THREE.Object3D();
    const childMesh2 = new THREE.Mesh(geo, mat);
    bulletMesh2.add(childMesh2);

    instancer.addBullet(bulletMesh2);
    expect(addSpy).toHaveBeenCalledTimes(1); // still 1

    // A different material should result in a new InstancedMesh
    const mat2 = new THREE.MeshBasicMaterial();
    const bulletMesh3 = new THREE.Object3D();
    const childMesh3 = new THREE.Mesh(geo, mat2);
    bulletMesh3.add(childMesh3);

    instancer.addBullet(bulletMesh3);
    expect(addSpy).toHaveBeenCalledTimes(2);
    const instancedMesh2 = addSpy.mock.calls[1][0] as THREE.InstancedMesh;
    expect(instancedMesh2).toBeInstanceOf(THREE.InstancedMesh);
    expect(instancedMesh2.material).toBe(mat2);
  });

  it('clears counts on beginFrame(), increments counts on addBullet(), and updates active count on endFrame()', () => {
    const scene = new THREE.Scene();
    const instancer = new ProjectileInstancer(scene);

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();

    const bullet1 = new THREE.Object3D();
    bullet1.add(new THREE.Mesh(geo, mat));

    const bullet2 = new THREE.Object3D();
    bullet2.add(new THREE.Mesh(geo, mat));

    // First Frame
    instancer.beginFrame();
    instancer.addBullet(bullet1);
    instancer.addBullet(bullet2);

    expect(scene.children).toHaveLength(1);
    const instMesh = scene.children[0] as THREE.InstancedMesh;
    expect(instMesh.count).toBe(1024); // default count capacity upon construction

    const initialVersion = instMesh.instanceMatrix.version;
    instancer.endFrame();
    expect(instMesh.count).toBe(2);
    expect(instMesh.instanceMatrix.version).toBeGreaterThan(initialVersion);

    // Second Frame: beginFrame resets count, running endFrame makes active count 0
    instancer.beginFrame();
    instancer.endFrame();
    expect(instMesh.count).toBe(0);
  });

  it('copies bullet child mesh matrixWorld transformations to the InstancedMesh instanceMatrix', () => {
    const scene = new THREE.Scene();
    const instancer = new ProjectileInstancer(scene);

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();

    const bullet = new THREE.Object3D();
    const childMesh = new THREE.Mesh(geo, mat);
    bullet.add(childMesh);

    // Set specific position and trigger update matrix
    bullet.position.set(10, 20, 30);
    childMesh.position.set(1, 2, 3);

    instancer.beginFrame();
    instancer.addBullet(bullet);
    instancer.endFrame();

    const instMesh = scene.children[0] as THREE.InstancedMesh;

    // Retrieve the matrix from InstancedMesh at index 0
    const copiedMatrix = new THREE.Matrix4();
    instMesh.getMatrixAt(0, copiedMatrix);

    // Verify it matches childMesh.matrixWorld
    expect(copiedMatrix.elements).toEqual(childMesh.matrixWorld.elements);
  });

  it('disposes of the InstancedMesh and removes it from the scene when a bullet\'s material is disposed', () => {
    const scene = new THREE.Scene();
    const removeSpy = vi.spyOn(scene, 'remove');
    const instancer = new ProjectileInstancer(scene);

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();

    const bullet = new THREE.Object3D();
    bullet.add(new THREE.Mesh(geo, mat));

    instancer.beginFrame();
    instancer.addBullet(bullet);
    instancer.endFrame();

    expect(scene.children).toHaveLength(1);
    const instMesh = scene.children[0] as THREE.InstancedMesh;
    const disposeSpy = vi.spyOn(instMesh, 'dispose');

    // Dispose the material
    mat.dispose();

    // Verify cleanup happened
    expect(removeSpy).toHaveBeenCalledWith(instMesh);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(scene.children).toHaveLength(0);

    // Adding another bullet with same geo/mat should recreate the InstancedMesh batch
    const bullet2 = new THREE.Object3D();
    bullet2.add(new THREE.Mesh(geo, mat));

    const addSpy = vi.spyOn(scene, 'add');
    instancer.beginFrame();
    instancer.addBullet(bullet2);
    instancer.endFrame();

    expect(addSpy).toHaveBeenCalledTimes(1);
    const newInstMesh = addSpy.mock.calls[0][0] as THREE.InstancedMesh;
    expect(newInstMesh).not.toBe(instMesh);
  });

  it('disposes of all batches on clear()', () => {
    const scene = new THREE.Scene();
    const removeSpy = vi.spyOn(scene, 'remove');
    const instancer = new ProjectileInstancer(scene);

    const geo = new THREE.BufferGeometry();
    const mat1 = new THREE.MeshBasicMaterial();
    const mat2 = new THREE.MeshBasicMaterial();

    const bullet1 = new THREE.Object3D();
    bullet1.add(new THREE.Mesh(geo, mat1));

    const bullet2 = new THREE.Object3D();
    bullet2.add(new THREE.Mesh(geo, mat2));

    instancer.beginFrame();
    instancer.addBullet(bullet1);
    instancer.addBullet(bullet2);
    instancer.endFrame();

    expect(scene.children).toHaveLength(2);
    const instMesh1 = scene.children[0] as THREE.InstancedMesh;
    const instMesh2 = scene.children[1] as THREE.InstancedMesh;

    const disposeSpy1 = vi.spyOn(instMesh1, 'dispose');
    const disposeSpy2 = vi.spyOn(instMesh2, 'dispose');

    instancer.clear();

    expect(removeSpy).toHaveBeenCalledWith(instMesh1);
    expect(removeSpy).toHaveBeenCalledWith(instMesh2);
    expect(disposeSpy1).toHaveBeenCalledTimes(1);
    expect(disposeSpy2).toHaveBeenCalledTimes(1);
    expect(scene.children).toHaveLength(0);
  });

  it('caps the active count at INSTANCE_CAPACITY', () => {
    const scene = new THREE.Scene();
    const instancer = new ProjectileInstancer(scene);

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();

    const bullet = new THREE.Object3D();
    bullet.add(new THREE.Mesh(geo, mat));

    instancer.beginFrame();

    // INSTANCE_CAPACITY is 1024
    const capacity = 1024;
    for (let i = 0; i < capacity + 10; i++) {
      instancer.addBullet(bullet);
    }

    instancer.endFrame();

    const instMesh = scene.children[0] as THREE.InstancedMesh;
    expect(instMesh.count).toBe(capacity);
  });

  it('sets needsUpdate to true on instanceColor if it exists', () => {
    const scene = new THREE.Scene();
    const instancer = new ProjectileInstancer(scene);

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();

    const bullet = new THREE.Object3D();
    bullet.add(new THREE.Mesh(geo, mat));

    instancer.beginFrame();
    instancer.addBullet(bullet);

    const instMesh = scene.children[0] as THREE.InstancedMesh;
    const mockColorAttribute = { needsUpdate: false };
    instMesh.instanceColor = mockColorAttribute as any;

    instancer.endFrame();

    expect(mockColorAttribute.needsUpdate).toBe(true);
  });
});
