# AEON PULSE Vitest Harness And Next Test Slice Handoff

This handoff captures the current Vitest harness work and the agreed plan for the next module-test slices. It intentionally replaces the older render-optimization handoff, because that render scope was completed and committed earlier.

## Current State

- Node has been upgraded and is visible in this shell as `v24.16.0`.
- npm is visible as `11.13.0`.
- Vitest is installed on the current line: `vitest@^4.1.8`.
- `vitest.config.ts` limits collection to `src/**/*.test.ts` and uses the `node` environment, so Chrome profile artifacts under `.tmp/` are ignored.
- `package.json` now has:
  - `npm test` -> `vitest run`
  - `npm run test:watch` -> `vitest`
- ADR 0013 documents the Vitest module-test harness.
- `AGENTS.md` now describes `npm test` as part of normal verification.
- `CONTEXT.md` now includes these terms:
  - `Module Test Harness`
  - `Collision Contact`
  - `Combat Resolution`
  - `Wave Timeline Compiler`

## Tests Already Added

The first implemented slice protects the collision/contact and combat-resolution seam:

- `src/systems/Collisions.test.ts`
- `src/systems/CombatResolution.test.ts`

Current coverage:

- collision contacts are emitted in gameplay-relevant order
- piercing and non-piercing player bullet contacts are distinguished
- terrain contacts are suppressed when the player has no terrain bounds
- combat resolution mutates bullets/enemies/player/bosses correctly
- hit events are emitted for kills, boss hits, player hits, and powerup collection
- stale contact semantics are protected when an earlier contact mutates later resolution

Latest successful verification before this handoff:

- `npm test` passed: 2 files, 11 tests
- `npm run build` passed
- `git diff --check` passed

## Committed Baseline

This handoff is intended to travel with the Vitest harness baseline. The baseline includes:

- `AGENTS.md` verification guidance
- `CONTEXT.md` glossary terms
- `HANDOFF.md` continuation plan
- `package.json` and `package-lock.json`
- `docs/adr/0013-vitest-module-test-harness.md`
- `src/systems/Collisions.test.ts`
- `src/systems/CombatResolution.test.ts`
- `vitest.config.ts`

Run `git status --short` before continuing. If these files are still dirty, commit or account for them before adding the next test slice.

## Agreed Next Slice 1: Campaign Module Tests

Add `src/campaign/Campaign.test.ts`.

Agreed testing style:

- Use mostly behavioral invariants.
- Use exact assertions only for stable identity and cue mappings.
- Do not snapshot the entire `CAMPAIGN_LEVELS` array.

Recommended coverage:

- `CAMPAIGN_LEVELS` contains 20 levels in chapter/level order.
- `IMPLEMENTED_LEVELS` contains all 20 current levels.
- Every chapter has exactly levels `1..5`.
- Every `x-5` level is a finale.
- Finale levels have `clearType: 'chapter'`, `endAt: 0`, and a non-null `finaleBossArchetype`.
- Non-finale levels have `clearType: 'level'`, nonzero `endAt`, and `finaleBossArchetype: null`.
- Soft tier caps never decrease across the campaign.
- Exact chapter keys/names/archetypes are stable.
- `getMusicCueForChapterKey()` maps each `ChapterKey` to the expected `MusicCue`.
- `getNextImplementedLevel(last)` returns `null`.
- `getNextTitleLevel(last)` wraps to the first implemented level.
- `getPreviousImplementedLevel(first)` wraps to the last implemented level.
- `getCampaignLevel('9-9' as LevelId)` throws `Unknown campaign level`.
- `getNextImplementedLevel(fakeLevel)` throws when the input is not in `IMPLEMENTED_LEVELS`.
- `getPreviousImplementedLevel(fakeLevel)` throws for the same reason.
- `getNextTitleLevel(fakeLevel)` throws for the same reason.

Do not export private helpers just to test the internal monotonic-cap guard. The public nondecreasing-cap invariant is the useful protection.

## Agreed Next Slice 2: Timeline Compiler Tests

Add `src/level/waves/Timeline.test.ts`.

Agreed scope:

- Test the `Timeline` compiler contract first.
- Do not snapshot authored chapter wave content yet.
- Leave chapter wave content invariants for a later slice if needed.

Recommended coverage:

- `anchor(name, absoluteAt)` plus `add(anchor, offset, beat)` compiles `at = anchor + offset`.
- Entries are sorted by `at`, regardless of authoring order.
- Multiple beats or event arrays at the same compiled `at` are grouped into one `WaveEntry`.
- Grouped events preserve insertion order within that coordinate.
- Raw `StageEvent[]` inputs work the same as `BeatPattern`.
- `scale` multiplies offsets and uses `Math.round`.
- Include positive fractional rounding: `anchor 100`, `offset 21`, `scale 0.5` -> `at 111`.
- Include negative scaled offsets: `anchor 100`, `offset -21`, `scale 0.5` -> `at 90`.
- Missing anchors throw `Timeline: Anchor "x" is not defined.`

Recommended test file location:

- `src/level/waves/Timeline.test.ts`

## Deferred Test Ideas

Chapter wave builder tests can come later as invariant tests, not content snapshots:

- each valid chapter level builds nonempty waves
- waves are sorted by `at`
- event kinds are known `StageEventType` values
- spawn enemy events use valid `EnemyType` values
- unknown level IDs throw the existing chapter-specific error

`LevelManager` tests should wait until Campaign and Timeline are pinned. It has runtime host callbacks and is better treated as the third slice.

## Next Recommended Steps

1. Add `src/campaign/Campaign.test.ts`.
2. Add `src/level/waves/Timeline.test.ts`.
3. Run `npm test`.
4. Run `npm run build`.
5. Run `git diff --check`.
6. Commit the Campaign and Timeline test additions once green.
