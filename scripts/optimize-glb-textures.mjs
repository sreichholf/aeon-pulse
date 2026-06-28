#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function usage() {
  console.error(`Usage:
  node scripts/optimize-glb-textures.mjs list <model.glb>
  node scripts/optimize-glb-textures.mjs optimize <in.glb> <out.glb> [--max-size N] [--quality N] [--images all|0,1,2] [--lossless]

Defaults:
  --max-size 1024
  --quality 82
  --images all

Options:
  --lossless   Re-encode textures to LOSSLESS WebP (ffmpeg -lossless 1, no resize).
               Ignored by 'list'. Updates mimeType to image/webp and repoints textures
               via the EXT_texture_webp extension. Use when shrinking without quality loss.

Notes:
  - Supports embedded WebP, PNG, and JPEG textures.
  - Uses ffmpeg for downscaling and re-encoding.
  - Rebuilds the GLB BIN chunk and shifts later bufferView offsets when image sizes change.
  - bufferView offsets are compared original-vs-original (fixed) so large-negative size
    deltas no longer corrupt later views.
`);
}

function parseArgs(args) {
  const options = {
    maxSize: 1024,
    quality: 82,
    images: 'all',
    lossless: false,
  };
  const positionals = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--max-size') options.maxSize = Number(args[++i]);
    else if (arg === '--quality') options.quality = Number(args[++i]);
    else if (arg === '--images') options.images = String(args[++i]);
    else if (arg === '--lossless') options.lossless = true;
    else positionals.push(arg);
  }

  if (!options.lossless) {
    if (!Number.isInteger(options.maxSize) || options.maxSize <= 0) {
      throw new Error('--max-size must be a positive integer');
    }
    if (!Number.isInteger(options.quality) || options.quality < 1 || options.quality > 100) {
      throw new Error('--quality must be an integer between 1 and 100');
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
  if (mimeType === 'image/webp') return '.webp';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return '.jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return '.png';
  if (bytes.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  throw new Error(`unsupported image mime type: ${mimeType ?? 'unknown'}`);
}

function parseWebPDimensions(buf) {
  const riff = buf.toString('ascii', 0, 4);
  const webp = buf.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || webp !== 'WEBP') return { width: null, height: null };

  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
    return {
      width: 1 + (((b1 & 0x3F) << 8) | b0),
      height: 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6)),
    };
  }
  if (chunk === 'VP8X') {
    return {
      width: 1 + buf.readUIntLE(24, 3),
      height: 1 + buf.readUIntLE(27, 3),
    };
  }
  return { width: null, height: null };
}

function parseImageDimensions(buf, extension) {
  if (extension === '.webp') return parseWebPDimensions(buf);
  return { width: null, height: null };
}

function list(file) {
  const glb = parseGlb(file);
  const images = (glb.json.images ?? []).map((image, index) => {
    const { view, buf } = getImageBuffer(glb, index);
    const extension = mimeToExtension(image.mimeType, buf);
    return {
      index,
      mimeType: image.mimeType,
      extension,
      bytes: buf.length,
      ...parseImageDimensions(buf, extension),
      bufferView: image.bufferView,
      bufferViewBytes: view.byteLength,
    };
  });

  console.log(JSON.stringify({ images }, null, 2));
}

function writeGlbWithImages(srcFile, outFile, replacements) {
  const glb = parseGlb(srcFile);
  const entries = replacements
    .map((replacement) => {
      const ref = getImageBuffer(glb, replacement.imageIndex);
      return { ...ref, ...replacement };
    })
    .sort((a, b) => a.offset - b.offset);

  const originalOffsets = new Map();
  for (const view of glb.json.bufferViews ?? []) {
    originalOffsets.set(view, view.byteOffset ?? 0);
  }

  let cursor = 0;
  const parts = [];
  let runningDelta = 0;

  for (const entry of entries) {
    const oldLength = entry.view.byteLength;
    const paddedLength = entry.buffer.length + ((4 - (entry.buffer.length % 4)) % 4);
    const replacement = paddedLength === entry.buffer.length
      ? entry.buffer
      : Buffer.concat([entry.buffer, Buffer.alloc(paddedLength - entry.buffer.length)]);
    const oldEnd = entry.offset + oldLength;

    parts.push(glb.bin.subarray(cursor, entry.offset));
    parts.push(replacement);
    cursor = oldEnd;

    const delta = paddedLength - oldLength;
    entry.view.byteLength = entry.buffer.length;
    for (const otherView of glb.json.bufferViews ?? []) {
      if (otherView === entry.view) continue;
      if (originalOffsets.get(otherView) > entry.offset) {
        otherView.byteOffset = (otherView.byteOffset ?? 0) + delta;
      }
    }
    runningDelta += delta;
  }

  parts.push(glb.bin.subarray(cursor));
  glb.bin = Buffer.concat(parts);
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
  return runningDelta;
}

function optimizeImage(buf, extension, options) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'optimize-glb-textures-'));
  const outExt = options.lossless ? '.webp' : extension;
  const inputFile = path.join(tempDir, `input${extension}`);
  const outputFile = path.join(tempDir, `output${outExt}`);

  try {
    fs.writeFileSync(inputFile, buf);
    const args = [
      '-y',
      '-loglevel', 'error',
      '-i', inputFile,
    ];

    if (options.lossless) {
      args.push('-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6');
    } else {
      const filter = `scale='min(iw,${options.maxSize})':'min(ih,${options.maxSize})':force_original_aspect_ratio=decrease`;
      args.push('-vf', filter);
      if (extension === '.webp') {
        args.push('-c:v', 'libwebp', '-q:v', String(options.quality), '-compression_level', '6');
      } else if (extension === '.jpg') {
        args.push('-q:v', String(Math.max(2, Math.round((100 - options.quality) / 5) + 2)));
      }
    }

    args.push(outputFile);
    execFileSync('ffmpeg', args);
    return fs.readFileSync(outputFile);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function imageIndices(glb, selector) {
  if (selector === 'all') {
    return (glb.json.images ?? []).map((_, index) => index);
  }
  return selector.split(',').map((part) => {
    const value = Number(part.trim());
    if (!Number.isInteger(value) || value < 0) throw new Error(`invalid image index: ${part}`);
    return value;
  });
}

function optimizeCommand(file, outFile, options) {
  const glb = parseGlb(file);
  const replacements = [];
  const report = [];
  const processedIndices = imageIndices(glb, options.images);

  for (const imageIndex of processedIndices) {
    const { image, buf } = getImageBuffer(glb, imageIndex);
    const extension = mimeToExtension(image.mimeType, buf);
    const optimized = optimizeImage(buf, extension, options);
    replacements.push({ imageIndex, buffer: optimized });
    report.push({
      imageIndex,
      mimeType: image.mimeType,
      oldBytes: buf.length,
      newBytes: optimized.length,
      oldDimensions: parseImageDimensions(buf, extension),
      newDimensions: parseImageDimensions(optimized, options.lossless ? '.webp' : extension),
    });
  }

  const srcSize = fs.statSync(file).size;
  writeGlbWithImages(file, outFile, replacements);
  if (options.lossless) {
    applyLosslessWebpExtension(outFile, processedIndices);
  }
  const outSize = fs.statSync(outFile).size;

  console.log(JSON.stringify({
    srcSize,
    outSize,
    savedBytes: srcSize - outSize,
    maxSize: options.maxSize,
    quality: options.quality,
    lossless: options.lossless,
    report,
  }, null, 2));
}

/**
 * For --lossless: the BIN already holds the new WebP bytes (via writeGlbWithImages),
 * but the JSON still describes the old image format. Rewrite ONLY the JSON chunk to
 * mark the converted images as image/webp and repoint their textures through
 * EXT_texture_webp (the structure three.js GLTFLoader expects). The BIN is preserved
 * byte-for-byte.
 */
function applyLosslessWebpExtension(file, convertedImageIndices) {
  const converted = new Set(convertedImageIndices);
  const glb = fs.readFileSync(file);
  if (glb.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file} is not a GLB`);
  const jsonLength = glb.readUInt32LE(12);
  const binHeader = 20 + jsonLength;
  const binLength = glb.readUInt32LE(binHeader);
  const bin = Buffer.from(glb.subarray(binHeader + 8, binHeader + 8 + binLength));
  const json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength).trim());

  let changed = false;
  (json.images ?? []).forEach((image, index) => {
    if (converted.has(index) && image.mimeType !== 'image/webp') {
      image.mimeType = 'image/webp';
      changed = true;
    }
  });

  if (changed) {
    (json.textures ?? []).forEach((texture) => {
      if (texture.source != null && converted.has(texture.source)) {
        texture.extensions = texture.extensions ?? {};
        texture.extensions.EXT_texture_webp = { source: texture.source };
        delete texture.source;
      }
    });
    const used = new Set(json.extensionsUsed ?? []);
    used.add('EXT_texture_webp');
    json.extensionsUsed = [...used];
  }

  const jsonText = JSON.stringify(json);
  const jsonPadding = (4 - (Buffer.byteLength(jsonText) % 4)) % 4;
  const jsonBuffer = Buffer.from(jsonText + ' '.repeat(jsonPadding));
  const binPadding = (4 - (bin.length % 4)) % 4;
  const binBuffer = binPadding ? Buffer.concat([bin, Buffer.alloc(binPadding)]) : bin;

  const out = Buffer.alloc(12 + 8 + jsonBuffer.length + 8 + binBuffer.length);
  out.write('glTF', 0, 4, 'ascii');
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonBuffer.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonBuffer.copy(out, 20);
  const bh = 20 + jsonBuffer.length;
  out.writeUInt32LE(binBuffer.length, bh);
  out.writeUInt32LE(0x004e4942, bh + 4);
  binBuffer.copy(out, bh + 8);
  fs.writeFileSync(file, out);
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
  } else if (command === 'optimize' && positionals.length === 2) {
    optimizeCommand(positionals[0], positionals[1], options);
  } else {
    usage();
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
