# ADR 0013 — Vitest Module Test Harness

**Status:** Accepted  
**Date:** 2026-06-09

Vitest is the fast deterministic module test harness for AEON PULSE. It is used to protect deep module interfaces such as collision contact detection, combat resolution, campaign progression helpers, and wave timeline compilation; it does not replace browser playtesting or CDP render profiling for visual fidelity, gameplay feel, or render performance.

Tests are co-located with the modules they protect as `src/**/*.test.ts`, and the default Vitest environment is `node`. `vitest.config.ts` explicitly includes only source tests so temporary Chrome profile artifacts under `.tmp/` are not collected. The first protected seam is the collision/contact and combat-resolution split: `Collisions.ts` tests contact facts, while `CombatResolution.ts` tests resolved gameplay outcomes.

## Consequences

- `npm test` should run fast module tests.
- `npm run build` remains required verification.
- Browser playtesting remains required for gameplay and visual changes.
- The authorized CDP profiler remains required for render-performance work.
