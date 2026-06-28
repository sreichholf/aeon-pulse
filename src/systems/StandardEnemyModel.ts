import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type ModelRenderBucketName = 'body' | 'glass' | 'glow';
export const UNNAMED_STANDARD_ENEMY_MATERIAL = '__unnamed__';
export type StandardEnemyPresentationContext = 'gameplay' | 'viewer';

export interface StandardEnemyModelBucketRule {
  bucket: ModelRenderBucketName;
  color?: THREE.ColorRepresentation;
}

export interface StandardEnemyModelBucketConfig {
  materialRules: Record<string, StandardEnemyModelBucketRule>;
  bodyMaterialMode?: 'generated' | 'source';
  bodyColorGain?: number;
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

export interface StandardEnemyPresentationProfile {
  assetUrl: string;
  targetVisualHeight: number;
  rotation: THREE.Euler;
  offset?: THREE.Vector3;
}

export type StandardEnemyPresentationProfiles = Record<
  StandardEnemyPresentationContext,
  StandardEnemyPresentationProfile
>;

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
  let bodySourceMaterial: THREE.Material | null = null;

  source.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const material = firstMaterial(child.material);
    const rule = getBucketRule(config, material.name);
    if (!rule) return;

    const geometry = cloneBucketGeometry(
      child,
      center,
      rule.color ?? materialColor(material),
      config.bodyMaterialMode === 'source',
    );
    const bucketGeometries = geometriesByBucket.get(rule.bucket) ?? [];
    bucketGeometries.push(geometry);
    geometriesByBucket.set(rule.bucket, bucketGeometries);

    if (rule.bucket === 'body' && !bodySourceMaterial) {
      bodySourceMaterial = material;
    }
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
    const material = createBucketMaterial(bucketName, config, glassMaterial, bodySourceMaterial);
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

export function createStandardEnemyModelPresentationInstance(
  prepared: PreparedStandardEnemyModel,
  profiles: StandardEnemyPresentationProfiles,
  context: StandardEnemyPresentationContext,
  options: {
    flashMaterial?: THREE.Material;
  } = {},
): StandardEnemyModelInstance {
  const profile = profiles[context];
  return createStandardEnemyModelInstance(prepared, {
    targetVisualHeight: profile.targetVisualHeight,
    rotation: profile.rotation,
    offset: profile.offset,
    flashMaterial: options.flashMaterial,
  });
}

export function createStandardEnemyPreparedModelCache(): Record<
  StandardEnemyPresentationContext,
  PreparedStandardEnemyModel | null
> {
  return {
    gameplay: null,
    viewer: null,
  };
}

export function createStandardEnemyPreparedModelPromiseCache(): Record<
  StandardEnemyPresentationContext,
  Promise<PreparedStandardEnemyModel> | null
> {
  return {
    gameplay: null,
    viewer: null,
  };
}

export function getPreparedModelBucketNames(prepared: PreparedStandardEnemyModel): ModelRenderBucketName[] {
  return prepared.buckets.map((bucket) => bucket.name);
}

export interface StandardEnemyModelSourceConfig {
  /** Used only for load-error logging. */
  name: string;
  profiles: StandardEnemyPresentationProfiles;
  bucketConfig: StandardEnemyModelBucketConfig;
}

export interface StandardEnemyModelAttachOptions {
  /** Group the built instance's root is parented into. */
  target: THREE.Group;
  context: StandardEnemyPresentationContext;
  /** Checked at attach time; a subject that died before its model loaded never gets an instance. */
  isAlive: () => boolean;
  /** Lets the caller capture the instance (e.g. its flash overlay) after it is parented. */
  onInstance?: (instance: StandardEnemyModelInstance) => void;
  flashMaterial?: THREE.Material;
}

/**
 * Owns the load → cache → attach lifecycle of one GLB-backed Standard Enemy Model (ADR 0024).
 * One source per enemy, configured with that enemy's presentation profiles and Model Render Bucket
 * config. Loading and the prepared-model cache live here rather than copied onto each enemy class.
 */
export class StandardEnemyModelSource {
  private readonly _models = createStandardEnemyPreparedModelCache();
  private readonly _loadPromises = createStandardEnemyPreparedModelPromiseCache();

  constructor(private readonly _config: StandardEnemyModelSourceConfig) {}

  /** Load (or return the cached) prepared model for a presentation context. Each context loads once. */
  preload(context: StandardEnemyPresentationContext = 'gameplay'): Promise<PreparedStandardEnemyModel> {
    const cached = this._models[context];
    if (cached) return Promise.resolve(cached);

    const inflight = this._loadPromises[context];
    if (inflight) return inflight;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const promise = new Promise<PreparedStandardEnemyModel>((resolve, reject) => {
      loader.load(
        this._config.profiles[context].assetUrl,
        (gltf) => {
          const prepared = prepareStandardEnemyModel(gltf.scene, this._config.bucketConfig);
          this._models[context] = prepared;
          resolve(prepared);
        },
        undefined,
        reject,
      );
    });
    this._loadPromises[context] = promise;
    return promise;
  }

  /**
   * Build a presentation instance and parent it into `target`. Attaches synchronously when the model
   * is already cached, otherwise after it loads.
   */
  attach(options: StandardEnemyModelAttachOptions): void {
    const place = (prepared: PreparedStandardEnemyModel): void => {
      if (!options.isAlive()) return;
      const instance = createStandardEnemyModelPresentationInstance(
        prepared,
        this._config.profiles,
        options.context,
        { flashMaterial: options.flashMaterial },
      );
      options.target.add(instance.root);
      options.onInstance?.(instance);
    };

    const cached = this._models[options.context];
    if (cached) {
      place(cached);
    } else if (typeof window !== 'undefined') {
      this.preload(options.context)
        .then(place)
        .catch((error) => console.error(`Failed to load ${this._config.name} GLB model:`, error));
    }
  }
}

function firstMaterial(material: THREE.Material | THREE.Material[]): THREE.Material {
  return Array.isArray(material) ? material[0]! : material;
}

function cloneBucketGeometry(
  mesh: THREE.Mesh,
  center: THREE.Vector3,
  color: THREE.ColorRepresentation,
  preserveUv: boolean,
): THREE.BufferGeometry {
  const sourceGeometry = mesh.geometry.clone();
  sourceGeometry.applyMatrix4(mesh.matrixWorld);
  sourceGeometry.translate(-center.x, -center.y, -center.z);

  const geometry = new THREE.BufferGeometry();
  const position = sourceGeometry.getAttribute('position');
  geometry.setAttribute('position', position.clone());
  const uv = sourceGeometry.getAttribute('uv');
  if (preserveUv && uv) geometry.setAttribute('uv', uv.clone());
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
  bodySourceMaterial: THREE.Material | null,
): THREE.Material {
  switch (bucket) {
    case 'body': {
      const material = createBodyBucketMaterial(config, bodySourceMaterial);
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

function createBodyBucketMaterial(
  config: StandardEnemyModelBucketConfig,
  bodySourceMaterial: THREE.Material | null,
): THREE.MeshStandardMaterial {
  if (
    config.bodyMaterialMode === 'source'
    && bodySourceMaterial instanceof THREE.MeshStandardMaterial
  ) {
    const material = bodySourceMaterial.clone();
    if (config.bodyMaterial) {
      applyMeshStandardOverrides(material, config.bodyMaterial);
    }
    if (config.bodyColorGain && config.bodyColorGain !== 1) {
      material.color.multiplyScalar(config.bodyColorGain);
    }
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
    return material;
  }

  return new THREE.MeshStandardMaterial({
    ...DEFAULT_BODY_MATERIAL,
    ...config.bodyMaterial,
    vertexColors: true,
  });
}

function applyMeshStandardOverrides(
  material: THREE.MeshStandardMaterial,
  overrides: THREE.MeshStandardMaterialParameters,
): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (key === 'emissive' && value !== null) {
      material.emissive.set(value as THREE.ColorRepresentation);
      continue;
    }
    (material as Record<string, unknown>)[key] = value;
  }
}

export function getStandardEnemyMaterialRuleKey(materialName: string | undefined): string {
  return materialName && materialName.length > 0 ? materialName : UNNAMED_STANDARD_ENEMY_MATERIAL;
}

function getBucketRule(
  config: StandardEnemyModelBucketConfig,
  materialName: string | undefined,
): StandardEnemyModelBucketRule | undefined {
  return config.materialRules[getStandardEnemyMaterialRuleKey(materialName)];
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
