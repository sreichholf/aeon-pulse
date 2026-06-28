import { BulletType, ProjectileSourceKey, WeaponTier, type ProjectileSpawn, type WeaponTierValue } from '../types.ts';
export { WeaponTier, type WeaponTierValue };

export interface WeaponHardpoints {
  nose: { x: number; y: number };
  leftWing: { x: number; y: number };
  rightWing: { x: number; y: number };
}

export function getTapFireCooldown(tier: WeaponTierValue): number {
  switch (tier) {
    case WeaponTier.RAPID:
      return 0.08;
    case WeaponTier.TWIN:
      return 0.10;
    case WeaponTier.SPREAD:
      return 0.12;
    case WeaponTier.WAVE:
    case WeaponTier.PLASMA:
    default:
      return 0.14;
  }
}

export function planTapFire(tier: WeaponTierValue, hardpoints: WeaponHardpoints): ProjectileSpawn[] {
  const { nose, leftWing, rightWing } = hardpoints;

  switch (tier) {
    case WeaponTier.RAPID:
      return [spawn(BulletType.PLAYER, nose.x, nose.y, 600, 0, 0x00ffff)];
    case WeaponTier.TWIN:
      return [
        spawn(BulletType.PLAYER, leftWing.x, leftWing.y, 600, 0, 0xffd700),
        spawn(BulletType.PLAYER, rightWing.x, rightWing.y, 600, 0, 0xffd700),
      ];
    case WeaponTier.SPREAD:
      return [
        spawn(BulletType.PLAYER, nose.x, nose.y, 520, 0, 0xffffff),
        spawn(BulletType.PLAYER, leftWing.x, leftWing.y, 483, 129, 0xffffff),
        spawn(BulletType.PLAYER, rightWing.x, rightWing.y, 483, -129, 0xffffff),
      ];
    case WeaponTier.WAVE:
      return [spawn(BulletType.PLAYER_WAVE, nose.x, nose.y, 500, 0, 0xff00ff, 2)];
    case WeaponTier.PLASMA:
    default:
      return [
        spawn(BulletType.PLAYER_WAVE, nose.x, nose.y, 500, 0, 0x00ffd5, 2),
        spawn(BulletType.PLAYER, leftWing.x, leftWing.y, 510, 137, 0x00ffd5),
        spawn(BulletType.PLAYER, rightWing.x, rightWing.y, 510, -137, 0x00ffd5),
      ];
  }
}

export function planChargedFire(tier: WeaponTierValue, hardpoints: WeaponHardpoints): ProjectileSpawn[] {
  const { nose, leftWing, rightWing } = hardpoints;

  switch (tier) {
    case WeaponTier.RAPID:
      return [spawn(BulletType.PLAYER_CHARGE, nose.x, nose.y, 700, 0, 0xffd700)];
    case WeaponTier.TWIN:
      return [
        spawn(BulletType.PLAYER_CHARGE, leftWing.x, leftWing.y, 700, 0, 0xffd700),
        spawn(BulletType.PLAYER_CHARGE, rightWing.x, rightWing.y, 700, 0, 0xffd700),
      ];
    case WeaponTier.SPREAD:
      return [
        spawn(BulletType.PLAYER_CHARGE, nose.x, nose.y, 620, 0, 0xffd700),
        spawn(BulletType.PLAYER_CHARGE, leftWing.x, leftWing.y, 580, 155, 0xffd700),
        spawn(BulletType.PLAYER_CHARGE, rightWing.x, rightWing.y, 580, -155, 0xffd700),
      ];
    case WeaponTier.WAVE:
      return [
        spawn(BulletType.PLAYER_WAVE, nose.x, nose.y, 480, 0, 0xff00ff),
        spawn(BulletType.PLAYER_WAVE, leftWing.x, leftWing.y, 440, 180, 0xff00ff),
        spawn(BulletType.PLAYER_WAVE, rightWing.x, rightWing.y, 440, -180, 0xff00ff),
      ];
    case WeaponTier.PLASMA:
    default:
      return [
        spawn(BulletType.PLAYER_PLASMA, nose.x, nose.y, 550, 0, null, 2),
        spawn(ProjectileSourceKey.PLAYER_CHARGE_SIDE, leftWing.x, leftWing.y, 553, 148, 0x00ffd5),
        spawn(ProjectileSourceKey.PLAYER_CHARGE_SIDE, rightWing.x, rightWing.y, 553, -148, 0x00ffd5),
      ];
  }
}

function spawn(
  type: BulletType | ProjectileSourceKey,
  x: number,
  y: number,
  vx: number,
  vy: number,
  tint: number | null = null,
  damageOverride: number | null = null,
): ProjectileSpawn {
  return {
    type,
    x,
    y,
    vx,
    vy,
    getTargetPos: null,
    tint,
    damageOverride,
  };
}
