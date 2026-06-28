# Sector-based per-level environment variation

To stop every level in a chapter looking identical, each **Level** (see `CONTEXT.md`) maps to a named **Sector** — a chapter-local place with its own background treatment, terrain shape, and prop set. The Level→Sector mapping lives in `Campaign.ts` (the level-identity source of truth, per ADR 0007), and the Sector definitions live in a new per-chapter module family `src/level/sectors/chapterX.ts`, paralleling `src/level/waves/chapterX.ts` (ADR 0008). Background/terrain factory signatures gain the sector key the same way `buildWaves(level)` already receives the level record.

Putting both the mapping and the definitions in `Levels.ts` was rejected because it would bury level identity (which level is which place) in the implementation layer, breaking the identity-vs-implementation split that bosses and waves already follow.
