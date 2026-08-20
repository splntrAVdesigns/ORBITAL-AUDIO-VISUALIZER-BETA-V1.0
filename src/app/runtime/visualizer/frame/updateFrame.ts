import type { PreparedFrame } from './FrameEngineTypes';

export function updateFrame(frame: PreparedFrame, update: (frame: PreparedFrame) => void): void {
  update(frame);
}
