import { writeFileSync } from 'node:fs';

const PAGE_MATCH = process.env.PAGE_MATCH ?? 'localhost:5173';
const CDP_BASE = process.env.CDP_BASE ?? 'http://127.0.0.1:9222';
const GAMEPLAY_OUT = process.env.GAMEPLAY_OUT ?? '/tmp/swarm-gameplay-asset-check.png';
const VIEWER_OUT = process.env.VIEWER_OUT ?? '/tmp/swarm-viewer-asset-check.png';

async function main() {
  const targets = await fetchJson(`${CDP_BASE}/json/list`);
  const page = targets.find((target) => target.type === 'page' && String(target.url).includes(PAGE_MATCH));
  if (!page?.webSocketDebuggerUrl) {
    throw new Error(`No page target matched "${PAGE_MATCH}"`);
  }

  const cdp = await connectCdp(page.webSocketDebuggerUrl);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.bringToFront');

  await cdp.send('Page.navigate', { url: `http://${PAGE_MATCH}/?testAudio=off&invincible=1` });
  await cdp.waitFor('Page.loadEventFired');
  await sleep(1200);

  await evalInPage(cdp, `
    (() => {
      const overlay = document.getElementById('ui-overlay');
      if (overlay) overlay.style.opacity = '0';
      const counter = document.getElementById('fps-counter');
      if (counter) counter.style.opacity = '0';
      return true;
    })()
  `);

  await evalInPage(cdp, `
    (async () => {
      const { CampaignAttempt } = await import('/src/campaign/CampaignAttempt.ts');
      window.game._attempt = new CampaignAttempt(window.game.currentLevel, 1);
      window.game._run?.destroy?.();
      window.game._run = null;
      window.game._setState('PLAYING');
      if (window.__swarmProbe?.destroy) window.__swarmProbe.destroy();
      const { EnemySwarm } = await import('/src/entities/EnemySwarm.ts');
      const swarm = new EnemySwarm(
        window.game.scene,
        window.game.sprites,
        180,
        30,
        () => ({ x: 0, y: 0 }),
        () => null,
        { play: () => {} },
        { modelVariant: 'gameplay' },
      );
      window.__swarmProbe = swarm;
      return true;
    })()
  `);
  await waitForModel(cdp, '__swarmProbe');
  await sleep(300);
  await captureToFile(cdp, GAMEPLAY_OUT);

  await evalInPage(cdp, `
    (async () => {
      window.game._setState('VIEWER');
      await window.game._viewer._renderPage();
      window.game._viewer.changePage(1);
      return true;
    })()
  `);
  await sleep(1500);
  await captureToFile(cdp, VIEWER_OUT);

  cdp.close();
  console.log(JSON.stringify({ gameplay: GAMEPLAY_OUT, viewer: VIEWER_OUT }, null, 2));
}

async function waitForModel(cdp, probeName) {
  for (let i = 0; i < 50; i += 1) {
    const ready = await evalInPage(cdp, `Boolean(window.${probeName}?._modelWrapper)`);
    if (ready) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${probeName} model attachment`);
}

async function captureToFile(cdp, outPath) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(outPath, Buffer.from(result.data, 'base64'));
}

async function evalInPage(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return result.result?.value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
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
