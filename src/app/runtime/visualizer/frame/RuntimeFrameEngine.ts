import { executeRenderPipeline } from './executeRenderPipeline';
import { finalizeFrame } from './finalizeFrame';
import type { FrameEngineCallbacks, FrameEngineInput, PreparedFrame } from './FrameEngineTypes';
import { prepareFrame as defaultPrepareFrame } from './prepareFrame';
import { publishFrameDiagnostics } from './publishFrameDiagnostics';
import { updateFrame } from './updateFrame';

/**
 * Allocation-light frame orchestrator. It owns phase order and error/finalization
 * semantics while renderer behavior remains supplied by runtime-owned callbacks.
 */
export class RuntimeFrameEngine {
  private readonly callbacks: FrameEngineCallbacks;
  private running = false;
  private disposed = false;

  constructor(callbacks: FrameEngineCallbacks) {
    this.callbacks = callbacks;
  }

  run(input: FrameEngineInput): void {
    if (this.disposed || this.running) return;

    const frame: PreparedFrame = this.callbacks.prepareFrame
      ? this.callbacks.prepareFrame(input)
      : defaultPrepareFrame(input);
    if (frame.skipped) return;

    this.running = true;
    let failure: unknown | null = null;
    try {
      updateFrame(frame, this.callbacks.updateFrame);
      executeRenderPipeline(frame, this.callbacks.executeRenderPipeline);
      publishFrameDiagnostics(frame, this.callbacks.publishDiagnostics);
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      finalizeFrame(frame, failure, this.callbacks.finalizeFrame);
      this.running = false;
    }
  }

  reset(): void {
    this.running = false;
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
  }
}
