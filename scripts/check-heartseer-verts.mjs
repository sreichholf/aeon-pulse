import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO();
io.registerExtensions([KHRMeshQuantization, EXTMeshoptCompression, EXTTextureWebP]);
io.registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const files = ['/tmp/opencode/heartseer-r0.06.glb'];

for (const f of files) {
  const doc = await io.read(f);
  console.log(`\nFile: ${f}`);
  const mesh = doc.getRoot().listMeshes()[0];
  const prim = mesh.listPrimitives()[0];
  const pos = prim.getAttribute('POSITION');
  if (pos) {
    console.log(`  - POSITION accessor min:`, pos.getMin([]));
    console.log(`  - POSITION accessor max:`, pos.getMax([]));
  }
}
