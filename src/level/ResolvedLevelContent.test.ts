import { describe, expect, it } from 'vitest';

import { getCampaignLevel } from '../campaign/Campaign.ts';
import { resolveLevelContent } from './ResolvedLevelContent.ts';

describe('resolveLevelContent', () => {
  it('resolves waves, props, terrain, and corridor data for a level once', () => {
    const content = resolveLevelContent(getCampaignLevel('4-4'));

    expect(content.level.id).toBe('4-4');
    expect(content.scrollSpeed).toBe(140);
    expect(content.bossAt).toBe(7300);
    expect(content.waves.length).toBeGreaterThan(0);
    expect(content.propLayout.length).toBeGreaterThan(0);
    expect(content.terrainPoints.length).toBeGreaterThan(0);
    expect(content.playfieldMargins).toBeDefined();
    expect(content.backgroundConfig?.sectorKey).toBe('ashFalls');
  });

  it('keeps chapter playfield bounds for open chapters and no terrain factory', () => {
    const content = resolveLevelContent(getCampaignLevel('1-1'));

    expect(content.playfieldBounds).not.toBeNull();
    expect(content.terrainPoints).toEqual([]);
    expect(content.createTerrain({} as never)).toBeNull();
  });
});
