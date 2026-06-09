import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TacticalDossierCard, type WrappedEntity, type ViewerBullet } from './TacticalDossierCard.ts';
import { BulletType } from '../types.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeScene() {
  return { add: vi.fn(), remove: vi.fn() };
}

function makeBullet(): ViewerBullet {
  return { _mesh: new THREE.Mesh(), update: vi.fn(), destroy: vi.fn() };
}

function makeBulletFactory(bullet: ViewerBullet = makeBullet()) {
  const factory = vi.fn().mockReturnValue(bullet);
  return { factory, bullet };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TacticalDossierCard', () => {
  it('can wrap a basic THREE.Object3D (idle display model)', () => {
    const group = new THREE.Group();
    group.position.set(10, 20, 30);

    const card = new TacticalDossierCard(group, makeScene(), { viewerIdle: true });

    expect(card.entity).toBe(group);
    expect(card.mesh).toBe(group);
    expect(card.viewerX).toBe(10);
    expect(card.viewerY).toBe(20);
    expect(card.metadata).toBeUndefined();
    expect(card.isBoss).toBe(false);
    expect(card.viewerBullet).toBeNull();
  });

  it('can wrap a gameplay entity and sets viewer flags', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(15, 25, 0);

    const entity: WrappedEntity = {
      _mesh: mesh,
      metadata: { displayName: 'Test Enemy', hp: 100, score: 50 },
      isBoss: true,
    };

    const card = new TacticalDossierCard(entity, makeScene());

    expect(card.entity).toBe(entity);
    expect(card.mesh).toBe(mesh);
    expect(card.metadata?.displayName).toBe('Test Enemy');
    expect(card.isBoss).toBe(true);
    expect(entity._isViewer).toBe(true);
    expect(entity._entered).toBe(true);
    expect(typeof entity._getPlayerPos).toBe('function');
    expect(entity._getPlayerPos!()).toEqual({ x: 0, y: 0 });
  });

  it('performs idle float animation on viewerIdle cards', () => {
    const group = new THREE.Group();
    group.position.set(0, 10, 0);
    group.rotation.set(0, 0, 0);

    const card = new TacticalDossierCard(group, makeScene(), { viewerIdle: true });
    card.update(0.5);

    expect(card.viewerTime).toBe(0.5);
    expect(group.position.y).toBeCloseTo(10 + Math.sin(0.5 * 1.4) * 2.2, 4);
  });

  it('ticks entity update() for animation each frame', () => {
    const mesh = new THREE.Mesh();
    const entity: WrappedEntity = {
      _mesh: mesh,
      update: vi.fn().mockReturnValue([]),
    };
    const card = new TacticalDossierCard(entity, makeScene(), { viewerX: 0, viewerY: 0 });

    card.update(0.1);
    card.update(0.1);

    expect(entity.update).toHaveBeenCalledTimes(2);
  });

  it('shows first bullet immediately on the first update when bulletTypes provided', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);
    const entity: WrappedEntity = { _mesh: mesh, update: vi.fn().mockReturnValue([]) };

    const bullet = makeBullet();
    const factory = vi.fn().mockReturnValue(bullet);

    const card = new TacticalDossierCard(entity, makeScene(), {
      viewerX: 0,
      viewerY: 0,
      bulletTypes: [BulletType.ENEMY],
      bulletFactory: factory,
    });

    // No bullet before first tick
    expect(card.viewerBullet).toBeNull();

    // First tick → bullet appears immediately (timer starts at lifetime)
    card.update(0.1);
    expect(factory).toHaveBeenCalledWith(BulletType.ENEMY);
    expect(card.viewerBullet).toBe(bullet);
  });

  it('cycles to the next bullet type after 5 seconds', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);
    const entity: WrappedEntity = { _mesh: mesh, update: vi.fn().mockReturnValue([]) };

    const bullet1 = makeBullet();
    const bullet2 = makeBullet();
    const factory = vi.fn()
      .mockReturnValueOnce(bullet1)
      .mockReturnValueOnce(bullet2);

    const card = new TacticalDossierCard(entity, makeScene(), {
      viewerX: 0, viewerY: 0,
      bulletTypes: [BulletType.ENEMY, BulletType.HOMING],
      bulletFactory: factory,
    });

    // First bullet appears immediately
    card.update(0.1);
    expect(card.viewerBullet).toBe(bullet1);

    // After 4.9 s more — still bullet1 (just under 5 s threshold)
    card.update(4.9);
    expect(card.viewerBullet).toBe(bullet1);
    expect(bullet1.destroy).not.toHaveBeenCalled();

    // One more tick crosses the 5 s mark → bullet2 replaces bullet1
    card.update(0.1);
    expect(bullet1.destroy).toHaveBeenCalledTimes(1);
    expect(card.viewerBullet).toBe(bullet2);
    expect(factory).toHaveBeenCalledWith(BulletType.HOMING);
  });

  it('wraps around to the first bullet type after exhausting the list', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);
    const entity: WrappedEntity = { _mesh: mesh, update: vi.fn().mockReturnValue([]) };

    const bullets = [makeBullet(), makeBullet(), makeBullet()];
    let callCount = 0;
    const factory = vi.fn().mockImplementation(() => bullets[callCount++ % bullets.length]);

    const card = new TacticalDossierCard(entity, makeScene(), {
      viewerX: 0, viewerY: 0,
      bulletTypes: [BulletType.BOSS, BulletType.HOMING],
      bulletFactory: factory,
    });

    // Tick 1: shows BOSS immediately
    card.update(0.1);
    expect(factory).toHaveBeenLastCalledWith(BulletType.BOSS);

    // Tick 2: after 5 s → shows HOMING
    card.update(5.0);
    expect(factory).toHaveBeenLastCalledWith(BulletType.HOMING);

    // Tick 3: after another 5 s → wraps back to BOSS
    card.update(5.0);
    expect(factory).toHaveBeenLastCalledWith(BulletType.BOSS);
  });

  it('shows no bullet preview when bulletTypes is empty', () => {
    const mesh = new THREE.Mesh();
    const entity: WrappedEntity = { _mesh: mesh, update: vi.fn().mockReturnValue([]) };
    const factory = vi.fn();

    const card = new TacticalDossierCard(entity, makeScene(), {
      viewerX: 0, viewerY: 0,
      bulletTypes: [],
      bulletFactory: factory,
    });

    card.update(10); // well past any threshold
    expect(factory).not.toHaveBeenCalled();
    expect(card.viewerBullet).toBeNull();
  });

  it('pins the bullet mesh position and updates it each frame', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(30, 50, 0);
    const entity: WrappedEntity = { _mesh: mesh, update: vi.fn().mockReturnValue([]) };

    const bullet = makeBullet();
    const factory = vi.fn().mockReturnValue(bullet);

    const card = new TacticalDossierCard(entity, makeScene(), {
      viewerX: 30, viewerY: 50,
      bulletTypes: [BulletType.ENEMY],
      bulletFactory: factory,
    });

    card.update(0.1);

    // Card should call bullet.update() and pin its position
    expect(bullet.update).toHaveBeenCalledWith(0.1);
    expect(bullet._mesh.position.x).toBe(30);
  });

  it('cleans up bullet and entity on destroy()', () => {
    const mesh = new THREE.Mesh();
    const mockGeoDispose = vi.spyOn(mesh.geometry, 'dispose');
    const mockMatDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');
    const scene = makeScene();

    const bullet = makeBullet();
    const factory = vi.fn().mockReturnValue(bullet);

    const entity: WrappedEntity = {
      _mesh: mesh,
      update: vi.fn().mockReturnValue([]),
      isMesh: true,
    };

    const card = new TacticalDossierCard(entity, scene, {
      bulletTypes: [BulletType.ENEMY],
      bulletFactory: factory,
    });

    card.update(0.1); // spawns bullet
    card.destroy();

    expect(bullet.destroy).toHaveBeenCalled();
    expect(card.viewerBullet).toBeNull();
    expect(scene.remove).toHaveBeenCalledWith(mesh);
    expect(mockGeoDispose).toHaveBeenCalled();
    expect(mockMatDispose).toHaveBeenCalled();
  });

  it('traverses and disposes cloned display models on destroy()', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh();
    const mockGeoDispose = vi.spyOn(mesh.geometry, 'dispose');
    const mockMatDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');
    group.add(mesh);

    const scene = makeScene();
    const card = new TacticalDossierCard(group, scene);
    card.destroy();

    expect(scene.remove).toHaveBeenCalledWith(group);
    expect(mockGeoDispose).toHaveBeenCalled();
    expect(mockMatDispose).toHaveBeenCalled();
  });
});
