import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ensureNonIndexed } from '../utils/ProceduralToolkit.ts';

const GLB_SCALE = 1.05;
const GLB_ROT_X = 0;
const GLB_ROT_Y = -Math.PI / 2;
const GLB_ROT_Z = 0;
const GLB_OFFSET_X = -4;
const GLB_OFFSET_Y = 0;
const GLB_OFFSET_Z = 0;

const THRUSTER_PARTICLE_COUNT = 20;

export interface ThrusterParticle {
  isYellow: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  decay: number;
}

export interface PlayerThrusterHandles {
  yellowMesh: THREE.InstancedMesh;
  orangeMesh: THREE.InstancedMesh;
  pool: ThrusterParticle[];
  helper: THREE.Object3D;
}

export class PlayerModel {
  readonly root: THREE.Group;
  readonly thrusters: PlayerThrusterHandles;
  readonly engineLight: THREE.PointLight;
  readonly chargeOrb: THREE.Mesh;
  readonly shieldAura: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;

  constructor(loadedModel?: THREE.Group | null) {
    this.root = new THREE.Group();

    const hullMat = new THREE.MeshPhongMaterial({
      color: 0x224a82,
      shininess: 90,
      specular: 0x5588ff,
    });

    const trimMat = new THREE.MeshPhongMaterial({
      color: 0xff3300,
      shininess: 80,
      specular: 0xffaaaa,
    });

    const brightMat = new THREE.MeshPhongMaterial({
      color: 0x4d88e0,
      shininess: 80,
      specular: 0xffffff,
    });

    const cockpitMat = new THREE.MeshPhongMaterial({
      color: 0xffaa00,
      shininess: 120,
      specular: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });

    const engineMetalMat = new THREE.MeshPhongMaterial({
      color: 0x2a3e5c,
      shininess: 100,
      specular: 0x88aaff,
    });

    const matYellow = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const matOrange = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const chargeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });

    if (loadedModel) {
      const shipModel = loadedModel.clone();
      const modelWrapper = new THREE.Group();

      const box = new THREE.Box3().setFromObject(shipModel);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      shipModel.position.set(-center.x, -center.y, -center.z);
      modelWrapper.add(shipModel);

      modelWrapper.rotation.set(GLB_ROT_X, GLB_ROT_Y, GLB_ROT_Z);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scaleFactor = (72 / maxDim) * GLB_SCALE;
      modelWrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);

      modelWrapper.position.set(GLB_OFFSET_X, GLB_OFFSET_Y, GLB_OFFSET_Z);

      this.root.add(modelWrapper);

      shipModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            const tuneTexture = (texture?: THREE.Texture | null): void => {
              if (!texture) return;
              texture.minFilter = THREE.LinearMipmapLinearFilter;
              texture.magFilter = THREE.LinearFilter;
              texture.generateMipmaps = true;
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.RepeatWrapping;
              texture.needsUpdate = true;
            };

            const processMaterial = (oldMat: THREE.Material): THREE.Material => {
              if (oldMat instanceof THREE.MeshStandardMaterial || oldMat.type === 'MeshStandardMaterial') {
                const stdMat = oldMat as THREE.MeshStandardMaterial;

                stdMat.side = THREE.DoubleSide;
                stdMat.envMapIntensity = 0.85;
                stdMat.roughness = stdMat.roughnessMap
                  ? THREE.MathUtils.clamp(stdMat.roughness, 0.35, 1.0)
                  : THREE.MathUtils.clamp(stdMat.roughness, 0.32, 0.72);
                stdMat.metalness = stdMat.metalnessMap
                  ? THREE.MathUtils.clamp(stdMat.metalness, 0.18, 0.65)
                  : THREE.MathUtils.clamp(stdMat.metalness, 0.12, 0.45);

                if (stdMat.emissiveMap) {
                  stdMat.emissiveIntensity = 0.92;
                } else if (stdMat.map) {
                  stdMat.emissive = stdMat.color.clone().multiplyScalar(0.08);
                  stdMat.emissiveIntensity = 0.55;
                }

                tuneTexture(stdMat.map);
                tuneTexture(stdMat.normalMap);
                tuneTexture(stdMat.aoMap);
                tuneTexture(stdMat.roughnessMap);
                tuneTexture(stdMat.metalnessMap);
                tuneTexture(stdMat.emissiveMap);
                stdMat.needsUpdate = true;
                return stdMat;
              }
              return oldMat;
            };

            if (Array.isArray(child.material)) {
              child.material = child.material.map(processMaterial);
            } else {
              child.material = processMaterial(child.material);
            }
          }
        }
      });
    } else {
      const lathePoints: THREE.Vector2[] = [];
      lathePoints.push(new THREE.Vector2(0, 38));
      lathePoints.push(new THREE.Vector2(2.5, 32));
      lathePoints.push(new THREE.Vector2(5.5, 24));
      lathePoints.push(new THREE.Vector2(8.5, 10));
      lathePoints.push(new THREE.Vector2(9.2, 0));
      lathePoints.push(new THREE.Vector2(8.0, -10));
      lathePoints.push(new THREE.Vector2(6.0, -22));
      lathePoints.push(new THREE.Vector2(4.5, -30));

      const latheGeo = new THREE.LatheGeometry(lathePoints, 24);
      latheGeo.rotateZ(-Math.PI / 2);

      const cockpitGeo = new THREE.SphereGeometry(6.2, 24, 24);
      cockpitGeo.scale(2.2, 1.0, 1.0);
      const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
      cockpit.position.set(4, 3.8, 0);
      this.root.add(cockpit);

      const wingShape = new THREE.Shape();
      wingShape.moveTo(5, 0);
      wingShape.lineTo(-12, 34);
      wingShape.lineTo(-24, 32);
      wingShape.lineTo(-16, 0);
      wingShape.lineTo(-24, -32);
      wingShape.lineTo(-12, -34);
      wingShape.closePath();

      const extrudeSettings = {
        depth: 2.5,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 1.2,
        bevelThickness: 1.2,
      };

      const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
      wingGeo.center();
      const wings = new THREE.Mesh(wingGeo, brightMat);
      wings.rotation.x = Math.PI / 2;
      wings.position.set(-10, 0, 0);
      this.root.add(wings);

      const strutGeo = new THREE.BoxGeometry(6, 12, 4);
      strutGeo.rotateZ(-Math.PI / 6);

      const prongGeo = new THREE.CylinderGeometry(1.8, 1.8, 48, 12);
      prongGeo.rotateZ(Math.PI / 2);

      const hullGeos = [
        ensureNonIndexed(latheGeo).translate(-2, 0, 0),
        ensureNonIndexed(strutGeo).translate(-8, 7, 3),
        ensureNonIndexed(strutGeo).translate(-8, -7, -3),
        ensureNonIndexed(prongGeo).translate(12, 12, 3.5),
        ensureNonIndexed(prongGeo).translate(12, -12, -3.5),
      ];
      const mergedHullGeo = mergeGeometries(hullGeos);
      const hullMesh = new THREE.Mesh(mergedHullGeo, hullMat);
      this.root.add(hullMesh);

      hullGeos.forEach((g) => g.dispose());
      latheGeo.dispose();
      strutGeo.dispose();
      prongGeo.dispose();

      const prongTipGeo = new THREE.ConeGeometry(2.0, 10, 12);
      prongTipGeo.rotateZ(-Math.PI / 2);

      const tipGeos = [
        ensureNonIndexed(prongTipGeo).translate(37, 12, 3.5),
        ensureNonIndexed(prongTipGeo).translate(37, -12, -3.5),
      ];
      const mergedTipGeo = mergeGeometries(tipGeos);
      const tipMesh = new THREE.Mesh(mergedTipGeo, trimMat);
      this.root.add(tipMesh);

      tipGeos.forEach((g) => g.dispose());
      prongTipGeo.dispose();

      const nozzleGeo = new THREE.CylinderGeometry(4.5, 3.8, 10, 16);
      nozzleGeo.rotateZ(Math.PI / 2);
      const nozzle = new THREE.Mesh(nozzleGeo, engineMetalMat);
      nozzle.position.x = -34;
      this.root.add(nozzle);
    }

    const thrusterGroup = new THREE.Group();
    this.root.add(thrusterGroup);

    const pool: ThrusterParticle[] = [];
    const sphereGeo = new THREE.SphereGeometry(3.2, 8, 8);

    const yellowMesh = new THREE.InstancedMesh(sphereGeo, matYellow, THRUSTER_PARTICLE_COUNT);
    const orangeMesh = new THREE.InstancedMesh(sphereGeo, matOrange, THRUSTER_PARTICLE_COUNT);
    yellowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    orangeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    thrusterGroup.add(yellowMesh);
    thrusterGroup.add(orangeMesh);

    for (let i = 0; i < THRUSTER_PARTICLE_COUNT; i++) {
      const isYellow = Math.random() > 0.6;
      pool.push({
        isYellow,
        x: -42,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: Math.random(),
        decay: 1.8 + Math.random() * 1.8,
      });
    }

    this.thrusters = {
      yellowMesh,
      orangeMesh,
      pool,
      helper: new THREE.Object3D(),
    };

    this.engineLight = new THREE.PointLight(0xffaa00, 2.0, 150);
    this.engineLight.position.set(-44, 0, 2);
    this.root.add(this.engineLight);

    const chargeGeo = new THREE.SphereGeometry(8, 24, 24);
    this.chargeOrb = new THREE.Mesh(chargeGeo, chargeMat);
    this.chargeOrb.position.set(33.2, -10.5, 0);
    this.chargeOrb.visible = false;
    this.root.add(this.chargeOrb);

    const shieldMat = new THREE.MeshPhongMaterial({
      color: 0x00aaff,
      emissive: 0x002255,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const shieldGeo = new THREE.SphereGeometry(1, 24, 24);
    this.shieldAura = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldAura.scale.set(43, 23, 23);
    this.shieldAura.position.set(-2, 0, 0);
    this.shieldAura.visible = false;
    this.root.add(this.shieldAura);
  }
}
