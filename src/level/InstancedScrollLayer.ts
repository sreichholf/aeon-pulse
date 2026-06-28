import * as THREE from 'three';
import { markRenderCategory } from '../systems/RenderStats.ts';
import type { RenderCategory } from '../systems/RenderStats.ts';
import type { IScene } from '../types.ts';

export interface InstancedScrollTransform {
  position: THREE.Vector3Tuple;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3Tuple;
}

interface InstancedScrollLayerOptions {
  renderCategory: RenderCategory;
  detail: string;
  mesh?: THREE.InstancedMesh;
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material;
  capacity?: number;
  ownedResources?: Array<{ dispose(): void }>;
}

const UNIT_SCALE: THREE.Vector3Tuple = [1, 1, 1];

export class InstancedScrollMeshLayer {
  readonly mesh: THREE.InstancedMesh;

  private readonly _helper: THREE.Object3D;
  private _count = 0;
  private _matrixDirty = false;
  private _colorDirty = false;

  constructor(mesh: THREE.InstancedMesh, helper: THREE.Object3D) {
    this.mesh = mesh;
    this._helper = helper;
  }

  beginFrame(): void {
    this._count = 0;
    this._matrixDirty = false;
    this._colorDirty = false;
  }

  push(transform: InstancedScrollTransform): number {
    const index = this._count;
    this.setTransform(index, transform);
    return index;
  }

  setTransform(index: number, transform: InstancedScrollTransform): void {
    const rotation = transform.rotation;
    const scale = transform.scale ?? UNIT_SCALE;
    this._helper.position.set(...transform.position);
    if (rotation) {
      this._helper.rotation.copy(rotation);
    } else {
      this._helper.rotation.set(0, 0, 0);
    }
    this._helper.scale.set(...scale);
    this._helper.updateMatrix();
    this.mesh.setMatrixAt(index, this._helper.matrix);
    this._count = Math.max(this._count, index + 1);
    this._matrixDirty = true;
  }

  setColorAt(index: number, color: THREE.Color): void {
    this.mesh.setColorAt(index, color);
    this._colorDirty = true;
  }

  endFrame(): void {
    this.mesh.count = this._count;
    if (this._matrixDirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this._colorDirty && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

export class InstancedScrollLayer {
  private readonly _scene: IScene;
  private readonly _helper: THREE.Object3D;
  private readonly _layers: Array<{
    handle: InstancedScrollMeshLayer;
    ownedResources: Array<{ dispose(): void }>;
  }> = [];

  constructor(scene: IScene) {
    this._scene = scene;
    this._helper = new THREE.Object3D();
  }

  createLayer(options: InstancedScrollLayerOptions): InstancedScrollMeshLayer {
    const mesh = options.mesh ?? this._buildMesh(options);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    markRenderCategory(mesh, options.renderCategory, options.detail);
    this._scene.add(mesh);

    const handle = new InstancedScrollMeshLayer(mesh, this._helper);
    this._layers.push({
      handle,
      ownedResources: options.ownedResources ?? [],
    });
    return handle;
  }

  destroy(): void {
    for (const layer of this._layers) {
      this._scene.remove(layer.handle.mesh);
      for (const resource of layer.ownedResources) {
        resource.dispose();
      }
    }
    this._layers.length = 0;
  }

  private _buildMesh(options: InstancedScrollLayerOptions): THREE.InstancedMesh {
    if (!options.geometry || !options.material || options.capacity === undefined) {
      throw new Error('InstancedScrollLayer.createLayer requires geometry, material, and capacity when mesh is not provided.');
    }
    return new THREE.InstancedMesh(options.geometry, options.material, options.capacity);
  }
}
