/**
 * Profiler orchestrator.
 *
 * Spawns headless Edge (or Chrome) as a child process of Node so that CDP
 * connections from Node are accepted by Windows security policy.
 * Then imports and runs collect-render-stats.mjs with the browser already live.
 *
 * Usage:
 *   node scripts/run-profiler.mjs
 *
 * Env overrides (pass-through to collect-render-stats.mjs):
 *   PROFILE_MODE, SCENARIOS, DURATION_SCALE, BASE_URL
 *
 *   PROFILE_MODE=baseline      — normal cross-scenario summary (default)
 *   PROFILE_MODE=long-frames   — targeted PerfProbe long-frame capture
 *
 * Env flags for this script:
 *   BROWSER_EXE=<path> — force a specific Edge/Chrome executable.
 *   USE_SWIFTSHADER=1  — force software WebGL via SwiftShader (fallback when
 *                        no GPU is available or hardware WebGL fails to init).
 *                        Default: hardware GPU is used.
 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Browser candidates (first found wins) ──────────────────────────────────
const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

const CDP_PORT = Number(process.env.CDP_PORT ?? 9222);
const PROFILE_DIR = join(ROOT, '.tmp', 'profiler-profile');
const USE_SWIFTSHADER = process.env.USE_SWIFTSHADER === '1';

function findBrowser() {
  if (process.env.BROWSER_EXE) {
    if (existsSync(process.env.BROWSER_EXE)) return process.env.BROWSER_EXE;
    throw new Error(`BROWSER_EXE does not exist: ${process.env.BROWSER_EXE}`);
  }

  for (const p of BROWSER_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error('No supported browser found. Install Edge or Chrome.');
}

function resetProfileDir() {
  if (existsSync(PROFILE_DIR)) rmSync(PROFILE_DIR, { recursive: true, force: true });
  mkdirSync(PROFILE_DIR, { recursive: true });
}

async function waitForCdp(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`CDP did not become ready on port ${port} within ${timeoutMs}ms`);
}

// ── Spawn browser ───────────────────────────────────────────────────────────
const browserExe = findBrowser();
console.error(`[orchestrator] browser: ${browserExe}`);

resetProfileDir();

const glMode = USE_SWIFTSHADER ? 'swiftshader (software)' : 'hardware GPU';
console.error(`[orchestrator] WebGL mode: ${glMode}`);

const browserArgs = [
  '--headless',
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--no-first-run',
  ...(USE_SWIFTSHADER ? ['--use-gl=swiftshader'] : []),
  'about:blank',
];

const browser = spawn(browserExe, browserArgs, { stdio: 'ignore', detached: false });

browser.on('exit', (code) => {
  console.error(`[orchestrator] browser exited (code=${code})`);
});

// Give it a moment to bind the port
await waitForCdp(CDP_PORT);
console.error(`[orchestrator] CDP ready on port ${CDP_PORT}`);

// ── Run the stat collector ──────────────────────────────────────────────────
process.env.CDP_BASE = `http://127.0.0.1:${CDP_PORT}`;

let exitCode = 0;
try {
  await import('./collect-render-stats.mjs');
} catch (err) {
  console.error('[orchestrator] collector error:', err);
  exitCode = 1;
} finally {
  browser.kill();
  process.exit(exitCode);
}
