import { describe, expect, it, vi } from 'vitest';
import { LevelManager, LevelGameHost } from './LevelManager.ts';
import { getCampaignLevel } from '../campaign/Campaign.ts';
import { IBackgroundWithSpeed } from '../types.ts';

function createMockHost(overrides: Partial<LevelGameHost> = {}): LevelGameHost {
  return {
    background: null,
    handleStageEvent: vi.fn(),
    spawnBoss: vi.fn(),
    completeLevel: vi.fn(),
    isLevelClearGateOpen: vi.fn().mockReturnValue(false),
    ...overrides,
  };
}

describe('LevelManager', () => {
  it('starts at scrollX = 0 and updates the background baseSpeed on initialization', () => {
    const mockBg: IBackgroundWithSpeed = {
      baseSpeed: 0,
      update: vi.fn(),
      destroy: vi.fn(),
    };

    const host = createMockHost({ background: mockBg });
    const levelRecord = getCampaignLevel('1-1'); // scrollSpeed: 100
    const manager = new LevelManager(host, levelRecord);

    expect(manager.scrollX).toBe(0);
    expect(mockBg.baseSpeed).toBe(100);
  });

  it('advances scrollX on update() according to scroll speed and deltaTime', () => {
    const host = createMockHost();
    const levelRecord = getCampaignLevel('1-1'); // scrollSpeed: 100
    const manager = new LevelManager(host, levelRecord);

    manager.update(0.5); // 0.5 seconds * 100 speed = 50 units
    expect(manager.scrollX).toBe(50);

    manager.update(1.5); // 1.5 seconds * 100 speed = 150 units -> total 200 units
    expect(manager.scrollX).toBe(200);
  });

  it('spawns wave events sequentially when scrollX reaches wave positions', () => {
    const host = createMockHost();
    const levelRecord = getCampaignLevel('1-1'); // scrollSpeed: 100
    const manager = new LevelManager(host, levelRecord);

    // The first wave for level 1-1 is at 320.
    // Advance scrollX close to the first wave but not matching it.
    manager.update(3.19); // scrollX = 319
    expect(host.handleStageEvent).not.toHaveBeenCalled();

    // Advance scrollX to reach the first wave.
    manager.update(0.01); // scrollX = 320
    expect(host.handleStageEvent).toHaveBeenCalled();

    // Verify multiple events within that first wave are emitted.
    // The first wave is a straightRowBeat(4, 0, 220) which has 4 spawn events.
    expect(host.handleStageEvent).toHaveBeenCalledTimes(4);
  });

  it('triggers boss spawning on finale level once waves are cleared and scrollX >= bossAt', () => {
    const host = createMockHost();
    const levelRecord = getCampaignLevel('1-5'); // isFinale: true, archetype 1, bossAt: 11200
    const manager = new LevelManager(host, levelRecord);

    // Chapter 1-5 has its last wave at 10840.
    // Advance until we have spawned all waves (10840) but haven't reached bossAt (11200).
    manager.update(108.4); // scrollX = 10840
    expect(host.spawnBoss).not.toHaveBeenCalled();

    // Advance past bossAt.
    manager.update(3.6); // scrollX = 11200
    expect(host.spawnBoss).toHaveBeenCalledTimes(1);

    // Subsequent updates should not trigger another boss spawn.
    manager.update(1.0);
    expect(host.spawnBoss).toHaveBeenCalledTimes(1);
  });

  it('triggers level completion on non-finale level only when waves are cleared and clear gate is open', () => {
    let clearGateOpen = false;
    const host = createMockHost({
      isLevelClearGateOpen: () => clearGateOpen,
    });
    
    const levelRecord = getCampaignLevel('1-1'); // isFinale: false, scrollSpeed: 100, last wave: 7800
    const manager = new LevelManager(host, levelRecord);

    // Advance past the last wave (7800).
    manager.update(78.0); // scrollX = 7800
    
    // Clear gate is closed, should not complete.
    expect(host.completeLevel).not.toHaveBeenCalled();

    // Advance again while gate is closed.
    manager.update(1.0);
    expect(host.completeLevel).not.toHaveBeenCalled();

    // Open the clear gate and update.
    clearGateOpen = true;
    manager.update(0.1);
    expect(host.completeLevel).toHaveBeenCalledTimes(1);

    // Subsequent updates should not trigger completeLevel again.
    manager.update(1.0);
    expect(host.completeLevel).toHaveBeenCalledTimes(1);
  });
});
