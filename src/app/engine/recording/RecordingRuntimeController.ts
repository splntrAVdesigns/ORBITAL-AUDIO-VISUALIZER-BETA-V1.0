export type RecordingCodec = 'vp9' | 'vp8' | 'h264';
export type RecordingQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface RecordingStartOptions {
  resolution: string;
  fps: number;
  duration: number;
  codec: RecordingCodec;
  quality: RecordingQuality;
  videoBitsPerSecond?: number;
}

export type RecordingToggleResult =
  | 'started'
  | 'stopped'
  | 'pending'
  | 'unavailable';

/**
 * Main-thread bridge between React controls/keyboard shortcuts and the
 * runtime-owned RecordingEngine. The engine remains the single owner of
 * MediaRecorder state and recording-library object URLs.
 */
export interface RecordingRuntimeController {
  start(options?: Partial<RecordingStartOptions>): RecordingToggleResult;
  stop(): RecordingToggleResult;
  toggle(): RecordingToggleResult;
  deleteRecording(index: number): boolean;
  clearRecordings(): number;
  isRecording(): boolean;
}
