import * as THREE from 'three';
import { BulletType } from '../types.ts';

export interface BulletAnimRefs {
  [key: string]: THREE.Object3D | THREE.Material | number | THREE.Object3D[];
}

export interface BulletBuildResult {
  mesh: THREE.Object3D;
  refs: BulletAnimRefs;
}

export type GeoCache  = Record<string, THREE.BufferGeometry>;
export type MatCache  = Record<string, THREE.Material>;
export type CacheStore = { geos: GeoCache; mats: MatCache };
export type GetFn<T>  = (key: string, builder: () => T) => T;

export interface BulletDef {
  /** The canonical BulletType for IBullet.type, or an internal sub-key (e.g. 'enemySine') not in BulletType. */
  key: BulletType | string;
  w: number; h: number; hw: number; hh: number;
  damage: number;
  isPlayer: boolean;
  piercing: boolean;
  homing?: boolean;
  wave?: boolean;
  waveAmp?: number;
  waveSpeed?: number;
  alignToVelocity?: boolean;
  build(tint: number | null, cache: CacheStore, getMat: GetFn<THREE.Material>, getGeo: GetFn<THREE.BufferGeometry>): BulletBuildResult;
  animate?(dt: number, mesh: THREE.Object3D, refs: BulletAnimRefs): void;
}

export const playerDefs: Record<string, BulletDef> = {
  player: {
    w: 28, h: 8, hw: 11, hh: 3, damage: 1, isPlayer: true, piercing: false, key: 'player',
    alignToVelocity: true,
    build(tint, _cache, getMat, getGeo) {
      const getBulletMat = (key: string, colorVal: number, emissiveVal: number, specVal = 0xffffff, shine = 30, flat = false) => {
        const mat = getMat(key, () => new THREE.MeshPhongMaterial({
          color: colorVal, emissive: emissiveVal, specular: specVal, shininess: shine, flatShading: flat,
        })) as THREE.MeshPhongMaterial;
        if (tint) {
          const cloned = mat.clone();
          cloned.color.set(tint);
          cloned.emissive.set(tint).multiplyScalar(0.4);
          cloned.userData = { cloned: true };
          return cloned;
        }
        return mat;
      };

      const group = new THREE.Group();

      const outerGeo = getGeo('playerOuterGeo', () => {
        const geo = new THREE.SphereGeometry(3.5, 8, 8);
        geo.scale(3.2, 1.0, 1.0);
        return geo;
      });
      const outerMat = getBulletMat('playerOuterMat', 0x33ccff, 0x1144ff, 0xffffff, 50);
      group.add(new THREE.Mesh(outerGeo, outerMat));

      const innerGeo = getGeo('playerInnerGeo', () => {
        const geo = new THREE.SphereGeometry(2.0, 8, 8);
        geo.scale(2.2, 0.7, 0.7);
        return geo;
      });
      const innerMat = getMat('playerInnerMat', () => new THREE.MeshBasicMaterial({ color: 0xffffff }));
      group.add(new THREE.Mesh(innerGeo, innerMat));

      return { mesh: group, refs: {} };
    },
    animate(_dt, _mesh, _refs) {},
  },

  playerCharge: {
    w: 72, h: 24, hw: 30, hh: 9, damage: 3, isPlayer: true, piercing: true, key: 'playerCharge',
    alignToVelocity: false,
    build(tint, _cache, getMat, getGeo) {
      const getBulletMat = (key: string, colorVal: number, _emissiveVal: number, _specVal = 0xffffff, _shine = 30, _flat = false) => {
        const mat = getMat(key, () => new THREE.MeshBasicMaterial({
          color: colorVal,
        })) as THREE.MeshBasicMaterial;
        if (tint) {
          const cloned = mat.clone();
          cloned.color.set(tint);
          cloned.userData = { cloned: true };
          return cloned;
        }
        return mat;
      };

      const group = new THREE.Group();

      const coreGeo = getGeo('chargeCoreGeo', () => new THREE.SphereGeometry(14, 12, 12));
      const coreMat = getBulletMat('chargeCoreMat', 0x00ffff, 0x008888, 0xffffff, 100);
      group.add(new THREE.Mesh(coreGeo, coreMat));

      const ringGeo = getGeo('chargeRingGeo', () => new THREE.TorusGeometry(18, 1.8, 4, 16));
      const ringMat = getMat('chargeRingMat', () => new THREE.MeshBasicMaterial({
        color: 0x00ff88, transparent: true, opacity: 0.75,
      }));

      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      const ring2 = new THREE.Mesh(ringGeo, ringMat);
      const ring3 = new THREE.Mesh(ringGeo, ringMat);
      ring2.rotation.x = Math.PI / 2;
      ring3.rotation.y = Math.PI / 2;
      group.add(ring1, ring2, ring3);

      return { mesh: group, refs: { rings: [ring1, ring2, ring3] } };
    },
    animate(dt, _mesh, refs) {
      const rings = refs['rings'] as THREE.Mesh[];
      rings[0]!.rotation.z += 3.8 * dt;
      rings[1]!.rotation.x += 2.8 * dt;
      rings[2]!.rotation.y += 1.8 * dt;
    },
  },

  playerChargeSide: {
    w: 64, h: 20, hw: 24, hh: 7, damage: 2, isPlayer: true, piercing: false, key: 'playerCharge',
    alignToVelocity: false,
    build(tint, _cache, getMat, getGeo) {
      const getBulletMat = (key: string, colorVal: number, _emissiveVal: number, _specVal = 0xffffff, _shine = 30, _flat = false) => {
        const mat = getMat(key, () => new THREE.MeshBasicMaterial({
          color: colorVal,
        })) as THREE.MeshBasicMaterial;
        if (tint) {
          const cloned = mat.clone();
          cloned.color.set(tint);
          cloned.userData = { cloned: true };
          return cloned;
        }
        return mat;
      };

      const group = new THREE.Group();

      const coreGeo = getGeo('chargeSideCoreGeo', () => new THREE.SphereGeometry(11, 12, 12));
      const coreMat = getBulletMat('chargeSideCoreMat', 0x00ffff, 0x008888, 0xffffff, 100);
      group.add(new THREE.Mesh(coreGeo, coreMat));

      const ringGeo = getGeo('chargeSideRingGeo', () => new THREE.TorusGeometry(15, 1.5, 4, 16));
      const ringMat = getMat('chargeSideRingMat', () => new THREE.MeshBasicMaterial({
        color: 0x00ff88, transparent: true, opacity: 0.75,
      }));

      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      const ring2 = new THREE.Mesh(ringGeo, ringMat);
      ring2.rotation.x = Math.PI / 2;
      group.add(ring1, ring2);

      return { mesh: group, refs: { rings: [ring1, ring2] } };
    },
    animate(dt, _mesh, refs) {
      const rings = refs['rings'] as THREE.Mesh[];
      rings[0]!.rotation.z += 3.8 * dt;
      rings[1]!.rotation.x += 2.8 * dt;
    },
  },

  playerWave: {
    w: 48, h: 20, hw: 20, hh: 8, damage: 2, isPlayer: true, piercing: true, wave: true, key: 'playerWave',
    alignToVelocity: false,
    build(tint, _cache, getMat, getGeo) {
      const getBulletMat = (key: string, colorVal: number, emissiveVal: number, specVal = 0xffffff, shine = 30, flat = false) => {
        const mat = getMat(key, () => new THREE.MeshPhongMaterial({
          color: colorVal, emissive: emissiveVal, specular: specVal, shininess: shine, flatShading: flat,
        })) as THREE.MeshPhongMaterial;
        if (tint) {
          const cloned = mat.clone();
          cloned.color.set(tint);
          cloned.emissive.set(tint).multiplyScalar(0.4);
          cloned.userData = { cloned: true };
          return cloned;
        }
        return mat;
      };

      const geo = getGeo('playerWaveGeo', () => {
        const torus = new THREE.TorusGeometry(11, 2.6, 4, 16);
        torus.rotateY(Math.PI / 2);
        return torus;
      });
      const mat = getBulletMat('playerWaveMat', 0x33ff33, 0x004400, 0xffffff, 70);
      return { mesh: new THREE.Mesh(geo, mat), refs: {} };
    },
    animate(dt, mesh, _refs) {
      mesh.rotation.y += 6.5 * dt;
    },
  },

  playerPlasma: {
    w: 48, h: 48, hw: 20, hh: 20, damage: 2, isPlayer: true, piercing: true, wave: true, key: 'playerPlasma',
    alignToVelocity: false,
    build(tint, _cache, getMat, getGeo) {
      const getBulletMat = (key: string, colorVal: number, emissiveVal: number, specVal = 0xffffff, shine = 30, flat = false) => {
        const mat = getMat(key, () => new THREE.MeshPhongMaterial({
          color: colorVal, emissive: emissiveVal, specular: specVal, shininess: shine, flatShading: flat,
        })) as THREE.MeshPhongMaterial;
        if (tint) {
          const cloned = mat.clone();
          cloned.color.set(tint);
          cloned.emissive.set(tint).multiplyScalar(0.4);
          cloned.userData = { cloned: true };
          return cloned;
        }
        return mat;
      };

      const group = new THREE.Group();

      const coreGeo = getGeo('plasmaCoreGeo', () => new THREE.SphereGeometry(10, 8, 8));
      const coreMat = getBulletMat('plasmaCoreMat', 0x00ffcc, 0x005544, 0xffffff, 90);
      group.add(new THREE.Mesh(coreGeo, coreMat));

      const cageGeo = getGeo('plasmaCageGeo', () => new THREE.SphereGeometry(13.5, 8, 8));
      const cageMat = getMat('plasmaCageMat', () => new THREE.MeshBasicMaterial({
        color: 0x00aa88, wireframe: true,
      }));
      const plasmaCage = new THREE.Mesh(cageGeo, cageMat);
      group.add(plasmaCage);

      return { mesh: group, refs: { plasmaCage } };
    },
    animate(dt, _mesh, refs) {
      const cage = refs['plasmaCage'] as THREE.Mesh;
      cage.rotation.y += 8.0 * dt;
      cage.rotation.x += 4.0 * dt;
    },
  },
};
