import * as THREE from 'three';

/**
 * Ensures that a BufferGeometry is non-indexed. If it is indexed, converts it to non-indexed.
 * Also removes any UV attribute to ensure clean procedural visual styling.
 */
export function ensureNonIndexed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const cloned = geo.index ? geo.toNonIndexed() : geo.clone();
  if (cloned.hasAttribute('uv')) {
    cloned.deleteAttribute('uv');
  }
  return cloned;
}

/**
 * Adds or updates a vertex color attribute on the geometry with a single solid color.
 */
export function addVertexColor(geo: THREE.BufferGeometry, colorHex: number): void {
  const posAttr = geo.getAttribute('position');
  if (!posAttr) return;
  const colors = new Float32Array(posAttr.count * 3);
  const color = new THREE.Color(colorHex);
  for (let i = 0; i < posAttr.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
