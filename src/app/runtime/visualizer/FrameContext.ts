import type { ViewportState } from '../ViewportState';
import type { RuntimeFrameTiming, RuntimePlaybackState } from './VisualizerRuntimeTypes';
import type { RuntimeParameterStore } from '../parameters/RuntimeParameterStore';
import type { RendererResourceRegistry } from './RendererResourceRegistry';

export interface SharedFrameContext<TParameters extends object> {
  timing: RuntimeFrameTiming;
  viewport: ViewportState | null;
  parameters: Readonly<TParameters>;
  parameterRevision: number;
  playback: RuntimePlaybackState;
  resources: RendererResourceRegistry;
}

export function createSharedFrameContext<TParameters extends object>(
  parameterStore: RuntimeParameterStore<TParameters>,
  resources: RendererResourceRegistry,
): SharedFrameContext<TParameters> {
  return {
    timing: { now: 0, deltaMs: 0, deltaSeconds: 0, frameIndex: 0, resumed: false },
    viewport: null,
    parameters: parameterStore.current,
    parameterRevision: parameterStore.version,
    playback: { playing: false, source: 'idle' },
    resources,
  };
}
