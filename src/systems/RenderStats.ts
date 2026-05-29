import * as THREE from 'three';

export enum RenderCategory {
  BACKGROUND = 'background',
  TERRAIN = 'terrain',
  PLAYER = 'player',
  ENEMY = 'enemy',
  BOSS = 'boss',
  BULLET = 'bullet',
  EFFECT = 'effect',
  UI = 'ui',
  ENGINE = 'engine',
  UNCATEGORIZED = 'uncategorized',
}

export function markRenderCategory(object: THREE.Object3D, category: RenderCategory, detail?: string): void {
  object.userData['renderCategory'] = category;
  if (detail) object.userData['renderDetail'] = detail;
}
