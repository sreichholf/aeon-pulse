import { describe, expect, it } from 'vitest';
import { EnemyType } from '../../types.ts';
import type { CorridorResolver } from '../CorridorResolver.ts';
import { SPAWN_X, rowRel, vFormRel, clusterRel, type RelativeOffset } from './helpers.ts';
import { swarmMatrixBeat } from './chapter0.ts';
import { Timeline } from './Timeline.ts';
import { buildChapter2Waves } from './chapter2.ts';

function trackingResolver(queried: number[]): CorridorResolver {
  return {
    getBoundsAt: () => ({ top: 200, bottom: -200 }),
    getSafeSpawnY: (_type, scrollX, _coord) => {
      queried.push(scrollX);
      return 0;
    },
  };
}

describe('Corridor spawn scrollX offset', () => {
  it('rowRel passes at + SPAWN_X + i * xSpacing to getSafeSpawnY', () => {
    const queried: number[] = [];
    const resolver = trackingResolver(queried);
    const at = 1000;
    const events = rowRel(resolver, EnemyType.STRAIGHT, at, 3, 0, 0);
    const xSpacing = 88;
    const expected = [0, 1, 2].map((i) => at + SPAWN_X + i * xSpacing);
    expect(events).toHaveLength(3);
    expect(queried).toEqual(expected);
  });

  it('rowRel single-enemy branch passes at + SPAWN_X', () => {
    const queried: number[] = [];
    const resolver = trackingResolver(queried);
    const at = 1000;
    rowRel(resolver, EnemyType.STRAIGHT, at, 1, 0, 0);
    expect(queried).toEqual([at + SPAWN_X]);
  });

  it('vFormRel passes at + SPAWN_X + |i-mid| * xSpacing to getSafeSpawnY', () => {
    const queried: number[] = [];
    const resolver = trackingResolver(queried);
    const at = 1000;
    vFormRel(resolver, EnemyType.DIVER, at, 3, 0.2);
    const xSpacing = 52;
    const mid = 1;
    const expected = [0, 1, 2].map((i) => at + SPAWN_X + Math.abs(i - mid) * xSpacing);
    expect(queried).toEqual(expected);
  });

  it('clusterRel passes at + SPAWN_X + dx + cx to getSafeSpawnY', () => {
    const queried: number[] = [];
    const resolver = trackingResolver(queried);
    const at = 1000;
    const offsets: RelativeOffset[] = [
      { dx: 10, dy: 0 },
      { dx: 70, dy: 0 },
    ];
    clusterRel(resolver, EnemyType.SWARM, at, offsets, 0.5, 0);
    const cx = 0.5 * 200;
    const expected = offsets.map(({ dx }) => at + SPAWN_X + dx + cx);
    expect(queried).toEqual(expected);
  });

  it('chapter2 builder never passes the bare wave-trigger at to getSafeSpawnY', () => {
    const queried: number[] = [];
    const resolver = trackingResolver(queried);
    const waves = buildChapter2Waves('2-1', resolver);

    expect(waves.length).toBeGreaterThan(0);
    expect(queried.length).toBeGreaterThan(0);

    const waveAts = new Set(waves.map((w) => w.at));
    for (const sx of queried) {
      expect(sx).toBeGreaterThanOrEqual(SPAWN_X);
      expect(waveAts.has(sx)).toBe(false);
    }

    const minAt = Math.min(...waves.map((w) => w.at));
    expect(Math.min(...queried)).toBeGreaterThanOrEqual(minAt + SPAWN_X);

    const firstAt = waves[0]!.at;
    expect(queried).toContain(firstAt + SPAWN_X);
  });

  it('swarmMatrixBeat passes at + x (custom screen X, not SPAWN_X) to getSafeSpawnY', () => {
    const queried: number[] = [];
    const resolver = trackingResolver(queried);

    const timeline = new Timeline<'start'>(1.0)
      .anchor('start', 0)
      .add('start', 200, swarmMatrixBeat(2, 2, 1000, 60, 30, 0));
    const waves = timeline.build(resolver);

    expect(waves).toHaveLength(1);
    const at = 200;
    const xs = [1000, 1060];
    const expected = [at + xs[0]!, at + xs[0]!, at + xs[1]!, at + xs[1]!];
    expect(queried).toEqual(expected);
    for (const sx of queried) {
      expect(sx).toBeGreaterThanOrEqual(at + 1000);
      expect(sx).not.toBe(at + SPAWN_X);
    }
  });
});