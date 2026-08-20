import { RuntimeFrameEngine } from '../frame/RuntimeFrameEngine';
import { runtimeRenderAuthority } from '../RuntimeRenderAuthority';
import type { RenderInputSnapshot, RenderViewportSnapshot } from '../kernel/RenderInputSnapshot';
import type { VisualizerRenderKernel } from '../kernel/VisualizerRenderKernel';
import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';
import type { RenderHost, RenderHostState } from './RenderHost';

export interface MainThreadRenderHostOptions<TParameters extends object = Record<string, unknown>> {
  createVisualizerRuntimeFoundation: any;
  kernel: VisualizerRenderKernel<TParameters>;
  parameters: TParameters;
  parameterStore: any;
  resourceScope: any;
  getViewport: () => unknown;
  renderEnabled: boolean;
  updateFrame: (now: number, timing: RuntimeFrameTiming) => void;
  onCrash: (error: unknown, crashCount: number) => void;
}

/**
 * Main-thread reference host for the exact production render kernel.
 *
 * Phase 4.8B formalizes the lifecycle/input contract without changing the
 * scheduler or the production visual callback. The future worker host must
 * match this contract instead of implementing alternate visual behavior.
 */
export class MainThreadRenderHost<TParameters extends object = Record<string, unknown>> implements RenderHost<TParameters> {
  readonly kind = 'main-thread' as const;
  readonly frameEngine: RuntimeFrameEngine;
  readonly foundation: any;
  private disposed = false;
  private hostState: RenderHostState = 'idle';
  private viewportSnapshot: RenderViewportSnapshot | null = null;

  constructor(private readonly options: MainThreadRenderHostOptions<TParameters>) {
    this.frameEngine = new RuntimeFrameEngine({
      updateFrame: frame => options.updateFrame(frame.now, frame.timing),
      executeRenderPipeline: frame => {
        if (options.renderEnabled) options.kernel.render(frame.now, frame.timing);
      },
      publishDiagnostics: () => options.kernel.publishDiagnostics(),
      finalizeFrame: () => options.kernel.finalizeFrame(),
    });

    this.foundation = options.createVisualizerRuntimeFoundation({
      parameters: options.parameters,
      parameterStore: options.parameterStore,
      getViewport: options.getViewport,
      onFrame: (timing: RuntimeFrameTiming) => this.frameEngine.run({ now: timing.now, timing }),
      onResume: (now: number) => {
        this.frameEngine.reset();
        options.kernel.resume(now);
      },
      onCrash: options.onCrash,
      debugLabel: 'ORBITAL MainThreadRenderHost',
      resourceScope: options.resourceScope,
    });
  }

  get state(): RenderHostState {
    return this.disposed ? 'disposed' : this.hostState;
  }

  get isRunning(): boolean {
    return Boolean(this.foundation?.scheduler?.isRunning);
  }

  start(): void {
    if (this.disposed || this.isRunning) return;
    this.foundation.start();
    this.hostState = 'running';
  }

  stop(): void {
    if (this.disposed) return;
    this.foundation.stop();
    this.hostState = 'stopped';
  }

  pause(): void {
    if (this.disposed || !this.isRunning) return;
    this.foundation.stop();
    this.hostState = 'paused';
  }

  resume(now = performance.now()): void {
    if (this.disposed || this.isRunning) return;
    this.frameEngine.reset();
    this.options.kernel.resume(now);
    this.foundation.start();
    this.hostState = 'running';
  }

  updateInput(snapshot: RenderInputSnapshot<TParameters>): void {
    if (this.disposed) return;
    this.options.kernel.updateInput(snapshot);
  }

  resize(viewport: RenderViewportSnapshot): void {
    if (this.disposed) return;
    this.viewportSnapshot = viewport;
  }

  get latestViewportSnapshot(): RenderViewportSnapshot | null {
    return this.viewportSnapshot;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.hostState = 'disposed';
    this.frameEngine.dispose();
    this.options.kernel.dispose();
    this.foundation.dispose();
    runtimeRenderAuthority.clearBpmFrame();
  }
}

export function createMainThreadRenderHost<TParameters extends object = Record<string, unknown>>(
  options: MainThreadRenderHostOptions<TParameters>,
): MainThreadRenderHost<TParameters> {
  return new MainThreadRenderHost(options);
}
