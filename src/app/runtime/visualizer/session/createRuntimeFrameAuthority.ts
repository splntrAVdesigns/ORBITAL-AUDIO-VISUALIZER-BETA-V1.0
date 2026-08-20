import { createMainThreadRenderHost } from '../hosts/MainThreadRenderHost';
import { createVisualizerRenderKernel } from '../kernel/VisualizerRenderKernel';
import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';

/**
 * Compatibility adapter retained for Phase 4.7 certification code.
 * New production wiring uses MainThreadRenderHost directly. Keeping this adapter
 * prevents a second scheduler/host implementation from surviving Phase 4.8A.
 */
export function createRuntimeFrameAuthority(options: {
  createVisualizerRuntimeFoundation: any;
  parameters: Record<string, unknown>;
  parameterStore: any;
  resourceScope: any;
  getViewport: () => unknown;
  renderOnMainThread: boolean;
  updateFrame: (now: number, timing: RuntimeFrameTiming) => void;
  executeVisualFrame: (now: number, timing: RuntimeFrameTiming) => void;
  publishDiagnostics: () => void;
  finalizeFrame: () => void;
  onResume: (now: number) => void;
  onCrash: (error: unknown, crashCount: number) => void;
}) {
  const kernel = createVisualizerRenderKernel({
    executeFrame: options.executeVisualFrame,
    publishDiagnostics: options.publishDiagnostics,
    finalizeFrame: options.finalizeFrame,
    onResume: options.onResume,
  });

  const host = createMainThreadRenderHost({
    createVisualizerRuntimeFoundation: options.createVisualizerRuntimeFoundation,
    kernel,
    parameters: options.parameters,
    parameterStore: options.parameterStore,
    resourceScope: options.resourceScope,
    getViewport: options.getViewport,
    renderEnabled: options.renderOnMainThread,
    updateFrame: options.updateFrame,
    onCrash: options.onCrash,
  });

  return {
    frameEngine: host.frameEngine,
    foundation: host.foundation,
    dispose() { host.dispose(); },
  };
}
