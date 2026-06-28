import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createStandardEnemyModelInstance,
  getStandardEnemyMaterialRuleKey,
  getPreparedModelBucketNames,
  prepareStandardEnemyModel,
  UNNAMED_STANDARD_ENEMY_MATERIAL,
} from './StandardEnemyModel.ts';
import {
  DIVER_MODEL_BUCKET_CONFIG,
  DIVER_MODEL_PROFILES,
  DIVER_MODEL_ROTATION,
} from '../entities/EnemyDiverModel.ts';
import { STRAIGHT_MODEL_BUCKET_CONFIG } from '../entities/EnemyStraightModel.ts';
import { SINE_MODEL_BUCKET_CONFIG } from '../entities/EnemySineModel.ts';
import { SWARM_MODEL_BUCKET_CONFIG } from '../entities/EnemySwarmModel.ts';

describe('StandardEnemyModel', () => {
  it('prepares a diver-shaped static model into shared runtime buckets', () => {
    const source = createDiverLikeSourceModel();

    const prepared = prepareStandardEnemyModel(source, DIVER_MODEL_BUCKET_CONFIG);

    expect(getPreparedModelBucketNames(prepared)).toEqual(['body', 'glass', 'glow']);
    expect(prepared.buckets).toHaveLength(3);
    expect(prepared.bodyGeometry).not.toBeNull();

    const first = createStandardEnemyModelInstance(prepared, {
      targetVisualHeight: DIVER_MODEL_PROFILES.gameplay.targetVisualHeight,
      rotation: DIVER_MODEL_ROTATION,
    });
    const second = createStandardEnemyModelInstance(prepared, {
      targetVisualHeight: DIVER_MODEL_PROFILES.gameplay.targetVisualHeight,
      rotation: DIVER_MODEL_ROTATION,
    });

    const firstMeshes = modelBucketMeshes(first.root);
    const secondMeshes = modelBucketMeshes(second.root);
    expect(firstMeshes).toHaveLength(3);
    expect(secondMeshes).toHaveLength(3);
    for (let i = 0; i < firstMeshes.length; i += 1) {
      expect(firstMeshes[i]!.geometry).toBe(secondMeshes[i]!.geometry);
      expect(firstMeshes[i]!.material).toBe(secondMeshes[i]!.material);
    }

    expect(first.flashOverlay).not.toBeNull();
    expect(first.flashOverlay!.visible).toBe(false);
    expect(first.flashOverlay!.geometry).toBe(prepared.bodyGeometry);
  });

  it('keeps the current diver GLB within the agreed render bucket vocabulary', () => {
    const json = readGlbJson(new URL('../models/diver.glb', import.meta.url));
    const materialNames = (json.materials ?? []).map((material) => material.name);
    const missingRules = materialNames.filter((name) => !DIVER_MODEL_BUCKET_CONFIG.materialRules[getStandardEnemyMaterialRuleKey(name)]);
    const buckets = new Set(materialNames.map((name) => DIVER_MODEL_BUCKET_CONFIG.materialRules[getStandardEnemyMaterialRuleKey(name)]?.bucket));

    expect(missingRules).toEqual([]);
    expect(materialNames).toEqual([undefined]);
    expect(DIVER_MODEL_BUCKET_CONFIG.materialRules[UNNAMED_STANDARD_ENEMY_MATERIAL]?.bucket).toBe('body');
    expect([...buckets].sort()).toEqual(['body']);
    expect(buckets.size).toBeLessThanOrEqual(3);
  });

  it('keeps the current straight GLB within the agreed render bucket vocabulary', () => {
    const json = readGlbJson(new URL('../models/straight.glb', import.meta.url));
    const materialNames = (json.materials ?? []).map((material) => material.name);
    const missingRules = materialNames.filter((name) => !STRAIGHT_MODEL_BUCKET_CONFIG.materialRules[getStandardEnemyMaterialRuleKey(name)]);
    const buckets = new Set(materialNames.map((name) => STRAIGHT_MODEL_BUCKET_CONFIG.materialRules[getStandardEnemyMaterialRuleKey(name)]?.bucket));

    expect(missingRules).toEqual([]);
    expect(materialNames).toEqual([undefined]);
    expect(STRAIGHT_MODEL_BUCKET_CONFIG.materialRules[UNNAMED_STANDARD_ENEMY_MATERIAL]?.bucket).toBe('body');
    expect([...buckets].sort()).toEqual(['body']);
    expect(buckets.size).toBeLessThanOrEqual(3);
    expect(STRAIGHT_MODEL_BUCKET_CONFIG.materialRules.StraightAmberGlow?.bucket).toBe('body');
    expect(STRAIGHT_MODEL_BUCKET_CONFIG.materialRules.StraightSensorGlow?.bucket).toBe('body');
  });

  it('keeps the current sine GLB within the agreed render bucket vocabulary', () => {
    const json = readGlbJson(new URL('../models/sine.glb', import.meta.url));
    const materialNames = (json.materials ?? []).map((material) => material.name);
    const missingRules = materialNames.filter((name) => !SINE_MODEL_BUCKET_CONFIG.materialRules[getStandardEnemyMaterialRuleKey(name)]);
    const buckets = new Set(materialNames.map((name) => SINE_MODEL_BUCKET_CONFIG.materialRules[getStandardEnemyMaterialRuleKey(name)]?.bucket));

    expect(missingRules).toEqual([]);
    expect(materialNames).toEqual([undefined]);
    expect(SINE_MODEL_BUCKET_CONFIG.materialRules[UNNAMED_STANDARD_ENEMY_MATERIAL]?.bucket).toBe('body');
    expect([...buckets].sort()).toEqual(['body']);
    expect(buckets.size).toBeLessThanOrEqual(3);
  });

  it('keeps the current swarm GLB within the agreed render bucket vocabulary', () => {
    const json = readGlbJson(new URL('../models/swarm.glb', import.meta.url));
    const materialNames = (json.materials ?? []).map((material) => material.name);
    const missingRules = materialNames.filter((name) => !SWARM_MODEL_BUCKET_CONFIG.materialRules[getStandardEnemyMaterialRuleKey(name)]);
    const buckets = new Set(materialNames.map((name) => SWARM_MODEL_BUCKET_CONFIG.materialRules[getStandardEnemyMaterialRuleKey(name)]?.bucket));

    expect(missingRules).toEqual([]);
    expect(materialNames).toEqual([undefined]);
    expect(SWARM_MODEL_BUCKET_CONFIG.materialRules[UNNAMED_STANDARD_ENEMY_MATERIAL]?.bucket).toBe('body');
    expect([...buckets].sort()).toEqual(['body']);
    expect(buckets.size).toBeLessThanOrEqual(3);
  });

  it('keeps straight body preparation on the plain source-material path', () => {
    const prepared = prepareStandardEnemyModel(createStraightLikeSourceModel(), STRAIGHT_MODEL_BUCKET_CONFIG);
    const bodyBucket = prepared.buckets.find((bucket) => bucket.name === 'body');

    expect(bodyBucket?.material).toBeInstanceOf(THREE.MeshStandardMaterial);

    const bodyMaterial = bodyBucket!.material as THREE.MeshStandardMaterial;
    expect(bodyMaterial.userData['straightVisorEmissiveUniform']).toBeUndefined();
    expect(bodyMaterial.onBeforeCompile).toBe(THREE.Material.prototype.onBeforeCompile);
  });

  it('preserves textured unnamed body materials for straight and diver assets', () => {
    const sourceMaterial = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), name: '' });
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial));

    const straightPrepared = prepareStandardEnemyModel(source, STRAIGHT_MODEL_BUCKET_CONFIG);
    const diverPrepared = prepareStandardEnemyModel(source, DIVER_MODEL_BUCKET_CONFIG);

    const straightBody = straightPrepared.buckets.find((bucket) => bucket.name === 'body')?.material;
    const diverBody = diverPrepared.buckets.find((bucket) => bucket.name === 'body')?.material;

    expect(straightBody).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((straightBody as THREE.MeshStandardMaterial).map).toBe(sourceMaterial.map);
    expect((straightBody as THREE.MeshStandardMaterial).userData['straightVisorEmissiveUniform']).toBeUndefined();
    expect((straightBody as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x000000);
    expect((straightBody as THREE.MeshStandardMaterial).emissiveIntensity).toBeCloseTo(0);
    expect((straightBody as THREE.MeshStandardMaterial).color.r).toBeCloseTo(1);
    expect(diverBody).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((diverBody as THREE.MeshStandardMaterial).map).toBe(sourceMaterial.map);
    expect((diverBody as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x000000);
    expect((diverBody as THREE.MeshStandardMaterial).emissiveIntensity).toBeCloseTo(0);
    expect((diverBody as THREE.MeshStandardMaterial).color.r).toBeCloseTo(1);
  });

  it('preserves textured unnamed body materials for the sine asset', () => {
    const sourceMaterial = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), normalMap: new THREE.Texture(), name: '' });
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial));

    const prepared = prepareStandardEnemyModel(source, SINE_MODEL_BUCKET_CONFIG);
    const body = prepared.buckets.find((bucket) => bucket.name === 'body')?.material;

    expect(body).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((body as THREE.MeshStandardMaterial).map).toBe(sourceMaterial.map);
    expect((body as THREE.MeshStandardMaterial).normalMap).toBe(sourceMaterial.normalMap);
    expect((body as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x000000);
    expect((body as THREE.MeshStandardMaterial).emissiveIntensity).toBeCloseTo(0);
    expect((body as THREE.MeshStandardMaterial).color.r).toBeCloseTo(1);
  });
});

function createDiverLikeSourceModel(): THREE.Group {
  const group = new THREE.Group();
  for (const materialName of Object.keys(DIVER_MODEL_BUCKET_CONFIG.materialRules)) {
    const material = new THREE.MeshStandardMaterial({ name: materialName, color: 0xffffff });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    mesh.position.x = group.children.length * 1.25;
    group.add(mesh);
  }
  return group;
}

function createStraightLikeSourceModel(): THREE.Group {
  const group = new THREE.Group();
  for (const materialName of Object.keys(STRAIGHT_MODEL_BUCKET_CONFIG.materialRules)) {
    const material = new THREE.MeshStandardMaterial({ name: materialName, color: 0xffffff });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    mesh.position.x = group.children.length * 1.25;
    group.add(mesh);
  }
  return group;
}

function modelBucketMeshes(root: THREE.Group): THREE.Mesh[] {
  return root.children.filter((child): child is THREE.Mesh => (
    child instanceof THREE.Mesh && child.visible
  ));
}

function readGlbJson(url: URL): { materials?: Array<{ name: string }> } {
  const bytes = readFileSync(url);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const jsonText = new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength));
  return JSON.parse(jsonText) as { materials?: Array<{ name: string }> };
}
