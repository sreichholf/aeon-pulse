import { describe, expect, it } from 'vitest';

import { checkCollisions, CollisionContactKind } from './Collisions.ts';
import { PropCollisionShape } from '../types.ts';

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

interface PropBody extends Body {
  isAlive: boolean;
  isSolid: boolean;
  getSolidBounds(): import('../types.ts').PropSolidBounds | null;
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

const propBody = (overrides: Partial<PropBody> = {}): PropBody => {
  const b = body();
  const isSolid = overrides.isSolid ?? false;
  return {
    ...b,
    isAlive: true,
    isSolid,
    getSolidBounds: () =>
      isSolid ? { shape: PropCollisionShape.BOX, x: b.x, y: b.y, hw: b.hw, hh: b.hh } : null,
    ...overrides,
  };
};

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
        props: [],
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
        props: [],
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
        props: [],
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
        props: [],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([]);
  });

  it('reports a player-bullet-prop contact when a player bullet overlaps an alive prop', () => {
    const contacts: CollisionContactKind[] = [];

    checkCollisions(
      {
        player: null,
        enemies: [],
        boss: null,
        bullets: [bullet()],
        powerups: [],
        props: [propBody()],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([CollisionContactKind.PLAYER_BULLET_PROP]);
  });

  it('uses solid prop shape rather than AABB corners for player bullet contacts', () => {
    const contacts: CollisionContactKind[] = [];
    const circularSolid = {
      x: 0,
      y: 0,
      hw: 10,
      hh: 10,
      isAlive: true,
      isSolid: true,
      getSolidBounds: () => ({ shape: PropCollisionShape.CIRCLE, x: 0, y: 0, radius: 10 }),
    } satisfies PropBody;

    checkCollisions(
      {
        player: null,
        enemies: [],
        boss: null,
        bullets: [bullet({ x: 10, y: 10, hw: 1, hh: 1 })],
        powerups: [],
        props: [circularSolid],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([]);
  });

  it('skips dead props and non-overlapping props', () => {
    const contacts: CollisionContactKind[] = [];

    checkCollisions(
      {
        player: null,
        enemies: [],
        boss: null,
        bullets: [bullet()],
        powerups: [],
        props: [propBody({ isAlive: false }), propBody({ x: 900 })],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([]);
  });

  it('reports PLAYER_SOLID_PROP when the player overlaps a solid prop', () => {
    const contacts: CollisionContactKind[] = [];
    const solid = propBody({ x: 0, y: 0, hw: 10, hh: 10, isSolid: true });

    checkCollisions(
      {
        player: player({ x: 5, y: 5, terrainBounds: { top: 100, bottom: -100 } }),
        enemies: [],
        boss: null,
        bullets: [],
        powerups: [],
        props: [solid],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toContain(CollisionContactKind.PLAYER_SOLID_PROP);
  });

  it('reports ENEMY_SOLID_PROP when an enemy overlaps a solid prop', () => {
    const contacts: CollisionContactKind[] = [];
    const solid = propBody({ x: 0, y: 0, hw: 10, hh: 10, isSolid: true });

    checkCollisions(
      {
        player: null,
        enemies: [enemy({ x: 5, y: 5 })],
        boss: null,
        bullets: [],
        powerups: [],
        props: [solid],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([CollisionContactKind.ENEMY_SOLID_PROP]);
  });

  it('reports ENEMY_BULLET_SOLID_PROP when a hostile bullet overlaps a solid prop', () => {
    const contacts: CollisionContactKind[] = [];
    const solid = propBody({ x: 0, y: 0, hw: 10, hh: 10, isSolid: true });

    checkCollisions(
      {
        player: null,
        enemies: [],
        boss: null,
        bullets: [bullet({ isPlayerBullet: false })],
        powerups: [],
        props: [solid],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([CollisionContactKind.ENEMY_BULLET_SOLID_PROP]);
  });

  it('keeps non-solid props on the existing PLAYER_BULLET_PROP path', () => {
    const contacts: CollisionContactKind[] = [];
    const nonSolid = propBody({ isSolid: false });
    const playerBullet = bullet({ isPiercing: true });

    checkCollisions(
      {
        player: null,
        enemies: [],
        boss: null,
        bullets: [playerBullet],
        powerups: [],
        props: [nonSolid],
      },
      (contact) => contacts.push(contact.kind),
    );

    expect(contacts).toEqual([CollisionContactKind.PLAYER_BULLET_PROP]);
  });
});
