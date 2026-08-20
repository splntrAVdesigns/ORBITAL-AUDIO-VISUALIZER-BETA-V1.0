import type { PreparedFrame } from './FrameEngineTypes';

export function publishFrameDiagnostics(
  frame: PreparedFrame,
  publish?: (frame: PreparedFrame) => void,
): void {
  publish?.(frame);
}
