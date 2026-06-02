#!/usr/bin/env node
import fs from 'node:fs';
import zlib from 'node:zlib';

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function usage() {
  console.error(`Usage:
  node scripts/brighten-glb-texture.mjs list <model.glb>
  node scripts/brighten-glb-texture.mjs extract <model.glb> <out.png> [imageIndex]
  node scripts/brighten-glb-texture.mjs brighten <model.glb> <out.glb> [--image N] [--factor F] [--offset N]

Defaults: --image 0 --factor 1.74 --offset 0

Notes:
  - Supports embedded, non-interlaced, 8-bit PNG textures.
  - Rebuilds the GLB BIN chunk and shifts later bufferView offsets when the rewritten PNG grows.
`);
}

function parseArgs(args) {
  const options = { image: 0, factor: 1.74, offset: 0 };
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--image') options.image = Number(args[++i]);
    else if (arg === '--factor') options.factor = Number(args[++i]);
    else if (arg === '--offset') options.offset = Number(args[++i]);
    else positionals.push(arg);
  }
  if (!Number.isInteger(options.image) || options.image < 0) throw new Error('--image must be a non-negative integer');
  if (!Number.isFinite(options.factor)) throw new Error('--factor must be a number');
  if (!Number.isFinite(options.offset)) throw new Error('--offset must be a number');
  return { options, positionals };
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function parsePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error('image is not a PNG');

  let pos = 8;
  let ihdr;
  const idats = [];
  const ancillary = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);

    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
        ihdrData: Buffer.from(data),
      };
    } else if (type === 'IDAT') {
      idats.push(Buffer.from(data));
    } else if (type !== 'IEND') {
      ancillary.push({ type, data: Buffer.from(data) });
    }

    pos += 12 + len;
    if (type === 'IEND') break;
  }

  if (!ihdr) throw new Error('PNG is missing IHDR');
  if (ihdr.bitDepth !== 8 || ihdr.interlace !== 0) {
    throw new Error(`unsupported PNG bit depth/interlace: ${ihdr.bitDepth}/${ihdr.interlace}`);
  }

  const channelsByColorType = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]);
  const channels = channelsByColorType.get(ihdr.colorType);
  if (!channels) throw new Error(`unsupported PNG color type: ${ihdr.colorType}`);

  const stride = ihdr.width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const pixels = Buffer.alloc(ihdr.height * stride);
  let src = 0;
  let dst = 0;

  for (let y = 0; y < ihdr.height; y++) {
    const filter = inflated[src++];
    for (let x = 0; x < stride; x++) {
      const raw = inflated[src++];
      const left = x >= channels ? pixels[dst + x - channels] : 0;
      const up = y > 0 ? pixels[dst + x - stride] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[dst + x - stride - channels] : 0;

      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      } else {
        throw new Error(`unsupported PNG filter: ${filter}`);
      }

      pixels[dst + x] = value & 255;
    }
    dst += stride;
  }

  return { ...ihdr, channels, pixels, ancillary };
}

function encodePng(png) {
  const stride = png.width * png.channels;
  const raw = Buffer.alloc(png.height * (stride + 1));
  let src = 0;
  let dst = 0;

  for (let y = 0; y < png.height; y++) {
    raw[dst++] = 0;
    png.pixels.copy(raw, dst, src, src + stride);
    dst += stride;
    src += stride;
  }

  const chunks = [PNG_SIG, pngChunk('IHDR', png.ihdrData)];
  for (const item of png.ancillary) {
    chunks.push(pngChunk(item.type, item.data));
  }
  chunks.push(pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })));
  chunks.push(pngChunk('IEND'));
  return Buffer.concat(chunks);
}

function parseGlb(file) {
  const glb = fs.readFileSync(file);
  if (glb.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file} is not a GLB`);

  const jsonLength = glb.readUInt32LE(12);
  const jsonType = glb.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error('GLB is missing its JSON chunk');

  const json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength).trim());
  const binHeader = 20 + jsonLength;
  const binLength = glb.readUInt32LE(binHeader);
  const binType = glb.readUInt32LE(binHeader + 4);
  if (binType !== 0x004e4942) throw new Error('GLB is missing its BIN chunk');

  const bin = Buffer.from(glb.subarray(binHeader + 8, binHeader + 8 + binLength));
  return { json, bin };
}

function getImageBuffer(glb, imageIndex) {
  const image = glb.json.images?.[imageIndex];
  if (!image) throw new Error(`image index ${imageIndex} not found`);
  if (image.uri) throw new Error('external image URIs are not supported');

  const view = glb.json.bufferViews?.[image.bufferView];
  if (!view) throw new Error(`bufferView ${image.bufferView} not found`);

  const offset = view.byteOffset ?? 0;
  return {
    image,
    view,
    buf: Buffer.from(glb.bin.subarray(offset, offset + view.byteLength)),
    offset,
  };
}

function stats(png) {
  const rgbOffsets = png.colorType === 0 || png.colorType === 4 ? [0] : [0, 1, 2];
  let sum = 0;
  let count = 0;
  let min = 255;
  let max = 0;

  for (let i = 0; i < png.pixels.length; i += png.channels) {
    for (const offset of rgbOffsets) {
      const value = png.pixels[i + offset];
      sum += value;
      count++;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  return { mean: sum / count, min, max };
}

function brighten(png, factor, offset) {
  const rgbOffsets = png.colorType === 0 || png.colorType === 4 ? [0] : [0, 1, 2];
  const out = { ...png, pixels: Buffer.from(png.pixels) };

  for (let i = 0; i < out.pixels.length; i += out.channels) {
    for (const rgbOffset of rgbOffsets) {
      out.pixels[i + rgbOffset] = Math.max(0, Math.min(255, Math.round(out.pixels[i + rgbOffset] * factor + offset)));
    }
  }

  return out;
}

function writeGlbWithImage(srcFile, outFile, imageIndex, pngBuffer) {
  const glb = parseGlb(srcFile);
  const { view, offset } = getImageBuffer(glb, imageIndex);

  const oldLength = view.byteLength;
  const paddedLength = pngBuffer.length + ((4 - (pngBuffer.length % 4)) % 4);
  const oldEnd = offset + oldLength;
  const delta = paddedLength - oldLength;
  const replacement = paddedLength === pngBuffer.length
    ? pngBuffer
    : Buffer.concat([pngBuffer, Buffer.alloc(paddedLength - pngBuffer.length)]);

  glb.bin = Buffer.concat([
    glb.bin.subarray(0, offset),
    replacement,
    glb.bin.subarray(oldEnd),
  ]);

  view.byteLength = pngBuffer.length;
  for (const otherView of glb.json.bufferViews ?? []) {
    if (otherView === view) continue;
    if ((otherView.byteOffset ?? 0) > offset) {
      otherView.byteOffset = (otherView.byteOffset ?? 0) + delta;
    }
  }
  if (glb.json.buffers?.[0]) {
    glb.json.buffers[0].byteLength = glb.bin.length;
  }

  const jsonText = JSON.stringify(glb.json);
  const jsonPadding = (4 - (Buffer.byteLength(jsonText) % 4)) % 4;
  const jsonBuffer = Buffer.from(jsonText + ' '.repeat(jsonPadding));
  const binPadding = (4 - (glb.bin.length % 4)) % 4;
  const binBuffer = binPadding ? Buffer.concat([glb.bin, Buffer.alloc(binPadding)]) : glb.bin;

  const out = Buffer.alloc(12 + 8 + jsonBuffer.length + 8 + binBuffer.length);
  out.write('glTF', 0, 4, 'ascii');
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonBuffer.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonBuffer.copy(out, 20);

  const binHeader = 20 + jsonBuffer.length;
  out.writeUInt32LE(binBuffer.length, binHeader);
  out.writeUInt32LE(0x004e4942, binHeader + 4);
  binBuffer.copy(out, binHeader + 8);

  fs.writeFileSync(outFile, out);
}

function list(file) {
  const glb = parseGlb(file);
  const images = (glb.json.images ?? []).map((image, index) => {
    const { view, buf } = getImageBuffer(glb, index);
    const png = parsePng(buf);
    return {
      index,
      name: image.name,
      mimeType: image.mimeType,
      bufferView: image.bufferView,
      bufferViewBytes: view.byteLength,
      pngBytes: buf.length,
      width: png.width,
      height: png.height,
      colorType: png.colorType,
      channels: png.channels,
      stats: stats(png),
    };
  });

  console.log(JSON.stringify({
    images,
    materials: glb.json.materials?.map((material) => ({
      name: material.name,
      baseColorTexture: material.pbrMetallicRoughness?.baseColorTexture,
      normalTexture: material.normalTexture,
      metallicRoughnessTexture: material.pbrMetallicRoughness?.metallicRoughnessTexture,
      emissiveTexture: material.emissiveTexture,
    })),
  }, null, 2));
}

function extract(file, outFile, imageIndex) {
  const glb = parseGlb(file);
  const { buf } = getImageBuffer(glb, imageIndex);
  fs.writeFileSync(outFile, buf);
}

function brightenCommand(file, outFile, options) {
  const glb = parseGlb(file);
  const { buf, view } = getImageBuffer(glb, options.image);
  const png = parsePng(buf);
  const changed = brighten(png, options.factor, options.offset);
  const encoded = encodePng(changed);

  console.log(JSON.stringify({
    image: options.image,
    factor: options.factor,
    offset: options.offset,
    before: stats(png),
    after: stats(changed),
    oldPngBytes: buf.length,
    newPngBytes: encoded.length,
    bufferViewBytes: view.byteLength,
  }, null, 2));

  writeGlbWithImage(file, outFile, options.image, encoded);
}

try {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    usage();
    process.exit(command ? 0 : 2);
  }

  const { options, positionals } = parseArgs(rest);

  if (command === 'list' && positionals.length === 1) list(positionals[0]);
  else if (command === 'extract' && positionals.length >= 2 && positionals.length <= 3) {
    extract(positionals[0], positionals[1], Number(positionals[2] ?? options.image));
  } else if (command === 'brighten' && positionals.length === 2) {
    brightenCommand(positionals[0], positionals[1], options);
  } else {
    usage();
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
