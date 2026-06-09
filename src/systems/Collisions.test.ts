import { describe, expect, it } from 'vitest';

import { checkCollisions, CollisionContactKind } from './Collisions.ts';

interface Body {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

interface PlayerBody extends Body {
  terrainBounds: { top: number; bottom: number } | null;
}

interface EnemyBody extends Body {
  isAlive: boolean;
}

interface BossBody {
  isDying: boolean;
  lasers: Body[];
  hitZones(): Array<Body & { id: string }>;
}

interface BulletBody extends Body {
  active: boolean;
  isPlayerBullet: boolean;
  isPiercing: boolean;
}

const body = (overrides: Partial<Body> = {}): Body => ({
  x: 0,
  y: 0,
  hw: 5,
  hh: 5,
  ...overrides,
});

const player = (overrides: Partial<PlayerBody> = {}): PlayerBody => ({
  ...body(),
  terrainBounds: null,
  ...overrides,
});

const enemy = (overrides: Partial<EnemyBody> = {}): EnemyBody => ({
  ...body(),
  isAlive: true,
  ...overrides,
});

const bullet = (overrides: Partial<BulletBody> = {}): BulletBody => ({
  ...body(),
  active: true,
  isPlayerBullet: true,
  isPiercing: false,
  ...overrides,
});

const boss = (overrides: Partial<BossBody> = {}): BossBody => ({
  isDying: false,
  lasers: [],
  hitZones: () => [{ id: 'core', ...body() }],
  ...overrides,
});

describe('checkCollisions', () => {
  it('emits the enemy contact before the boss contact for an overlapping non-piercing player bullet', () => {
    const contacts: CollisionContactKind[] = [];

    checkCollisions(
      {
        player: null,
        enemies: [enemy()],
        boss: boss(),
        bullets: [bullet()],
        powerups: [],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([
      CollisionContactKind.PLAYER_BULLET_ENEMY,
      CollisionContactKind.PLAYER_BULLET_BOSS,
    ]);
  });

  it('reports every overlapping enemy for a piercing player bullet before checking the boss', () => {
    const contacts: CollisionContactKind[] = [];

    checkCollisions(
      {
        player: null,
        enemies: [enemy({ x: -2 }), enemy({ x: 2 })],
        boss: boss(),
        bullets: [bullet({ isPiercing: true })],
        powerups: [],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([
      CollisionContactKind.PLAYER_BULLET_ENEMY,
      CollisionContactKind.PLAYER_BULLET_ENEMY,
      CollisionContactKind.PLAYER_BULLET_BOSS,
    ]);
  });

  it('reports player danger and collection contacts in gameplay resolution order', () => {
    const contacts: CollisionContactKind[] = [];

    checkCollisions(
      {
        player: player({ y: 6, terrainBounds: { top: 10, bottom: -10 } }),
        enemies: [enemy()],
        boss: boss({ lasers: [body()] }),
        bullets: [bullet({ isPlayerBullet: false })],
        powerups: [body()],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([
      CollisionContactKind.BOSS_LASER_PLAYER,
      CollisionContactKind.PLAYER_TERRAIN,
      CollisionContactKind.ENEMY_BULLET_PLAYER,
      CollisionContactKind.ENEMY_RAM_PLAYER,
      CollisionContactKind.POWERUP_PLAYER,
    ]);
  });

  it('does not report terrain contact when the player has no terrain bounds', () => {
    const contacts: CollisionContactKind[] = [];

    checkCollisions(
      {
        player: player({ y: 500, terrainBounds: null }),
        enemies: [],
        boss: null,
        bullets: [],
        powerups: [],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([]);
  });
});
