export interface AutoZoomMotionFrame {
  spike: number;
  center: number;
  dots: number;
  halo: number;
  cyclePhase: number;
  smoothedEnergy: number;
}

const TAU = Math.PI * 2;
const PULSES_PER_CYCLE = 5;
const MAX_PHASE_CORRECTION_PER_SECOND = 0.18;
const ZOOM_RATE_PER_SECOND = 0.48;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

function shortestCycleError(target: number, current: number): number {
  let error = wrap01(target) - wrap01(current);
  if (error > 0.5) error -= 1;
  if (error < -0.5) error += 1;
  return error;
}

function approach(current: number, target: number, maxDelta: number): number {
  return current + clamp(target - current, -maxDelta, maxDelta);
}

function pulseAt(cyclePhase: number, offset: number): number {
  return Math.sin((cyclePhase * PULSES_PER_CYCLE + offset) * TAU) * 0.5 + 0.5;
}

/**
 * Scheduler-owned Auto Zoom phase/envelope authority.
 *
 * The phase advances only from the clamped runtime delta. BPM-clock drift is
 * corrected gradually, so a long main-thread frame cannot snap zoom ahead of
 * rotation. The reusable output frame keeps the render path allocation-free.
 */
export class AutoZoomMotionRuntime {
  private cyclePhase = 0;
  private smoothedEnergy = 0;
  private lastBarPhase = 0;
  private barIndex = 0;
  private initializedBarPhase = false;
  private readonly frame: AutoZoomMotionFrame = {
    spike: 1,
    center: 1,
    dots: 1,
    halo: 1,
    cyclePhase: 0,
    smoothedEnergy: 0,
  };

  update(
    enabled: boolean,
    audioReady: boolean,
    deltaSeconds: number,
    bpmValue: number,
    barsValue: number,
    barPhaseValue: number,
    energyValue: number,
  ): Readonly<AutoZoomMotionFrame> {
    const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 1 / 30);
    const bpm = clamp(Number.isFinite(bpmValue) ? bpmValue : 174, 40, 220);
    const bars = Math.max(1, Math.min(32, Math.round(barsValue || 8)));
    const barPhase = wrap01(Number.isFinite(barPhaseValue) ? barPhaseValue : 0);

    if (!this.initializedBarPhase) {
      this.lastBarPhase = barPhase;
      this.initializedBarPhase = true;
    } else if (barPhase + 0.5 < this.lastBarPhase) {
      this.barIndex = (this.barIndex + 1) % bars;
    }
    this.lastBarPhase = barPhase;

    const energyTarget = clamp(Number.isFinite(energyValue) ? energyValue : 0, 0, 1);
    const envelopeRate = energyTarget > this.smoothedEnergy ? 10 : 3.8;
    const envelopeBlend = 1 - Math.exp(-envelopeRate * dt);
    this.smoothedEnergy += (energyTarget - this.smoothedEnergy) * envelopeBlend;

    if (!enabled || !audioReady) {
      const neutralDelta = ZOOM_RATE_PER_SECOND * dt;
      this.frame.spike = approach(this.frame.spike, 1, neutralDelta);
      this.frame.center = approach(this.frame.center, 1, neutralDelta);
      this.frame.dots = approach(this.frame.dots, 1, neutralDelta);
      this.frame.halo = approach(this.frame.halo, 1, neutralDelta);
      this.frame.cyclePhase = this.cyclePhase;
      this.frame.smoothedEnergy = this.smoothedEnergy;
      return this.frame;
    }

    const fullCycleSeconds = (60 / bpm) * 4 * bars;
    this.cyclePhase = wrap01(this.cyclePhase + dt / Math.max(0.25, fullCycleSeconds));

    const targetPhase = wrap01(((this.barIndex % bars) + barPhase) / bars);
    const phaseError = shortestCycleError(targetPhase, this.cyclePhase);
    const requestedCorrection = phaseError * 0.8 * dt;
    const maxCorrection = MAX_PHASE_CORRECTION_PER_SECOND * dt;
    this.cyclePhase = wrap01(
      this.cyclePhase + clamp(requestedCorrection, -maxCorrection, maxCorrection),
    );

    const energy = this.smoothedEnergy;
    const spikeTarget = 0.90 + (pulseAt(this.cyclePhase, 0) * 0.65 + energy * 0.35) * 0.20;
    const centerTarget = 0.90 + (pulseAt(this.cyclePhase, 0.10) * 0.65 + energy * 0.35) * 0.18;
    const dotsTarget = 0.91 + (pulseAt(this.cyclePhase, -0.08) * 0.65 + energy * 0.35) * 0.18;
    const haloTarget = 0.92 + (pulseAt(this.cyclePhase, -0.15) * 0.65 + energy * 0.35) * 0.16;
    const maxZoomDelta = ZOOM_RATE_PER_SECOND * dt;

    this.frame.spike = approach(this.frame.spike, spikeTarget, maxZoomDelta);
    this.frame.center = approach(this.frame.center, centerTarget, maxZoomDelta);
    this.frame.dots = approach(this.frame.dots, dotsTarget, maxZoomDelta);
    this.frame.halo = approach(this.frame.halo, haloTarget, maxZoomDelta);
    this.frame.cyclePhase = this.cyclePhase;
    this.frame.smoothedEnergy = this.smoothedEnergy;
    return this.frame;
  }

  reset(): void {
    this.cyclePhase = 0;
    this.smoothedEnergy = 0;
    this.lastBarPhase = 0;
    this.barIndex = 0;
    this.initializedBarPhase = false;
    this.frame.spike = 1;
    this.frame.center = 1;
    this.frame.dots = 1;
    this.frame.halo = 1;
    this.frame.cyclePhase = 0;
    this.frame.smoothedEnergy = 0;
  }
}
