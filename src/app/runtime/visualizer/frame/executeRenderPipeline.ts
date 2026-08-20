import type { PreparedFrame } from './FrameEngineTypes';

export function executeRenderPipeline(
  frame: PreparedFrame,
  execute?: (frame: PreparedFrame) => void,
): void {
  execute?.(frame);
}
