import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ensureNonIndexed, addVertexColor } from './ProceduralToolkit.ts';

describe('ProceduralToolkit', () => {
  describe('ensureNonIndexed', () => {
    it('returns a clone and deletes uv attribute if geometry is already non-indexed', () => {
      const geo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0
      ]);
      const uvs = new Float32Array([
        0, 0,
        1, 0,
        0, 1
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      expect(geo.index).toBeNull();
      expect(geo.hasAttribute('uv')).toBe(true);

      const result = ensureNonIndexed(geo);
      expect(result).not.toBe(geo); // Should be a new instance (clone)
      expect(result.index).toBeNull();
      expect(result.hasAttribute('uv')).toBe(false);
      expect(result.getAttribute('position')).toBeDefined();
    });

    it('converts indexed geometry to non-indexed and deletes uv attribute', () => {
      const geo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0
      ]);
      const uvs = new Float32Array([
        0, 0,
        1, 0,
        0, 1
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex([0, 1, 2]);

      expect(geo.index).not.toBeNull();
      expect(geo.hasAttribute('uv')).toBe(true);

      const result = ensureNonIndexed(geo);
      expect(result).not.toBe(geo);
      expect(result.index).toBeNull();
      expect(result.hasAttribute('uv')).toBe(false);
      expect(result.getAttribute('position')).toBeDefined();
    });
  });

  describe('addVertexColor', () => {
    it('adds color attribute matching specified hex color to all vertices', () => {
      const geo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

      expect(geo.hasAttribute('color')).toBe(false);

      const colorHex = 0xff0088;
      const expectedColor = new THREE.Color(colorHex);

      addVertexColor(geo, colorHex);

      expect(geo.hasAttribute('color')).toBe(true);
      const colorAttr = geo.getAttribute('color');
      expect(colorAttr.count).toBe(3);

      for (let i = 0; i < colorAttr.count; i++) {
        expect(colorAttr.getX(i)).toBeCloseTo(expectedColor.r);
        expect(colorAttr.getY(i)).toBeCloseTo(expectedColor.g);
        expect(colorAttr.getZ(i)).toBeCloseTo(expectedColor.b);
      }
    });

    it('does nothing if the geometry has no position attribute', () => {
      const geo = new THREE.BufferGeometry();
      addVertexColor(geo, 0xffffff);
      expect(geo.hasAttribute('color')).toBe(false);
    });
  });
});
