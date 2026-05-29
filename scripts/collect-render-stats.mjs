const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173/?renderStats=1&invincible=1';
const CDP_BASE = process.env.CDP_BASE ?? 'http://127.0.0.1:9222';

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  ready() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.ws.close();
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function newPage() {
  const res = await fetch(`${CDP_BASE}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`Failed to create CDP page: ${res.status}`);
  const target = await res.json();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Input.setIgnoreInputEvents', { ignore: false });
  return { cdp, targetId: target.id };
}

async function key(cdp, keyName, code, text = undefined) {
  const base = {
    key: keyName,
    code,
    windowsVirtualKeyCode: codePoint(keyName),
    nativeVirtualKeyCode: codePoint(keyName),
  };
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text });
  await sleep(35);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(35);
}

function codePoint(keyName) {
  if (keyName === ' ') return 32;
  if (keyName === 'ArrowUp') return 38;
  if (keyName === 'ArrowRight') return 39;
  if (keyName === 'Enter') return 13;
  return keyName.charCodeAt(0);
}

async function readFpsText(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('fps-counter')?.innerText ?? ''`,
    returnByValue: true,
  });
  return result.result.value ?? '';
}

function parseStats(text) {
  const [head, ...sections] = text.split(' | ');
  const headMatch = head.match(/(?<fps>\d+) FPS/);
  if (!headMatch?.groups) return null;
  const data = {
    fps: Number(headMatch.groups.fps),
    calls: 0,
    objectUnits: 0,
    bullets: 0,
    renderUnits: 0,
    categories: {},
    details: {},
    sources: {},
    sourceRenderUnits: {},
    raw: text,
  };

  const parseMap = (raw) => {
    const out = {};
    for (const part of raw.split(/\s+/).filter(Boolean)) {
      const idx = part.lastIndexOf(':');
      if (idx <= 0) continue;
      out[part.slice(0, idx)] = Number(part.slice(idx + 1));
    }
    return out;
  };

  const parseBulletSources = (raw) => {
    const sources = {};
    const sourceRenderUnits = {};
    for (const part of raw.split(/\s+/).filter(Boolean)) {
      const idx = part.lastIndexOf(':');
      if (idx <= 0) continue;
      const key = part.slice(0, idx);
      const [count, units] = part.slice(idx + 1).split('/');
      sources[key] = Number(count);
      sourceRenderUnits[key] = Number(units ?? count);
    }
    return { sources, sourceRenderUnits };
  };

  for (const section of sections) {
    if (section.startsWith('calls ')) {
      data.calls = Number(section.slice('calls '.length));
    } else if (section.startsWith('objects ')) {
      data.objectUnits = Number(section.slice('objects '.length));
    } else if (section.startsWith('cats ')) {
      data.categories = parseMap(section.slice('cats '.length));
    } else if (section.startsWith('details ')) {
      data.details = parseMap(section.slice('details '.length));
    } else if (section.startsWith('bullets ')) {
      const [count, units] = section.slice('bullets '.length).split('/');
      data.bullets = Number(count);
      data.renderUnits = Number(units ?? count);
    } else {
      const parsed = parseBulletSources(section);
      data.sources = parsed.sources;
      data.sourceRenderUnits = parsed.sourceRenderUnits;
    }
  }

  return data;
}

async function startScenario(cdp, { levelAdvance = 0, tierAdvance = 0 }) {
  await cdp.send('Page.navigate', { url: BASE_URL });
  await sleep(2500);
  for (let i = 0; i < levelAdvance; i++) await key(cdp, 'ArrowUp', 'ArrowUp');
  for (let i = 0; i < tierAdvance; i++) await key(cdp, 'ArrowRight', 'ArrowRight');
  await key(cdp, ' ', 'Space', ' ');
  await sleep(1300);
  await key(cdp, ' ', 'Space', ' ');
  await sleep(500);
}

async function runScenario(config) {
  const { cdp, targetId } = await newPage();
  const samples = [];
  try {
    await startScenario(cdp, config);
    const start = Date.now();
    let nextFire = 0;
    let nextSample = 0;
    while (Date.now() - start < config.durationMs) {
      const elapsed = Date.now() - start;
      if (config.fireEveryMs && elapsed >= nextFire) {
        await key(cdp, ' ', 'Space', ' ');
        nextFire += config.fireEveryMs;
      }
      if (elapsed >= nextSample) {
        const parsed = parseStats(await readFpsText(cdp));
        if (parsed) samples.push({ t: Math.round(elapsed / 1000), ...parsed });
        nextSample += 1000;
      }
      await sleep(50);
    }
  } finally {
    cdp.close();
    await fetch(`${CDP_BASE}/json/close/${targetId}`).catch(() => {});
  }
  return { name: config.name, samples };
}

function summarize({ name, samples }) {
  const calls = samples.map((sample) => sample.calls);
  const bullets = samples.map((sample) => sample.bullets);
  const renderUnits = samples.map((sample) => sample.renderUnits);
  const objectUnits = samples.map((sample) => sample.objectUnits);
  const maxSources = {};
  const maxSourceRenderUnits = {};
  const maxCategories = {};
  const maxDetails = {};

  for (const sample of samples) {
    for (const [key, value] of Object.entries(sample.sources)) {
      maxSources[key] = Math.max(maxSources[key] ?? 0, value);
    }
    for (const [key, value] of Object.entries(sample.sourceRenderUnits)) {
      maxSourceRenderUnits[key] = Math.max(maxSourceRenderUnits[key] ?? 0, value);
    }
    for (const [key, value] of Object.entries(sample.categories)) {
      maxCategories[key] = Math.max(maxCategories[key] ?? 0, value);
    }
    for (const [key, value] of Object.entries(sample.details)) {
      maxDetails[key] = Math.max(maxDetails[key] ?? 0, value);
    }
  }

  return {
    name,
    sampleCount: samples.length,
    calls: summarizeNumbers(calls),
    bullets: summarizeNumbers(bullets),
    renderUnits: summarizeNumbers(renderUnits),
    objectUnits: summarizeNumbers(objectUnits),
    maxCategories: sortRecordDesc(maxCategories),
    maxDetails: sortRecordDesc(maxDetails),
    maxSources: sortRecordDesc(maxSources),
    maxSourceRenderUnits: sortRecordDesc(maxSourceRenderUnits),
    lastRaw: samples.at(-1)?.raw ?? '',
  };
}

function summarizeNumbers(values) {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round(values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)),
  };
}

function sortRecordDesc(record) {
  return Object.fromEntries(Object.entries(record).sort((a, b) => b[1] - a[1]));
}

const scenarios = [
  { name: 'L1-1 no-fire', levelAdvance: 0, tierAdvance: 0, durationMs: 25000, fireEveryMs: null },
  { name: 'L1-1 tier5 tap-fire', levelAdvance: 0, tierAdvance: 4, durationMs: 35000, fireEveryMs: 190 },
  { name: 'L4-4 no-fire', levelAdvance: 18, tierAdvance: 0, durationMs: 30000, fireEveryMs: null },
  { name: 'L4-4 tier5 tap-fire', levelAdvance: 18, tierAdvance: 4, durationMs: 45000, fireEveryMs: 190 },
];

const results = [];
for (const scenario of scenarios) {
  console.error(`running ${scenario.name}`);
  const result = await runScenario(scenario);
  results.push({ ...result, summary: summarize(result) });
}

console.log(JSON.stringify(results.map((result) => result.summary), null, 2));
