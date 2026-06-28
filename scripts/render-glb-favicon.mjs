// Render player.glb geometry to a faithful SVG favicon (no browser/GL).
// Parses the GLB with three's GLTFLoader (pure JS, no WebGL), rotates as the
// game does (PlayerModel: GLB_ROT_Y = -PI/2), projects to the XY plane, and
// emits an SVG path of the projected silhouette using an alpha-shape-free
// convex-hull-of-projected-quads approach that captures wings + fuselage.
import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const here = dirname(fileURLToPath(import.meta.url));
const glbPath = resolve(here, '..', 'src/models/player.glb');
const outPath = resolve(here, '..', 'public/favicon.svg');

const raw = readFileSync(glbPath);
const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
const jsonLen = dv.getUint32(12, true);
const jsonBytes = raw.subarray(20, 20 + jsonLen);
const json = JSON.parse(Buffer.from(jsonBytes).toString('utf8'));
// Drop texture loading entirely — we only want geometry. Remove the WebP
// extension so GLTFLoader treats the texture as absent rather than failing.
if (Array.isArray(json.extensionsUsed)) {
  json.extensionsUsed = json.extensionsUsed.filter((e) => e !== 'EXT_texture_webp');
}
if (Array.isArray(json.extensionsRequired)) {
  json.extensionsRequired = json.extensionsRequired.filter((e) => e !== 'EXT_texture_webp');
}
if (json.textures) {
  for (const t of json.textures) {
    if (t.extensions) { delete t.extensions; }
  }
}
// Fully drop textures + images so no image decoding runs in Node.
delete json.textures;
delete json.images;
if (Array.isArray(json.extensionsUsed)) {
  json.extensionsUsed = json.extensionsUsed.filter((e) => !/^EXT_texture|^KHR_texture$/.test(e));
}
if (Array.isArray(json.extensionsRequired)) {
  json.extensionsRequired = json.extensionsRequired.filter((e) => !/^EXT_texture|^KHR_texture$/.test(e));
}
// Strip every texture slot from materials so they load as flat PBR.
if (Array.isArray(json.materials)) {
  for (const m of json.materials) {
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture;
      delete m.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete m.normalTexture;
    delete m.occlusionTexture;
    delete m.emissiveTexture;
    delete m.extensions;
  }
}
// Re-encode JSON chunk (may have grown; pad to 4-byte boundary).
const newJson = Buffer.from(JSON.stringify(json), 'utf8');
const fmt = (n) => n + (4 - (n % 4)) % 4;
const jsonPaddedLen = fmt(newJson.length);
const jsonPad = Buffer.alloc(jsonPaddedLen - newJson.length, 0x20);
const binStart = 20 + jsonLen;
const binChunk = raw.subarray(binStart + 8);
const binLen = dv.getUint32(binStart, true);
const totalLen = 12 + 8 + jsonPaddedLen + 8 + binChunk.length;
const out = Buffer.alloc(12 + 8 + jsonPaddedLen + 8 + binChunk.length);
out.write('glTF', 0, 'ascii');
const odv = new DataView(out.buffer, out.byteOffset, out.byteLength);
odv.setUint32(4, 2, true);
odv.setUint32(8, totalLen, true);
odv.setUint32(12, jsonPaddedLen, true);
out.write('JSON', 16, 'ascii');
newJson.copy(out, 20);
jsonPad.copy(out, 20 + newJson.length);
const binHeaderOff = 20 + jsonPaddedLen;
odv.setUint32(binHeaderOff, binChunk.length, true);
out.write('BIN\0', binHeaderOff + 4, 'ascii');
binChunk.copy(out, binHeaderOff + 8);

const data = out;

// GLTFLoader expects an ArrayBuffer
const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const HULL_R = 0x22, HULL_G = 0x4a, HULL_B = 0x82;
const CANOPY_R = 0xff, CANOPY_G = 0xaa, CANOPY_B = 0x00;
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePngMask(W, H, mask, cxMin, cxMax, cyMin, cyMax) {
  const pitch = W * 4;
  const raw = Buffer.alloc((pitch + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (pitch + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const off = y * (pitch + 1) + 1 + x * 4;
      if (!mask[y * W + x]) {
        raw[off] = 0; raw[off + 1] = 0; raw[off + 2] = 0; raw[off + 3] = 0;
      } else if (x >= cxMin && x <= cxMax && y >= cyMin && y <= cyMax) {
        raw[off] = CANOPY_R; raw[off + 1] = CANOPY_G; raw[off + 2] = CANOPY_B; raw[off + 3] = 255;
      } else {
        raw[off] = HULL_R; raw[off + 1] = HULL_G; raw[off + 2] = HULL_B; raw[off + 3] = 255;
      }
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

await new Promise((resolveLoad, reject) => {
  loader.parse(buf, '', (gltf) => {
    const model = gltf.scene;

    // Reproduce the game's framing: center, rotate -PI/2 around Y (side read).
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center);
    model.rotation.set(0, -Math.PI / 2, 0);
    model.updateMatrixWorld(true);

    // First pass: collect all world-space XY points for bbox/normalization,
    // then project triangles using the resulting toX/toY so we can extract the
    // silhouette via boundary-edge detection (captures concave delta-wing outline).
    const tmp = new THREE.Vector3();
    const rawXY = [];
    const meshWorldVerts = new Map();
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const pos = child.geometry.attributes.position;
      if (!pos) return;
      const verts = [];
      for (let i = 0; i < pos.count; i++) {
        tmp.fromBufferAttribute(pos, i);
        child.localToWorld(tmp);
        verts.push([tmp.x, tmp.y]);
        rawXY.push([tmp.x, tmp.y]);
      }
      meshWorldVerts.set(child, verts);
    });

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of rawXY) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const w = maxX - minX, h = maxY - minY;
    const pad = Math.max(w, h) * 0.08;
    const W = 64, H = 48;
    const scale = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
    const toX = (x) => ((x - minX) * scale) + (W - w * scale) / 2;
    const toY = (y) => H - (((y - minY) * scale) + (H - h * scale) / 2); // flip Y for SVG

    // Rasterize projected triangles to a binary mask via software fill (clean,
    // faithful silhouette — no self-intersection noise from boundary tracing).
    // Scale up 8x for a crisp mask, then downsample.
    const SS = 8;
    const GW = W * SS, GH = H * SS;
    const mask = new Uint8Array(GW * GH);
    const sx = (wx) => ((wx - minX) * scale) * SS + (W - w * scale) / 2 * SS;
    const sy = (wy) => (H - (((wy - minY) * scale) + (H - h * scale) / 2)) * SS;
    const fillTri = (ax, ay, bx, by, cx, cy) => {
      const minXg = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
      const maxXg = Math.min(GW - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minYg = Math.max(0, Math.floor(Math.min(ay, by, cy)));
      const maxYg = Math.min(GH - 1, Math.ceil(Math.max(ay, by, cy)));
      const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(denom) < 1e-6) return;
      for (let gy = minYg; gy <= maxYg; gy++) {
        for (let gx = minXg; gx <= maxXg; gx++) {
          const px = gx + 0.5, py = gy + 0.5;
          const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom;
          const w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom;
          const w2 = 1 - w0 - w1;
          if (w0 >= 0 && w1 >= 0 && w2 >= 0) mask[gy * GW + gx] = 1;
        }
      }
    };
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const geo = child.geometry;
      const pos = geo.attributes.position;
      if (!pos) return;
      const idx = geo.index;
      const worldVerts = meshWorldVerts.get(child);
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      const emit = (a, b, c) => {
        const A = worldVerts[a], B = worldVerts[b], C = worldVerts[c];
        const area2 = (B[0]-A[0])*(C[1]-A[1]) - (B[1]-A[1])*(C[0]-A[0]);
        if (Math.abs(area2) < 1e-4) return;
        fillTri(sx(A[0]), sy(A[1]), sx(B[0]), sy(B[1]), sx(C[0]), sy(C[1]));
      };
      if (idx) {
        for (let t = 0; t < triCount; t++) emit(idx.getX(t*3), idx.getX(t*3+1), idx.getX(t*3+2));
      } else {
        for (let t = 0; t < triCount; t++) emit(t*3, t*3+1, t*3+2);
      }
    });

    // Downsample to 64x48 alpha (any covered super-sample => opaque pixel).
    const outMask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let covered = false;
        for (let dy = 0; dy < SS && !covered; dy++) {
          for (let dx = 0; dx < SS && !covered; dx++) {
            if (mask[(y*SS+dy) * GW + (x*SS+dx)]) covered = true;
          }
        }
        outMask[y * W + x] = covered ? 1 : 0;
      }
    }

    // Canopy region: bounding box of raw points in the upper-mid area.
    let cxMin = Infinity, cxMax = -Infinity, cyMin = Infinity, cyMax = -Infinity;
    const yMid = (minY + maxY) / 2;
    const yTop = minY + h * 0.30;
    for (let i = 0; i < rawXY.length; i++) {
      const wx = rawXY[i][0], wy = rawXY[i][1];
      if (wy > yTop && wy < yMid + h * 0.15 && wx > minX + w * 0.40 && wx < minX + w * 0.80) {
        const px = toX(wx), py = toY(wy);
        if (px < cxMin) cxMin = px; if (px > cxMax) cxMax = px;
        if (py < cyMin) cyMin = py; if (py > cyMax) cyMax = py;
      }
    }

    // Encode a minimal RGBA PNG of the mask: hull = #224a82, canopy region =
    // #ffaa00 (amber), transparent elsewhere.
    const png = encodePngMask(W, H, outMask, cxMin, cxMax, cyMin, cyMax);
    const b64 = Buffer.from(png).toString('base64');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48">
  <title>Aeon Pulse Craft</title>
  <image href="data:image/png;base64,${b64}" width="64" height="48"/>
</svg>
`;
    writeFileSync(outPath, svg);
    console.log(`wrote ${outPath}: ${rawXY.length} verts rasterized; covered ${outMask.filter((b)=>b).length}/${W*H} px; png ${png.length} bytes`);
    resolveLoad();
  }, (err) => reject(err));
});
