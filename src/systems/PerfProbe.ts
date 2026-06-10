import { isRuntimeFlagEnabled } from '../constants.ts';

type PhaseMap = Record<string, number>;
type CountMap = Record<string, number>;

interface FrameProbe {
  t: number;
  gapMs: number;
  dtMs: number;
  phases: PhaseMap;
  counts: CountMap;
  heapDeltaKb: number | null;
  heapUsedMb: number | null;
  previousFrame?: Omit<FrameProbe, 'previousFrame'>;
}

interface PhaseAggregate {
  total: number;
  max: number;
}

const LONG_FRAME_MS = 25;
const MAX_LONG_FRAMES = 24;

let enabled = false;
let outputEl: HTMLElement | null = null;
let lastTimestamp: number | null = null;
let lastHeapBytes: number | null = null;
let startedAt = 0;
let frameCount = 0;
let longFrameCount = 0;
let current: FrameProbe | null = null;
let previousFrame: Omit<FrameProbe, 'previousFrame'> | null = null;
let worstFrame: FrameProbe | null = null;
let longFrames: FrameProbe[] = [];
let phaseAgg: Record<string, PhaseAggregate> = {};
let countMax: CountMap = {};

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function heapBytes(): number | null {
  const perf = globalThis.performance as Performance & {
    memory?: { usedJSHeapSize: number };
  };
  return perf.memory?.usedJSHeapSize ?? null;
}

function cloneFrame(frame: FrameProbe): FrameProbe {
  return {
    t: frame.t,
    gapMs: frame.gapMs,
    dtMs: frame.dtMs,
    phases: { ...frame.phases },
    counts: { ...frame.counts },
    heapDeltaKb: frame.heapDeltaKb,
    heapUsedMb: frame.heapUsedMb,
    previousFrame: frame.previousFrame ? { ...frame.previousFrame, phases: { ...frame.previousFrame.phases }, counts: { ...frame.previousFrame.counts } } : undefined,
  };
}

function cloneFrameWithoutPrevious(frame: FrameProbe): Omit<FrameProbe, 'previousFrame'> {
  return {
    t: frame.t,
    gapMs: frame.gapMs,
    dtMs: frame.dtMs,
    phases: { ...frame.phases },
    counts: { ...frame.counts },
    heapDeltaKb: frame.heapDeltaKb,
    heapUsedMb: frame.heapUsedMb,
  };
}

function writeSummary(): void {
  if (!outputEl || !enabled) return;

  const phaseSummary = Object.fromEntries(
    Object.entries(phaseAgg).map(([name, agg]) => [
      name,
      {
        avg: Number((agg.total / Math.max(1, frameCount)).toFixed(3)),
        max: Number(agg.max.toFixed(3)),
      },
    ]),
  );

  outputEl.textContent = JSON.stringify({
    elapsedSec: Number(((nowMs() - startedAt) / 1000).toFixed(1)),
    frames: frameCount,
    longFrameCount,
    longFrameRate: Number((longFrameCount / Math.max(1, frameCount)).toFixed(4)),
    worstFrame,
    phases: phaseSummary,
    countMax,
    recentLongFrames: longFrames,
  });
}

export function initPerfProbe(): void {
  if (typeof document === 'undefined') return;

  enabled = isRuntimeFlagEnabled('perfProbe', false);
  if (!enabled) {
    outputEl?.remove();
    outputEl = null;
    return;
  }

  outputEl = document.getElementById('aeon-perf-probe');
  if (!outputEl) {
    outputEl = document.createElement('pre');
    outputEl.id = 'aeon-perf-probe';
    outputEl.hidden = true;
    document.body.appendChild(outputEl);
  }
  startedAt = nowMs();
  lastTimestamp = null;
  lastHeapBytes = heapBytes();
  frameCount = 0;
  longFrameCount = 0;
  current = null;
  previousFrame = null;
  worstFrame = null;
  longFrames = [];
  phaseAgg = {};
  countMax = {};
  writeSummary();
}

export function isPerfProbeEnabled(): boolean {
  return enabled;
}

export function beginPerfFrame(timestamp: number, dt: number): void {
  if (!enabled) return;

  const heap = heapBytes();
  const gapMs = lastTimestamp === null ? 0 : timestamp - lastTimestamp;
  const heapDeltaKb = heap !== null && lastHeapBytes !== null ? (heap - lastHeapBytes) / 1024 : null;
  const heapUsedMb = heap !== null ? heap / 1048576 : null;
  current = {
    t: Number(((nowMs() - startedAt) / 1000).toFixed(3)),
    gapMs,
    dtMs: dt * 1000,
    phases: {},
    counts: {},
    heapDeltaKb: heapDeltaKb === null ? null : Number(heapDeltaKb.toFixed(1)),
    heapUsedMb: heapUsedMb === null ? null : Number(heapUsedMb.toFixed(1)),
    previousFrame: previousFrame ? { ...previousFrame, phases: { ...previousFrame.phases }, counts: { ...previousFrame.counts } } : undefined,
  };
  lastTimestamp = timestamp;
  lastHeapBytes = heap;
}

export function addPerfPhase(name: string, ms: number): void {
  if (!enabled || !current) return;
  current.phases[name] = (current.phases[name] ?? 0) + ms;
}

export function setPerfCount(name: string, value: number): void {
  if (!enabled || !current) return;
  current.counts[name] = value;
  countMax[name] = Math.max(countMax[name] ?? 0, value);
}

export function measurePerfPhase<T>(name: string, fn: () => T): T {
  if (!enabled) return fn();
  const start = nowMs();
  try {
    return fn();
  } finally {
    addPerfPhase(name, nowMs() - start);
  }
}

export function endPerfFrame(): void {
  if (!enabled || !current) return;

  frameCount++;
  for (const [name, ms] of Object.entries(current.phases)) {
    const agg = phaseAgg[name] ?? { total: 0, max: 0 };
    agg.total += ms;
    agg.max = Math.max(agg.max, ms);
    phaseAgg[name] = agg;
  }

  if (current.gapMs >= LONG_FRAME_MS) {
    longFrameCount++;
    const snapshot = cloneFrame(current);
    longFrames.push(snapshot);
    if (longFrames.length > MAX_LONG_FRAMES) longFrames.shift();
    if (!worstFrame || snapshot.gapMs > worstFrame.gapMs) {
      worstFrame = snapshot;
    }
  }

  if (frameCount % 30 === 0 || current.gapMs >= LONG_FRAME_MS) {
    writeSummary();
  }
  previousFrame = cloneFrameWithoutPrevious(current);
  current = null;
}
