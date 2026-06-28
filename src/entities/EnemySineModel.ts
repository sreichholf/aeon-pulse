import * as THREE from 'three';
import sineGlbUrl from '../models/sine.glb';
import sineViewerGlbUrl from '../models/sine-viewer.glb';
import {
  UNNAMED_STANDARD_ENEMY_MATERIAL,
  type StandardEnemyModelBucketConfig,
  type StandardEnemyPresentationProfiles,
} from '../systems/StandardEnemyModel.ts';

export const SINE_MODEL_ROTATION = new THREE.Euler(
  0,
  0,
  0
);

export const SINE_MODEL_OFFSET = new THREE.Vector3(0, 0, 0);

export const SINE_MODEL_PROFILES: StandardEnemyPresentationProfiles = {
  gameplay: {
    assetUrl: sineGlbUrl,
    targetVisualHeight: 24,
    rotation: SINE_MODEL_ROTATION,
    offset: SINE_MODEL_OFFSET,
  },
  viewer: {
    assetUrl: sineViewerGlbUrl,
    targetVisualHeight: 24,
    rotation: SINE_MODEL_ROTATION,
    offset: SINE_MODEL_OFFSET,
  },
};

export const SINE_COLLISION_HALF_WIDTH = 34;
export const SINE_COLLISION_HALF_HEIGHT = 17;
export const SINE_COLLISION_OFFSET_X = -2;

export const SINE_MODEL_BUCKET_CONFIG: StandardEnemyModelBucketConfig = {
  bodyMaterialMode: 'source',
  materialRules: {
    [UNNAMED_STANDARD_ENEMY_MATERIAL]: { bucket: 'body' },
  },
  bodyMaterial: {
    roughness: 0.45,
    metalness: 0.55,
    emissive: 0x000000,
    emissiveIntensity: 0,
    envMapIntensity: 1.1,
  },
};
