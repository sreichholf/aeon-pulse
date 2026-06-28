import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import heartseerGlbUrl from '../models/heartseer.glb';

export interface HeartseerSockets {
  heart: THREE.Object3D;
  core: THREE.Object3D;
  muzzleUpper: THREE.Object3D;
  muzzleLower: THREE.Object3D;
  minionUpper: THREE.Object3D;
  minionLower: THREE.Object3D;
}

export interface HeartseerModelInstance {
  root: THREE.Group;
  sockets: HeartseerSockets;
  size: THREE.Vector3;
}

// Keep Heartseer gameplay presentation pinned to the previous on-screen height
// even when the authored GLB asset is replaced with different source bounds.
const HEARTSEER_TARGET_VISUAL_HEIGHT = 150;
const HEARTSEER_ROTATION = new THREE.Euler(0, 0, 0);

let cachedModel: THREE.Group | null = null;
let loadPromise: Promise<THREE.Group> | null = null;

export function getCachedHeartseerModel(): THREE.Group | null {
  return cachedModel;
}

export function preloadHeartseerModel(): Promise<THREE.Group> {
  if (cachedModel) return Promise.resolve(cachedModel);
  if (loadPromise) return loadPromise;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loadPromise = new Promise((resolve, reject) => {
    loader.load(
      heartseerGlbUrl,
      (gltf) => {
        cachedModel = gltf.scene;
        resolve(cachedModel);
      },
      undefined,
      reject,
    );
  });

  return loadPromise;
}

export function createHeartseerModelInstance(source: THREE.Group): HeartseerModelInstance {
  const sceneClone = source.clone(true);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  sceneClone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry = child.geometry.clone();
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => material.clone());
    } else if (child.material) {
      child.material = child.material.clone();
    }
    child.castShadow = true;
    child.receiveShadow = true;
  });

  const box = new THREE.Box3().setFromObject(sceneClone);
  box.getSize(size);
  box.getCenter(center);
  sceneClone.position.set(-center.x, -center.y, -center.z);

  const root = new THREE.Group();
  root.rotation.copy(HEARTSEER_ROTATION);

  const scale = HEARTSEER_TARGET_VISUAL_HEIGHT / (size.y || 1);
  root.scale.setScalar(scale);
  root.add(sceneClone);

  const sockets = createSocketRig(size);
  root.add(sockets.heart);
  root.add(sockets.core);
  root.add(sockets.muzzleUpper);
  root.add(sockets.muzzleLower);
  root.add(sockets.minionUpper);
  root.add(sockets.minionLower);

  return {
    root,
    sockets,
    size,
  };
}

export function getHeartseerSocketLayout(size: THREE.Vector3): Record<keyof HeartseerSockets, THREE.Vector3> {
  const halfWidth = size.x * 0.5;
  const halfHeight = size.y * 0.5;

  return {
    // The center eye sits near the body midline, lower and further right than the front eye cluster.
    heart: new THREE.Vector3(halfWidth * 0.05, -halfHeight * 0.04, 0),
    core: new THREE.Vector3(-halfWidth * 0.30, -halfHeight * 0.04, 0),
    muzzleUpper: new THREE.Vector3(-halfWidth * 0.72, -halfHeight * 0.14, 0),
    muzzleLower: new THREE.Vector3(-halfWidth * 0.72, -halfHeight * 0.30, 0),
    minionUpper: new THREE.Vector3(-halfWidth * 0.34, halfHeight * 0.18, 0),
    minionLower: new THREE.Vector3(-halfWidth * 0.34, -halfHeight * 0.12, 0),
  };
}

function createSocketRig(size: THREE.Vector3): HeartseerSockets {
  const layout = getHeartseerSocketLayout(size);

  return {
    heart: namedSocket('heartseer-heart-socket', layout.heart),
    core: namedSocket('heartseer-core-socket', layout.core),
    muzzleUpper: namedSocket('heartseer-muzzle-upper-socket', layout.muzzleUpper),
    muzzleLower: namedSocket('heartseer-muzzle-lower-socket', layout.muzzleLower),
    minionUpper: namedSocket('heartseer-minion-upper-socket', layout.minionUpper),
    minionLower: namedSocket('heartseer-minion-lower-socket', layout.minionLower),
  };
}

function namedSocket(name: string, position: THREE.Vector3): THREE.Object3D {
  const socket = new THREE.Object3D();
  socket.name = name;
  socket.position.copy(position);
  return socket;
}
