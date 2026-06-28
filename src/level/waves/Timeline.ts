import type { CorridorResolver } from '../CorridorResolver.ts';
import type { StageEvent, WaveEntry } from '../StageEvents.ts';

export enum BeatType {
  // Chapter 1
  STRAIGHT_ROW = 'straight-row',
  MIRROR_SINE = 'mirror-sine',
  SINE_TRIAD = 'sine-triad',
  DIVER_V = 'diver-v',
  SWARM_CLUSTER = 'swarm-cluster',
  RECOVERY_GAP = 'recovery-gap',
  MIXED_STRAIGHT_DIVER = 'mixed-straight-diver',
  MIXED_STRAIGHT_SINE = 'mixed-straight-sine',
  MIXED_DIVER_SINE = 'mixed-diver-sine',
  MIXED_SINE_DIVER = 'mixed-sine-diver',
  DUAL_STRAIGHT_SINE_ROW = 'dual-straight-sine-row',
  MIXED_STRAIGHT_DUAL_DIVER = 'mixed-straight-dual-diver',
  MIXED_MIRROR_SINE_DIVER_V = 'mixed-mirror-sine-diver-v',
  
  // Chapter 2
  TURRET = 'turret',
  CHARGER = 'charger',
  MIXED_STRAIGHT_TURRET = 'mixed-straight-turret',
  MIXED_MIRROR_SINE_TURRET = 'mixed-mirror-sine-turret',
  MIXED_TURRET_CHARGER = 'mixed-turret-charger',
  MIXED_SINE_CHARGER = 'mixed-sine-charger',
  MULTI_CHARGER = 'multi-charger',
  DUAL_DIVER_SINE_ROW = 'dual-diver-sine-row',

  // Chapter 3
  SINE_ROW = 'sine-row',
  MIRROR_SPORE = 'mirror-spore',
  OBSTACLE_PAIR = 'obstacle-pair',
  MIXED_MIRROR_SPORE_OBSTACLE = 'mixed-mirror-spore-obstacle',
  DANGEROUS_SPORE_SWARM_COMBO = 'dangerous-spore-swarm-combo',
  MIXED_CHARGER_OBSTACLE = 'mixed-charger-obstacle',
  MIXED_STRAIGHT_OBSTACLE = 'mixed-straight-obstacle',
  MIXED_SINE_OBSTACLE = 'mixed-sine-obstacle',
  MIXED_STRAIGHT_SPORE = 'mixed-straight-spore',
  SPORE_TRIAD = 'spore-triad',

  // Chapter 4
  ROCK_DRAKE = 'rock-drake',
  LAVA_PULSE = 'lava-pulse',
  STALACTITE_PAIR = 'stalactite-pair',
  STALACTITE_BARRAGE = 'stalactite-barrage',
  MIXED_STALACTITE_MIRROR_SINE = 'mixed-stalactite-mirror-sine',
  SWARM_CHOKEPOINT = 'swarm-chokepoint',
  LAVA_AND_DRAKE = 'lava-and-drake',
  MIXED_CHARGER_STALACTITE_BARRAGE = 'mixed-charger-stalactite-barrage',
  MIRROR_ROCK_DRAKE = 'mirror-rock-drake',
  LAVA_AND_TURRET = 'lava-and-turret',
  DUAL_TURRET_STALACTITE = 'dual-turret-stalactite',
  MIXED_DIVER_V_STALACTITE = 'mixed-diver-v-stalactite',
  FINAL_GAUNTLET = 'final-gauntlet',
}

export interface BeatPattern {
  name: BeatType;
  events: StageEvent[] | ((resolver: CorridorResolver, at: number) => StageEvent[]);
}

export class Timeline<Anchor extends string = string> {
  private _anchors = new Map<Anchor, number>();
  private _beats: { anchor: Anchor; offset: number; name: string; events: StageEvent[] | ((resolver: CorridorResolver, at: number) => StageEvent[]) }[] = [];
  private _scale: number;

  constructor(scale = 1.0) {
    this._scale = scale;
  }

  /**
   * Registers a named anchor marker locked to an absolute scroll position.
   */
  anchor(name: Anchor, absoluteAt: number): this {
    this._anchors.set(name, Math.round(absoluteAt * this._scale));
    return this;
  }

  /**
   * Adds a beat or raw event list at a relative offset from an anchor.
   */
  add(anchor: Anchor, offset: number, beat: BeatPattern | StageEvent[]): this {
    let name = 'custom';
    let events: StageEvent[] | ((resolver: CorridorResolver, at: number) => StageEvent[]) = [];
    if (Array.isArray(beat)) {
      events = beat;
    } else {
      name = beat.name;
      events = beat.events;
    }
    this._beats.push({ anchor, offset, name, events });
    return this;
  }

  /**
   * Compiles the timeline into a sorted, coordinate-deduplicated WaveEntry[] list.
   * Function-based beats receive the resolver and absolute scroll position.
   */
  build(resolver?: CorridorResolver): WaveEntry[] {
    const grouped = new Map<number, StageEvent[]>();

    for (const b of this._beats) {
      const anchorVal = this._anchors.get(b.anchor);
      if (anchorVal === undefined) {
        throw new Error(`Timeline: Anchor "${b.anchor}" is not defined.`);
      }
      const at = Math.round(anchorVal + b.offset * this._scale);

      const resolvedEvents = typeof b.events === 'function'
        ? b.events(resolver ?? this._requireResolver(b.name), at)
        : b.events;

      if (!grouped.has(at)) {
        grouped.set(at, []);
      }
      grouped.get(at)!.push(...resolvedEvents);
    }

    const sortedCoords = Array.from(grouped.keys()).sort((a, b) => a - b);
    return sortedCoords.map((at) => ({
      at,
      events: grouped.get(at)!,
    }));
  }

  private _requireResolver(beatName: string): CorridorResolver {
    throw new Error(`Timeline: Beat "${beatName}" requires a CorridorResolver but none was provided to build().`);
  }
}
