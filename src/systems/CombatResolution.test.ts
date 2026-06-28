import { describe, expect, it, vi } from 'vitest';

import { CollisionContactKind, type CollisionContact } from './Collisions.ts';
import { HitCause, HitEventKind, resolveCollisionContacts, type HitEvent } from './CombatResolution.ts';
import { PropType, PropEffectKind, PropCollisionShape, type PropHitResult } from '../types.ts';

interface BulletFake {
  x: number;
  y: number;
  active: boolean;
  isPiercing: boolean;
  damage: number;
}

interface EnemyFake {
  x: number;
  y: number;
  isAlive: boolean;
  score: number;
  hit: ReturnType<typeof vi.fn>;
}

interface PlayerFake {
  x: number;
  y: number;
  hit: ReturnType<typeof vi.fn>;
}

interface BossFake {
  isDying: boolean;
  hit: ReturnType<typeof vi.fn>;
}

const bullet = (overrides: Partial<BulletFake> = {}): BulletFake => ({
  x: 10,
  y: 20,
  active: true,
  isPiercing: false,
  damage: 3,
  ...overrides,
});

const enemy = (overrides: Partial<EnemyFake> = {}): EnemyFake => ({
  x: 10,
  y: 20,
  isAlive: true,
  score: 150,
  hit: vi.fn(),
  ...overrides,
});

const player = (overrides: Partial<PlayerFake> = {}): PlayerFake => ({
  x: 30,
  y: 40,
  hit: vi.fn(),
  setPosition: vi.fn(),
  ...overrides,
});

const boss = (overrides: Partial<BossFake> = {}): BossFake => ({
  isDying: false,
  hit: vi.fn(),
  ...overrides,
});

interface PropFake {
  x: number;
  y: number;
  isAlive: boolean;
  propType: PropType;
  isSolid: boolean;
  collisionShape: PropCollisionShape;
  isFullGate: boolean;
  hit: ReturnType<typeof vi.fn>;
  getSolidBounds: ReturnType<typeof vi.fn>;
}

const propResult = (overrides: Partial<PropHitResult> = {}): PropHitResult => ({
  x: 10,
  y: 20,
  propType: PropType.CARGO_CANISTER,
  effects: [PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP],
  scoreValue: 250,
  dropPowerup: false,
  clearRadius: 120,
  hazardRadius: 0,
  hazardDuration: 0,
  ...overrides,
});

const prop = (overrides: Partial<PropFake> = {}): PropFake => ({
  x: 10,
  y: 20,
  isAlive: true,
  propType: PropType.CARGO_CANISTER,
  isSolid: false,
  collisionShape: PropCollisionShape.BOX,
  isFullGate: false,
  hit: vi.fn(),
  getSolidBounds: vi.fn(() => null),
  ...overrides,
});

const collect = (contacts: CollisionContact[]): HitEvent[] => {
  const events: HitEvent[] = [];
  resolveCollisionContacts(contacts, (event) => events.push(event));
  return events;
};

const asContact = (contact: unknown): CollisionContact => contact as CollisionContact;

describe('resolveCollisionContacts', () => {
  it('damages enemies, deactivates non-piercing bullets, and emits kill rewards', () => {
    const shot = bullet();
    const target = enemy({
      hit: vi.fn(() => ({ x: 12, y: 22, dropPowerup: true })),
    });

    const events = collect([
      asContact({ kind: CollisionContactKind.PLAYER_BULLET_ENEMY, bullet: shot, enemy: target }),
    ]);

    expect(target.hit).toHaveBeenCalledWith(3);
    expect(shot.active).toBe(false);
    expect(events).toEqual([
      {
        kind: HitEventKind.ENEMY_KILLED,
        x: 12,
        y: 22,
        score: 150,
        dropPowerup: true,
      },
    ]);
  });

  it('leaves piercing bullets active when an enemy survives', () => {
    const shot = bullet({ isPiercing: true });
    const target = enemy({ hit: vi.fn(() => null) });

    const events = collect([
      asContact({ kind: CollisionContactKind.PLAYER_BULLET_ENEMY, bullet: shot, enemy: target }),
    ]);

    expect(target.hit).toHaveBeenCalledWith(3);
    expect(shot.active).toBe(true);
    expect(events).toEqual([]);
  });

  it('emits boss hit events and consumes non-piercing bullets', () => {
    const shot = bullet({ x: 44, y: 55 });
    const target = boss();

    const events = collect([
      asContact({
        kind: CollisionContactKind.PLAYER_BULLET_BOSS,
        bullet: shot,
        boss: target,
        zone: { id: 'left-wing', x: 0, y: 0, hw: 5, hh: 5 },
      }),
    ]);

    expect(target.hit).toHaveBeenCalledWith(3, 'left-wing');
    expect(shot.active).toBe(false);
    expect(events).toEqual([{ kind: HitEventKind.BOSS_HIT, x: 44, y: 55 }]);
  });

  it('consumes enemy bullets even when a shielded player absorbs the hit', () => {
    const hostileShot = bullet();
    const target = player({ hit: vi.fn(() => false) });

    const events = collect([
      asContact({ kind: CollisionContactKind.ENEMY_BULLET_PLAYER, bullet: hostileShot, player: target }),
    ]);

    expect(target.hit).toHaveBeenCalledOnce();
    expect(hostileShot.active).toBe(false);
    expect(events).toEqual([]);
  });

  it('emits player hit events for unshielded enemy bullet hits', () => {
    const hostileShot = bullet();
    const target = player({ hit: vi.fn(() => true) });

    const events = collect([
      asContact({ kind: CollisionContactKind.ENEMY_BULLET_PLAYER, bullet: hostileShot, player: target }),
    ]);

    expect(events).toEqual([
      { kind: HitEventKind.PLAYER_HIT, cause: HitCause.BULLET, x: 30, y: 40 },
    ]);
  });

  it('resolves rams by hitting the player before destroying the enemy', () => {
    const calls: string[] = [];
    const target = player({
      hit: vi.fn(() => {
        calls.push('player');
        return true;
      }),
    });
    const rammer = enemy({
      hit: vi.fn(() => {
        calls.push('enemy');
        return { x: 10, y: 20, dropPowerup: false };
      }),
    });

    const events = collect([
      asContact({ kind: CollisionContactKind.ENEMY_RAM_PLAYER, enemy: rammer, player: target }),
    ]);

    expect(calls).toEqual(['player', 'enemy']);
    expect(rammer.hit).toHaveBeenCalledWith(999);
    expect(events).toEqual([
      { kind: HitEventKind.PLAYER_HIT, cause: HitCause.RAM, x: 30, y: 40 },
      {
        kind: HitEventKind.ENEMY_KILLED,
        x: 10,
        y: 20,
        score: 0,
        dropPowerup: false,
      },
    ]);
  });

  it('preserves contact-order semantics when an earlier contact changes later resolution', () => {
    const piercingShot = bullet({ isPiercing: true });
    const followUpShot = bullet({ x: 70, y: 80 });
    const sharedEnemy = enemy({
      hit: vi.fn(() => {
        sharedEnemy.isAlive = false;
        return { x: 10, y: 20, dropPowerup: false };
      }),
    });
    const targetBoss = boss();

    const events = collect([
      asContact({ kind: CollisionContactKind.PLAYER_BULLET_ENEMY, bullet: piercingShot, enemy: sharedEnemy }),
      asContact({ kind: CollisionContactKind.PLAYER_BULLET_ENEMY, bullet: followUpShot, enemy: sharedEnemy }),
      asContact({
        kind: CollisionContactKind.PLAYER_BULLET_BOSS,
        bullet: followUpShot,
        boss: targetBoss,
        zone: { id: 'core', x: 0, y: 0, hw: 5, hh: 5 },
      }),
    ]);

    expect(sharedEnemy.hit).toHaveBeenCalledOnce();
    expect(targetBoss.hit).toHaveBeenCalledWith(3, 'core');
    expect(followUpShot.active).toBe(false);
    expect(events).toEqual([
      {
        kind: HitEventKind.ENEMY_KILLED,
        x: 10,
        y: 20,
        score: 150,
        dropPowerup: false,
      },
      { kind: HitEventKind.BOSS_HIT, x: 70, y: 80 },
    ]);
  });

  it('destroys a prop on bullet hit and emits a PROP_DESTROYED event carrying the result', () => {
    const shot = bullet();
    const deathResult = propResult();
    const target = prop({ hit: vi.fn(() => deathResult) });

    const events = collect([
      asContact({ kind: CollisionContactKind.PLAYER_BULLET_PROP, bullet: shot, prop: target }),
    ]);

    expect(target.hit).toHaveBeenCalledWith(3);
    expect(shot.active).toBe(false);
    expect(events).toEqual([{ kind: HitEventKind.PROP_DESTROYED, result: deathResult }]);
  });

  it('deactivates the bullet but emits no event when a prop survives', () => {
    const shot = bullet();
    const target = prop({ hit: vi.fn(() => null) });

    const events = collect([
      asContact({ kind: CollisionContactKind.PLAYER_BULLET_PROP, bullet: shot, prop: target }),
    ]);

    expect(target.hit).toHaveBeenCalledWith(3);
    expect(shot.active).toBe(false);
    expect(events).toEqual([]);
  });

  it('hits the player, pushes them out, and emits PLAYER_HIT for solid prop contact', () => {
    const targetPlayer = player({ hit: vi.fn(() => true) });
    const targetProp = prop({
      isSolid: true,
      getSolidBounds: vi.fn(() => ({ shape: PropCollisionShape.BOX, x: 10, y: 20, hw: 12, hh: 12 })),
    });

    const events = collect([
      asContact({
        kind: CollisionContactKind.PLAYER_SOLID_PROP,
        player: targetPlayer,
        prop: targetProp,
      }),
    ]);

    expect(targetPlayer.hit).toHaveBeenCalledOnce();
    expect(targetPlayer.setPosition).toHaveBeenCalled();
    expect(events).toEqual([
      { kind: HitEventKind.PLAYER_HIT, cause: HitCause.SOLID_PROP, x: 30, y: 40 },
    ]);
  });

  it('pushes the player out without emitting PLAYER_HIT when shielded', () => {
    const targetPlayer = player({ hit: vi.fn(() => false) });
    const targetProp = prop({
      isSolid: true,
      getSolidBounds: vi.fn(() => ({ shape: PropCollisionShape.BOX, x: 10, y: 20, hw: 12, hh: 12 })),
    });

    const events = collect([
      asContact({
        kind: CollisionContactKind.PLAYER_SOLID_PROP,
        player: targetPlayer,
        prop: targetProp,
      }),
    ]);

    expect(targetPlayer.hit).toHaveBeenCalledOnce();
    expect(targetPlayer.setPosition).toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('destroys an enemy bullet on solid prop contact with no prop damage', () => {
    const hostileShot = bullet({ isPlayerBullet: false });
    const targetProp = prop({ isSolid: true, hit: vi.fn() });

    const events = collect([
      asContact({
        kind: CollisionContactKind.ENEMY_BULLET_SOLID_PROP,
        bullet: hostileShot,
        prop: targetProp,
      }),
    ]);

    expect(hostileShot.active).toBe(false);
    expect(targetProp.hit).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('does not damage the enemy or prop for ENEMY_SOLID_PROP contact', () => {
    const targetEnemy = enemy({ hit: vi.fn() });
    const targetProp = prop({ isSolid: true, hit: vi.fn() });

    const events = collect([
      asContact({
        kind: CollisionContactKind.ENEMY_SOLID_PROP,
        enemy: targetEnemy,
        prop: targetProp,
      }),
    ]);

    expect(targetEnemy.hit).not.toHaveBeenCalled();
    expect(targetProp.hit).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('lets piercing bullets continue through solid props and consumes one pierce charge', () => {
    const shot = bullet({ isPiercing: true, remainingPierce: 2 });
    const deathResult = propResult();
    const target = prop({
      isSolid: true,
      hit: vi.fn(() => deathResult),
    });

    const events = collect([
      asContact({ kind: CollisionContactKind.PLAYER_BULLET_PROP, bullet: shot, prop: target }),
    ]);

    expect(target.hit).toHaveBeenCalledWith(3);
    expect(shot.active).toBe(true);
    expect(shot.remainingPierce).toBe(1);
    expect(events).toEqual([{ kind: HitEventKind.PROP_DESTROYED, result: deathResult }]);
  });
});
