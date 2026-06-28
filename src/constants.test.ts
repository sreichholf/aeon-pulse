import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClampedRuntimeFlagInteger, getRuntimeFlagValue, isBrowserTestAudioSuppressedByDefault, isRuntimeFlagEnabled } from './constants.ts';

describe('runtime flags', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads raw runtime flag values from the browser query string', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?testAudio=off&renderStats=1',
      },
    });

    expect(getRuntimeFlagValue('testAudio')).toBe('off');
    expect(getRuntimeFlagValue('renderStats')).toBe('1');
    expect(getRuntimeFlagValue('missing')).toBeNull();
  });

  it('falls back when a boolean runtime flag is absent', () => {
    vi.stubGlobal('window', {
      location: {
        search: '',
      },
    });

    expect(isRuntimeFlagEnabled('renderStats', true)).toBe(true);
    expect(isRuntimeFlagEnabled('renderStats', false)).toBe(false);
  });

  it('treats testAudio=off as browser test audio suppression', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?testAudio=off',
      },
    });

    expect(isBrowserTestAudioSuppressedByDefault()).toBe(true);
  });

  it('does not suppress browser test audio for ordinary runs', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?testAudio=on',
      },
    });

    expect(isBrowserTestAudioSuppressedByDefault()).toBe(false);
  });

  it('parses and clamps integer runtime flags', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?weaponTier=9&level=4-3&badTier=abc&negativeTier=-2',
      },
    });

    expect(getClampedRuntimeFlagInteger('weaponTier', 1, 5)).toBe(5);
    expect(getClampedRuntimeFlagInteger('negativeTier', 1, 5)).toBe(1);
    expect(getClampedRuntimeFlagInteger('badTier', 1, 5)).toBeNull();
    expect(getClampedRuntimeFlagInteger('missingTier', 1, 5)).toBeNull();
  });
});
