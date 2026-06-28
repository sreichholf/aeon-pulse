import * as THREE from 'three';
import { PropType } from '../types.ts';

/**
 * Procedural prop visuals, dispatched by propType.
 *
 * Each builder returns a Group of body meshes (direct children or shallowly
 * nested). Prop.ts owns flash: it walks the returned meshes and creates a
 * DEFAULT_FLASH_MATERIAL overlay sibling for each, so flashes affect every
 * visible part. Geometry/material are per-instance for now (prop counts are
 * 2–6 per level); shared cached resources can follow the Obstacle pattern later
 * if profiling warrants.
 */
export function buildPropGroup(propType: PropType, hw: number, hh: number): THREE.Group {
  switch (propType) {
    case PropType.SENSOR_POD: return buildSensorPod(hw, hh);
    case PropType.CARGO_CANISTER: return buildCargoCanister(hw, hh);
    case PropType.SHIELD_RELAY: return buildShieldRelay(hw, hh);
    case PropType.FUEL_TANK: return buildFuelTank(hw, hh);
    case PropType.CONVEYOR_NODE: return buildConveyorNode(hw, hh);
    case PropType.FURNACE_VENT: return buildFurnaceVent(hw, hh);
    case PropType.SPORE_POD: return buildSporePod(hw, hh);
    case PropType.EGG_SAC: return buildEggSac(hw, hh);
    case PropType.HIVE_BULB: return buildHiveBulb(hw, hh);
    case PropType.BRITTLE_BASALT_COLUMN: return buildBrittleBasaltColumn(hw, hh);
    case PropType.HANGING_MAGMA_SAC: return buildHangingMagmaSac(hw, hh);
    case PropType.CRYSTAL_OUTCROP: return buildCrystalOutcrop(hw, hh);
    case PropType.HULL_BULKHEAD: return buildHullBulkhead(hw, hh);
    case PropType.COOLING_PLUG: return buildCoolingPlug(hw, hh);
    case PropType.BONE_DAM: return buildBoneDam(hw, hh);
    case PropType.BASALT_GATE: return buildBasaltGate(hw, hh);
    default: return buildPlaceholder(hw, hh);
  }
}

function buildPlaceholder(hw: number, hh: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, emissive: 0x111111, flatShading: true });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(hw * 2, hh * 2, hw * 2), mat));
  return group;
}

function buildSensorPod(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const hullMat = new THREE.MeshPhongMaterial({ color: 0x2c4a66, emissive: 0x0a1622, flatShading: true });
  const spikeMat = new THREE.MeshPhongMaterial({ color: 0x66ccff, emissive: 0x123344, flatShading: true });

  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(9, 0), hullMat));

  const spikeGeo = new THREE.ConeGeometry(2, 8, 5);
  for (const [dx, dy, rot] of [[1, 0, -Math.PI / 2], [-1, 0, Math.PI / 2], [0, 1, 0], [0, -1, Math.PI]] as const) {
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.set(dx * 11, dy * 11, 0);
    spike.rotation.z = rot;
    group.add(spike);
  }

  const eye = new THREE.Mesh(new THREE.CircleGeometry(3.2, 12), new THREE.MeshBasicMaterial({ color: 0x9ff0ff }));
  eye.position.set(0, 0, 8.4);
  group.add(eye);
  return group;
}

function buildCargoCanister(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const shellMat = new THREE.MeshPhongMaterial({ color: 0xc66a1a, emissive: 0x1a0d00, flatShading: true });
  const bandMat = new THREE.MeshPhongMaterial({ color: 0x3a2a18, emissive: 0x000000, flatShading: true });
  const capMat = new THREE.MeshPhongMaterial({ color: 0xffd27f, emissive: 0x2a1a00, flatShading: true });

  group.add(new THREE.Mesh(new THREE.BoxGeometry(30, 26, 22), shellMat));

  for (const y of [-7, 7]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(30.6, 4, 22.6), bandMat);
    band.position.y = y;
    group.add(band);
  }

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 4, 8), capMat);
  cap.rotation.x = Math.PI / 2;
  cap.position.set(-6, 0, 12);
  group.add(cap);
  return group;
}

function buildShieldRelay(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const baseMat = new THREE.MeshPhongMaterial({ color: 0x224433, emissive: 0x08140d, flatShading: true });
  const finMat = new THREE.MeshPhongMaterial({ color: 0x44ff88, emissive: 0x0e3320, flatShading: true });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(8, 11, 14, 6), baseMat);
  group.add(base);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(6, 0),
    new THREE.MeshBasicMaterial({ color: 0x9fffc8 }),
  );
  core.position.y = 12;
  group.add(core);

  const finGeo = new THREE.BoxGeometry(2, 12, 8);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeo, finMat);
    const a = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 9, 4, Math.sin(a) * 9);
    fin.rotation.y = a;
    group.add(fin);
  }
  return group;
}

function buildFuelTank(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const shellMat = new THREE.MeshPhongMaterial({ color: 0x6f7682, emissive: 0x14171b, flatShading: true });
  const frameMat = new THREE.MeshPhongMaterial({ color: 0x2f343e, emissive: 0x090b0f, flatShading: true });
  const stripeMat = new THREE.MeshPhongMaterial({ color: 0xd58c22, emissive: 0x271300, flatShading: true });

  const tank = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 28, 10), shellMat);
  tank.rotation.z = Math.PI / 2;
  group.add(tank);

  for (const x of [-8, 8]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, 2.6, 10), frameMat);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = x * 1.65;
    group.add(cap);
  }

  for (const x of [-9, 0, 9]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.5, 22, 22), stripeMat);
    band.position.x = x;
    group.add(band);
  }

  for (const x of [-11, 11]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 4), frameMat);
    strut.position.set(x, -12, 0);
    group.add(strut);
  }
  const base = new THREE.Mesh(new THREE.BoxGeometry(28, 4, 12), frameMat);
  base.position.set(0, -17, 0);
  group.add(base);
  return group;
}

function buildConveyorNode(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const housingMat = new THREE.MeshPhongMaterial({ color: 0x3b414d, emissive: 0x0d1217, flatShading: true });
  const beltMat = new THREE.MeshPhongMaterial({ color: 0x1f252d, emissive: 0x06080b, flatShading: true });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x5fe6ff });

  const housing = new THREE.Mesh(new THREE.BoxGeometry(30, 18, 18), housingMat);
  group.add(housing);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 20), beltMat);
  belt.position.y = 2;
  group.add(belt);

  for (const x of [-11, 11]) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 22, 10), housingMat);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(x, 2, 0);
    group.add(roller);
  }

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), coreMat);
  core.position.set(0, -4, 0);
  group.add(core);

  for (const y of [-8, 8]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(24, 2.5, 2.5), housingMat);
    brace.position.set(0, y, 0);
    group.add(brace);
  }
  return group;
}

function buildFurnaceVent(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const shellMat = new THREE.MeshPhongMaterial({ color: 0x4e3428, emissive: 0x180a06, flatShading: true });
  const pipeMat = new THREE.MeshPhongMaterial({ color: 0x2f2623, emissive: 0x090504, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a1f });

  const body = new THREE.Mesh(new THREE.BoxGeometry(24, 26, 20), shellMat);
  group.add(body);

  const grate = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 21), glowMat);
  grate.position.set(0, -2, 0);
  group.add(grate);

  const stack = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 16, 8), pipeMat);
  stack.position.set(0, 18, 0);
  group.add(stack);

  for (const x of [-10, 10]) {
    const sidePipe = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 14, 8), pipeMat);
    sidePipe.rotation.z = Math.PI / 2;
    sidePipe.position.set(x, 8, 0);
    group.add(sidePipe);
  }

  const cap = new THREE.Mesh(new THREE.TorusGeometry(7, 1.6, 6, 10), glowMat);
  cap.rotation.x = Math.PI / 2;
  cap.position.set(0, 18, 0);
  group.add(cap);
  return group;
}

function buildSporePod(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const stemMat = new THREE.MeshPhongMaterial({ color: 0x3a5c2d, emissive: 0x0a1408, flatShading: true });
  const podMat = new THREE.MeshPhongMaterial({ color: 0x7cb342, emissive: 0x152208, flatShading: true });
  const membraneMat = new THREE.MeshPhongMaterial({ color: 0xc5d65a, emissive: 0x222608, transparent: true, opacity: 0.55, flatShading: true });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xccff66 });

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 10, 6), stemMat);
  stem.position.y = -10;
  group.add(stem);

  const pod = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 10), podMat);
  pod.scale.set(1, 1.15, 0.85);
  group.add(pod);

  const membrane = new THREE.Mesh(new THREE.SphereGeometry(11.8, 12, 10), membraneMat);
  membrane.scale.set(1, 1.15, 0.85);
  group.add(membrane);

  const core = new THREE.Mesh(new THREE.SphereGeometry(4.5, 10, 8), coreMat);
  core.scale.set(1, 1.15, 0.85);
  group.add(core);

  const poreGeo = new THREE.CircleGeometry(1.4, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pore = new THREE.Mesh(poreGeo, stemMat);
    pore.position.set(Math.cos(a) * 7.5, Math.sin(a) * 8.5, 6.8);
    group.add(pore);
  }
  return group;
}

function buildEggSac(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const membraneMat = new THREE.MeshPhongMaterial({ color: 0xdccf8a, emissive: 0x26220b, transparent: true, opacity: 0.7, flatShading: true });
  const yolkMat = new THREE.MeshBasicMaterial({ color: 0xffee99 });
  const sacMat = new THREE.MeshPhongMaterial({ color: 0xb8a86b, emissive: 0x1c1808, flatShading: true });

  const sacs: Array<[number, number, number, number, number]> = [
    [-5, 2, 8, 1, 1.2],
    [6, -1, 7, 0.9, 1],
    [0, 6, 9, 1.1, 1.3],
    [-2, -7, 6, 0.85, 0.9],
  ];

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 10, 6), sacMat);
  stalk.position.y = 12;
  group.add(stalk);

  for (const [dx, dy, r, sx, sy] of sacs) {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), membraneMat);
    shell.scale.set(sx, sy, sx * 0.85);
    shell.position.set(dx, dy, 0);
    group.add(shell);

    const yolk = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 10, 8), yolkMat);
    yolk.scale.set(sx, sy, sx * 0.85);
    yolk.position.set(dx * 0.3, dy * 0.3, r * 0.25);
    group.add(yolk);
  }

  const web = new THREE.Mesh(new THREE.BoxGeometry(22, 3, 2), sacMat);
  web.position.set(1, 8, 0);
  group.add(web);
  return group;
}

function buildHiveBulb(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0x4a2566, emissive: 0x100818, flatShading: true });
  const membraneMat = new THREE.MeshPhongMaterial({ color: 0x8c5ab5, emissive: 0x220f33, transparent: true, opacity: 0.45, flatShading: true });
  const ridgeMat = new THREE.MeshPhongMaterial({ color: 0x2f163d, emissive: 0x0a0510, flatShading: true });
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xdcaaff });

  const body = new THREE.Mesh(new THREE.SphereGeometry(18, 14, 12), bodyMat);
  body.scale.set(1, 1.2, 0.9);
  group.add(body);

  const membrane = new THREE.Mesh(new THREE.SphereGeometry(19, 14, 12), membraneMat);
  membrane.scale.set(1, 1.2, 0.9);
  group.add(membrane);

  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI - Math.PI / 2;
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(1.4, 2.8, 6, 10), ridgeMat);
    ridge.position.set(0, Math.sin(t) * 16, 0);
    ridge.scale.set(1.2 + Math.cos(t) * 0.3, 1, 0.9);
    group.add(ridge);
  }

  const pulse = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 10), pulseMat);
  pulse.scale.set(1, 1.2, 0.9);
  group.add(pulse);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 10, 8), ridgeMat);
  stem.position.y = 21;
  group.add(stem);
  return group;
}

function buildBrittleBasaltColumn(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshPhongMaterial({ color: 0x2b2b2b, emissive: 0x0a0a0a, flatShading: true });
  const crackMat = new THREE.MeshPhongMaterial({ color: 0x151515, emissive: 0x050505, flatShading: true });

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 66, 6), stoneMat);
  pillar.position.y = -5;
  group.add(pillar);

  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(4, 16, 5), stoneMat);
    shard.position.set(Math.cos(t) * 9, -34, Math.sin(t) * 9);
    shard.rotation.x = -Math.PI / 8;
    shard.rotation.y = t;
    group.add(shard);
  }

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(13, 11, 6, 6), stoneMat);
  cap.position.y = 28;
  group.add(cap);

  for (const [dx, dy, dz, sx, sy] of [[0, -10, 6, 1, 1.2], [0, 8, 6, 0.8, 1.4], [0, 0, 6.5, 0.6, 2.6]] as const) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 10, 1.8), crackMat);
    crack.position.set(dx, dy, dz);
    crack.scale.set(sx, sy, 1);
    group.add(crack);
  }
  return group;
}

function buildHangingMagmaSac(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const sacMat = new THREE.MeshPhongMaterial({ color: 0x6e3518, emissive: 0x331100, transparent: true, opacity: 0.75, flatShading: true });
  const veinMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const tetherMat = new THREE.MeshPhongMaterial({ color: 0x2a1a12, emissive: 0x050300, flatShading: true });

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 4, 12, 6), tetherMat);
  stalk.position.y = 18;
  group.add(stalk);

  const sac = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 10), sacMat);
  sac.scale.set(1, 1.35, 0.85);
  group.add(sac);

  const veins: Array<[number, number, number]> = [
    [-5, 2, 6.2],
    [4, -6, 5.8],
    [0, 8, 6.4],
    [7, 5, 5.5],
    [-4, -10, 5.9],
  ];
  for (const [dx, dy, r] of veins) {
    const vein = new THREE.Mesh(new THREE.CircleGeometry(r, 8), veinMat);
    vein.position.set(dx, dy, 6.8);
    group.add(vein);
  }

  const glow = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffaa22 }));
  glow.scale.set(1, 1.35, 0.85);
  group.add(glow);
  return group;
}

function buildCrystalOutcrop(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const crystalMat = new THREE.MeshPhongMaterial({ color: 0xccffff, emissive: 0x114455, transparent: true, opacity: 0.8, flatShading: true });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

  const crystals: Array<[number, number, number, number, number, number]> = [
    [0, 4, 0, 1, 1.6, 8],
    [-8, -4, 2, 0.75, 1.1, 11],
    [8, -2, -2, 0.85, 1.3, 10],
    [-3, 10, 1, 0.55, 0.85, 7],
    [5, 9, -1, 0.5, 0.9, 6],
  ];

  for (const [dx, dy, dz, sx, sy, h] of crystals) {
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(5, h, 5), crystalMat);
    crystal.position.set(dx, dy + h * 0.2, dz);
    crystal.scale.set(sx, sy, sx);
    crystal.rotation.z = dx * -0.08;
    group.add(crystal);

    const glint = new THREE.Mesh(new THREE.ConeGeometry(2.2, h * 0.55, 5), glintMat);
    glint.position.set(dx * 0.85, dy + h * 0.22, dz + 1.4);
    glint.scale.set(sx * 0.5, sy * 0.5, sx * 0.5);
    glint.rotation.z = dx * -0.08;
    group.add(glint);
  }
  return group;
}

function buildHullBulkhead(hw: number, hh: number): THREE.Group {
  void hw;
  const group = new THREE.Group();
  const panelMat = new THREE.MeshPhongMaterial({ color: 0x3a4a5a, emissive: 0x0a1018, flatShading: true });
  const braceMat = new THREE.MeshPhongMaterial({ color: 0x2a3a4a, emissive: 0x060c12, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x88ccff });
  const shadowMat = new THREE.MeshPhongMaterial({ color: 0x1a222c, emissive: 0x05080c, flatShading: true });

  // Shared solid cue: heavier silhouette / subtle occlusion shadow behind.
  const backing = new THREE.Mesh(new THREE.BoxGeometry(18, hh * 2 + 4, 8), shadowMat);
  backing.position.z = -5;
  group.add(backing);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(16, hh * 2, 6), panelMat);
  group.add(panel);

  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    const brace = new THREE.Mesh(new THREE.BoxGeometry(18, 3.5, 7), braceMat);
    brace.position.set(0, (t - 0.5) * (hh * 2 - 8), 0.5);
    group.add(brace);
  }

  const topCap = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 8), braceMat);
  topCap.position.set(0, hh - 2, 0);
  group.add(topCap);
  const botCap = new THREE.Mesh(new THREE.BoxGeometry(20, 4, 8), braceMat);
  botCap.position.set(0, -hh + 2, 0);
  group.add(botCap);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(2, hh * 1.6, 7.5), glowMat);
  strip.position.set(0, 0, 2);
  group.add(strip);
  return group;
}

function buildCoolingPlug(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0x4a525a, emissive: 0x0f1216, flatShading: true });
  const frameMat = new THREE.MeshPhongMaterial({ color: 0x2f363d, emissive: 0x080a0d, flatShading: true });
  const pipeMat = new THREE.MeshPhongMaterial({ color: 0x2a3a4a, emissive: 0x081018, flatShading: true });
  const coolantMat = new THREE.MeshBasicMaterial({ color: 0x5fe6ff });
  const shadowMat = new THREE.MeshPhongMaterial({ color: 0x1c2026, emissive: 0x050608, flatShading: true });

  const backing = new THREE.Mesh(new THREE.BoxGeometry(48, 48, 10), shadowMat);
  backing.position.z = -7;
  group.add(backing);

  const body = new THREE.Mesh(new THREE.BoxGeometry(42, 42, 24), bodyMat);
  group.add(body);

  const window = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 25), coolantMat);
  group.add(window);

  for (const x of [-16, 16]) {
    const flange = new THREE.Mesh(new THREE.BoxGeometry(8, 44, 28), frameMat);
    flange.position.set(x, 0, 0);
    group.add(flange);
  }

  for (const y of [-14, 14]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 30, 8), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, y, 0);
    group.add(pipe);

    const coolantRing = new THREE.Mesh(new THREE.TorusGeometry(3.8, 1, 6, 10), coolantMat);
    coolantRing.rotation.y = Math.PI / 2;
    coolantRing.position.set(0, y, 0);
    group.add(coolantRing);
  }
  return group;
}

function buildBoneDam(hw: number, hh: number): THREE.Group {
  void hw; void hh;
  const group = new THREE.Group();
  const boneMat = new THREE.MeshPhongMaterial({ color: 0xdccfb0, emissive: 0x282318, flatShading: true });
  const shellMat = new THREE.MeshPhongMaterial({ color: 0xb8a88a, emissive: 0x1e1a12, flatShading: true });
  const veinMat = new THREE.MeshBasicMaterial({ color: 0xff6688 });
  const shadowMat = new THREE.MeshPhongMaterial({ color: 0x6b5d48, emissive: 0x110e0a, flatShading: true });

  const backing = new THREE.Mesh(new THREE.IcosahedronGeometry(22, 1), shadowMat);
  backing.scale.set(1, 1, 0.55);
  backing.position.z = -8;
  group.add(backing);

  const slab = new THREE.Mesh(new THREE.IcosahedronGeometry(20, 1), boneMat);
  slab.scale.set(1, 1, 0.5);
  group.add(slab);

  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(21, 1), shellMat);
  shell.scale.set(1, 1, 0.45);
  shell.position.z = 2;
  group.add(shell);

  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI * 2;
    const vein = new THREE.Mesh(new THREE.TorusGeometry(1.2, 2.2, 5, 8), veinMat);
    vein.position.set(Math.cos(t) * 10, Math.sin(t) * 10, 5);
    vein.rotation.z = t;
    group.add(vein);
  }

  const core = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), veinMat);
  core.position.z = 6;
  group.add(core);
  return group;
}

function buildBasaltGate(hw: number, hh: number): THREE.Group {
  void hw;
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshPhongMaterial({ color: 0x2b2624, emissive: 0x0c0908, flatShading: true });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x1a1715, emissive: 0x060504, flatShading: true });
  const crackMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa55 });

  // Heavier silhouette / occlusion shadow.
  const backing = new THREE.Mesh(new THREE.BoxGeometry(28, hh * 2 + 6, 10), darkMat);
  backing.position.z = -8;
  group.add(backing);

  const slab = new THREE.Mesh(new THREE.BoxGeometry(24, hh * 2, 10), stoneMat);
  group.add(slab);

  // Jagged top/bottom shards.
  for (let i = 0; i < 5; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const shardTop = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 3, 14 + Math.random() * 8, 5), stoneMat);
    shardTop.position.set((Math.random() - 0.5) * 18, side * (hh + 4 + Math.random() * 4), 0);
    shardTop.rotation.z = side * (Math.random() - 0.5) * 0.4;
    group.add(shardTop);
  }

  // Magma cracks.
  for (const x of [-6, 0, 6]) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(1.6, hh * 1.6, 11), crackMat);
    crack.position.set(x, (Math.random() - 0.5) * 8, 1);
    group.add(crack);

    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.8, hh * 1.2, 11.5), glowMat);
    glow.position.set(x + 1.2, (Math.random() - 0.5) * 12, 1);
    group.add(glow);
  }
  return group;
}
