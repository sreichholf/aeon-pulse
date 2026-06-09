import { describe, expect, it } from 'vitest';
import { Timeline, BeatPattern, BeatType } from './Timeline.ts';
import { StageEventType } from '../StageEvents.ts';

describe('Timeline wave compiler', () => {
  it('compiles at = anchor + offset when using default scale 1.0', () => {
    const timeline = new Timeline();
    timeline.anchor('start', 100);
    timeline.add('start', 20, [{ kind: StageEventType.LAVA_PULSE }]);

    const compiled = timeline.build();
    expect(compiled).toEqual([
      { at: 120, events: [{ kind: StageEventType.LAVA_PULSE }] }
    ]);
  });

  it('sorts compiled wave entries by absolute position (at) regardless of authoring order', () => {
    const timeline = new Timeline();
    timeline.anchor('mid', 200);
    timeline.anchor('start', 100);

    timeline.add('mid', 50, [{ kind: StageEventType.LAVA_PULSE }]); // at: 250
    timeline.add('start', 10, [{ kind: StageEventType.LAVA_PULSE }]); // at: 110
    timeline.add('mid', -20, [{ kind: StageEventType.LAVA_PULSE }]); // at: 180

    const compiled = timeline.build();
    expect(compiled.map((entry) => entry.at)).toEqual([110, 180, 250]);
  });

  it('groups multiple beats or event arrays at the same compiled coordinate (at) into one WaveEntry', () => {
    const timeline = new Timeline();
    timeline.anchor('start', 100);

    const event1 = { kind: StageEventType.LAVA_PULSE };
    const event2 = { kind: StageEventType.LAVA_PULSE };

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

    const eventA1 = { kind: StageEventType.LAVA_PULSE };
    const eventA2 = { kind: StageEventType.LAVA_PULSE };
    const eventB1 = { kind: StageEventType.LAVA_PULSE };

    timeline.add('start', 30, [eventA1, eventA2]);
    timeline.add('start', 30, [eventB1]);

    const compiled = timeline.build();
    expect(compiled[0].events).toEqual([eventA1, eventA2, eventB1]);
  });

  it('accepts both raw StageEvent[] arrays and BeatPattern objects', () => {
    const timeline = new Timeline();
    timeline.anchor('start', 100);

    const rawEvents = [{ kind: StageEventType.LAVA_PULSE }];
    const beatPattern: BeatPattern = {
      name: BeatType.STRAIGHT_ROW,
      events: [{ kind: StageEventType.LAVA_PULSE }]
    };

    timeline.add('start', 10, rawEvents);
    timeline.add('start', 20, beatPattern);

    const compiled = timeline.build();
    expect(compiled.length).toBe(2);
    expect(compiled[0].events).toEqual(rawEvents);
    expect(compiled[1].events).toEqual(beatPattern.events);
  });

  it('applies scale multiplier to offsets and uses Math.round for absolute positioning', () => {
    const scale = 0.5;
    const timeline = new Timeline(scale);
    timeline.anchor('start', 100);

    // positive fractional rounding: anchor 100 * 0.5 = 50, offset 21, scale 0.5 -> Math.round(50 + 10.5) -> 61
    timeline.add('start', 21, [{ kind: StageEventType.LAVA_PULSE }]);

    // negative scaled offsets: anchor 100 * 0.5 = 50, offset -21, scale 0.5 -> Math.round(50 - 10.5) -> 40
    timeline.add('start', -21, [{ kind: StageEventType.LAVA_PULSE }]);

    const compiled = timeline.build();
    expect(compiled.map((e) => e.at)).toEqual([40, 61]);
  });

  it('throws an error if an anchor referenced by add() is not defined during compile', () => {
    const timeline = new Timeline();
    timeline.add('missing-anchor', 10, [{ kind: StageEventType.LAVA_PULSE }]);

    expect(() => timeline.build()).toThrow('Timeline: Anchor "missing-anchor" is not defined.');
  });
});
