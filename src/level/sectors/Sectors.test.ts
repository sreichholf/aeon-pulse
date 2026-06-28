import { describe, expect, it } from 'vitest';
import { PropType } from '../../types.ts';
import { getSectorDefinition } from './Sectors.ts';

describe('getSectorDefinition', () => {
  it('resolves Chapter 1 Sectors with their authored prop layouts', () => {
    expect(getSectorDefinition('Megastructure', 'outerHull').propLayout).toEqual([]);

    const antenna = getSectorDefinition('Megastructure', 'antennaField').propLayout;
    expect(antenna.length).toBeGreaterThan(0);
    expect(antenna.every((e) => e.propType === PropType.SENSOR_POD)).toBe(true);

    const core = getSectorDefinition('Megastructure', 'coreGate').propLayout;
    expect(core.some((e) => e.propType === PropType.SHIELD_RELAY)).toBe(true);
    expect(core.some((e) => e.propType === PropType.SENSOR_POD)).toBe(true);
    expect(core.some((e) => e.propType === PropType.CARGO_CANISTER)).toBe(true);
  });

  it('resolves Chapter 2 Sectors with terrain data and authored prop roles', () => {
    const intake = getSectorDefinition('Industrial', 'intakeManifold');
    expect(intake.terrainPoints?.length).toBeGreaterThan(0);
    expect(intake.propLayout.every((e) => e.propType === PropType.FUEL_TANK)).toBe(true);

    const conveyor = getSectorDefinition('Industrial', 'conveyorGallery');
    expect(conveyor.terrainPoints?.length).toBeGreaterThan(0);
    expect(conveyor.propLayout.every((e) => e.propType === PropType.CONVEYOR_NODE)).toBe(true);

    const smelter = getSectorDefinition('Industrial', 'smelterCore');
    expect(smelter.terrainPoints?.length).toBeGreaterThan(0);
    expect(smelter.propLayout.some((e) => e.propType === PropType.FUEL_TANK)).toBe(true);
    expect(smelter.propLayout.some((e) => e.propType === PropType.CONVEYOR_NODE)).toBe(true);
    expect(smelter.propLayout.some((e) => e.propType === PropType.FURNACE_VENT)).toBe(true);
  });

  it('resolves Chapter 3 Sectors with terrain data and authored prop roles', () => {
    const outer = getSectorDefinition('Hive', 'outerMembrane');
    expect(outer.terrainPoints?.length).toBeGreaterThan(0);
    expect(outer.propLayout.every((e) => e.propType === PropType.SPORE_POD)).toBe(true);

    const gullet = getSectorDefinition('Hive', 'gullet');
    expect(gullet.terrainPoints?.length).toBeGreaterThan(0);
    expect(gullet.propLayout.every((e) => e.propType === PropType.EGG_SAC)).toBe(true);

    const nursery = getSectorDefinition('Hive', 'nursery');
    expect(nursery.terrainPoints?.length).toBeGreaterThan(0);
    expect(nursery.propLayout.some((e) => e.propType === PropType.SPORE_POD)).toBe(true);
    expect(nursery.propLayout.some((e) => e.propType === PropType.EGG_SAC)).toBe(true);

    const capillary = getSectorDefinition('Hive', 'capillaryJunction');
    expect(capillary.terrainPoints?.length).toBeGreaterThan(0);
    expect(capillary.propLayout.every((e) => e.propType === PropType.HIVE_BULB)).toBe(true);

    const womb = getSectorDefinition('Hive', 'wombCore');
    expect(womb.terrainPoints?.length).toBeGreaterThan(0);
    expect(womb.propLayout.some((e) => e.propType === PropType.SPORE_POD)).toBe(true);
    expect(womb.propLayout.some((e) => e.propType === PropType.EGG_SAC)).toBe(true);
    expect(womb.propLayout.some((e) => e.propType === PropType.HIVE_BULB)).toBe(true);
  });

  it('resolves Chapter 4 Sectors with terrain data and authored prop roles', () => {
    const basalt = getSectorDefinition('Volcanic', 'basaltApproach');
    expect(basalt.terrainPoints?.length).toBeGreaterThan(0);
    expect(basalt.propLayout.every((e) => e.propType === PropType.BRITTLE_BASALT_COLUMN)).toBe(true);

    const magma = getSectorDefinition('Volcanic', 'magmaConduit');
    expect(magma.terrainPoints?.length).toBeGreaterThan(0);
    expect(magma.propLayout.every((e) => e.propType === PropType.HANGING_MAGMA_SAC)).toBe(true);

    const crystal = getSectorDefinition('Volcanic', 'crystalCavern');
    expect(crystal.terrainPoints?.length).toBeGreaterThan(0);
    expect(crystal.propLayout.every((e) => e.propType === PropType.CRYSTAL_OUTCROP)).toBe(true);

    const ash = getSectorDefinition('Volcanic', 'ashFalls');
    expect(ash.terrainPoints?.length).toBeGreaterThan(0);
    expect(ash.propLayout.some((e) => e.propType === PropType.BRITTLE_BASALT_COLUMN)).toBe(true);
    expect(ash.propLayout.some((e) => e.propType === PropType.HANGING_MAGMA_SAC)).toBe(true);
    expect(ash.propLayout.some((e) => e.propType === PropType.CRYSTAL_OUTCROP)).toBe(true);

    const caldera = getSectorDefinition('Volcanic', 'calderaHeart');
    expect(caldera.terrainPoints?.length).toBeGreaterThan(0);
    expect(caldera.propLayout.some((e) => e.propType === PropType.BRITTLE_BASALT_COLUMN)).toBe(true);
    expect(caldera.propLayout.some((e) => e.propType === PropType.HANGING_MAGMA_SAC)).toBe(true);
    expect(caldera.propLayout.some((e) => e.propType === PropType.CRYSTAL_OUTCROP)).toBe(true);
  });

  it('applies authored corridor margins: wider Sectors have negative total margin', () => {
    const widerSectors = [
      ['Megastructure', 'outerHull'],
      ['Industrial', 'intakeManifold'],
      ['Hive', 'outerMembrane'],
      ['Volcanic', 'basaltApproach'],
    ] as const;
    for (const [chapter, sector] of widerSectors) {
      const def = getSectorDefinition(chapter, sector);
      expect(def.playfieldMargins).toBeDefined();
      const m = def.playfieldMargins!;
      expect(m.top + m.bottom).toBeLessThan(0);
    }
  });

  it('applies authored corridor margins: narrower Sectors have positive total margin', () => {
    const narrowerSectors = [
      ['Megastructure', 'coreGate'],
      ['Industrial', 'pressHall'],
      ['Industrial', 'smelterCore'],
      ['Hive', 'gullet'],
      ['Hive', 'nursery'],
      ['Hive', 'wombCore'],
      ['Volcanic', 'magmaConduit'],
      ['Volcanic', 'ashFalls'],
      ['Volcanic', 'calderaHeart'],
    ] as const;
    for (const [chapter, sector] of narrowerSectors) {
      const def = getSectorDefinition(chapter, sector);
      expect(def.playfieldMargins).toBeDefined();
      const m = def.playfieldMargins!;
      expect(m.top).toBeGreaterThan(0);
      expect(m.bottom).toBeGreaterThan(0);
      expect(m.top + m.bottom).toBeGreaterThan(0);
    }
  });

  it('introduces each chapter solid prop in its planned Sector and finale Sector', () => {
    const core = getSectorDefinition('Megastructure', 'coreGate').propLayout;
    expect(core.some((e) => e.propType === PropType.HULL_BULKHEAD)).toBe(true);

    const press = getSectorDefinition('Industrial', 'pressHall').propLayout;
    const smelter = getSectorDefinition('Industrial', 'smelterCore').propLayout;
    expect(press.some((e) => e.propType === PropType.COOLING_PLUG)).toBe(true);
    expect(smelter.some((e) => e.propType === PropType.COOLING_PLUG)).toBe(true);

    const nursery = getSectorDefinition('Hive', 'nursery').propLayout;
    const womb = getSectorDefinition('Hive', 'wombCore').propLayout;
    expect(nursery.some((e) => e.propType === PropType.BONE_DAM)).toBe(true);
    expect(womb.some((e) => e.propType === PropType.BONE_DAM)).toBe(true);

    const ash = getSectorDefinition('Volcanic', 'ashFalls').propLayout;
    const caldera = getSectorDefinition('Volcanic', 'calderaHeart').propLayout;
    expect(ash.some((e) => e.propType === PropType.BASALT_GATE)).toBe(true);
    expect(caldera.some((e) => e.propType === PropType.BASALT_GATE)).toBe(true);
  });

  it('uses per-placement Timed Burst and fullGate overrides for late solid props', () => {
    const womb = getSectorDefinition('Hive', 'wombCore').propLayout;
    expect(womb.some((e) => e.propType === PropType.BONE_DAM && e.burstWindow === 6.5)).toBe(true);

    const caldera = getSectorDefinition('Volcanic', 'calderaHeart').propLayout;
    expect(caldera.some((e) => e.propType === PropType.BASALT_GATE && e.isFullGate === true)).toBe(true);
    expect(caldera.some((e) => e.propType === PropType.BASALT_GATE && e.burstWindow === 6.5)).toBe(true);
  });

  it('falls back to an empty default for unknown sectors', () => {
    expect(getSectorDefinition('Megastructure', 'noSuchSector').propLayout).toEqual([]);
    expect(getSectorDefinition('Industrial', 'noSuchSector').propLayout).toEqual([]);
    expect(getSectorDefinition('Volcanic', 'noSuchSector').propLayout).toEqual([]);
  });

  it('returns a definition with a string sectorKey', () => {
    const def = getSectorDefinition('Megastructure', 'outerHull');
    expect(typeof def.sectorKey).toBe('string');
  });
});
