import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createHeartseerModelInstance, getHeartseerSocketLayout } from './HeartseerModel.ts';

describe('HeartseerModel', () => {
  it('normalizes replacement assets so their y-axis bounds equal the target visual height', () => {
    const source = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(190, 83.6884022649, 74.5069069617),
      new THREE.MeshBasicMaterial(),
    );
    source.add(mesh);

    const instance = createHeartseerModelInstance(source);
    const bounds = new THREE.Box3().setFromObject(instance.root);
    const size = new THREE.Vector3();
    bounds.getSize(size);

    // The visual height (y-axis) is pinned to HEARTSEER_TARGET_VISUAL_HEIGHT (150).
    expect(size.y).toBeCloseTo(150, 5);
  });

  it('derives left-facing synthetic sockets from the replacement model bounds', () => {
    const layout = getHeartseerSocketLayout(new THREE.Vector3(1.8992479, 0.8368840, 0.7450691));

    expect(layout.heart.x).toBeGreaterThan(layout.core.x);
    expect(layout.heart.x).toBeGreaterThan(layout.minionUpper.x);
    expect(layout.heart.y).toBeGreaterThanOrEqual(layout.core.y);
    expect(Math.abs(layout.heart.x)).toBeLessThan(Math.abs(layout.core.x));
    expect(layout.core.x).toBeLessThan(0);
    expect(layout.muzzleUpper.x).toBeLessThan(layout.core.x);
    expect(layout.muzzleLower.x).toBeLessThan(layout.core.x);
    expect(layout.muzzleUpper.y).toBeGreaterThan(layout.muzzleLower.y);
    expect(layout.minionUpper.x).toBeLessThan(layout.heart.x);
    expect(layout.minionLower.x).toBeLessThan(layout.heart.x);
    expect(layout.minionUpper.y).toBeGreaterThan(layout.minionLower.y);
    expect(layout.heart.z).toBe(0);
    expect(layout.core.z).toBe(0);
  });
});
