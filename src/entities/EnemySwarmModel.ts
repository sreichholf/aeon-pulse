import * as THREE from 'three';
import type { StandardEnemyModelBucketConfig } from '../systems/StandardEnemyModel.ts';

export const SWARM_TARGET_VISUAL_HEIGHT = 26;

export const SWARM_MODEL_ROTATION = new THREE.Euler(
  0,
  -Math.PI / 2,
  0
);

export const SWARM_MODEL_OFFSET = new THREE.Vector3(0, 0, 0);

export const SWARM_MODEL_BUCKET_CONFIG: StandardEnemyModelBucketConfig = {
  materialRules: {
    HullDark: { bucket: 'body', color: 0x64748b },
    PanelDark: { bucket: 'body', color: 0x94a3b8 },
    TrimGray: { bucket: 'body', color: 0x475569 },
    CyanGlow: { bucket: 'glow', color: 0x00ffee },
    CyanDim: { bucket: 'glow', color: 0x008888 },
    CoreWhite: { bucket: 'glow', color: 0xffffff },
    FlameOuter: { bucket: 'glow', color: 0x00ffee },
    FlameInner: { bucket: 'glow', color: 0xffffff },
  },
  bodyMaterial: {
    roughness: 0.42,
    metalness: 0.52,
    envMapIntensity: 1.1,
  },
  glowMaterial: new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  }),
};
