import type { RenderInputSnapshot, RenderViewportSnapshot } from './RenderInputSnapshot';
import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';

export interface DeterministicRenderFixture<TParameters extends object = Record<string, unknown>> {
  input: RenderInputSnapshot<TParameters>;
  label: string;
}

export const DEFAULT_PARITY_VIEWPORT: RenderViewportSnapshot = Object.freeze({
  cssWidth: 1280,
  cssHeight: 720,
  backingWidth: 2560,
  backingHeight: 1440,
  devicePixelRatio: 2,
  renderScale: 1,
});

export function createDeterministicRenderFixture<TParameters extends object>(options: {
  label: string;
  parameters: TParameters;
  parameterRevision?: number;
  now?: number;
  frameIndex?: number;
  deltaMs?: number;
  viewport?: RenderViewportSnapshot;
}): DeterministicRenderFixture<TParameters> {
  const now = options.now ?? 1000;
  const deltaMs = options.deltaMs ?? (1000 / 60);
  const timing: RuntimeFrameTiming = {
    now,
    deltaMs,
    deltaSeconds: deltaMs / 1000,
    frameIndex: options.frameIndex ?? 60,
    resumed: false,
  };

  return {
    label: options.label,
    input: {
      now,
      timing,
      parameters: Object.freeze({ ...options.parameters }) as Readonly<TParameters>,
      parameterRevision: options.parameterRevision ?? 1,
      viewport: { ...(options.viewport ?? DEFAULT_PARITY_VIEWPORT) },
    },
  };
}

/** Stable JSON helper for deterministic test snapshots (keys recursively sorted). */
export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}
