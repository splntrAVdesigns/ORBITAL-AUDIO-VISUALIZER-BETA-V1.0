/**
 * Host-neutral surface contract. HTML canvas surfaces satisfy this on the main
 * thread; OffscreenCanvas satisfies it in a worker. Keep the kernel dependent on
 * dimensions/contexts rather than DOM ownership.
 */
export interface RenderSurface<TContext = RenderingContext | null> {
  readonly width: number;
  readonly height: number;
  getContext(contextId: string, options?: unknown): TContext;
}

export interface VisualizerRenderSurfaces {
  canvas2D: HTMLCanvasElement | OffscreenCanvas;
  webgl: HTMLCanvasElement | OffscreenCanvas;
}
