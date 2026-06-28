import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EnemyInstancer } from './EnemyInstancer.ts';
import { UserDataKey, RenderCategory } from '../types.ts';
import { setMaterialBucket } from '../utils/ProceduralToolkit.ts';

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

  it('does not compile hidden meshes into instanced batches', () => {
    const scene = new THREE.Scene();
    const instancer = new EnemyInstancer(scene);

    const enemyMesh = new THREE.Object3D();

    const visibleMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial(),
    );
    const hiddenMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial(),
    );
    hiddenMesh.visible = false;

    enemyMesh.add(visibleMesh);
    enemyMesh.add(hiddenMesh);

    instancer.beginFrame();
    instancer.addEnemy(enemyMesh);
    instancer.endFrame();

    const compiled = enemyMesh.userData[UserDataKey.COMPILED_MESHES];
    expect(compiled).toHaveLength(1);
    expect(compiled[0].mesh).toBe(visibleMesh);
    expect(scene.children).toHaveLength(1);
  });

  describe('getAttributionSnapshot', () => {
    it('returns empty byTypeBucket when no enemies were added', () => {
      const scene = new THREE.Scene();
      const instancer = new EnemyInstancer(scene);

      instancer.beginFrame();
      instancer.endFrame();

      const snapshot = instancer.getAttributionSnapshot();
      expect(snapshot.batches).toHaveLength(0);
      expect(snapshot.byTypeBucket).toHaveLength(0);
      expect(snapshot.totalInstances).toBe(0);
      expect(snapshot.totalBatches).toBe(0);
    });

    it('attributes a tagged enemy to its type and material bucket', () => {
      const scene = new THREE.Scene();
      const instancer = new EnemyInstancer(scene);

      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      setMaterialBucket(mat, 'body');

      const enemy = new THREE.Object3D();
      enemy.userData[UserDataKey.ENEMY_TYPE] = 'sine';
      enemy.add(new THREE.Mesh(geo, mat));

      instancer.beginFrame();
      instancer.addEnemy(enemy);
      instancer.endFrame();

      const snapshot = instancer.getAttributionSnapshot();
      expect(snapshot.byTypeBucket).toHaveLength(1);
      expect(snapshot.byTypeBucket[0]).toMatchObject({
        enemyType: 'sine',
        bucket: 'body',
        batchCount: 1,
        instanceCount: 1,
      });
      expect(snapshot.byTypeBucket[0]!.triangleCount).toBeGreaterThan(0);
      expect(snapshot.totalInstances).toBe(1);
      expect(snapshot.totalBatches).toBe(1);
    });

    it('degrades gracefully for untagged enemies', () => {
      const scene = new THREE.Scene();
      const instancer = new EnemyInstancer(scene);

      const enemy = new THREE.Object3D();
      enemy.add(new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial(),
      ));

      instancer.beginFrame();
      instancer.addEnemy(enemy);
      instancer.endFrame();

      const snapshot = instancer.getAttributionSnapshot();
      expect(snapshot.byTypeBucket).toHaveLength(1);
      expect(snapshot.byTypeBucket[0]).toMatchObject({
        enemyType: 'unknown',
        bucket: 'body',
        batchCount: 1,
        instanceCount: 1,
      });
    });

    it('attributes shared-material batches to the last enemy type added', () => {
      const scene = new THREE.Scene();
      const instancer = new EnemyInstancer(scene);

      const geo = new THREE.BufferGeometry();
      // Give geometry some vertices so triangle count is non-zero.
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
      ]), 3));
      const mat = new THREE.MeshBasicMaterial();
      setMaterialBucket(mat, 'body');

      const enemyA = new THREE.Object3D();
      enemyA.userData[UserDataKey.ENEMY_TYPE] = 'straight';
      enemyA.add(new THREE.Mesh(geo, mat));

      const enemyB = new THREE.Object3D();
      enemyB.userData[UserDataKey.ENEMY_TYPE] = 'sine';
      enemyB.add(new THREE.Mesh(geo, mat));

      instancer.beginFrame();
      instancer.addEnemy(enemyA);
      instancer.addEnemy(enemyB);
      instancer.endFrame();

      const snapshot = instancer.getAttributionSnapshot();
      // Both enemies share geometry and material, so they collapse to one batch.
      expect(snapshot.totalBatches).toBe(1);
      expect(snapshot.totalInstances).toBe(2);
      expect(snapshot.byTypeBucket).toHaveLength(1);
      // Because the material is shared, attribution follows whichever type was
      // registered last into the single shared batch.
      expect(snapshot.byTypeBucket[0]!.enemyType).toBe('sine');
    });

    it('prefers mesh userData bucket over material bucket (GLB path)', () => {
      const scene = new THREE.Scene();
      const instancer = new EnemyInstancer(scene);

      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      // GLB path stamps the bucket on the MESH userData, not the material.
      // No bucket on the material here; the mesh carries it.
      const childMesh = new THREE.Mesh(geo, mat);
      childMesh.userData[UserDataKey.MODEL_BUCKET] = 'glow';

      const enemy = new THREE.Object3D();
      enemy.userData[UserDataKey.ENEMY_TYPE] = 'diver';
      enemy.add(childMesh);

      instancer.beginFrame();
      instancer.addEnemy(enemy);
      instancer.endFrame();

      const snapshot = instancer.getAttributionSnapshot();
      expect(snapshot.byTypeBucket).toHaveLength(1);
      expect(snapshot.byTypeBucket[0]).toMatchObject({
        enemyType: 'diver',
        bucket: 'glow',
      });
    });
  });
});
