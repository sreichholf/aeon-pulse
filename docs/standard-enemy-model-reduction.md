# Standard Enemy Model Reduction Baseline

This records how the four GLB-backed Standard Enemy **gameplay** models (`<enemy>.glb`) are generated from their high-res **viewer** sources (`<enemy>-viewer.glb`), and the reduction each one currently ships at. Use it to regenerate a model or to dial a different aggressiveness later.

## Model pair convention

Each GLB-backed standard enemy has two GLBs, selected by presentation context (ADR 0024):

- `<enemy>.glb` — **gameplay** context. Small, generated, meshopt-compressed. Loaded by the entity and (for Swarm) by the Enemy Instancer.
- `<enemy>-viewer.glb` — **viewer** context. The untouched high-res source, loaded only by the Tactical Database.

The viewer GLB is the **source of truth**; the gameplay GLB is a **generated artifact** reproduced by the pipeline below.

## Pipeline

Two offline scripts, run in this order. **Textures must run first**, because `optimize-glb-geometry.mjs` emits `EXT_meshopt_compression` and the texture script does not understand meshopt bufferViews — running it after geometry corrupts the BIN.

1. Texture resize/re-encode (skip if the source already has suitably small textures):
   ```
   node scripts/optimize-glb-textures.mjs optimize <viewer>.glb <tex>.glb --max-size 1024 --quality 82
   ```
2. Geometry reduction:
   ```
   node scripts/optimize-glb-geometry.mjs <input>.glb <gameplay>.glb --ratio R --error 2.0
   ```
   `optimize-glb-geometry.mjs` runs `dedup → weld → simplify(ratio, error) → reorder → quantize → meshopt` and registers `EXTMeshoptCompression`, `EXTTextureWebP`, and `KHRTextureTransform` so source extensions round-trip.

`--ratio` is the fraction of vertices gltf-transform *retains* (lower = more aggressive). `--error` is the max model-space deviation; with `--error 2.0` the ratio is the binding constraint. Each mesh has a **floor** below which simplify will not reduce regardless of ratio (UV-seam/topology limit); going below it requires re-unwrapping + rebaking textures.

## Current baseline (verified from installed files)

| enemy | gameplay verts | gameplay indices | gameplay KB | viewer source verts | viewer source KB | vertex retention | ratio | texture pass |
|---|---|---|---|---|---|---|---|---|
| diver | 22,903 | 56,352 | 799 | 323,085 | 23,066 | 7.1% | 0.03 | 1024 / q82 |
| straight | 20,069 | 47,673 | 670 | 214,108 | 16,745 | 9.4% | 0.03 | 1024 / q82 |
| sine | 3,826 | 10,206 | 446 | 225,118 | 20,391 | 1.7% | 0.003 | 1024 / q82 |
| swarm | 5,106 | 10,692 | 427 | 342,479 | 17,021 | 1.5% | 0.003 | none (source already small WebP) |

All four gameplay models are single-mesh, single-primitive, single **unnamed** material — matching the `StandardEnemyModel.test.ts` bucket-vocabulary assertion. All decode cleanly through `MeshoptDecoder` (the game's `GLTFLoader` path).

diver/straight hit their simplify floor at ~7–9% retention (ratio 0.03). sine/swarm have simpler topology and keep collapsing to ~1.5–1.7% (ratio 0.003); the table's ratios are each model's floor.

Swarm is the only enemy opted into the Enemy Instancer (`userData.isInstanced`), so its vertex cut pays off at instance scale — the biggest render win of the four.

## Reproduce per model

```bash
# diver
node scripts/optimize-glb-textures.mjs optimize src/models/diver-viewer.glb /tmp/diver-tex.glb --max-size 1024 --quality 82
node scripts/optimize-glb-geometry.mjs /tmp/diver-tex.glb src/models/diver.glb --ratio 0.03 --error 2.0

# straight
node scripts/optimize-glb-textures.mjs optimize src/models/straight-viewer.glb /tmp/straight-tex.glb --max-size 1024 --quality 82
node scripts/optimize-glb-geometry.mjs /tmp/straight-tex.glb src/models/straight.glb --ratio 0.03 --error 2.0

# sine
node scripts/optimize-glb-textures.mjs optimize src/models/sine-viewer.glb /tmp/sine-tex.glb --max-size 1024 --quality 82
node scripts/optimize-glb-geometry.mjs /tmp/sine-tex.glb src/models/sine.glb --ratio 0.003 --error 2.0

# swarm (no texture pass — swarm-viewer.glb already uses small WebP textures)
node scripts/optimize-glb-geometry.mjs src/models/swarm-viewer.glb src/models/swarm.glb --ratio 0.003 --error 2.0
```

After regenerating any model, run `npm test` (material-vocabulary assertion) and `npm run build`.

## Player model (lossless, single-context)

`player.glb` is not a Standard Enemy and has no `-viewer.glb` pair — it is the player craft, shown in one context only. It is reduced **losslessly** (no decimation, no resolution loss), because it is the most-scrutinized model on screen:

- texture: PNG → **lossless WebP** (`--lossless`, no resize). 2,852,585 → 2,038,066 B, **pixel-identical** (decoded-RGB md5 `5a2a481b…c810…` matches before/after).
- geometry: **meshopt** only (`--no-simplify`, 5,334 verts retained, 16-bit quantize — visually lossless). 191,352 → 106,344 B.
- result: **3,045,284 → 2,090,396 B (~31% smaller), no quality loss.**

Reproduce (textures-first, then geometry):

```bash
node scripts/optimize-glb-textures.mjs optimize src/models/player.glb /tmp/player-tex.glb --lossless
node scripts/optimize-glb-geometry.mjs /tmp/player-tex.glb src/models/player.glb --ratio 1 --error 0 --no-simplify
```

The player loader (`Game.ts`, `_preloadAssets`) must call `loader.setMeshoptDecoder(MeshoptDecoder)` for the geometry half to decode — this is separate from the Standard Enemy loader in `StandardEnemyModelSource`, which already does. `--lossless` adds the `EXT_texture_webp` extension and repoints textures via it; three.js `GLTFLoader` handles that natively, so no other code change is needed.

## Adjusting later

- **Less aggressive** (higher quality, larger file): raise `--ratio` (e.g. diver/straight to 0.05 ≈ 9–10% retention) or lower `--error`.
- **More aggressive**: lower `--ratio`. Past each model's floor it stops removing vertices; going below the floor needs UV rebake (out of scope for this pipeline).
- **Sharper textures**: raise `--max-size` (e.g. 2048) or `--quality`. **Softer/smaller textures**: lower them (e.g. 512). Swarm has no texture pass by default; add one only if its source textures grow.
- **Sweep to compare**: generate several ratios to `/tmp` and inspect in a glTF viewer before installing, e.g.:
  ```
  for r in 0.05 0.03 0.02; do node scripts/optimize-glb-geometry.mjs /tmp/sine-tex.glb /tmp/sine-r${r}.glb --ratio $r --error 2.0; done
  ```

## Gotchas

- **Texture-script offset bug (fixed):** `optimize-glb-textures.mjs` previously compared each bufferView's already-mutated `byteOffset` against the entry's original offset; with large-negative deltas a later view missed a shift and the BIN corrupted (reproducible with `sine.glb`). It now compares original-offset to original-offset.
- **`KHR_texture_transform` must round-trip:** `swarm-viewer.glb` applies a UV transform (scale ~16×) on its material's base-color texture. If that extension is dropped during geometry processing, the texture maps to the wrong region and looks scrambled. `optimize-glb-geometry.mjs` registers `KHRTextureTransform` on its I/O to preserve it.
- **Textures-before-geometry ordering is mandatory** (see Pipeline). The texture script cannot run on a meshopt-compressed GLB.
- **Double-quantization bug (fixed):** `optimize-glb-geometry.mjs` previously called `quantize()` without first dequantizing. If a source model was already exported with `KHR_mesh_quantization` (e.g. `heartseer.glb`), the second quantization pass collapsed the Y and Z coordinates entirely, resulting in an invisible, flattened 1D line. The script now calls `dequantize()` before applying other transforms to safely unpack coordinates back to floats.
- The low-res gameplay model is only ever shown at gameplay scale; judge decimation quality there, not in a close-up viewer. The viewer context always loads the high-res source.
