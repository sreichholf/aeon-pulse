import { describe, expect, it } from 'vitest';
import { buildScorchedPlateGeometry } from './Background4.ts';

describe('buildScorchedPlateGeometry', () => {
  it('builds merge-compatible geometry for the ashFalls sector landmark', () => {
    const geometry = buildScorchedPlateGeometry();

    expect(geometry).toBeTruthy();
    expect(geometry.getAttribute('position')).toBeTruthy();
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);

    geometry.dispose();
  });
});
