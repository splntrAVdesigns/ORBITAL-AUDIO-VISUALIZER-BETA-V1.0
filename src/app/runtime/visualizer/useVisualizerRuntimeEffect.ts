import { useEffect } from 'react';
import { createVisualizerRuntimeSession } from './createVisualizerRuntimeSession';
import { flattenVisualizerRuntimeOptions, type VisualizerRuntimeEffectOptions } from './VisualizerRuntimeBindings';

function createDetachedHostRef(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return { current: canvas };
}

/**
 * Thin React adapter. In worker mode the runtime session is an audio/control
 * host and receives detached canvases, so it never calls getContext() on the
 * visible canvases after they have transferred to OffscreenCanvas.
 */
export function useVisualizerRuntimeEffect(options: VisualizerRuntimeEffectOptions & { enabled?: boolean; activationKey?: number }): void {
  const appState = options.lifecycle.appState;
  const enabled = options.enabled ?? true;
  const activationKey = options.activationKey ?? 0;
  const renderOnMainThread = options.lifecycle.renderOnMainThread !== false;
  const renderWebGLOnMainThread = options.lifecycle.renderWebGLOnMainThread !== false;
  useEffect(() => {
    if (!enabled) return;
    if (renderOnMainThread) return createVisualizerRuntimeSession(flattenVisualizerRuntimeOptions(options));

    const visible = options.lifecycle.canvasRef.current as HTMLCanvasElement | null;
    const width = visible?.width ?? Math.max(1, Math.round(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2)));
    const height = visible?.height ?? Math.max(1, Math.round(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)));
    const hostOptions = {
      ...options,
      lifecycle: {
        ...options.lifecycle,
        canvasRef: createDetachedHostRef(width, height),
        glCanvasRef: createDetachedHostRef(width, height),
      },
    } as VisualizerRuntimeEffectOptions;
    return createVisualizerRuntimeSession(flattenVisualizerRuntimeOptions(hostOptions));
  // Render ownership is immutable for the lifetime of this runtime session.
  // Phase 4.8F.1 keeps production rendering on the main-thread host while the
  // renderer/kernel boundary remains available for a future clean cutover.
  }, [appState, enabled, activationKey, renderOnMainThread]);
}
