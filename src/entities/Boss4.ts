import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { BossBase } from './BossBase.ts';
import { Bullet } from './Bullet.ts';
import { BulletType, EnemyType, type GetPositionFn, type IAudio, type SpawnEnemyFn, type IScene, type BossConstructorParams } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed, addVertexColor } from '../utils/ProceduralToolkit.ts';

const HALF_W = GAME_WIDTH  / 2;
const HALF_H = GAME_HEIGHT / 2;

const DISPLAY_W      = 220;
const DISPLAY_H      = 380;
const STOP_X         = 280;
const ENTRY_SPEED    = 120;
const HIT_COOLDOWN   = 0.08;
const DYING_DURATION = 4.5;

const HP_PLATE = 30; // 30 HP per back carapace plate
const HP_CORE  = 90; // 90 HP for molten belly core

interface BossPlate {
  mesh: THREE.Object3D;
  hp: number;
  destroyed: boolean;
}

type ChargeState = 'patrol' | 'warning' | 'charging' | 'returning';

interface SegmentConfig {
  type: 'head' | 'body' | 'tail';
  offset: number;
  w?: number;
  h?: number;
  d?: number;
  r?: number;
  l?: number;
}

function coloredGeometry(
  source: THREE.BufferGeometry,
  colorHex: number,
  transform?: (geo: THREE.BufferGeometry) => void,
): THREE.BufferGeometry {
  const geo = ensureNonIndexed(source);
  if (transform) transform(geo);
  addVertexColor(geo, colorHex);
  return geo;
}


function mergedColoredMesh(geos: THREE.BufferGeometry[], material: THREE.MeshPhongMaterial): THREE.Mesh {
  const merged = mergeGeometries(geos);
  geos.forEach(geo => geo.dispose());
  return new THREE.Mesh(merged, material);
}

function collapseStaticMeshChildren(
  group: THREE.Group,
  material: THREE.MeshPhongMaterial,
  skippedMaterials: Set<THREE.Material>,
): void {
  const geos: THREE.BufferGeometry[] = [];
  const meshesToRemove: THREE.Mesh[] = [];
  const geometriesToDispose = new Set<THREE.BufferGeometry>();
  group.updateWorldMatrix(true, true);
  const groupInverse = group.matrixWorld.clone().invert();
  group.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    const childMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
    if (!childMaterial || skippedMaterials.has(childMaterial)) return;

    child.updateWorldMatrix(true, false);
    const geo = ensureNonIndexed(child.geometry);
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(groupInverse, child.matrixWorld));

    const color = childMaterial instanceof THREE.MeshBasicMaterial || childMaterial instanceof THREE.MeshPhongMaterial
      ? childMaterial.color.getHex()
      : 0xffffff;
    addVertexColor(geo, color);
    geos.push(geo);
    meshesToRemove.push(child);
    geometriesToDispose.add(child.geometry);
  });

  if (geos.length === 0) return;
  meshesToRemove.forEach(mesh => mesh.parent?.remove(mesh));
  geometriesToDispose.forEach(geo => geo.dispose());
  group.add(mergedColoredMesh(geos, material));
}

export class Boss4 extends BossBase {
  private _spawnEnemy: SpawnEnemyFn;
  private _hpPlateL: number;
  private _hpPlateR: number;
  private _hpCore: number;
  private _plateLAlive: boolean;
  private _plateRAlive: boolean;

  private _headShakeTimer: number;
  private _time: number;
  private _patrolTimer: number;
  private _frenzyTime: number;
  private _onTop: boolean;

  private _lavaTimer: number;
  private _summonTimer: number;
  private _geyserTimer: number;
  private _stalactiteTimer: number;

  private _chargeState: ChargeState;
  private _chargeTimer: number;
  private _chargeWarningTimer: number;
  private _chargeSpeed: number;

  // 3D model sub-components (assigned in _build3DModel)
  private _segments!: THREE.Group[];
  private _jointMats!: THREE.MeshPhongMaterial[];
  private _legGroups!: THREE.Group[];
  private _coreMesh!: THREE.Mesh | null;
  private _plateLMesh!: THREE.Group;
  private _plateRMesh!: THREE.Group;
  private _headJointMat!: THREE.MeshPhongMaterial;
  private _headEyeMat!: THREE.MeshPhongMaterial;
  private _headSeg1!: THREE.Group;
  private _headSeg2!: THREE.Group;
  private _headSeg3!: THREE.Group;
  private _headJoint1!: THREE.Mesh;
  private _headJoint2!: THREE.Mesh;

  constructor({ scene, sprites, getPlayerPos, onDeath, audio, spawnEnemy }: BossConstructorParams) {
    super(scene, sprites, getPlayerPos, onDeath, audio, STOP_X, ENTRY_SPEED, HP_PLATE * 2 + HP_CORE, DISPLAY_W, DISPLAY_H);

    this._spawnEnemy = spawnEnemy;
    this._hpPlateL    = HP_PLATE;
    this._hpPlateR    = HP_PLATE;
    this._hpCore      = HP_CORE;
    this._plateLAlive = true;
    this._plateRAlive = true;

    this._headShakeTimer = 0;

    this._time        = 0;
    this._patrolTimer = 0;
    this._frenzyTime  = 0;
    this._onTop       = true;

    this._lavaTimer       = 1.5;
    this._summonTimer     = 3.0;
    this._geyserTimer     = 2.5;
    this._stalactiteTimer = 4.0;

    this._chargeState        = 'patrol';
    this._chargeTimer        = 5.0;
    this._chargeWarningTimer = 0;
    this._chargeSpeed        = 480;

    this.score = 20000;

    this._displayName = 'Volcanic Titan (L4)';
    this._init();
    // Override offscreen start position for L4 Cavern Ceiling entry angle
    if (this._mesh) {
      this._mesh.position.set(HALF_W + DISPLAY_W / 2 + 100, 130, 0);
    }
  }

  get hw(): number { return 0; } // multi-hitbox active
  get hh(): number { return 0; }

  hitZones(): Array<{ id: string; x: number; y: number; hw: number; hh: number }> {
    const zones: Array<{ id: string; x: number; y: number; hw: number; hh: number }> = [];
    const boxL = this.hboxL;
    if (boxL) zones.push({ id: 'plateL', ...boxL });
    const boxR = this.hboxR;
    if (boxR) zones.push({ id: 'plateR', ...boxR });
    const boxCore = this.hboxCore;
    if (boxCore) zones.push({ id: 'core', ...boxCore });
    return zones;
  }

  get hboxL(): { x: number; y: number; hw: number; hh: number } | null {
    if (!this._plateLAlive) return null;
    return { x: this.x - 10, y: this.y + 34, hw: 40, hh: 16 };
  }

  get hboxR(): { x: number; y: number; hw: number; hh: number } | null {
    if (!this._plateRAlive) return null;
    return { x: this.x - 10, y: this.y - 34, hw: 40, hh: 16 };
  }

  get hboxCore(): { x: number; y: number; hw: number; hh: number } | null {
    if (this._phase() === 1) return null;
    if (this._plateLAlive && this._plateRAlive) return null;
    return { x: this.x - 15, y: this.y, hw: 35, hh: 35 };
  }

  protected _getHitCooldownDur(): number { return HIT_COOLDOWN; }
  protected _getDyingDuration(): number  { return DYING_DURATION; }

  override get deathConfig() {
    return {
      explosionCount: 140,
      explosionColor: 0xff4400,
      explosionMinSpeed: 90,
      explosionMaxSpeed: 750,
      explosionParticleSize: 16,
      flashOpacity: 0.9,
      shakeIntensity: 12,
      decayingShake: true,
    };
  }

  protected override _canTakeDamage(zone: string): boolean {
    if (zone === 'plateL') return this._plateLAlive;
    if (zone === 'plateR') return this._plateRAlive;
    if (zone === 'core') return !this._plateLAlive || !this._plateRAlive;
    return true;
  }

  protected override _applyDamage(damage: number, zone: string): void {
    if (zone === 'plateL' && this._plateLAlive) {
      this._hpPlateL -= damage;
      if (this._hpPlateL <= 0) {
        this._plateLAlive = false;
        this._updateSprite();
        this._audio.play('explosion');
        this._scene.flash(0.2); // armor break flash
      }
    } else if (zone === 'plateR' && this._plateRAlive) {
      this._hpPlateR -= damage;
      if (this._hpPlateR <= 0) {
        this._plateRAlive = false;
        this._updateSprite();
        this._audio.play('explosion');
        this._scene.flash(0.2); // armor break flash
        if (!this._plateLAlive) this._audio.play('bossAlert'); // both gone roar
      }
    } else if (zone === 'core') {
      this._hpCore -= damage;
    }

    // Recalculate overall HP
    this._hp = (this._plateLAlive ? this._hpPlateL : 0) +
               (this._plateRAlive ? this._hpPlateR : 0) +
               Math.max(0, this._hpCore);
  }

  protected override _isDead(): boolean {
    return !this._plateLAlive && !this._plateRAlive && this._hpCore <= 0;
  }

  protected override _updateEntrance(dt: number): void {
    if (this._entered || !this._mesh) return;
    this._mesh.position.x -= ENTRY_SPEED * dt;
    const targetY = 130;
    this._mesh.position.y = THREE.MathUtils.lerp(this._mesh.position.y, targetY, 4 * dt);

    if (this._mesh.position.x <= STOP_X) {
      this._mesh.position.x = STOP_X;
      this._mesh.position.y = targetY;
      this._entered = true;
      this._onEntranceComplete();
    }
  }

  protected override _onEntranceComplete(): void {
    super._onEntranceComplete();
    if (this._mesh) this._mesh.position.y = 130;
  }

  private _phase(): number {
    if (!this._plateLAlive && !this._plateRAlive) return 3;
    if (!this._plateLAlive || !this._plateRAlive) return 2;
    return 1;
  }

  protected _tickBoss(dt: number): void {
    this._updateStateAndMovement(dt);
    this._updateAttacks(dt);
    this._animateSubmeshes(dt);
  }

  private _updateStateAndMovement(dt: number): void {
    if (!this._mesh) return;
    const phase = this._phase();

    if (phase === 1) {
      this._mesh.position.x = STOP_X;
      this._mesh.position.y = 130;

    } else if (phase === 2) {
      if (this._chargeState === 'patrol') {
        this._patrolTimer += dt;
        this._mesh.position.y = Math.sin(this._patrolTimer * 1.5) * 120;
        this._mesh.position.x = THREE.MathUtils.lerp(this._mesh.position.x, STOP_X, 4 * dt);

        this._chargeTimer -= dt;
        if (this._chargeTimer <= 0) {
          this._chargeState = 'warning';
          this._chargeWarningTimer = 0.6;
          this._audio.play('bossAlert');
        }

      } else if (this._chargeState === 'warning') {
        this._chargeWarningTimer -= dt;
        const jitterX = (Math.random() - 0.5) * 4.5;
        const jitterY = (Math.random() - 0.5) * 4.5;

        this._mesh.position.x = STOP_X + jitterX;
        this._mesh.position.y += jitterY;

        if (this._chargeWarningTimer <= 0) {
          this._chargeState = 'charging';
          this._chargeSpeed = 480;
        }

      } else if (this._chargeState === 'charging') {
        this._mesh.position.x -= this._chargeSpeed * dt;

        if (this._mesh.position.x <= -HALF_W + 100) {
          this._chargeState = 'returning';
        }

      } else if (this._chargeState === 'returning') {
        this._mesh.position.x += 160 * dt;

        if (this._mesh.position.x >= STOP_X) {
          this._mesh.position.x = STOP_X;
          this._chargeState = 'patrol';
          this._chargeTimer = 5.5 + Math.random() * 2.0;
        }
      }

    } else if (phase === 3) {
      this._frenzyTime += dt;
      this._mesh.position.y = Math.sin(this._frenzyTime * 2.4) * 130;
      this._mesh.position.x = STOP_X - 90 + Math.cos(this._frenzyTime * 1.6) * 110;
    }
  }

  private _updateAttacks(dt: number): void {
    const phase = this._phase();

    this._lavaTimer -= dt;
    if (this._lavaTimer <= 0) {
      const interval = phase === 3 ? 1.3 : 2.2;
      const count    = phase === 3 ? 5 : 3;
      this._fireLavaSpread(count);
      this._lavaTimer = interval;
    }

    if (phase === 1) {
      this._summonTimer -= dt;
      if (this._summonTimer <= 0) {
        this._summonRockDrake();
        this._summonTimer = 6.5;
      }

      this._stalactiteTimer -= dt;
      if (this._stalactiteTimer <= 0) {
        this._triggerStalactiteTremor();
        this._stalactiteTimer = 5.0;
      }
    }

    if (phase >= 2 && this._chargeState === 'patrol') {
      this._geyserTimer -= dt;
      if (this._geyserTimer <= 0) {
        this._fireGeyser();
        this._geyserTimer = phase === 3 ? 2.8 : 3.8;
      }
    }
  }

  private _animateSubmeshes(dt: number): void {
    this._time += dt;

    this._segments.forEach((seg, idx) => {
      if (idx === 0) {
        if (this._headSeg1 && this._headSeg2 && this._headSeg3) {
          this._headSeg1.position.set(8, 0, 0);
          this._headSeg2.position.set(-4, 0, 0);
          this._headSeg3.position.set(-16, 0, 0);
          this._headSeg1.rotation.set(0, 0, 0);
          this._headSeg2.rotation.set(0, 0, 0);
          this._headSeg3.rotation.set(0, 0, 0);

          const wiggle2 = Math.sin(this._time * 3.5) * 1.5;
          const wiggle3 = Math.sin(this._time * 3.5 - 0.8) * 2.5;
          this._headSeg2.position.y += wiggle2;
          this._headSeg2.rotation.z += wiggle2 * 0.05;

          this._headSeg3.position.y += wiggle3;
          this._headSeg3.rotation.z += wiggle3 * 0.06;

          if (this._headShakeTimer > 0) {
            const jitterX = Math.sin(this._time * 70) * 3.5;
            const jitterY = Math.cos(this._time * 70) * 3.5;
            this._headSeg1.position.x += jitterX;
            this._headSeg1.position.y += jitterY;
            this._headSeg2.position.x += jitterX;
            this._headSeg2.position.y += jitterY;
            this._headSeg3.position.x += jitterX;
            this._headSeg3.position.y += jitterY;
            if (this._headJoint1) {
              this._headJoint1.position.x = 2 + jitterX;
              this._headJoint1.position.y = jitterY;
            }
            if (this._headJoint2) {
              this._headJoint2.position.x = -10 + jitterX;
              this._headJoint2.position.y = jitterY;
            }
          } else {
            if (this._headJoint1) {
              this._headJoint1.position.set(2, 0, 0);
            }
            if (this._headJoint2) {
              this._headJoint2.position.set(-10, 0, 0);
            }
          }
        }
        return;
      }

      const wave = Math.sin(this._time * 7 - idx * 0.7) * 4.5;
      seg.position.y = wave;

      if (idx === 6) {
        seg.rotation.z = Math.sin(this._time * 11) * 0.22;
        seg.position.z = Math.sin(this._time * 9) * 10;
      }
    });

    const legCycle = Math.sin(this._time * 6.5);
    this._legGroups.forEach((leg, idx) => {
      const phaseOffset = (idx % 2 === 0) ? 1 : -1;
      leg.rotation.z = legCycle * 0.22 * phaseOffset;
      leg.rotation.x = legCycle * 0.12 * phaseOffset;
    });

    if (this._coreMesh) {
      const pulse = 1.0 + Math.sin(this._time * 9) * 0.08;
      this._coreMesh.scale.setScalar(pulse);
    }

    const heartbeatIntensity = 0.5 + Math.sin(this._time * 6) * 0.35;
    this._jointMats.forEach(mat => {
      mat.emissive.setRGB(heartbeatIntensity * 1.0, heartbeatIntensity * 0.18, 0.0);
    });

    const phase = this._phase();
    if (phase === 3) {
      const flareVal = 1.0 + Math.abs(Math.sin(this._time * 12)) * 3.0;

      if (this._headJointMat) {
        this._headJointMat.emissive.setRGB(flareVal * 1.0, flareVal * 0.65, flareVal * 0.3);
      }
      if (this._headEyeMat) {
        this._headEyeMat.emissive.setRGB(flareVal * 1.0, flareVal * 0.8, flareVal * 0.5);
      }
    } else {
      if (this._headJointMat) {
        this._headJointMat.emissive.setRGB(heartbeatIntensity * 1.0, heartbeatIntensity * 0.18, 0.0);
      }
      if (this._headEyeMat) {
        const eyeShimmer = 0.85 + Math.sin(this._time * 4) * 0.15;
        this._headEyeMat.emissive.setRGB(eyeShimmer * 1.0, eyeShimmer * 0.66, 0.0);
      }
    }
  }

  private _fireLavaSpread(count: number): void {
    const ox = this.x - 70;
    const oy = this.y - 10;
    const spread = Math.PI / 5.5;
    const tgt = this._getPlayerPos();
    const baseAngle = Math.atan2(tgt.y - oy, tgt.x - ox);

    for (let i = 0; i < count; i++) {
      const frac = count > 1 ? i / (count - 1) : 0.5;
      const angle = baseAngle + spread * (frac - 0.5);
      const speed = 145;

      this._newBullets.push(new Bullet(
        this._scene, this._sprites, BulletType.LAVA, ox, oy,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
      ));
    }
    this._audio.play('shoot');
  }

  private _fireGeyser(): void {
    this._headShakeTimer = 0.6;
    const ox = this.x - 50;

    for (let i = 0; i < 5; i++) {
      const frac  = i / 4;
      const angle = (Math.PI / 4.5) * (frac - 0.5);
      const speed = 190;

      this._newBullets.push(new Bullet(
        this._scene, this._sprites, BulletType.LAVA, ox, this.y,
        Math.cos(Math.PI / 2 + angle) * speed, Math.sin(Math.PI / 2 + angle) * speed,
      ));
      this._newBullets.push(new Bullet(
        this._scene, this._sprites, BulletType.LAVA, ox, this.y,
        Math.cos(-Math.PI / 2 + angle) * speed, Math.sin(-Math.PI / 2 + angle) * speed,
      ));
    }
    this._audio.play('shoot');
  }

  private _summonRockDrake(): void {
    const side = Math.random() < 0.5;
    const spawnY = (side ? 1 : -1) * (HALF_H - 40);
    this._spawnEnemy(EnemyType.ROCK_DRAKE, HALF_W + 90, spawnY);
  }

  private _triggerStalactiteTremor(): void {
    this._audio.play('bossAlert');
    this._scene.flash(0.08);

    const px = this._getPlayerPos().x;
    this._spawnEnemy(EnemyType.STALACTITE, px + 140, HALF_H + 40);
    this._spawnEnemy(EnemyType.STALACTITE, px + 260, HALF_H + 40);
  }

  private _updateSprite(): void {
    if (this._plateLMesh) this._plateLMesh.visible = this._plateLAlive;
    if (this._plateRMesh) this._plateRMesh.visible = this._plateRAlive;
  }

  private _buildLeg(xOffset: number, zOffset: number, isFront: boolean, isLeftLeg: boolean): THREE.Group {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, isFront ? 24 : -24, zOffset);

    const legMat = new THREE.MeshPhongMaterial({
      color: 0x7a5f4c,
      emissive: 0x24180f,
      specular: 0x544031,
      shininess: 15,
      flatShading: true,
      vertexColors: true,
    });

    const clawMat = new THREE.MeshPhongMaterial({
      color: 0xb59a85,
      emissive: 0x33251a,
      specular: 0x7a6352,
      shininess: 10,
      flatShading: true,
    });

    const geos: THREE.BufferGeometry[] = [];

    const thighGeo = new THREE.CylinderGeometry(5.5, 7.5, 30, 6);
    geos.push(coloredGeometry(thighGeo, 0x7a5f4c, geo => {
      geo.rotateZ(isFront ? -Math.PI / 4.5 : Math.PI / 4.5);
      geo.translate(isLeftLeg ? -10 : 10, isFront ? 10 : -10, 0);
    }));

    const shinGeo = new THREE.CylinderGeometry(4.2, 4.2, 26, 6);
    geos.push(coloredGeometry(shinGeo, 0x7a5f4c, geo => {
      geo.rotateZ(isFront ? Math.PI / 6.5 : -Math.PI / 6.5);
      geo.translate(isLeftLeg ? -22 : 22, isFront ? 24 : -24, 0);
    }));

    const clawGeo = new THREE.ConeGeometry(3.8, 14, 4);
    geos.push(coloredGeometry(clawGeo, 0xb59a85, geo => {
      geo.rotateZ(Math.PI);
      geo.translate(isLeftLeg ? -28 : 28, isFront ? 35 : -35, -5);
    }));
    geos.push(coloredGeometry(clawGeo, 0xb59a85, geo => {
      geo.rotateZ(Math.PI);
      geo.translate(isLeftLeg ? -28 : 28, isFront ? 35 : -35, 5);
    }));

    legGroup.add(mergedColoredMesh(geos, legMat));

    thighGeo.dispose();
    shinGeo.dispose();
    clawGeo.dispose();
    clawMat.dispose();

    return legGroup;
  }

  protected _build3DModel(): THREE.Object3D {
    this._segments   = [];
    this._jointMats  = [];
    this._legGroups  = [];

    const group = new THREE.Group();

    const rockMat = new THREE.MeshPhongMaterial({
      color: 0x7a6a5f, // Basalt rock
      emissive: 0x381f12,
      specular: 0x54473e,
      shininess: 35,
      flatShading: true,
      vertexColors: true,
    });

    const facetMat = new THREE.MeshPhongMaterial({
      color: 0x948375, // Basalt scale facets
      emissive: 0x3c2311,
      specular: 0x6a5d52,
      shininess: 25,
      flatShading: true,
      vertexColors: true,
    });

    const plateMat = new THREE.MeshPhongMaterial({
      color: 0x685a50, // Carapace plate
      emissive: 0x2b1b11,
      specular: 0x473b32,
      shininess: 15,
      flatShading: true,
      vertexColors: true,
    });

    const lavaMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
    });

    const coreMat = new THREE.MeshPhongMaterial({
      color: 0xff3300,
      emissive: 0xff1100,
      specular: 0xffffff,
      shininess: 100,
    });

    this._headJointMat = new THREE.MeshPhongMaterial({
      color: 0xff3300,
      emissive: 0xff3300,
      shininess: 10,
      flatShading: true,
    });

    this._headEyeMat = new THREE.MeshPhongMaterial({
      color: 0x000000,
      emissive: 0xffaa00,
      specular: 0x000000,
      shininess: 0,
      flatShading: true,
    });

    const segmentConfigs: SegmentConfig[] = [
      { type: 'head',  w: 20, h: 25, d: 20, offset: -45 },
      { type: 'body',  r: 28, offset: -20 },
      { type: 'body',  r: 26, offset: 5 },
      { type: 'body',  r: 22, offset: 30 },
      { type: 'body',  r: 18, offset: 50 },
      { type: 'body',  r: 14, offset: 70 },
      { type: 'tail',  r: 8,  l: 45, offset: 95 }
    ];

    segmentConfigs.forEach((cfg, idx) => {
      const segGroup = new THREE.Group();
      segGroup.position.set(cfg.offset, 0, 0);

      if (cfg.type === 'head') {
        this._headSeg1 = new THREE.Group();
        this._headSeg1.position.set(8, 0, 0);

        this._headSeg2 = new THREE.Group();
        this._headSeg2.position.set(-4, 0, 0);

        this._headSeg3 = new THREE.Group();
        this._headSeg3.position.set(-16, 0, 0);

        const rearGeo = new THREE.CylinderGeometry(7, 9.5, 12, 6);
        rearGeo.rotateZ(-Math.PI / 2);
        const rearMesh = new THREE.Mesh(rearGeo, rockMat);
        this._headSeg1.add(rearMesh);

        const hornRGroup = new THREE.Group();
        hornRGroup.position.set(0, 7, 6);

        const h1Geo = new THREE.ConeGeometry(2.8, 10, 5);
        h1Geo.rotateX(Math.PI / 10);
        h1Geo.rotateY(-Math.PI / 12);
        h1Geo.rotateZ(-Math.PI / 6);
        const h1 = new THREE.Mesh(h1Geo, facetMat);
        h1.position.set(0, 4, 0);
        hornRGroup.add(h1);

        const h2Geo = new THREE.ConeGeometry(2.0, 9, 5);
        h2Geo.rotateX(Math.PI / 8);
        h2Geo.rotateY(-Math.PI / 10);
        h2Geo.rotateZ(-Math.PI / 3);
        const h2 = new THREE.Mesh(h2Geo, facetMat);
        h2.position.set(2, 11, 1);
        hornRGroup.add(h2);

        const h3Geo = new THREE.ConeGeometry(1.2, 8, 5);
        h3Geo.rotateX(Math.PI / 6);
        h3Geo.rotateY(-Math.PI / 8);
        h3Geo.rotateZ(-Math.PI / 2);
        const h3 = new THREE.Mesh(h3Geo, facetMat);
        h3.position.set(6, 16, 2);
        hornRGroup.add(h3);

        this._headSeg1.add(hornRGroup);

        const hornLGroup = hornRGroup.clone();
        hornLGroup.position.z = -6;
        hornLGroup.scale.z = -1;
        this._headSeg1.add(hornLGroup);

        const midGeo = new THREE.CylinderGeometry(5.5, 7, 10, 6);
        midGeo.rotateZ(-Math.PI / 2);
        const midMesh = new THREE.Mesh(midGeo, rockMat);
        this._headSeg2.add(midMesh);

        const jawSpineR = new THREE.Mesh(new THREE.ConeGeometry(2, 10, 4), facetMat);
        jawSpineR.position.set(0, -3, 5);
        jawSpineR.rotation.set(Math.PI / 3.5, 0, -Math.PI / 6);
        this._headSeg2.add(jawSpineR);

        const jawSpineL = new THREE.Mesh(new THREE.ConeGeometry(2, 10, 4), facetMat);
        jawSpineL.position.set(0, -3, -5);
        jawSpineL.rotation.set(-Math.PI / 3.5, 0, -Math.PI / 6);
        this._headSeg2.add(jawSpineL);

        const frontGeo = new THREE.CylinderGeometry(2.5, 5.5, 12, 6);
        frontGeo.rotateZ(-Math.PI / 2);
        const frontMesh = new THREE.Mesh(frontGeo, rockMat);
        this._headSeg3.add(frontMesh);

        const snoutSpike = new THREE.Mesh(new THREE.ConeGeometry(1.8, 8, 4), this._headJointMat);
        snoutSpike.position.set(-7, 2.5, 0);
        snoutSpike.rotation.z = -Math.PI / 3;
        this._headSeg3.add(snoutSpike);

        const eyeGeo = new THREE.SphereGeometry(2.2, 8, 8);
        const eyeR = new THREE.Mesh(eyeGeo, this._headEyeMat);
        eyeR.position.set(-3, 2.0, 3.8);
        const eyeL = new THREE.Mesh(eyeGeo, this._headEyeMat);
        eyeL.position.set(-3, 2.0, -3.8);
        this._headSeg3.add(eyeR);
        this._headSeg3.add(eyeL);

        const animatedHeadMaterials = new Set<THREE.Material>([
          this._headJointMat,
          this._headEyeMat,
        ]);
        collapseStaticMeshChildren(this._headSeg1, rockMat, animatedHeadMaterials);
        collapseStaticMeshChildren(this._headSeg2, rockMat, animatedHeadMaterials);
        collapseStaticMeshChildren(this._headSeg3, rockMat, animatedHeadMaterials);

        segGroup.add(this._headSeg1);
        segGroup.add(this._headSeg2);
        segGroup.add(this._headSeg3);

        const jointGeo1 = new THREE.SphereGeometry(6.5, 8, 8);
        this._headJoint1 = new THREE.Mesh(jointGeo1, this._headJointMat);
        this._headJoint1.position.set(2, 0, 0);
        segGroup.add(this._headJoint1);

        const jointGeo2 = new THREE.SphereGeometry(5.0, 8, 8);
        this._headJoint2 = new THREE.Mesh(jointGeo2, this._headJointMat);
        this._headJoint2.position.set(-10, 0, 0);
        segGroup.add(this._headJoint2);

      } else if (cfg.type === 'body') {
        const r = cfg.r ?? 20;
        const bodyGeo = new THREE.SphereGeometry(r, 6, 6);

        const scaleGeo = new THREE.ConeGeometry(r / 3, r / 1.5, 4);
        const segmentGeos = [
          coloredGeometry(bodyGeo, 0x7a6a5f),
          coloredGeometry(scaleGeo, 0x948375, geo => {
            geo.rotateZ(-Math.PI / 6);
            geo.translate(0, r - 2, 0);
          }),
        ];
        segGroup.add(mergedColoredMesh(segmentGeos, rockMat));
        bodyGeo.dispose();
        scaleGeo.dispose();

      } else if (cfg.type === 'tail') {
        const r = cfg.r ?? 8;
        const l = cfg.l ?? 45;
        const tailGeo = new THREE.ConeGeometry(r, l, 5);

        const spikeGeo = new THREE.ConeGeometry(2.2, 10, 4);
        const tailGeos = [
          coloredGeometry(tailGeo, 0x7a6a5f, geo => {
            geo.rotateZ(Math.PI / 2);
          }),
          coloredGeometry(spikeGeo, 0x948375, geo => {
            geo.translate(10, 4, 0);
          }),
          coloredGeometry(spikeGeo, 0x948375, geo => {
            geo.rotateZ(Math.PI);
            geo.translate(10, -4, 0);
          }),
        ];
        segGroup.add(mergedColoredMesh(tailGeos, rockMat));
        tailGeo.dispose();
        spikeGeo.dispose();
      }

      group.add(segGroup);
      this._segments.push(segGroup);

      if (idx >= 1 && idx <= 5) {
        const jointMat = new THREE.MeshPhongMaterial({
          color: 0xff3300,
          emissive: 0xff3300,
          shininess: 10,
        });
        this._jointMats.push(jointMat);

        const r = cfg.r ?? 20;
        const jointGeo = new THREE.SphereGeometry(r * 0.88, 8, 8);
        const joint = new THREE.Mesh(jointGeo, jointMat);
        const nextOffset = segmentConfigs[idx + 1] ? segmentConfigs[idx + 1]!.offset : cfg.offset + 20;
        joint.position.set((cfg.offset + nextOffset) / 2, 0, 0);
        group.add(joint);
      }
    });

    const coreGeo = new THREE.SphereGeometry(18, 16, 16);
    this._coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this._coreMesh.position.set(-10, 0, 8);
    group.add(this._coreMesh);

    const coreLight = new THREE.PointLight(0xff3300, 3.0, 60);
    coreLight.position.set(-10, 0, 15);
    group.add(coreLight);

    this._plateLMesh = new THREE.Group();
    this._plateLMesh.position.set(-10, 34, 0);

    const plateGeo = new THREE.BoxGeometry(80, 16, 28);
    const seamGeo = new THREE.BoxGeometry(50, 4, 30);
    const spireGeo = new THREE.ConeGeometry(5, 14, 4);
    spireGeo.rotateX(Math.PI / 12);
    const plateLGeos = [
      coloredGeometry(plateGeo, 0x685a50),
      coloredGeometry(seamGeo, 0xff3300, geo => {
        geo.translate(0, -6, 0);
      }),
    ];
    for (const xOff of [-20, 0, 20]) {
      plateLGeos.push(coloredGeometry(spireGeo, 0x948375, geo => {
        geo.translate(xOff, 12, 0);
      }));
    }
    this._plateLMesh.add(mergedColoredMesh(plateLGeos, plateMat));
    group.add(this._plateLMesh);

    this._plateRMesh = new THREE.Group();
    this._plateRMesh.position.set(-10, -34, 0);

    const spireGeoR = new THREE.ConeGeometry(5, 14, 4);
    spireGeoR.rotateZ(Math.PI);
    spireGeoR.rotateX(-Math.PI / 12);
    const plateRGeos = [
      coloredGeometry(plateGeo, 0x685a50),
      coloredGeometry(seamGeo, 0xff3300, geo => {
        geo.translate(0, 6, 0);
      }),
    ];
    for (const xOff of [-20, 0, 20]) {
      plateRGeos.push(coloredGeometry(spireGeoR, 0x948375, geo => {
        geo.translate(xOff, -12, 0);
      }));
    }
    this._plateRMesh.add(mergedColoredMesh(plateRGeos, plateMat));
    group.add(this._plateRMesh);

    plateGeo.dispose();
    seamGeo.dispose();
    spireGeo.dispose();
    spireGeoR.dispose();
    lavaMat.dispose();

    const legPlacements = [
      { x: -35, z: 25,  front: true,  left: true },
      { x: -35, z: -25, front: true,  left: false },
      { x: 30,  z: 25,  front: false, left: true },
      { x: 30,  z: -25, front: false, left: false }
    ];

    legPlacements.forEach(placement => {
      const leg = this._buildLeg(placement.x, placement.z, placement.front, placement.left);
      group.add(leg);
      this._legGroups.push(leg);
    });

    return group;
  }
}
