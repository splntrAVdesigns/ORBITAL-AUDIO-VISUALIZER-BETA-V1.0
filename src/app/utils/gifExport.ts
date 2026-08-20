/**
 * ORBITAL GIF Export
 *
 * Memory-contained GIF recording for social sharing. Frames are handed to
 * gif.js as they are captured; ORBITAL never retains a parallel ImageData[]
 * collection. A conservative working-set budget automatically adjusts FPS and
 * dimensions before capture begins.
 */

interface GIFEncoderLike {
  addFrame(
    image: CanvasRenderingContext2D | HTMLCanvasElement | ImageData,
    options: { delay: number; copy?: boolean },
  ): void;
  on(event: 'progress', callback: (progress: number) => void): GIFEncoderLike;
  on(event: 'finished', callback: (blob: Blob) => void): GIFEncoderLike;
  on(event: 'abort', callback: () => void): GIFEncoderLike;
  render(): void;
  abort?: () => void;
}

interface GIFConstructorLike {
  new (options: {
    workers: number;
    quality: number;
    width: number;
    height: number;
    background: string;
    workerScript: string;
  }): GIFEncoderLike;
}

// gif.js is loaded by index.html.
declare const GIF: GIFConstructorLike | undefined;

export const DEFAULT_GIF_MEMORY_BUDGET_BYTES = 96 * 1024 * 1024;
const MAX_GIF_DIMENSION = 800;
const MIN_GIF_DIMENSION = 160;
const PREFERRED_MIN_FPS = 15;
const ABSOLUTE_MIN_FPS = 8;
const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 10;
const ENCODER_FRAME_OVERHEAD_MULTIPLIER = 1.9;
const SCRATCH_FRAME_COUNT = 3;
const GIF_WORKER_SCRIPT = '/vendor/gif.worker.js';

export interface GIFExportOptions {
  duration: number;
  fps: number;
  quality: number;
  width?: number;
  height?: number;
  memoryBudgetBytes?: number;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onPlan?: (plan: GIFExportPlan) => void;
}

export interface GIFExportPlanInput {
  sourceWidth: number;
  sourceHeight: number;
  duration: number;
  fps: number;
  width?: number;
  height?: number;
  memoryBudgetBytes?: number;
}

export interface GIFExportPlan {
  requestedDuration: number;
  requestedFps: number;
  requestedWidth: number;
  requestedHeight: number;
  duration: number;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  bytesPerFrame: number;
  estimatedWorkingSetBytes: number;
  memoryBudgetBytes: number;
  adjusted: boolean;
}

export interface GIFExportState {
  isRecording: boolean;
  isEncoding: boolean;
  progress: number;
  framesRecorded: number;
  totalFrames: number;
  startTime: number;
  error: Error | null;
  plan: GIFExportPlan | null;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const evenDimension = (value: number): number => Math.max(2, Math.floor(value / 2) * 2);

export function estimateGIFWorkingSetBytes(
  width: number,
  height: number,
  totalFrames: number,
): number {
  const bytesPerFrame = Math.max(1, width) * Math.max(1, height) * 4;
  return Math.ceil(
    bytesPerFrame * (
      Math.max(1, totalFrames) * ENCODER_FRAME_OVERHEAD_MULTIPLIER
      + SCRATCH_FRAME_COUNT
    ),
  );
}

export function createGIFExportPlan(input: GIFExportPlanInput): GIFExportPlan {
  const sourceWidth = Math.max(1, Math.floor(input.sourceWidth));
  const sourceHeight = Math.max(1, Math.floor(input.sourceHeight));
  const requestedDuration = clamp(
    Number.isFinite(input.duration) ? input.duration : 5,
    MIN_DURATION_SECONDS,
    MAX_DURATION_SECONDS,
  );
  const requestedFps = Math.round(clamp(
    Number.isFinite(input.fps) ? input.fps : 30,
    ABSOLUTE_MIN_FPS,
    30,
  ));
  const memoryBudgetBytes = Math.max(
    32 * 1024 * 1024,
    Math.floor(input.memoryBudgetBytes ?? DEFAULT_GIF_MEMORY_BUDGET_BYTES),
  );

  const requestedMaxDimension = Math.min(
    MAX_GIF_DIMENSION,
    Math.max(
      input.width ?? sourceWidth,
      input.height ?? sourceHeight,
    ),
  );
  const sourceScale = Math.min(1, requestedMaxDimension / Math.max(sourceWidth, sourceHeight));

  let width = evenDimension(input.width ?? sourceWidth * sourceScale);
  let height = evenDimension(input.height ?? sourceHeight * sourceScale);
  width = clamp(width, MIN_GIF_DIMENSION, MAX_GIF_DIMENSION);
  height = clamp(height, MIN_GIF_DIMENSION, MAX_GIF_DIMENSION);

  const requestedWidth = width;
  const requestedHeight = height;
  let duration = requestedDuration;
  let fps = requestedFps;

  const estimate = (): { totalFrames: number; workingSet: number } => {
    const totalFrames = Math.max(1, Math.floor(duration * fps));
    return {
      totalFrames,
      workingSet: estimateGIFWorkingSetBytes(width, height, totalFrames),
    };
  };

  let current = estimate();
  let guard = 0;
  while (current.workingSet > memoryBudgetBytes && guard < 300) {
    guard += 1;

    if (fps > PREFERRED_MIN_FPS) {
      fps -= 1;
    } else if (Math.max(width, height) > 240) {
      width = evenDimension(Math.max(MIN_GIF_DIMENSION, width * 0.95));
      height = evenDimension(Math.max(MIN_GIF_DIMENSION, height * 0.95));
    } else if (fps > ABSOLUTE_MIN_FPS) {
      fps -= 1;
    } else if (duration > MIN_DURATION_SECONDS) {
      duration = Math.max(MIN_DURATION_SECONDS, duration - 0.5);
    } else {
      break;
    }

    current = estimate();
  }

  return {
    requestedDuration,
    requestedFps,
    requestedWidth,
    requestedHeight,
    duration,
    fps,
    width,
    height,
    totalFrames: current.totalFrames,
    bytesPerFrame: width * height * 4,
    estimatedWorkingSetBytes: current.workingSet,
    memoryBudgetBytes,
    adjusted:
      duration !== requestedDuration
      || fps !== requestedFps
      || width !== requestedWidth
      || height !== requestedHeight,
  };
}

export function isGIFLibraryAvailable(): boolean {
  return typeof GIF !== 'undefined';
}

export function waitForGIFLibrary(
  timeout: number = 5000,
  signal?: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (isGIFLibraryAvailable()) {
      resolve(true);
      return;
    }

    let settled = false;
    const finish = (available: boolean): void => {
      if (settled) return;
      settled = true;
      clearInterval(checkInterval);
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', handleAbort);
      resolve(available);
    };
    const handleAbort = (): void => finish(false);
    const checkInterval = setInterval(() => {
      if (isGIFLibraryAvailable()) finish(true);
    }, 100);
    const timeoutId = setTimeout(() => finish(false), Math.max(0, timeout));

    if (signal?.aborted) {
      finish(false);
    } else {
      signal?.addEventListener('abort', handleAbort, { once: true });
    }
  });
}

export class GIFExporter {
  private readonly canvas: HTMLCanvasElement;
  private state: GIFExportState;
  private options: Required<Omit<GIFExportOptions, 'onError' | 'onPlan'>> & {
    onError?: (error: Error) => void;
    onPlan?: (plan: GIFExportPlan) => void;
  };

  private captureCanvas: HTMLCanvasElement | null = null;
  private captureContext: CanvasRenderingContext2D | null = null;
  private encoder: GIFEncoderLike | null = null;
  private captureRafId: number | null = null;
  private captureTimerId: ReturnType<typeof setTimeout> | null = null;
  private libraryWaitController: AbortController | null = null;
  private activeDownloadUrl: string | null = null;
  private downloadRevokeTimerId: ReturnType<typeof setTimeout> | null = null;
  private operationRevision = 0;
  private cancellationRequested = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = this.createIdleState();
    this.options = {
      duration: 5,
      fps: 30,
      quality: 10,
      width: 800,
      height: 800,
      memoryBudgetBytes: DEFAULT_GIF_MEMORY_BUDGET_BYTES,
      onProgress: () => {},
    };
  }

  getState(): GIFExportState {
    return {
      ...this.state,
      plan: this.state.plan ? { ...this.state.plan } : null,
    };
  }

  async startRecording(options: Partial<GIFExportOptions> = {}): Promise<void> {
    if (this.state.isRecording || this.state.isEncoding) {
      console.warn('[ORBITAL GIF] Export already in progress');
      return;
    }

    this.cancelInternal(false);
    const revision = ++this.operationRevision;
    this.cancellationRequested = false;
    this.libraryWaitController = new AbortController();

    const isAvailable = await waitForGIFLibrary(5000, this.libraryWaitController.signal);
    this.libraryWaitController = null;
    if (revision !== this.operationRevision || this.cancellationRequested) return;
    if (!isAvailable) {
      this.handleError(new Error('GIF library failed to load. Please refresh the page and try again.'));
      return;
    }

    this.options = {
      ...this.options,
      ...options,
    };

    const plan = createGIFExportPlan({
      sourceWidth: this.canvas.width,
      sourceHeight: this.canvas.height,
      duration: this.options.duration,
      fps: this.options.fps,
      width: options.width,
      height: options.height,
      memoryBudgetBytes: this.options.memoryBudgetBytes,
    });
    this.options.width = plan.width;
    this.options.height = plan.height;
    this.options.duration = plan.duration;
    this.options.fps = plan.fps;
    this.options.onPlan?.(plan);

    if (plan.adjusted) {
      console.info(
        `[ORBITAL GIF] Capture adjusted to ${plan.width}×${plan.height} @ ${plan.fps} FPS `
        + `for ${plan.duration}s (${Math.round(plan.estimatedWorkingSetBytes / 1024 / 1024)} MB budgeted).`,
      );
    }

    const GifCtor = GIF;
    if (!GifCtor) {
      this.handleError(new Error('GIF library is unavailable.'));
      return;
    }

    this.captureCanvas = document.createElement('canvas');
    this.captureCanvas.width = plan.width;
    this.captureCanvas.height = plan.height;
    this.captureContext = this.captureCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
    });
    if (!this.captureContext) {
      this.releaseCaptureResources();
      this.handleError(new Error('Unable to create GIF capture surface.'));
      return;
    }

    this.encoder = new GifCtor({
      workers: 2,
      quality: this.options.quality,
      width: plan.width,
      height: plan.height,
      background: '#080c12',
      workerScript: GIF_WORKER_SCRIPT,
    });
    this.attachEncoderHandlers(this.encoder, revision);

    this.state = {
      isRecording: true,
      isEncoding: false,
      progress: 0,
      framesRecorded: 0,
      totalFrames: plan.totalFrames,
      startTime: performance.now(),
      error: null,
      plan,
    };

    console.log(
      `[ORBITAL GIF] Recording ${plan.duration}s @ ${plan.fps} FPS `
      + `(${plan.totalFrames} frames, ${plan.width}×${plan.height}).`,
    );
    this.captureFrame(revision);
  }

  stopRecording(): void {
    this.clearCaptureSchedule();
    this.state.isRecording = false;
  }

  cancel(): void {
    this.cancelInternal(true);
  }

  dispose(): void {
    this.cancelInternal(true);
    this.releaseDownloadUrl();
  }

  private captureFrame = (revision: number): void => {
    if (
      revision !== this.operationRevision
      || !this.state.isRecording
      || !this.encoder
      || !this.captureContext
      || !this.state.plan
    ) {
      return;
    }

    const { width, height, fps } = this.state.plan;
    this.captureContext.setTransform(1, 0, 0, 1, 0, 0);
    this.captureContext.clearRect(0, 0, width, height);
    this.captureContext.drawImage(this.canvas, 0, 0, width, height);

    // copy:true is required because the same scratch canvas/context is reused.
    this.encoder.addFrame(this.captureContext, {
      copy: true,
      delay: Math.max(1, Math.round(1000 / fps)),
    });
    this.state.framesRecorded += 1;
    this.publishProgress((this.state.framesRecorded / this.state.totalFrames) * 0.5);

    if (this.state.framesRecorded >= this.state.totalFrames) {
      this.clearCaptureSchedule();
      this.state.isRecording = false;
      this.state.isEncoding = true;
      this.releaseCaptureSurface();
      try {
        this.encoder.render();
      } catch (error) {
        this.failEncoding(error, revision);
      }
      return;
    }

    const frameDelay = Math.max(1, Math.round(1000 / fps));
    this.captureTimerId = setTimeout(() => {
      this.captureTimerId = null;
      if (revision !== this.operationRevision || !this.state.isRecording) return;
      this.captureRafId = requestAnimationFrame(() => {
        this.captureRafId = null;
        this.captureFrame(revision);
      });
    }, frameDelay);
  };

  private attachEncoderHandlers(encoder: GIFEncoderLike, revision: number): void {
    encoder.on('progress', (progress: number) => {
      if (revision !== this.operationRevision || !this.state.isEncoding) return;
      this.publishProgress(0.5 + clamp(progress, 0, 1) * 0.5);
    });

    encoder.on('finished', (blob: Blob) => {
      if (revision !== this.operationRevision || this.cancellationRequested) return;
      this.publishProgress(1);
      this.downloadGIF(blob);
      this.finishOperation();
    });

    encoder.on('abort', () => {
      if (revision !== this.operationRevision || this.cancellationRequested) return;
      this.handleError(new Error('GIF encoding was aborted or failed.'));
      this.finishOperation();
    });
  }

  private failEncoding(error: unknown, revision: number): void {
    if (revision !== this.operationRevision) return;
    const normalized = error instanceof Error
      ? error
      : new Error('Unknown error during GIF encoding.');
    this.handleError(normalized);
    this.finishOperation();
  }

  private publishProgress(progress: number): void {
    this.state.progress = clamp(progress, 0, 1);
    this.options.onProgress(this.state.progress);
  }

  private finishOperation(): void {
    this.clearCaptureSchedule();
    this.encoder = null;
    this.releaseCaptureResources();
    this.state = this.createIdleState();
  }

  private cancelInternal(markCancelled: boolean): void {
    if (markCancelled) this.cancellationRequested = true;
    this.operationRevision += 1;
    this.libraryWaitController?.abort();
    this.libraryWaitController = null;
    this.clearCaptureSchedule();

    const encoder = this.encoder;
    this.encoder = null;
    if (encoder?.abort) {
      try {
        encoder.abort();
      } catch {
        // Some gif.js builds throw when abort() is called before render().
      }
    }

    this.releaseCaptureResources();
    this.state = this.createIdleState();
  }

  private clearCaptureSchedule(): void {
    if (this.captureTimerId !== null) {
      clearTimeout(this.captureTimerId);
      this.captureTimerId = null;
    }
    if (this.captureRafId !== null) {
      cancelAnimationFrame(this.captureRafId);
      this.captureRafId = null;
    }
  }

  private releaseCaptureSurface(): void {
    if (this.captureCanvas) {
      this.captureCanvas.width = 0;
      this.captureCanvas.height = 0;
    }
    this.captureContext = null;
    this.captureCanvas = null;
  }

  private releaseCaptureResources(): void {
    this.releaseCaptureSurface();
  }

  private downloadGIF(blob: Blob): void {
    this.releaseDownloadUrl();
    const url = URL.createObjectURL(blob);
    this.activeDownloadUrl = url;
    const anchor = document.createElement('a');
    anchor.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    anchor.download = `ORBITAL-${timestamp}.gif`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    this.downloadRevokeTimerId = setTimeout(() => {
      this.downloadRevokeTimerId = null;
      this.releaseDownloadUrl();
    }, 1000);
  }

  private releaseDownloadUrl(): void {
    if (this.downloadRevokeTimerId !== null) {
      clearTimeout(this.downloadRevokeTimerId);
      this.downloadRevokeTimerId = null;
    }
    if (this.activeDownloadUrl) {
      URL.revokeObjectURL(this.activeDownloadUrl);
      this.activeDownloadUrl = null;
    }
  }

  private createIdleState(): GIFExportState {
    return {
      isRecording: false,
      isEncoding: false,
      progress: 0,
      framesRecorded: 0,
      totalFrames: 0,
      startTime: 0,
      error: null,
      plan: null,
    };
  }

  private handleError(error: Error): void {
    this.state.error = error;
    this.options.onError?.(error);
    console.error('[ORBITAL GIF]', error.message);
  }
}

export function formatDuration(seconds: number): string {
  return `${seconds}s`;
}

export function estimateFileSize(duration: number, fps: number = 30): string {
  const estimatedBytes = duration * fps * 6800;
  if (estimatedBytes < 1024 * 1024) {
    return `~${Math.round(estimatedBytes / 1024)}KB`;
  }
  return `~${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB`;
}
