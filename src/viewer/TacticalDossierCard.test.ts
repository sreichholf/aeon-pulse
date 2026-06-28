import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TacticalDossierCard, type WrappedEntity, type ViewerBullet } from './TacticalDossierCard.ts';
import { ProjectileSourceKey } from '../types.ts';

function makeScene() {
  return { add: vi.fn(), remove: vi.fn() };
}

function makeBullet(): ViewerBullet {
  return { _mesh: new THREE.Mesh(), update: vi.fn(), destroy: vi.fn() };
}

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

  it('wraps a gameplay entity without mutating viewer state onto it', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(15, 25, 0);

    const entity: WrappedEntity = {
      _mesh: mesh,
      metadata: { displayName: 'Test Enemy', hp: 100, score: 50, isBoss: false },
      isBoss: true,
    };

    const card = new TacticalDossierCard(entity, makeScene());

    expect(card.entity).toBe(entity);
    expect(card.mesh).toBe(mesh);
    expect(card.metadata?.displayName).toBe('Test Enemy');
    expect(card.isBoss).toBe(true);
    expect(entity).not.toHaveProperty('_isViewer');
    expect(entity).not.toHaveProperty('_entered');
    expect(entity._getPlayerPos).toBeUndefined();
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

  it('does not tick wrapped entity lifecycle methods each frame', () => {
    const mesh = new THREE.Mesh();
    const entity: WrappedEntity = {
      _mesh: mesh,
      update: vi.fn().mockReturnValue([]),
      _tick: vi.fn(),
    };
    const card = new TacticalDossierCard(entity, makeScene(), { viewerX: 0, viewerY: 0 });

    card.update(0.1);
    card.update(0.1);

    expect(entity.update).not.toHaveBeenCalled();
    expect(entity._tick).not.toHaveBeenCalled();
  });

  it('applies passive hover and attitude drift to gameplay entity cards', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0.2, 0.3, 0.4);
    const entity: WrappedEntity = {
      _mesh: mesh,
      update: vi.fn().mockReturnValue([]),
    };
    const card = new TacticalDossierCard(entity, makeScene(), { viewerX: 10, viewerY: 20 });

    card.update(0.5);

    expect(card.viewerTime).toBe(0.5);
    expect(mesh.position.x).toBe(10);
    expect(mesh.position.y).toBeCloseTo(26 + Math.sin(0.5 * 1.4) * 2.2, 4);
    expect(mesh.rotation.x).toBeCloseTo(0.2 + Math.sin(0.5 * 1.1) * 0.018, 4);
    expect(mesh.rotation.y).toBeCloseTo(0.3 + Math.sin(0.5 * 0.8) * 0.035, 4);
    expect(mesh.rotation.z).toBeCloseTo(0.4 + Math.sin(0.5 * 1.5) * 0.012, 4);
  });

  it('applies viewerOffsetX option to wrapped entities', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    const entity: WrappedEntity = {
      _mesh: mesh,
      destroy: vi.fn(),
    };

    const card = new TacticalDossierCard(entity, makeScene(), { viewerX: 10, viewerY: 20, viewerOffsetX: 18 });
    card.update(0.5);

    expect(mesh.position.x).toBe(28);
  });

  it('defaults viewerOffsetX to zero when not supplied', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    const entity: WrappedEntity = { _mesh: mesh };

    const card = new TacticalDossierCard(entity, makeScene(), { viewerX: 10, viewerY: 20 });
    card.update(0.5);

    expect(mesh.position.x).toBe(10);
  });

  it('shows first bullet immediately on the first update when projectileKeys are provided', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);
    const entity: WrappedEntity = { _mesh: mesh, update: vi.fn().mockReturnValue([]) };

    const bullet = makeBullet();
    const factory = vi.fn().mockReturnValue(bullet);

    const card = new TacticalDossierCard(entity, makeScene(), {
      viewerX: 0,
      viewerY: 0,
      projectileKeys: [ProjectileSourceKey.ENEMY_SINE],
      bulletFactory: factory,
    });

    expect(card.viewerBullet).toBeNull();

    card.update(0.1);
    expect(factory).toHaveBeenCalledWith(ProjectileSourceKey.ENEMY_SINE);
    expect(card.viewerBullet).toBe(bullet);
  });

  it('cycles to the next projectile key after 5 seconds', () => {
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
      projectileKeys: [ProjectileSourceKey.ENEMY_DIVER, ProjectileSourceKey.HOMING],
      bulletFactory: factory,
    });

    card.update(0.1);
    expect(card.viewerBullet).toBe(bullet1);

    card.update(4.9);
    expect(card.viewerBullet).toBe(bullet1);
    expect(bullet1.destroy).not.toHaveBeenCalled();

    card.update(0.1);
    expect(bullet1.destroy).toHaveBeenCalledTimes(1);
    expect(card.viewerBullet).toBe(bullet2);
    expect(factory).toHaveBeenCalledWith(ProjectileSourceKey.HOMING);
  });

  it('wraps around to the first projectile key after exhausting the list', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);
    const entity: WrappedEntity = { _mesh: mesh, update: vi.fn().mockReturnValue([]) };

    const bullets = [makeBullet(), makeBullet(), makeBullet()];
    let callCount = 0;
    const factory = vi.fn().mockImplementation(() => bullets[callCount++ % bullets.length]);

    const card = new TacticalDossierCard(entity, makeScene(), {
      viewerX: 0, viewerY: 0,
      projectileKeys: [ProjectileSourceKey.BOSS, ProjectileSourceKey.HOMING],
      bulletFactory: factory,
    });

    card.update(0.1);
    expect(factory).toHaveBeenLastCalledWith(ProjectileSourceKey.BOSS);

    card.update(5.0);
    expect(factory).toHaveBeenLastCalledWith(ProjectileSourceKey.HOMING);

    card.update(5.0);
    expect(factory).toHaveBeenLastCalledWith(ProjectileSourceKey.BOSS);
  });

  it('shows no bullet preview when projectileKeys is empty', () => {
    const mesh = new THREE.Mesh();
    const entity: WrappedEntity = { _mesh: mesh, update: vi.fn().mockReturnValue([]) };
    const factory = vi.fn();

    const card = new TacticalDossierCard(entity, makeScene(), {
      viewerX: 0, viewerY: 0,
      projectileKeys: [],
      bulletFactory: factory,
    });

    card.update(10);
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
      projectileKeys: [ProjectileSourceKey.ENEMY_SWARM],
      bulletFactory: factory,
    });

    card.update(0.1);

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
      projectileKeys: [ProjectileSourceKey.ENEMY],
      bulletFactory: factory,
    });

    card.update(0.1);
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

