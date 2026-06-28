#!/usr/bin/env node
// Offline geometry pipeline for Standard Enemy gameplay models (ADR pending).
// Reads a high-res viewer GLB and writes a gameplay GLB through:
//   dedup -> weld -> simplify(--ratio, --error) -> reorder -> quantize -> meshopt
// Pair with scripts/optimize-glb-textures.mjs for texture resize/re-encode.
//
// Usage:
//   node scripts/optimize-glb-geometry.mjs <in.glb> <out.glb> [--ratio R] [--error E] [--no-simplify] [--no-meshopt]
// Defaults: --ratio 0.10 --error 0.05  (aggressive ~10% vertex retention)
//
// `ratio` is the fraction of vertices to RETAIN (0..1). Lower = more aggressive.
// `error` is the max model-space deviation; too tight quits before reaching `ratio`.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, EXTTextureWebP, KHRTextureTransform, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, weld, simplify, reorder, quantize, dequantize, meshopt, getMeshVertexCount } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

function parseArgs(args) {
  const options = { ratio: 0.1, error: 0.05, noSimplify: false, noMeshopt: false };
  const positionals = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--ratio') options.ratio = Number(args[++i]);
    else if (arg === '--error') options.error = Number(args[++i]);
    else if (arg === '--no-simplify') options.noSimplify = true;
    else if (arg === '--no-meshopt') options.noMeshopt = true;
    else if (arg === '--help' || arg === '-h') { usage(); process.exit(0); }
    else positionals.push(arg);
  }
  if (positionals.length !== 2) { usage(); process.exit(2); }
  if (!Number.isFinite(options.ratio) || options.ratio < 0 || options.ratio > 1) {
    throw new Error('--ratio must be a number in [0, 1]');
  }
  return { options, positionals };
}

function usage() {
  console.error(`Usage:
  node scripts/optimize-glb-geometry.mjs <in.glb> <out.glb> [options]

Options:
  --ratio R     fraction of vertices to retain (0..1). Default 0.10
  --error E     max model-space deviation before quitting early. Default 0.05
  --no-simplify skip simplify() (compression + quantize only)
  --no-meshopt  skip meshopt() (keep quantize only)`);
}

function readGlbJson(file) {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12);
  return JSON.parse(b.toString('utf8', 20, 20 + jl).trim());
}

function reportStats(path, label) {
  const json = readGlbJson(path);
  const meshes = json.meshes ?? [];
  const accessors = json.accessors ?? [];
  let verts = 0;
  let idx = 0;
  for (const m of meshes) {
    for (const p of m.primitives ?? []) {
      if (p.attributes?.POSITION != null) verts += accessors[p.attributes.POSITION]?.count ?? 0;
      if (p.indices != null) idx += accessors[p.indices]?.count ?? 0;
    }
  }
  return {
    label,
    file: path,
    bytes: fs.statSync(path).size,
    extensionsUsed: json.extensionsUsed ?? [],
    materials: (json.materials ?? []).map((m) => m.name),
    meshes: meshes.length,
    primitives: meshes.reduce((n, m) => n + (m.primitives?.length ?? 0), 0),
    verts,
    indices: idx,
  };
}

async function main() {
  const { options, positionals } = parseArgs(process.argv.slice(2));
  const [inFile, outFile] = positionals;

  const before = reportStats(inFile, 'input');

  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, EXTTextureWebP, KHRTextureTransform, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(inFile);

  const transforms = [dequantize(), dedup(), weld({ overwrite: true })];
  if (!options.noSimplify) {
    transforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: options.ratio,
        error: options.error,
      }),
    );
  }
  transforms.push(reorder({ encoder: MeshoptEncoder }));
  transforms.push(quantize());
  if (!options.noMeshopt) {
    transforms.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  }

  await doc.transform(...transforms);
  await io.write(outFile, doc);

  const after = reportStats(outFile, 'output');
  const retained = before.verts ? (after.verts / before.verts) : 0;
  const sizeRatio = before.bytes ? (after.bytes / before.bytes) : 0;

  console.log(JSON.stringify({
    ratioRequested: options.noSimplify ? null : options.ratio,
    errorRequested: options.noSimplify ? null : options.error,
    before,
    after,
    vertexRetention: Number(retained.toFixed(4)),
    vertexReduction: Number((1 - retained).toFixed(4)),
    sizeReduction: Number((1 - sizeRatio).toFixed(4)),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
