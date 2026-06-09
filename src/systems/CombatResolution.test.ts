import { describe, expect, it, vi } from 'vitest';

import { CollisionContactKind, type CollisionContact } from './Collisions.ts';
import { HitCause, HitEventKind, resolveCollisionContacts, type HitEvent } from './CombatResolution.ts';

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
  ...overrides,
});

const boss = (overrides: Partial<BossFake> = {}): BossFake => ({
  isDying: false,
  hit: vi.fn(),
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
});
