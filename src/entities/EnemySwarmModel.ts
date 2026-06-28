import * as THREE from 'three';
import swarmGlbUrl from '../models/swarm.glb';
import swarmViewerGlbUrl from '../models/swarm-viewer.glb';
import {
  UNNAMED_STANDARD_ENEMY_MATERIAL,
  type StandardEnemyModelBucketConfig,
  type StandardEnemyPresentationProfiles,
} from '../systems/StandardEnemyModel.ts';

export const SWARM_MODEL_ROTATION = new THREE.Euler(
  0,
  0,
  0
);

export const SWARM_MODEL_OFFSET = new THREE.Vector3(0, 0, 0);

export const SWARM_MODEL_PROFILES: StandardEnemyPresentationProfiles = {
  gameplay: {
    assetUrl: swarmGlbUrl,
    targetVisualHeight: 20,
    rotation: SWARM_MODEL_ROTATION,
    offset: SWARM_MODEL_OFFSET,
  },
  viewer: {
    assetUrl: swarmViewerGlbUrl,
    targetVisualHeight: 26,
    rotation: SWARM_MODEL_ROTATION,
    offset: SWARM_MODEL_OFFSET,
  },
};

export const SWARM_MODEL_BUCKET_CONFIG: StandardEnemyModelBucketConfig = {
  bodyMaterialMode: 'source',
  materialRules: {
    [UNNAMED_STANDARD_ENEMY_MATERIAL]: { bucket: 'body' },
  },
  bodyMaterial: {
    roughness: 0.42,
    metalness: 0.52,
    envMapIntensity: 1.1,
  },
};
