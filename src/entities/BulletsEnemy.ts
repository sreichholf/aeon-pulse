import * as THREE from 'three';
import { ProjectileSourceKey } from '../types.ts';
import type { BulletDef } from './BulletsPlayer.ts';

export const enemyDefs: Record<string, BulletDef> = {
  [ProjectileSourceKey.ENEMY]: {
    w: 16, h: 16, hw: 5, hh: 5, damage: 1, isPlayer: false, piercing: false, key: ProjectileSourceKey.ENEMY,
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

      const geo = getGeo('enemyGeo', () => new THREE.SphereGeometry(6, 6, 6));
      const mat = getBulletMat('enemyMat', 0xff1188, 0x550022, 0xffffff, 30, true);
      return { mesh: new THREE.Mesh(geo, mat), refs: {} };
    },
    animate(_dt, _mesh, _refs) {},
  },

  [ProjectileSourceKey.ENEMY_SINE]: {
    w: 16, h: 16, hw: 5, hh: 5, damage: 1, isPlayer: false, piercing: false, wave: true, waveAmp: 35, waveSpeed: 10, key: ProjectileSourceKey.ENEMY_SINE,
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

      const geo = getGeo('enemySineGeo', () => {
        const torus = new THREE.TorusGeometry(6, 1.5, 4, 12);
        torus.rotateY(Math.PI / 2);
        return torus;
      });
      const mat = getBulletMat('enemySineMat', 0x33ff44, 0x004400, 0xffffff, 60);
      return { mesh: new THREE.Mesh(geo, mat), refs: {} };
    },
    animate(dt, mesh, _refs) {
      mesh.rotation.y += 6.0 * dt;
    },
  },

  [ProjectileSourceKey.ENEMY_DIVER]: {
    w: 16, h: 10, hw: 5, hh: 4, damage: 1, isPlayer: false, piercing: false, key: ProjectileSourceKey.ENEMY_DIVER,
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

      const geo = getGeo('enemyDiverGeo', () => {
        const cone = new THREE.ConeGeometry(2.5, 12, 6);
        cone.rotateZ(-Math.PI / 2);
        return cone;
      });
      const mat = getBulletMat('enemyDiverMat', 0xff6600, 0x441800, 0xffffff, 50);
      return { mesh: new THREE.Mesh(geo, mat), refs: {} };
    },
    animate(dt, mesh, _refs) {
      mesh.rotation.x += 3.5 * dt;
    },
  },

  [ProjectileSourceKey.ENEMY_SWARM]: {
    w: 18, h: 6, hw: 6, hh: 3, damage: 1, isPlayer: false, piercing: false, key: ProjectileSourceKey.ENEMY_SWARM,
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

      const geo = getGeo('enemySwarmGeo', () => {
        const cyl = new THREE.CylinderGeometry(1.0, 1.0, 12, 6);
        cyl.rotateZ(Math.PI / 2);
        return cyl;
      });
      const mat = getBulletMat('enemySwarmMat', 0x00ccdd, 0x003344, 0xffffff, 70);
      return { mesh: new THREE.Mesh(geo, mat), refs: {} };
    },
    animate(dt, mesh, _refs) {
      mesh.rotation.x += 4.5 * dt;
    },
  },

  [ProjectileSourceKey.HOMING]: {
    w: 14, h: 14, hw: 4, hh: 4, damage: 1, isPlayer: false, piercing: false, homing: true, key: ProjectileSourceKey.HOMING,
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

      const coreGeo = getGeo('homingCoreGeo', () => new THREE.SphereGeometry(5, 6, 6));
      const coreMat = getBulletMat('homingCoreMat', 0xaa00ff, 0x330066, 0xffffff, 30, true);
      group.add(new THREE.Mesh(coreGeo, coreMat));

      const spikeGeo = getGeo('homingSpikeGeo', () => {
        const geo = new THREE.ConeGeometry(1.2, 4.0, 4);
        geo.rotateX(Math.PI / 2);
        return geo;
      });
      const spikeMat = getBulletMat('homingSpikeMat', 0xdd44ff, 0x440066, 0xffffff, 20, true);

      const spikeDirs: [number, number, number][] = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1],
      ];
      spikeDirs.forEach(dir => {
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(dir[0] * 4, dir[1] * 4, dir[2] * 4);
        spike.lookAt(new THREE.Vector3(dir[0] * 10, dir[1] * 10, dir[2] * 10));
        group.add(spike);
      });

      return { mesh: group, refs: {} };
    },
    animate(dt, mesh, _refs) {
      mesh.rotation.x += 2.4 * dt;
      mesh.rotation.y += 1.8 * dt;
    },
  },

  [ProjectileSourceKey.BOSS]: {
    w: 22, h: 22, hw: 7, hh: 7, damage: 2, isPlayer: false, piercing: false, key: ProjectileSourceKey.BOSS,
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

      const coreGeo = getGeo('bossCoreGeo', () => new THREE.SphereGeometry(9, 8, 8));
      const coreMat = getBulletMat('bossCoreMat', 0xff5500, 0x441100, 0xffffff, 40, true);
      group.add(new THREE.Mesh(coreGeo, coreMat));

      const spikeGeo = getGeo('bossSpikeGeo', () => {
        const geo = new THREE.ConeGeometry(2.2, 6.0, 4);
        geo.rotateX(Math.PI / 2);
        return geo;
      });
      const spikeMat = getMat('bossSpikeMat', () => new THREE.MeshPhongMaterial({
        color: 0x44372e, emissive: 0x110804, specular: 0x332822, shininess: 15, flatShading: true,
      }));

      const spikeDirs: [number, number, number][] = [
        [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
        [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
      ];
      spikeDirs.forEach(dir => {
        const d = new THREE.Vector3(...dir).normalize();
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(d.x * 7.5, d.y * 7.5, d.z * 7.5);
        spike.lookAt(d.x * 15, d.y * 15, d.z * 15);
        group.add(spike);
      });

      return { mesh: group, refs: {} };
    },
    animate(dt, mesh, _refs) {
      mesh.rotation.z += 1.5 * dt;
      mesh.rotation.y += 1.0 * dt;
    },
  },

  [ProjectileSourceKey.BOSS_LASER]: {
    w: 60, h: 12, hw: 25, hh: 5, damage: 2, isPlayer: false, piercing: false, key: ProjectileSourceKey.BOSS_LASER,
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

      const outerGeo = getGeo('laserOuterGeo', () => {
        const geo = new THREE.CylinderGeometry(4.0, 4.0, 56, 6);
        geo.rotateZ(-Math.PI / 2);
        return geo;
      });
      const outerMat = getBulletMat('laserOuterMat', 0xff3300, 0x661100, 0xffffff, 40, false);
      group.add(new THREE.Mesh(outerGeo, outerMat));

      const innerGeo = getGeo('laserInnerGeo', () => {
        const geo = new THREE.CylinderGeometry(2.0, 2.0, 54, 6);
        geo.rotateZ(-Math.PI / 2);
        return geo;
      });
      const innerMat = getMat('laserInnerMat', () => new THREE.MeshBasicMaterial({ color: 0xffeedd }));
      group.add(new THREE.Mesh(innerGeo, innerMat));

      return { mesh: group, refs: {} };
    },
    animate(_dt, _mesh, _refs) {},
  },

  [ProjectileSourceKey.WAVE]: {
    w: 72, h: 72, hw: 30, hh: 30, damage: 2, isPlayer: false, piercing: false, key: ProjectileSourceKey.WAVE,
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

      const geo = getGeo('waveGeo', () => {
        const torus = new THREE.TorusGeometry(32, 1.8, 4, 24);
        torus.rotateY(Math.PI / 2);
        return torus;
      });
      const mat = getBulletMat('waveMat', 0x88ff00, 0x224400, 0xffffff, 50);
      return { mesh: new THREE.Mesh(geo, mat), refs: {} };
    },
    animate(_dt, _mesh, _refs) {},
  },

  [ProjectileSourceKey.LAVA]: {
    w: 32, h: 32, hw: 12, hh: 12, damage: 2, isPlayer: false, piercing: false, key: ProjectileSourceKey.LAVA,
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

      const coreGeo = getGeo('lavaCoreGeo', () => new THREE.SphereGeometry(10, 6, 6));
      const coreMat = getMat('lavaCoreMat', () => new THREE.MeshBasicMaterial({ color: 0xff3300 }));
      group.add(new THREE.Mesh(coreGeo, coreMat));

      const rockGeo = getGeo('lavaRockGeo', () => {
        const geo = new THREE.SphereGeometry(12.5, 6, 6);
        const pos = geo.attributes['position'] as THREE.BufferAttribute;
        let seed = 42;
        const pseudoRand = () => {
          const x = Math.sin(seed++) * 10000;
          return x - Math.floor(x);
        };
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const len = Math.hypot(x, y, z);
          if (len > 0) {
            const jitter = 0.8 + pseudoRand() * 0.45;
            pos.setX(i, x * jitter);
            pos.setY(i, y * jitter);
            pos.setZ(i, z * jitter);
          }
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        return geo;
      });
      const rockMat = getBulletMat('lavaRockMat', 0x7a5f4c, 0x24180f, 0x4d392b, 10, true);
      group.add(new THREE.Mesh(rockGeo, rockMat));

      return { mesh: group, refs: {} };
    },
    animate(dt, mesh, _refs) {
      mesh.rotation.x += 2.0 * dt;
      mesh.rotation.z += 1.5 * dt;
    },
  },
};
