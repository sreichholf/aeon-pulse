import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TacticalDossierCard, type WrappedEntity } from './TacticalDossierCard.ts';
import { type IBullet } from '../types.ts';

describe('TacticalDossierCard', () => {
  const mockScene = {
    add: vi.fn(),
    remove: vi.fn(),
  };

  it('can wrap a basic THREE.Object3D (display model)', () => {
    const group = new THREE.Group();
    group.position.set(10, 20, 30);
    group.rotation.set(0.1, 0.2, 0.3);

    const card = new TacticalDossierCard(group, mockScene, { viewerIdle: true });

    expect(card.entity).toBe(group);
    expect(card.mesh).toBe(group);
    expect(card.viewerX).toBe(10);
    expect(card.viewerY).toBe(20);
    expect(card.metadata).toBeUndefined();
    expect(card.isBoss).toBe(false);
  });

  it('can wrap a gameplay entity and set appropriate viewer flags', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(15, 25, 0);

    const entity: WrappedEntity = {
      _mesh: mesh,
      metadata: { displayName: 'Test Enemy', hp: 100, score: 50 },
      isBoss: true,
      viewerXOffset: 5,
    };

    const card = new TacticalDossierCard(entity, mockScene);

    expect(card.entity).toBe(entity);
    expect(card.mesh).toBe(mesh);
    expect(card.viewerX).toBe(15);
    expect(card.viewerY).toBe(25);
    expect(card.metadata?.displayName).toBe('Test Enemy');
    expect(card.isBoss).toBe(true);

    // Verify it mutated standard gameplay entity flags appropriately for the viewer
    expect(entity._isViewer).toBe(true);
    expect(entity._entered).toBe(true);
    expect(typeof entity._getPlayerPos).toBe('function');
    expect(entity._getPlayerPos!()).toEqual({ x: 0, y: 0 });
  });

  it('performs idle float and rotation animations when viewerIdle is true', () => {
    const group = new THREE.Group();
    group.position.set(0, 10, 0);

    const card = new TacticalDossierCard(group, mockScene, { viewerIdle: true });

    // Update with dt
    card.update(0.5);

    expect(card.viewerTime).toBe(0.5);
    // Y position should have changed due to sine float animation
    expect(group.position.y).not.toBe(10);
    expect(group.position.y).toBeCloseTo(10 + Math.sin(0.5 * 1.4) * 2.2, 4);
  });

  it('ticks the wrapped entity update/tick method and handles bullet previews', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(10, 10, 0);

    const mockBulletMesh = new THREE.Mesh();
    const mockBullet: IBullet = {
      _mesh: mockBulletMesh,
      update: vi.fn(),
      destroy: vi.fn(),
      active: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      width: 5,
      height: 5,
    } as unknown as IBullet;

    const mockEntity: WrappedEntity = {
      _mesh: mesh,
      update: vi.fn().mockReturnValue([mockBullet]),
      isBoss: false,
    };

    const card = new TacticalDossierCard(mockEntity, mockScene, {
      viewerX: 10,
      viewerY: 10,
    });

    // Run first update
    card.update(0.1);

    expect(mockEntity.update).toHaveBeenCalledWith(0.1);
    expect(card.viewerBullet).toBe(mockBullet);

    // Verify bullet update was called
    expect(mockBullet.update).toHaveBeenCalledWith(0.1);
    // Bullet scale should be increased by 40% (1.4)
    expect(mockBulletMesh.scale.x).toBeCloseTo(1.4, 4);

    // Let's verify position locking and lerping
    // targetY = viewerY + (this._viewerBullet ? (isBoss ? 24 : 22) : (isBoss ? 8 : 6))
    // With bullet and isBoss = false, targetY = 10 + 22 = 32.
    // targetX = viewerX + viewerXOffset = 10 + 0 = 10.
    // On first update, _viewerCurrentX/Y are initialized directly to targetX/Y.
    expect(mesh.position.x).toBe(10);
    expect(mesh.position.y).toBe(32);

    // If we update again, let's see if we lerp towards the target
    card.update(0.1);
    expect(mesh.position.x).toBe(10);
    expect(mesh.position.y).toBe(32);
  });

  it('cleans up excess spawned bullets and destroys previous bullet on new bullet spawn', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);

    const mockBullet1 = {
      _mesh: new THREE.Mesh(),
      update: vi.fn(),
      destroy: vi.fn(),
    };
    const mockBullet2 = {
      _mesh: new THREE.Mesh(),
      update: vi.fn(),
      destroy: vi.fn(),
    };
    const mockBullet3 = {
      _mesh: new THREE.Mesh(),
      update: vi.fn(),
      destroy: vi.fn(),
    };

    const mockEntity: WrappedEntity = {
      _mesh: mesh,
      // First update returns 2 bullets, second returns 1 new bullet
      update: vi.fn()
        .mockReturnValueOnce([mockBullet1, mockBullet2])
        .mockReturnValueOnce([mockBullet3]),
    };

    const card = new TacticalDossierCard(mockEntity, mockScene);

    // First update: should store mockBullet1, and immediately destroy mockBullet2 (excess)
    card.update(0.1);
    expect(card.viewerBullet).toBe(mockBullet1);
    expect(mockBullet2.destroy).toHaveBeenCalled();
    expect(mockBullet1.destroy).not.toHaveBeenCalled();

    // Second update: should replace mockBullet1 with mockBullet3, destroying mockBullet1
    card.update(0.1);
    expect(card.viewerBullet).toBe(mockBullet3);
    expect(mockBullet1.destroy).toHaveBeenCalled();
  });

  it('cleans up resources on destroy()', () => {
    const mesh = new THREE.Mesh();
    const mockGeometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const mockMaterialDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');

    const mockBullet = {
      _mesh: new THREE.Mesh(),
      update: vi.fn(),
      destroy: vi.fn(),
    };

    const mockEntity: WrappedEntity = {
      _mesh: mesh,
      update: vi.fn().mockReturnValue([mockBullet]),
      isMesh: true,
    };

    const card = new TacticalDossierCard(mockEntity, mockScene);
    card.update(0.1); // spawns bullet

    card.destroy();

    // Verify bullet destroyed
    expect(mockBullet.destroy).toHaveBeenCalled();
    expect(card.viewerBullet).toBeNull();

    // Verify scene removes mesh and disposes geometries/materials
    expect(mockScene.remove).toHaveBeenCalledWith(mesh);
    expect(mockGeometryDispose).toHaveBeenCalled();
    expect(mockMaterialDispose).toHaveBeenCalled();
  });

  it('traverses and disposes cloned display models on destroy()', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh();
    const mockGeometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const mockMaterialDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');
    group.add(mesh);

    const card = new TacticalDossierCard(group, mockScene);
    card.destroy();

    expect(mockScene.remove).toHaveBeenCalledWith(group);
    expect(mockGeometryDispose).toHaveBeenCalled();
    expect(mockMaterialDispose).toHaveBeenCalled();
  });

  it('zeros fire-cooldown timers on construction to eliminate viewer delay', () => {
    const mesh = new THREE.Mesh();
    const entity: WrappedEntity = {
      _mesh: mesh,
      _fireTimer: 2.5,
      _circTimer: 4.0,
      _homingTimer: 1.5,
      _lavaTimer: 3.0,
      _patternTimers: { p1: 1.0, p2: 0.8 },
      update: vi.fn().mockReturnValue([]),
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _card = new TacticalDossierCard(entity, mockScene);

    // All timers must have been zeroed so the first shot fires on the very next tick
    expect(entity._fireTimer).toBe(0);
    expect(entity._circTimer).toBe(0);
    expect(entity._homingTimer).toBe(0);
    expect(entity._lavaTimer).toBe(0);
    expect((entity._patternTimers as Record<string, number>)['p1']).toBe(0);
    expect((entity._patternTimers as Record<string, number>)['p2']).toBe(0);
  });

  it('keeps bullet preview visible after 1.5 s (stale) and only replaces on a new bullet', () => {
    const mesh = new THREE.Mesh();
    mesh.position.set(0, 0, 0);

    const mockBullet1 = { _mesh: new THREE.Mesh(), update: vi.fn(), destroy: vi.fn() };
    const mockBullet2 = { _mesh: new THREE.Mesh(), update: vi.fn(), destroy: vi.fn() };

    const mockEntity: WrappedEntity = {
      _mesh: mesh,
      // First call spawns bullet1, subsequent calls return nothing until bullet2 arrives
      update: vi.fn()
        .mockReturnValueOnce([mockBullet1])
        .mockReturnValue([]),
    };

    const card = new TacticalDossierCard(mockEntity, mockScene);

    // Spawn bullet1
    card.update(0.1);
    expect(card.viewerBullet).toBe(mockBullet1);

    // Advance past the 1.5 s lifetime — bullet1 should still be visible (not destroyed)
    card.update(1.5);
    expect(card.viewerBullet).toBe(mockBullet1);
    expect(mockBullet1.destroy).not.toHaveBeenCalled();

    // When a new bullet arrives, the stale bullet1 is destroyed and bullet2 takes over
    (mockEntity.update as ReturnType<typeof vi.fn>).mockReturnValueOnce([mockBullet2]);
    card.update(0.1);
    expect(mockBullet1.destroy).toHaveBeenCalledTimes(1);
    expect(card.viewerBullet).toBe(mockBullet2);
  });
});
