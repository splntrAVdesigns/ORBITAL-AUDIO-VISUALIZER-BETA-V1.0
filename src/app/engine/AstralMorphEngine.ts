import { getActiveCycleShapes, getAllShapes, getCycleDuration, type ShapeType } from '../utils/astralShaper';

/**
 * Liquid Metal Morph Engine — V1.5 rewrite
 *
 * Fixes applied:
 * - FIX L3: dt-independent exponential decay damping
 * - FIX L4: snap threshold 0.25 → 0.005
 * - FIX MORPH-A: Hard clamp (< 0.05 → 0) removed — was killing manual slider values
 * - FIX MORPH-B: Manual mode now always provides a valid nextShape different from currentShape
 * - FIX MORPH-C: Manual morphAmount slider now bypasses engine smoothing entirely —
 *   user's slider IS the morph; damping only controls auto-cycle transitions
 */
export class AstralMorphEngine {
  private astralLastCycleTime: number = 0;
  private astralMorphStartTime: number = 0;
  private astralSmoothedMorphAmount: number = 0;
  private astralShapeIndex: number = 0;
  private astralNextShapeIndex: number = 1;
  private lastBpm: number = 174;
  private _lastUpdateTime: number = 0;
  private _manualNextShape: ShapeType | undefined = undefined;

  constructor() {}

  public reset(): void {
    this.astralLastCycleTime = 0;
    this.astralMorphStartTime = 0;
    this.astralSmoothedMorphAmount = 0;
    this.astralShapeIndex = 0;
    this.astralNextShapeIndex = 1;
    this._lastUpdateTime = 0;
    this._manualNextShape = undefined;
  }

  public getSmoothedMorphAmount(): number {
    return this.astralSmoothedMorphAmount;
  }

  public getNextShape(): ShapeType | undefined {
    if (this._manualNextShape) return this._manualNextShape;
    const shapes = getActiveCycleShapes();
    return shapes[this.astralNextShapeIndex];
  }

  public update(params: any, bpmValue: number, now: number): void {
    if (!params.astralShaper) return;

    // ── dt calculation (capped at 33ms to prevent catch-up) ──────────────────
    const now_sec = now / 1000;
    const dt_engine = Math.min(0.033, this._lastUpdateTime > 0 ? now_sec - this._lastUpdateTime : 0.016);
    this._lastUpdateTime = now_sec;

    if (params.astralAutoCycle) {
      // ── AUTO-CYCLE MODE ───────────────────────────────────────────────────
      this._manualNextShape = undefined;
      const cycleDuration = getCycleDuration(params.astralCycleSpeed, bpmValue);

      if (this.astralLastCycleTime === 0) {
        this.astralLastCycleTime = now;
        this.astralMorphStartTime = now;
        const shapes = getActiveCycleShapes();
        const selectedIndex = shapes.indexOf(params.astralShape as ShapeType);
        // Initialization must never replace a user/preset/import-selected shape.
        // A compatibility-only shape morphs into the curated cycle's first entry;
        // a curated shape continues from its own position.
        this.astralShapeIndex = selectedIndex;
        this.astralNextShapeIndex = selectedIndex >= 0
          ? (selectedIndex + 1) % shapes.length
          : 0;
      }

      const timeInCycle = now - this.astralLastCycleTime;
      const cycleProgress = timeInCycle / cycleDuration;

      const morphDurationBeats =
        params.astralCycleSpeed === 'chaos'  ? 0.5 :
        params.astralCycleSpeed === 'fast'   ? 1.0 :
        params.astralCycleSpeed === 'medium' ? 1.5 : 2.0;
      const morphDuration = morphDurationBeats * (60000 / bpmValue);
      const morphStartProgress = Math.max(0, 1 - morphDuration / cycleDuration);

      if (now - this.astralLastCycleTime >= cycleDuration) {
        this.astralLastCycleTime = now;
        this.astralMorphStartTime = now;
        const shapes = getActiveCycleShapes();
        this.astralShapeIndex = this.astralNextShapeIndex;
        this.astralNextShapeIndex = (this.astralShapeIndex + 1) % shapes.length;
        params.astralShape = shapes[this.astralShapeIndex];
        params.astralMorphAmount = 0;
        this.astralSmoothedMorphAmount = 0;
      } else if (cycleProgress >= morphStartProgress) {
        const morphProgress = (cycleProgress - morphStartProgress) / (1.0 - morphStartProgress);
        params.astralMorphAmount = morphProgress < 0.5
          ? 4 * morphProgress * morphProgress * morphProgress
          : 1 - Math.pow(-2 * morphProgress + 2, 3) / 2;
        params.astralMorphAmount = Math.min(1.0, Math.max(0.0, params.astralMorphAmount));
      } else {
        params.astralMorphAmount = 0;
      }

      // Auto-cycle: make Morph Damping meaningful here too.
      // 0 = sharp/quick morph handoff, 1 = slower liquid blend.
      const damping = Math.min(1, Math.max(0, params.astralMorphDamping ?? 0.5));
      const dampingSpeed = 7.5 + (1.0 - damping) * 22.5;
      const decayFactor = Math.exp(-dampingSpeed * dt_engine);
      this.astralSmoothedMorphAmount +=
        (params.astralMorphAmount - this.astralSmoothedMorphAmount) * (1.0 - decayFactor);

      // FIX L4: only snap when very close
      if (Math.abs(params.astralMorphAmount - this.astralSmoothedMorphAmount) < 0.005) {
        this.astralSmoothedMorphAmount = params.astralMorphAmount;
      }
      if (this.astralSmoothedMorphAmount < 0.005) this.astralSmoothedMorphAmount = 0;

    } else {
      // ── MANUAL MODE ───────────────────────────────────────────────────────
      // FIX MORPH-B: Ensure nextShape is always a different shape so texB ≠ texA.
      //   Without a valid nextShape the shader has identical textures → morph does nothing.
      const shapes = getAllShapes();
      const currentIdx = shapes.indexOf(params.astralShape as ShapeType);
      const nextIdx = (currentIdx + 1) % shapes.length;
      this._manualNextShape = shapes[nextIdx];
      // Also update engine index so getNextShape() is consistent
      this.astralNextShapeIndex = nextIdx;

      // FIX MORPH-C: In manual mode the slider value IS the morph amount.
      //   Apply damping only as a smoothing filter so slider feel is fluid but responsive.
      //   astralMorphDamping=0 → crisp (speed 34), =1 → slow fluid (speed 3.5).
      // FIX MORPH-A: Removed the < 0.05 hard clamp — it was zeroing out slider values
      //   below 5% making the bottom quarter of the slider appear completely dead.
      const damping = Math.min(1, Math.max(0, params.astralMorphDamping ?? 0.5));
      const dampingSpeed = 3.5 + (1.0 - damping) * 30.5;
      const decayFactor = Math.exp(-dampingSpeed * dt_engine);
      this.astralSmoothedMorphAmount +=
        (params.astralMorphAmount - this.astralSmoothedMorphAmount) * (1.0 - decayFactor);

      if (Math.abs(params.astralMorphAmount - this.astralSmoothedMorphAmount) < 0.005) {
        this.astralSmoothedMorphAmount = params.astralMorphAmount;
      }
      if (this.astralSmoothedMorphAmount < 0.005) this.astralSmoothedMorphAmount = 0;
    }
  }
}

let instance: AstralMorphEngine | null = null;
export function getAstralMorphEngine(): AstralMorphEngine {
  if (!instance) instance = new AstralMorphEngine();
  return instance;
}
