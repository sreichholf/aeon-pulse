import * as THREE from 'three';
import diverGlbUrl from '../models/diver.glb';
import diverViewerGlbUrl from '../models/diver-viewer.glb';
import {
  UNNAMED_STANDARD_ENEMY_MATERIAL,
  type StandardEnemyModelBucketConfig,
  type StandardEnemyPresentationProfiles,
} from '../systems/StandardEnemyModel.ts';

export const DIVER_MODEL_ROTATION = new THREE.Euler(0, 0, 0);

export const DIVER_MODEL_OFFSET = new THREE.Vector3(0, 0, 0);

export const DIVER_MODEL_PROFILES: StandardEnemyPresentationProfiles = {
  gameplay: {
    assetUrl: diverGlbUrl,
    targetVisualHeight: 44,
    rotation: DIVER_MODEL_ROTATION,
    offset: DIVER_MODEL_OFFSET,
  },
  viewer: {
    assetUrl: diverViewerGlbUrl,
    targetVisualHeight: 44,
    rotation: DIVER_MODEL_ROTATION,
    offset: DIVER_MODEL_OFFSET,
  },
};

export const DIVER_COLLISION_HALF_WIDTH = 19;
export const DIVER_COLLISION_HALF_HEIGHT = 16;
export const DIVER_COLLISION_OFFSET_X = -3;

export const DIVER_MODEL_BUCKET_CONFIG: StandardEnemyModelBucketConfig = {
  bodyMaterialMode: 'source',
  materialRules: {
    [UNNAMED_STANDARD_ENEMY_MATERIAL]: { bucket: 'body' },
    YellowPaintWorn: { bucket: 'body', color: 0xffc928 },
    YellowPaintDarkWorn: { bucket: 'body', color: 0xc99b18 },
    Gunmetal: { bucket: 'body', color: 0x4c4f54 },
    DarkMetal: { bucket: 'body', color: 0x1a1a1c },
    CanopyGlass: { bucket: 'glass', color: 0x29615c },
    ThrusterGlow: { bucket: 'glow', color: 0xff8c1a },
    RedLight: { bucket: 'glow', color: 0xd9140d },
    GreenLight: { bucket: 'glow', color: 0x4cbf73 },
    AmberLens: { bucket: 'glow', color: 0xffb226 },
  },
  bodyMaterial: {
    roughness: 0.42,
    metalness: 0.38,
    emissive: 0x000000,
    emissiveIntensity: 0,
    envMapIntensity: 1.15,
  },
  glowMaterial: new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  }),
};
