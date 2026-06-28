import { describe, expect, it } from 'vitest';

import { CHAPTER_1_PLAYFIELD_BOUNDS } from '../level/PlayfieldBounds.ts';
import { PropCollisionShape } from '../types.ts';
import {
  displaceSpawnYFromSolidProps,
  overlapsSolidProp,
  resolveSolidPropBodyPosition,
  validateSolidPropPlacement,
} from './SolidPropPhysicality.ts';

describe('SolidPropPhysicality', () => {
  it('uses exact circle-vs-AABB overlap for solid prop checks', () => {
    const circle = { shape: PropCollisionShape.CIRCLE, x: 0, y: 0, radius: 10 } as const;

    expect(overlapsSolidProp(circle, { x: 10, y: 10, hw: 1, hh: 1 })).toBe(false);
    expect(overlapsSolidProp(circle, { x: 9, y: 0, hw: 1, hh: 1 })).toBe(true);
  });

  it('displaces spawn Y out of alive solid props and reclamps to the corridor', () => {
    const nextY = displaceSpawnYFromSolidProps(
      400,
      0,
      16,
      16,
      [{ shape: PropCollisionShape.BOX, x: 400, y: 0, hw: 30, hh: 30 }],
      CHAPTER_1_PLAYFIELD_BOUNDS,
    );

    expect(Math.abs(nextY)).toBeGreaterThanOrEqual(30 + 16);
  });

  it('validates corridor overlap and full-gate mismatches for solid props', () => {
    const issues = validateSolidPropPlacement(
      {
        propType: 'testSolid',
        isFullGate: false,
        x: 0,
        y: 0,
        hw: 10,
        hh: CHAPTER_1_PLAYFIELD_BOUNDS.top + 10,
        getSolidBounds: () => ({
          shape: PropCollisionShape.BOX,
          x: 0,
          y: 0,
          hw: 10,
          hh: CHAPTER_1_PLAYFIELD_BOUNDS.top + 10,
        }),
      },
      360,
      CHAPTER_1_PLAYFIELD_BOUNDS,
    );

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.join(' ')).toContain('overlaps the corridor walls');
  });

  it('pushes a collidable out of a solid prop without moving non-overlapping bodies', () => {
    const bounds = { shape: PropCollisionShape.BOX, x: 0, y: 0, hw: 10, hh: 10 } as const;

    expect(resolveSolidPropBodyPosition(bounds, { x: 5, y: 0, hw: 4, hh: 4 })).toEqual({ x: 14.5, y: 0 });
    expect(resolveSolidPropBodyPosition(bounds, { x: 40, y: 0, hw: 4, hh: 4 })).toEqual({ x: 40, y: 0 });
  });
});
