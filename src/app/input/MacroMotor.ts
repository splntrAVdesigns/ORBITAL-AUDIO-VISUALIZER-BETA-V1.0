import {
  cancelTrackedInterval,
  cancelTrackedTimeout,
  scheduleTrackedInterval,
  scheduleTrackedTimeout,
} from '../runtime/mainThread/MainThreadAsyncDiagnostics';
import { applyRuntimeParameterTransaction } from '../runtime/parameters/RuntimeParameterTransactions';
import { MACRO_LIVE_PREVIEW_EVENT } from './types';

/**
 * ORBITAL — Macro motor (Sprint O4).
 *
 * The ONLY path by which external controllers change a macro. Two kinds of write:
 *
 *  1. setAbsolute(): a controller reports a position (MIDI CC). Applied immediately, exactly
 *     like the pre-O4 MIDI path: live apply + gutter preview per message, one debounced
 *     React commit after the gesture ends. No smoothing by default (MIDI feels right direct).
 *
 *  2. step() / setRate() / reset(): relative intent (gamepad). These move a TARGET; a
 *     critically-damped one-pole follower glides the real value toward it, so taps, holds
 *     and resets never jump. Frame-rate independent (uses real elapsed time).
 *
 * Commit policy for glides: throttled every GLIDE_COMMIT_INTERVAL_MS while moving, plus a
 * final commit when the value settles. The throttle matters for Motion (macro2), which by
 * design only takes effect on commit — without it a held stick would do nothing until release.
 *
 * If anything else moves the macro mid-glide (preset load, mouse, MIDI), the glide adopts
 * the new value instead of fighting it.
 */

export interface MacroMotorOptions {
  params: Record<string, any>;
  applyMacroLive: (macroId: string, value: number) => void;
  commitMacroValue: (macroId: string, value: number) => void;
}

const TICK_MS = 16;
const MAX_TICK_DT_MS = 50;
/** Glide time constant. ~95% settled after 3τ ≈ 210 ms. */
export const GLIDE_TAU_MS = 70;
/** Reset glide: ~95% settled after ≈ 250 ms. */
export const RESET_TAU_MS = 85;
const ABSOLUTE_COMMIT_DEBOUNCE_MS = 120;
const GLIDE_COMMIT_INTERVAL_MS = 250;
const SETTLE_EPSILON = 0.05;
/** Minimum glide speed near the target (units/s) — finishes the exponential tail cleanly. */
const MIN_APPROACH_UNITS_PER_S = 15;
/** A param that drifted more than this from what we wrote was moved by someone else. */
const EXTERNAL_CHANGE_TOLERANCE = 1;

interface Glide {
  value: number;
  target: number;
  /** Units per second applied to target (0 = not ramping). */
  rate: number;
  tau: number;
  lastWritten: number;
  lastCommitAt: number;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export class MacroMotor {
  private glides = new Map<string, Glide>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;
  private commitTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingCommits = new Map<string, number>();
  private disposed = false;

  constructor(private readonly opts: MacroMotorOptions) {}

  /** Current macro value as the app sees it. */
  getValue(macroId: string): number {
    const v = Number(this.opts.params[macroId]);
    return Number.isFinite(v) ? v : 0;
  }

  /** Where a glide is heading (or the current value when idle). */
  getTarget(macroId: string): number {
    return this.glides.get(macroId)?.target ?? this.getValue(macroId);
  }

  isGliding(macroId?: string): boolean {
    return macroId ? this.glides.has(macroId) : this.glides.size > 0;
  }

  /** Absolute position (MIDI). Cancels any glide on that macro: the hardware wins. */
  setAbsolute(macroId: string, value: number): void {
    if (this.disposed) return;
    this.glides.delete(macroId);
    this.write(macroId, clamp(value));
    this.debounceCommit(macroId, this.getValue(macroId));
    this.stopIfIdle();
  }

  /** Relative step (tap / flick). Steps accumulate on the target, so rapid taps add up. */
  step(macroId: string, delta: number): void {
    const glide = this.glideFor(macroId);
    glide.target = clamp(glide.target + delta);
    glide.tau = GLIDE_TAU_MS;
    this.ensureRunning();
  }

  /** Continuous ramp (hold). Pass 0 to stop ramping; the glide then settles on its target. */
  setRate(macroId: string, unitsPerSecond: number): void {
    if (!unitsPerSecond && !this.glides.has(macroId)) return;
    const glide = this.glideFor(macroId);
    glide.rate = unitsPerSecond;
    glide.tau = GLIDE_TAU_MS;
    this.ensureRunning();
  }

  /** Glide to a value (double-tap reset → 0). */
  reset(macroId: string, value = 0): void {
    const glide = this.glideFor(macroId);
    glide.rate = 0;
    glide.target = clamp(value);
    glide.tau = RESET_TAU_MS;
    this.ensureRunning();
  }

  /** Stop all ramps (pad disconnected, input disabled). Glides settle on their targets. */
  releaseAll(): void {
    for (const glide of this.glides.values()) glide.rate = 0;
  }

  dispose(): void {
    this.disposed = true;
    cancelTrackedInterval(this.interval);
    this.interval = null;
    for (const t of this.commitTimers.values()) cancelTrackedTimeout(t);
    this.commitTimers.clear();
    this.pendingCommits.clear();
    this.glides.clear();
  }

  /** Test seam: advance the glide clock by dtMs without waiting on timers. */
  advance(dtMs: number): void {
    this.tick(this.lastTickAt + dtMs);
  }

  /* ---- internals ---- */

  private glideFor(macroId: string): Glide {
    const existing = this.glides.get(macroId);
    if (existing) return existing;
    const value = this.getValue(macroId);
    const glide: Glide = { value, target: value, rate: 0, tau: GLIDE_TAU_MS, lastWritten: value, lastCommitAt: 0 };
    this.glides.set(macroId, glide);
    return glide;
  }

  private ensureRunning(): void {
    if (this.disposed || this.interval !== null) return;
    this.lastTickAt = performance.now();
    this.interval = scheduleTrackedInterval('input-macro-motor', () => this.tick(performance.now()), TICK_MS);
  }

  private stopIfIdle(): void {
    if (this.glides.size || this.interval === null) return;
    cancelTrackedInterval(this.interval);
    this.interval = null;
  }

  private tick(now: number): void {
    const dt = Math.min(MAX_TICK_DT_MS, Math.max(0, now - this.lastTickAt));
    this.lastTickAt = now;
    if (!dt) return;
    for (const [macroId, glide] of this.glides) {
      const live = this.getValue(macroId);
      if (Math.abs(live - glide.lastWritten) > EXTERNAL_CHANGE_TOLERANCE) {
        // Someone else moved it (preset, mouse, MIDI). Adopt; keep ramping from there if held.
        glide.value = live;
        glide.target = live;
        glide.lastWritten = live;
      }
      if (glide.rate) glide.target = clamp(glide.target + (glide.rate * dt) / 1000);
      const alpha = 1 - Math.exp(-dt / glide.tau);
      const remaining = glide.target - glide.value;
      // Eased approach, plus a small minimum speed so the exponential tail can't crawl:
      // without it a reset sits at "1" for ~300 ms before landing on 0.
      const eased = remaining * alpha;
      const floor = Math.min(Math.abs(remaining), (MIN_APPROACH_UNITS_PER_S * dt) / 1000);
      let next = glide.value + Math.sign(remaining) * Math.max(Math.abs(eased), floor);
      const settled = !glide.rate && Math.abs(glide.target - next) < SETTLE_EPSILON;
      if (settled) next = glide.target;
      glide.value = next;
      this.write(macroId, next, glide);
      if (settled) {
        this.glides.delete(macroId);
        this.commitNow(macroId, this.getValue(macroId));
      } else if (now - glide.lastCommitAt >= GLIDE_COMMIT_INTERVAL_MS) {
        glide.lastCommitAt = now;
        this.commitNow(macroId, this.getValue(macroId));
      }
    }
    this.stopIfIdle();
  }

  private write(macroId: string, value: number, glide?: Glide): void {
    applyRuntimeParameterTransaction(this.opts.params, { [macroId]: value });
    this.opts.applyMacroLive(macroId, value);
    const written = this.getValue(macroId);
    if (glide) glide.lastWritten = written;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MACRO_LIVE_PREVIEW_EVENT, { detail: { macroId, value: written } }));
    }
  }

  private debounceCommit(macroId: string, value: number): void {
    this.pendingCommits.set(macroId, value);
    cancelTrackedTimeout(this.commitTimers.get(macroId));
    this.commitTimers.set(macroId, scheduleTrackedTimeout('input-macro-commit', () => {
      this.commitTimers.delete(macroId);
      const pending = this.pendingCommits.get(macroId);
      this.pendingCommits.delete(macroId);
      if (pending !== undefined && !this.disposed) this.opts.commitMacroValue(macroId, pending);
    }, ABSOLUTE_COMMIT_DEBOUNCE_MS));
  }

  private commitNow(macroId: string, value: number): void {
    cancelTrackedTimeout(this.commitTimers.get(macroId));
    this.commitTimers.delete(macroId);
    this.pendingCommits.delete(macroId);
    if (!this.disposed) this.opts.commitMacroValue(macroId, value);
  }
}
