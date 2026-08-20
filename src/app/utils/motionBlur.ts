/**
 * ORBITAL Motion Blur Trails - True Afterimage Effect
 * 
 * Implements persistent frame trails by blending previous frames with current frame.
 * Creates smooth motion blur / echo effects without performance overhead.
 * 
 * @module motionBlur
 */

export interface MotionBlurConfig {
  enabled: boolean;
  persistence: number; // 0.0-1.0: How much previous frame persists (0=no trail, 1=infinite trail)
  fadeMode: 'multiply' | 'alpha'; // Fade technique: multiply for colored trails, alpha for traditional
}

export class MotionBlurEngine {
  private trailCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private trailCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private frameCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private frameCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private width: number = 0;
  private height: number = 0;
  private initialized: boolean = false;

  constructor() {
    // Lazy initialization - canvas created on first use
  }

  /**
   * Initialize or resize the trail buffer
   */
  public init(width: number, height: number): void {
    // Only reinitialize if dimensions changed
    if (this.initialized && this.width === width && this.height === height) {
      return;
    }

    // Create trail buffer canvas if needed
    if (!this.trailCanvas) {
      const makeCanvas = () => typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(Math.max(1, width), Math.max(1, height))
        : document.createElement('canvas');

      this.trailCanvas = makeCanvas();
      this.frameCanvas = makeCanvas();
      this.trailCtx = this.trailCanvas.getContext('2d', {
        alpha: true,
        desynchronized: true,
        willReadFrequently: false
      }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      this.frameCtx = this.frameCanvas.getContext('2d', {
        alpha: true,
        desynchronized: true,
        willReadFrequently: false
      }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

      if (!this.trailCtx || !this.frameCtx) {
        console.error('❌ Failed to create motion blur contexts');
        return;
      }
    }

    // Resize trail buffer
    this.trailCanvas.width = width;
    this.trailCanvas.height = height;
    if (this.frameCanvas) {
      this.frameCanvas.width = width;
      this.frameCanvas.height = height;
    }
    this.width = width;
    this.height = height;
    this.initialized = true;

    // Clear on resize
    this.clear();

    console.log(`✅ Motion Blur initialized: ${width}x${height}`);
  }

  /**
   * Clear the trail buffer
   */
  public clear(): void {
    if (!this.trailCtx) return;
    this.trailCtx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Ensure the trail buffer exists and matches the live render surface.
   * Motion blur is intentionally lazy so there is zero trail-canvas cost while disabled.
   */
  private ensureInitialized(mainCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): boolean {
    const mainCanvas = mainCtx.canvas;
    const width = Math.max(1, mainCanvas.width);
    const height = Math.max(1, mainCanvas.height);

    if (!this.initialized || !this.trailCtx || !this.trailCanvas || width !== this.width || height !== this.height) {
      this.init(width, height);
    }

    return Boolean(this.initialized && this.trailCtx && this.trailCanvas && this.frameCtx && this.frameCanvas);
  }

  /**
   * Apply motion blur effect to current frame
   * 
   * @param mainCtx - Main canvas context to apply effect to
   * @param config - Motion blur configuration
   */
  public applyTrail(mainCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, config: MotionBlurConfig): void {
    this.postRenderCapture(mainCtx, config);
  }

  /**
   * Pre-render mode: Draw trail buffer before current frame
   * More traditional motion blur - previous frames appear behind current frame
   */
  public preRenderTrail(mainCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, config: MotionBlurConfig): void {
    // Intentionally do not composite the historical trail before rendering.
    // Doing so would cause postRenderCapture() to recapture the trail and feed it
    // back into itself recursively. We only ensure the buffers are ready here.
    if (config.enabled) this.ensureInitialized(mainCtx);
  }

  /**
   * Post-render mode: Capture current frame into trail buffer
   * Call AFTER rendering main content
   */
  public postRenderCapture(mainCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, config: MotionBlurConfig): void {
    if (!config.enabled || !this.ensureInitialized(mainCtx) || !this.frameCtx || !this.frameCanvas || !this.trailCtx || !this.trailCanvas) {
      return;
    }

    const intensity = Math.max(0, Math.min(1, Number.isFinite(config.persistence) ? config.persistence : 0));
    if (intensity <= 0.001) {
      this.clear();
      return;
    }

    // Capture ONLY the clean current frame. The historical trail has not yet been
    // drawn onto mainCtx, so this buffer can never recursively contain itself.
    this.frameCtx.save();
    this.frameCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.frameCtx.globalCompositeOperation = 'copy';
    this.frameCtx.globalAlpha = 1;
    this.frameCtx.clearRect(0, 0, this.width, this.height);
    this.frameCtx.drawImage(mainCtx.canvas, 0, 0, this.width, this.height);
    this.frameCtx.restore();

    // Map the UI intensity to a bounded temporal retention. Even at 100%, a small
    // decay remains so trails cannot become permanent or accumulate without bound.
    const retention = Math.min(0.95, 0.42 + intensity * 0.53);
    const decay = 1 - retention;

    this.trailCtx.save();
    this.trailCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.trailCtx.globalCompositeOperation = 'destination-out';
    this.trailCtx.globalAlpha = decay;
    this.trailCtx.fillStyle = '#000';
    this.trailCtx.fillRect(0, 0, this.width, this.height);
    this.trailCtx.restore();

    // Add the clean current frame to the historical buffer. Screen blending ignores
    // the black background while retaining bright moving geometry and color trails.
    this.trailCtx.save();
    this.trailCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.trailCtx.globalCompositeOperation = 'screen';
    this.trailCtx.globalAlpha = config.fadeMode === 'multiply' ? 0.62 : 0.42;
    this.trailCtx.drawImage(this.frameCanvas, 0, 0);
    this.trailCtx.restore();

    // Composite the historical trail onto the already-rendered clean frame ONCE.
    // This is the key difference from the old recursive echo implementation.
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.globalCompositeOperation = 'screen';
    mainCtx.globalAlpha = 0.08 + intensity * 0.42;
    mainCtx.drawImage(this.trailCanvas, 0, 0, this.width, this.height);
    mainCtx.restore();
  }

  /**
   * Destroy and cleanup resources
   */
  public destroy(): void {
    if (this.trailCanvas) {
      this.trailCanvas.width = 0;
      this.trailCanvas.height = 0;
      this.trailCanvas = null;
    }
    if (this.frameCanvas) {
      this.frameCanvas.width = 0;
      this.frameCanvas.height = 0;
      this.frameCanvas = null;
    }
    this.trailCtx = null;
    this.frameCtx = null;
    this.initialized = false;
  }

  /**
   * Get current dimensions
   */
  public getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Check if engine is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance for global use
let globalMotionBlurEngine: MotionBlurEngine | null = null;

/**
 * Get or create the global motion blur engine
 */
export function getMotionBlurEngine(): MotionBlurEngine {
  if (!globalMotionBlurEngine) {
    globalMotionBlurEngine = new MotionBlurEngine();
  }
  return globalMotionBlurEngine;
}

/**
 * Destroy global motion blur engine
 */
export function destroyMotionBlurEngine(): void {
  if (globalMotionBlurEngine) {
    globalMotionBlurEngine.destroy();
    globalMotionBlurEngine = null;
  }
}