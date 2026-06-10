import * as THREE from 'three';
import type { StandardEnemyModelBucketConfig } from '../systems/StandardEnemyModel.ts';

export const DIVER_TARGET_VISUAL_HEIGHT = 44;

export const DIVER_MODEL_ROTATION = new THREE.Euler(
  Math.PI / 2,
  -Math.PI / 2,
  Math.PI / 2,
);

export const DIVER_MODEL_OFFSET = new THREE.Vector3(0, 0, 0);

export const DIVER_MODEL_BUCKET_CONFIG: StandardEnemyModelBucketConfig = {
  materialRules: {
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
    envMapIntensity: 1.15,
  },
  glowMaterial: new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  }),
};
