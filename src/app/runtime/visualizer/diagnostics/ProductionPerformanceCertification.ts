import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';
import type { FramePhaseCosts } from '../../renderFrameRuntime';

export type CertificationInteractionState = 'idle' | 'scrolling' | 'dragging' | 'resizing' | 'tab-switch';

type MetricSummary = {
  samples: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maximumMs: number;
};

type CertificationGate = {
  pass: boolean | null;
  value: number | null;
  threshold: number;
  samples: number;
  note: string;
};

class MetricRing {
  private readonly values: Float64Array;
  private writeIndex = 0;
  private totalCount = 0;

  constructor(private readonly capacity = 900) {
    this.values = new Float64Array(capacity);
  }

  push(value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.values[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.totalCount += 1;
  }

  clear(): void {
    this.values.fill(0);
    this.writeIndex = 0;
    this.totalCount = 0;
  }

  summary(): MetricSummary {
    const count = Math.min(this.totalCount, this.capacity);
    if (count <= 0) {
      return { samples: 0, averageMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maximumMs: 0 };
    }
    const list = new Array<number>(count);
    const start = this.totalCount > this.capacity ? this.writeIndex : 0;
    let total = 0;
    let maximum = 0;
    for (let i = 0; i < count; i += 1) {
      const value = this.values[(start + i) % this.capacity];
      list[i] = value;
      total += value;
      maximum = Math.max(maximum, value);
    }
    list.sort((a, b) => a - b);
    const percentile = (ratio: number) => list[Math.min(count - 1, Math.max(0, Math.ceil(count * ratio) - 1))] || 0;
    return {
      samples: count,
      averageMs: total / count,
      p50Ms: percentile(0.50),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      maximumMs: maximum,
    };
  }
}

export interface ProductionPerformanceCertificationOptions {
  getInteractionState: () => CertificationInteractionState;
  getFrameCosts: () => FramePhaseCosts;
  now?: () => number;
}

/**
 * Phase 4.8H.5 — observational certification only.
 *
 * This runtime never changes renderer parameters, scheduler cadence, quality,
 * motion state, UI state, or control behavior. It is dormant until explicitly
 * started and records bounded fixed-size timing samples while active.
 */
export class ProductionPerformanceCertification {
  private readonly now: () => number;
  private active = false;
  private label = 'manual';
  private startedAt = 0;
  private stoppedAt = 0;
  private frameCount = 0;
  private lastFrameAt = 0;
  private phaseStartedAt = 0;
  private scrollActiveUntil = 0;
  private macro2Dragging = false;
  private previousRenderCostDebug: unknown;
  private publishTimer = 0;

  private readonly frameIntervals = new MetricRing();
  private readonly idleIntervals = new MetricRing();
  private readonly scrollIntervals = new MetricRing();
  private readonly dragIntervals = new MetricRing();
  private readonly macro2Intervals = new MetricRing();
  private readonly prepareCosts = new MetricRing();
  private readonly renderCosts = new MetricRing();
  private readonly recordingCosts = new MetricRing();
  private readonly diagnosticsCosts = new MetricRing();
  private readonly finalizeCosts = new MetricRing();
  private readonly coreParticleCosts = new MetricRing();
  private readonly liquidShaperCosts = new MetricRing();
  private readonly uiFlushCosts = new MetricRing();
  private readonly rotationCosts = new MetricRing();

  private stalls24 = 0;
  private stalls34 = 0;
  private stalls50 = 0;
  private scrollFrames = 0;
  private macro2Frames = 0;

  private readonly onWheel = () => {
    if (!this.active) return;
    this.scrollActiveUntil = this.now() + 180;
  };

  private readonly onScroll = () => {
    if (!this.active) return;
    this.scrollActiveUntil = this.now() + 180;
  };

  private readonly onMacroLive = (event: Event) => {
    if (!this.active) return;
    const detail = (event as CustomEvent<{ macroId?: string }>).detail;
    if (detail?.macroId === 'macro2') this.macro2Dragging = true;
  };

  private readonly onMacroCommit = (event: Event) => {
    if (!this.active) return;
    const detail = (event as CustomEvent<{ macroId?: string }>).detail;
    if (detail?.macroId === 'macro2') this.macro2Dragging = false;
  };

  private readonly onPointerDown = (event: Event) => {
    if (!this.active) return;
    const target = event.target as Element | null;
    if (target?.closest?.('[data-macro-id="macro2"]')) this.macro2Dragging = true;
  };

  private readonly onPointerEnd = (event: Event) => {
    if (!this.active || !this.macro2Dragging) return;
    const target = event.target as Element | null;
    if (!target || target.closest?.('[data-macro-id="macro2"]') || this.macro2Dragging) {
      this.macro2Dragging = false;
    }
  };

  constructor(private readonly options: ProductionPerformanceCertificationOptions) {
    this.now = options.now ?? (() => performance.now());
    this.installWindowBridge();
  }

  private installWindowBridge(): void {
    const target = window as any;
    target.__ORBITAL_BEGIN_PHASE_4_8H_5_CERTIFICATION__ = (label?: string) => this.start(label);
    target.__ORBITAL_END_PHASE_4_8H_5_CERTIFICATION__ = () => this.stop();
    target.__ORBITAL_RESET_PHASE_4_8H_5_CERTIFICATION__ = () => this.reset();
    target.__ORBITAL_PHASE_4_8H_5_CERTIFICATION__ = this.snapshot();
  }

  private addInteractionListeners(): void {
    window.addEventListener('wheel', this.onWheel, { passive: true, capture: true });
    window.addEventListener('scroll', this.onScroll, { passive: true, capture: true });
    window.addEventListener('orbital:macro-live', this.onMacroLive as EventListener, { passive: true });
    window.addEventListener('orbital:macro-commit', this.onMacroCommit as EventListener, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown as EventListener, { passive: true, capture: true });
    window.addEventListener('pointerup', this.onPointerEnd as EventListener, { passive: true, capture: true });
    window.addEventListener('pointercancel', this.onPointerEnd as EventListener, { passive: true, capture: true });
  }

  private removeInteractionListeners(): void {
    window.removeEventListener('wheel', this.onWheel, true);
    window.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('orbital:macro-live', this.onMacroLive as EventListener);
    window.removeEventListener('orbital:macro-commit', this.onMacroCommit as EventListener);
    window.removeEventListener('pointerdown', this.onPointerDown as EventListener, true);
    window.removeEventListener('pointerup', this.onPointerEnd as EventListener, true);
    window.removeEventListener('pointercancel', this.onPointerEnd as EventListener, true);
  }

  start(label = 'manual'): Record<string, unknown> {
    if (this.active) return this.snapshot();
    this.resetMetrics();
    this.label = String(label || 'manual');
    this.active = true;
    this.startedAt = this.now();
    this.stoppedAt = 0;
    this.previousRenderCostDebug = (window as any).__ORBITAL_RENDER_COST_DEBUG__;
    (window as any).__ORBITAL_RENDER_COST_DEBUG__ = true;
    this.addInteractionListeners();
    this.publish(true);
    return this.snapshot();
  }

  stop(): Record<string, unknown> {
    if (!this.active) return this.snapshot();
    this.active = false;
    this.stoppedAt = this.now();
    this.macro2Dragging = false;
    this.scrollActiveUntil = 0;
    this.removeInteractionListeners();
    if (this.previousRenderCostDebug === undefined) {
      delete (window as any).__ORBITAL_RENDER_COST_DEBUG__;
    } else {
      (window as any).__ORBITAL_RENDER_COST_DEBUG__ = this.previousRenderCostDebug;
    }
    this.publish(true);
    return this.snapshot();
  }

  reset(): Record<string, unknown> {
    const wasActive = this.active;
    if (wasActive) this.stop();
    this.resetMetrics();
    this.label = 'manual';
    this.startedAt = 0;
    this.stoppedAt = 0;
    this.publish(true);
    return this.snapshot();
  }

  private resetMetrics(): void {
    this.frameCount = 0;
    this.lastFrameAt = 0;
    this.phaseStartedAt = 0;
    this.stalls24 = 0;
    this.stalls34 = 0;
    this.stalls50 = 0;
    this.scrollFrames = 0;
    this.macro2Frames = 0;
    this.frameIntervals.clear();
    this.idleIntervals.clear();
    this.scrollIntervals.clear();
    this.dragIntervals.clear();
    this.macro2Intervals.clear();
    this.prepareCosts.clear();
    this.renderCosts.clear();
    this.recordingCosts.clear();
    this.diagnosticsCosts.clear();
    this.finalizeCosts.clear();
    this.coreParticleCosts.clear();
    this.liquidShaperCosts.clear();
    this.uiFlushCosts.clear();
    this.rotationCosts.clear();
  }

  beginPrepare(now: number, _timing: RuntimeFrameTiming): void {
    if (!this.active) return;
    this.frameCount += 1;
    if (this.lastFrameAt > 0) {
      const interval = Math.max(0, now - this.lastFrameAt);
      this.frameIntervals.push(interval);
      if (interval > 24) this.stalls24 += 1;
      if (interval > 34) this.stalls34 += 1;
      if (interval > 50) this.stalls50 += 1;

      const scrolling = this.now() < this.scrollActiveUntil || this.options.getInteractionState() === 'scrolling';
      const dragging = this.options.getInteractionState() === 'dragging';
      if (scrolling) {
        this.scrollIntervals.push(interval);
        this.scrollFrames += 1;
      } else if (this.macro2Dragging) {
        this.macro2Intervals.push(interval);
        this.macro2Frames += 1;
      } else if (dragging) {
        this.dragIntervals.push(interval);
      } else {
        this.idleIntervals.push(interval);
      }
    }
    this.lastFrameAt = now;
    this.phaseStartedAt = this.now();
  }

  endPrepare(): void {
    if (!this.active) return;
    this.prepareCosts.push(this.now() - this.phaseStartedAt);
    this.phaseStartedAt = this.now();
  }

  endRender(): void {
    if (!this.active) return;
    this.renderCosts.push(this.now() - this.phaseStartedAt);
    const costs = this.options.getFrameCosts();
    if (costs.coreParticlesMs > 0) this.coreParticleCosts.push(costs.coreParticlesMs);
    if (costs.liquidShaperMs > 0) this.liquidShaperCosts.push(costs.liquidShaperMs);
    if (costs.uiFlushMs > 0) this.uiFlushCosts.push(costs.uiFlushMs);
    if (costs.rotationMs > 0) this.rotationCosts.push(costs.rotationMs);
    this.phaseStartedAt = this.now();
  }

  endRecording(): void {
    if (!this.active) return;
    this.recordingCosts.push(this.now() - this.phaseStartedAt);
    this.phaseStartedAt = this.now();
  }

  endDiagnostics(): void {
    if (!this.active) return;
    this.diagnosticsCosts.push(this.now() - this.phaseStartedAt);
    this.phaseStartedAt = this.now();
  }

  endFinalize(): void {
    if (!this.active) return;
    this.finalizeCosts.push(this.now() - this.phaseStartedAt);
    this.publish(false);
  }

  private gate(summary: MetricSummary, threshold: number, field: keyof MetricSummary, note: string, minimumSamples = 30): CertificationGate {
    const enough = summary.samples >= minimumSamples;
    const value = enough ? Number(summary[field]) : null;
    return {
      pass: enough ? Number(value) <= threshold : null,
      value,
      threshold,
      samples: summary.samples,
      note: enough ? note : `${note} Collect at least ${minimumSamples} samples.`,
    };
  }

  snapshot(): any {
    const frames = this.frameIntervals.summary();
    const idle = this.idleIntervals.summary();
    const scrolling = this.scrollIntervals.summary();
    const dragging = this.dragIntervals.summary();
    const macro2 = this.macro2Intervals.summary();
    const prepare = this.prepareCosts.summary();
    const render = this.renderCosts.summary();
    const recording = this.recordingCosts.summary();
    const diagnostics = this.diagnosticsCosts.summary();
    const finalize = this.finalizeCosts.summary();
    const coreParticles = this.coreParticleCosts.summary();
    const liquidShaper = this.liquidShaperCosts.summary();
    const uiFlush = this.uiFlushCosts.summary();
    const rotation = this.rotationCosts.summary();
    const intervalSamples = Math.max(1, frames.samples);
    const stall50Rate = this.stalls50 / intervalSamples;

    const gates = {
      idleContinuity: this.gate(idle, 24, 'p95Ms', 'Idle frame cadence p95 must stay within 24 ms.', 120),
      scrollContinuity: this.gate(scrolling, 28, 'p95Ms', 'Scrolling frame cadence p95 must stay within 28 ms.'),
      macro2Continuity: this.gate(macro2, 28, 'p95Ms', 'Macro 2 drag frame cadence p95 must stay within 28 ms.'),
      renderBudget: this.gate(render, 16.7, 'p95Ms', 'Production render callback p95 must stay within one 60 Hz frame budget.', 120),
      coreParticles: this.gate(coreParticles, 6, 'p95Ms', 'Core Particles measured CPU submission/orchestration p95 must stay below 6 ms.', 30),
      liquidShaper: this.gate(liquidShaper, 6, 'p95Ms', 'Liquid Shaper measured CPU orchestration p95 must stay below 6 ms.', 30),
      uiFlush: this.gate(uiFlush, 2, 'p95Ms', 'Deferred UI flush p95 must stay below 2 ms.', 30),
      severeStalls: {
        pass: frames.samples >= 120 ? stall50Rate <= 0.01 : null,
        value: frames.samples >= 120 ? stall50Rate : null,
        threshold: 0.01,
        samples: frames.samples,
        note: 'Frames above 50 ms must remain at or below 1% of measured intervals.',
      } as CertificationGate,
    };

    const resolved = Object.values(gates).filter((gate) => gate.pass !== null);
    const failed = resolved.filter((gate) => gate.pass === false);
    const status = this.active
      ? 'collecting'
      : resolved.length < 4
        ? 'insufficient-data'
        : failed.length === 0
          ? 'pass'
          : 'needs-attention';

    return {
      phase: '4.8H.5',
      purpose: 'parity-freeze-performance-certification',
      active: this.active,
      label: this.label,
      status,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      durationMs: this.startedAt ? Math.max(0, (this.active ? this.now() : this.stoppedAt) - this.startedAt) : 0,
      frameCount: this.frameCount,
      stalls: {
        over24Ms: this.stalls24,
        over34Ms: this.stalls34,
        over50Ms: this.stalls50,
        severeRate: stall50Rate,
      },
      interactionFrames: {
        scrolling: this.scrollFrames,
        macro2: this.macro2Frames,
      },
      cadence: { all: frames, idle, scrolling, dragging, macro2 },
      phases: { prepare, render, recording, diagnostics, finalize },
      featureCosts: { coreParticles, liquidShaper, rotation, uiFlush },
      gates,
      failedGates: Object.entries(gates).filter(([, gate]) => gate.pass === false).map(([name]) => name),
      instructions: {
        start: "window.__ORBITAL_BEGIN_PHASE_4_8H_5_CERTIFICATION__('baseline')",
        result: 'window.__ORBITAL_PHASE_4_8H_5_CERTIFICATION__',
        stop: 'window.__ORBITAL_END_PHASE_4_8H_5_CERTIFICATION__()',
      },
    };
  }

  private publish(force: boolean): void {
    const now = this.now();
    if (!force && now - this.publishTimer < 500) return;
    this.publishTimer = now;
    (window as any).__ORBITAL_PHASE_4_8H_5_CERTIFICATION__ = this.snapshot();
  }

  dispose(): void {
    if (this.active) this.stop();
    this.removeInteractionListeners();
    const target = window as any;
    delete target.__ORBITAL_BEGIN_PHASE_4_8H_5_CERTIFICATION__;
    delete target.__ORBITAL_END_PHASE_4_8H_5_CERTIFICATION__;
    delete target.__ORBITAL_RESET_PHASE_4_8H_5_CERTIFICATION__;
    delete target.__ORBITAL_PHASE_4_8H_5_CERTIFICATION__;
  }
}

export function createProductionPerformanceCertification(options: ProductionPerformanceCertificationOptions) {
  return new ProductionPerformanceCertification(options);
}
