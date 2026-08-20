export interface EnvelopeFollowerOptions {
  attackMs: number;
  releaseMs: number;
  initial?: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export class EnvelopeFollower {
  private value: number;
  private attackMs: number;
  private releaseMs: number;

  constructor(options: EnvelopeFollowerOptions) {
    this.attackMs = Math.max(1, options.attackMs);
    this.releaseMs = Math.max(1, options.releaseMs);
    this.value = clamp01(options.initial ?? 0);
  }

  setTiming(attackMs: number, releaseMs: number) {
    this.attackMs = Math.max(1, attackMs);
    this.releaseMs = Math.max(1, releaseMs);
  }

  update(target: number, dtSec: number) {
    const safeDt = Math.max(0.001, Math.min(0.1, Number.isFinite(dtSec) ? dtSec : 1 / 60));
    const safeTarget = clamp01(target);
    const timeMs = safeTarget > this.value ? this.attackMs : this.releaseMs;
    const coefficient = 1 - Math.exp((-safeDt * 1000) / timeMs);
    this.value += (safeTarget - this.value) * coefficient;

    // Small snap-to-target deadband prevents tiny residual values from visually sticking.
    if (Math.abs(this.value - safeTarget) < 0.002) this.value = safeTarget;
    this.value = clamp01(this.value);
    return this.value;
  }

  get current() {
    return this.value;
  }

  reset(value = 0) {
    this.value = clamp01(value);
  }
}