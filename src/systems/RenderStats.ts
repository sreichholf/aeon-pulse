import * as THREE from 'three';
import { RenderCategory } from '../types.ts';
export { RenderCategory };


export function markRenderCategory(object: THREE.Object3D, category: RenderCategory, detail?: string): void {
  object.userData['renderCategory'] = category;
  if (detail) object.userData['renderDetail'] = detail;
}
