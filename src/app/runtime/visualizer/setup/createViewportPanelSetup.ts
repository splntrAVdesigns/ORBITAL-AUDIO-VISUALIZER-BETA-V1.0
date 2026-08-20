import type { ViewportState } from '../../ViewportState';
import { DEVELOPMENT_DIAGNOSTICS_ENABLED, FIELD_CERTIFICATION_ENABLED } from '../../../config/runtimeEnvironment';

export interface ViewportPanelSetupOptions {
  canvas: HTMLCanvasElement;
  glCanvas: HTMLCanvasElement;
  context2D: CanvasRenderingContext2D;
  gl: WebGLRenderingContext | null;
  root: HTMLElement;
  CanvasViewportController: any;
  createPanelController: any;
  webglEngineRef: { current: any };
  resolveAdaptiveRenderScale: (input: any) => any;
  getElement: (selector: string) => Element | null;
  onViewportCommitted?: (snapshot: { width: number; height: number; dpr: number; activeRenderScale: any }) => void;
  /** When false, the transferred HTML canvas backing store is worker-owned. */
  manageWebGLBackingStore?: boolean;
  /** Publishes CSS/DPR viewport changes to the active WebGL render host. */
  onWebGLViewportCommitted?: (snapshot: { width: number; height: number; dpr: number }) => void;
}

export interface ViewportPanelSetupResult {
  getWidth(): number;
  getHeight(): number;
  getDpr(): number;
  getActiveRenderScale(): any;
  viewportController: any;
  panelController: any;
  setPanelW: (...args: any[]) => any;
  toggleCollapse: (...args: any[]) => any;
  resize(): void;
  setRecordingCaptureResolution(resolution: { width: number; height: number } | null): void;
  eventHandlers: Record<string, any>;
  fullscreenState: { wasCollapsedBeforeFullscreen: boolean };
  handleRenderScaleChange: () => void;
  dispose(): void;
}

/** Owns viewport measurement, canvas resize commits, and panel resize wiring. */
export function createViewportPanelSetup(options: ViewportPanelSetupOptions): ViewportPanelSetupResult {
  const {
    canvas,
    glCanvas,
    context2D,
    gl,
    root,
    CanvasViewportController,
    createPanelController,
    webglEngineRef,
    resolveAdaptiveRenderScale,
    getElement,
    onViewportCommitted,
    manageWebGLBackingStore = true,
    onWebGLViewportCommitted,
  } = options;

  let width = 0;
  let height = 0;
  let dpr = Math.max(window.devicePixelRatio || 1, 1);
  let activeRenderScale = resolveAdaptiveRenderScale({ cssWidth: 1, cssHeight: 1, devicePixelRatio: dpr });
  let viewportController: any = null;
  const fullscreenState = { wasCollapsedBeforeFullscreen: false };

  const commitViewport = (viewport: ViewportState) => {
    width = viewport.cssWidth;
    height = viewport.cssHeight;
    dpr = viewport.dpr;
    activeRenderScale = {
      ...activeRenderScale,
      width: viewport.pixelWidth,
      height: viewport.pixelHeight,
      effectiveDpr: viewport.dpr,
      pixelCount: viewport.pixelWidth * viewport.pixelHeight,
    };
    if (DEVELOPMENT_DIAGNOSTICS_ENABLED || FIELD_CERTIFICATION_ENABLED) (window as any).__ORBITAL_RENDER_SCALE__ = activeRenderScale;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (canvas.width !== viewport.pixelWidth) canvas.width = viewport.pixelWidth;
    if (canvas.height !== viewport.pixelHeight) canvas.height = viewport.pixelHeight;
    context2D.setTransform(dpr, 0, 0, dpr, 0, 0);

    // CSS sizing remains DOM-owned after transferControlToOffscreen(), but the
    // HTMLCanvasElement backing width/height become immutable from the main thread.
    // Never write those attributes while the worker owns #glCanvas.
    glCanvas.style.width = `${width}px`;
    glCanvas.style.height = `${height}px`;
    if (manageWebGLBackingStore) {
      if (glCanvas.width !== viewport.pixelWidth) glCanvas.width = viewport.pixelWidth;
      if (glCanvas.height !== viewport.pixelHeight) glCanvas.height = viewport.pixelHeight;
      if (gl) gl.viewport(0, 0, viewport.pixelWidth, viewport.pixelHeight);
      webglEngineRef.current?.resize(width, height, dpr);
    } else {
      onWebGLViewportCommitted?.({ width, height, dpr });
    }
    onViewportCommitted?.({ width, height, dpr, activeRenderScale });
  };

  const resize = () => viewportController?.request('legacy-bridge');
  const stageElement = document.getElementById('stage');
  if (stageElement) viewportController = new CanvasViewportController(stageElement, commitViewport);

  const eventHandlers = {
    windowWheel: null,
    windowKeydownImages: null,
    windowKeydownShortcuts: null,
    documentClick: null,
    documentMousemove: null,
    documentMouseup: null,
  } as Record<string, any>;

  const panelController = createPanelController({
    root,
    getElement,
    resize,
    getFullscreenElement: () => document.body.classList.contains('orbital-stage-fullscreen')
      ? document.documentElement
      : document.fullscreenElement ?? (document as any).webkitFullscreenElement ?? null,
  });

  const handleRenderScaleChange = () => resize();
  window.addEventListener('orbital:render-scale-change', handleRenderScaleChange);

  return {
    getWidth: () => width,
    getHeight: () => height,
    getDpr: () => dpr,
    getActiveRenderScale: () => activeRenderScale,
    viewportController,
    panelController,
    setPanelW: panelController.setPanelW,
    toggleCollapse: panelController.toggleCollapse,
    resize,
    setRecordingCaptureResolution: (resolution) => viewportController?.setRecordingCaptureResolution(resolution),
    eventHandlers,
    fullscreenState,
    handleRenderScaleChange,
    dispose() {
      window.removeEventListener('orbital:render-scale-change', handleRenderScaleChange);
      viewportController?.dispose();
      panelController.dispose();
    },
  };
}
