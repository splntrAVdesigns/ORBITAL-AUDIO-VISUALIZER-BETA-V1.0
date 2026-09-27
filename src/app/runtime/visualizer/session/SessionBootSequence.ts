import { markBootStage } from '../../../boot/bootReadiness';
import {
  cancelTrackedShortLivedRaf,
  requestTrackedShortLivedRaf,
} from '../../mainThread/MainThreadAsyncDiagnostics';

/**
 * Sprint L3: deterministic session start-up.
 *
 * Replaces the staggered magic-number timers (100 / 300 / 350 ms) that used to sync
 * the control panel after mount. Those raced the reveal: on any slow frame (shader
 * compile, texture upload) sliders, readouts and macro visuals visibly settled after
 * the app was already on screen.
 *
 * Steps are registered during session setup and run once, in explicit order:
 *   1. one frame after setup returns, so React has committed any state updates the
 *      setup itself scheduled and every bind() listener is registered;
 *   2. then two more frames to confirm the viewport is committed and the frame
 *      scheduler is presenting, before boot readiness is published.
 *
 * All frame callbacks are tracked short-lived RAFs and are cancelled on dispose.
 */
export interface SessionBootStep {
  name: string;
  order: number;
  run: () => void;
}

const MAX_VIEWPORT_CONFIRM_FRAMES = 30;

export class SessionBootSequence {
  private readonly steps: SessionBootStep[] = [];
  private raf: number | null = null;
  private started = false;
  private disposed = false;

  constructor(
    private readonly stage: HTMLElement,
    private readonly debug = false,
  ) {}

  add(name: string, order: number, run: () => void): void {
    if (this.started) {
      // A late registration still runs, in place, rather than being dropped.
      this.runStep({ name, order, run });
      return;
    }
    this.steps.push({ name, order, run });
  }

  /** Called once at the end of session setup. */
  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.raf = requestTrackedShortLivedRaf('session-boot-steps', () => {
      this.raf = null;
      if (this.disposed) return;
      const ordered = [...this.steps].sort((a, b) => a.order - b.order);
      for (const step of ordered) this.runStep(step);
      markBootStage('ui');
      this.confirmFrames(0);
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelTrackedShortLivedRaf(this.raf);
    this.raf = null;
  }

  private runStep(step: SessionBootStep): void {
    try {
      step.run();
      if (this.debug) console.log(`✅ boot step: ${step.name}`);
    } catch (error) {
      // One failing step must never hold the app behind the loader.
      console.error(`[ORBITAL boot] step "${step.name}" failed`, error);
    }
  }

  private confirmFrames(frame: number): void {
    this.raf = requestTrackedShortLivedRaf('session-boot-confirm', () => {
      this.raf = null;
      if (this.disposed) return;
      const viewportReady = this.stage.querySelector('[data-viewport-ready="true"]') !== null
        || this.stage.dataset.viewportReady === 'true';
      if (viewportReady) markBootStage('viewport');
      // Two presented frames after the steps, with a committed viewport.
      if (frame >= 1 && viewportReady) {
        markBootStage('frame');
        return;
      }
      if (frame >= MAX_VIEWPORT_CONFIRM_FRAMES) {
        // Stage never measured (e.g. hidden tab): release boot rather than stall.
        markBootStage('viewport');
        markBootStage('frame');
        return;
      }
      this.confirmFrames(frame + 1);
    });
  }
}
