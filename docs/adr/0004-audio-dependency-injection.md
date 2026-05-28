# ADR 0004 — Audio Dependency Injection via IAudio Interface

**Status:** Accepted  
**Date:** 2026-05-24

## Context

Every entity that plays sound (enemies, bosses, player, explosions) needs access to the audio system. The concrete implementation lives in `src/systems/audio/AudioManager.ts`. The straightforward approach is a direct import in each entity file.

## Decision

Entities never import `AudioManager` directly. Instead, a minimal interface is declared in `src/types.ts`:

```ts
export interface IAudio {
  play(soundName: string): void;
}
```

Entities that need audio accept `audio: IAudio | null` as a constructor parameter and call `audio?.play('soundName')` at the call site. `AudioManager` satisfies this interface structurally. The `null` case covers entities spawned in contexts where audio is unavailable (e.g. the Tactical Database viewer).

## Alternatives considered

**Direct `AudioManager` import** — simpler, one less indirection. Rejected because it couples every entity to a concrete system class. If `AudioManager` ever needs to reference entity state (e.g. for positional audio), circular imports become likely.

**Global singleton (`AudioManager.getInstance()`)** — no constructor threading required. Rejected because it makes the dependency invisible at construction sites and impossible to suppress cleanly in audio-free contexts like the viewer.

**Event bus** — entities emit named sound events; `AudioManager` subscribes. Fully decoupled, but adds a layer of indirection with no current benefit given the single audio consumer.

## Consequences

- Adding a new sound-playing entity requires accepting `IAudio | null` in its constructor and importing `IAudio` from `src/types.ts` — not `AudioManager`.
- The viewer and any future audio-free context pass `null`; call sites use optional chaining (`audio?.play(...)`).
- `AudioManager` remains invisible to the entire `src/entities/` layer.
