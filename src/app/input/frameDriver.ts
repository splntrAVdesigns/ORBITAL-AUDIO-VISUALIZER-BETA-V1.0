import { cancelTrackedInterval, scheduleTrackedInterval } from '../runtime/mainThread/MainThreadAsyncDiagnostics';
import { addFrameInputTap, lastFrameInputTapAt } from '../runtime/visualizer/frameInputTaps';

/**
 * ORBITAL — frame-clock driver for input work (Sprint O5).
 *
 * Primary clock: the visual frame (frame input tap) — runs right before each render.
 * Fallback: a slow tracked interval that only does work when frames have stopped
 * (runtime recovering, no scheduler yet), so glides always finish and pads keep polling.
 */
export interface FrameDriver {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

const MIN_GAP_MS = 4;

export function createFrameDriver(owner: string, work: (now: number) => void, fallbackMs = 50): FrameDriver {
  let removeTap: (() => void) | null = null;
  let fallback: ReturnType<typeof setInterval> | null = null;
  let lastWorkAt = 0;

  const run = (now: number) => {
    if (now - lastWorkAt < MIN_GAP_MS) return; // frame tap and fallback in the same instant
    lastWorkAt = now;
    work(now);
  };

  return {
    start() {
      if (removeTap) return;
      removeTap = addFrameInputTap(run);
      fallback = scheduleTrackedInterval(`${owner}-fallback`, () => {
        const now = performance.now();
        if (now - lastFrameInputTapAt() > fallbackMs * 1.5) run(now);
      }, fallbackMs);
    },
    stop() {
      removeTap?.(); removeTap = null;
      cancelTrackedInterval(fallback); fallback = null;
    },
    get running() { return removeTap !== null; },
  };
}
