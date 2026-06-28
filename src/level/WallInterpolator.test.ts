import { describe, expect, it } from 'vitest';
import { interpolateWalls, type TerrainPoint } from './WallInterpolator.ts';
import { GAME_HEIGHT } from '../constants.ts';

describe('interpolateWalls', () => {
  const points: TerrainPoint[] = [
    { at: 0, top: 100, bottom: -100 },
    { at: 500, top: 150, bottom: -120 },
    { at: 1000, top: 100, bottom: -100 },
  ];

  it('returns full open playfield for empty points', () => {
    expect(interpolateWalls([], 500)).toEqual({ top: GAME_HEIGHT / 2, bottom: -GAME_HEIGHT / 2 });
  });

  it('returns the single point walls for all scrollX when only one point exists', () => {
    const single: TerrainPoint[] = [{ at: 500, top: 200, bottom: -200 }];
    expect(interpolateWalls(single, 0)).toEqual({ top: 200, bottom: -200 });
    expect(interpolateWalls(single, 500)).toEqual({ top: 200, bottom: -200 });
    expect(interpolateWalls(single, 9999)).toEqual({ top: 200, bottom: -200 });
  });

  it('clamps to the first point before the first control point', () => {
    expect(interpolateWalls(points, -100)).toEqual({ top: 100, bottom: -100 });
  });

  it('clamps to the last point after the last control point', () => {
    expect(interpolateWalls(points, 1200)).toEqual({ top: 100, bottom: -100 });
  });

  it('returns exact walls when scrollX is exactly at a control point', () => {
    expect(interpolateWalls(points, 0)).toEqual({ top: 100, bottom: -100 });
    expect(interpolateWalls(points, 500)).toEqual({ top: 150, bottom: -120 });
    expect(interpolateWalls(points, 1000)).toEqual({ top: 100, bottom: -100 });
  });

  it('interpolates linearly at the first segment midpoint', () => {
    const walls = interpolateWalls(points, 250);
    expect(walls.top).toBeCloseTo(125);
    expect(walls.bottom).toBeCloseTo(-110);
  });

  it('interpolates linearly at the second segment midpoint', () => {
    const walls = interpolateWalls(points, 750);
    expect(walls.top).toBeCloseTo(125);
    expect(walls.bottom).toBeCloseTo(-110);
  });
});
