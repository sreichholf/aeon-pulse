import { describe, expect, it } from 'vitest';
import { Timeline, BeatPattern, BeatType } from './Timeline.ts';
import { lavaPulseEvent, spawnEnemyEvent, StageEventType } from '../StageEvents.ts';
import { EnemyType } from '../../types.ts';
import type { CorridorResolver } from '../CorridorResolver.ts';

describe('Timeline wave compiler', () => {
  it('compiles at = anchor + offset when using default scale 1.0', () => {
    const timeline = new Timeline();
    timeline.anchor('start', 100);
    timeline.add('start', 20, [lavaPulseEvent()]);

    const compiled = timeline.build();
    expect(compiled).toEqual([
      { at: 120, events: [lavaPulseEvent()] }
    ]);
  });

  it('sorts compiled wave entries by absolute position (at) regardless of authoring order', () => {
    const timeline = new Timeline();
    timeline.anchor('mid', 200);
    timeline.anchor('start', 100);

    timeline.add('mid', 50, [lavaPulseEvent()]); // at: 250
    timeline.add('start', 10, [lavaPulseEvent()]); // at: 110
    timeline.add('mid', -20, [lavaPulseEvent()]); // at: 180

    const compiled = timeline.build();
    expect(compiled.map((entry) => entry.at)).toEqual([110, 180, 250]);
  });

  it('groups multiple beats or event arrays at the same compiled coordinate (at) into one WaveEntry', () => {
    const timeline = new Timeline();
    timeline.anchor('start', 100);

    const event1 = lavaPulseEvent();
    const event2 = lavaPulseEvent();

    timeline.add('start', 20, [event1]);
    timeline.add('start', 20, [event2]);

    const compiled = timeline.build();
    expect(compiled).toEqual([
      { at: 120, events: [event1, event2] }
    ]);
  });

  it('preserves insertion order of events when grouping at the same coordinate', () => {
    const timeline = new Timeline();
    timeline.anchor('start', 100);

    const eventA1 = lavaPulseEvent();
    const eventA2 = lavaPulseEvent();
    const eventB1 = lavaPulseEvent();

    timeline.add('start', 30, [eventA1, eventA2]);
    timeline.add('start', 30, [eventB1]);

    const compiled = timeline.build();
    expect(compiled[0]!.events).toEqual([eventA1, eventA2, eventB1]);
  });

  it('accepts both raw StageEvent[] arrays and BeatPattern objects', () => {
    const timeline = new Timeline();
    timeline.anchor('start', 100);

    const rawEvents = [lavaPulseEvent()];
    const beatPattern: BeatPattern = {
      name: BeatType.STRAIGHT_ROW,
      events: [lavaPulseEvent()]
    };

    timeline.add('start', 10, rawEvents);
    timeline.add('start', 20, beatPattern);

    const compiled = timeline.build();
    expect(compiled.length).toBe(2);
    expect(compiled[0]!.events).toEqual(rawEvents);
    expect(compiled[1]!.events).toEqual(beatPattern.events);
  });

  it('applies scale multiplier to offsets and uses Math.round for absolute positioning', () => {
    const scale = 0.5;
    const timeline = new Timeline(scale);
    timeline.anchor('start', 100);

    // positive fractional rounding: anchor 100 * 0.5 = 50, offset 21, scale 0.5 -> Math.round(50 + 10.5) -> 61
    timeline.add('start', 21, [lavaPulseEvent()]);

    // negative scaled offsets: anchor 100 * 0.5 = 50, offset -21, scale 0.5 -> Math.round(50 - 10.5) -> 40
    timeline.add('start', -21, [lavaPulseEvent()]);

    const compiled = timeline.build();
    expect(compiled.map((e) => e.at)).toEqual([40, 61]);
  });

  it('throws an error if an anchor referenced by add() is not defined during compile', () => {
    const timeline = new Timeline();
    timeline.add('missing-anchor', 10, [lavaPulseEvent()]);

    expect(() => timeline.build()).toThrow('Timeline: Anchor "missing-anchor" is not defined.');
  });

  it('resolves function-based beats with the provided resolver and absolute scroll position', () => {
    const timeline = new Timeline();
    timeline.anchor('start', 100);

    const resolver: CorridorResolver = {
      getBoundsAt: () => ({ top: 200, bottom: -200 }),
      getSafeSpawnY: (_type, at, coord) => at + coord,
    };

    const functionalBeat: BeatPattern = {
      name: BeatType.STRAIGHT_ROW,
      events: (r, at) => [
        spawnEnemyEvent(EnemyType.STRAIGHT, at, r.getSafeSpawnY(EnemyType.STRAIGHT, at, 0.5)),
      ],
    };

    timeline.add('start', 20, functionalBeat);

    const compiled = timeline.build(resolver);
    expect(compiled).toEqual([
      {
        at: 120,
        events: [spawnEnemyEvent(EnemyType.STRAIGHT, 120, 120.5)],
      },
    ]);
  });

  it('throws when a function-based beat is compiled without a resolver', () => {
    const timeline = new Timeline();
    timeline.anchor('start', 100);

    const functionalBeat: BeatPattern = {
      name: BeatType.STRAIGHT_ROW,
      events: () => [lavaPulseEvent()],
    };

    timeline.add('start', 20, functionalBeat);

    expect(() => timeline.build()).toThrow('Timeline: Beat "straight-row" requires a CorridorResolver but none was provided to build().');
  });
});
