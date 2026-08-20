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

export class RuntimeClock {
  private last = 0;
  private frameIndex = 0;
  constructor(private readonly maxDt = 1 / 45) {}

  start(now = performance.now()) {
    this.last = now;
    this.frameIndex = 0;
  }

  tick(now: number): RuntimeFrame {
    if (!this.last) this.start(now);
    const rawDt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    const dt = Math.min(rawDt, this.maxDt);
    this.frameIndex += 1;
    return { now, dt, rawDt, clamped: rawDt > this.maxDt, frame: this.frameIndex };
  }
}