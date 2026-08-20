export interface ResettableMotionRuntime {
  reset(): void;
}

export interface ProductionMotionStateRuntimeOptions {
  createRotationAuthority: () => Record<string, any>;
  createFramePacingRuntime: () => Record<string, any>;
  createMotionRotationRuntime: () => ResettableMotionRuntime & Record<string, any>;
  createSchedulerMotionPhaseRuntime: () => ResettableMotionRuntime & Record<string, any>;
  createAutoZoomMotionRuntime: () => ResettableMotionRuntime & Record<string, any>;
  initialRotation: number;
  initialSyncMode?: string;
}

/**
 * Phase 4.8H.2 motion-state owner.
 *
 * Consolidates the continuously-mutated motion/rotation state that previously
 * lived as unrelated closure variables inside createVisualizerRuntimeSession.
 * No integration constants or easing formulas are changed here.
 */
export class ProductionMotionStateRuntime {
  readonly rotationAuthority: Record<string, any>;
  readonly framePacingRuntime: Record<string, any>;
  readonly motionRotationRuntime: ResettableMotionRuntime & Record<string, any>;
  readonly schedulerMotionPhaseRuntime: ResettableMotionRuntime & Record<string, any>;
  readonly autoZoomMotionRuntime: ResettableMotionRuntime & Record<string, any>;

  rotationSyncAccumulator = 0;
  lastRotationSnapTime = 0;
  lastSyncMode: string;
  wasFreeRotating: boolean;
  chaosSegmentEase = 0;
  zoomOscPhase = 0;
  spikeTimeAcc = 0;
  private macro2RotationTween = { active: false, from: 0, to: 0, startedAt: 0, durationMs: 360 };

  constructor(options: ProductionMotionStateRuntimeOptions) {
    this.rotationAuthority = options.createRotationAuthority();
    this.framePacingRuntime = options.createFramePacingRuntime();
    this.motionRotationRuntime = options.createMotionRotationRuntime();
    this.schedulerMotionPhaseRuntime = options.createSchedulerMotionPhaseRuntime();
    this.autoZoomMotionRuntime = options.createAutoZoomMotionRuntime();
    this.lastSyncMode = options.initialSyncMode ?? 'free';
    this.wasFreeRotating = Math.abs(options.initialRotation) > 0.001;
  }


  startMacro2RotationCommit(from: number, to: number, now = performance.now(), durationMs = 360): void {
    const safeFrom = Number.isFinite(from) ? from : 0;
    const safeTo = Number.isFinite(to) ? to : safeFrom;
    this.macro2RotationTween.active = Math.abs(safeTo - safeFrom) > 0.0001;
    this.macro2RotationTween.from = safeFrom;
    this.macro2RotationTween.to = safeTo;
    this.macro2RotationTween.startedAt = now;
    this.macro2RotationTween.durationMs = Math.max(80, durationMs);
  }

  updateMacro2RotationCommit(now: number, params: Record<string, any>): boolean {
    const tween = this.macro2RotationTween;
    if (!tween.active) return false;
    const progress = Math.max(0, Math.min(1, (now - tween.startedAt) / tween.durationMs));
    // Smoothstep avoids both a hard velocity change on release and the long tail of
    // the previous catch-up feel. The authoritative frame clock owns every step.
    const eased = progress * progress * (3 - 2 * progress);
    params.rotation = tween.from + (tween.to - tween.from) * eased;
    if (progress >= 1) {
      params.rotation = tween.to;
      tween.active = false;
    }
    return tween.active;
  }

  cancelMacro2RotationCommit(): void {
    this.macro2RotationTween.active = false;
  }

  reset(): void {
    this.motionRotationRuntime.reset();
    this.schedulerMotionPhaseRuntime.reset();
    this.autoZoomMotionRuntime.reset();
    this.rotationSyncAccumulator = 0;
    this.lastRotationSnapTime = 0;
    this.lastSyncMode = 'free';
    this.chaosSegmentEase = 0;
    this.zoomOscPhase = 0;
    this.spikeTimeAcc = 0;
    this.wasFreeRotating = false;
    this.cancelMacro2RotationCommit();
  }
}

export function createProductionMotionStateRuntime(
  options: ProductionMotionStateRuntimeOptions,
): ProductionMotionStateRuntime {
  return new ProductionMotionStateRuntime(options);
}
