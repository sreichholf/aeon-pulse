import * as THREE from 'three';
import { BossBase } from './BossBase.ts';
import { Explosion } from './Explosion.ts';
import {
  createHeartseerModelInstance,
  getCachedHeartseerModel,
  preloadHeartseerModel,
  type HeartseerSockets,
} from './HeartseerModel.ts';
import {
  BulletType,
  EnemyType,
  type BossConstructorParams,
  type SpawnEnemyFn,
} from '../types.ts';

const TOTAL_HP = 100;
const STOP_X = 300;
const ENTRY_SPEED = 60;
const DISPLAY_W = 340;
const DISPLAY_H = 360;
const HITBOX_HW = 80;
const HITBOX_HH = 108;
const HIT_COOLDOWN = 0.1;
const DYING_DURATION = 4.0;

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
  private _visualRoot: THREE.Group | null;
  private _visualBaseRotation: THREE.Euler | null;
  private _sockets: HeartseerSockets | null;
  private _coreSocketPosition: THREE.Vector3;
  private _heartSocketPosition: THREE.Vector3;
  private _openVisual: number;
  private _desperationVisual: number;
  private _coreHalo: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial>;
  private _shieldShell: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private _chargeSphere: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private _vulnerabilityRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private _desperationRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

  constructor({ scene, sprites, getPlayerPos, onDeath, audio, spawnEnemy, projectileFactory, presentationContext }: BossConstructorParams) {
    super(scene, sprites, getPlayerPos, onDeath, audio, STOP_X, ENTRY_SPEED, TOTAL_HP, DISPLAY_W, DISPLAY_H, projectileFactory, presentationContext);

    this._spawnEnemy = spawnEnemy;
    this.score = 15000;
    this._isOpen = false;
    this._stateTimer = 3.0;
    this._sporeTimer = 2.0;
    this._waveTimer = 0;
    this._elapsedOpenTime = 0;
    this._chargeSoundPlayed = false;
    this._rippleCount = 0;
    this._rippleTimer = 0;
    this._extraExplosions = [];
    this._animTime = 0;
    this._visualRoot = null;
    this._visualBaseRotation = null;
    this._sockets = null;
    this._coreSocketPosition = new THREE.Vector3();
    this._heartSocketPosition = new THREE.Vector3();
    this._openVisual = 0;
    this._desperationVisual = 0;

    this._coreHalo = new THREE.Mesh(
      new THREE.SphereGeometry(18, 18, 18),
      new THREE.MeshPhongMaterial({
        color: 0x54e1d4,
        emissive: 0x125d61,
        shininess: 120,
        transparent: true,
        opacity: 0.95,
      }),
    );
    this._shieldShell = new THREE.Mesh(
      new THREE.SphereGeometry(28, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xb33178,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
        depthWrite: false,
      }),
    );
    this._chargeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(20, 14, 14),
      new THREE.MeshBasicMaterial({
        color: 0x67f5ea,
        transparent: true,
        opacity: 0.8,
        wireframe: true,
        depthWrite: false,
      }),
    );
    this._chargeSphere.visible = false;
    this._chargeSphere.scale.setScalar(0.001);

    this._vulnerabilityRing = new THREE.Mesh(
      new THREE.TorusGeometry(15, 1.8, 8, 36),
      new THREE.MeshBasicMaterial({
        color: 0xff4b79,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this._vulnerabilityRing.visible = false;
    this._vulnerabilityRing.renderOrder = 12;

    this._desperationRing = new THREE.Mesh(
      new THREE.TorusGeometry(38, 2.4, 8, 36),
      new THREE.MeshBasicMaterial({
        color: 0xff4b79,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this._desperationRing.visible = false;
    this._desperationRing.renderOrder = 13;

    this._displayName = 'Heartseer';
    this._init();
  }

  static preloadModel(): Promise<THREE.Group> {
    return preloadHeartseerModel();
  }

  get hw(): number { return HITBOX_HW; }
  get hh(): number { return HITBOX_HH; }

  protected _getHitCooldownDur(): number { return HIT_COOLDOWN; }
  protected _getDyingDuration(): number { return DYING_DURATION; }

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
    return this._isOpen;
  }

  protected _tickBoss(dt: number): void {
    this._animTime += dt;
    this._updatePhases(dt);
    this._updateAttacks(dt);
    this._animateComponents(dt);
  }

  protected override _initPresentationPose(): void {
    this._applyViewerPresentationState();
    this._animateComponents(0);
  }

  protected _build3DModel(): THREE.Object3D {
    const group = new THREE.Group();
    group.add(this._coreHalo);
    group.add(this._shieldShell);
    group.add(this._chargeSphere);
    group.add(this._vulnerabilityRing);
    group.add(this._desperationRing);

    if (typeof window !== 'undefined') {
      const cachedModel = getCachedHeartseerModel();
      if (cachedModel) {
        this._attachVisualInstance(group, cachedModel);
      } else {
        void Boss3.preloadModel()
          .then((source) => {
            if (!this._alive || this._mesh === null) return;
            this._attachVisualInstance(group, source);
          })
          .catch((error) => console.error('Failed to load Heartseer GLB model:', error));
      }
    }

    return group;
  }

  private _attachVisualInstance(group: THREE.Group, source: THREE.Group): void {
    const instance = createHeartseerModelInstance(source);
    this._visualRoot = instance.root;
    this._visualBaseRotation = instance.root.rotation.clone();
    this._sockets = instance.sockets;
    group.add(instance.root);
    this._syncCoreEffectPosition();
    if (this._presentationContext === 'viewer') {
      this._animateComponents(0);
    }
  }

  private _applyViewerPresentationState(): void {
    this._isOpen = true;
    this._stateTimer = 4.5;
    this._elapsedOpenTime = 0;
    this._chargeSoundPlayed = false;
    this._rippleCount = 0;
    this._rippleTimer = 0;
    this._chargeSphere.visible = false;
    this._chargeSphere.scale.setScalar(0.001);
    this._openVisual = 1;
    this._desperationVisual = 0;
  }

  private _updatePhases(dt: number): void {
    if (this._hp <= 30) {
      if (!this._isOpen) {
        this._isOpen = true;
        this._audio.play('bossAlert');
      }
      return;
    }

    this._stateTimer -= dt;
    if (this._stateTimer > 0) return;

    this._isOpen = !this._isOpen;
    this._audio.play('organicSquish');
    this._stateTimer = this._isOpen ? 4.5 : 4.0;
    this._elapsedOpenTime = 0;
    this._chargeSoundPlayed = false;
    this._chargeSphere.scale.setScalar(0.001);
    this._chargeSphere.visible = false;

    if (this._isOpen && this._hp <= 60) {
      this._rippleCount = 3;
      this._rippleTimer = 0.1;
    }
  }

  private _updateAttacks(dt: number): void {
    const timeMs = this._animTime * 1000;
    const isDesperate = this._hp <= 30;

    if (isDesperate) {
      this._waveTimer -= dt;
      if (this._waveTimer <= 0) {
        this._waveTimer = 0.13;
        const origin = this._getSocketWorldPosition(this._sockets?.core, this.x - 30, this.y);
        const sweepAngle = Math.sin(timeMs * 0.0035) * 1.05;
        const vx = -480 * Math.cos(sweepAngle);
        const vy = 480 * Math.sin(sweepAngle);

        this._newBullets.push(this._projectileFactory({
          type: BulletType.BOSS_LASER,
          x: origin.x,
          y: origin.y,
          vx,
          vy,
        }));
        this._audio.play('bioLaser');
      }

      this._sporeTimer -= dt;
      if (this._sporeTimer <= 0) {
        this._sporeTimer = 2.4;
        const upper = this._getSocketWorldPosition(this._sockets?.minionUpper, this.x - 10, this.y - 16);
        const lower = this._getSocketWorldPosition(this._sockets?.minionLower, this.x - 10, this.y + 16);
        const sources = [upper, lower, upper, lower];

        for (let i = 0; i < 4; i += 1) {
          const source = sources[i]!;
          const ang = (i / 4) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
          this._newBullets.push(this._projectileFactory({
            type: BulletType.HOMING,
            x: source.x,
            y: source.y,
            vx: Math.cos(ang) * 160,
            vy: Math.sin(ang) * 160,
            getTargetPos: this._getPlayerPos,
          }));
        }
      }
      return;
    }

    if (this._hp <= 60) {
      if (this._isOpen && this._rippleCount > 0) {
        this._rippleTimer -= dt;
        if (this._rippleTimer <= 0) {
          this._rippleTimer = 0.35;
          this._rippleCount -= 1;
          const origin = this._getSocketWorldPosition(this._sockets?.core, this.x - 40, this.y);

          this._newBullets.push(this._projectileFactory({
            type: BulletType.WAVE,
            x: origin.x,
            y: origin.y,
            vx: -320,
            vy: 0,
          }));
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
      return;
    }

    if (!this._isOpen) {
      this._sporeTimer -= dt;
      if (this._sporeTimer <= 0) {
        this._sporeTimer = 2.8;
        this._spawnMinion();
      }
      return;
    }

    this._elapsedOpenTime += dt;
    if (this._elapsedOpenTime < 1.2) {
      if (!this._chargeSoundPlayed) {
        this._audio.play('laserCharge');
        this._chargeSoundPlayed = true;
      }
      const ratio = this._elapsedOpenTime / 1.2;
      this._chargeSphere.visible = true;
      this._chargeSphere.scale.setScalar(Math.max(0.001, ratio * 1.6));
      this._chargeSphere.rotation.z += 5 * dt;
      return;
    }

    if (!this._chargeSphere.visible) return;

    this._chargeSphere.visible = false;
    this._chargeSphere.scale.setScalar(0.001);
    const upper = this._getSocketWorldPosition(this._sockets?.muzzleUpper, this.x - 20, this.y - 12);
    const lower = this._getSocketWorldPosition(this._sockets?.muzzleLower, this.x - 20, this.y + 12);
    const target = this._getPlayerPos();
    const aimX = target.x - this.x;
    const aimY = target.y - this.y;
    const dist = Math.max(1, Math.hypot(aimX, aimY));
    const vx = (aimX / dist) * 440;
    const vy = (aimY / dist) * 440;

    this._newBullets.push(this._projectileFactory({
      type: BulletType.BOSS_LASER,
      x: upper.x,
      y: upper.y,
      vx,
      vy,
    }));
    this._newBullets.push(this._projectileFactory({
      type: BulletType.BOSS_LASER,
      x: lower.x,
      y: lower.y,
      vx,
      vy,
    }));
    this._audio.play('bioLaser');
  }

  private _spawnMinion(): void {
    const type = Math.random() < 0.5 ? EnemyType.SPORE : EnemyType.SWARM;
    const source = Math.random() < 0.5 ? this._sockets?.minionUpper : this._sockets?.minionLower;
    const origin = this._getSocketWorldPosition(source ?? null, this.x - 80, this.y + (Math.random() < 0.5 ? 120 : -120));
    this._spawnEnemy(type, origin.x, origin.y);
  }

  private _animateComponents(dt: number): void {
    const timeMs = this._animTime * 1000;
    const isDesperate = this._hp <= 30;
    const openTarget = this._isOpen ? 1 : 0;
    const desperateTarget = isDesperate ? 1 : 0;

    this._openVisual += (openTarget - this._openVisual) * Math.min(1, dt * 4.8);
    this._desperationVisual += (desperateTarget - this._desperationVisual) * Math.min(1, dt * 3.2);

    if (this._visualRoot && this._visualBaseRotation) {
      this._visualRoot.position.y = Math.sin(timeMs * 0.0025) * 6;
      this._visualRoot.rotation.x = this._visualBaseRotation.x + Math.sin(timeMs * 0.0011) * 0.04;
      this._visualRoot.rotation.y = this._visualBaseRotation.y;
      this._visualRoot.rotation.z = this._visualBaseRotation.z + Math.sin(timeMs * 0.0016) * (isDesperate ? 0.06 : 0.03);
    }

    this._syncCoreEffectPosition();

    const haloBaseScale = isDesperate ? 1.24 : (this._isOpen ? 1.05 : 0.84);
    const haloPulse = 1 + Math.sin(timeMs * (isDesperate ? 0.012 : 0.006)) * (isDesperate ? 0.22 : 0.10);
    this._coreHalo.scale.setScalar(haloBaseScale * haloPulse);
    this._coreHalo.position.y += Math.sin(timeMs * 0.0065) * (1.2 + this._desperationVisual * 2.0);

    this._shieldShell.visible = this._desperationVisual < 0.98;
    this._shieldShell.rotation.y += 0.9 * dt;
    this._shieldShell.rotation.x -= 0.4 * dt;
    this._shieldShell.scale.set(
      1.04 - this._openVisual * 0.12,
      1.10 - this._openVisual * 0.16,
      1.04 - this._openVisual * 0.10,
    );
    this._shieldShell.material.opacity = 0.20 - this._openVisual * 0.10 - this._desperationVisual * 0.16;

    const vulnerabilityPulse = 0.5 + Math.sin(timeMs * 0.009) * 0.5;
    const vulnerabilityAlpha = this._openVisual * (1 - this._desperationVisual) * (0.34 + vulnerabilityPulse * 0.20);
    this._vulnerabilityRing.visible = vulnerabilityAlpha > 0.02;
    this._vulnerabilityRing.material.opacity = vulnerabilityAlpha;
    this._vulnerabilityRing.rotation.z += dt * (1.1 + this._openVisual * 1.2);
    this._vulnerabilityRing.scale.setScalar(0.86 + this._openVisual * (0.28 + vulnerabilityPulse * 0.10));

    const warningPulse = 0.5 + Math.sin(timeMs * 0.018) * 0.5;
    const warningAlpha = this._desperationVisual * (0.42 + warningPulse * 0.26);
    this._desperationRing.visible = warningAlpha > 0.02;
    this._desperationRing.material.opacity = warningAlpha;
    this._desperationRing.rotation.z -= dt * (2.4 + warningPulse * 1.2);
    this._desperationRing.scale.setScalar(1.08 + this._desperationVisual * (0.30 + warningPulse * 0.12));

    if (isDesperate) {
      this._coreHalo.material.color.setHex(0xff4b79);
      this._coreHalo.material.emissive.setHex(0x7f1437);
      this._shieldShell.material.color.setHex(0xff4b79);
    } else if (this._isOpen) {
      this._coreHalo.material.color.setHex(0x61ffe5);
      this._coreHalo.material.emissive.setHex(0x1a8c84);
      this._shieldShell.material.color.setHex(0x61ffe5);
    } else {
      this._coreHalo.material.color.setHex(0xa04eff);
      this._coreHalo.material.emissive.setHex(0x3d1573);
      this._shieldShell.material.color.setHex(0xdb5ca1);
    }
  }

  protected override _onDyingTick(dt: number): void {
    if (Math.random() < 0.16) {
      const ox = this.x + (Math.random() - 0.5) * 130;
      const oy = this.y + (Math.random() - 0.5) * 130;
      this._extraExplosions.push(new Explosion(this._scene, ox, oy, {
        count: 20,
        minSpeed: 60,
        maxSpeed: 250,
        size: 8,
        color: Math.random() < 0.5 ? 0xff00aa : 0xaa3bff,
        duration: 0.8,
      }));
      this._audio.play('explosion');
    }

    this._extraExplosions.forEach((explosion) => explosion.update(dt));
    this._extraExplosions = this._extraExplosions.filter((explosion) => !explosion.isDone);
  }

  override destroy(): void {
    this._extraExplosions.forEach((explosion) => explosion.destroy());
    this._extraExplosions = [];
    super.destroy();
  }

  private _getSocketWorldPosition(socket: THREE.Object3D | null, fallbackX: number, fallbackY: number): THREE.Vector3 {
    if (!socket || !this._mesh) {
      return new THREE.Vector3(fallbackX, fallbackY, 0);
    }

    this._mesh.updateMatrixWorld(true);
    const position = new THREE.Vector3();
    socket.getWorldPosition(position);
    return position;
  }

  private _syncCoreEffectPosition(): void {
    if (!this._sockets || !this._mesh) {
      this._coreSocketPosition.set(0, 0, 0);
      this._heartSocketPosition.set(0, 0, 0);
    } else {
      this._mesh.updateMatrixWorld(true);
      this._sockets.core.getWorldPosition(this._coreSocketPosition);
      this._mesh.worldToLocal(this._coreSocketPosition);
      this._sockets.heart.getWorldPosition(this._heartSocketPosition);
      this._mesh.worldToLocal(this._heartSocketPosition);
    }

    this._coreHalo.position.copy(this._coreSocketPosition);
    this._shieldShell.position.copy(this._coreSocketPosition);
    this._chargeSphere.position.copy(this._coreSocketPosition);
    this._vulnerabilityRing.position.copy(this._heartSocketPosition);
    this._desperationRing.position.copy(this._heartSocketPosition);
  }
}
