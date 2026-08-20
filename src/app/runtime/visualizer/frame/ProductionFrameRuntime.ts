import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';
import { createVisualizerRenderKernel } from '../kernel/VisualizerRenderKernel';
import { createMainThreadRenderHost } from '../hosts/MainThreadRenderHost';

export interface ProductionFrameRuntimeOptions<TParameters extends object = Record<string, unknown>> {
  createVisualizerRuntimeFoundation: any;
  parameters: TParameters;
  parameterStore: any;
  resourceScope: any;
  getViewport: () => unknown;
  renderEnabled: boolean;
  surfaces: {
    canvas2D: HTMLCanvasElement;
    context2D: CanvasRenderingContext2D;
    webglCanvas: HTMLCanvasElement | null;
  };
  executeProductionFrame: (now: number, timing: RuntimeFrameTiming) => void;
  publishRecordingFrame: (now: number) => void;
  prepareFrame: (now: number, timing: RuntimeFrameTiming) => void;
  publishDiagnostics: () => void;
  finalizeFrame: () => void;
  onResume: (now: number) => void;
  onCrash: (error: unknown, crashCount: number) => void;
}

/**
 * Phase 4.8H.1 production frame shell.
 *
 * This module owns only scheduling/orchestration around Orbital's frozen
 * production frame callback. It deliberately contains no visual formulas,
 * feature defaults, renderer substitutions, parameter reinterpretation, or
 * worker/offscreen behavior. Later decomposition phases can move state owners
 * behind this shell without changing the frame authority contract again.
 */
export class ProductionFrameRuntime<TParameters extends object = Record<string, unknown>> {
  readonly kernel;
  readonly host;
  private disposed = false;

  constructor(private readonly options: ProductionFrameRuntimeOptions<TParameters>) {
    this.kernel = createVisualizerRenderKernel<TParameters>({
      executeFrame: (now, timing) => {
        options.executeProductionFrame(now, timing);
        options.publishRecordingFrame(now);
      },
      publishDiagnostics: options.publishDiagnostics,
      finalizeFrame: options.finalizeFrame,
      onResume: options.onResume,
    });

    this.host = createMainThreadRenderHost<TParameters>({
      createVisualizerRuntimeFoundation: options.createVisualizerRuntimeFoundation,
      kernel: this.kernel,
      parameters: options.parameters,
      parameterStore: options.parameterStore,
      resourceScope: options.resourceScope,
      getViewport: options.getViewport,
      renderEnabled: options.renderEnabled,
      updateFrame: options.prepareFrame,
      onCrash: options.onCrash,
    });

    this.host.foundation.resources.register('canvas2d', options.surfaces.canvas2D);
    this.host.foundation.resources.register('context2d', options.surfaces.context2D);
    this.host.foundation.resources.register('webglCanvas', options.surfaces.webglCanvas);
  }

  get isRunning(): boolean {
    return this.host.isRunning;
  }

  start(): void {
    if (this.disposed) return;
    this.host.start();
  }

  stop(): void {
    if (this.disposed) return;
    this.host.stop();
  }

  pause(): void {
    if (this.disposed) return;
    this.host.pause();
  }

  resume(now = performance.now()): void {
    if (this.disposed) return;
    this.host.resume(now);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.host.dispose();
  }
}

export function createProductionFrameRuntime<TParameters extends object = Record<string, unknown>>(
  options: ProductionFrameRuntimeOptions<TParameters>,
): ProductionFrameRuntime<TParameters> {
  return new ProductionFrameRuntime(options);
}