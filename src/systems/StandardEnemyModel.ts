import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type ModelRenderBucketName = 'body' | 'glass' | 'glow';

export interface StandardEnemyModelBucketRule {
  bucket: ModelRenderBucketName;
  color?: THREE.ColorRepresentation;
}

export interface StandardEnemyModelBucketConfig {
  materialRules: Record<string, StandardEnemyModelBucketRule>;
  bodyMaterial?: THREE.MeshStandardMaterialParameters;
  configureBodyMaterial?: (material: THREE.MeshStandardMaterial) => void;
  glassMaterial?: THREE.Material;
  glowMaterial?: THREE.Material;
}

export interface PreparedModelRenderBucket {
  name: ModelRenderBucketName;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

export interface PreparedStandardEnemyModel {
  buckets: PreparedModelRenderBucket[];
  bodyGeometry: THREE.BufferGeometry | null;
  size: THREE.Vector3;
}

export interface StandardEnemyModelInstance {
  root: THREE.Group;
  bucketMeshes: Partial<Record<ModelRenderBucketName, THREE.Mesh>>;
  flashOverlay: THREE.Mesh<THREE.BufferGeometry, THREE.Material> | null;
}

const DEFAULT_BODY_MATERIAL = Object.freeze({
  color: 0xffffff,
  roughness: 0.56,
  metalness: 0.72,
  vertexColors: true,
  side: THREE.DoubleSide,
});

const DEFAULT_GLOW_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  vertexColors: true,
  side: THREE.DoubleSide,
  toneMapped: false,
});

export const DEFAULT_FLASH_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xfff0e8,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false,
});

export function prepareStandardEnemyModel(
  source: THREE.Group,
  config: StandardEnemyModelBucketConfig,
): PreparedStandardEnemyModel {
  source.updateMatrixWorld(true);
  const sourceBox = new THREE.Box3().setFromObject(source);
  const center = sourceBox.getCenter(new THREE.Vector3());
  const size = sourceBox.getSize(new THREE.Vector3());

  const geometriesByBucket = new Map<ModelRenderBucketName, THREE.BufferGeometry[]>();
  let glassMaterial: THREE.Material | null = null;

  source.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const material = firstMaterial(child.material);
    const rule = config.materialRules[material.name];
    if (!rule) return;

    const geometry = cloneBucketGeometry(child, center, rule.color ?? materialColor(material));
    const bucketGeometries = geometriesByBucket.get(rule.bucket) ?? [];
    bucketGeometries.push(geometry);
    geometriesByBucket.set(rule.bucket, bucketGeometries);

    if (rule.bucket === 'glass' && !glassMaterial) {
      glassMaterial = config.glassMaterial?.clone() ?? material.clone();
      tuneGlassMaterial(glassMaterial);
    }
  });

  const buckets: PreparedModelRenderBucket[] = [];
  for (const bucketName of ['body', 'glass', 'glow'] satisfies ModelRenderBucketName[]) {
    const geometries = geometriesByBucket.get(bucketName);
    if (!geometries || geometries.length === 0) continue;

    const geometry = mergeBucketGeometries(geometries);
    const material = createBucketMaterial(bucketName, config, glassMaterial);
    buckets.push({ name: bucketName, geometry, material });
  }

  const bodyGeometry = buckets.find((bucket) => bucket.name === 'body')?.geometry ?? null;
  return { buckets, bodyGeometry, size };
}

export function createStandardEnemyModelInstance(
  prepared: PreparedStandardEnemyModel,
  options: {
    targetVisualHeight: number;
    rotation: THREE.Euler;
    offset?: THREE.Vector3;
    flashMaterial?: THREE.Material;
  },
): StandardEnemyModelInstance {
  const root = new THREE.Group();
  root.rotation.copy(options.rotation);
  const scale = options.targetVisualHeight / (prepared.size.y || 1);
  root.scale.setScalar(scale);
  if (options.offset) root.position.copy(options.offset);

  const bucketMeshes: Partial<Record<ModelRenderBucketName, THREE.Mesh>> = {};
  for (const bucket of prepared.buckets) {
    const mesh = new THREE.Mesh(bucket.geometry, bucket.material);
    mesh.name = bucket.name;
    mesh.userData['modelBucket'] = bucket.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    bucketMeshes[bucket.name] = mesh;
  }

  let flashOverlay: THREE.Mesh<THREE.BufferGeometry, THREE.Material> | null = null;
  if (prepared.bodyGeometry) {
    flashOverlay = new THREE.Mesh(prepared.bodyGeometry, options.flashMaterial ?? DEFAULT_FLASH_MATERIAL);
    flashOverlay.visible = false;
    flashOverlay.renderOrder = 20;
    root.add(flashOverlay);
  }

  return { root, bucketMeshes, flashOverlay };
}

export function getPreparedModelBucketNames(prepared: PreparedStandardEnemyModel): ModelRenderBucketName[] {
  return prepared.buckets.map((bucket) => bucket.name);
}

function firstMaterial(material: THREE.Material | THREE.Material[]): THREE.Material {
  return Array.isArray(material) ? material[0]! : material;
}

function cloneBucketGeometry(
  mesh: THREE.Mesh,
  center: THREE.Vector3,
  color: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  const sourceGeometry = mesh.geometry.clone();
  sourceGeometry.applyMatrix4(mesh.matrixWorld);
  sourceGeometry.translate(-center.x, -center.y, -center.z);

  const geometry = new THREE.BufferGeometry();
  const position = sourceGeometry.getAttribute('position');
  geometry.setAttribute('position', position.clone());
  if (sourceGeometry.index) geometry.setIndex(sourceGeometry.index.clone());

  const vertexColor = new THREE.Color(color);
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i += 1) {
    const offset = i * 3;
    colors[offset] = vertexColor.r;
    colors[offset + 1] = vertexColor.g;
    colors[offset + 2] = vertexColor.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  sourceGeometry.dispose();
  return geometry;
}

function mergeBucketGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = geometries.length === 1 ? geometries[0]!.clone() : mergeGeometries(geometries, false);
  for (const source of geometries) source.dispose();
  if (!geometry) {
    throw new Error('Failed to merge Standard Enemy Model bucket geometries');
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createBucketMaterial(
  bucket: ModelRenderBucketName,
  config: StandardEnemyModelBucketConfig,
  glassMaterial: THREE.Material | null,
): THREE.Material {
  switch (bucket) {
    case 'body': {
      const material = new THREE.MeshStandardMaterial({
        ...DEFAULT_BODY_MATERIAL,
        ...config.bodyMaterial,
        vertexColors: true,
      });
      config.configureBodyMaterial?.(material);
      return material;
    }
    case 'glass':
      if (!glassMaterial) {
        throw new Error('Standard Enemy Model glass bucket requires a source glass material');
      }
      return glassMaterial;
    case 'glow':
      return config.glowMaterial?.clone() ?? DEFAULT_GLOW_MATERIAL;
  }
}

function tuneGlassMaterial(material: THREE.Material): void {
  material.side = THREE.DoubleSide;
  material.transparent = true;
  material.depthWrite = false;
  material.needsUpdate = true;
}

function materialColor(material: THREE.Material): THREE.ColorRepresentation {
  if ('color' in material && material.color instanceof THREE.Color) {
    return material.color;
  }
  return 0xffffff;
}
