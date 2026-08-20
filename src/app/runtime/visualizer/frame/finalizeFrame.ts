import type { PreparedFrame } from './FrameEngineTypes';

export function finalizeFrame(
  frame: PreparedFrame,
  error: unknown | null,
  finalize?: (frame: PreparedFrame, error: unknown | null) => void,
): void {
  finalize?.(frame, error);
}
