import type { RuntimeResourceScope } from './visualizer/session/RuntimeResourceDiagnostics';
import { DEVELOPMENT_DIAGNOSTICS_ENABLED, FIELD_CERTIFICATION_ENABLED, RUNTIME_TELEMETRY_ENABLED } from '../config/runtimeEnvironment';

// Production-safe interaction state is required by the visual frame budget. High-cost
// long-task observation remains restricted to explicit diagnostic sessions.
const INTERACTION_METRICS_ENABLED = RUNTIME_TELEMETRY_ENABLED;
// Phase 4.8J.2: interaction observation is certification-only. Figma/dev preview must
// behave like production here: panel scroll and macro movement cannot switch render-loop
// measurement/flush behavior simply because development diagnostics are available.
const INTERACTION_STATE_ENABLED = FIELD_CERTIFICATION_ENABLED;
const INTERACTION_LONG_TASKS_ENABLED = DEVELOPMENT_DIAGNOSTICS_ENABLED || FIELD_CERTIFICATION_ENABLED;
export type InteractionSnapshot = {
  active: boolean;
  state: 'idle' | 'scrolling' | 'dragging' | 'resizing' | 'tab-switch';
  inputToFrameDelay: number;
  longestFrameGap: number;
  missedRaf: number;
  longTasks: number;
  scrollStalls: number;
  panelRenders: number;
  scrollHandlerDuration: number;
  maxScrollHandlerDuration: number;
  scrollEvents: number;
  rafFramesDuringScroll: number;
  layoutPaintStallEstimate: number;
  suspectedPresentationDelay: boolean;
  macroLiveEvents: number;
  macroCommits: number;
  tabSwitches: number;
  maxMacroFrameGap: number;
  maxTabSwitchFrameGap: number;
  controlTransactions: number;
  maxControlTransactionMs: number;
  audioUnderruns: number;
  workerStage: string;
  workerActive: boolean;
  interactionFrames: number;
  interactionLongFrames: number;
  maxInteractionFrameInterval: number;
  maxInteractionRenderMs: number;
  maxInteractionCanvas2DMs: number;
  maxInteractionWebGLMs: number;
  maxInteractionDotsMs: number;
  maxInteractionHaloMs: number;
  maxInteractionUiFlushMs: number;
};

/**
 * Lightweight interaction diagnostics only.
 * This runtime intentionally performs no React writes, DOM class toggles,
 * visual-quality changes, or independent RAF scheduling.
 */
export class UIInteractionRuntime {
  constructor(private readonly resources?: RuntimeResourceScope) {}
  private cleanups: Array<() => void> = [];
  private observer: PerformanceObserver | null = null;
  private state: InteractionSnapshot = {
    active: false,
    state: 'idle',
    inputToFrameDelay: 0,
    longestFrameGap: 0,
    missedRaf: 0,
    longTasks: 0,
    scrollStalls: 0,
    panelRenders: 0,
    scrollHandlerDuration: 0,
    maxScrollHandlerDuration: 0,
    scrollEvents: 0,
    rafFramesDuringScroll: 0,
    layoutPaintStallEstimate: 0,
    suspectedPresentationDelay: false,
    macroLiveEvents: 0,
    macroCommits: 0,
    tabSwitches: 0,
    maxMacroFrameGap: 0,
    maxTabSwitchFrameGap: 0,
    controlTransactions: 0,
    maxControlTransactionMs: 0,
    audioUnderruns: 0,
    workerStage: 'unknown',
    workerActive: false,
    interactionFrames: 0,
    interactionLongFrames: 0,
    maxInteractionFrameInterval: 0,
    maxInteractionRenderMs: 0,
    maxInteractionCanvas2DMs: 0,
    maxInteractionWebGLMs: 0,
    maxInteractionDotsMs: 0,
    maxInteractionHaloMs: 0,
    maxInteractionUiFlushMs: 0,
  };
  private lastInput = 0;
  private lastFrame = 0;
  private scrollStartedAt = 0;
  private lastPublishedAt = 0;
  private readonly publishIntervalMs = 125;
  private interactionEndsAt = 0;

  init(): void {
    if (!INTERACTION_STATE_ENABLED) return;
    const panel = document.querySelector('#panel');
    const panelScrollable = document.querySelector('.panel-scrollable');
    const scrollTargets = panelScrollable ? [panelScrollable] : [];

    const mark = (state: InteractionSnapshot['state']): void => {
      const now = performance.now();
      this.lastInput = now;
      this.state.active = true;
      this.state.state = state;
      if (state === 'scrolling' && this.scrollStartedAt === 0) this.scrollStartedAt = now;
      // No timer churn on high-frequency scroll events. The authoritative frame
      // scheduler expires the interaction state from this timestamp.
      this.interactionEndsAt = now + 120;
      (window as any).__ORBITAL_INTERACTION_ACTIVE__ = true;
      (window as any).__ORBITAL_INTERACTION_STATE__ = state;
    };

    const onWheel = (): void => mark('scrolling');
    const onScroll = (): void => {
      const started = performance.now();
      mark('scrolling');
      const duration = performance.now() - started;
      this.state.scrollHandlerDuration = duration;
      this.state.maxScrollHandlerDuration = Math.max(this.state.maxScrollHandlerDuration, duration);
      this.state.scrollEvents += 1;
    };
    const onDown = (): void => mark('dragging');
    const onMacroLive = (): void => {
      this.state.macroLiveEvents += 1;
      mark('dragging');
    };
    const onMacroCommit = (): void => {
      this.state.macroCommits += 1;
      mark('dragging');
    };
    const onTabSwitch = (): void => {
      this.state.tabSwitches += 1;
      mark('tab-switch');
    };
    const onControlTransaction = (event: Event): void => {
      const duration = Number((event as CustomEvent<{ durationMs?: number }>).detail?.durationMs || 0);
      this.state.controlTransactions += 1;
      this.state.maxControlTransactionMs = Math.max(this.state.maxControlTransactionMs, duration);
      this.publish(true);
    };

    for (const target of scrollTargets) {
      target.addEventListener('wheel', onWheel, { passive: true });
      const releaseWheel = this.resources?.track('activeListeners');
      target.addEventListener('scroll', onScroll, { passive: true });
      const releaseScroll = this.resources?.track('activeListeners');
      this.cleanups.push(
        () => { target.removeEventListener('wheel', onWheel); releaseWheel?.(); },
        () => { target.removeEventListener('scroll', onScroll); releaseScroll?.(); },
      );
    }
    const pointerTarget = panel ?? panelScrollable;
    if (pointerTarget) {
      pointerTarget.addEventListener('pointerdown', onDown, { passive: true });
      const releasePointerDown = this.resources?.track('activeListeners');
      this.cleanups.push(
        () => { pointerTarget.removeEventListener('pointerdown', onDown); releasePointerDown?.(); },
      );
    }
    const interactionEvents: Array<[string, EventListener]> = [
      ['orbital:macro-live', onMacroLive],
      ['orbital:macro-commit', onMacroCommit],
      ['orbital:panel-tab-change', onTabSwitch],
      ['orbital:control-transaction-complete', onControlTransaction],
    ];
    for (const [type, listener] of interactionEvents) {
      window.addEventListener(type, listener, { passive: true });
      const release = this.resources?.track('activeListeners');
      this.cleanups.push(() => { window.removeEventListener(type, listener); release?.(); });
    }

    if (INTERACTION_LONG_TASKS_ENABLED && 'PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          this.state.longTasks += entries.length;
          if (this.state.state === 'scrolling') {
            const duration = entries.reduce((total, entry) => total + entry.duration, 0);
            this.state.layoutPaintStallEstimate = Math.max(
              this.state.layoutPaintStallEstimate * 0.92,
              duration,
            );
          }
          this.publish(true);
        });
        this.observer.observe({ entryTypes: ['longtask'] as any });
      } catch {
        // Long Task API is optional.
      }
    }

    (window as any).__ORBITAL_PANEL_RENDER__ = () => {
      this.state.panelRenders += 1;
      this.publish(true);
    };
  }

  /** Called only by the authoritative visual scheduler. */
  onFrame(timestamp: number): void {
    if (!INTERACTION_STATE_ENABLED) return;
    if (this.state.active && this.interactionEndsAt > 0 && timestamp >= this.interactionEndsAt) {
      this.state.active = false;
      this.state.state = 'idle';
      this.scrollStartedAt = 0;
      this.interactionEndsAt = 0;
      (window as any).__ORBITAL_INTERACTION_ACTIVE__ = false;
      (window as any).__ORBITAL_INTERACTION_STATE__ = 'idle';
      this.publish(true, timestamp);
    }
    if (!INTERACTION_METRICS_ENABLED) {
      this.lastFrame = timestamp;
      return;
    }
    if (this.lastFrame) {
      const gap = timestamp - this.lastFrame;
      this.state.longestFrameGap = Math.max(this.state.longestFrameGap * 0.995, gap);
      if (gap > 34) this.state.missedRaf += Math.max(1, Math.round(gap / 16.67) - 1);
      if (this.state.state === 'scrolling') {
        this.state.rafFramesDuringScroll += 1;
        if (gap > 40) this.state.scrollStalls += 1;
        // Browsers do not expose compositor presentation timing directly. This flag is
        // a conservative proxy: RAF continues, but interaction-to-frame delay or long
        // tasks indicate presentation may still be visually delayed.
        this.state.suspectedPresentationDelay =
          gap > 24 || this.state.inputToFrameDelay > 24 || this.state.layoutPaintStallEstimate > 24;
      } else {
        this.state.suspectedPresentationDelay = false;
      }
      if (this.state.state === 'dragging') {
        this.state.maxMacroFrameGap = Math.max(this.state.maxMacroFrameGap * 0.995, gap);
      }
      if (this.state.state === 'tab-switch') {
        this.state.maxTabSwitchFrameGap = Math.max(this.state.maxTabSwitchFrameGap * 0.995, gap);
      }
    }
    const stress = (window as any).__ORBITAL_AUDIO_VISUAL_STRESS__;
    this.state.audioUnderruns = stress
      ? Number(stress.waiting || 0) + Number(stress.stalled || 0) + Number(stress.suspend || 0)
      : 0;
    const workerStage = document.getElementById('root')?.dataset.orbitalWorkerStage || 'unknown';
    this.state.workerStage = workerStage;
    this.state.workerActive = /starting|handshaking|staging-running|awaiting|releasing/.test(workerStage);
    this.lastFrame = timestamp;
    if (this.lastInput) {
      this.state.inputToFrameDelay = Math.max(0, timestamp - this.lastInput);
      this.lastInput = 0;
    }
    this.publish(false, timestamp);
  }

  /**
   * Records only during a panel gesture/trailing interaction window. This is the
   * correlation source for the next frame-budget sprint; it never changes quality.
   */
  recordRenderCost(args: {
    frameIntervalMs: number;
    renderMs: number;
    canvas2DMs: number;
    webglMs: number;
    dotsMs: number;
    haloMs: number;
    uiFlushMs: number;
  }): void {
    if (!INTERACTION_METRICS_ENABLED || !this.state.active) return;
    this.state.interactionFrames += 1;
    if (args.frameIntervalMs > 24) this.state.interactionLongFrames += 1;
    this.state.maxInteractionFrameInterval = Math.max(this.state.maxInteractionFrameInterval, args.frameIntervalMs);
    this.state.maxInteractionRenderMs = Math.max(this.state.maxInteractionRenderMs, args.renderMs);
    this.state.maxInteractionCanvas2DMs = Math.max(this.state.maxInteractionCanvas2DMs, args.canvas2DMs);
    this.state.maxInteractionWebGLMs = Math.max(this.state.maxInteractionWebGLMs, args.webglMs);
    this.state.maxInteractionDotsMs = Math.max(this.state.maxInteractionDotsMs, args.dotsMs);
    this.state.maxInteractionHaloMs = Math.max(this.state.maxInteractionHaloMs, args.haloMs);
    this.state.maxInteractionUiFlushMs = Math.max(this.state.maxInteractionUiFlushMs, args.uiFlushMs);
    this.publish(false);
  }

  get isActive(): boolean {
    return this.state.active;
  }

  get currentState(): InteractionSnapshot['state'] {
    return this.state.state;
  }

  private publish(force = false, now = performance.now()): void {
    if (!INTERACTION_METRICS_ENABLED) return;
    if (!force && now - this.lastPublishedAt < this.publishIntervalMs) return;
    this.lastPublishedAt = now;
    // Publish a cloned snapshot at HUD rate, never at visual frame rate.
    (window as any).__ORBITAL_INTERACTION_METRICS__ = { ...this.state };
  }

  dispose(): void {
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.interactionEndsAt = 0;
    this.observer?.disconnect();
    delete (window as any).__ORBITAL_PANEL_RENDER__;
    delete (window as any).__ORBITAL_INTERACTION_METRICS__;
    delete (window as any).__ORBITAL_INTERACTION_ACTIVE__;
    delete (window as any).__ORBITAL_INTERACTION_STATE__;
  }
}
