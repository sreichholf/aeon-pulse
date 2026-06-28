import * as THREE from 'three';
import { RenderCategory, UserDataKey } from '../types.ts';
import { markRenderCategory } from './RenderStats.ts';
import { getMaterialBucket } from '../utils/ProceduralToolkit.ts';
import type { ModelRenderBucketName } from './StandardEnemyModel.ts';

export interface EnemyBatchAttribution {
  enemyType: string;
  bucket: string;
  batchCount: number;
  instanceCount: number;
  triangleCount: number;
}

export interface EnemyInstancerBatchEntry {
  key: string;
  enemyType: string;
  bucket: string;
  instanceCount: number;
  trianglesPerInstance: number;
}

export interface EnemyInstancerSnapshot {
  batches: EnemyInstancerBatchEntry[];
  byTypeBucket: EnemyBatchAttribution[];
  totalInstances: number;
  totalBatches: number;
}

interface CompiledMeshEntry {
  mesh: THREE.Mesh;
  key: string;
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  enemyType: string;
  bucket: string;
}

const INSTANCE_CAPACITY = 512;
const DEFAULT_COLOR = new THREE.Color(0xffffff);
const FLASH_COLOR = new THREE.Color(0xffaaaa);

export class EnemyInstancer {
  private _scene: THREE.Scene;
  private _instancedMeshes: Map<string, THREE.InstancedMesh>;
  private _instanceCounts: Map<string, number>;
  private _compiledByKey: Map<string, CompiledMeshEntry>;
  private _lastEnemyTypeByKey: Map<string, string>;

  constructor(scene: THREE.Scene) {
    this._scene = scene;
    this._instancedMeshes = new Map();
    this._instanceCounts = new Map();
    this._compiledByKey = new Map();
    this._lastEnemyTypeByKey = new Map();
  }

  /** Clears the instance counts at the start of each update frame. */
  beginFrame(): void {
    this._instanceCounts.clear();
  }

  /**
   * Registers and adds an enemy's meshes to the instanced batches for this frame.
   */
  addEnemy(enemyMesh: THREE.Object3D): void {
    let compiled: CompiledMeshEntry[] | undefined = enemyMesh.userData[UserDataKey.COMPILED_MESHES];

    // 1. Compile child meshes once upon registration
    if (!compiled) {
      const enemyType = findUserDataString(enemyMesh, UserDataKey.ENEMY_TYPE) ?? 'unknown';
      compiled = [];
      enemyMesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.visible) {
          const geo = child.geometry;
          const mat = firstMaterial(child.material);
          const key = `${geo.uuid}_${mat.uuid}`;

          compiled!.push({
            mesh: child,
            key,
            geo,
            mat,
            enemyType,
            bucket: resolveBucket(child, mat),
          });
        }
      });
      enemyMesh.userData[UserDataKey.COMPILED_MESHES] = compiled;
    }

    // 2. Compute world matrices for this frame
    enemyMesh.updateMatrixWorld(true);

    const isFlashing = !!enemyMesh.userData.isFlashing;

    // 3. Process each compiled child mesh in an allocation-free loop
      const len = compiled.length;
    for (let i = 0; i < len; i++) {
      const entry = compiled[i]!;
      const key = entry.key;
      this._lastEnemyTypeByKey.set(key, entry.enemyType);
      if (!this._compiledByKey.has(key)) {
        this._compiledByKey.set(key, entry);
      }

      let instMesh = this._instancedMeshes.get(key);
      if (!instMesh) {

        // Create instanced mesh with high capacity
        instMesh = new THREE.InstancedMesh(entry.geo, entry.mat, INSTANCE_CAPACITY);
        instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        
        // Satisfy ADR 0003 string enum category marking
        markRenderCategory(instMesh, RenderCategory.ENEMY);
        instMesh.frustumCulled = false;
        
        this._scene.add(instMesh);
        this._instancedMeshes.set(key, instMesh);

        // Self-cleaning: dispose of instanced mesh when material is disposed
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

        // Copy flash color or default white to the instanced batch
        instMesh.setColorAt(count, isFlashing ? FLASH_COLOR : DEFAULT_COLOR);
        
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

  getAttributionSnapshot(): EnemyInstancerSnapshot {
    const batches: EnemyInstancerBatchEntry[] = [];

    for (const [key, instMesh] of this._instancedMeshes.entries()) {
      const instanceCount = this._instanceCounts.get(key) ?? 0;
      if (instanceCount <= 0) continue;

      const compiled = this._compiledByKey.get(key);
      const geo = instMesh.geometry;
      const positionCount = geo.attributes.position?.count ?? 0;
      const trianglesPerInstance = geo.index
        ? Math.round(geo.index.count / 3)
        : Math.round(positionCount / 3);

      batches.push({
        key,
        enemyType: this._lastEnemyTypeByKey.get(key) ?? compiled?.enemyType ?? 'unknown',
        bucket: compiled?.bucket ?? getMaterialBucket(firstMaterial(instMesh.material)),
        instanceCount,
        trianglesPerInstance,
      });
    }

    const attributionMap = new Map<string, EnemyBatchAttribution>();
    let totalInstances = 0;
    for (const batch of batches) {
      totalInstances += batch.instanceCount;
      const mapKey = `${batch.enemyType}|${batch.bucket}`;
      const existing = attributionMap.get(mapKey);
      if (existing) {
        existing.batchCount += 1;
        existing.instanceCount += batch.instanceCount;
        existing.triangleCount += batch.instanceCount * batch.trianglesPerInstance;
      } else {
        attributionMap.set(mapKey, {
          enemyType: batch.enemyType,
          bucket: batch.bucket,
          batchCount: 1,
          instanceCount: batch.instanceCount,
          triangleCount: batch.instanceCount * batch.trianglesPerInstance,
        });
      }
    }

    const byTypeBucket = Array.from(attributionMap.values()).sort((a, b) => b.triangleCount - a.triangleCount);

    return {
      batches,
      byTypeBucket,
      totalInstances,
      totalBatches: batches.length,
    };
  }

  /** Clears and disposes of all managed instanced meshes. */
  clear(): void {
    for (const instMesh of this._instancedMeshes.values()) {
      this._scene.remove(instMesh);
      instMesh.dispose();
    }
    this._instancedMeshes.clear();
    this._instanceCounts.clear();
    this._compiledByKey.clear();
    this._lastEnemyTypeByKey.clear();
  }
}

function resolveBucket(mesh: THREE.Mesh, mat: THREE.Material): ModelRenderBucketName {
  const meshBucket = mesh.userData[UserDataKey.MODEL_BUCKET];
  if (typeof meshBucket === 'string' && meshBucket.length > 0) {
    return meshBucket as ModelRenderBucketName;
  }
  return getMaterialBucket(mat);
}

function findUserDataString(object: THREE.Object3D, key: UserDataKey): string | undefined {
  let cur: THREE.Object3D | null = object;
  while (cur) {
    const value = cur.userData[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    cur = cur.parent;
  }
  return undefined;
}

function firstMaterial(material: THREE.Material | THREE.Material[]): THREE.Material {
  return Array.isArray(material) ? material[0]! : material;
}
