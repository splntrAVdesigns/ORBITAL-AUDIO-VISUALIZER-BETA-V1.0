/**
 * ORBITAL Sprint 21 — RuntimeClock
 * Single RAF timing authority used to prevent catch-up jumps after GC/UI stalls.
 */
export interface RuntimeFrame {
  now: number;
  dt: number;
  rawDt: number;
  clamped: boolean;
  frame: number;
}

/**
 * Sprint D: two-tier motion timing.
 * - Frames up to MOTION_STALL_THRESHOLD_S keep their real duration, so motion
 *   speed stays constant when a heavy scene runs at 25-45 fps. (The previous
 *   22 ms cap discarded time on every slower frame, which read as rotation
 *   stutter, a brief hang, then an apparent catch-up.)
 * - Anything longer is a stall (tab switch, GC, blocking UI work) and advances
 *   by one nominal 60 fps frame, so a stall never becomes a visible jump.
 */
export const MOTION_STALL_THRESHOLD_S = 1 / 20;
export const MOTION_STALL_RESUME_S = 1 / 60;

export function normalizeMotionDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return deltaSeconds > MOTION_STALL_THRESHOLD_S ? MOTION_STALL_RESUME_S : deltaSeconds;
}

export class RuntimeClock {
  private last = 0;
  private frameIndex = 0;
  constructor(private readonly maxDt = MOTION_STALL_THRESHOLD_S) {}

  start(now = performance.now()) {
    this.last = now;
    this.frameIndex = 0;
  }

  tick(now: number): RuntimeFrame {
    if (!this.last) this.start(now);
    const rawDt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    const dt = rawDt > this.maxDt ? MOTION_STALL_RESUME_S : rawDt;
    this.frameIndex += 1;
    return { now, dt, rawDt, clamped: rawDt > this.maxDt, frame: this.frameIndex };
  }
}