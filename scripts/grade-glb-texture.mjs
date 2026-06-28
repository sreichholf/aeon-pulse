#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function usage() {
  console.error(`Usage:
  node scripts/grade-glb-texture.mjs list <model.glb>
  node scripts/grade-glb-texture.mjs extract <model.glb> <out.ext> [imageIndex]
  node scripts/grade-glb-texture.mjs grade <model.glb> <out.glb> [--image N] [--brightness F] [--contrast F] [--saturation F] [--vibrance F] [--gamma F]

Defaults:
  --image 0
  --brightness 0.03
  --contrast 1.04
  --saturation 1.14
  --vibrance 0.18
  --gamma 1.0

Notes:
  - Supports embedded JPEG and PNG textures.
  - Uses ffmpeg to apply color grading to the embedded image.
  - Rebuilds the GLB BIN chunk and shifts later bufferView offsets when the rewritten image size changes.
`);
}

function parseArgs(args) {
  const options = {
    image: 0,
    brightness: 0.03,
    contrast: 1.04,
    saturation: 1.14,
    vibrance: 0.18,
    gamma: 1.0,
  };
  const positionals = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--image') options.image = Number(args[++i]);
    else if (arg === '--brightness') options.brightness = Number(args[++i]);
    else if (arg === '--contrast') options.contrast = Number(args[++i]);
    else if (arg === '--saturation') options.saturation = Number(args[++i]);
    else if (arg === '--vibrance') options.vibrance = Number(args[++i]);
    else if (arg === '--gamma') options.gamma = Number(args[++i]);
    else positionals.push(arg);
  }

  if (!Number.isInteger(options.image) || options.image < 0) {
    throw new Error('--image must be a non-negative integer');
  }
  for (const key of ['brightness', 'contrast', 'saturation', 'vibrance', 'gamma']) {
    if (!Number.isFinite(options[key])) {
      throw new Error(`--${key} must be a number`);
    }
  }

  return { options, positionals };
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

function mimeToExtension(mimeType, bytes) {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return '.jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return '.png';
  throw new Error(`unsupported image mime type: ${mimeType ?? 'unknown'}`);
}

function list(file) {
  const glb = parseGlb(file);
  const images = (glb.json.images ?? []).map((image, index) => {
    const { view, buf } = getImageBuffer(glb, index);
    return {
      index,
      name: image.name,
      mimeType: image.mimeType,
      extension: mimeToExtension(image.mimeType, buf),
      bufferView: image.bufferView,
      bufferViewBytes: view.byteLength,
      imageBytes: buf.length,
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

function writeGlbWithImage(srcFile, outFile, imageIndex, imageBuffer) {
  const glb = parseGlb(srcFile);
  const { view, offset } = getImageBuffer(glb, imageIndex);

  const oldLength = view.byteLength;
  const paddedLength = imageBuffer.length + ((4 - (imageBuffer.length % 4)) % 4);
  const oldEnd = offset + oldLength;
  const delta = paddedLength - oldLength;
  const replacement = paddedLength === imageBuffer.length
    ? imageBuffer
    : Buffer.concat([imageBuffer, Buffer.alloc(paddedLength - imageBuffer.length)]);

  glb.bin = Buffer.concat([
    glb.bin.subarray(0, offset),
    replacement,
    glb.bin.subarray(oldEnd),
  ]);

  view.byteLength = imageBuffer.length;
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

function buildFilter(options) {
  const eq = [
    `brightness=${options.brightness}`,
    `contrast=${options.contrast}`,
    `saturation=${options.saturation}`,
    `gamma=${options.gamma}`,
  ].join(':');

  return `eq=${eq},vibrance=intensity=${options.vibrance}`;
}

function gradeImage(buf, extension, options) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-glb-texture-'));
  const inputFile = path.join(tempDir, `input${extension}`);
  const outputFile = path.join(tempDir, `output${extension}`);
  try {
    fs.writeFileSync(inputFile, buf);
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel', 'error',
      '-i', inputFile,
      '-vf', buildFilter(options),
      ...(extension === '.jpg' ? ['-q:v', '2'] : []),
      outputFile,
    ]);
    return fs.readFileSync(outputFile);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function gradeCommand(file, outFile, options) {
  const glb = parseGlb(file);
  const { buf, image, view } = getImageBuffer(glb, options.image);
  const extension = mimeToExtension(image.mimeType, buf);
  const graded = gradeImage(buf, extension, options);

  console.log(JSON.stringify({
    image: options.image,
    mimeType: image.mimeType,
    brightness: options.brightness,
    contrast: options.contrast,
    saturation: options.saturation,
    vibrance: options.vibrance,
    gamma: options.gamma,
    oldImageBytes: buf.length,
    newImageBytes: graded.length,
    bufferViewBytes: view.byteLength,
  }, null, 2));

  writeGlbWithImage(file, outFile, options.image, graded);
}

try {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    usage();
    process.exit(command ? 0 : 2);
  }

  const { options, positionals } = parseArgs(rest);

  if (command === 'list' && positionals.length === 1) {
    list(positionals[0]);
  } else if (command === 'extract' && positionals.length >= 2 && positionals.length <= 3) {
    extract(positionals[0], positionals[1], Number(positionals[2] ?? options.image));
  } else if (command === 'grade' && positionals.length === 2) {
    gradeCommand(positionals[0], positionals[1], options);
  } else {
    usage();
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
