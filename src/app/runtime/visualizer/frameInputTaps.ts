/**
 * ORBITAL — frame input taps (Sprint O5).
 *
 * Controller input (gamepad polling, macro glides) must run on the same clock as the
 * visuals. Measured headless: a 16 ms setInterval fired only ~3×/s while animation frames
 * kept running, because the browser schedules rendering ahead of timers on a busy main
 * thread. A short gamepad tap could then fall entirely between two polls.
 *
 * RuntimeFrameScheduler (the only RAF authority) calls runFrameInputTaps() at the start of
 * every frame, BEFORE the frame pipeline, so input sampled this frame renders this frame.
 * Each tap is isolated: a throwing tap is logged and skipped, never routed into the
 * scheduler's crash recovery.
 */
export type FrameInputTap = (now: number) => void;

const taps = new Set<FrameInputTap>();
let lastRunAt = 0;

export function addFrameInputTap(tap: FrameInputTap): () => void {
  taps.add(tap);
  return () => { taps.delete(tap); };
}

export function runFrameInputTaps(now: number): void {
  lastRunAt = now;
  if (!taps.size) return;
  for (const tap of taps) {
    try { tap(now); } catch (error) { console.warn('[ORBITAL] frame input tap failed', error); }
  }
}

/** performance.now() of the last frame that ran taps (0 if none yet). */
export function lastFrameInputTapAt(): number { return lastRunAt; }

export function frameInputTapCount(): number { return taps.size; }
