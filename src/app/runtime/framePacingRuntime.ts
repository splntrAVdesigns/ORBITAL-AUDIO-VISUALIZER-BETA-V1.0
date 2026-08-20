import { DEVELOPMENT_DIAGNOSTICS_ENABLED, FIELD_CERTIFICATION_ENABLED } from '../config/runtimeEnvironment';

export interface FramePacingSnapshot {
  frameInterval: number;
  avgFrameInterval: number;
  worstFrameInterval: number;
  jitter: number;
  droppedFrames: number;
  longFrames: number;
  rafDrift: number;
  p95FrameInterval: number;
  p99FrameInterval: number;
  qualityTier: 'full' | 'balanced' | 'critical';
  qualityScale: number;
}

const PACING_WINDOW = 180;
const MAX_INTERVAL_BUCKET = 120;

export class FramePacingRuntime {
  private lastT = 0;
  private avg = 16.67;
  private worst = 16.67;
  private dropped = 0;
  private long = 0;
  private jitterAvg = 0;
  private lastPublish = 0;
  private readonly samples = new Uint8Array(PACING_WINDOW);
  private readonly histogram = new Uint16Array(MAX_INTERVAL_BUCKET + 1);
  private sampleIndex = 0;
  private sampleCount = 0;
  private evaluationCountdown = 15;
  private recoveryFrames = 0;
  private pressureEvaluations = 0;
  private qualityTarget = 1;
  readonly snapshot: FramePacingSnapshot = {
    frameInterval: 16.67,
    avgFrameInterval: 16.67,
    worstFrameInterval: 16.67,
    jitter: 0,
    droppedFrames: 0,
    longFrames: 0,
    rafDrift: 0,
    p95FrameInterval: 16.67,
    p99FrameInterval: 16.67,
    qualityTier: 'full',
    qualityScale: 1,
  };

  reset(t = performance.now()) {
    this.lastT = t;
    this.avg = 16.67;
    this.worst = 16.67;
    this.jitterAvg = 0;
    this.samples.fill(0);
    this.histogram.fill(0);
    this.sampleIndex = 0;
    this.sampleCount = 0;
    this.evaluationCountdown = 15;
    this.recoveryFrames = 0;
    this.pressureEvaluations = 0;
    this.qualityTarget = 1;
    this.snapshot.frameInterval = 16.67;
    this.snapshot.avgFrameInterval = 16.67;
    this.snapshot.worstFrameInterval = 16.67;
    this.snapshot.jitter = 0;
    this.snapshot.rafDrift = 0;
    this.snapshot.p95FrameInterval = 16.67;
    this.snapshot.p99FrameInterval = 16.67;
    this.snapshot.qualityTier = 'full';
    this.snapshot.qualityScale = 1;
  }

  tick(t: number) {
    if (!this.lastT) {
      this.reset(t);
      return this.snapshot;
    }
    const interval = Math.max(0, t - this.lastT);
    this.lastT = t;
    const drift = interval - 16.67;
    this.avg += (interval - this.avg) * 0.08;
    this.worst = Math.max(interval, this.worst * 0.985);
    this.jitterAvg += (Math.abs(drift) - this.jitterAvg) * 0.10;
    if (interval > 24) this.long++;
    if (interval > 34) this.dropped += Math.max(1, Math.round(interval / 16.67) - 1);
    const bucket = Math.max(0, Math.min(MAX_INTERVAL_BUCKET, Math.round(interval)));
    if (this.sampleCount === PACING_WINDOW) this.histogram[this.samples[this.sampleIndex]] -= 1;
    else this.sampleCount += 1;
    this.samples[this.sampleIndex] = bucket;
    this.histogram[bucket] += 1;
    this.sampleIndex = (this.sampleIndex + 1) % PACING_WINDOW;

    this.evaluationCountdown -= 1;
    if (this.evaluationCountdown <= 0 || interval >= 100) {
      this.evaluationCountdown = 15;
      this.snapshot.p95FrameInterval = this.percentile(0.95);
      this.snapshot.p99FrameInterval = this.percentile(0.99);
      this.updateQuality(interval);
    }
    const transitionDt = Math.min(0.05, Math.max(0, interval) / 1000);
    const transitionRate = this.qualityTarget < this.snapshot.qualityScale ? 1.4 : 0.45;
    const transitionBlend = 1 - Math.exp(-transitionRate * transitionDt);
    this.snapshot.qualityScale +=
      (this.qualityTarget - this.snapshot.qualityScale) * transitionBlend;
    this.snapshot.frameInterval = interval;
    this.snapshot.avgFrameInterval = this.avg;
    this.snapshot.worstFrameInterval = this.worst;
    this.snapshot.jitter = this.jitterAvg;
    this.snapshot.droppedFrames = this.dropped;
    this.snapshot.longFrames = this.long;
    this.snapshot.rafDrift = drift;
    if ((DEVELOPMENT_DIAGNOSTICS_ENABLED || FIELD_CERTIFICATION_ENABLED) && t - this.lastPublish > 250) {
      this.lastPublish = t;
      (window as any).__ORBITAL_FRAME_PACING__ = this.snapshot;
    }
    return this.snapshot;
  }

  private percentile(fraction: number): number {
    const target = Math.max(1, Math.ceil(this.sampleCount * fraction));
    let seen = 0;
    for (let bucket = 0; bucket < this.histogram.length; bucket += 1) {
      seen += this.histogram[bucket];
      if (seen >= target) return bucket;
    }
    return MAX_INTERVAL_BUCKET;
  }

  private updateQuality(interval: number): void {
    const p95 = this.snapshot.p95FrameInterval;
    const p99 = this.snapshot.p99FrameInterval;
    if (interval >= 100) {
      this.snapshot.qualityTier = 'critical';
      this.pressureEvaluations = 6;
      this.recoveryFrames = 0;
    } else if (p99 > 50) {
      this.pressureEvaluations += 2;
      if (this.pressureEvaluations >= 4) this.snapshot.qualityTier = 'critical';
      else if (this.pressureEvaluations >= 2) this.snapshot.qualityTier = 'balanced';
      this.recoveryFrames = 0;
    } else if (p95 > 25 || p99 > 34) {
      this.pressureEvaluations += 1;
      if (this.pressureEvaluations >= 3) {
        this.snapshot.qualityTier =
          this.snapshot.qualityTier === 'balanced' && p99 > 42 && this.pressureEvaluations >= 6
            ? 'critical'
            : 'balanced';
      }
      this.recoveryFrames = 0;
    } else {
      this.pressureEvaluations = Math.max(0, this.pressureEvaluations - 1);
      this.recoveryFrames = p95 <= 22 && p99 <= 30 ? this.recoveryFrames + 15 : 0;
      if (this.snapshot.qualityTier === 'critical' && this.recoveryFrames >= 240) {
        this.snapshot.qualityTier = 'balanced';
        this.recoveryFrames = 0;
      } else if (this.snapshot.qualityTier === 'balanced' && this.recoveryFrames >= 480) {
        this.snapshot.qualityTier = 'full';
        this.recoveryFrames = 0;
      }
    }
    this.qualityTarget =
      this.snapshot.qualityTier === 'full'
        ? 1
        : this.snapshot.qualityTier === 'balanced'
          ? 0.82
          : 0.64;
  }
}
