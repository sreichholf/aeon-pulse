import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameplayRun } from './GameplayRun.ts';
import { HitCause, HitEventKind } from './CombatResolution.ts';
import { Explosion } from '../entities/Explosion.ts';
import { CancellationPointItem } from '../entities/CancellationPointItem.ts';

// Mock the entities _handleHit constructs so the suite asserts pipeline
// orchestration, not particle/powerup internals. These are named exports.
// Regular functions (not arrows) so `new` works.
vi.mock('../entities/Explosion.ts', () => ({
  Explosion: vi.fn(function () { return { update: vi.fn(), isDone: false, destroy: vi.fn() }; }),
}));
vi.mock('../entities/PowerUp.ts', () => ({
  PowerUp: vi.fn(function () {
    return { update: vi.fn(), isOffscreen: false, destroy: vi.fn(), type: 'weapon', x: 0, y: 0, hw: 0, hh: 0 };
  }),
}));
vi.mock('../entities/CancellationPointItem.ts', () => ({
  CancellationPointItem: vi.fn(function () { return { update: vi.fn(), isDone: false, destroy: vi.fn() }; }),
}));

beforeEach(() => {
  vi.mocked(Explosion).mockClear();
  vi.mocked(CancellationPointItem).mockClear();
});

// ── Fixture builders ──────────────────────────────────────────────────────────
// Fakes expose exactly the surface the tick pipeline (tickGameplay /
// checkCollisions / resolveCollisionContacts / _handleHit) reads. Plain objects
// cast `any` when assigned onto run fields, matching the existing test style.

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    scene: {
      camera: new THREE.Camera(),
      add: vi.fn(),
      remove: vi.fn(),
      flash: vi.fn(),
    },
    sprites: {},
    input: {
      wasJustPressed: vi.fn().mockReturnValue(false),
      isDown: vi.fn().mockReturnValue(false),
    },
    audio: { play: vi.fn() },
    score: {
      addScore: vi.fn(),
      loseLife: vi.fn(),
      gainLife: vi.fn(),
      score: 0,
      hiScore: 0,
    },
    onLevelComplete: vi.fn(),
    ...overrides,
  };
}

type FakeRun = GameplayRun & { [key: string]: any };

function createRun(deps?: ReturnType<typeof createDeps>): FakeRun {
  return new GameplayRun(deps ?? createDeps()) as FakeRun;
}

function fakePlayer(overrides: Record<string, unknown> = {}): any {
  return {
    x: 0, y: 0, hw: 12, hh: 12,
    terrainBounds: null,
    bombStock: 0,
    chargeLevel: 0, shieldPips: 0, shieldMax: 0, shieldRegenPct: 0, weaponTier: 1,
    isExitComplete: false,
    useBomb: vi.fn(() => true),
    hit: vi.fn(() => true),
    applyDeathPenalty: vi.fn(),
    collectBomb: vi.fn(() => true),
    upgradeWeapon: vi.fn(() => true),
    refillShield: vi.fn(() => true),
    setPosition: vi.fn(),
    beginLevelExit: vi.fn(),
    update: vi.fn(() => []),
    destroy: vi.fn(),
    ...overrides,
  };
}

function fakeEnemy(overrides: Record<string, unknown> = {}): any {
  return {
    isBoss: false,
    isAlive: true,
    isOffscreen: false,
    isSpaceShip: false,
    score: 100,
    x: 0, y: 0, hw: 12, hh: 12,
    terrainBounds: null,
    update: vi.fn(() => []),
    hit: vi.fn(() => null),
    destroy: vi.fn(),
    ...overrides,
  };
}

// Fake bullet: destroy() deactivates in place, modelling the real Bullet's
// releaseFromScene() -> active=false path. This is the Bullet Active-Flag
// Synchronization invariant (CONTEXT.md) the pipeline relies on.
function fakeBullet(overrides: Record<string, unknown> = {}): any {
  const b = {
    active: true,
    isPlayerBullet: false,
    isPiercing: false,
    damage: 10,
    isOffscreen: false,
    type: 'enemyBasic',
    x: 0, y: 0, hw: 4, hh: 4,
    update: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
  b.destroy = vi.fn(() => { (b as any).active = false; });
  return b;
}

function fakeProp(overrides: Record<string, unknown> = {}): any {
  return {
    propType: 'sensorPod',
    isAlive: true,
    isOffscreen: false,
    isBursting: false,
    isSolid: false,
    collisionShape: 'box',
    isFullGate: false,
    x: 0, y: 0, hw: 12, hh: 12,
    update: vi.fn(),
    hit: vi.fn(() => null),
    consumeBurst: vi.fn(() => null),
    getSolidBounds: vi.fn(() => null),
    destroy: vi.fn(),
    ...overrides,
  };
}

function fakeBoss(overrides: Record<string, unknown> = {}): any {
  return {
    isBoss: true,
    isAlive: true,
    isOffscreen: false,
    isDying: false,
    maxHp: 1000,
    score: 5000,
    playfieldBounds: null,
    x: 300, y: 0, hw: 80, hh: 60,
    update: vi.fn(() => []),
    hit: vi.fn(() => true),
    hitZones: vi.fn(() => []),
    lasers: [],
    destroy: vi.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameplayRun pipeline — phase ordering', () => {
  it('calls the 10 pipeline phases in the locked order', () => {
    const run = createRun();
    run._player = fakePlayer();

    const phases = [
      '_tickBombs',
      '_buildWorldState',
      '_tickWorld',
      '_syncWorldArrays',
      '_recordGameplayProbeContext',
      '_applyEnemySolidPropRepulsion',
      '_resolveTimedBursts',
      '_resolveCombat',
    ];
    const spies = phases.map((name) => vi.spyOn(run as any, name as any));

    run.tick(0.016);

    const ordered = spies
      .map((s, i) => ({ name: phases[i], n: s.mock.invocationCallOrder[0] ?? Infinity }))
      .filter((x) => x.n !== Infinity)
      .sort((a, b) => a.n - b.n)
      .map((x) => x.name);

    expect(ordered).toEqual(phases);
  });

  it('dispatches ENEMY_KILLED before PLAYER_HIT and orders their side effects', () => {
    const deps = createDeps();
    const run = createRun(deps);

    const player = fakePlayer({ bombStock: 0, hit: vi.fn(() => true) });
    // Player bullet overlapping enemyA (both at x=100).
    const playerBullet = fakeBullet({ isPlayerBullet: true, x: 100, y: 0 });
    const enemyA = fakeEnemy({
      x: 100, y: 0,
      score: 100,
      hit: vi.fn(() => ({ x: 100, y: 0, dropPowerup: false })),
    });
    // Enemy bullet overlapping the player (both at x=-100).
    const enemyBullet = fakeBullet({ isPlayerBullet: false, x: -100, y: 0 });
    player.x = -100;

    run._player = player;
    run._enemies = [enemyA];
    run._bullets = [playerBullet, enemyBullet];

    const handleHitSpy = vi.spyOn(run as any, '_handleHit');
    const scoreAdd = vi.spyOn(deps.score, 'addScore');
    const scoreLose = vi.spyOn(deps.score, 'loseLife');

    run.tick(0.016);

    // Contact order: player-bullets-vs-enemies fires before enemy-bullets-vs-player.
    expect(handleHitSpy.mock.calls[0][0].kind).toBe(HitEventKind.ENEMY_KILLED);
    expect(handleHitSpy.mock.calls[1][0].kind).toBe(HitEventKind.PLAYER_HIT);

    // Enemy score added before the player life is lost.
    expect(scoreAdd).toHaveBeenCalledWith(100);
    expect(scoreLose).toHaveBeenCalledOnce();
    expect(scoreAdd.mock.invocationCallOrder[0]).toBeLessThan(scoreLose.mock.invocationCallOrder[0]);
    expect(deps.scene.flash).toHaveBeenCalledWith(0.12);
  });
});

describe('GameplayRun pipeline — exit window transition', () => {
  it('skips combat and clears hostile bullets when a non-finale level completes mid-tick', () => {
    const deps = createDeps();
    const run = createRun(deps);

    run._player = fakePlayer();
    run._level = { isFinale: false };
    // LevelManager.update fires completeLevel during tickGameplay.
    run._levelManager = {
      scrollX: 0,
      update: vi.fn(() => run.completeLevel()),
    };
    const hostile = fakeBullet({ isPlayerBullet: false, x: 50, y: 0 });
    const playerBullet = fakeBullet({ isPlayerBullet: true, x: -50, y: 0 });
    run._bullets = [hostile, playerBullet];

    const resolveCombatSpy = vi.spyOn(run as any, '_resolveCombat');

    run.tick(0.016);

    expect(run._isExitingLevel).toBe(true);
    expect(resolveCombatSpy).not.toHaveBeenCalled();
    // Hostile bullet cleared, player bullet retained.
    expect(run._bullets).not.toContain(hostile);
    expect(run._bullets).toContain(playerBullet);
  });

  it('takes the level-exit fast path and skips all gameplay phases', () => {
    const deps = createDeps();
    const run = createRun(deps);

    run._isExitingLevel = true;
    run._player = fakePlayer({ isExitComplete: false });
    run._background = { update: vi.fn(), destroy: vi.fn(), baseSpeed: 100 };
    const completedEffect = { update: vi.fn(), isDone: true, destroy: vi.fn() };
    run._effects = [completedEffect as any];
    run._bullets = [];

    const tickBombsSpy = vi.spyOn(run as any, '_tickBombs');
    const tickWorldSpy = vi.spyOn(run as any, '_tickWorld');
    const resolveCombatSpy = vi.spyOn(run as any, '_resolveCombat');
    const tickLevelExitSpy = vi.spyOn(run as any, '_tickLevelExit');

    run.tick(0.1);

    expect(tickLevelExitSpy).toHaveBeenCalledOnce();
    expect(tickBombsSpy).not.toHaveBeenCalled();
    expect(tickWorldSpy).not.toHaveBeenCalled();
    expect(resolveCombatSpy).not.toHaveBeenCalled();
    expect(completedEffect.destroy).toHaveBeenCalledOnce();
  });
});

describe('GameplayRun pipeline — 75ms death-bomb window', () => {
  it('arms the window without losing a life when a PLAYER_HIT lands with bomb stock', () => {
    const deps = createDeps();
    const run = createRun(deps);
    const player = fakePlayer({ bombStock: 1 });
    run._player = player;
    run._pendingPlayerHitEvent = { kind: HitEventKind.PLAYER_HIT, cause: HitCause.BULLET, x: 0, y: 0 };
    run._deathBombTimer = 0.075;

    run.tick(0.016);

    expect(run._deathBombTimer).toBeCloseTo(0.059, 5);
    expect(run._pendingPlayerHitEvent).not.toBeNull();
    expect(deps.score.loseLife).not.toHaveBeenCalled();
    expect(player.applyDeathPenalty).not.toHaveBeenCalled();
  });

  it('clears the pending hit and fires the smart bomb when BOMB is pressed in the window', () => {
    const deps = createDeps();
    deps.input.wasJustPressed = vi.fn((key: string) => key === 'BOMB');
    const run = createRun(deps);
    const player = fakePlayer({ bombStock: 1, useBomb: vi.fn(() => true) });
    run._player = player;
    run._pendingPlayerHitEvent = { kind: HitEventKind.PLAYER_HIT, cause: HitCause.BULLET, x: 0, y: 0 };
    run._deathBombTimer = 0.05;

    run.tick(0.016);

    expect(run._pendingPlayerHitEvent).toBeNull();
    expect(player.useBomb).toHaveBeenCalledOnce();
    expect(deps.score.loseLife).not.toHaveBeenCalled();
    expect(deps.scene.flash).toHaveBeenCalledWith(0.35); // smart-bomb flash
  });

  it('applies the player hit when the window expires without a bomb', () => {
    const deps = createDeps();
    const run = createRun(deps);
    const player = fakePlayer({ bombStock: 1 });
    run._player = player;
    run._pendingPlayerHitEvent = { kind: HitEventKind.PLAYER_HIT, cause: HitCause.BULLET, x: 0, y: 0 };
    run._deathBombTimer = 0.075;

    run.tick(0.1); // > 75ms

    expect(run._pendingPlayerHitEvent).toBeNull();
    expect(deps.score.loseLife).toHaveBeenCalledOnce();
    expect(player.applyDeathPenalty).toHaveBeenCalledOnce();
    expect(deps.scene.flash).toHaveBeenCalledWith(0.12);
  });

  it('coalesces intra-frame PLAYER_HIT events while one is pending', () => {
    const deps = createDeps();
    const run = createRun(deps);
    const player = fakePlayer({ bombStock: 1, hit: vi.fn(() => true) });
    player.x = 0;
    run._player = player;
    // Two enemy bullets both overlapping the player.
    const eb1 = fakeBullet({ isPlayerBullet: false, x: 0, y: 0 });
    const eb2 = fakeBullet({ isPlayerBullet: false, x: 0, y: 0 });
    run._bullets = [eb1, eb2];

    run.tick(0.016);

    // First PLAYER_HIT arms the window; the second is ignored while pending.
    expect(run._pendingPlayerHitEvent).not.toBeNull();
    expect(deps.score.loseLife).not.toHaveBeenCalled();
    expect(player.applyDeathPenalty).not.toHaveBeenCalled();
  });
});

describe('GameplayRun pipeline — smart-bomb re-entrancy cascade', () => {
  it('cascades voluntary bomb through area damage and nested bullet cancellation', () => {
    const deps = createDeps();
    deps.input.wasJustPressed = vi.fn((key: string) => key === 'BOMB');
    const run = createRun(deps);

    const player = fakePlayer({ bombStock: 1, useBomb: vi.fn(() => true) });
    run._player = player;
    const hostileBullet = fakeBullet({ isPlayerBullet: false, x: 40, y: 0 });
    run._bullets = [hostileBullet];
    // Enemy killed by area damage with triggerCancellation -> nested cancellation.
    const cancellationEnemy = fakeEnemy({
      x: 300, y: 0,
      score: 200,
      hit: vi.fn(() => ({ x: 300, y: 0, dropPowerup: false, triggerCancellation: true })),
    });
    run._enemies = [cancellationEnemy];

    run.tick(0.016);

    expect(player.useBomb).toHaveBeenCalledOnce();
    expect(deps.scene.flash).toHaveBeenCalledWith(0.35);
    // Direct cancellation + area damage both hit the enemy.
    expect(cancellationEnemy.hit).toHaveBeenCalledWith(200, true);
    expect(deps.score.addScore).toHaveBeenCalledWith(200);
    // Cancellation Point Items were produced for the cancelled bullet(s).
    expect(CancellationPointItem).toHaveBeenCalled();
    // The hostile bullet was removed during the pre-tick bomb (before _buildWorldState).
    expect(run._bullets).not.toContain(hostileBullet);
  });
});

describe('GameplayRun pipeline — Bullet Active-Flag Synchronization', () => {
  it('mid-tick cancellation survives the array sync via in-place deactivation', () => {
    const deps = createDeps();
    const run = createRun(deps);
    run._player = fakePlayer();

    const hostileBullet = fakeBullet({ isPlayerBullet: false, x: 30, y: 0 });
    run._bullets = [hostileBullet];
    // A boss whose update fires _triggerBulletCancellation mid-tickGameplay.
    // This reassigns run._bullets while world.bullets still holds the old ref,
    // and deactivates the bullet in place via destroyOrRelease -> destroy.
    run._boss = fakeBoss({
      update: vi.fn(() => {
        run._triggerBulletCancellation();
        return [];
      }),
    });

    run.tick(0.016);

    // The hostile bullet is gone from the synced array even though the
    // cancellation filtered a different array reference than world.bullets.
    expect(run._bullets).not.toContain(hostileBullet);
    expect(CancellationPointItem).toHaveBeenCalled();
  });
});

describe('GameplayRun pipeline — Deferred Level Completion', () => {
  it('boss onDeath does not call onLevelComplete synchronously; sets the deferred flag', () => {
    const deps = createDeps();
    const run = createRun(deps);
    run._level = { isFinale: true, finaleBossArchetype: 1 } as any;
    run.spawnBoss();
    const boss = run._boss;
    expect(boss).not.toBeNull();

    boss!.hit(45);
    const hostile = fakeBullet({ isPlayerBullet: false, x: 50, y: 0 });
    run._bullets = [hostile];

    run.tick(5);

    expect(deps.onLevelComplete).not.toHaveBeenCalled();
    expect(run.hasPendingLevelComplete).toBe(true);
    expect(run._boss).toBeNull();
    expect(deps.score.addScore).toHaveBeenCalledWith(5000);
    expect(deps.score.gainLife).toHaveBeenCalledOnce();
    expect(CancellationPointItem).toHaveBeenCalled();
    expect(run._bullets).not.toContain(hostile);
  });

  it('post-tickGameplay phases run on a still-alive run after boss death; a PLAYER_HIT in the same frame is still resolved', () => {
    const deps = createDeps();
    const run = createRun(deps);
    run._level = { isFinale: true, finaleBossArchetype: 1 } as any;
    run.spawnBoss();
    const boss = run._boss;
    expect(boss).not.toBeNull();

    boss!.hit(45);

    const player = fakePlayer({ bombStock: 0, hit: vi.fn(() => true) });
    run._player = player;
    const ram = fakeEnemy({ x: 0, y: 0 });
    run._enemies = [ram];

    expect(() => run.tick(5)).not.toThrow();

    expect(player.hit).toHaveBeenCalledOnce();
    expect(deps.score.loseLife).toHaveBeenCalledOnce();
    expect(player.applyDeathPenalty).toHaveBeenCalledOnce();
    expect(run.hasPendingLevelComplete).toBe(true);
  });
});
