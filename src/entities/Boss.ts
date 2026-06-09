import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { BossBase } from './BossBase.ts';
import { Bullet } from './Bullet.ts';
import { BulletType, type GetPositionFn, type IAudio, type IBullet, type IScene, type BossConstructorParams } from '../types.ts';
import { ensureNonIndexed, addVertexColor } from '../utils/ProceduralToolkit.ts';

const HALF_H = GAME_HEIGHT / 2;

function cloneColoredGeometry(geo: THREE.BufferGeometry, colorHex: number): THREE.BufferGeometry {
  const cloned = ensureNonIndexed(geo);
  addVertexColor(cloned, colorHex);
  return cloned;
}


const TOTAL_HP       = 45;
const PHASE2_HP      = Math.round(TOTAL_HP * 0.67);
const PHASE3_HP      = Math.round(TOTAL_HP * 0.33);
const STOP_X         = 230;
const ENTRY_SPEED    = 90;
const DISPLAY_W      = 280;
const DISPLAY_H      = 140;
const HITBOX_HW      = 100;
const HITBOX_HH      = 50;
const DYING_DURATION = 2.4;
const EXPLOSION_N    = 48;
const HIT_COOLDOWN   = 0.20;

interface PatternBase {
  id: string;
  type: string;
  interval: number;
  speed: number;
}

interface PatternSpread extends PatternBase {
  type: 'spread';
  count: number;
  halfAngle: number;
}

interface PatternAimed extends PatternBase {
  type: 'aimed';
}

interface PatternHoming extends PatternBase {
  type: 'homing';
}

interface PatternCircular extends PatternBase {
  type: 'circular';
  count: number;
}

type BossPattern = PatternSpread | PatternAimed | PatternHoming | PatternCircular;

interface Phase {
  oscAmp: number;
  oscFreq: number;
  alertColor?: number;
  patterns: BossPattern[];
}

const PHASES: Phase[] = [
  {
    oscAmp: 72, oscFreq: 0.45,
    patterns: [
      { id: 'p1spread', type: 'spread', count: 3, interval: 2.0, speed: 175, halfAngle: 0.52 },
    ],
  },
  {
    oscAmp: 100, oscFreq: 0.78,
    alertColor: 0x00bbdd,
    patterns: [
      { id: 'p2spread', type: 'spread',  count: 3, interval: 1.5, speed: 225, halfAngle: 0.52 },
      { id: 'p2aimed',  type: 'aimed',             interval: 2.8, speed: 160 },
    ],
  },
  {
    oscAmp: 126, oscFreq: 1.15,
    alertColor: 0x00eeff,
    patterns: [
      { id: 'p3spread', type: 'spread', count: 5, interval: 0.95, speed: 265, halfAngle: 0.38 },
      { id: 'p3homing', type: 'homing',           interval: 3.2,  speed: 220 },
    ],
  },
];

export class Boss extends BossBase {
  private _phaseIdx: number;
  private _patternTimers: Record<string, number>;
  private _oscTime: number;
  private _baseY: number;
  private _alertTimer: number;
  private _alertColor: number;
  private _coreGroup: THREE.Group | null = null;
  private _energyMat: THREE.MeshPhongMaterial | null = null;

  constructor({ scene, sprites, getPlayerPos, onDeath, audio, projectileFactory }: BossConstructorParams) {
    super(scene, sprites, getPlayerPos, onDeath, audio, STOP_X, ENTRY_SPEED, TOTAL_HP, DISPLAY_W, DISPLAY_H, projectileFactory);

    this.score = 5000;
    this._phaseIdx = 0;

    this._patternTimers = {};
    for (const phase of PHASES) {
      for (const p of phase.patterns) {
        this._patternTimers[p.id] = p.interval * 0.5;
      }
    }

    this._oscTime  = 0;
    this._baseY    = 0;
    this._alertTimer = 0;
    this._alertColor = 0xaa3bff;

    this._displayName = 'Titan I (L1)';
    this._init();
  }

  get hw(): number { return HITBOX_HW; }
  get hh(): number { return HITBOX_HH; }

  protected _getHitCooldownDur(): number { return HIT_COOLDOWN; }
  protected _getDyingDuration(): number  { return DYING_DURATION; }

  override get deathConfig() {
    return {
      explosionCount: EXPLOSION_N,
      explosionColor: 0x00eeff,
      explosionMinSpeed: 80,
      explosionMaxSpeed: 400,
      explosionParticleSize: 10,
      flashOpacity: 0.4,
      shakeIntensity: 6,
      decayingShake: false,
    };
  }

  protected override _onEntranceComplete(): void {
    super._onEntranceComplete();
    this._baseY = this._mesh?.position.y ?? 0;
  }

  protected _tickBoss(dt: number): void {
    this._updateOscillation(dt);
    this._updateFiring(dt);
    this._animateCore(dt);
  }

  private _updateOscillation(dt: number): void {
    if (!this._mesh) return;
    const phase = PHASES[this._phaseIdx]!;
    this._oscTime += dt;
    this._mesh.position.y = this._baseY + phase.oscAmp * Math.sin(this._oscTime * phase.oscFreq);
    const top = this.playfieldBounds ? this.playfieldBounds.top : HALF_H;
    const bottom = this.playfieldBounds ? this.playfieldBounds.bottom : -HALF_H;
    this._mesh.position.y = Math.max(bottom + DISPLAY_H / 2 + 10, Math.min(top - DISPLAY_H / 2 - 10, this._mesh.position.y));
  }

  private _updateFiring(dt: number): void {
    const phase = PHASES[this._phaseIdx]!;
    for (const p of phase.patterns) {
      this._patternTimers[p.id]! -= dt;
      if (this._patternTimers[p.id]! <= 0) {
        this._fire(p);
        this._patternTimers[p.id]! = p.interval;
      }
    }
  }

  private _animateCore(dt: number): void {
    if (this._coreGroup) {
      this._coreGroup.rotation.y += dt * 1.1;
      this._coreGroup.rotation.z += dt * 0.6;
    }
  }

  private _fire(pattern: BossPattern): void {
    const { x: px, y: py } = this._getPlayerPos();
    const ox = this.x - DISPLAY_W / 2 - 4;
    const oy = this.y;
    const aimAngle = Math.atan2(py - oy, px - ox);

    switch (pattern.type) {
      case 'aimed': {
        this._spawnBullet(BulletType.BOSS, ox, oy, Math.cos(aimAngle) * pattern.speed, Math.sin(aimAngle) * pattern.speed);
        break;
      }
      case 'spread': {
        const step = pattern.count === 1 ? 0 : pattern.halfAngle * 2 / (pattern.count - 1);
        for (let i = 0; i < pattern.count; i++) {
          const a = aimAngle - pattern.halfAngle + step * i;
          this._spawnBullet(BulletType.BOSS, ox, oy, Math.cos(a) * pattern.speed, Math.sin(a) * pattern.speed);
        }
        break;
      }
      case 'homing': {
        const getPos: GetPositionFn = () => this._getPlayerPos();
        this._newBullets.push(this._projectileFactory({
          type: BulletType.HOMING,
          x: ox,
          y: oy,
          vx: -pattern.speed,
          vy: 0,
          getTargetPos: getPos,
        }));
        break;
      }
      case 'circular': {
        for (let i = 0; i < pattern.count; i++) {
          const a = (i / pattern.count) * Math.PI * 2;
          this._spawnBullet(BulletType.BOSS, ox, oy, Math.cos(a) * pattern.speed, Math.sin(a) * pattern.speed);
        }
        break;
      }
    }
  }

  private _spawnBullet(type: string, x: number, y: number, vx: number, vy: number): void {
    this._newBullets.push(this._projectileFactory({ type, x, y, vx, vy }));
  }

  protected override _checkPhase(): void {
    const newPhase = this._hp > PHASE2_HP ? 0 : this._hp > PHASE3_HP ? 1 : 2;
    if (newPhase !== this._phaseIdx) {
      this._phaseIdx  = newPhase;
      this._alertColor = PHASES[newPhase]!.alertColor ?? 0xaa3bff;
      this._alertTimer = 0.7;
      this._audio.play('bossAlert');
      if (newPhase === 2) this._patternTimers['p3homing'] = 0;
    }
  }

  protected override _updateAlertFlash(dt: number): void {
    if (this._alertTimer <= 0 || !this._energyMat) return;
    this._alertTimer -= dt;
    const flash = Math.floor(this._alertTimer * 14) % 2 === 0;
    if (flash) {
      this._energyMat.color.setHex(this._alertColor);
      this._energyMat.emissive.setHex(this._alertColor);
    } else {
      this._energyMat.color.setHex(0x00eeff);
      this._energyMat.emissive.setHex(0x004455);
    }
    if (this._alertTimer <= 0) {
      this._energyMat.color.setHex(0x00eeff);
      this._energyMat.emissive.setHex(0x004455);
    }
  }

  protected _build3DModel(): THREE.Object3D {
    const group = new THREE.Group();

    this._energyMat = new THREE.MeshPhongMaterial({
      color: 0x00eeff, emissive: 0x00aacc, shininess: 250, specular: 0xaaffff,
    });
    const coreGlowMat = new THREE.MeshPhongMaterial({
      color: 0x00eeff, emissive: 0x009999, transparent: true, opacity: 0.5,
      shininess: 10, specular: 0x66ffff,
    });
    const conduitMat = new THREE.MeshPhongMaterial({
      color: 0x00ccdd, emissive: 0x005566, shininess: 200, specular: 0x88ffff,
      transparent: true, opacity: 0.9,
    });
    const darkMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0x081420,
      shininess: 140,
      specular: 0x44bbdd,
    });

    const lathePoints = [
      new THREE.Vector2(0,    70),
      new THREE.Vector2(6,    58),
      new THREE.Vector2(16,   38),
      new THREE.Vector2(24,   10),
      new THREE.Vector2(26,   -5),
      new THREE.Vector2(23,  -22),
      new THREE.Vector2(16,  -42),
      new THREE.Vector2(10,  -55),
    ];
    const latheGeo = new THREE.LatheGeometry(lathePoints, 24);
    const ridgeGeo = new THREE.BoxGeometry(100, 5, 8);
    const wingGeo = new THREE.BoxGeometry(50, 5, 12);
    const tipGeo = new THREE.ConeGeometry(6, 30, 4);
    const canardGeo = new THREE.BoxGeometry(26, 3.5, 8);
    const stripeGeo = new THREE.BoxGeometry(44, 1.5, 3);
    const prongGeo = new THREE.CylinderGeometry(3, 1.5, 45, 8);
    const ringGeo = new THREE.TorusGeometry(4, 1.0, 8, 16);
    const nacelleGeo = new THREE.CylinderGeometry(8, 10, 35, 12);
    const exhaustRingGeo = new THREE.TorusGeometry(9, 1.5, 8, 16);
    const flameGeo = new THREE.ConeGeometry(7, 20, 10);
    const centralPortGeo = new THREE.CylinderGeometry(10, 12, 12, 12);
    const centralFlameGeo = new THREE.ConeGeometry(9, 24, 10);

    const hullGeos: THREE.BufferGeometry[] = [];
    const energyGeos: THREE.BufferGeometry[] = [];
    const conduitGeos: THREE.BufferGeometry[] = [];
    const flameGeos: THREE.BufferGeometry[] = [];

    const fuselageGeo = cloneColoredGeometry(latheGeo, 0x2a5c9e);
    fuselageGeo.rotateZ(Math.PI / 2);
    hullGeos.push(fuselageGeo);

    for (const zSide of [1, -1]) {
      const ridge = cloneColoredGeometry(ridgeGeo, 0x4a8cd4);
      ridge.translate(-5, 0, zSide * 22);
      hullGeos.push(ridge);
    }

    for (const side of [1, -1]) {
      const wing = cloneColoredGeometry(wingGeo, 0x6aacee);
      wing.rotateZ(side * -0.2);
      wing.translate(10, side * 52, 0);
      hullGeos.push(wing);

      const tip = ensureNonIndexed(tipGeo);
      tip.rotateZ(side * Math.PI / 2);
      tip.translate(10, side * 78, 0);
      energyGeos.push(tip);

      const canard = cloneColoredGeometry(canardGeo, 0x4a8cd4);
      canard.rotateZ(side * -0.3);
      canard.translate(-42, side * 34, 0);
      hullGeos.push(canard);

      const stripe = ensureNonIndexed(stripeGeo);
      stripe.rotateZ(side * -0.2);
      stripe.translate(10, side * 52, 7);
      conduitGeos.push(stripe);
    }

    this._coreGroup = new THREE.Group();
    this._coreGroup.position.set(-12, 0, 18);
    group.add(this._coreGroup);
    this._coreGroup.add(new THREE.Mesh(new THREE.OctahedronGeometry(18), this._energyMat));
    this._coreGroup.add(new THREE.Mesh(new THREE.SphereGeometry(24, 14, 12), coreGlowMat));

    for (const yOff of [12, -12]) {
      const prong = cloneColoredGeometry(prongGeo, 0x1a3050);
      prong.rotateZ(Math.PI / 2);
      prong.translate(-90, yOff, 0);
      hullGeos.push(prong);

      const ring = ensureNonIndexed(ringGeo);
      ring.rotateY(Math.PI / 2);
      ring.translate(-113, yOff, 0);
      energyGeos.push(ring);
    }

    for (const side of [1, -1]) {
      const nacelle = cloneColoredGeometry(nacelleGeo, 0x1a3050);
      nacelle.rotateZ(Math.PI / 2);
      nacelle.translate(50, side * 30, 0);
      hullGeos.push(nacelle);

      const exhaustRing = ensureNonIndexed(exhaustRingGeo);
      exhaustRing.rotateY(Math.PI / 2);
      exhaustRing.translate(68, side * 30, 0);
      conduitGeos.push(exhaustRing);

      const flame = ensureNonIndexed(flameGeo);
      flame.rotateZ(-Math.PI / 2);
      flame.translate(80, side * 30, 0);
      flameGeos.push(flame);
    }

    const centralPort = cloneColoredGeometry(centralPortGeo, 0x1a3050);
    centralPort.rotateZ(Math.PI / 2);
    centralPort.translate(55, 0, 0);
    hullGeos.push(centralPort);

    const centralFlame = ensureNonIndexed(centralFlameGeo);
    centralFlame.rotateZ(-Math.PI / 2);
    centralFlame.translate(72, 0, 0);
    flameGeos.push(centralFlame);

    const mergedHullGeo = mergeGeometries(hullGeos);
    const mergedEnergyGeo = mergeGeometries(energyGeos);
    const mergedConduitGeo = mergeGeometries(conduitGeos);
    const mergedFlameGeo = mergeGeometries(flameGeos);

    const hullMesh = new THREE.Mesh(mergedHullGeo, darkMat);
    const energyMesh = new THREE.Mesh(mergedEnergyGeo, this._energyMat);
    const conduitMesh = new THREE.Mesh(mergedConduitGeo, conduitMat);
    const flameMesh = new THREE.Mesh(mergedFlameGeo, coreGlowMat);

    group.add(hullMesh);
    group.add(energyMesh);
    group.add(conduitMesh);
    group.add(flameMesh);

    hullGeos.forEach(g => g.dispose());
    energyGeos.forEach(g => g.dispose());
    conduitGeos.forEach(g => g.dispose());
    flameGeos.forEach(g => g.dispose());
    latheGeo.dispose();
    ridgeGeo.dispose();
    wingGeo.dispose();
    tipGeo.dispose();
    canardGeo.dispose();
    stripeGeo.dispose();
    prongGeo.dispose();
    ringGeo.dispose();
    nacelleGeo.dispose();
    exhaustRingGeo.dispose();
    flameGeo.dispose();
    centralPortGeo.dispose();
    centralFlameGeo.dispose();

    return group;
  }
}
