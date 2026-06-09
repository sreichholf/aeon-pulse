import * as THREE from 'three';
import { ProjectileSourceKey, type GetPositionFn, type IBullet, type ITerrain, type IAudio, type IScene, type ProjectileFactoryFn } from '../types.ts';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed } from '../utils/ProceduralToolkit.ts';


const FALL_SPEED = 320;
const SCROLL_SPD = 140;

type StalactiteState = 'hanging' | 'shaking' | 'falling' | 'shattered';

interface ShardParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
}

export class Stalactite extends Enemy {
  private _getScrollX: (() => number) | null;
  private _terrain: ITerrain | null;
  private _audio: IAudio | null;
  private _state: StalactiteState;
  private _shakeTimer: number;
  private _shakeDuration: number;
  private _shatterTimer: number;
  private _time: number;
  private _shards: ShardParticle[];
  private _anchorY: number;
  private _jointMat: THREE.MeshPhongMaterial | null;
  private _lavaTipMat: THREE.MeshPhongMaterial | null;
  private _segments: THREE.Group[];
  private _joints: THREE.Mesh[];
  private _tipMesh: THREE.Mesh | null;
  private _light: THREE.PointLight | null;
  private _shardMaterials: THREE.MeshPhongMaterial[] | null;
  private _shardGeometries: THREE.BufferGeometry[] | null;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn | null,
    getScrollX: (() => number) | null,
    terrain: ITerrain | null,
    audio: IAudio | null,
    projectileFactory: ProjectileFactoryFn,
  ) {
    super(scene, sprites, null, 0, 0, 12, 32, x, y, projectileFactory);
    this._hp           = 1;
    this.score         = 150;
    this._getPlayerPos = getPlayerPos;
    this._getScrollX   = getScrollX;
    this._terrain      = terrain;
    this._audio        = audio;

    // Trap States: 'hanging', 'shaking', 'falling', 'shattered'
    this._state          = 'hanging';
    this._shakeTimer     = 0;
    this._shakeDuration  = 0.4;
    this._shatterTimer   = 0;
    this._time           = 0;
    this._shards         = [];

    // Pre-allocate physical shrapnel shards geometries and materials
    const shardRockMat = new THREE.MeshPhongMaterial({
      color: 0x44372e,
      emissive: 0x1e1007,
      specular: 0x382c24,
      shininess: 35,
      transparent: true,
      opacity: 1
    });

    const shardLavaMat = new THREE.MeshPhongMaterial({
      color: 0xff3300,
      emissive: 0xff3300,
      shininess: 20,
      transparent: true,
      opacity: 1
    });

    this._shardMaterials = [shardRockMat, shardLavaMat];

    this._shardGeometries = [
      new THREE.BoxGeometry(4.5, 4.5, 4.5),
      new THREE.ConeGeometry(2.5, 6, 4),
      new THREE.SphereGeometry(3, 4, 4)
    ];

    // Initialize joint/tip material refs
    this._jointMat    = null;
    this._lavaTipMat  = null;
    this._segments    = [];
    this._joints      = [];
    this._tipMesh     = null;
    this._light       = null;

    // Initialize anchor position aligned with actual ceiling terrain contour
    let ceilingY = y;
    if (this._terrain) {
      const scroll = this._getScrollX ? this._getScrollX() : 0;
      const worldX = scroll + x;
      const walls = this._terrain.getWallsAt(worldX);
      ceilingY = walls.top;
    }
    this._anchorY = ceilingY;

    this._displayName = 'Stalactite';
    this._mesh = this._build3DModel();
    this._mesh.position.y = ceilingY; // Align mesh to ceiling dynamically
    this._mesh.position.z = 1;
    this._scene.add(this._mesh);
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this.x, this.y, 0);

    // Warm basalt dark brown-grey matching RockDrake (brightened for visibility)
    const rockMat = new THREE.MeshPhongMaterial({
      color: 0x7a6a5f,
      emissive: 0x381f12,
      specular: 0x54473e,
      shininess: 35,
    });

    // Lighter volcanic crust/slate (brightened for visibility)
    const armorMat = new THREE.MeshPhongMaterial({
      color: 0x948375,
      emissive: 0x3c2311,
      specular: 0x6a5d52,
      shininess: 25,
    });

    // Molten joint material that we will clone/animate for breathing & shaking
    this._jointMat = new THREE.MeshPhongMaterial({
      color: 0xff3300,
      emissive: 0xff3300,
      shininess: 10,
    });

    const spikeMat = new THREE.MeshPhongMaterial({
      color: 0x7a6c5f,
      emissive: 0x1c0f08,
      specular: 0x3e342c,
      shininess: 30,
    });

    this._lavaTipMat = new THREE.MeshPhongMaterial({
      color: 0xffaa00,
      emissive: 0xff3300,
      shininess: 50,
    });

    this._segments = [];
    this._joints = [];

    // 1. Rock Segment (Top, Middle, Bottom merged)
    const geo1 = new THREE.CylinderGeometry(15, 12, 16, 5);
    const geo1Cloned = ensureNonIndexed(geo1);
    geo1Cloned.translate(0, 20, 0);

    const geo2 = new THREE.CylinderGeometry(10, 7.5, 16, 5);
    const geo2Cloned = ensureNonIndexed(geo2);
    geo2Cloned.translate(0, 0, 0);

    const geo3 = new THREE.ConeGeometry(6, 20, 5);
    const geo3Cloned = ensureNonIndexed(geo3);
    geo3Cloned.rotateZ(Math.PI);
    geo3Cloned.translate(0, -20, 0);

    const rockGeos = [geo1Cloned, geo2Cloned, geo3Cloned];
    const mergedRockGeo = mergeGeometries(rockGeos);
    const stalactiteRockMesh = new THREE.Mesh(mergedRockGeo, rockMat);
    group.add(stalactiteRockMesh);

    rockGeos.forEach(g => g.dispose());
    geo1.dispose();
    geo2.dispose();
    geo3.dispose();

    // 2. Armor Crust Plates merged
    const armor1Geo = new THREE.CylinderGeometry(16.5, 13.5, 6, 5);
    const armor1Cloned = ensureNonIndexed(armor1Geo);
    armor1Cloned.translate(0, 22, 0);

    const armor2Geo = new THREE.CylinderGeometry(11.5, 9, 5, 5);
    const armor2Cloned = ensureNonIndexed(armor2Geo);
    armor2Cloned.translate(0, 1.5, 0);

    const armorGeos = [armor1Cloned, armor2Cloned];
    const mergedArmorGeo = mergeGeometries(armorGeos);
    const stalactiteCrustMesh = new THREE.Mesh(mergedArmorGeo, armorMat);
    group.add(stalactiteCrustMesh);

    armorGeos.forEach(g => g.dispose());
    armor1Geo.dispose();
    armor2Geo.dispose();

    // 3. Spikes merged
    const spikeGeo = new THREE.ConeGeometry(2.5, 8, 4);

    const spike1aCloned = ensureNonIndexed(spikeGeo);
    spike1aCloned.rotateZ(Math.PI / 3);
    spike1aCloned.translate(13, 20, 0);

    const spike1bCloned = ensureNonIndexed(spikeGeo);
    spike1bCloned.translate(-13, 20, 0);

    const spike2Geo = new THREE.ConeGeometry(2, 6, 4);

    const spike2aCloned = ensureNonIndexed(spike2Geo);
    spike2aCloned.rotateZ(Math.PI / 4);
    spike2aCloned.translate(8.5, -1, 0);

    const spike2bCloned = ensureNonIndexed(spike2Geo);
    spike2bCloned.translate(-8.5, -1, 0);

    const spikeGeos = [spike1aCloned, spike1bCloned, spike2aCloned, spike2bCloned];
    const mergedSpikeGeo = mergeGeometries(spikeGeos);
    const stalactiteSpikeMesh = new THREE.Mesh(mergedSpikeGeo, spikeMat);
    group.add(stalactiteSpikeMesh);

    spikeGeos.forEach(g => g.dispose());
    spikeGeo.dispose();
    spike2Geo.dispose();

    // 4. Molten joints merged
    const joint1Geo = new THREE.SphereGeometry(8, 8, 8);
    const joint1Cloned = ensureNonIndexed(joint1Geo);
    joint1Cloned.translate(0, 10, 0);

    const joint2Geo = new THREE.SphereGeometry(5.5, 8, 8);
    const joint2Cloned = ensureNonIndexed(joint2Geo);
    joint2Cloned.translate(0, -10, 0);

    const jointGeos = [joint1Cloned, joint2Cloned];
    const mergedJointGeo = mergeGeometries(jointGeos);
    const stalactiteJointMesh = new THREE.Mesh(mergedJointGeo, this._jointMat);
    group.add(stalactiteJointMesh);

    jointGeos.forEach(g => g.dispose());
    joint1Geo.dispose();
    joint2Geo.dispose();

    // 5. Searing molten glowing tip (separate because it scales dynamically)
    const tipGeo = new THREE.SphereGeometry(3.5, 8, 8);
    const tip = new THREE.Mesh(tipGeo, this._lavaTipMat);
    tip.position.set(0, -30, 0);
    group.add(tip);
    this._tipMesh = tip;

    // Add point light at the magma tip
    const light = new THREE.PointLight(0xff6600, 2.2, 45);
    light.position.set(0, -30, 0);
    group.add(light);
    this._light = light;

    // Cache original colors for flashing
    group.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshPhongMaterial;
        if (mat.color) {
          child.userData['origColor'] = mat.color.getHex();
        }
      }
    });

    return group;
  }

  override get isAlive(): boolean {
    return this._alive && this._state !== 'shattered';
  }

  override get isOffscreen(): boolean {
    return this.x < -HALF_W - 80 || (this._state === 'falling' && this.y < -HALF_H - 120);
  }

  _tick(dt: number): void {
    this._time += dt;
    const scroll = this._getScrollX ? this._getScrollX() : 0;
    const player = this._getPlayerPos ? this._getPlayerPos() : { x: 0, y: 0 };
    const mesh = this._mesh as THREE.Group | null;
    if (!mesh) return;

    switch (this._state) {
      case 'hanging':
        // 1. Anchored to ceiling: scroll left with camera to appear stationary
        mesh.position.x -= SCROLL_SPD * dt;

        // Dynamically adjust Y to follow the jagged terrain ceiling contour
        if (this._terrain) {
          const worldX = scroll + this.x;
          const walls = this._terrain.getWallsAt(worldX);
          mesh.position.y = walls.top;
          this._anchorY = walls.top;
        }

        // 2. Volcanic Thermal Heartbeat animation (slow scale and emissive pulse)
        {
          const pulse = 0.55 + 0.45 * Math.abs(Math.sin(this._time * 3));
          if (this._jointMat) {
            this._jointMat.emissive.setHex(0xff3300).multiplyScalar(pulse);
          }
          if (this._lavaTipMat) {
            this._lavaTipMat.emissive.setHex(0xff3300).multiplyScalar(pulse);
          }
          if (this._tipMesh) {
            const tipScale = 0.95 + 0.15 * Math.abs(Math.sin(this._time * 3));
            this._tipMesh.scale.set(tipScale, tipScale, tipScale);
          }
        }

        // 3. Proximity detection: trigger when player is within 220 units horizontally
        if (Math.abs(this.x - player.x) <= 220 && player.x < this.x) {
          this._state = 'shaking';
          this._shakeTimer = 0;
          this._audio?.play('rockRumble');
        }
        break;

      case 'shaking':
        // 1. Still scroll left with camera
        mesh.position.x -= SCROLL_SPD * dt;

        // Also track the ceiling contour during shake so it doesn't float/detach
        if (this._terrain) {
          const worldX = scroll + this.x;
          const walls = this._terrain.getWallsAt(worldX);
          this._anchorY = walls.top;
        }

        // 2. Jitter the coordinate visual position rapidly for warning alert
        this._shakeTimer += dt;

        {
          const jitterX = (Math.random() - 0.5) * 2.5;
          const jitterY = (Math.random() - 0.5) * 2.5;

          mesh.position.y = this._anchorY + jitterY;
          mesh.position.x += jitterX;

          // 3. Blinding white-hot warning flash
          const t = this._shakeTimer / this._shakeDuration; // 0..1
          if (this._jointMat) {
            this._jointMat.emissive.setRGB(1.0 + t * 4, 0.2 + t * 4, t * 4); // turns blinding white-hot
          }
          if (this._lavaTipMat) {
            this._lavaTipMat.emissive.setRGB(1.0 + t * 4, 0.6 + t * 4, t * 4);
          }
        }

        if (this._shakeTimer >= this._shakeDuration) {
          mesh.position.y = this._anchorY;
          this._state = 'falling';
        }
        break;

      case 'falling':
        // 1. Plunge rapidly and scroll left
        mesh.position.y -= FALL_SPEED * dt;
        mesh.position.x -= SCROLL_SPD * dt;

        // 2. Reset emissive glow back to rich lava levels during fall
        if (this._jointMat) {
          this._jointMat.emissive.setHex(0xff3300).multiplyScalar(1.2);
        }
        if (this._lavaTipMat) {
          this._lavaTipMat.emissive.setHex(0xff3300).multiplyScalar(1.2);
        }

        // 3. Collision with floor (Terrain bottom wall)
        {
          let floorY = -HALF_H - 50;
          if (this._terrain) {
            const worldX = scroll + this.x;
            const walls = this._terrain.getWallsAt(worldX);
            floorY = walls.bottom;
          }

          // Detect impact when the tip of the stalactite (extends 30px below origin) touches floor or screen bottom
          if (this.y - 30 <= floorY || this.y < -HALF_H + 40) {
            this._shatter();
          }
        }
        break;

      case 'shattered':
        // 1. Update visual shrapnel particles in the scene
        this._shatterTimer += dt;
        {
          const progress = this._shatterTimer / 0.5;

          if (this._shards) {
            const gravity = -550; // pixels/s^2 downwards
            for (const shard of this._shards) {
              shard.vy += gravity * dt;

              shard.mesh.position.x += shard.vx * dt;
              shard.mesh.position.y += shard.vy * dt;
              shard.mesh.position.z += shard.vz * dt;

              shard.mesh.rotation.x += shard.rx * dt;
              shard.mesh.rotation.y += shard.ry * dt;
              shard.mesh.rotation.z += shard.rz * dt;
            }
          }

          // 2. Fade out materials dynamically
          if (this._shardMaterials) {
            for (const mat of this._shardMaterials) {
              mat.opacity = Math.max(0, 1 - progress);
            }
          }

          // 3. Complete the shatter sequence after 0.5s
          if (this._shatterTimer >= 0.5) {
            this._alive = false;
          }
        }
        break;
    }
  }

  private _shatter(): void {
    this._state = 'shattered';
    this._shatterTimer = 0;
    this._hp = 0;

    // Play explosion sound
    this._audio?.play('explosion');

    // Hide main mesh group completely
    if (this._mesh) {
      this._mesh.visible = false;
    }

    // 1. Spawn 3 lava bullets in an upward-left spread (angles 110°, 135°, 160°)
    const angles = [
      Math.PI * 0.61,
      Math.PI * 0.75,
      Math.PI * 0.89
    ];
    const speed = 160;

    for (const angle of angles) {
      this._newBullets.push(
        this._projectileFactory({
          type: ProjectileSourceKey.LAVA,
          x: this.x,
          y: this.y - 28,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        })
      );
    }

    // 2. Spawn 3D physical shrapnel shards!
    this._shards = [];

    if (this._shardGeometries && this._shardMaterials) {
      const shardRockMat = this._shardMaterials[0]!;
      const shardLavaMat = this._shardMaterials[1]!;

      // Reset material opacities for the fade effect
      shardRockMat.opacity = 1;
      shardLavaMat.opacity = 1;

      const numShards = 6;
      for (let i = 0; i < numShards; i++) {
        const geo = this._shardGeometries[i % this._shardGeometries.length]!;
        const mat = i % 2 === 0 ? shardRockMat : shardLavaMat;
        const shardMesh = new THREE.Mesh(geo, mat);

        shardMesh.position.set(
          this.x + (Math.random() - 0.5) * 8,
          this.y - 28,
          (Math.random() - 0.5) * 10
        );
        this._scene.add(shardMesh);

        const vx = (Math.random() - 0.5) * 200 - SCROLL_SPD * 0.5;
        const vy = 120 + Math.random() * 150;
        const vz = (Math.random() - 0.5) * 120;

        const rx = (Math.random() - 0.5) * 10;
        const ry = (Math.random() - 0.5) * 10;
        const rz = (Math.random() - 0.5) * 10;

        this._shards.push({
          mesh: shardMesh,
          vx, vy, vz,
          rx, ry, rz
        });
      }
    }
  }

  override destroy(): void {
    // 1. Base class destroy (handles main mesh group, geometries, materials)
    super.destroy();

    // 2. Clean up physical shard meshes from scene
    if (this._shards && this._scene) {
      for (const shard of this._shards) {
        this._scene.remove(shard.mesh);
      }
      this._shards = [];
    }

    // 3. Dispose of shard-specific geometries and materials
    if (this._shardGeometries) {
      for (const geo of this._shardGeometries) geo.dispose();
      this._shardGeometries = null;
    }
    if (this._shardMaterials) {
      for (const mat of this._shardMaterials) mat.dispose();
      this._shardMaterials = null;
    }
  }
}
