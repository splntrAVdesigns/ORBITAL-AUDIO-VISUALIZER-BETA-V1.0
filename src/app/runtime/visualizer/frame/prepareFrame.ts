import type { FrameEngineInput, PreparedFrame } from './FrameEngineTypes';

/** Worker-safe frame preparation. Visibility gating belongs to RuntimeFrameScheduler. */
export function prepareFrame(input: FrameEngineInput): PreparedFrame {
  return { ...input, skipped: false };
}
