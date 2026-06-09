import { describe, expect, it, vi } from 'vitest';
import { Terrain } from './Terrain.ts';
import { Terrain3 } from './Terrain3.ts';
import { Terrain4 } from './Terrain4.ts';
import type { IScene } from '../types.ts';

// Helper to create a minimal mock scene that Three.js and our terrains can use
function createMockScene(): IScene {
  return {
    camera: {
      position: {
        set: vi.fn(),
      },
    } as any,
    add: vi.fn(),
    remove: vi.fn(),
    flash: vi.fn(),
  };
}

describe('Terrain Classes Wall Queries', () => {
  const points = [
    { at: 0, top: 100, bottom: -100 },
    { at: 500, top: 150, bottom: -120 },
    { at: 1000, top: 100, bottom: -100 },
  ];

  describe('Terrain (Chapter 1/2)', () => {
    it('interpolates walls and getActualWallsAt returns the same boundaries as getWallsAt', () => {
      const scene = createMockScene();
      const terrain = new Terrain(scene, points);

      // Start of points
      const wallsStart = terrain.getWallsAt(0);
      expect(wallsStart).toEqual({ top: 100, bottom: -100 });
      expect(terrain.getActualWallsAt(0)).toEqual(wallsStart);

      // Interpolated point
      const wallsMid = terrain.getWallsAt(250);
      expect(wallsMid.top).toBeCloseTo(125);
      expect(wallsMid.bottom).toBeCloseTo(-110);
      expect(terrain.getActualWallsAt(250)).toEqual(wallsMid);

      // Beyond last point
      const wallsEnd = terrain.getWallsAt(1200);
      expect(wallsEnd).toEqual({ top: 100, bottom: -100 });
      expect(terrain.getActualWallsAt(1200)).toEqual(wallsEnd);
    });
  });

  describe('Terrain3 (Chapter 3)', () => {
    it('interpolates walls and getActualWallsAt returns the same boundaries as getWallsAt', () => {
      const scene = createMockScene();
      const terrain = new Terrain3(scene, points);

      const wallsMid = terrain.getWallsAt(250);
      expect(wallsMid.top).toBeCloseTo(125);
      expect(wallsMid.bottom).toBeCloseTo(-110);
      expect(terrain.getActualWallsAt(250)).toEqual(wallsMid);
    });
  });

  describe('Terrain4 (Chapter 4 Volcanic)', () => {
    it('interpolates walls and applies volcanic pulse offset', () => {
      const scene = createMockScene();
      const terrain = new Terrain4(scene, points);

      const wallsBase = terrain.getWallsAt(250);
      expect(wallsBase.top).toBeCloseTo(125);
      // No pulse yet, offset is 0
      expect(wallsBase.bottom).toBeCloseTo(-110);

      // Trigger lava pulse and step time
      terrain.triggerLavaPulse();
      // Update by 1.5 seconds (rise time)
      terrain.update(250, 1.5);

      const wallsPulsed = terrain.getWallsAt(250);
      // bottom boundary should have risen by PULSE_MAX_OFFSET (60px)
      expect(wallsPulsed.bottom).toBeCloseTo(-110 + 60);
    });

    it('clamps getActualWallsAt to be more restrictive when column/crystal obstacles overlap', () => {
      const scene = createMockScene();
      const terrain = new Terrain4(scene, points);

      const baseWalls = terrain.getWallsAt(250);
      const actualWalls = terrain.getActualWallsAt(250);

      // Since actual walls account for columns, actualTop should be <= base top, and actualBottom should be >= base bottom
      expect(actualWalls.top).toBeLessThanOrEqual(baseWalls.top);
      expect(actualWalls.bottom).toBeGreaterThanOrEqual(baseWalls.bottom);
    });
  });
});
