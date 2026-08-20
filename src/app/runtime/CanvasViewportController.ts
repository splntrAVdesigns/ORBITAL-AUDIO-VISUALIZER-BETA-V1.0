import { resolveAdaptiveRenderScale, getStoredRenderDisplayMode } from '../utils/adaptiveRenderScale';
import type { ViewportState } from './ViewportState';
import {
  cancelTrackedShortLivedRaf,
  requestTrackedShortLivedRaf,
} from './mainThread/MainThreadAsyncDiagnostics';

export class CanvasViewportController {
  private ro: ResizeObserver | null = null;
  private raf1: number | null = null;
  private raf2: number | null = null;
  private disposed = false;
  private lastW = 0;
  private lastH = 0;
  private latest: ViewportState | null = null;
  private recordingCaptureResolution: { width: number; height: number } | null = null;
  private onWindowResize = () => this.request('window');
  private onFullscreen = () => this.request('fullscreen');

  constructor(
    private readonly stage: HTMLElement,
    private readonly commit: (state: ViewportState) => void,
  ) {
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.request('observer'));
      this.ro.observe(stage);
    }
    window.addEventListener('resize', this.onWindowResize, { passive: true });
    document.addEventListener('fullscreenchange', this.onFullscreen);

    // Stage 1 boot fix: commit a valid viewport synchronously before the first
    // visual frame. The settled two-RAF pass remains as a correction for fonts,
    // panel mounting, fullscreen, and flex-layout changes.
    const initial = this.measure();
    if (initial.cssWidth > 0 && initial.cssHeight > 0) this.commitState(initial);
    this.request('init-settle');
  }

  request(_reason = 'manual'): void {
    if (this.disposed) return;
    cancelTrackedShortLivedRaf(this.raf1);
    cancelTrackedShortLivedRaf(this.raf2);
    this.raf1 = null;
    this.raf2 = null;
    // SHORT_LIVED_LAYOUT_SETTLE_RAF: two-frame geometry confirmation, never continuous.
    this.raf1 = requestTrackedShortLivedRaf('viewport-settle-1', () => {
      this.raf1 = null;
      const a = this.measure();
      this.raf2 = requestTrackedShortLivedRaf('viewport-settle-2', () => {
        this.raf2 = null;
        const b = this.measure();
        const state = (Math.abs(a.cssWidth - b.cssWidth) > 0.5 || Math.abs(a.cssHeight - b.cssHeight) > 0.5) ? b : a;
        if (state.cssWidth > 0 && state.cssHeight > 0) this.commitState(state);
      });
    });
  }

  private commitState(state: ViewportState): void {
    this.lastW = state.cssWidth;
    this.lastH = state.cssHeight;
    this.latest = state;
    this.commit(state);
    this.stage.dataset.viewportReady = 'true';
  }

  private measure(): ViewportState {
    const rect = this.stage.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width || this.lastW || 1);
    const cssHeight = Math.max(1, rect.height || this.lastH || 1);
    const rawDpr = Math.max(window.devicePixelRatio || 1, 1);
    const scale = resolveAdaptiveRenderScale({
      cssWidth,
      cssHeight,
      devicePixelRatio: rawDpr,
      mode: getStoredRenderDisplayMode(),
    });
    if (this.recordingCaptureResolution) {
      const captureDpr = Math.min(
        2,
        Math.max(
          1,
          Math.min(
            this.recordingCaptureResolution.width / cssWidth,
            this.recordingCaptureResolution.height / cssHeight,
          ),
        ),
      );
      if (captureDpr > scale.effectiveDpr) {
        scale.effectiveDpr = captureDpr;
        scale.width = Math.max(1, Math.floor(cssWidth * captureDpr));
        scale.height = Math.max(1, Math.floor(cssHeight * captureDpr));
        scale.pixelCount = scale.width * scale.height;
      }
    }
    return {
      cssWidth,
      cssHeight,
      pixelWidth: scale.width,
      pixelHeight: scale.height,
      dpr: scale.effectiveDpr,
      centerX: cssWidth * 0.5,
      centerY: cssHeight * 0.5,
      aspectRatio: cssWidth / cssHeight,
    };
  }


  setRecordingCaptureResolution(resolution: { width: number; height: number } | null): void {
    if (this.disposed) return;
    this.recordingCaptureResolution = resolution;
    const immediate = this.measure();
    if (immediate.cssWidth > 0 && immediate.cssHeight > 0) this.commitState(immediate);
    this.request(resolution ? 'recording-quality-lock' : 'recording-quality-release');
  }

  get current(): ViewportState | null {
    return this.latest;
  }

  dispose(): void {
    this.disposed = true;
    cancelTrackedShortLivedRaf(this.raf1);
    cancelTrackedShortLivedRaf(this.raf2);
    this.raf1 = null;
    this.raf2 = null;
    this.ro?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
    delete this.stage.dataset.viewportReady;
  }
}
