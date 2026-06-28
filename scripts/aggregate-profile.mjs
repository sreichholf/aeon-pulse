#!/usr/bin/env node

/**
 * Aggregate per-scenario Playwright profile summaries into a single JSON array.
 *
 * Reads `.tmp/playwright-profile/*.json` and prints the aggregated array to
 * stdout. This mirrors the rolling results array historically produced by the
 * CDP profiler in `scripts/collect-render-stats.mjs`.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PROFILE_DIR = process.env.PROFILE_DIR ?? '.tmp/playwright-profile';

async function aggregate() {
  let files;
  try {
    files = await readdir(PROFILE_DIR);
  } catch (error) {
    throw new Error(`Could not read profile directory ${PROFILE_DIR}: ${error.message}`);
  }

  const summaries = [];
  for (const file of files.sort()) {
    if (!file.endsWith('.json')) continue;

    const raw = await readFile(join(PROFILE_DIR, file), 'utf8');
    try {
      summaries.push(JSON.parse(raw));
    } catch (error) {
      throw new Error(`Failed to parse ${file}: ${error.message}`);
    }
  }

  if (summaries.length === 0) {
    throw new Error(`No profile summaries found in ${PROFILE_DIR}`);
  }

  console.log(JSON.stringify(summaries, null, 2));
}

aggregate().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
