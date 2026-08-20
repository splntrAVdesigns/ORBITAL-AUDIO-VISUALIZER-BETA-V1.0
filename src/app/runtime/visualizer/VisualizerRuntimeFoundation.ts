import { createRuntimeParameterStore, type RuntimeParameterStore } from '../parameters/RuntimeParameterStore';
import { createSharedFrameContext, type SharedFrameContext } from './FrameContext';
import { RendererResourceRegistry } from './RendererResourceRegistry';
import { RuntimeFrameScheduler } from './RuntimeFrameScheduler';
import type { RuntimeDiagnosticsSnapshot, RuntimeFoundationOptions, RuntimePlaybackState } from './VisualizerRuntimeTypes';

/**
 * Sprint 22N.A runtime shell. It owns scheduling, shared state, resources and disposal,
 * while the legacy render callback remains the temporary frame implementation.
 */
export class VisualizerRuntimeFoundation<TParameters extends object> {
  readonly parameters: RuntimeParameterStore<TParameters>;
  readonly resources = new RendererResourceRegistry();
  readonly frame: SharedFrameContext<TParameters>;
  readonly scheduler: RuntimeFrameScheduler;

  private disposed = false;
  private lastCrashAt = 0;
  private lastCrashMessage: string | null = null;

  constructor(private readonly options: RuntimeFoundationOptions<TParameters>) {
    this.parameters = (options as RuntimeFoundationOptions<TParameters> & { parameterStore?: RuntimeParameterStore<TParameters> }).parameterStore ?? createRuntimeParameterStore(options.parameters);
    this.frame = createSharedFrameContext(this.parameters, this.resources);
    this.scheduler = new RuntimeFrameScheduler({
      debugLabel: options.debugLabel,
      resourceScope: options.resourceScope,
      onFrame: (timing) => {
        this.frame.timing = timing;
        this.frame.viewport = options.getViewport?.() ?? null;
        this.frame.parameters = this.parameters.current;
        this.frame.parameterRevision = this.parameters.version;
        options.onFrame(timing);
      },
      onResume: options.onResume,
      onCrash: (error, crashCount) => {
        this.lastCrashAt = performance.now();
        this.lastCrashMessage = error instanceof Error ? error.message : String(error);
        options.onCrash?.(error, crashCount);
      },
    });
  }

  start(): void { this.scheduler.start(); }
  stop(): void { this.scheduler.stop(); }

  setPlaybackState(next: RuntimePlaybackState): void {
    this.frame.playback.playing = next.playing;
    this.frame.playback.source = next.source;
  }

  addDisposer(disposer: () => void): void {
    this.resources.addDisposer(disposer);
  }

  getDiagnostics(): RuntimeDiagnosticsSnapshot {
    return {
      running: this.scheduler.isRunning,
      frameIndex: this.scheduler.currentFrameIndex,
      crashCount: this.scheduler.currentCrashCount,
      lastCrashAt: this.lastCrashAt,
      lastCrashMessage: this.lastCrashMessage,
      resourceCount: this.resources.resourceCount,
      disposableCount: this.resources.disposableCount,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scheduler.dispose();
    this.parameters.dispose();
    this.resources.dispose();
  }
}

export function createVisualizerRuntimeFoundation<TParameters extends object>(
  options: RuntimeFoundationOptions<TParameters>,
): VisualizerRuntimeFoundation<TParameters> {
  return new VisualizerRuntimeFoundation(options);
}
