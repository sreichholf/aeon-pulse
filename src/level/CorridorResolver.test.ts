import { describe, expect, it } from 'vitest';
import { createCorridorResolver, type CorridorResolverInput } from './CorridorResolver.ts';
import type { SectorTerrainPoint } from './sectors/Sectors.ts';
import { EnemyType } from '../types.ts';

function resolverWith(
  overrides: Partial<Pick<CorridorResolverInput, 'playfieldMargins' | 'playfieldBounds' | 'terrainPointScale'>> & {
    terrainPoints: readonly SectorTerrainPoint[];
  },
) {
  return createCorridorResolver({
    terrainPoints: overrides.terrainPoints,
    playfieldMargins: overrides.playfieldMargins ?? null,
    playfieldBounds: overrides.playfieldBounds ?? null,
    terrainPointScale: overrides.terrainPointScale ?? 1,
  });
}

describe('createCorridorResolver', () => {
  describe('getBoundsAt', () => {
    it('interpolates linearly between terrain points', () => {
      const resolver = resolverWith({
        terrainPoints: [
          { at: 0, top: 200, bottom: -200 },
          { at: 1000, top: 100, bottom: -100 },
        ],
      });

      const mid = resolver.getBoundsAt(500);
      expect(mid.top).toBeCloseTo(150, 5);
      expect(mid.bottom).toBeCloseTo(-150, 5);
    });

    it('clamps to the first point before the start and to the last point after the end', () => {
      const resolver = resolverWith({
        terrainPoints: [
          { at: 0, top: 200, bottom: -200 },
          { at: 1000, top: 100, bottom: -100 },
        ],
      });

      expect(resolver.getBoundsAt(-500)).toEqual({ top: 200, bottom: -200 });
      expect(resolver.getBoundsAt(1500)).toEqual({ top: 100, bottom: -100 });
    });

    it('applies playfield margins to the terrain walls', () => {
      const resolver = resolverWith({
        terrainPoints: [{ at: 0, top: 300, bottom: -300 }],
        playfieldMargins: { top: 40, bottom: 60 },
      });

      expect(resolver.getBoundsAt(0)).toEqual({ top: 260, bottom: -240 });
    });

    it('falls back to playfieldBounds composed with margins when there are no terrain points', () => {
      const resolver = resolverWith({
        terrainPoints: [],
        playfieldBounds: { top: 250, bottom: -250 },
        playfieldMargins: { top: 20, bottom: 30 },
      });

      expect(resolver.getBoundsAt(1234)).toEqual({ top: 230, bottom: -220 });
    });

    it('does not crash and returns the single point when given exactly one terrain point (regression: single-point lerp crash)', () => {
      const resolver = resolverWith({
        terrainPoints: [{ at: 500, top: 180, bottom: -180 }],
      });

      // scrollX not equal to the lone point's `at` previously indexed past the end and crashed.
      expect(resolver.getBoundsAt(0)).toEqual({ top: 180, bottom: -180 });
      expect(resolver.getBoundsAt(9999)).toEqual({ top: 180, bottom: -180 });
    });

    it('scales terrain `at` positions by terrainPointScale', () => {
      const resolver = resolverWith({
        terrainPoints: [
          { at: 0, top: 200, bottom: -200 },
          { at: 1000, top: 100, bottom: -100 },
        ],
        terrainPointScale: 0.5,
      });

      // After scaling, points sit at 0 and 500; querying at 250 hits the midpoint.
      const mid = resolver.getBoundsAt(250);
      expect(mid.top).toBeCloseTo(150, 5);
      expect(mid.bottom).toBeCloseTo(-150, 5);
    });
  });

  describe('getSafeSpawnY', () => {
    it('maps coord -1..1 to the usable band symmetric about 0', () => {
      const resolver = resolverWith({
        terrainPoints: [{ at: 0, top: 200, bottom: -200 }],
      });

      expect(resolver.getSafeSpawnY(EnemyType.STRAIGHT, 0, 0)).toBe(0);
      expect(resolver.getSafeSpawnY(EnemyType.STRAIGHT, 0, 1)).toBe(200);
      expect(resolver.getSafeSpawnY(EnemyType.STRAIGHT, 0, -1)).toBe(-200);
      expect(resolver.getSafeSpawnY(EnemyType.STRAIGHT, 0, 0.5)).toBeCloseTo(100, 5);
    });

    it('shrinks the usable band by the enemy movement envelope', () => {
      // EnemySine has a non-zero movement envelope in the catalog (amplitude 35).
      const resolver = resolverWith({
        terrainPoints: [{ at: 0, top: 200, bottom: -200 }],
      });

      const straightTop = resolver.getSafeSpawnY(EnemyType.STRAIGHT, 0, 1);
      const sineTop = resolver.getSafeSpawnY(EnemyType.SINE, 0, 1);
      expect(sineTop).toBeLessThan(straightTop);
    });

    it('returns 0 when the usable band collapses (envelope exceeds corridor)', () => {
      const resolver = resolverWith({
        terrainPoints: [{ at: 0, top: 10, bottom: -10 }],
      });

      // Corridor half-height 10 minus SINE envelope 35 => usableHeight <= 0.
      expect(resolver.getSafeSpawnY(EnemyType.SINE, 0, 1)).toBe(0);
    });
  });

  describe('input contract', () => {
    it('accepts a CorridorResolverInput without requiring factory stubs (regression: as-unknown cast)', () => {
      // If createCorridorResolver is typed against the full ResolvedLevelContent, passing only
      // the corridor facts would require a cast. This test pins the narrow Pick<...> input type.
      const input: CorridorResolverInput = {
        terrainPoints: [{ at: 0, top: 200, bottom: -200 }],
        playfieldMargins: null,
        playfieldBounds: null,
        terrainPointScale: 1,
      };

      const resolver = createCorridorResolver(input);
      expect(resolver.getBoundsAt(0)).toEqual({ top: 200, bottom: -200 });
    });
  });
});