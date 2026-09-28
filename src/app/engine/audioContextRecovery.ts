/**
 * ORBITAL — AudioContext recovery (Sprint M2).
 *
 * Browsers can move a running AudioContext to 'suspended' (autoplay policy,
 * backgrounding, OS audio route changes) or, on Safari/iOS, 'interrupted'
 * (phone call, Siri, another app taking the audio session). Before this module
 * the only resume() calls lived in the media 'play' handler and mic start, so
 * an interruption left the visualizer flat until the user pressed play again.
 *
 * Policy:
 * - Only attempt resume while the page is visible.
 * - Retry on: context statechange, visibility→visible, pageshow (bfcache),
 *   and the next user gesture (pointerdown/keydown/touchend) — some browsers
 *   reject resume() without one.
 * - One resume() in flight at a time. Failures are silent and retried on the
 *   next trigger; 'interrupted' contexts fire statechange again when the
 *   interruption ends.
 * - Never resumes a 'closed' context. Fully disposable.
 */

type RecoverableState = AudioContextState | 'interrupted';

export interface AudioContextRecoveryOptions {
  debug?: boolean;
  /** Optional hook, e.g. to refresh UI state after a successful resume. */
  onResumed?: () => void;
}

export interface AudioContextRecoveryHandle {
  /** Attempt a resume now (e.g. from an explicit play). */
  kick(): void;
  dispose(): void;
}

export function installAudioContextRecovery(
  context: AudioContext,
  options: AudioContextRecoveryOptions = {},
): AudioContextRecoveryHandle {
  const abort = new AbortController();
  const { signal } = abort;
  let resumeInFlight = false;
  let disposed = false;

  const state = (): RecoverableState => context.state as RecoverableState;
  const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

  const attemptResume = (reason: string): void => {
    if (disposed || resumeInFlight) return;
    const current = state();
    if (current === 'running' || current === 'closed') return;
    if (!isVisible()) return;
    resumeInFlight = true;
    context
      .resume()
      .then(() => {
        if (options.debug) console.log(`🔊 AudioContext resumed (${reason})`);
        if (!disposed && state() === 'running') options.onResumed?.();
      })
      .catch((error: unknown) => {
        if (options.debug) console.warn(`AudioContext resume deferred (${reason})`, error);
      })
      .finally(() => {
        resumeInFlight = false;
      });
  };

  context.addEventListener('statechange', () => attemptResume('statechange'), { signal });

  if (typeof document !== 'undefined') {
    document.addEventListener(
      'visibilitychange',
      () => { if (isVisible()) attemptResume('visible'); },
      { signal },
    );
    // Gesture fallback: capture phase so it runs even if a control stops propagation.
    const onGesture = () => attemptResume('gesture');
    for (const type of ['pointerdown', 'keydown', 'touchend'] as const) {
      document.addEventListener(type, onGesture, { signal, capture: true, passive: true });
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', () => attemptResume('pageshow'), { signal });
  }

  return {
    kick: () => attemptResume('kick'),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      abort.abort();
    },
  };
}
