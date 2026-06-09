# ADR 0015 — Strict Projectile Spawning Seam

**Status:** Accepted  
**Date:** 2026-06-09

To maximize rendering performance and eliminate memory allocations, all standard gameplay projectiles must be created via the centralized `ProjectilePool`. Direct instantiations of `new Bullet()` within standard gameplay entities (such as players, enemies, and bosses) are prohibited.

All projectile-emitting entities must receive a required `projectileFactory` callback parameter in their constructors. This enforces the dependency injection seam at compile time and prevents bypasses of the instancing pool.

## Consequences

- Direct `new Bullet()` calls are disallowed in all gameplay entities (under `src/entities/`). The only exceptions are the core `ProjectilePool.ts` itself and the Front-end sandbox preview inside `TacticalDatabase.ts`.
- Gameplay entities use the injected `projectileFactory` to emit bullets, ensuring 100% pooling and instancing compliance.
- Unit tests can cleanly inspect, count, or capture bullet spawns by passing mock factory callbacks without instantiating actual 3D components.
- Any future bosses, enemies, or weapon configurations must declare the `projectileFactory` parameter in their constructor arguments.
