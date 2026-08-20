export type CoreParticleQualityTier = 'full' | 'balanced' | 'critical';

export interface CoreParticleQualitySnapshot {
  tier: CoreParticleQualityTier;
  p95FrameMs: number;
  p99FrameMs: number;
  drawScale: number;
  pointScale: number;
  estimatedPointArea: number;
  pointAreaBudget: number;
}

const WINDOW_SIZE = 120;
const MAX_BUCKET_MS = 120;
const TIER_LIMITS = {
  full: { drawScale: 1, pointScale: 1, pointAreaBudget: 1_050_000 },
  // Preserve particle density first; reduce expensive blended sprite area more aggressively.
  balanced: { drawScale: 0.90, pointScale: 0.78, pointAreaBudget: 700_000 },
  critical: { drawScale: 0.78, pointScale: 0.62, pointAreaBudget: 430_000 },
} as const;

/** Allocation-free rolling p95/p99 governor with fast downshift and slow recovery. */
export class CoreParticleQualityGovernor {
  private readonly samples = new Uint8Array(WINDOW_SIZE);
  private readonly histogram = new Uint16Array(MAX_BUCKET_MS + 1);
  private index = 0;
  private count = 0;
  private samplesSinceEvaluation = 0;
  private recoveryFrames = 0;
  private tier: CoreParticleQualityTier = 'full';
  private p95FrameMs = 17;
  private p99FrameMs = 17;
  private pressureEvaluations = 0;
  private currentDrawScale = 1;
  private currentPointScale = 1;
  private lastFrameIntervalMs = 16.67;
  private pendingTransitionSeconds = 0;

  update(frameIntervalMs: number): void {
    this.lastFrameIntervalMs = Math.max(0, Number.isFinite(frameIntervalMs) ? frameIntervalMs : 0);
    this.pendingTransitionSeconds += Math.min(0.05, this.lastFrameIntervalMs / 1000);
    const bucket = Math.max(0, Math.min(MAX_BUCKET_MS, Math.round(frameIntervalMs || 0)));
    if (this.count === WINDOW_SIZE) this.histogram[this.samples[this.index]] -= 1;
    else this.count += 1;
    this.samples[this.index] = bucket;
    this.histogram[bucket] += 1;
    this.index = (this.index + 1) % WINDOW_SIZE;

    this.samplesSinceEvaluation += 1;
    if (this.samplesSinceEvaluation < 15 && bucket < 100) return;
    this.samplesSinceEvaluation = 0;
    this.p95FrameMs = this.percentile(0.95);
    this.p99FrameMs = this.percentile(0.99);

    if (bucket >= 100 || this.p99FrameMs > 50) {
      this.tier = 'critical';
      this.pressureEvaluations = 6;
      this.recoveryFrames = 0;
      return;
    }
    if (this.p95FrameMs > 25 || this.p99FrameMs > 34) {
      this.pressureEvaluations += 1;
      if (this.pressureEvaluations >= 3) {
        this.tier =
          this.tier === 'balanced' && this.p99FrameMs > 42 && this.pressureEvaluations >= 6
            ? 'critical'
            : 'balanced';
      }
      this.recoveryFrames = 0;
      return;
    }

    this.pressureEvaluations = Math.max(0, this.pressureEvaluations - 1);
    if (this.p95FrameMs <= 22 && this.p99FrameMs <= 30) this.recoveryFrames += 15;
    else this.recoveryFrames = 0;
    if (this.tier === 'critical' && this.recoveryFrames >= 180) {
      this.tier = 'balanced';
      this.recoveryFrames = 0;
    } else if (this.tier === 'balanced' && this.recoveryFrames >= 300) {
      this.tier = 'full';
      this.recoveryFrames = 0;
    }
  }

  resolve(requestedDrawCount: number, dpr: number): CoreParticleQualitySnapshot {
    const limits = TIER_LIMITS[this.tier];
    const transitionDt = this.pendingTransitionSeconds;
    this.pendingTransitionSeconds = 0;
    const drawRate = limits.drawScale < this.currentDrawScale ? 1.5 : 0.5;
    const drawBlend = 1 - Math.exp(-drawRate * transitionDt);
    this.currentDrawScale += (limits.drawScale - this.currentDrawScale) * drawBlend;
    const drawCount = Math.max(1, requestedDrawCount * this.currentDrawScale);
    const estimatedPointArea = drawCount * Math.pow(20 * Math.max(0.5, dpr), 2);
    const budgetScale = Math.min(1, Math.sqrt(limits.pointAreaBudget / Math.max(1, estimatedPointArea)));
    const targetPointScale = limits.pointScale * budgetScale;
    const pointRate = targetPointScale < this.currentPointScale ? 1.8 : 0.55;
    const pointBlend = 1 - Math.exp(-pointRate * transitionDt);
    this.currentPointScale += (targetPointScale - this.currentPointScale) * pointBlend;
    return {
      tier: this.tier,
      p95FrameMs: this.p95FrameMs,
      p99FrameMs: this.p99FrameMs,
      drawScale: this.currentDrawScale,
      pointScale: this.currentPointScale,
      estimatedPointArea: estimatedPointArea * this.currentPointScale * this.currentPointScale,
      pointAreaBudget: limits.pointAreaBudget,
    };
  }

  reset(): void {
    this.samples.fill(0);
    this.histogram.fill(0);
    this.index = 0;
    this.count = 0;
    this.samplesSinceEvaluation = 0;
    this.recoveryFrames = 0;
    this.tier = 'full';
    this.p95FrameMs = 17;
    this.p99FrameMs = 17;
    this.pressureEvaluations = 0;
    this.currentDrawScale = 1;
    this.currentPointScale = 1;
    this.lastFrameIntervalMs = 16.67;
    this.pendingTransitionSeconds = 0;
  }

  private percentile(fraction: number): number {
    const target = Math.max(1, Math.ceil(this.count * fraction));
    let seen = 0;
    for (let bucket = 0; bucket < this.histogram.length; bucket += 1) {
      seen += this.histogram[bucket];
      if (seen >= target) return bucket;
    }
    return MAX_BUCKET_MS;
  }
}
