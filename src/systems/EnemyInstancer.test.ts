import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyInstancer } from './EnemyInstancer.ts';
import { UserDataKey, RenderCategory } from '../types.ts';

describe('EnemyInstancer', () => {
  it('compiles and caches userData[COMPILED_MESHES] on first registration', () => {
    const scene = new THREE.Scene();
    const instancer = new EnemyInstancer(scene);

    const enemyMesh = new THREE.Object3D();
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const childMesh = new THREE.Mesh(geo, mat);
    enemyMesh.add(childMesh);

    expect(enemyMesh.userData[UserDataKey.COMPILED_MESHES]).toBeUndefined();

    const traverseSpy = vi.spyOn(enemyMesh, 'traverse');

    instancer.beginFrame();
    instancer.addEnemy(enemyMesh);

    const compiled = enemyMesh.userData[UserDataKey.COMPILED_MESHES];
    expect(compiled).toBeDefined();
    expect(compiled).toHaveLength(1);
    expect(compiled[0].mesh).toBe(childMesh);
    expect(compiled[0].geo).toBe(geo);
    expect(compiled[0].mat).toBe(mat);
    expect(traverseSpy).toHaveBeenCalledTimes(1);

    instancer.addEnemy(enemyMesh);
    expect(traverseSpy).toHaveBeenCalledTimes(1);
  });

  it('creates THREE.InstancedMesh and sets RenderCategory.ENEMY', () => {
    const scene = new THREE.Scene();
    const addSpy = vi.spyOn(scene, 'add');
    const instancer = new EnemyInstancer(scene);

    const enemyMesh = new THREE.Object3D();
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();
    enemyMesh.add(new THREE.Mesh(geo, mat));

    instancer.beginFrame();
    instancer.addEnemy(enemyMesh);

    expect(addSpy).toHaveBeenCalledTimes(1);
    const instancedMesh = addSpy.mock.calls[0][0] as THREE.InstancedMesh;
    expect(instancedMesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(instancedMesh.userData['renderCategory']).toBe(RenderCategory.ENEMY);
  });

  it('updates instMesh.count and flags matrix update on endFrame()', () => {
    const scene = new THREE.Scene();
    const instancer = new EnemyInstancer(scene);

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();

    const enemy1 = new THREE.Object3D();
    enemy1.add(new THREE.Mesh(geo, mat));

    const enemy2 = new THREE.Object3D();
    enemy2.add(new THREE.Mesh(geo, mat));

    instancer.beginFrame();
    instancer.addEnemy(enemy1);
    instancer.addEnemy(enemy2);

    const instMesh = scene.children[0] as THREE.InstancedMesh;
    const initialVersion = instMesh.instanceMatrix.version;

    instancer.endFrame();

    expect(instMesh.count).toBe(2);
    expect(instMesh.instanceMatrix.version).toBeGreaterThan(initialVersion);

    // Reset frame
    instancer.beginFrame();
    instancer.endFrame();
    expect(instMesh.count).toBe(0);
  });

  it('sets flash color when userData.isFlashing is true', () => {
    const scene = new THREE.Scene();
    const instancer = new EnemyInstancer(scene);

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();

    const enemy1 = new THREE.Object3D();
    enemy1.add(new THREE.Mesh(geo, mat));
    enemy1.userData.isFlashing = true;

    const enemy2 = new THREE.Object3D();
    enemy2.add(new THREE.Mesh(geo, mat));
    enemy2.userData.isFlashing = false;

    instancer.beginFrame();
    instancer.addEnemy(enemy1);
    instancer.addEnemy(enemy2);
    instancer.endFrame();

    const instMesh = scene.children[0] as THREE.InstancedMesh;
    expect(instMesh.instanceColor).not.toBeNull();
    
    const color = new THREE.Color();
    instMesh.getColorAt(0, color);
    expect(color.r).toBeCloseTo(1.0);
    expect(color.g).toBeCloseTo(0.402, 2); // 0xffaaaa (approx 170/255 = 0.666 in sRGB, which is ~0.402 in linear sRGB)
    
    instMesh.getColorAt(1, color);
    expect(color.r).toBeCloseTo(1.0);
    expect(color.g).toBeCloseTo(1.0); // 0xffffff (1.0)
  });

  it('caps the active count at INSTANCE_CAPACITY (512)', () => {
    const scene = new THREE.Scene();
    const instancer = new EnemyInstancer(scene);

    const geo = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();

    const enemy = new THREE.Object3D();
    enemy.add(new THREE.Mesh(geo, mat));

    instancer.beginFrame();
    const capacity = 512;
    for (let i = 0; i < capacity + 10; i++) {
      instancer.addEnemy(enemy);
    }
    instancer.endFrame();

    const instMesh = scene.children[0] as THREE.InstancedMesh;
    expect(instMesh.count).toBe(capacity);
  });
});
