export interface MotionRotationFrame {
  angle: number;
  rotationAccumulator: number;
  colorWaveRotation: number;
  satBurstWavePhase: number;
  spikeTime: number;
}

export interface MotionRotationUpdateOptions {
  dt: number;
  params: any;
  currentAngle: number;
  lastSyncMode: string;
  rotationAuthority: {
    update(params: any, dt: number): number;
    accumulator: number;
  };
  resetRotationState(mode: string, angle: number): void;
  presetTransitionEngine: { update(params: any, dt: number): void };
}

/** Owns frame-continuous phase accumulators and final rotation authority updates. */
export class MotionRotationRuntime {
  private colorWavePhase = 0;
  private satBurstPhase = 0;
  private spikeTime = 0;
  private readonly frame: MotionRotationFrame = {
    angle: 0,
    rotationAccumulator: 0,
    colorWaveRotation: 0,
    satBurstWavePhase: 0,
    spikeTime: 0,
  };

  seed(phases: { colorWavePhase?: number; satBurstPhase?: number; spikeTime?: number }): void {
    if (typeof phases.colorWavePhase === 'number') this.colorWavePhase = phases.colorWavePhase;
    if (typeof phases.satBurstPhase === 'number') this.satBurstPhase = phases.satBurstPhase;
    if (typeof phases.spikeTime === 'number') this.spikeTime = phases.spikeTime;
  }

  advancePhases(dt: number): MotionRotationFrame {
    this.colorWavePhase += dt * 0.75;
    this.satBurstPhase += dt * 1.5;
    this.spikeTime += dt * 1.5;
    this.frame.colorWaveRotation = this.colorWavePhase;
    this.frame.satBurstWavePhase = this.satBurstPhase % 1;
    this.frame.spikeTime = this.spikeTime;
    return this.frame;
  }

  updateRotation(options: MotionRotationUpdateOptions): MotionRotationFrame {
    const syncMode = (options.params.rotationSyncMode || 'free') as string;
    if (syncMode !== options.lastSyncMode) options.resetRotationState(syncMode, options.currentAngle);
    this.frame.angle = options.rotationAuthority.update(options.params, options.dt);
    this.frame.rotationAccumulator = options.rotationAuthority.accumulator;
    options.presetTransitionEngine.update(options.params, options.dt);
    return this.frame;
  }

  reset(): void {
    this.colorWavePhase = 0;
    this.satBurstPhase = 0;
    this.spikeTime = 0;
    Object.assign(this.frame, {
      angle: 0,
      rotationAccumulator: 0,
      colorWaveRotation: 0,
      satBurstWavePhase: 0,
      spikeTime: 0,
    });
  }
}
