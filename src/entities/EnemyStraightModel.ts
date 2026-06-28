import * as THREE from 'three';
import straightGlbUrl from '../models/straight.glb';
import straightViewerGlbUrl from '../models/straight-viewer.glb';
import {
  UNNAMED_STANDARD_ENEMY_MATERIAL,
  type StandardEnemyModelBucketConfig,
  type StandardEnemyPresentationProfiles,
} from '../systems/StandardEnemyModel.ts';

export const STRAIGHT_MODEL_ROTATION = new THREE.Euler(0, 0, 0);

export const STRAIGHT_MODEL_OFFSET = new THREE.Vector3(-3, 1.3, 0);

export const STRAIGHT_MODEL_PROFILES: StandardEnemyPresentationProfiles = {
  gameplay: {
    assetUrl: straightGlbUrl,
    targetVisualHeight: 16,
    rotation: STRAIGHT_MODEL_ROTATION,
    offset: STRAIGHT_MODEL_OFFSET,
  },
  viewer: {
    assetUrl: straightViewerGlbUrl,
    targetVisualHeight: 16,
    rotation: STRAIGHT_MODEL_ROTATION,
    offset: STRAIGHT_MODEL_OFFSET,
  },
};

export const STRAIGHT_VISUAL_SCALE = 1.4;

export const STRAIGHT_COLLISION_HALF_WIDTH = 21;
export const STRAIGHT_COLLISION_HALF_HEIGHT = 16;
export const STRAIGHT_COLLISION_OFFSET_X = -3;

export const STRAIGHT_ENGINE_FLAME_OFFSET = new THREE.Vector3(13, 0, 0);
export const STRAIGHT_LEFT_GUN_OFFSET = new THREE.Vector3(-18, -1.2, 0.8);
export const STRAIGHT_RIGHT_GUN_OFFSET = new THREE.Vector3(-18, 1.2, -0.8);

export const STRAIGHT_MODEL_BUCKET_CONFIG: StandardEnemyModelBucketConfig = {
  bodyMaterialMode: 'source',
  materialRules: {
    [UNNAMED_STANDARD_ENEMY_MATERIAL]: { bucket: 'body' },
    StraightBlue: { bucket: 'body', color: 0x485e7d },
    StraightDarkBlue: { bucket: 'body', color: 0x2a3345 },
    StraightCrimson: { bucket: 'body', color: 0xff2d55 },
    StraightGunmetal: { bucket: 'body', color: 0x6b778c },
    StraightCopper: { bucket: 'body', color: 0xd4af37 },
    StraightAmberGlow: { bucket: 'body', color: 0xffaa00 },
    StraightSensorGlow: { bucket: 'body', color: 0xff1a2c },
    StraightCanopyGlass: { bucket: 'glass', color: 0x00d2ff },
  },
  bodyMaterial: {
    roughness: 0.42,
    metalness: 0.52,
    emissive: 0x000000,
    emissiveIntensity: 0,
    envMapIntensity: 1.1,
  },
  glassMaterial: new THREE.MeshPhongMaterial({
    color: 0x00d2ff,
    emissive: 0x002b4d,
    shininess: 120,
    specular: 0xdff9fb,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  }),
};
