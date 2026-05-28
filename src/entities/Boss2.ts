import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { BossBase } from './BossBase.ts';
import { Bullet } from './Bullet.ts';
import { BulletType, type GetPositionFn, type IAudio, type IScene, type ICollidable, type BossConstructorParams } from '../types.ts';

const HALF_H = GAME_HEIGHT / 2;

const TOTAL_HP       = 75;
const PHASE1_HP      = 50;
const PHASE2_HP      = 25;
const STOP_X         = 240;
const ENTRY_SPEED    = 80;
const DISPLAY_W      = 260;
const DISPLAY_H      = 160;
const HITBOX_HW      = 95;
const HITBOX_HH      = 55;
const HIT_COOLDOWN   = 0.20;
const DYING_DURATION = 2.8;
const PORT_OFFSETS   = [45, -45];

interface SpreadConfig {
  count: number;
  speed: number;
  halfAngle: number;
}

// Difficulty tuned for ~level 3/10 of a 10-level progression
interface Phase {
  activeLasers: number;
  laserFreq: number;
  fireInterval: number;
  spread: SpreadConfig;
  homingFreq: number;
  circular?: boolean;
  alertColor?: number;
}

const PHASES: Phase[] = [
  { activeLasers: 1, laserFreq: 3.5, fireInterval: 2.2, spread: { count: 3, speed: 185, halfAngle: 0.55 }, homingFreq: 5.0 },
  { activeLasers: 2, laserFreq: 2.5, fireInterval: 1.6, spread: { count: 3, speed: 210, halfAngle: 0.50 }, homingFreq: 3.5, alertColor: 0xff7700 },
  { activeLasers: 2, laserFreq: 1.8, fireInterval: 1.1, spread: { count: 5, speed: 240, halfAngle: 0.46 }, homingFreq: 2.5, circular: true, alertColor: 0xff3300 },
];

interface LaserState {
  portOffset: number;
  recharge: number;
}

export class Boss2 extends BossBase {
  private _phaseIdx: number;
  private _driftDir: number;
  private _driftY: number;
  private _baseY: number;
  private _fireTimer: number;
  private _circTimer: number;
  private _homingTimer: number;
  private _alertTimer: number;
  private _lasers: LaserState[];
  private _drillMesh: THREE.Group | null = null;

  constructor({ scene, sprites, getPlayerPos, onDeath, audio }: BossConstructorParams) {
    super(scene, sprites, getPlayerPos, onDeath, audio, STOP_X, ENTRY_SPEED, TOTAL_HP, DISPLAY_W, DISPLAY_H);

    this.score = 8000;
    this._phaseIdx = 0;

    this._driftDir  = 1;
    this._driftY    = 0;
    this._baseY     = 0;

    this._fireTimer    = 1.5;
    this._circTimer    = 5.0;
    this._homingTimer  = 2.0;

    this._alertTimer = 0;

    this._lasers = PORT_OFFSETS.map((portOffset, idx) => {
      return {
        portOffset,
        recharge: idx * 1.5,
      };
    });

    this._displayName = 'Industrial (L2)';
    this._init();
  }

  get hw(): number { return HITBOX_HW; }
  get hh(): number { return HITBOX_HH; }
  override get lasers(): ReadonlyArray<ICollidable> { return []; } // No persistent laser hitboxes

  protected _getHitCooldownDur(): number { return HIT_COOLDOWN; }
  protected _getDyingDuration(): number  { return DYING_DURATION; }

  override get deathConfig() {
    return {
      explosionCount: 56,
      explosionColor: 0xff6600,
      explosionMinSpeed: 80,
      explosionMaxSpeed: 450,
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
    this._updateDrift(dt);
    this._updateLasers(dt);
    this._updateFiring(dt);

    // Animate drill spinning along longitudinal X-axis (roll)
    if (this._drillMesh) {
      this._drillMesh.rotation.x += 16 * dt;
    }
  }

  private _updateDrift(dt: number): void {
    if (!this._mesh) return;
    const DRIFT_SPEED = 22;
    this._driftY += DRIFT_SPEED * this._driftDir * dt;
    const limit = HALF_H - DISPLAY_H / 2 - 20;
    if (Math.abs(this._driftY) > limit) {
      this._driftDir *= -1;
      this._driftY = Math.sign(this._driftY) * limit;
    }
    this._mesh.position.y = this._driftY;
  }

  private _muzzleY(portOffset: number): number { return this._mesh ? this._mesh.position.y + portOffset : portOffset; }
  private _muzzleX(): number           { return this._mesh ? this._mesh.position.x - DISPLAY_W / 2 - 4 : 0; }

  private _updateLasers(dt: number): void {
    if (!this._mesh) return;
    const phase = PHASES[this._phaseIdx]!;

    for (const [i, laser] of this._lasers.entries()) {
      if (i >= phase.activeLasers) continue;

      laser.recharge -= dt;
      if (laser.recharge <= 0) {
        const oy = this._mesh.position.y + laser.portOffset;
        const ox = this._muzzleX();
        this._newBullets.push(new Bullet(this._scene, this._sprites, BulletType.BOSS_LASER, ox, oy, -550, 0));
        laser.recharge = phase.laserFreq;
      }
    }
  }

  private _updateFiring(dt: number): void {
    const phase = PHASES[this._phaseIdx]!;
    this._fireTimer -= dt;
    if (this._fireTimer <= 0) {
      this._fireSpread(phase.spread);
      this._fireTimer = phase.fireInterval;
    }

    if (phase.homingFreq) {
      this._homingTimer -= dt;
      if (this._homingTimer <= 0) {
        this._fireHoming();
        this._homingTimer = phase.homingFreq;
      }
    }

    if (phase.circular) {
      this._circTimer -= dt;
      if (this._circTimer <= 0) {
        this._fireCircular(10, 220);
        this._circTimer = 4.0;
      }
    }
  }

  private _fireHoming(): void {
    const ox = this._muzzleX(), oy = this._mesh?.position.y ?? 0;
    this._newBullets.push(new Bullet(this._scene, this._sprites, BulletType.HOMING, ox, oy, -150,  150, this._getPlayerPos));
    this._newBullets.push(new Bullet(this._scene, this._sprites, BulletType.HOMING, ox, oy, -150, -150, this._getPlayerPos));
  }

  private _fireSpread({ count, speed, halfAngle }: SpreadConfig): void {
    const { x: px, y: py } = this._getPlayerPos();
    const ox = this._muzzleX(), oy = this._mesh?.position.y ?? 0;
    const aim  = Math.atan2(py - oy, px - ox);
    const step = count === 1 ? 0 : halfAngle * 2 / (count - 1);
    for (let i = 0; i < count; i++) {
      const a = aim - halfAngle + step * i;
      this._newBullets.push(new Bullet(this._scene, this._sprites, BulletType.BOSS, ox, oy, Math.cos(a) * speed, Math.sin(a) * speed));
    }
  }

  private _fireCircular(count: number, speed: number): void {
    const ox = this._muzzleX(), oy = this._mesh?.position.y ?? 0;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this._newBullets.push(new Bullet(this._scene, this._sprites, BulletType.BOSS, ox, oy, Math.cos(a) * speed, Math.sin(a) * speed));
    }
  }

  private _setMeshColor(hexColor: number): void {
    this._mesh?.traverse(child => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshPhongMaterial;
        if (mat.color) {
          mat.color.setHex(hexColor);
        }
      }
    });
  }

  protected override _checkPhase(): void {
    const newPhase = this._hp > PHASE1_HP ? 0 : this._hp > PHASE2_HP ? 1 : 2;
    if (newPhase !== this._phaseIdx) {
      this._phaseIdx = newPhase;
      const colors   = [0xaa3bff, 0xff8800, 0xff2200];
      this._alertTimer = 0.7;
      this._setMeshColor(colors[newPhase]!);
      this._audio.play('bossAlert');
    }
  }

  protected override _updateAlertFlash(dt: number): void {
    if (this._alertTimer <= 0) return;
    this._alertTimer -= dt;
    const colors = [0xaa3bff, 0xff8800, 0xff2200];
    const flash  = Math.floor(this._alertTimer * 14) % 2 === 0;
    this._setMeshColor(flash ? colors[this._phaseIdx]! : 0xffffff);
    if (this._alertTimer <= 0) {
      this._mesh?.traverse(child => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshPhongMaterial;
          if (mat.color && child.userData.origColor !== undefined) {
            mat.color.setHex(child.userData.origColor);
          }
        }
      });
    }
  }

  protected _build3DModel(): THREE.Object3D {
    const group = new THREE.Group();

    const plateMat = new THREE.MeshPhongMaterial({
      color: 0x48505c,       // Volumetric mid-gray steel
      emissive: 0x101215,    // Soft passive steel glow
      shininess: 50,         // Clean metallic sheen
      specular: 0x556070,    // Soft steel specular reflection
    });

    const hullMat = new THREE.MeshPhongMaterial({
      color: 0x333b47,       // Bright inner engine core
      emissive: 0x0f1217,
      shininess: 100,
      specular: 0x8899aa,
    });

    const drillMat = new THREE.MeshPhongMaterial({
      color: 0xd4953b,       // Bright copper-bronze
      emissive: 0x3d270d,
      shininess: 100,
      specular: 0xffeebb,
    });

    const drillBladeMat = new THREE.MeshPhongMaterial({
      color: 0x1f232b,       // Dark titanium spiral blades
      emissive: 0x07090d,
      shininess: 80,
    });

    const steelMat = new THREE.MeshPhongMaterial({
      color: 0x828c9a,       // Bright mid-steel gray for pistons
      emissive: 0x22262c,
      shininess: 100,
      specular: 0xcccccc,    // High metallic shine just under pure white blowout
    });

    const hazardMat = new THREE.MeshPhongMaterial({
      color: 0xff8800,       // Original warm hazard orange
      emissive: 0x331b00,
      shininess: 70,
    });

    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x00ffee,
    });

    const exhaustMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
    });

    const coreCylGeo = new THREE.CylinderGeometry(50, 52, 140, 16);
    coreCylGeo.rotateZ(Math.PI / 2);
    const coreCyl = new THREE.Mesh(coreCylGeo, hullMat);
    coreCyl.position.set(0, 0, -5);
    group.add(coreCyl);

    const outerPlateGeo = new THREE.BoxGeometry(160, 120, 24);
    const outerPlate = new THREE.Mesh(outerPlateGeo, plateMat);
    outerPlate.position.set(0, 0, -10);
    group.add(outerPlate);

    const panelGeo = new THREE.BoxGeometry(100, 40, 6);

    const panelTop = new THREE.Mesh(panelGeo, steelMat);
    panelTop.position.set(10, 35, 8);
    group.add(panelTop);

    const panelBottom = new THREE.Mesh(panelGeo, steelMat);
    panelBottom.position.set(10, -35, 8);
    group.add(panelBottom);

    const podGeo = new THREE.CylinderGeometry(15, 15, 90, 12);
    podGeo.rotateZ(Math.PI / 2);

    const podTop = new THREE.Mesh(podGeo, plateMat);
    podTop.position.set(0, 65, -8);
    group.add(podTop);

    const podBottom = new THREE.Mesh(podGeo, plateMat);
    podBottom.position.set(0, -65, -8);
    group.add(podBottom);

    const bandGeo = new THREE.TorusGeometry(16, 2.5, 8, 16);
    bandGeo.rotateY(Math.PI / 2);

    for (let offset = -30; offset <= 30; offset += 60) {
      const bandTop = new THREE.Mesh(bandGeo, hazardMat);
      bandTop.position.set(offset, 65, -8);
      group.add(bandTop);

      const bandBottom = new THREE.Mesh(bandGeo, hazardMat);
      bandBottom.position.set(offset, -65, -8);
      group.add(bandBottom);
    }

    const armGeo = new THREE.CylinderGeometry(7, 7, 45, 12);
    armGeo.rotateZ(Math.PI / 2);

    const topArm = new THREE.Mesh(armGeo, steelMat);
    topArm.position.set(-60, 58, 10);
    group.add(topArm);

    const bottomArm = new THREE.Mesh(armGeo, steelMat);
    bottomArm.position.set(-60, -58, -10);
    group.add(bottomArm);

    const portGeo = new THREE.CylinderGeometry(10, 10, 24, 16);
    portGeo.rotateZ(Math.PI / 2);

    const topPort = new THREE.Mesh(portGeo, steelMat);
    topPort.position.set(-85, 45, 5);
    group.add(topPort);

    const bottomPort = new THREE.Mesh(portGeo, steelMat);
    bottomPort.position.set(-85, -45, -5);
    group.add(bottomPort);

    const lensGeo = new THREE.CylinderGeometry(7, 7, 4, 16);
    lensGeo.rotateZ(Math.PI / 2);

    const topLens = new THREE.Mesh(lensGeo, laserMat);
    topLens.position.set(-97, 45, 5);
    group.add(topLens);

    const bottomLens = new THREE.Mesh(lensGeo, laserMat);
    bottomLens.position.set(-97, -45, -5);
    group.add(bottomLens);

    this._drillMesh = new THREE.Group();
    this._drillMesh.position.set(-95, 0, 0);

    const drillGeo = new THREE.ConeGeometry(25, 62, 16);
    drillGeo.rotateZ(Math.PI / 2);
    const drillCore = new THREE.Mesh(drillGeo, drillMat);
    this._drillMesh.add(drillCore);

    const bladeGeo = new THREE.BoxGeometry(45, 3, 6);
    bladeGeo.rotateZ(-Math.PI / 10);

    for (let r = 0; r < 4; r++) {
      const angle = (r / 4) * Math.PI * 2;
      const blade = new THREE.Mesh(bladeGeo, drillBladeMat);
      blade.position.set(0, Math.cos(angle) * 12, Math.sin(angle) * 12);
      blade.rotation.x = angle;
      this._drillMesh.add(blade);
    }
    group.add(this._drillMesh);

    const ventGeo = new THREE.CylinderGeometry(8, 6, 12, 12);
    ventGeo.rotateZ(Math.PI / 2);

    const flameGeo = new THREE.SphereGeometry(5, 12, 12);

    for (let i = -1; i <= 1; i++) {
      const vy = i * 28;
      const vent = new THREE.Mesh(ventGeo, steelMat);
      vent.position.set(85, vy, 0);
      group.add(vent);

      const flame = new THREE.Mesh(flameGeo, exhaustMat);
      flame.position.set(92, vy, 0);
      group.add(flame);
    }

    return group;
  }
}
