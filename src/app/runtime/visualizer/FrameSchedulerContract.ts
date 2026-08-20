import type { RuntimeFrameTiming } from './VisualizerRuntimeTypes';

export interface FrameSchedulerContract {
  start(): void;
  stop(): void;
  dispose(): void;
  readonly isRunning: boolean;
  readonly currentFrameIndex: number;
  readonly currentCrashCount: number;
}

export interface FrameSchedulerCallbacks {
  onFrame(timing: RuntimeFrameTiming): void;
  onResume?(now: number): void;
  onCrash?(error: unknown, crashCount: number): void;
}
