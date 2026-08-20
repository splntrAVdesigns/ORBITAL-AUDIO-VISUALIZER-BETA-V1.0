import type {
  RecordingRuntimeController,
  RecordingStartOptions,
  RecordingToggleResult,
} from './RecordingRuntimeController';

interface RecordingEnginePort {
  requestStart(options?: Partial<RecordingStartOptions>): RecordingToggleResult;
  stop(): boolean;
  toggle(): RecordingToggleResult;
  deleteRecording(index: number): boolean;
  clearRecordings(): number;
  isRecording(): boolean;
}

interface RecordingControllerRef {
  current: RecordingRuntimeController | null;
}

export function installRecordingRuntimeController(
  ref: RecordingControllerRef,
  engine: RecordingEnginePort,
): () => void {
  const controller: RecordingRuntimeController = {
    start: (options) => engine.requestStart(options),
    stop: () => engine.stop() ? 'stopped' : 'unavailable',
    toggle: () => engine.toggle(),
    deleteRecording: (index) => engine.deleteRecording(index),
    clearRecordings: () => engine.clearRecordings(),
    isRecording: () => engine.isRecording(),
  };
  ref.current = controller;
  return () => {
    if (ref.current === controller) ref.current = null;
  };
}
