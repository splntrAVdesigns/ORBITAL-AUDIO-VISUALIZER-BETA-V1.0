import type { RenderInputSnapshot } from './RenderInputSnapshot';
import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';

export interface VisualizerRenderKernelOptions<TParameters extends object = Record<string, unknown>> {
  /** Exact production frame callback. Phase 4.8 moves host authority without rewriting it. */
  executeFrame: (now: number, timing: RuntimeFrameTiming) => void;
  publishDiagnostics: () => void;
  finalizeFrame: () => void;
  onResume: (now: number) => void;
  onDispose?: () => void;
}

/**
 * Renderer-kernel boundary around Orbital's exact production frame callback.
 *
 * Phase 4.8B adds an observable clone-safe input slot for deterministic host
 * parity testing, but the slot does not reinterpret or replace any proven
 * renderer state. The production callback remains the single visual truth.
 */
export class VisualizerRenderKernel<TParameters extends object = Record<string, unknown>> {
  private disposed = false;
  private latestInput: RenderInputSnapshot<TParameters> | null = null;

  constructor(private readonly options: VisualizerRenderKernelOptions<TParameters>) {}

  updateInput(snapshot: RenderInputSnapshot<TParameters>): void {
    if (this.disposed) return;
    this.latestInput = snapshot;
  }

  get inputSnapshot(): RenderInputSnapshot<TParameters> | null {
    return this.latestInput;
  }

  render(now: number, timing: RuntimeFrameTiming): void {
    if (this.disposed) return;
    this.options.executeFrame(now, timing);
  }

  publishDiagnostics(): void {
    if (this.disposed) return;
    this.options.publishDiagnostics();
  }

  finalizeFrame(): void {
    if (this.disposed) return;
    this.options.finalizeFrame();
  }

  resume(now: number): void {
    if (this.disposed) return;
    this.options.onResume(now);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.latestInput = null;
    this.options.onDispose?.();
  }
}

export function createVisualizerRenderKernel<TParameters extends object = Record<string, unknown>>(
  options: VisualizerRenderKernelOptions<TParameters>,
): VisualizerRenderKernel<TParameters> {
  return new VisualizerRenderKernel(options);
}
