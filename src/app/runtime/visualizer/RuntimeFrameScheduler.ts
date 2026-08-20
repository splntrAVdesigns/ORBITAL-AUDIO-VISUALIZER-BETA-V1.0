import type { RuntimeFrameTiming } from './VisualizerRuntimeTypes';
import type { RuntimeResourceScope } from './session/RuntimeResourceDiagnostics';
import type { FrameSchedulerContract } from './FrameSchedulerContract';

export interface RuntimeFrameSchedulerOptions {
  onFrame: (timing: RuntimeFrameTiming) => void;
  onResume?: (now: number) => void;
  onCrash?: (error: unknown, crashCount: number) => void;
  maxDeltaMs?: number;
  crashWindowMs?: number;
  crashThreshold?: number;
  recoveryDelayMs?: number;
  debugLabel?: string;
  resourceScope?: RuntimeResourceScope;
}

/** The only requestAnimationFrame authority for the extracted visualizer runtime. */
export class RuntimeFrameScheduler implements FrameSchedulerContract {
  private rafId: number | null = null;
  private running = false;
  private disposed = false;
  private lastNow = 0;
  private frameIndex = 0;
  private crashCount = 0;
  private crashWindowStart = 0;
  private recoveryTimer: number | null = null;
  private resumed = true;
  private releaseActiveScheduler: (() => void) | null = null;
  private releaseVisibilityListener: (() => void) | null = null;
  private releaseRecoveryTimer: (() => void) | null = null;

  private readonly maxDeltaMs: number;
  private readonly crashWindowMs: number;
  private readonly crashThreshold: number;
  private readonly recoveryDelayMs: number;

  constructor(private readonly options: RuntimeFrameSchedulerOptions) {
    this.maxDeltaMs = options.maxDeltaMs ?? 100;
    this.crashWindowMs = options.crashWindowMs ?? 2000;
    this.crashThreshold = options.crashThreshold ?? 3;
    this.recoveryDelayMs = options.recoveryDelayMs ?? 250;
    document.addEventListener('visibilitychange', this.handleVisibilityChange, { passive: true });
    this.releaseVisibilityListener = options.resourceScope?.track('activeListeners') ?? null;
  }

  start(): void {
    if (this.disposed || this.running) return;
    this.running = true;
    this.releaseActiveScheduler = this.options.resourceScope?.track('activeRafSchedulers') ?? null;
    this.resumed = true;
    this.lastNow = performance.now();
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.releaseActiveScheduler?.();
    this.releaseActiveScheduler = null;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.recoveryTimer !== null) window.clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
    this.releaseRecoveryTimer?.();
    this.releaseRecoveryTimer = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.releaseVisibilityListener?.();
    this.releaseVisibilityListener = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentFrameIndex(): number {
    return this.frameIndex;
  }

  get currentCrashCount(): number {
    return this.crashCount;
  }

  private schedule(): void {
    if (!this.running || this.disposed || document.hidden || this.rafId !== null) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    // Phase 4.8I: pre-arm the next RAF before running Orbital's frame work.
    // In embedded/preview hosts a request issued at the tail of a callback can miss
    // the compositor's next-frame enrollment cutoff even when the callback itself is
    // cheap (~2 ms). That presents as an exact ~33.4 ms median cadence. Keeping the
    // next callback enrolled from the beginning of this callback removes that avoidable
    // every-other-vsync failure mode without creating a second RAF authority.
    this.rafId = null;
    if (!this.running || this.disposed || document.hidden) return;
    this.schedule();

    const rawDelta = this.lastNow > 0 ? now - this.lastNow : 0;
    const deltaMs = Math.max(0, Math.min(this.maxDeltaMs, rawDelta));
    this.lastNow = now;
    this.frameIndex += 1;

    const timing: RuntimeFrameTiming = {
      now,
      deltaMs,
      deltaSeconds: deltaMs / 1000,
      frameIndex: this.frameIndex,
      resumed: this.resumed,
    };
    this.resumed = false;

    try {
      this.options.onFrame(timing);
    } catch (error) {
      // A callback is already armed. Cancel it before entering the existing crash
      // recovery policy so a failed frame cannot race the recovery scheduler.
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.handleCrash(error, now);
    }
  };

  private handleCrash(error: unknown, now: number): void {
    if (now - this.crashWindowStart > this.crashWindowMs) {
      this.crashWindowStart = now;
      this.crashCount = 0;
    }
    this.crashCount += 1;
    this.options.onCrash?.(error, this.crashCount);

    if (this.crashCount < this.crashThreshold) {
      this.schedule();
      return;
    }

    this.releaseRecoveryTimer?.();
    this.releaseRecoveryTimer = this.options.resourceScope?.track('activeTimers') ?? null;
    this.recoveryTimer = window.setTimeout(() => {
      this.recoveryTimer = null;
      this.releaseRecoveryTimer?.();
      this.releaseRecoveryTimer = null;
      if (!this.running || this.disposed || document.hidden) return;
      this.crashCount = 0;
      this.resumed = true;
      this.lastNow = performance.now();
      this.options.onResume?.(this.lastNow);
      this.schedule();
    }, this.recoveryDelayMs);
  }

  private readonly handleVisibilityChange = (): void => {
    if (this.disposed || !this.running) return;
    if (document.hidden) {
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      return;
    }

    this.resumed = true;
    this.lastNow = performance.now();
    this.options.onResume?.(this.lastNow);
    this.schedule();
  };
}
