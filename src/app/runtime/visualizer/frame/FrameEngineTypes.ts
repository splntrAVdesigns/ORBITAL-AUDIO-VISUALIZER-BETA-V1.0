import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';

export interface FrameEngineInput {
  now: number;
  timing: RuntimeFrameTiming;
}

export interface PreparedFrame extends FrameEngineInput {
  skipped: boolean;
  skipReason?: 'scheduler-paused' | string;
}

export interface FrameEngineCallbacks {
  prepareFrame?: (input: FrameEngineInput) => PreparedFrame;
  updateFrame: (frame: PreparedFrame) => void;
  executeRenderPipeline?: (frame: PreparedFrame) => void;
  publishDiagnostics?: (frame: PreparedFrame) => void;
  finalizeFrame?: (frame: PreparedFrame, error: unknown | null) => void;
}
