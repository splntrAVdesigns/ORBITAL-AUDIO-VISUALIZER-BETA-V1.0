import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';

/** Clone-safe viewport envelope shared by all render hosts. */
export interface RenderViewportSnapshot {
  cssWidth: number;
  cssHeight: number;
  backingWidth: number;
  backingHeight: number;
  devicePixelRatio: number;
  renderScale: number;
}

/**
 * Clone-safe frame envelope consumed by render hosts/kernel parity fixtures.
 *
 * Phase 4.8B deliberately does not force the production renderer to read from
 * this object yet: the known-good renderer still owns its proven closure state.
 * The envelope is captured in parallel so 4.8C can switch host ownership
 * without inventing a second parameter/audio interpretation.
 */
export interface RenderInputSnapshot<TParameters extends object = Record<string, unknown>> {
  now: number;
  timing: RuntimeFrameTiming;
  parameters: Readonly<TParameters>;
  parameterRevision: number;
  viewport: RenderViewportSnapshot | null;
}

export function cloneRenderInputSnapshot<TParameters extends object>(
  snapshot: RenderInputSnapshot<TParameters>,
): RenderInputSnapshot<TParameters> {
  return {
    now: snapshot.now,
    timing: { ...snapshot.timing },
    parameters: { ...snapshot.parameters },
    parameterRevision: snapshot.parameterRevision,
    viewport: snapshot.viewport ? { ...snapshot.viewport } : null,
  };
}
