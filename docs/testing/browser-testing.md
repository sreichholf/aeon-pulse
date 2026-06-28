# Browser Testing

Use this document when the task requires browser verification, gameplay smoke testing, render profiling, or Playwright/browser automation details. It is intentionally procedural and should be read on demand rather than loaded for every task.

## Verification

Repository verification remains:

1. `npm test`
2. `npm run build`
3. Browser-based playtesting at either `http://localhost:5173` for representative audio runs or `http://localhost:5173/?testAudio=off` for non-audio browser test runs

## Manual Playtesting

Use manual browser playtesting to verify gameplay feel, visuals, progression, and any change that touches entities, rendering, input, audio, UI, waves, terrain, or campaign flow.

### Setup

1. Run `npm run build` first. Fix build errors before opening the browser.
2. Start the dev server with `npm run dev`.
3. Choose the browser test entry URL for the concern under test:
   - Representative gameplay/audio run: `http://localhost:5173`
   - Audio-suppressed browser test run: `http://localhost:5173/?testAudio=off`
4. If another process owns port `5173`, use the alternate Vite URL printed by the command instead.
5. Use a fresh page load after code changes if HMR state may hide startup or constructor problems.

### In-App Browser Control

- When the Codex Browser plugin is available, use the plugin skill instructions for `browser:control-in-app-browser`.
- The in-app browser may not appear as a direct `browser.*` tool namespace. Control it through the Browser plugin bootstrap path, which uses the Node REPL `js` tool and the plugin's `scripts/browser-client.mjs`, then selects the `iab` browser.
- If the user already has the in-app browser open at `http://localhost:5173/`, prefer attaching to that browser surface instead of launching a separate Chrome/CDP session.
- Only fall back to the authorized CDP workflow below when the in-app browser cannot be started or controlled, and report that manual visual inspection was not completed.

### Starting A Focused Test Run

- On the title screen, press `Tab` to cycle difficulty mode.
- In development builds, press `UP` / `DOWN` to choose a campaign level and `LEFT` / `RIGHT` to choose the starting weapon tier.
- Press `Enter` or `Space` to start.
- In ordinary runs, use `M` to toggle music.
- In `?testAudio=off` runs, use `M` to toggle full test audio for the current run.
- In `?testAudio=off` runs, the volume/control surface should show explicit test-audio state such as `TEST AUDIO OFF` or `TEST AUDIO ON`; treat missing indicator state as a regression.
- Use `V` from the title screen to open the tactical database when validating entity or boss presentation.

### Core Controls During Play

- Move with `W` / `A` / `S` / `D` or arrow keys.
- Fire or charge with `Space`.
- Pause/unpause with `Escape` or `P`.
- Continue through interstitial screens with `Enter` or `Space`.

### Gameplay Smoke Checklist

- Start at least one early level, one terrain-heavy level, and any level directly affected by the change.
- Confirm the player can move, fire, take hits, collect powerups, pause, resume, die, and continue/restart without console errors.
- For level or wave changes, play until the authored clear gate, exit flyout, boss spawn, or level-complete screen is reached.
- For boss changes, verify entrance, phase transitions, attacks, hit flash, death sequence, scoring, and post-boss progression.
- For difficulty changes, test at least Rookie and Ace if shields, damage, scoring, or high scores are involved.

### Visual/Render Smoke Checklist

- Watch changed entities at gameplay scale and in the tactical database when cataloged there.
- Verify moving parts still animate independently: claws, wings, recoil groups, nozzles, flames, warning lights, pupils, trails, and boss sub-groups should not be frozen by geometry merging.
- Verify transparent pieces still blend correctly and are not hidden behind merged opaque geometry.
- Verify damage flashes, charge pulses, muzzle flashes, and emissive warning states affect only the intended parts.
- Watch for z-fighting, missing geometry, wrong pivots, inverted rotations, oversized hit visuals, blank meshes, or objects that remain after death.

### Render-Stat Playtesting

- Use the FPS/render counter when `ENABLE_RENDER_STATS` is enabled or via the runtime flag query-string override.
- Default non-audio render-stat runs to `?testAudio=off`; keep the plain URL for audio-focused browser checks.
- Exercise dense scenes with no-fire and tier-5 tap-fire patterns.
- Compare draw-call peaks against recent profiler runs before declaring a render optimization complete.
- If the in-app browser cannot start, fall back to the authorized CDP profiler workflow below and report that manual visual inspection was not completed.

## Automated Browser Testing

Automated browser tests run through Playwright (`@playwright/test`). Playwright owns the browser lifecycle, so the old CDP-based profiler scripts (`scripts/run-profiler.mjs` and `scripts/collect-render-stats.mjs`) have been removed.

For **in-game** browser tests that need actual WebGL rendering (gameplay smoke tests, render-stat runs, profiler baselines, screenshot review), prefer a **headed Chrome/Chromium session on the active desktop** so the browser gets hardware-accelerated WebGL. On this machine, headless Playwright browser runs can fail before `window.game` boots with `THREE.WebGLRenderer: Error creating WebGL context.` The failure signature is a black game surface with only the FPS counter visible and no `window.__aeonTestProbe` / `window.game`. Treat headed Chrome/Chromium as the default for render-sensitive browser work unless you have already verified the headless path on the current machine.

Available npm scripts:

- `npm run test:e2e` — build the production bundle and run all Playwright tests
- `npm run test:e2e:ui` — run Playwright in UI mode
- `npm run test:e2e:debug` — run Playwright in debug mode
- `npm run profile` — run the render-baseline scenarios via Playwright

By default, Playwright tests target `http://127.0.0.1:5174` (the production preview server) and start each scenario with `?testAudio=off`. Use the plain URL only when audio behavior is itself the concern under test.

Render-baseline scenarios run serially to avoid contention and write JSON summaries to `.tmp/playwright-profile/`. Use these summaries to compare draw-call peaks and frame timing against the current baseline after render-performance changes.

For render-baseline or other in-game Playwright runs on developer machines, use a **headed** browser launch when hardware WebGL matters. A simple `npx playwright test --project=render-baseline --headed` is preferable to a headless run if the headless browser cannot create a WebGL context. Headed **Playwright Chromium itself is sufficient**; do not assume you need the system Chrome binary unless Playwright Chromium has also been proven bad on the current machine.

### Campaign coverage

`e2e/specs/campaign-coverage.spec.ts` boots all 20 implemented levels in parallel (plus a finale-boss-spawn check for each chapter) and is the broadest "everything still loads" regression gate. Because it runs many browser contexts at once, it is especially sensitive to software WebGL: under headless / swiftshader the parallel load collapses FPS to ~1–2, which surfaces as spurious `Timed out waiting for game boot` probe polls and `Tearing down "context" exceeded the test timeout` hangs — even though every level is in fact rendering (the page snapshot shows draw calls, enemies, and boss present). Always run it **headed** so each context gets hardware-accelerated WebGL:

```
npx playwright test e2e/specs/campaign-coverage.spec.ts --reporter=line
```

Do not set `PW_HEADLESS=1` for this suite. Local Playwright Chromium headed is sufficient; do not reach for the system Chrome binary unless Playwright Chromium is proven bad on the current machine.

Baseline acceptance rule: do **not** accept a profiler run as baseline data when the metrics indicate an unpopulated or broken scene. Suspicious signs include extremely low triangles or draw calls for the scenario, `OBJECTS 0`, missing enemy/bullet ownership, or `PLAYING` without a live gameplay run. Treat these as failed measurements and inspect the browser console / runtime probe before updating `docs/render-baseline.md`.

The previous Windows CDP security issue (headless Chrome being killed when a separate Node process connected to port `9222`) no longer applies because Playwright manages the browser lifecycle.
