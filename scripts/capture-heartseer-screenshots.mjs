import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CDP_PORT = 9222;
const CDP_BASE = `http://127.0.0.1:${CDP_PORT}`;
const PAGE_URL = 'http://localhost:5173/?testAudio=off';
const ARTIFACT_DIR = '/home/stephanr/.gemini/antigravity-cli/brain/8dca6edb-a3e3-4352-b496-65d9a97cbc6c';

async function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  let devServer;
  let startedServer = false;
  try {
    const check = await fetch('http://localhost:5173/');
    if (check.ok || check.status === 404) {
      console.log('[capture] Vite dev server is already running.');
    }
  } catch (e) {
    console.log('[capture] Starting Vite dev server...');
    devServer = spawn('npm', ['run', 'dev'], { stdio: 'ignore', detached: false });
    startedServer = true;
    console.log('[capture] Waiting for Vite dev server on port 5173...');
    await waitForPort(5173);
    console.log('[capture] Vite dev server is ready.');
  }

  console.log('[capture] Starting Google Chrome...');
  const chromeProfileDir = '/tmp/chrome-heartseer-profile';
  const chrome = spawn('google-chrome', [
    '--no-sandbox',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${chromeProfileDir}`,
    '--no-first-run',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    console.log('[capture] Waiting for Chrome CDP...');
    await waitForCdp(CDP_PORT);
    console.log('[capture] Chrome CDP is ready.');

    const targets = await fetchJson(`${CDP_BASE}/json/list`);
    const page = targets.find((target) => target.type === 'page' && (String(target.url).includes('127.0.0.1:5173') || String(target.url).includes('localhost:5173') || target.url === 'about:blank'));
    if (!page?.webSocketDebuggerUrl) {
      throw new Error(`No page target found`);
    }

    console.log('[capture] Connecting to Chrome over CDP...');
    const cdp = await connectCdp(page.webSocketDebuggerUrl);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');

    console.log(`[capture] Navigating to ${PAGE_URL}...`);
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await cdp.waitFor('Page.loadEventFired');
    await sleep(2000); // Wait for page initialization

    // Inject our rendering function
    await evalInPage(cdp, `
      window.__renderModel = async (url) => {
        let canvas = document.getElementById('temp-canvas');
        if (canvas) canvas.remove();

        canvas = document.createElement('canvas');
        canvas.id = 'temp-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '999999';
        canvas.style.background = '#0a0a16';
        document.body.appendChild(canvas);

        const THREE = await import('/node_modules/.vite/deps/three.js');
        const { GLTFLoader } = await import('/node_modules/.vite/deps/three_examples_jsm_loaders_GLTFLoader__js.js');
        const { MeshoptDecoder } = await import('/node_modules/.vite/deps/three_examples_jsm_libs_meshopt_decoder__module__js.js');

        const width = window.innerWidth;
        const height = window.innerHeight;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#050510');

        const camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
        camera.position.set(0, 0, 250);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight1.position.set(10, 15, 10);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x00aaff, 1.0);
        dirLight2.position.set(-10, -5, -5);
        scene.add(dirLight2);

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);

        return new Promise((resolve, reject) => {
          loader.load(url, (gltf) => {
            const model = gltf.scene;

            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            model.position.set(-center.x, -center.y, -center.z);

            const wrapper = new THREE.Group();
            wrapper.add(model);
            scene.add(wrapper);

            // Nice angle: slightly tilted, showing front & top
            wrapper.rotation.set(0.3, -0.8, 0.1);

            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 130 / (maxDim || 1);
            wrapper.scale.setScalar(scale);

            // Render twice to ensure it registers
            renderer.render(scene, camera);
            setTimeout(() => {
              renderer.render(scene, camera);
              resolve({ success: true, size: { x: size.x, y: size.y, z: size.z } });
            }, 100);
          }, undefined, reject);
        });
      };
      true;
    `);

    const versions = [
      { name: 'lossless', file: '/heartseer-lossless.glb' },
      { name: 'r0.12', file: '/heartseer-r0.12.glb' },
      { name: 'r0.06', file: '/heartseer-r0.06.glb' },
      { name: 'r0.03', file: '/heartseer-r0.03.glb' }
    ];

    for (const version of versions) {
      console.log(`[capture] Rendering model version: ${version.name} (${version.file})...`);
      const result = await evalInPage(cdp, `window.__renderModel("${version.file}")`);
      console.log(`[capture] Render result:`, result);

      await sleep(500); // Let layout settle

      const outPath = join(ARTIFACT_DIR, `heartseer_${version.name}.png`);
      console.log(`[capture] Capturing screenshot to ${outPath}...`);
      await captureToFile(cdp, outPath);
      console.log(`[capture] Screenshot saved.`);
    }

    cdp.close();
  } finally {
    console.log('[capture] Cleaning up processes...');
    chrome.kill();
    if (startedServer && devServer) {
      devServer.kill();
    }
  }
}

async function waitForPort(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.status === 200 || res.status === 404) return;
    } catch {
      // ignore
    }
    await sleep(500);
  }
  throw new Error(`Timeout waiting for port ${port}`);
}

async function waitForCdp(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await sleep(300);
  }
  throw new Error(`CDP did not become ready on port ${port}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function evalInPage(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return result.result?.value;
}

async function captureToFile(cdp, outPath) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(outPath, Buffer.from(result.data, 'base64'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  const waiters = new Map();
  let id = 0;

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const handler = pending.get(message.id);
      if (!handler) return;
      pending.delete(message.id);
      if (message.error) {
        handler.reject(new Error(message.error.message));
      } else {
        handler.resolve(message.result ?? {});
      }
      return;
    }

    if (!message.method) return;
    const waiter = waiters.get(message.method);
    if (!waiter?.length) return;
    const next = waiter.shift();
    next?.(message.params ?? {});
  });

  return {
    send(method, params = {}) {
      const nextId = ++id;
      socket.send(JSON.stringify({ id: nextId, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(nextId, { resolve, reject });
      });
    },
    waitFor(method) {
      return new Promise((resolve) => {
        const queue = waiters.get(method) ?? [];
        queue.push(resolve);
        waiters.set(method, queue);
      });
    },
    close() {
      socket.close();
    },
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
