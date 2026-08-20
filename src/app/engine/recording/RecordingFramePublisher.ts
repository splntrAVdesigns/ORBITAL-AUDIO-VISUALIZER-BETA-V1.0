export interface RecordingFramePublisherOptions {
  canvas: HTMLCanvasElement;
  glCanvas?: HTMLCanvasElement | null;
  createCanvas?: () => HTMLCanvasElement;
}

export interface RecordingFrameConfiguration {
  width: number;
  height: number;
  fps: number;
}

interface RequestFrameTrack extends MediaStreamTrack {
  requestFrame?: () => void;
}

/**
 * Main-thread recording compositor driven exclusively by the authoritative
 * visual scheduler. It owns no RAF or timer.
 */
export class RecordingFramePublisher {
  private readonly outputCanvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private stream: MediaStream | null = null;
  private videoTrack: RequestFrameTrack | null = null;
  private targetFps = 30;
  private frameIntervalMs = 1000 / 30;
  private lastFrameAt = Number.NEGATIVE_INFINITY;
  private disposed = false;
  private publishedFrames = 0;

  constructor(private readonly options: RecordingFramePublisherOptions) {
    this.outputCanvas = (options.createCanvas ?? (() => document.createElement('canvas')))();
    const context = this.outputCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false,
    });
    if (!context) throw new Error('Unable to create recording output context');
    this.context = context;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
  }

  configure(config: RecordingFrameConfiguration): void {
    if (this.disposed) throw new Error('Recording frame publisher is disposed');
    this.targetFps = Math.max(1, Math.min(60, Math.round(config.fps)));
    this.frameIntervalMs = 1000 / this.targetFps;
    this.lastFrameAt = Number.NEGATIVE_INFINITY;
    this.publishedFrames = 0;
    if (this.outputCanvas.width !== config.width) this.outputCanvas.width = config.width;
    if (this.outputCanvas.height !== config.height) this.outputCanvas.height = config.height;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
  }

  createStream(): MediaStream {
    this.stopStream();

    let stream: MediaStream;
    try {
      stream = this.outputCanvas.captureStream(0);
    } catch {
      stream = this.outputCanvas.captureStream(this.targetFps);
    }

    let track = stream.getVideoTracks?.()[0] as RequestFrameTrack | undefined;
    if (!track?.requestFrame) {
      for (const candidate of stream.getTracks()) candidate.stop();
      stream = this.outputCanvas.captureStream(this.targetFps);
      track = stream.getVideoTracks?.()[0] as RequestFrameTrack | undefined;
    }

    this.stream = stream;
    this.videoTrack = track ?? null;
    return stream;
  }

  publish(nowMs: number): boolean {
    if (this.disposed || !this.stream) return false;
    if (nowMs - this.lastFrameAt + 0.25 < this.frameIntervalMs) return false;

    if (Number.isFinite(this.lastFrameAt)) {
      const skippedIntervals = Math.max(1, Math.floor((nowMs - this.lastFrameAt) / this.frameIntervalMs));
      this.lastFrameAt += skippedIntervals * this.frameIntervalMs;
    } else {
      this.lastFrameAt = nowMs;
    }

    this.drawCompositeFrame();
    this.videoTrack?.requestFrame?.();
    this.publishedFrames += 1;
    return true;
  }

  getOutputCanvas(): HTMLCanvasElement {
    return this.outputCanvas;
  }

  getPublishedFrames(): number {
    return this.publishedFrames;
  }

  stopStream(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
    }
    this.stream = null;
    this.videoTrack = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopStream();
    this.outputCanvas.width = 1;
    this.outputCanvas.height = 1;
  }

  private drawCompositeFrame(): void {
    const width = this.outputCanvas.width;
    const height = this.outputCanvas.height;
    const source = this.options.canvas;
    const sourceWidth = Math.max(1, source.width);
    const sourceHeight = Math.max(1, source.height);
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const drawX = Math.round((width - drawWidth) * 0.5);
    const drawY = Math.round((height - drawHeight) * 0.5);

    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.globalAlpha = 1;
    this.context.globalCompositeOperation = 'source-over';
    this.context.fillStyle = '#000';
    this.context.fillRect(0, 0, width, height);
    this.context.drawImage(source, 0, 0, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);

    const overlay = this.options.glCanvas;
    if (overlay && overlay.width > 0 && overlay.height > 0) {
      this.context.drawImage(
        overlay,
        0,
        0,
        overlay.width,
        overlay.height,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
    }
  }
}
