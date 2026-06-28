import type { RenderStatsSnapshot } from '../types.ts';

export interface NumberSummary {
  min: number | null;
  max: number | null;
  avg: number;
}

export interface TimedRenderStatsSnapshot extends RenderStatsSnapshot {
  /** Elapsed seconds when the sample was captured. */
  t?: number;
}

export interface RenderProfileSummary {
  name: string;
  sampleCount: number;
  levelsSeen: string[];
  statesSeen: string[];
  calls: NumberSummary;
  fps: NumberSummary;
  triangles: NumberSummary;
  bullets: NumberSummary;
  renderUnits: NumberSummary;
  objectUnits: NumberSummary;
  maxCategories: Record<string, number>;
  maxDetails: Record<string, number>;
  maxSources: Record<string, number>;
  maxSourceRenderUnits: Record<string, number>;
  peakComposition: Array<{ enemyType: string; bucket: string; batchCount: number; instanceCount: number; triangleCount: number }> | null;
  peakCompositionMaxCalls: number | null;
  /** Raw HUD text from the final sample. */
  lastRaw: string;
}

function summarizeNumbers(values: number[]): NumberSummary {
  if (values.length === 0) {
    return { min: null, max: null, avg: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return { min, max, avg };
}

function sortRecordDesc(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).sort((a, b) => b[1] - a[1]));
}

function collectMaxima(
  samples: RenderStatsSnapshot[],
  key: keyof RenderStatsSnapshot,
): Record<string, number> {
  const maxima: Record<string, number> = {};
  for (const sample of samples) {
    const map = sample[key] as Record<string, number> | undefined;
    if (!map) continue;
    for (const [mapKey, value] of Object.entries(map)) {
      maxima[mapKey] = Math.max(maxima[mapKey] ?? 0, value);
    }
  }
  return maxima;
}

/**
 * Summarize a series of render-stat snapshots into the same shape produced by
 * `scripts/collect-render-stats.mjs`.
 */
export function summarize(
  samples: TimedRenderStatsSnapshot[],
  name: string,
): RenderProfileSummary {
  const calls = samples.map((sample) => sample.calls);
  const fps = samples.map((sample) => sample.fps);
  const triangles = samples
    .map((sample) => sample.triangles)
    .filter((value): value is number => typeof value === 'number');
  const bullets = samples.map((sample) => sample.bullets);
  const renderUnits = samples.map((sample) => sample.renderUnits);
  const objectUnits = samples.map((sample) => sample.objectUnits);

  const maxSources = collectMaxima(samples, 'sources');
  const maxSourceRenderUnits = collectMaxima(samples, 'sourceRenderUnits');
  const maxCategories = collectMaxima(samples, 'categories');
  const maxDetails = collectMaxima(samples, 'details');

  const levelsSeen = [
    ...new Set(samples.map((sample) => sample.level).filter((level): level is string => Boolean(level))),
  ];
  const statesSeen = [
    ...new Set(samples.map((sample) => sample.state).filter((state): state is string => Boolean(state))),
  ];

  const peakSample = samples.length > 0
    ? samples.reduce((max, sample) => sample.calls > max.calls ? sample : max, samples[0])
    : null;

  return {
    name,
    sampleCount: samples.length,
    levelsSeen,
    statesSeen,
    calls: summarizeNumbers(calls),
    fps: summarizeNumbers(fps),
    triangles: summarizeNumbers(triangles),
    bullets: summarizeNumbers(bullets),
    renderUnits: summarizeNumbers(renderUnits),
    objectUnits: summarizeNumbers(objectUnits),
    maxCategories: sortRecordDesc(maxCategories),
    maxDetails: sortRecordDesc(maxDetails),
    maxSources: sortRecordDesc(maxSources),
    maxSourceRenderUnits: sortRecordDesc(maxSourceRenderUnits),
    peakComposition: peakSample?.peakComposition ?? null,
    peakCompositionMaxCalls: peakSample?.calls ?? null,
    lastRaw: samples[samples.length - 1]?.raw ?? '',
  };
}
