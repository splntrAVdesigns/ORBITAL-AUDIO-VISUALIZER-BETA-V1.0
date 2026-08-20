import type { ViewportState } from '../ViewportState';
import type { RuntimeResourceScope } from './session/RuntimeResourceDiagnostics';
import type { RuntimeParameterStore } from '../parameters/RuntimeParameterStore';

export interface RuntimeFrameTiming {
  now: number;
  deltaMs: number;
  deltaSeconds: number;
  frameIndex: number;
  resumed: boolean;
}

export interface RuntimeDiagnosticsSnapshot {
  running: boolean;
  frameIndex: number;
  crashCount: number;
  lastCrashAt: number;
  lastCrashMessage: string | null;
  resourceCount: number;
  disposableCount: number;
}

export interface RuntimePlaybackState {
  playing: boolean;
  source: 'idle' | 'microphone' | 'media';
}

export interface RuntimeFoundationOptions<TParameters extends object> {
  parameters: TParameters;
  parameterStore?: RuntimeParameterStore<TParameters>;
  getViewport?: () => ViewportState | null;
  onFrame: (timing: RuntimeFrameTiming) => void;
  onResume?: (now: number) => void;
  onCrash?: (error: unknown, crashCount: number) => void;
  debugLabel?: string;
  resourceScope?: RuntimeResourceScope;
}
