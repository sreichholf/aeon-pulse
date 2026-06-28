import { describe, expect, it, vi } from 'vitest';
import { DifficultyMode, WeaponTier } from '../types.ts';
import { Player } from './Player.ts';

function createPlayer(overrides: {
  mode?: DifficultyMode;
  sink?: { setWeaponTier: ReturnType<typeof vi.fn> } | null;
} = {}) {
  const scene = { add: () => {}, remove: () => {} };
  const input = { isDown: () => false, wasJustPressed: () => false };
  const audio = { play: () => {}, startChargeHum: () => {}, stopChargeHum: () => {} };
  const projectileFactory = () => ({}) as any;

  return new Player(
    scene as any,
    {},
    input as any,
    audio as any,
    projectileFactory,
    overrides.mode ?? DifficultyMode.ACE,
    false,
    null,
    overrides.sink ?? null,
  );
}

describe('Player weapon-tier sink', () => {
  it('writes setWeapon through to the sink', () => {
    const sink = { setWeaponTier: vi.fn() };
    const player = createPlayer({ sink });

    player.setWeapon(WeaponTier.SPREAD);

    expect(sink.setWeaponTier).toHaveBeenCalledWith(WeaponTier.SPREAD);
  });

  it('writes upgradeWeapon through to the sink', () => {
    const sink = { setWeaponTier: vi.fn() };
    const player = createPlayer({ sink });

    player.upgradeWeapon();

    expect(sink.setWeaponTier).toHaveBeenCalledWith(WeaponTier.TWIN);
  });

  it('writes applyDeathPenalty through to the sink for non-ROOKIE mode', () => {
    const sink = { setWeaponTier: vi.fn() };
    const player = createPlayer({ mode: DifficultyMode.ACE, sink });

    player.applyDeathPenalty();

    expect(sink.setWeaponTier).toHaveBeenCalledWith(WeaponTier.RAPID);
  });

  it('does not write applyDeathPenalty through to the sink for ROOKIE mode', () => {
    const sink = { setWeaponTier: vi.fn() };
    const player = createPlayer({ mode: DifficultyMode.ROOKIE, sink });

    player.applyDeathPenalty();

    expect(sink.setWeaponTier).not.toHaveBeenCalled();
  });

  it('does not throw when no sink is provided', () => {
    const player = createPlayer();

    expect(() => player.setWeapon(WeaponTier.SPREAD)).not.toThrow();
    expect(() => player.upgradeWeapon()).not.toThrow();
    expect(() => player.applyDeathPenalty()).not.toThrow();
  });
});
