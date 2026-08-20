export interface SchedulerMotionPhaseFrame {
  deltaSeconds: number;
  timeSeconds: number;
}

/** One clamped scheduler phase shared by rotation, Auto Zoom, Comet, and Orbital Energy. */
export class SchedulerMotionPhaseRuntime {
  private timeSeconds = 0;
  private readonly frame: SchedulerMotionPhaseFrame = {
    deltaSeconds: 0,
    timeSeconds: 0,
  };

  advance(deltaSeconds: number): Readonly<SchedulerMotionPhaseFrame> {
    const safeDelta = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(1 / 45, deltaSeconds))
      : 0;
    this.timeSeconds += safeDelta;
    this.frame.deltaSeconds = safeDelta;
    this.frame.timeSeconds = this.timeSeconds;
    return this.frame;
  }

  reset(): void {
    this.timeSeconds = 0;
    this.frame.deltaSeconds = 0;
    this.frame.timeSeconds = 0;
  }
}
