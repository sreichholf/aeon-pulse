import { describe, expect, it } from 'vitest';

import { BulletType, ProjectileSourceKey } from '../types.ts';
import {
  WeaponTier,
  getTapFireCooldown,
  planChargedFire,
  planTapFire,
  type WeaponHardpoints,
} from './WeaponTier.ts';

const hardpoints: WeaponHardpoints = {
  nose: { x: 10, y: 1 },
  leftWing: { x: 2, y: 3 },
  rightWing: { x: 2, y: -3 },
};

describe('WeaponTier policy', () => {
  it('returns the authored tap-fire cooldown per tier', () => {
    expect(getTapFireCooldown(WeaponTier.RAPID)).toBe(0.08);
    expect(getTapFireCooldown(WeaponTier.TWIN)).toBe(0.10);
    expect(getTapFireCooldown(WeaponTier.SPREAD)).toBe(0.12);
    expect(getTapFireCooldown(WeaponTier.WAVE)).toBe(0.14);
    expect(getTapFireCooldown(WeaponTier.PLASMA)).toBe(0.14);
  });

  it('plans representative tap-fire patterns for every tier', () => {
    expect(planTapFire(WeaponTier.RAPID, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER, x: 10, y: 1, vx: 600, vy: 0, tint: 0x00ffff }),
    ]);

    expect(planTapFire(WeaponTier.TWIN, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER, x: 2, y: 3, vx: 600, vy: 0, tint: 0xffd700 }),
      expect.objectContaining({ type: BulletType.PLAYER, x: 2, y: -3, vx: 600, vy: 0, tint: 0xffd700 }),
    ]);

    expect(planTapFire(WeaponTier.SPREAD, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER, x: 10, y: 1, vx: 520, vy: 0, tint: 0xffffff }),
      expect.objectContaining({ type: BulletType.PLAYER, x: 2, y: 3, vx: 470, vy: 170, tint: 0xffffff }),
      expect.objectContaining({ type: BulletType.PLAYER, x: 2, y: -3, vx: 470, vy: -170, tint: 0xffffff }),
    ]);

    expect(planTapFire(WeaponTier.WAVE, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER_WAVE, x: 10, y: 1, vx: 500, vy: 0, tint: 0xff00ff, damageOverride: 2 }),
    ]);

    expect(planTapFire(WeaponTier.PLASMA, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER_WAVE, x: 10, y: 1, vx: 500, vy: 0, tint: 0x00ffd5, damageOverride: 2 }),
      expect.objectContaining({ type: BulletType.PLAYER, x: 2, y: 3, vx: 500, vy: 170, tint: 0x00ffd5 }),
      expect.objectContaining({ type: BulletType.PLAYER, x: 2, y: -3, vx: 500, vy: -170, tint: 0x00ffd5 }),
    ]);
  });

  it('plans representative charged-fire patterns for every tier', () => {
    expect(planChargedFire(WeaponTier.RAPID, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER_CHARGE, x: 10, y: 1, vx: 700, vy: 0, tint: 0xffd700 }),
    ]);

    expect(planChargedFire(WeaponTier.TWIN, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER_CHARGE, x: 2, y: 3, vx: 700, vy: 0, tint: 0xffd700 }),
      expect.objectContaining({ type: BulletType.PLAYER_CHARGE, x: 2, y: -3, vx: 700, vy: 0, tint: 0xffd700 }),
    ]);

    expect(planChargedFire(WeaponTier.SPREAD, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER_CHARGE, x: 10, y: 1, vx: 620, vy: 0, tint: 0xffd700 }),
      expect.objectContaining({ type: BulletType.PLAYER_CHARGE, x: 2, y: 3, vx: 560, vy: 210, tint: 0xffd700 }),
      expect.objectContaining({ type: BulletType.PLAYER_CHARGE, x: 2, y: -3, vx: 560, vy: -210, tint: 0xffd700 }),
    ]);

    expect(planChargedFire(WeaponTier.WAVE, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER_WAVE, x: 10, y: 1, vx: 480, vy: 0, tint: 0xff00ff }),
      expect.objectContaining({ type: BulletType.PLAYER_WAVE, x: 2, y: 3, vx: 440, vy: 180, tint: 0xff00ff }),
      expect.objectContaining({ type: BulletType.PLAYER_WAVE, x: 2, y: -3, vx: 440, vy: -180, tint: 0xff00ff }),
    ]);

    expect(planChargedFire(WeaponTier.PLASMA, hardpoints)).toEqual([
      expect.objectContaining({ type: BulletType.PLAYER_PLASMA, x: 10, y: 1, vx: 550, vy: 0, tint: null, damageOverride: 2 }),
      expect.objectContaining({ type: ProjectileSourceKey.PLAYER_CHARGE_SIDE, x: 2, y: 3, vx: 540, vy: 190, tint: 0x00ffd5 }),
      expect.objectContaining({ type: ProjectileSourceKey.PLAYER_CHARGE_SIDE, x: 2, y: -3, vx: 540, vy: -190, tint: 0x00ffd5 }),
    ]);
  });
});
