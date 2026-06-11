import * as THREE from 'three';
import type { StandardEnemyModelBucketConfig } from '../systems/StandardEnemyModel.ts';

export const SINE_TARGET_VISUAL_HEIGHT = 24;

export const SINE_MODEL_ROTATION = new THREE.Euler(
  0,
  -Math.PI / 2,
  0
);

export const SINE_MODEL_OFFSET = new THREE.Vector3(0, 0, 0);

export const SINE_MODEL_BUCKET_CONFIG: StandardEnemyModelBucketConfig = {
  materialRules: {
    HullGreenOrganic: { bucket: 'body', color: 0x5ebd5e },
    HullDarkGreen: { bucket: 'body', color: 0x1c4d1c },
    HullLightGreen: { bucket: 'body', color: 0x7be37b },
    BrushedMetal: { bucket: 'body', color: 0x8c9499 },
    DarkMetal: { bucket: 'body', color: 0x1e2421 },
    Canopy: { bucket: 'glass', color: 0xffa200 },
    TealGlow: { bucket: 'glow', color: 0x1aebd1 },
    FlameOuter: { bucket: 'glow', color: 0x40daf2 },
    FlameInner: { bucket: 'glow', color: 0xffffff },
  },
  bodyMaterial: {
    roughness: 0.45,
    metalness: 0.55,
    envMapIntensity: 1.1,
  },
  glassMaterial: new THREE.MeshStandardMaterial({
    color: 0xffa200,
    emissive: 0xff3c00,
    emissiveIntensity: 1.8,
    roughness: 0.05,
    metalness: 0.95,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  }),
  glowMaterial: new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  }),
};
