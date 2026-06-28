# ADR 0026 — Playwright Automated Browser Tests

**Status:** Accepted  
**Date:** 2026-06-21

Browser automation for render profiling, smoke testing, and campaign-level validation needs a stable, cross-platform harness with broad community support. The previous hand-rolled Chrome DevTools Protocol scripts delivered raw frame data but were brittle, Windows-sensitive, and hard to maintain. We are replacing the CDP profiler suite with `@playwright/test` as the blessed browser automation layer while keeping Vitest module tests as the fast, deterministic node-environment harness.

## Decision

- Adopt `@playwright/test` as the single browser automation dependency for AEON PULSE.
- Vitest module tests in `src/**/*.test.ts` remain the fast, deterministic seam tests and do not require a browser.
- Playwright tests run against the production build served by `npm run preview -- --port 5174`, launched automatically via Playwright's `webServer` configuration.
- Default Playwright test URLs include both `?testAudio=off` (Audio-Suppressed Browser Test Run per ADR 0022) and `?testProbe=1`.
- `?testProbe=1` exposes `window.__aeonTestProbe`, the Playtest State Probe defined in CONTEXT.md, and authorizes direct level launch in the production build so automated tests can skip the title screen and exercise specific chapters/levels.
- The render-baseline profiler runs serially with `workers: 1` and writes JSON summaries to `.tmp/playwright-profile/`.
- In-game Playwright runs that depend on real WebGL rendering should prefer a **headed Chrome/Chromium session** on a desktop display. On some developer machines, the headless Playwright browser path can fail at `THREE.WebGLRenderer` initialization before `window.game` boots; the typical symptom is a black page with only the FPS counter visible. Headed Playwright Chromium remains an acceptable hardware-WebGL path and should be tried before reaching for a separate system Chrome binary.
- Delete the old CDP automation scripts `scripts/run-profiler.mjs` and `scripts/collect-render-stats.mjs`.
- Add npm scripts for Playwright: `npm run test:e2e` for the full end-to-end suite, `npm run test:e2e:ui` for headed debugging, and `npm run test:profile` for the render-baseline profiler.

## Consequences

- Browser automation gains better cross-platform stability, built-in tracing, and a standard fixture/page model at the cost of an additional dependency and slightly higher abstraction distance from raw CDP metrics.
- Render-profiling tests no longer need Windows-specific parent/child process spawning workarounds.
- Automated render-baseline results move from ad-hoc CDP JSON output to a reproducible Playwright project with deterministic worker concurrency and a fixed output directory.
- Production builds are now validated by Playwright, including direct-level entry via the test-probe flag; this tightens the release path and requires CI to run `npm run build` and `npm run test:e2e`.
- Manual CDP workflows documented in `AGENTS.md` and `docs/render-optimization-notes.md` become obsolete and must be replaced with Playwright equivalents.
- Future render-performance diagnostics should extend the Playwright profiler project rather than reviving the deleted CDP scripts.
