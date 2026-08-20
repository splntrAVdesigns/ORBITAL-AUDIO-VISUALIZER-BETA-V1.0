import { RUNTIME_IS_DEVELOPMENT } from '../config/runtimeEnvironment';
export function captureCanvasScreenshot(canvas: HTMLCanvasElement) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbital-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type FullscreenMode = 'inactive' | 'native' | 'embedded';

export interface FullscreenController {
  toggleFullscreen: () => Promise<void>;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  isFullscreen: () => boolean;
  getMode: () => FullscreenMode;
  dispose: () => void;
}

let activeFullscreenController: FullscreenController | null = null;

/** Main-thread bridge used by React controls. The runtime controller remains the single authority. */
export function toggleAppFullscreen(): void {
  void activeFullscreenController?.toggleFullscreen();
}

function getNativeFullscreenElement(): Element | null {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

async function requestElementFullscreen(element: FullscreenElement): Promise<void> {
  if (element.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }
  if (element.webkitRequestFullscreen) {
    await element.webkitRequestFullscreen();
    return;
  }
  throw new Error('Fullscreen API is unavailable');
}

async function exitDocumentFullscreen(): Promise<void> {
  const fullscreenDocument = document as FullscreenDocument;
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (fullscreenDocument.webkitExitFullscreen) {
    await fullscreenDocument.webkitExitFullscreen();
  }
}

function isPermissionsPolicyRejection(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /permissions? policy|disallowed|not allowed|fullscreen.*denied/i.test(text);
}

export function createFullscreenController(options: {
  button: HTMLElement | null;
  getWasCollapsedBeforeFullscreen: () => boolean;
  setWasCollapsedBeforeFullscreen: (value: boolean) => void;
  onLayoutChange?: () => void;
}): FullscreenController {
  const {
    button,
    getWasCollapsedBeforeFullscreen,
    setWasCollapsedBeforeFullscreen,
    onLayoutChange,
  } = options;

  const TRANSITION_MS = 210;
  let mode: FullscreenMode = 'inactive';
  let panelStateCaptured = false;
  let transitionPending = false;
  let nativeFullscreenBlocked = false;
  let disposed = false;
  let stageAnimation: Animation | null = null;
  let activeTransitionPromise: Promise<void> | null = null;
  let settleRaf = 0;

  const getStage = () => document.getElementById('stage') as HTMLElement | null;
  const isFullscreen = () => mode !== 'inactive' || getNativeFullscreenElement() !== null;

  const setPanelCollapsed = (collapsed: boolean) => {
    document.body.classList.toggle('collapsed', collapsed);
  };

  const setEmbeddedModeClass = (active: boolean) => {
    document.body.classList.toggle('orbital-stage-fullscreen', active);
    document.documentElement.classList.toggle('orbital-stage-fullscreen', active);
  };

  const setTransitionClass = (active: boolean) => {
    document.body.classList.toggle('orbital-stage-transition', active);
  };

  const syncButton = () => {
    if (!button) return;
    const active = isFullscreen();
    button.textContent = active ? '⛉' : '⛶';
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('title', active ? 'Exit fullscreen' : 'Enter fullscreen');
  };

  const capturePanelState = () => {
    if (panelStateCaptured) return;
    const wasCollapsed = document.body.classList.contains('collapsed');
    setWasCollapsedBeforeFullscreen(wasCollapsed);
    panelStateCaptured = true;
  };

  const restoreCapturedPanelState = () => {
    if (!panelStateCaptured) return;
    setPanelCollapsed(getWasCollapsedBeforeFullscreen());
    panelStateCaptured = false;
  };

  const commitLayoutOnce = () => {
    if (!onLayoutChange || disposed) return;
    if (settleRaf) cancelAnimationFrame(settleRaf);
    settleRaf = requestAnimationFrame(() => {
      settleRaf = 0;
      onLayoutChange();
    });
  };

  const runHorizontalStageTransition = async (mutateLayout: () => void): Promise<void> => {
    const stage = getStage();
    const first = stage?.getBoundingClientRect() ?? null;

    stageAnimation?.cancel();
    stageAnimation = null;
    setTransitionClass(true);
    mutateLayout();

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const last = stage?.getBoundingClientRect() ?? null;
    const deltaX = first && last ? first.left - last.left : 0;

    if (stage && Math.abs(deltaX) > 0.5 && typeof stage.animate === 'function') {
      stageAnimation = stage.animate(
        [
          { transform: `translate3d(${deltaX}px, 0, 0)` },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        {
          duration: TRANSITION_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'both',
        },
      );
      try {
        await stageAnimation.finished;
      } catch {
        // Cancellation during a rapid exit/dispose is expected.
      }
      stageAnimation = null;
    }

    setTransitionClass(false);
    commitLayoutOnce();
  };

  const enterEmbeddedFullscreen = async () => {
    if (disposed || transitionPending || mode !== 'inactive') return;
    transitionPending = true;
    capturePanelState();
    mode = 'embedded';
    syncButton();

    try {
      await runHorizontalStageTransition(() => {
        setEmbeddedModeClass(true);
        setPanelCollapsed(true);
      });
      if (RUNTIME_IS_DEVELOPMENT) {
        console.info('[ORBITAL fullscreen] Native fullscreen blocked — embedded stage mode entered');
      }
    } finally {
      transitionPending = false;
    }
  };

  const enterFullscreen = async () => {
    if (disposed || transitionPending || isFullscreen()) return;
    if (nativeFullscreenBlocked || !document.documentElement.requestFullscreen) {
      await enterEmbeddedFullscreen();
      return;
    }

    transitionPending = true;
    capturePanelState();
    try {
      // Keep the current layout untouched until the native request resolves. This avoids
      // the old collapse-then-restore bounce when an iframe permissions policy rejects it.
      await requestElementFullscreen(document.documentElement as FullscreenElement);
      // fullscreenchange is authoritative and owns the actual layout transition.
      // Keep the input lock until that transition completes when the event already fired.
      if (getNativeFullscreenElement() && activeTransitionPromise) {
        await activeTransitionPromise;
      } else {
        transitionPending = false;
      }
    } catch (error) {
      transitionPending = false;
      if (isPermissionsPolicyRejection(error)) nativeFullscreenBlocked = true;
      await enterEmbeddedFullscreen();
      return;
    }
    if (mode !== 'native') transitionPending = false;
  };

  const exitEmbeddedFullscreen = async () => {
    if (disposed || transitionPending || mode !== 'embedded') return;
    transitionPending = true;
    mode = 'inactive';
    syncButton();
    try {
      await runHorizontalStageTransition(() => {
        setEmbeddedModeClass(false);
        restoreCapturedPanelState();
      });
      if (RUNTIME_IS_DEVELOPMENT) console.info('[ORBITAL fullscreen] Fullscreen exited');
    } finally {
      transitionPending = false;
    }
  };

  const exitFullscreen = async () => {
    if (disposed || transitionPending) return;
    if (mode === 'embedded') {
      await exitEmbeddedFullscreen();
      return;
    }
    if (!getNativeFullscreenElement()) return;

    transitionPending = true;
    try {
      await exitDocumentFullscreen();
      // fullscreenchange restores the panel and commits layout.
      if (!getNativeFullscreenElement() && activeTransitionPromise) {
        await activeTransitionPromise;
      }
    } catch (error) {
      if (RUNTIME_IS_DEVELOPMENT) console.warn('[ORBITAL fullscreen] Unable to exit fullscreen', error);
    } finally {
      // When fullscreenchange already moved us to inactive, its horizontal
      // transition still owns the lock until the final layout commit.
      if (mode === 'native') transitionPending = false;
    }
  };

  const toggleFullscreen = async () => {
    if (transitionPending) {
      if (RUNTIME_IS_DEVELOPMENT) console.debug('[ORBITAL fullscreen] Transition ignored — already in progress');
      return;
    }
    if (isFullscreen()) await exitFullscreen();
    else await enterFullscreen();
  };

  const handleFullscreenChange = () => {
    if (disposed) return;
    const nativeActive = getNativeFullscreenElement() !== null;

    if (nativeActive) {
      mode = 'native';
      transitionPending = true;
      capturePanelState();
      syncButton();
      activeTransitionPromise = runHorizontalStageTransition(() => setPanelCollapsed(true)).finally(() => {
        transitionPending = false;
        activeTransitionPromise = null;
        if (RUNTIME_IS_DEVELOPMENT) console.info('[ORBITAL fullscreen] Native fullscreen entered');
      });
      void activeTransitionPromise;
      return;
    }

    if (mode === 'native') {
      mode = 'inactive';
      transitionPending = true;
      syncButton();
      activeTransitionPromise = runHorizontalStageTransition(() => restoreCapturedPanelState()).finally(() => {
        transitionPending = false;
        activeTransitionPromise = null;
        if (RUNTIME_IS_DEVELOPMENT) console.info('[ORBITAL fullscreen] Fullscreen exited');
      });
      void activeTransitionPromise;
    }
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isFullscreen()) return;
    if (mode === 'embedded') {
      event.preventDefault();
      event.stopPropagation();
    }
    // Native browsers usually consume Escape first; this fallback also supports
    // preview hosts and deterministic keyboard/controller testing.
    void exitFullscreen();
  };

  const handleButtonClick = () => {
    void toggleFullscreen();
  };

  if (button) button.addEventListener('click', handleButtonClick);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
  document.addEventListener('keydown', handleEscape, true);

  const controller: FullscreenController = {
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
    isFullscreen,
    getMode: () => mode,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (button) button.removeEventListener('click', handleButtonClick);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
      document.removeEventListener('keydown', handleEscape, true);
      if (settleRaf) cancelAnimationFrame(settleRaf);
      stageAnimation?.cancel();
      stageAnimation = null;
      setTransitionClass(false);
      setEmbeddedModeClass(false);
      if (activeFullscreenController === controller) activeFullscreenController = null;
      if (panelStateCaptured) restoreCapturedPanelState();
    },
  };

  activeFullscreenController = controller;
  syncButton();
  return controller;
}
