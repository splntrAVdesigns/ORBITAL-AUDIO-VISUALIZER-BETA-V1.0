import { FIELD_CERTIFICATION_ENABLED } from '../../../config/runtimeEnvironment';
import type { RuntimeResourceScope } from '../session/RuntimeResourceDiagnostics';
import type { RuntimeSessionDisposer } from '../session/RuntimeSessionDisposer';
import { createLegacyWebGLSetup } from './createLegacyWebGLSetup';
import { createViewportPanelSetup, type ViewportPanelSetupResult } from './createViewportPanelSetup';
import { DarkStrobeRenderer } from '../renderers/DarkStrobeRenderer';

interface MutableRef<T> {
  current: T;
}

export interface RendererViewportMetrics {
  width: number;
  height: number;
  dpr: number;
}

export interface RendererViewportSetupOptions {
  canvas: HTMLCanvasElement;
  context2D: CanvasRenderingContext2D;
  root: HTMLElement;
  glCanvasRef: MutableRef<HTMLCanvasElement | null>;
  sessionDisposer: RuntimeSessionDisposer;
  resourceScope: RuntimeResourceScope;
  abortInitialization(message: string): void;
  CORE_PARTICLES_SANDBOX: boolean;
  CanvasViewportController: any;
  DEBUG_FLAGS: { GENERAL: boolean };
  DEBUG_WEBGL: boolean;
  WebGLEngine: new (canvas: HTMLCanvasElement, options: { enableGpuTimers: boolean }) => any;
  createPanelController: any;
  setUseWebGL: (value: boolean) => void;
  useWebGLRef: MutableRef<boolean>;
  useWebGLCoreParticlesRef: MutableRef<boolean>;
  webglEngineRef: MutableRef<any>;
  compileShader: (gl: WebGLRenderingContext, type: number, source: string) => WebGLShader | null;
  linkProgram: (gl: WebGLRenderingContext, vertex: WebGLShader, fragment: WebGLShader) => WebGLProgram | null;
  spikeRingVertexShader: string;
  spikeRingFragmentShader: string;
  resolveAdaptiveRenderScale: (input: any) => any;
  getElement(selector: string): Element | null;
  getViewportMetrics(): RendererViewportMetrics;
  onViewportCommitted(snapshot: { width: number; height: number; dpr: number; activeRenderScale: any }): void;
  renderWebGLOnMainThread?: boolean;
}

export interface RendererViewportSetup {
  glCanvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null;
  webglSpikeRenderer: ReturnType<typeof createLegacyWebGLSetup>['spikeRenderer'];
  darkStrobeRenderer: DarkStrobeRenderer | null;
  ensureCoreParticlesGpuRenderer(): any | null;
  disableCoreParticlesGpuRenderer(error: unknown): void;
  viewportPanelSetup: ViewportPanelSetupResult;
}

/**
 * Owns legacy spike WebGL, lazy Core Particles GPU construction, and viewport/panel
 * wiring. Frame behavior remains in the runtime session; this factory only establishes
 * renderer resources and registers their deterministic disposal with the session.
 */
export function createRendererViewportSetup(options: RendererViewportSetupOptions): RendererViewportSetup | null {
  const {
    canvas,
    context2D,
    root,
    glCanvasRef,
    sessionDisposer,
    resourceScope,
    abortInitialization,
    CORE_PARTICLES_SANDBOX,
    CanvasViewportController,
    DEBUG_FLAGS,
    DEBUG_WEBGL,
    WebGLEngine,
    createPanelController,
    setUseWebGL,
    useWebGLRef,
    useWebGLCoreParticlesRef,
    webglEngineRef,
    compileShader,
    linkProgram,
    spikeRingVertexShader,
    spikeRingFragmentShader,
    resolveAdaptiveRenderScale,
    getElement,
    getViewportMetrics,
    onViewportCommitted,
    renderWebGLOnMainThread = true,
  } = options;

  const glCanvas = glCanvasRef.current;
  if (!glCanvas) {
    abortInitialization('⚠️ WebGL canvas ref not available');
    return null;
  }

  const legacyWebGL = renderWebGLOnMainThread
    ? createLegacyWebGLSetup({
        glCanvas,
        shouldInitLegacyGL: !CORE_PARTICLES_SANDBOX && !useWebGLCoreParticlesRef.current,
        debugGeneral: DEBUG_FLAGS.GENERAL,
        debugWebGL: DEBUG_WEBGL,
        setUseWebGL,
        useWebGLRef,
        compileShader,
        linkProgram,
        vertexShader: spikeRingVertexShader,
        fragmentShader: spikeRingFragmentShader,
      })
    : { gl: null, spikeRenderer: null, dispose() {} };
  sessionDisposer.add(() => legacyWebGL.dispose());
  if (legacyWebGL.gl) sessionDisposer.add(resourceScope.track('activeWebGLContexts'));

  let darkStrobeRenderer: DarkStrobeRenderer | null = null;
  if (renderWebGLOnMainThread) {
    try {
      darkStrobeRenderer = new DarkStrobeRenderer(glCanvas);
      sessionDisposer.add(() => darkStrobeRenderer?.dispose());
      // Legacy Spike WebGL already owns the shared-context diagnostic token.
      if (!legacyWebGL.gl) sessionDisposer.add(resourceScope.track('activeWebGLContexts'));
    } catch (error) {
      console.warn('[Dark Strobe] Top WebGL pass unavailable; effect remains disabled.', error);
    }
  }

  let coreParticlesGpuUnavailable = false;
  let releaseCoreParticlesGpuContext: (() => void) | null = null;

  const ensureCoreParticlesGpuRenderer = (): any | null => {
    if (webglEngineRef.current) return webglEngineRef.current;
    if (coreParticlesGpuUnavailable) return null;
    try {
      const metrics = getViewportMetrics();
      const engine = new WebGLEngine(glCanvas, {
        enableGpuTimers: FIELD_CERTIFICATION_ENABLED,
      });
      engine.resize(Math.max(1, metrics.width), Math.max(1, metrics.height), metrics.dpr);
      webglEngineRef.current = engine;
      // Dark Strobe and Core Particles share the same overlay/context. Only add
      // a diagnostic token when no earlier top-pass owner established it.
      releaseCoreParticlesGpuContext = darkStrobeRenderer || legacyWebGL.gl
        ? null
        : resourceScope.track('activeWebGLContexts');
      return engine;
    } catch (error) {
      coreParticlesGpuUnavailable = true;
      glCanvas.style.visibility = 'hidden';
      console.warn('[Core Particles] WebGL2 initialization failed; using frozen Canvas2D fallback.', error);
      return null;
    }
  };

  const disableCoreParticlesGpuRenderer = (error: unknown): void => {
    console.warn('[Core Particles] GPU render failed; freezing GPU path and restoring Canvas2D.', error);
    coreParticlesGpuUnavailable = true;
    webglEngineRef.current?.dispose();
    webglEngineRef.current = null;
    releaseCoreParticlesGpuContext?.();
    releaseCoreParticlesGpuContext = null;
    glCanvas.style.visibility = 'hidden';
  };

  sessionDisposer.add(() => {
    webglEngineRef.current?.dispose();
    webglEngineRef.current = null;
    releaseCoreParticlesGpuContext?.();
    releaseCoreParticlesGpuContext = null;
  });

  const viewportPanelSetup = createViewportPanelSetup({
    canvas,
    glCanvas,
    context2D,
    gl: legacyWebGL.gl,
    root,
    CanvasViewportController,
    createPanelController,
    webglEngineRef,
    resolveAdaptiveRenderScale,
    getElement,
    onViewportCommitted,
    manageWebGLBackingStore: true,
  });
  sessionDisposer.add(() => viewportPanelSetup.dispose());

  return {
    glCanvas,
    gl: legacyWebGL.gl,
    webglSpikeRenderer: legacyWebGL.spikeRenderer,
    darkStrobeRenderer,
    ensureCoreParticlesGpuRenderer,
    disableCoreParticlesGpuRenderer,
    viewportPanelSetup,
  };
}
