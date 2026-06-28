import { describe, expect, it } from 'vitest';
import { PropType, PropEffectKind, PropCollisionShape } from '../types.ts';
import { getPropProfile } from './PropRegistry.ts';

describe('PropRegistry profiles', () => {
  it('provides a well-formed profile for every PropType', () => {
    for (const propType of Object.values(PropType)) {
      const profile = getPropProfile(propType);
      expect(profile.propType).toBe(propType);
      expect(profile.hp).toBeGreaterThan(0);
      expect(profile.scoreValue).toBeGreaterThanOrEqual(0);
      expect(profile.hw).toBeGreaterThan(0);
      expect(profile.hh).toBeGreaterThan(0);
      expect(profile.clearRadius).toBeGreaterThanOrEqual(0);
      expect(profile.hazardRadius).toBeGreaterThanOrEqual(0);
      expect(profile.hazardDuration).toBeGreaterThanOrEqual(0);
      expect(profile.dropPowerupChance).toBeGreaterThanOrEqual(0);
      expect(profile.dropPowerupChance).toBeLessThanOrEqual(1);
    }
  });

  it('only lists valid PropEffectKind values in effect arrays', () => {
    const valid = new Set<string>(Object.values(PropEffectKind));
    for (const propType of Object.values(PropType)) {
      for (const effect of getPropProfile(propType).effects) {
        expect(valid.has(effect)).toBe(true);
      }
    }
  });

  it('gives a finite burst window only to props that release a hazard or burst', () => {
    for (const propType of Object.values(PropType)) {
      const profile = getPropProfile(propType);
      if (Number.isFinite(profile.burstWindow)) {
        expect(profile.burstWindow).toBeGreaterThan(0);
      }
    }
  });

  it('matches the planned Chapter 2 prop roles', () => {
    const fuelTank = getPropProfile(PropType.FUEL_TANK);
    expect(fuelTank.effects).toEqual([PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP]);
    expect(fuelTank.clearRadius).toBeGreaterThan(0);
    expect(fuelTank.hazardRadius).toBe(0);

    const conveyorNode = getPropProfile(PropType.CONVEYOR_NODE);
    expect(conveyorNode.effects).toEqual([PropEffectKind.SCORE_DROP, PropEffectKind.POWERUP_DROP]);
    expect(conveyorNode.dropPowerupChance).toBeGreaterThan(0);
    expect(conveyorNode.burstWindow).toBe(Infinity);

    const furnaceVent = getPropProfile(PropType.FURNACE_VENT);
    expect(furnaceVent.effects).toEqual([PropEffectKind.HAZARD_RELEASE, PropEffectKind.SCORE_DROP]);
    expect(furnaceVent.hazardRadius).toBeGreaterThan(0);
    expect(Number.isFinite(furnaceVent.burstWindow)).toBe(true);
  });

  it('matches the planned Chapter 3 prop roles', () => {
    const sporePod = getPropProfile(PropType.SPORE_POD);
    expect(sporePod.effects).toEqual([PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP]);
    expect(sporePod.clearRadius).toBeGreaterThan(0);

    const eggSac = getPropProfile(PropType.EGG_SAC);
    expect(eggSac.effects).toEqual([PropEffectKind.HAZARD_RELEASE, PropEffectKind.SCORE_DROP]);
    expect(eggSac.hazardRadius).toBeGreaterThan(0);
    expect(Number.isFinite(eggSac.burstWindow)).toBe(true);

    const hiveBulb = getPropProfile(PropType.HIVE_BULB);
    expect(hiveBulb.effects).toEqual([PropEffectKind.SCORE_DROP, PropEffectKind.POWERUP_DROP]);
    expect(hiveBulb.dropPowerupChance).toBeGreaterThan(0);
  });

  it('matches the planned Chapter 4 prop roles', () => {
    const basaltColumn = getPropProfile(PropType.BRITTLE_BASALT_COLUMN);
    expect(basaltColumn.effects).toEqual([PropEffectKind.BULLET_CLEAR, PropEffectKind.SCORE_DROP]);
    expect(basaltColumn.clearRadius).toBe(100);
    expect(basaltColumn.hazardRadius).toBe(0);
    expect(basaltColumn.hp).toBe(5);
    expect(basaltColumn.scoreValue).toBe(250);

    const magmaSac = getPropProfile(PropType.HANGING_MAGMA_SAC);
    expect(magmaSac.effects).toEqual([PropEffectKind.HAZARD_RELEASE, PropEffectKind.SCORE_DROP]);
    expect(magmaSac.hazardRadius).toBe(115);
    expect(magmaSac.hazardDuration).toBe(3.2);
    expect(magmaSac.burstWindow).toBe(5.8);
    expect(magmaSac.hp).toBe(5);
    expect(magmaSac.scoreValue).toBe(300);

    const crystalOutcrop = getPropProfile(PropType.CRYSTAL_OUTCROP);
    expect(crystalOutcrop.effects).toEqual([PropEffectKind.SCORE_DROP, PropEffectKind.POWERUP_DROP]);
    expect(crystalOutcrop.dropPowerupChance).toBe(0.15);
    expect(crystalOutcrop.hp).toBe(10);
    expect(crystalOutcrop.scoreValue).toBe(500);
  });

  it('marks v2 solid prop kinds as solid with the right shape and durability', () => {
    const bulkhead = getPropProfile(PropType.HULL_BULKHEAD);
    expect(bulkhead.isSolid).toBe(true);
    expect(bulkhead.collisionShape).toBe(PropCollisionShape.BOX);
    expect(bulkhead.fullGate).toBe(false);
    expect(bulkhead.hp).toBeGreaterThanOrEqual(3);
    expect(bulkhead.hp).toBeLessThanOrEqual(5);
    expect(bulkhead.effects).toContain(PropEffectKind.BULLET_CLEAR);
    expect(bulkhead.effects).toContain(PropEffectKind.SCORE_DROP);
    expect(bulkhead.burstWindow).toBe(Infinity);

    const coolingPlug = getPropProfile(PropType.COOLING_PLUG);
    expect(coolingPlug.isSolid).toBe(true);
    expect(coolingPlug.collisionShape).toBe(PropCollisionShape.BOX);
    expect(coolingPlug.fullGate).toBe(false);
    expect(coolingPlug.hp).toBeGreaterThanOrEqual(5);
    expect(coolingPlug.hp).toBeLessThanOrEqual(8);
    expect(coolingPlug.effects).toContain(PropEffectKind.BULLET_CLEAR);
    expect(coolingPlug.effects).toContain(PropEffectKind.SCORE_DROP);
    expect(coolingPlug.burstWindow).toBe(Infinity);

    const boneDam = getPropProfile(PropType.BONE_DAM);
    expect(boneDam.isSolid).toBe(true);
    expect(boneDam.collisionShape).toBe(PropCollisionShape.CIRCLE);
    expect(boneDam.fullGate).toBe(false);
    expect(boneDam.hp).toBeGreaterThanOrEqual(4);
    expect(boneDam.hp).toBeLessThanOrEqual(6);
    expect(boneDam.effects).toContain(PropEffectKind.HAZARD_RELEASE);
    expect(boneDam.effects).toContain(PropEffectKind.SCORE_DROP);
    expect(boneDam.hazardRadius).toBeGreaterThan(0);

    const basaltGate = getPropProfile(PropType.BASALT_GATE);
    expect(basaltGate.isSolid).toBe(true);
    expect(basaltGate.collisionShape).toBe(PropCollisionShape.BOX);
    expect(basaltGate.hp).toBeGreaterThanOrEqual(7);
    expect(basaltGate.hp).toBeLessThanOrEqual(10);
    expect(basaltGate.effects).toContain(PropEffectKind.BULLET_CLEAR);
    expect(basaltGate.effects).toContain(PropEffectKind.SCORE_DROP);
  });
});
