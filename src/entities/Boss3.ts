import * as THREE from 'three';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.ts';
import { BossBase } from './BossBase.ts';
import { Bullet } from './Bullet.ts';
import { Explosion } from './Explosion.ts';
import { BulletType, EnemyType, type GetPositionFn, type IAudio, type SpawnEnemyFn, type IScene, type BossConstructorParams } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TOTAL_HP       = 100;
const STOP_X         = 300;
const ENTRY_SPEED    = 60;
const DISPLAY_W      = 300;
const DISPLAY_H      = 400;
const HITBOX_HW      = 80;
const HITBOX_HH      = 120;
const HIT_COOLDOWN   = 0.1;
const DYING_DURATION = 4.0;

interface TentacleJointData {
  joints: THREE.Object3D[];
  angOffset: number;
  baseY: number;
}

interface PustuleItem {
  mesh: THREE.Mesh;
  baseScale: number;
}

function ensureNonIndexed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const cloned = geo.index ? geo.toNonIndexed() : geo.clone();
  if (cloned.hasAttribute('uv')) {
    cloned.deleteAttribute('uv');
  }
  return cloned;
}

function addVertexColor(geo: THREE.BufferGeometry, colorHex: number): void {
  const posAttr = geo.getAttribute('position');
  if (!posAttr) return;
  const colors = new Float32Array(posAttr.count * 3);
  const color = new THREE.Color(colorHex);
  for (let i = 0; i < posAttr.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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

export class Boss3 extends BossBase {
  private _spawnEnemy: SpawnEnemyFn;
  private _isOpen: boolean;
  private _stateTimer: number;
  private _sporeTimer: number;
  private _waveTimer: number;
  private _elapsedOpenTime: number;
  private _chargeSoundPlayed: boolean;
  private _rippleCount: number;
  private _rippleTimer: number;
  private _extraExplosions: Explosion[];
  private _animTime: number;

  // 3D model sub-components (assigned in _build3DModel)
  private _teethGroup!: THREE.Group;
  private _teethPivots!: THREE.Group[];
  private _tentacles!: TentacleJointData[];
  private _eyeGroup!: THREE.Group;
  private _baseLobes!: THREE.Mesh[];
  private _basePustules!: PustuleItem[];
  private _chargeSphere!: THREE.Mesh | null;
  private _irisMat!: THREE.MeshPhongMaterial;
  private _pustuleYellowMat!: THREE.MeshPhongMaterial;
  private _pustuleMagentaMat!: THREE.MeshPhongMaterial;
  private _pupilMesh!: THREE.Mesh;
  private _corneaMesh!: THREE.Mesh;

  constructor({ scene, sprites, getPlayerPos, onDeath, audio, spawnEnemy }: BossConstructorParams) {
    super(scene, sprites, getPlayerPos, onDeath, audio, STOP_X, ENTRY_SPEED, TOTAL_HP, DISPLAY_W, DISPLAY_H);

    this._spawnEnemy = spawnEnemy;
    this.score = 15000;
    this._isOpen = false;
    this._stateTimer = 3.0;

    // Projectile & SFX tracking state variables
    this._sporeTimer = 2.0;
    this._waveTimer  = 0;

    this._elapsedOpenTime = 0;
    this._chargeSoundPlayed = false;
    this._rippleCount = 0;
    this._rippleTimer = 0;

    this._extraExplosions = [];
    this._animTime = 0;

    this._displayName = 'Hive Heart (L3)';
    this._init();
  }

  get hw(): number { return HITBOX_HW; }
  get hh(): number { return HITBOX_HH; }

  protected _getHitCooldownDur(): number { return HIT_COOLDOWN; }
  protected _getDyingDuration(): number  { return DYING_DURATION; }

  override get deathConfig() {
    return {
      explosionCount: 80,
      explosionColor: 0xaa3bff,
      explosionMinSpeed: 100,
      explosionMaxSpeed: 600,
      explosionParticleSize: 12,
      flashOpacity: 0.6,
      shakeIntensity: 8,
      decayingShake: false,
    };
  }

  protected override _canTakeDamage(_zone: string): boolean {
    return this._isOpen; // Immune when teeth are closed
  }

  protected _tickBoss(dt: number): void {
    this._animTime += dt;
    this._updatePhases(dt);
    this._updateAttacks(dt);
    this._animateComponents(dt);
  }

  private _updatePhases(dt: number): void {
    if (this._hp <= 30) {
      if (!this._isOpen) {
        this._isOpen = true;
        this._teethGroup.visible = false;
        this._audio.play('bossAlert');
      }
      return;
    }

    this._stateTimer -= dt;
    if (this._stateTimer <= 0) {
      this._isOpen = !this._isOpen;
      this._audio.play('organicSquish');
      this._stateTimer = this._isOpen ? 4.5 : 4.0;

      this._elapsedOpenTime = 0;
      this._chargeSoundPlayed = false;
      if (this._chargeSphere) {
        this._chargeSphere.scale.setScalar(0.001);
        this._chargeSphere.visible = false;
      }

      if (this._isOpen && this._hp <= 60) {
        this._rippleCount = 3;
        this._rippleTimer = 0.1;
      }
    }
  }

  private _updateAttacks(dt: number): void {
    const timeMs = this._animTime * 1000;
    const isDesperate = this._hp <= 30;

    if (isDesperate) {
      this._waveTimer -= dt;
      if (this._waveTimer <= 0) {
        this._waveTimer = 0.13;

        const sweepAngle = Math.sin(timeMs * 0.0035) * 1.05;
        const vx = -480 * Math.cos(sweepAngle);
        const vy = 480 * Math.sin(sweepAngle);

        this._newBullets.push(new Bullet(
          this._scene, this._sprites, BulletType.BOSS_LASER, this.x - 30, this.y, vx, vy
        ));
        this._audio.play('bioLaser');
      }

      this._sporeTimer -= dt;
      if (this._sporeTimer <= 0) {
        this._sporeTimer = 2.4;
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
          this._newBullets.push(new Bullet(
            this._scene, this._sprites, BulletType.HOMING, this.x - 10, this.y,
            Math.cos(ang) * 160, Math.sin(ang) * 160, this._getPlayerPos
          ));
        }
      }

    } else if (this._hp <= 60) {
      if (this._isOpen && this._rippleCount > 0) {
        this._rippleTimer -= dt;
        if (this._rippleTimer <= 0) {
          this._rippleTimer = 0.35;
          this._rippleCount--;

          this._newBullets.push(new Bullet(
            this._scene, this._sprites, BulletType.WAVE, this.x - 40, this.y, -320, 0
          ));
          this._audio.play('bioLaser');
        }
      }

      if (!this._isOpen) {
        this._sporeTimer -= dt;
        if (this._sporeTimer <= 0) {
          this._sporeTimer = 2.4;
          this._spawnMinion();
        }
      }

    } else {
      if (this._isOpen) {
        this._elapsedOpenTime += dt;
        if (this._elapsedOpenTime < 1.2) {
          if (!this._chargeSoundPlayed) {
            this._audio.play('laserCharge');
            this._chargeSoundPlayed = true;
          }
          const ratio = this._elapsedOpenTime / 1.2;
          if (this._chargeSphere) {
            this._chargeSphere.visible = true;
            this._chargeSphere.scale.setScalar(ratio * 1.6);
            this._chargeSphere.rotation.z += 5 * dt;
          }
        } else {
          if (this._chargeSphere && this._chargeSphere.visible) {
            this._chargeSphere.visible = false;
            this._chargeSphere.scale.setScalar(0.001);

            const p = this._getPlayerPos();
            const dx = p.x - this.x;
            const dy = p.y - this.y;
            const dist = Math.hypot(dx, dy);

            const vx = (dx / dist) * 440;
            const vy = (dy / dist) * 440;

            this._newBullets.push(new Bullet(
              this._scene, this._sprites, 'bossLaser', this.x - 20, this.y - 12, vx, vy
            ));
            this._newBullets.push(new Bullet(
              this._scene, this._sprites, 'bossLaser', this.x - 20, this.y + 12, vx, vy
            ));
            this._audio.play('bioLaser');
          }
        }
      }

      if (!this._isOpen) {
        this._sporeTimer -= dt;
        if (this._sporeTimer <= 0) {
          this._sporeTimer = 2.8;
          this._spawnMinion();
        }
      }
    }
  }

  private _spawnMinion(): void {
    const type = Math.random() < 0.5 ? EnemyType.SPORE : EnemyType.SWARM;
    const ox = this.x - 80;
    const oy = this.y + (Math.random() < 0.5 ? 120 : -120);
    this._spawnEnemy(type, ox, oy);
  }

  private _animateComponents(dt: number): void {
    const timeMs = this._animTime * 1000;
    const isDesperate = this._hp <= 30;

    const targetOpen = this._isOpen ? 1.0 : 0.0;
    this._teethPivots.forEach(pivot => {
      pivot.rotation.y = THREE.MathUtils.lerp(pivot.rotation.y, targetOpen * 0.95, 6 * dt);
    });

    if (!this._isOpen) {
      const rotSpeed = (this._hp <= 60 ? 1.5 : 1.0);
      this._teethGroup.rotation.z += rotSpeed * dt;
    }

    const waveSpeed = isDesperate ? 8.5 : (this._hp <= 60 ? 5.5 : 3.5);
    const waveAmp   = isDesperate ? 0.35 : (this._hp <= 60 ? 0.24 : 0.16);

    this._tentacles.forEach((tent, idx) => {
      if (this._hp <= 60 && !isDesperate) {
        const dir = idx < 2 ? 1 : -1;
        const sweep = Math.sin(timeMs * 0.002) * 55;
        const parent = tent.joints[0]!.parent;
        if (parent) {
          parent.position.y = tent.baseY + dir * sweep;
        }
      } else {
        const parent = tent.joints[0]!.parent;
        if (parent) {
          parent.position.y = tent.baseY;
        }
      }

      tent.joints.forEach((joint, jIdx) => {
        const phase = jIdx * 0.6 + tent.angOffset;
        const targetRot = Math.sin(timeMs * 0.001 * waveSpeed + phase) * waveAmp;
        joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, targetRot, 5 * dt);
      });
    });

    if (this._eyeGroup) {
      const basePulse = 1.0 + Math.sin(timeMs * 0.006) * 0.05;
      this._eyeGroup.scale.set(basePulse, basePulse, 1.0);
    }

    if (this._baseLobes) {
      this._baseLobes.forEach((lobe, idx) => {
        const phase = idx * 0.45;
        const scaleZ = 0.75 + Math.sin(timeMs * 0.004 + phase) * 0.12;
        const scaleXY = 1.0 + Math.sin(timeMs * 0.004 + phase) * 0.08;
        lobe.scale.set(scaleXY, scaleXY, scaleZ);
      });
    }

    if (this._basePustules) {
      this._basePustules.forEach((item, idx) => {
        const phase = idx * 0.6;
        const pulse = item.baseScale * (1.0 + Math.sin(timeMs * 0.006 + phase) * 0.18);
        item.mesh.scale.setScalar(pulse);
      });
    }

    if (this._pustuleYellowMat && this._pustuleMagentaMat) {
      const glowPulse = 0.5 + Math.sin(timeMs * 0.005) * 0.5;
      this._pustuleYellowMat.emissive.setRGB(0.61 * (0.55 + glowPulse * 0.45), 0.87 * (0.55 + glowPulse * 0.45), 0);
      this._pustuleMagentaMat.emissive.setRGB(0.87 * (0.55 + glowPulse * 0.45), 0, 0.55 * (0.55 + glowPulse * 0.45));
    }

    if (isDesperate && this._irisMat) {
      const pulseRed = 0.6 + Math.sin(timeMs * 0.01) * 0.4;
      this._irisMat.color.setRGB(0.95, 0.02, 0.05);
      this._irisMat.emissive.setRGB(0.65 * pulseRed, 0.01, 0.02);
    }
  }

  protected override _onDyingTick(dt: number): void {
    if (Math.random() < 0.16) {
      const ox = this.x + (Math.random() - 0.5) * 130;
      const oy = this.y + (Math.random() - 0.5) * 130;
      this._extraExplosions.push(new Explosion(this._scene, ox, oy, {
        count: 20, minSpeed: 60, maxSpeed: 250, size: 8, color: Math.random() < 0.5 ? 0xff00aa : 0xaa3bff, duration: 0.8
      }));
      this._audio.play('explosion');
    }

    this._extraExplosions.forEach(exp => exp.update(dt));
    this._extraExplosions = this._extraExplosions.filter(exp => !exp.isDone);
  }

  override destroy(): void {
    this._extraExplosions.forEach(exp => exp.destroy());
    this._extraExplosions = [];
    super.destroy();
  }

  protected _build3DModel(): THREE.Object3D {
    const group = new THREE.Group();

    const baseMat = new THREE.MeshPhongMaterial({
      color: 0xd63e6e,       // Vibrant fleshy rose-crimson
      emissive: 0x480a24,    // Warm biological red-purple backing
      shininess: 90,         // Glistening wet surface
      specular: 0xff8ab4,    // Pinkish glistening highlights
      flatShading: true,
    });

    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x00061a,       // Shiny deep black pupil
      emissive: 0x000105,
      shininess: 100,
      specular: 0xffffff,
    });

    const irisMat = new THREE.MeshPhongMaterial({
      color: 0x00ffcc,       // Glowing neon cyan iris
      emissive: 0x008866,
      shininess: 95,
      specular: 0xffffff,
    });
    this._irisMat = irisMat;

    const corneaMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.20,         // Semi-translucent glass shell
      shininess: 100,
      specular: 0xffffff,
    });

    const plateMat = new THREE.MeshPhongMaterial({
      color: 0xf2ebd9,       // Luminous skeletal bone white
      emissive: 0x3d3025,
      shininess: 85,
      specular: 0xffffff,
      flatShading: true,
      vertexColors: true,
    });

    const pustuleYellowMat = new THREE.MeshPhongMaterial({
      color: 0xd4ff2a,       // Glowing toxic yellow-green
      emissive: 0x9cdd00,
      shininess: 100,
      specular: 0xffffff,
    });
    this._pustuleYellowMat = pustuleYellowMat;

    const pustuleMagentaMat = new THREE.MeshPhongMaterial({
      color: 0xff00b7,       // Glowing neon-magenta stinger bulbs
      emissive: 0xdd008c,
      shininess: 100,
      specular: 0xffffff,
    });
    this._pustuleMagentaMat = pustuleMagentaMat;

    const chargeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,       // Holographic spinning charge mesh
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });

    const baseGroup = new THREE.Group();
    this._baseLobes = [];

    const anchorGeo = new THREE.CylinderGeometry(55, 65, 8, 12);
    anchorGeo.rotateX(Math.PI / 2);
    const anchorMesh = new THREE.Mesh(anchorGeo, baseMat);
    anchorMesh.position.z = -12;
    baseGroup.add(anchorMesh);

    const innerLobeCount = 8;
    for (let i = 0; i < innerLobeCount; i++) {
      const radius = 16 + Math.random() * 8;
      const lobeGeo = new THREE.SphereGeometry(radius, 12, 12);
      const lobe = new THREE.Mesh(lobeGeo, baseMat);

      const angle = (i / innerLobeCount) * Math.PI * 2;
      const dist = 18 + Math.random() * 8;
      lobe.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, -3 + Math.random() * 4);
      lobe.scale.set(1.0, 1.0, 0.75);

      baseGroup.add(lobe);
      this._baseLobes.push(lobe);
    }

    const outerLobeCount = 12;
    for (let i = 0; i < outerLobeCount; i++) {
      const radius = 20 + Math.random() * 10;
      const lobeGeo = new THREE.SphereGeometry(radius, 12, 12);
      const lobe = new THREE.Mesh(lobeGeo, baseMat);

      const angle = (i / outerLobeCount) * Math.PI * 2;
      const dist = 45 + Math.random() * 15;
      lobe.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, -6 + Math.random() * 6);
      lobe.scale.set(1.0, 1.0, 0.7);

      baseGroup.add(lobe);
      this._baseLobes.push(lobe);
    }

    this._basePustules = [];
    const numPustulesBase = 12;
    for (let i = 0; i < numPustulesBase; i++) {
      const pRadius = 4.0 + Math.random() * 5.0;
      const pGeo = new THREE.SphereGeometry(pRadius, 8, 8);
      const pMat = Math.random() < 0.5 ? pustuleYellowMat : pustuleMagentaMat;
      const pustule = new THREE.Mesh(pGeo, pMat);

      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 40;
      pustule.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, 4 + Math.random() * 6);

      baseGroup.add(pustule);
      this._basePustules.push({ mesh: pustule, baseScale: 1.0 + Math.random() * 0.2 });
    }

    group.add(baseGroup);

    this._tentacles = [];
    const attachmentAngles = [Math.PI / 4.5, Math.PI - Math.PI / 4.5, Math.PI + Math.PI / 4.5, -Math.PI / 4.5];
    for (let i = 0; i < 4; i++) {
      const tentGroup = new THREE.Group();
      const ang = attachmentAngles[i]!;
      const dist = 75;
      const bx = Math.cos(ang) * dist;
      const by = Math.sin(ang) * dist;
      tentGroup.position.set(bx, by, -5);
      baseGroup.add(tentGroup);

      const joints: THREE.Object3D[] = [];
      let parent: THREE.Object3D = tentGroup;
      const jointCount = 7;
      for (let j = 0; j < jointCount; j++) {
        const t = j / (jointCount - 1);
        const r = 11.5 * (1 - t * 0.65) + 3;
        const sphereGeo = new THREE.SphereGeometry(r, 8, 8);
        const sphereMesh = new THREE.Mesh(sphereGeo, baseMat);

        if (j === jointCount - 1) {
          const stingerGeo = new THREE.SphereGeometry(r * 1.3, 8, 8);
          const stinger = new THREE.Mesh(stingerGeo, pustuleMagentaMat);
          sphereMesh.add(stinger);
        }

        sphereMesh.position.set(-15, 0, 0);
        parent.add(sphereMesh);
        joints.push(sphereMesh);
        parent = sphereMesh;
      }
      this._tentacles.push({ joints, angOffset: i * (Math.PI / 2), baseY: by });
    }

    this._eyeGroup = new THREE.Group();
    this._eyeGroup.position.set(0, 0, 10);

    const scleraMat = new THREE.MeshPhongMaterial({
      color: 0xf5edf0,
      emissive: 0x3d1425,
      shininess: 90,
      specular: 0xffffff,
    });
    const scleraGeo = new THREE.SphereGeometry(26, 16, 16);
    scleraGeo.scale(1.0, 1.0, 0.7);
    const scleraMesh = new THREE.Mesh(scleraGeo, scleraMat);
    this._eyeGroup.add(scleraMesh);

    const irisGeo = new THREE.SphereGeometry(17, 16, 16);
    irisGeo.scale(1.0, 1.0, 0.35);
    const irisMesh = new THREE.Mesh(irisGeo, irisMat);
    irisMesh.position.set(0, 0, 12);
    this._eyeGroup.add(irisMesh);

    const pupilGeo = new THREE.SphereGeometry(8.5, 12, 12);
    pupilGeo.scale(1.0, 1.0, 0.4);
    const pupilMesh = new THREE.Mesh(pupilGeo, coreMat);
    pupilMesh.position.set(0, 0, 16.5);
    this._eyeGroup.add(pupilMesh);
    this._pupilMesh = pupilMesh;

    const chargeGeo = new THREE.SphereGeometry(15, 12, 12);
    const chargeMesh = new THREE.Mesh(chargeGeo, chargeMat);
    chargeMesh.position.set(0, 0, 16);
    chargeMesh.scale.setScalar(0.001);
    chargeMesh.visible = false;
    this._eyeGroup.add(chargeMesh);
    this._chargeSphere = chargeMesh;

    const corneaGeo = new THREE.SphereGeometry(27, 16, 16);
    corneaGeo.scale(1.0, 1.0, 0.72);
    const corneaMesh = new THREE.Mesh(corneaGeo, corneaMat);
    corneaMesh.position.set(0, 0, 0.5);
    this._eyeGroup.add(corneaMesh);
    this._corneaMesh = corneaMesh;

    group.add(this._eyeGroup);

    this._teethGroup = new THREE.Group();
    this._teethGroup.position.set(0, 0, 0);

    this._teethPivots = [];
    const teethCount = 8;
    for (let i = 0; i < teethCount; i++) {
      const ang = (i / teethCount) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(ang) * 44, Math.sin(ang) * 44, 14);
      pivot.rotation.z = ang;

      const clawGeo = new THREE.CylinderGeometry(5.0, 1.8, 38, 8);
      const jointGeo = new THREE.SphereGeometry(5.5, 8, 8);
      const stingerGeo = new THREE.SphereGeometry(3.6, 6, 6);
      const toothGeos = [
        coloredGeometry(clawGeo, 0xf2ebd9, geo => {
          geo.rotateZ(Math.PI / 2);
          geo.translate(-19, 0, 0);
        }),
        coloredGeometry(jointGeo, 0xf2ebd9),
        coloredGeometry(jointGeo, 0xf2ebd9, geo => {
          geo.translate(-18, 0, 0);
        }),
        coloredGeometry(stingerGeo, 0xd4ff2a, geo => {
          geo.translate(-37, 0, 1.5);
        }),
      ];
      const toothGeo = mergeGeometries(toothGeos);
      const tooth = new THREE.Mesh(toothGeo, plateMat);
      pivot.add(tooth);

      toothGeos.forEach(geo => geo.dispose());
      clawGeo.dispose();
      jointGeo.dispose();
      stingerGeo.dispose();

      this._teethGroup.add(pivot);
      this._teethPivots.push(pivot);
    }

    group.add(this._teethGroup);

    return group;
  }
}
