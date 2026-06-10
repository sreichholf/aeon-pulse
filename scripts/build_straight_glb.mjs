import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

globalThis.FileReader = class {
  result = null;
  error = null;
  onloadend = null;
  onerror = null;

  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer();
      this.onloadend?.({ target: this });
    } catch (error) {
      this.error = error;
      this.onerror?.(error);
    }
  }

  async readAsDataURL(blob) {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
      this.onloadend?.({ target: this });
    } catch (error) {
      this.error = error;
      this.onerror?.(error);
    }
  }
};

const OUTPUT = new URL('../src/models/straight.glb', import.meta.url);

const materials = {
  StraightBlue: new THREE.MeshStandardMaterial({
    name: 'StraightBlue',
    color: 0x485e7d,
    roughness: 0.42,
    metalness: 0.52,
  }),
  StraightDarkBlue: new THREE.MeshStandardMaterial({
    name: 'StraightDarkBlue',
    color: 0x2a3345,
    roughness: 0.5,
    metalness: 0.62,
  }),
  StraightCrimson: new THREE.MeshStandardMaterial({
    name: 'StraightCrimson',
    color: 0xff2d55,
    roughness: 0.38,
    metalness: 0.38,
  }),
  StraightGunmetal: new THREE.MeshStandardMaterial({
    name: 'StraightGunmetal',
    color: 0x6b778c,
    roughness: 0.48,
    metalness: 0.8,
  }),
  StraightCopper: new THREE.MeshStandardMaterial({
    name: 'StraightCopper',
    color: 0xd4af37,
    roughness: 0.35,
    metalness: 0.8,
  }),
  StraightAmberGlow: new THREE.MeshBasicMaterial({
    name: 'StraightAmberGlow',
    color: 0xffaa00,
    toneMapped: false,
  }),
  StraightSensorGlow: new THREE.MeshBasicMaterial({
    name: 'StraightSensorGlow',
    color: 0xff1a2c,
    toneMapped: false,
  }),
  StraightCanopyGlass: new THREE.MeshPhysicalMaterial({
    name: 'StraightCanopyGlass',
    color: 0x00d2ff,
    emissive: 0x002b4d,
    metalness: 0.05,
    roughness: 0.04,
    transmission: 0.25,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  }),
};

const buckets = new Map(Object.keys(materials).map((name) => [name, []]));

function add(materialName, geometry) {
  if (geometry.index) {
    geometry = geometry.toNonIndexed();
  }
  geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  buckets.get(materialName).push(geometry);
}

function cylinder(radiusTop, radiusBottom, height, radialSegments = 8) {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
}

function transformed(geometry, transform) {
  if (transform.rotateX) geometry.rotateX(transform.rotateX);
  if (transform.rotateY) geometry.rotateY(transform.rotateY);
  if (transform.rotateZ) geometry.rotateZ(transform.rotateZ);
  if (transform.scale) geometry.scale(...transform.scale);
  if (transform.translate) geometry.translate(...transform.translate);
  return geometry;
}

function addBox(materialName, size, translate) {
  add(materialName, transformed(new THREE.BoxGeometry(...size), { translate }));
}

function addCylinderX(materialName, radiusTop, radiusBottom, height, translate, radialSegments = 8) {
  add(materialName, transformed(cylinder(radiusTop, radiusBottom, height, radialSegments), {
    rotateZ: Math.PI / 2,
    translate,
  }));
}

function addConeX(materialName, radius, height, translate, radialSegments = 8, pointsNegativeX = true) {
  add(materialName, transformed(new THREE.ConeGeometry(radius, height, radialSegments), {
    rotateZ: pointsNegativeX ? -Math.PI / 2 : Math.PI / 2,
    translate,
  }));
}

function makeWing(side) {
  const shape = new THREE.Shape();
  shape.moveTo(10, 0);
  shape.lineTo(15, side * 23);
  shape.lineTo(11, side * 23);
  shape.lineTo(-3, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1.8,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.6,
    bevelThickness: 0.6,
  });
  geometry.center();
  geometry.rotateX(Math.PI / 2);
  geometry.translate(2.5, -0.4, side * 11.5);
  return geometry;
}

function makeWingPanel(side) {
  const shape = new THREE.Shape();
  shape.moveTo(8, side * 2);
  shape.lineTo(13.5, side * 17);
  shape.lineTo(10.5, side * 17);
  shape.lineTo(1.5, side * 2);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.6,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.2,
    bevelThickness: 0.2,
  });
  geometry.center();
  geometry.rotateX(Math.PI / 2);
  geometry.translate(2.5, 0.7, side * 9.5);
  return geometry;
}

// Core fuselage.
add('StraightBlue', transformed(cylinder(3.6, 5.0, 16, 8), {
  rotateZ: Math.PI / 2,
  scale: [1, 0.6, 1.1],
  translate: [1, 0, 0],
}));
add('StraightBlue', transformed(cylinder(0.8, 3.6, 12, 8), {
  rotateZ: Math.PI / 2,
  scale: [1, 0.6, 1.1],
  translate: [-13, 0, 0],
}));
add('StraightBlue', transformed(cylinder(5.0, 4.0, 6, 8), {
  rotateZ: Math.PI / 2,
  scale: [1, 0.6, 1.1],
  translate: [12, 0, 0],
}));
// Red nose cone should point forward toward the ship's nose, not back into the fuselage.
addConeX('StraightCrimson', 0.8, 3.5, [-20.25, 0, 0], 8, false);
addBox('StraightBlue', [11, 1.8, 3.8], [3.0, 2.0, 0]);

// Shoulders and engines.
addBox('StraightDarkBlue', [8, 1.8, 3.5], [-6.0, 0.2, 3.2]);
addBox('StraightDarkBlue', [8, 1.8, 3.5], [-6.0, 0.2, -3.2]);
addCylinderX('StraightBlue', 1.8, 2.0, 12, [6, 2.2, 2.8]);
addCylinderX('StraightBlue', 1.8, 2.0, 12, [6, 2.2, -2.8]);
addCylinderX('StraightCrimson', 2.1, 1.8, 2.0, [0.0, 2.2, 2.8]);
addCylinderX('StraightCrimson', 2.1, 1.8, 2.0, [0.0, 2.2, -2.8]);
addConeX('StraightGunmetal', 0.9, 1.4, [-1.0, 2.2, 2.8]);
addConeX('StraightGunmetal', 0.9, 1.4, [-1.0, 2.2, -2.8]);
addCylinderX('StraightGunmetal', 1.8, 1.3, 2.8, [13.0, 2.2, 2.8]);
addCylinderX('StraightGunmetal', 1.8, 1.3, 2.8, [13.0, 2.2, -2.8]);

// Wings, wing tips, and fins.
add('StraightBlue', makeWing(1));
add('StraightBlue', makeWing(-1));
addBox('StraightCrimson', [8.0, 2.2, 1.8], [12.0, -0.4, 23.0]);
addBox('StraightCrimson', [8.0, 2.2, 1.8], [12.0, -0.4, -23.0]);
addBox('StraightBlue', [4.0, 2.0, 0.3], [14.0, 0.8, 23.0]);
addBox('StraightBlue', [4.0, 2.0, 0.3], [14.0, 0.8, -23.0]);
addBox('StraightCrimson', [3.0, 1.0, 0.3], [14.5, 2.3, 23.0]);
addBox('StraightCrimson', [3.0, 1.0, 0.3], [14.5, 2.3, -23.0]);
add('StraightCrimson', makeWingPanel(1));
add('StraightCrimson', makeWingPanel(-1));
addBox('StraightBlue', [4.0, 2.5, 0.4], [10.0, 3.05, 2.8]);
addBox('StraightBlue', [4.0, 2.5, 0.4], [10.0, 3.05, -2.8]);
addBox('StraightCrimson', [3.0, 1.3, 0.4], [10.5, 4.95, 2.8]);
addBox('StraightCrimson', [3.0, 1.3, 0.4], [10.5, 4.95, -2.8]);

// Cannons, pipes, and lights.
for (const z of [22.2, 23.8, -22.2, -23.8]) {
  addCylinderX('StraightGunmetal', 0.3, 0.3, 7.5, [10.5, -0.4, z]);
}
addBox('StraightGunmetal', [4.0, 1.2, 2.0], [-14.5, -1.2, 0.0]);
addCylinderX('StraightGunmetal', 0.3, 0.3, 5.0, [-16.5, -1.2, 0.8]);
addCylinderX('StraightGunmetal', 0.3, 0.3, 5.0, [-16.5, -1.2, -0.8]);
addCylinderX('StraightCopper', 0.12, 0.12, 8, [4.0, 2.4, 1.2], 4);
addCylinderX('StraightCopper', 0.12, 0.12, 8, [4.0, 2.4, -1.2], 4);
addCylinderX('StraightCopper', 0.12, 0.12, 8, [4.0, 2.2, 4.5], 4);
addCylinderX('StraightCopper', 0.12, 0.12, 8, [4.0, 2.2, -4.5], 4);
addBox('StraightAmberGlow', [3.0, 0.8, 0.4], [-4.5, 0.2, 5.0]);
addBox('StraightAmberGlow', [3.0, 0.8, 0.4], [-4.5, 0.2, -5.0]);

const sensor = transformed(new THREE.BoxGeometry(2.0, 0.6, 2.5), {
  rotateZ: 0.1,
  translate: [-13.5, 1.3, 0],
});
add('StraightSensorGlow', sensor);

// Canopy.
add('StraightCanopyGlass', transformed(cylinder(1.4, 1.8, 8, 6), {
  rotateZ: Math.PI / 2,
  scale: [1.1, 0.8, 1.2],
  translate: [-5.0, 2.3, 0],
}));

const scene = new THREE.Scene();
for (const [name, geometries] of buckets) {
  if (geometries.length === 0) continue;
  const merged = mergeGeometries(geometries, false);
  if (!merged) throw new Error(`Failed to merge ${name}`);
  merged.computeVertexNormals();
  const mesh = new THREE.Mesh(merged, materials[name]);
  mesh.name = name;
  scene.add(mesh);
}

scene.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(scene);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, { binary: true });
writeFileSync(OUTPUT, Buffer.from(glb));

console.log(`exported ${OUTPUT.pathname}`);
console.log(`source center: ${center.x.toFixed(4)}, ${center.y.toFixed(4)}, ${center.z.toFixed(4)}`);
console.log(`source size: ${size.x.toFixed(4)}, ${size.y.toFixed(4)}, ${size.z.toFixed(4)}`);
