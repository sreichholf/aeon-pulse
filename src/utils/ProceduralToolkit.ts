import * as THREE from 'three';
import { UserDataKey } from '../types.ts';
import type { ModelRenderBucketName } from '../systems/StandardEnemyModel.ts';

/**
 * Ensures that a BufferGeometry is non-indexed. If it is indexed, converts it to non-indexed.
 * Also removes any UV attribute to ensure clean procedural visual styling.
 */
export function ensureNonIndexed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const cloned = geo.index ? geo.toNonIndexed() : geo.clone();
  if (cloned.hasAttribute('uv')) {
    cloned.deleteAttribute('uv');
  }
  return cloned;
}

/**
 * Adds or updates a vertex color attribute on the geometry with a single solid color.
 */
export function addVertexColor(geo: THREE.BufferGeometry, colorHex: number): void {
  const posAttr = geo.getAttribute('position');
  if (!posAttr) return;
  const colors = new Float32Array(posAttr.count * 3);
  const color = new THREE.Color(colorHex);
  for (let i = 0; i < posAttr.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export class ProceduralResourceCache<T> {
  private _resources: T | null = null;

  get initialized(): boolean { return this._resources !== null; }
  get resources(): T { return this._resources!; }

  init(build: () => T): void {
    if (this._resources) return;
    this._resources = build();
  }
}

export const VOLCANIC_COLORS = {
  ROCK: 0x7a6a5f,
  ROCK_EMISSIVE: 0x381f12,
  ROCK_SPECULAR: 0x54473e,
  ARMOR: 0x948375,
  ARMOR_EMISSIVE: 0x3c2311,
  ARMOR_SPECULAR: 0x6a5d52,
  MOLTEN: 0xff3300,
  LAVA_TIP: 0xffaa00,
} as const;

export const VOLCANIC_MATERIAL_PARAMS = {
  rock: { color: VOLCANIC_COLORS.ROCK, emissive: VOLCANIC_COLORS.ROCK_EMISSIVE, specular: VOLCANIC_COLORS.ROCK_SPECULAR, shininess: 35 },
  armor: { color: VOLCANIC_COLORS.ARMOR, emissive: VOLCANIC_COLORS.ARMOR_EMISSIVE, specular: VOLCANIC_COLORS.ARMOR_SPECULAR, shininess: 25 },
  joint: { color: VOLCANIC_COLORS.MOLTEN, emissive: VOLCANIC_COLORS.MOLTEN, shininess: 10 },
} as const;

export function setMaterialBucket(material: THREE.Material, bucket: ModelRenderBucketName): void {
  material.userData[UserDataKey.MODEL_BUCKET] = bucket;
}

export function getMaterialBucket(material: THREE.Material): ModelRenderBucketName {
  return (material.userData[UserDataKey.MODEL_BUCKET] as ModelRenderBucketName) ?? 'body';
}
