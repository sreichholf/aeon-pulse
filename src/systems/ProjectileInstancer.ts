import * as THREE from 'three';
import { RenderCategory, UserDataKey } from '../types.ts';

import { markRenderCategory } from './RenderStats.ts';


interface CompiledMeshEntry {
  mesh: THREE.Mesh;
  key: string;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

const INSTANCE_CAPACITY = 1024;

export class ProjectileInstancer {
  private _scene: THREE.Scene;
  private _instancedMeshes: Map<string, THREE.InstancedMesh>;
  private _instanceCounts: Map<string, number>;

  constructor(scene: THREE.Scene) {
    this._scene = scene;
    this._instancedMeshes = new Map();
    this._instanceCounts = new Map();
  }

  /** Clears the instance counts at the start of each update frame. */
  beginFrame(): void {
    this._instanceCounts.clear();
  }

  /**
   * Registers and adds a bullet's meshes to the instanced batches for this frame.
   * If the bullet mesh hasn't been compiled yet, compiles its descendant structure
   * once to avoid runtime traversals, closure allocations, and string garbage.
   */
  addBullet(bulletMesh: THREE.Object3D): void {
    let compiled: CompiledMeshEntry[] | undefined = bulletMesh.userData[UserDataKey.COMPILED_MESHES];

    // 1. Compile child meshes once upon registration
    if (!compiled) {
      compiled = [];
      bulletMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geo = child.geometry;
          const mat = child.material;
          const key = `${geo.uuid}_${mat.uuid}`;

          compiled!.push({
            mesh: child,
            key,
            geo,
            mat,
          });
        }
      });
      bulletMesh.userData[UserDataKey.COMPILED_MESHES] = compiled;
    }

    // 2. Compute world matrices for this frame
    bulletMesh.updateMatrixWorld(true);

    // 3. Process each compiled child mesh in a plain, allocation-free loop
    const len = compiled.length;
    for (let i = 0; i < len; i++) {
      const entry = compiled[i]!;
      const key = entry.key;

      let instMesh = this._instancedMeshes.get(key);
      if (!instMesh) {
        // Create instanced mesh with high capacity
        instMesh = new THREE.InstancedMesh(entry.geo, entry.mat, INSTANCE_CAPACITY);
        instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        
        // Satisfy ADR 0003 string enum category marking
        markRenderCategory(instMesh, RenderCategory.BULLET);
        
        this._scene.add(instMesh);
        this._instancedMeshes.set(key, instMesh);

        // Self-cleaning: dispose of instanced mesh when material is disposed (e.g. tinted clones)
        const onMaterialDispose = () => {
          entry.mat.removeEventListener('dispose', onMaterialDispose);
          const activeMesh = this._instancedMeshes.get(key);
          if (activeMesh) {
            this._scene.remove(activeMesh);
            activeMesh.dispose();
            this._instancedMeshes.delete(key);
          }
        };
        entry.mat.addEventListener('dispose', onMaterialDispose);
      }

      const count = this._instanceCounts.get(key) ?? 0;
      if (count < INSTANCE_CAPACITY) {
        // Copy the world matrix of the child mesh to the instanced batch
        instMesh.setMatrixAt(count, entry.mesh.matrixWorld);
        this._instanceCounts.set(key, count + 1);
      }
    }
  }

  /** Finalizes drawing counts and uploads instanced transforms at the end of the frame. */
  endFrame(): void {
    for (const [key, instMesh] of this._instancedMeshes.entries()) {
      const activeCount = this._instanceCounts.get(key) ?? 0;
      instMesh.count = activeCount;
      instMesh.instanceMatrix.needsUpdate = true;
      if (instMesh.instanceColor) {
        instMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /** Clears and disposes of all managed instanced meshes. */
  clear(): void {
    for (const instMesh of this._instancedMeshes.values()) {
      this._scene.remove(instMesh);
      instMesh.dispose();
    }
    this._instancedMeshes.clear();
    this._instanceCounts.clear();
  }
}
