import { describe, expect, it, vi } from 'vitest';
import { ProceduralResourceCache } from './ProceduralToolkit.ts';

describe('ProceduralResourceCache', () => {
  it('only runs the build function once when init is called twice', () => {
    const build = vi.fn(() => ({ foo: 'bar', count: 1 }));
    const cache = new ProceduralResourceCache<{ foo: string; count: number }>();

    cache.init(build);
    cache.init(build);

    expect(build).toHaveBeenCalledTimes(1);
    expect(cache.resources).toEqual({ foo: 'bar', count: 1 });
  });

  it('returns the built object from resources after init', () => {
    const resources = { a: 1, b: 'two' };
    const cache = new ProceduralResourceCache<typeof resources>();

    cache.init(() => resources);

    expect(cache.resources).toBe(resources);
  });

  it('reports initialized as false before init and true after init', () => {
    const cache = new ProceduralResourceCache<{ value: boolean }>();

    expect(cache.initialized).toBe(false);

    cache.init(() => ({ value: true }));

    expect(cache.initialized).toBe(true);
  });

  it('does not expose resources before init', () => {
    const cache = new ProceduralResourceCache<{ value: boolean }>();

    expect(cache.initialized).toBe(false);
    expect(cache.resources).toBeNull();
  });
});
