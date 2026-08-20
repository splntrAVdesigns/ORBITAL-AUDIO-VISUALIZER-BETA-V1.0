import { disposeWebGLAstralRenderer } from '../../../engine/WebGLAstralRenderer';
import { disposeLiquidShaperCanvasCaches } from '../../../utils/astralShaper';
import { cancelTrackedShortLivedRaf } from '../../mainThread/MainThreadAsyncDiagnostics';
import { RuntimeAsyncRegistry } from './RuntimeAsyncRegistry';
import { RuntimeEventRegistry } from './RuntimeEventRegistry';
import { createRuntimeResourceScope, type RuntimeResourceScope } from './RuntimeResourceDiagnostics';
import { RuntimeSessionDisposer } from './RuntimeSessionDisposer';

interface MutableRef<T> {
  current: T;
}

export interface RuntimeSessionInfrastructureOptions {
  appState: unknown;
  debugGeneral: boolean;
  canvasRef: MutableRef<HTMLCanvasElement | null>;
  rootRef: MutableRef<HTMLElement | null>;
  initializedRef: MutableRef<boolean>;
  initializingRef: MutableRef<boolean>;
}

export interface RuntimeSessionInfrastructure {
  canvas: HTMLCanvasElement;
  root: HTMLElement;
  ctx: CanvasRenderingContext2D;
  sessionDisposer: RuntimeSessionDisposer;
  resourceScope: RuntimeResourceScope;
  asyncRegistry: RuntimeAsyncRegistry;
  eventRegistry: RuntimeEventRegistry;
  astralStrokeStyleRaf: MutableRef<number | null>;
  abortInitialization(message: string): void;
}

/**
 * Creates the lifecycle-owned resources for one non-React visualizer session.
 * It intentionally owns no renderer, audio, or controller behavior; callers compose
 * those domains after this factory has established deterministic cleanup ownership.
 */
export function createRuntimeSessionInfrastructure(
  options: RuntimeSessionInfrastructureOptions,
): RuntimeSessionInfrastructure | null {
  const {
    appState,
    debugGeneral,
    canvasRef,
    rootRef,
    initializedRef,
    initializingRef,
  } = options;

  // Only initialize the visualizer when the main app is loaded.
  if (appState !== 'main') {
    if (debugGeneral) console.log('⏭️  Skipping: appState is not "main"');
    return null;
  }

  if (debugGeneral) console.log('✅ appState is "main", checking guards...');

  // React Strict Mode intentionally double-invokes effects in development.
  if (initializingRef.current || initializedRef.current) {
    if (debugGeneral) console.log('⏭️  Skipping duplicate initialization (React Strict Mode)');
    return null;
  }

  const canvas = canvasRef.current;
  const root = rootRef.current;

  // Do not latch the initialization guards until the required mount resources exist.
  // This keeps React Strict Mode and transient mount/layout timing recoverable.
  if (!canvas || !root) {
    initializingRef.current = false;
    initializedRef.current = false;
    return null;
  }

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d', { alpha: true, desynchronized: true, willReadFrequently: false });
  } catch {
    ctx = canvas.getContext('2d', { desynchronized: true }) ?? canvas.getContext('2d');
  }
  if (!ctx) {
    initializingRef.current = false;
    initializedRef.current = false;
    return null;
  }

  // Required resources are valid; initialization is now officially in progress.
  initializingRef.current = true;
  initializedRef.current = true;

  const sessionDisposer = new RuntimeSessionDisposer();
  const resourceScope = createRuntimeResourceScope('ORBITAL visualizer session');
  // Registered first so LIFO cleanup closes/asserts the resource scope last.
  sessionDisposer.add(() => resourceScope.close());

  const asyncRegistry = new RuntimeAsyncRegistry(resourceScope);
  const eventRegistry = new RuntimeEventRegistry(resourceScope);
  const astralStrokeStyleRaf: MutableRef<number | null> = { current: null };

  sessionDisposer.add(() => asyncRegistry.dispose());
  sessionDisposer.add(() => {
    cancelTrackedShortLivedRaf(astralStrokeStyleRaf.current);
    astralStrokeStyleRaf.current = null;
  });
  sessionDisposer.add(() => eventRegistry.dispose());
  sessionDisposer.add(() => disposeWebGLAstralRenderer());
  sessionDisposer.add(() => disposeLiquidShaperCanvasCaches());
  sessionDisposer.add(() => {
    const runtimeWindow = window as any;
    delete runtimeWindow.__ORBITAL_RAF_CRASH_COUNT__;
    delete runtimeWindow.__ORBITAL_AUDIO_VISUAL_STRESS__;
    delete runtimeWindow.__ORBITAL_INTERACTION_METRICS__;
    delete runtimeWindow.__ORBITAL_SPARK_DIAGNOSTICS__;
    delete runtimeWindow.__ORBITAL_CORE_PARTICLES_GPU__;
    delete runtimeWindow.__ORBITAL_AUDIO_SOAK__;
    if (runtimeWindow.RadialAnalyzer?.setPalette) delete runtimeWindow.RadialAnalyzer.setPalette;
  });

  return {
    canvas,
    root,
    ctx,
    sessionDisposer,
    resourceScope,
    asyncRegistry,
    eventRegistry,
    astralStrokeStyleRaf,
    abortInitialization(message: string): void {
      console.warn(message);
      sessionDisposer.dispose();
      initializingRef.current = false;
      initializedRef.current = false;
    },
  };
}
