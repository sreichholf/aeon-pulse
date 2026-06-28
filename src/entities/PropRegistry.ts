import { PropType, PropEffectKind, PropCollisionShape } from '../types.ts';
import type { IScene } from '../types.ts';
import { Prop, type PropOverrides, type PropProfile } from './Prop.ts';

// First-pass balance values. Chapter-specific visuals/layouts are authored in
// Sector definitions; PropRegistry stays responsible for the shared gameplay
// profile of each PropType.
const PROFILES: Record<PropType, PropProfile> = {
  [PropType.SENSOR_POD]: {
    propType: PropType.SENSOR_POD, hp: 4, scoreValue: 150,
    effects: [PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP], clearRadius: 80, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0, hw: 14, hh: 14,
  },
  [PropType.CARGO_CANISTER]: {
    propType: PropType.CARGO_CANISTER, hp: 6, scoreValue: 250,
    effects: [PropEffectKind.SCORE_DROP, PropEffectKind.POWERUP_DROP], clearRadius: 0, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0.15, hw: 16, hh: 16,
  },
  [PropType.SHIELD_RELAY]: {
    propType: PropType.SHIELD_RELAY, hp: 10, scoreValue: 300,
    effects: [PropEffectKind.HAZARD_RELEASE, PropEffectKind.SCORE_DROP], clearRadius: 0, hazardRadius: 70, hazardDuration: 1.2,
    burstWindow: 5, dropPowerupChance: 0, hw: 14, hh: 18,
  },
  [PropType.FUEL_TANK]: {
    propType: PropType.FUEL_TANK, hp: 5, scoreValue: 300,
    effects: [PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP], clearRadius: 100, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0, hw: 16, hh: 20,
  },
  [PropType.CONVEYOR_NODE]: {
    propType: PropType.CONVEYOR_NODE, hp: 8, scoreValue: 350,
    effects: [PropEffectKind.SCORE_DROP, PropEffectKind.POWERUP_DROP], clearRadius: 0, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0.35, hw: 18, hh: 14,
  },
  [PropType.FURNACE_VENT]: {
    propType: PropType.FURNACE_VENT, hp: 6, scoreValue: 300,
    effects: [PropEffectKind.HAZARD_RELEASE, PropEffectKind.SCORE_DROP], clearRadius: 0, hazardRadius: 110, hazardDuration: 3,
    burstWindow: 6, dropPowerupChance: 0, hw: 14, hh: 16,
  },
  [PropType.SPORE_POD]: {
    propType: PropType.SPORE_POD, hp: 4, scoreValue: 200,
    effects: [PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP], clearRadius: 90, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0, hw: 14, hh: 14,
  },
  [PropType.EGG_SAC]: {
    propType: PropType.EGG_SAC, hp: 5, scoreValue: 250,
    effects: [PropEffectKind.HAZARD_RELEASE, PropEffectKind.SCORE_DROP], clearRadius: 0, hazardRadius: 95, hazardDuration: 2.5,
    burstWindow: 6.5, dropPowerupChance: 0, hw: 16, hh: 18,
  },
  [PropType.HIVE_BULB]: {
    propType: PropType.HIVE_BULB, hp: 12, scoreValue: 500,
    effects: [PropEffectKind.SCORE_DROP, PropEffectKind.POWERUP_DROP], clearRadius: 0, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0.15, hw: 16, hh: 20,
  },
  [PropType.BRITTLE_BASALT_COLUMN]: {
    propType: PropType.BRITTLE_BASALT_COLUMN, hp: 5, scoreValue: 250,
    effects: [PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP], clearRadius: 100, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0, hw: 16, hh: 36,
  },
  [PropType.HANGING_MAGMA_SAC]: {
    propType: PropType.HANGING_MAGMA_SAC, hp: 5, scoreValue: 300,
    effects: [PropEffectKind.HAZARD_RELEASE, PropEffectKind.SCORE_DROP], clearRadius: 0, hazardRadius: 115, hazardDuration: 3.2,
    burstWindow: 5.8, dropPowerupChance: 0, hw: 14, hh: 18,
  },
  [PropType.CRYSTAL_OUTCROP]: {
    propType: PropType.CRYSTAL_OUTCROP, hp: 10, scoreValue: 500,
    effects: [PropEffectKind.SCORE_DROP, PropEffectKind.POWERUP_DROP], clearRadius: 0, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0.15, hw: 18, hh: 18,
  },
  // v2 solid props
  [PropType.HULL_BULKHEAD]: {
    propType: PropType.HULL_BULKHEAD, hp: 4, scoreValue: 200,
    effects: [PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP], clearRadius: 80, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0, hw: 8, hh: 46,
    isSolid: true, collisionShape: PropCollisionShape.BOX, fullGate: false,
  },
  [PropType.COOLING_PLUG]: {
    propType: PropType.COOLING_PLUG, hp: 7, scoreValue: 300,
    effects: [PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP], clearRadius: 90, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0, hw: 22, hh: 22,
    isSolid: true, collisionShape: PropCollisionShape.BOX, fullGate: false,
  },
  [PropType.BONE_DAM]: {
    propType: PropType.BONE_DAM, hp: 5, scoreValue: 250,
    effects: [PropEffectKind.HAZARD_RELEASE, PropEffectKind.SCORE_DROP], clearRadius: 0, hazardRadius: 100, hazardDuration: 2.5,
    burstWindow: Infinity, dropPowerupChance: 0, hw: 18, hh: 18,
    isSolid: true, collisionShape: PropCollisionShape.CIRCLE, fullGate: false,
  },
  [PropType.BASALT_GATE]: {
    propType: PropType.BASALT_GATE, hp: 9, scoreValue: 400,
    effects: [PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP, PropEffectKind.POWERUP_DROP], clearRadius: 100, hazardRadius: 0, hazardDuration: 0,
    burstWindow: Infinity, dropPowerupChance: 0.15, hw: 12, hh: 80,
    isSolid: true, collisionShape: PropCollisionShape.BOX, fullGate: false,
  },
};

export function getPropProfile(propType: PropType): PropProfile {
  return PROFILES[propType];
}

export function createProp(
  scene: IScene,
  propType: PropType,
  x: number,
  y: number,
  scrollSpeed: number,
  overrides?: PropOverrides,
): Prop {
  return new Prop(scene, PROFILES[propType], x, y, scrollSpeed, overrides);
}

export { type PropProfile };
