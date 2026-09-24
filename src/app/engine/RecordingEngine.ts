/**
 * ORBITAL — Recording Engine
 * Owns exact-dimension canvas recording, authoritative-frame publication,
 * saved-recording object URLs, bounded capture memory, and GIF export.
 */

import type { GIFExporter as GIFExporterClass } from '../utils/gifExport';
import { RecordingFramePublisher } from './recording/RecordingFramePublisher';
import {
  extensionForMimeType,
  resolveRecordingOptions,
  trimRecordingLibraryToBudget,
  type ResolvedRecordingStartOptions,
} from './recording/RecordingProfiles';
import type {
  RecordingCodec,
  RecordingQuality,
  RecordingStartOptions,
  RecordingToggleResult,
} from './recording/RecordingRuntimeController';

export const MAX_RECORDINGS = 8;
export const MAX_RECORDING_LIBRARY_BYTES = 384 * 1024 * 1024;
export const MAX_SINGLE_RECORDING_BYTES = 256 * 1024 * 1024;
export const MAX_MANUAL_RECORDING_SECONDS = 300;

function formatRecordingClock(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export interface RecordingItem {
  blob: Blob;
  url: string;
  timestamp: number;
  duration: number;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  codec?: RecordingCodec;
  quality?: RecordingQuality;
  mimeType?: string;
  extension?: 'webm' | 'mp4';
  videoBitsPerSecond?: number;
  publishedFrames?: number;
}

export interface RecordingEngineOptions {
  canvas: HTMLCanvasElement;
  glCanvas?: HTMLCanvasElement | null;
  params: Record<string, any>;
  getRecordingFPS: () => number;
  getRecordingResolution: () => string;
  getRecordingDuration: () => number;
  getRecordingCodec: () => RecordingCodec;
  getRecordingQuality: () => RecordingQuality;
  setRecordingCaptureResolution?: (resolution: { width: number; height: number } | null) => void;

  setIsRecording: (v: boolean) => void;
  setRecordingTimeLeft: (v: number) => void;
  setRecordingLibrary: (v: RecordingItem[]) => void;

  getIsPlaying: () => boolean;
  setIsPlaying: (v: boolean) => void;
  getIsMicActive: () => boolean;
  getMediaEl: () => HTMLMediaElement | null;
  getAC: () => AudioContext | null;
  getCurrentPlayPromise: () => Promise<void> | null;
  setCurrentPlayPromise: (p: Promise<void> | null) => void;
  setAudioStartTime: (v: number) => void;

  trackMetadata: { recTime: string };
  updateMetadataDisplay: () => void;
  root: Element | null;
}

export class RecordingEngine {
  private recorder: MediaRecorder | null = null;
  private framePublisher: RecordingFramePublisher | null = null;
  private recordingStream: MediaStream | null = null;
  private recChunks: BlobPart[] = [];
  private recTimer: ReturnType<typeof setTimeout> | null = null;
  private recordingStartTime = 0;
  private recordingTargetDuration = 0;
  private recordingBytes = 0;
  private recordingLibrary: RecordingItem[] = [];
  private activeRecordingOptions: ResolvedRecordingStartOptions | null = null;
  private activeMimeType = 'video/webm';
  private stopReason: 'user' | 'duration' | 'size' | 'dispose' | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private countdownCleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownElement: HTMLElement | null = null;
  private countdownPending = false;
  private disposed = false;
  private discardCurrentRecording = false;
  private finishingRecording = false;

  private gifExporter: GIFExporterClass | null = null;
  // Sprint B: gifExport.ts (~20KB) plus its vendored gif.js glue is only ever
  // needed once a user actually exports a GIF. Loaded on demand via
  // import(), cached here once fetched so init()'s 500ms prefetch and the
  // later real export share one module instance instead of importing twice.
  private gifExportModule: typeof import('../utils/gifExport') | null = null;
  private gifExportState = { isRecording: false, isEncoding: false, progress: 0 };
  private gifStartTime = 0;
  private gifTargetDuration = 0;
  private gifPreflightTimer: ReturnType<typeof setTimeout> | null = null;
  private gifPreflightController: AbortController | null = null;
  private gifModalCloseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: RecordingEngineOptions) {}

  isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  requestStart(options: Partial<RecordingStartOptions> = {}): RecordingToggleResult {
    if (this.disposed) return 'unavailable';
    if (this.isRecording() || this.countdownPending) return 'pending';

    const resolved = this.resolveStartOptions(options);
    if (this.opts.params.recordCountdown) {
      this.showCountdownThenRecord(resolved);
      return 'pending';
    }

    this.autoPlayAudioIfNeeded();
    return this.start(resolved) ? 'started' : 'unavailable';
  }

  toggle(options: Partial<RecordingStartOptions> = {}): RecordingToggleResult {
    if (this.isRecording()) {
      this.stop();
      return 'stopped';
    }
    if (this.countdownPending) {
      this.cancelCountdown();
      return 'stopped';
    }
    return this.requestStart(options);
  }

  publishFrame(nowMs: number): boolean {
    if (!this.isRecording()) return false;
    return this.framePublisher?.publish(nowMs) ?? false;
  }

  deleteRecording(index: number): boolean {
    if (index < 0 || index >= this.recordingLibrary.length) return false;
    const [removed] = this.recordingLibrary.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.url);
    this.publishLibrary();
    return Boolean(removed);
  }

  clearRecordings(): number {
    const count = this.recordingLibrary.length;
    for (const item of this.recordingLibrary) URL.revokeObjectURL(item.url);
    this.recordingLibrary = [];
    this.publishLibrary();
    return count;
  }

  getRecordingLibraryBytes(): number {
    return this.recordingLibrary.reduce((total, item) => total + item.blob.size, 0);
  }

  init(): void {
    this.gifPreflightController = new AbortController();
    this.gifPreflightTimer = setTimeout(() => {
      this.gifPreflightTimer = null;
      void import('../utils/gifExport').then((mod) => {
        this.gifExportModule = mod;
        void mod.waitForGIFLibrary(3000, this.gifPreflightController?.signal);
      });
    }, 500);
  }

  start(options: Partial<RecordingStartOptions> = {}): boolean {
    if (this.disposed || this.isRecording()) return false;

    const resolved = this.resolveStartOptions(options);
    this.opts.setRecordingCaptureResolution?.({ width: resolved.width, height: resolved.height });

    try {
      this.framePublisher?.dispose();
      this.framePublisher = new RecordingFramePublisher({
        canvas: this.opts.canvas,
        glCanvas: this.opts.glCanvas,
      });
      this.framePublisher.configure(resolved);
      this.recordingStream = this.framePublisher.createStream();
    } catch (error) {
      console.error('[ORBITAL recording] Unable to create exact-dimension recording stream', error);
      this.releaseRecordingPipeline();
      this.opts.setIsRecording(false);
      return false;
    }

    const recorderSelection = this.createMediaRecorder(this.recordingStream, resolved);
    if (!recorderSelection) {
      this.releaseRecordingPipeline();
      this.opts.setIsRecording(false);
      return false;
    }

    this.recorder = recorderSelection.recorder;
    this.activeMimeType = recorderSelection.mimeType;
    this.activeRecordingOptions = resolved;
    this.discardCurrentRecording = false;
    this.stopReason = null;
    this.recordingBytes = 0;
    this.recChunks = [];
    this.recordingStartTime = performance.now();
    this.recordingTargetDuration = resolved.duration;
    this.opts.setIsRecording(true);

    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size <= 0) return;
      this.recChunks.push(event.data);
      this.recordingBytes += event.data.size;
      if (this.recordingBytes >= MAX_SINGLE_RECORDING_BYTES && this.recorder?.state === 'recording') {
        this.stopReason = 'size';
        console.warn('[ORBITAL recording] Recording reached the safe size limit and was stopped.');
        this.stop();
      }
    };

    this.recorder.onstop = () => this.finishRecording();
    this.recorder.onerror = (event) => {
      console.error('[ORBITAL recording] MediaRecorder error', event);
      this.discardCurrentRecording = true;
      if (this.recorder?.state === 'recording') {
        try { this.recorder.stop(); } catch { this.finishRecording(); }
      } else {
        this.finishRecording();
      }
    };

    try {
      this.recorder.start(1000);
    } catch (error) {
      console.error('[ORBITAL recording] MediaRecorder failed to start', error);
      this.discardCurrentRecording = true;
      this.releaseRecordingPipeline();
      this.recorder = null;
      this.opts.setIsRecording(false);
      return false;
    }

    this.framePublisher.publish(this.recordingStartTime);
    this.opts.trackMetadata.recTime = formatRecordingClock(0);
    this.opts.setRecordingTimeLeft(resolved.duration > 0 ? resolved.duration : 0);
    this.opts.updateMetadataDisplay();

    const stopAfterSeconds = resolved.duration > 0
      ? Math.min(resolved.duration, MAX_MANUAL_RECORDING_SECONDS)
      : MAX_MANUAL_RECORDING_SECONDS;
    this.recTimer = setTimeout(() => {
      if (!this.isRecording()) return;
      this.stopReason = resolved.duration > 0 ? 'duration' : 'duration';
      if (resolved.duration === 0) {
        console.warn('[ORBITAL recording] Manual recording reached the safe duration limit and was stopped.');
      }
      this.stop();
    }, stopAfterSeconds * 1000);

    return true;
  }

  stop(): boolean {
    if (this.recTimer) {
      clearTimeout(this.recTimer);
      this.recTimer = null;
    }
    const cancelledCountdown = this.countdownPending;
    this.cancelCountdown();
    if (this.recorder && this.recorder.state === 'recording') {
      if (!this.stopReason) this.stopReason = 'user';
      this.recorder.stop();
      return true;
    }
    return cancelledCountdown;
  }

  updateHUD(): void {
    if (!this.recorder || this.recorder.state !== 'recording') return;
    const elapsed = Math.max(0, (performance.now() - this.recordingStartTime) / 1000);
    this.opts.trackMetadata.recTime = formatRecordingClock(elapsed);
    if (this.recordingTargetDuration > 0) {
      this.opts.setRecordingTimeLeft(Math.ceil(Math.max(0, this.recordingTargetDuration - elapsed)));
    } else {
      this.opts.setRecordingTimeLeft(0);
    }
    this.opts.updateMetadataDisplay();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.discardCurrentRecording = true;
    this.stopReason = 'dispose';
    this.cancelCountdown();
    this.stop();
    if (this.gifPreflightTimer !== null) {
      clearTimeout(this.gifPreflightTimer);
      this.gifPreflightTimer = null;
    }
    this.gifPreflightController?.abort();
    this.gifPreflightController = null;
    this.clearGIFModalCloseTimer();
    if (this.gifExporter) {
      this.gifExporter.dispose();
      this.gifExporter = null;
    }
    this.hideGIFProgressModal();
    this.releaseRecordingPipeline();
    for (const recording of this.recordingLibrary) URL.revokeObjectURL(recording.url);
    this.recordingLibrary = [];
  }

  private finishRecording(): void {
    if (this.finishingRecording) return;
    this.finishingRecording = true;
    const resolved = this.activeRecordingOptions;
    const recorder = this.recorder;
    const chunks = this.recChunks;
    const duration = Math.max(0, (performance.now() - this.recordingStartTime) / 1000);
    this.recChunks = [];

    const shouldSave = Boolean(
      resolved
      && !this.disposed
      && !this.discardCurrentRecording
      && chunks.length > 0,
    );

    if (shouldSave && resolved) {
      const mimeType = recorder?.mimeType || this.activeMimeType || 'video/webm';
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      this.recordingLibrary.push({
        blob,
        url,
        timestamp: Date.now(),
        duration,
        resolution: resolved.resolution,
        width: resolved.width,
        height: resolved.height,
        fps: resolved.fps,
        codec: resolved.codec,
        quality: resolved.quality,
        mimeType,
        extension: extensionForMimeType(mimeType),
        videoBitsPerSecond: resolved.videoBitsPerSecond,
        publishedFrames: this.framePublisher?.getPublishedFrames() ?? 0,
      });
      this.enforceLibraryBudget();
      this.publishLibrary();
    }

    this.opts.setIsRecording(false);
    this.opts.setRecordingTimeLeft(0);
    this.opts.trackMetadata.recTime = '—';
    this.opts.updateMetadataDisplay();
    this.releaseRecordingPipeline();
    this.recorder = null;
    this.activeRecordingOptions = null;
    this.recordingBytes = 0;
    this.discardCurrentRecording = false;
    this.stopReason = null;
    this.finishingRecording = false;
  }

  private createMediaRecorder(
    stream: MediaStream,
    resolved: ResolvedRecordingStartOptions,
  ): { recorder: MediaRecorder; mimeType: string } | null {
    const supported = resolved.mimeCandidates.filter((candidate) => MediaRecorder.isTypeSupported(candidate));
    for (const mimeType of supported) {
      try {
        return {
          recorder: new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: resolved.videoBitsPerSecond,
          }),
          mimeType,
        };
      } catch { }
    }

    try {
      const recorder = new MediaRecorder(stream, {
        videoBitsPerSecond: resolved.videoBitsPerSecond,
      });
      return { recorder, mimeType: recorder.mimeType || 'video/webm' };
    } catch (error) {
      console.error('[ORBITAL recording] MediaRecorder initialization failed', error);
      return null;
    }
  }

  private enforceLibraryBudget(): void {
    const evicted = trimRecordingLibraryToBudget(
      this.recordingLibrary,
      MAX_RECORDINGS,
      MAX_RECORDING_LIBRARY_BYTES,
    );
    for (const recording of evicted) URL.revokeObjectURL(recording.url);
  }

  private resolveStartOptions(options: Partial<RecordingStartOptions>): ResolvedRecordingStartOptions {
    return resolveRecordingOptions({
      resolution: options.resolution ?? this.opts.getRecordingResolution() ?? '1080p',
      fps: options.fps ?? this.opts.getRecordingFPS() ?? this.opts.params.recordFPS ?? 30,
      duration: options.duration ?? this.opts.getRecordingDuration() ?? 0,
      codec: options.codec ?? this.opts.getRecordingCodec() ?? 'vp9',
      quality: options.quality ?? this.opts.getRecordingQuality() ?? 'high',
      videoBitsPerSecond: options.videoBitsPerSecond,
    });
  }

  private publishLibrary(): void {
    this.opts.setRecordingLibrary([...this.recordingLibrary]);
  }

  private releaseRecordingPipeline(): void {
    if (this.recTimer) {
      clearTimeout(this.recTimer);
      this.recTimer = null;
    }
    this.framePublisher?.dispose();
    this.framePublisher = null;
    this.recordingStream = null;
    this.opts.setRecordingCaptureResolution?.(null);
  }

  private showCountdownThenRecord(options: ResolvedRecordingStartOptions): void {
    this.cancelCountdown();
    this.countdownPending = true;
    const countdownEl = document.createElement('div');
    const isPanelCollapsed = document.body.classList.contains('collapsed');
    const isFullscreen = !!document.fullscreenElement;
    let leftPosition = '20px';
    if (!isPanelCollapsed && !isFullscreen && this.opts.root) {
      const panelWidth = getComputedStyle(this.opts.root as HTMLElement).getPropertyValue('--panelW');
      leftPosition = `${parseInt(panelWidth || '480', 10) + 20}px`;
    }
    countdownEl.style.cssText = `position:fixed;top:20px;left:${leftPosition};font-size:48px;font-weight:900;color:var(--neonBlue);text-shadow:0 0 40px rgba(30,144,255,1);z-index:10000;font-family:monospace;pointer-events:none;background:rgba(0,0,0,.6);padding:12px 20px;border-radius:4px;border:2px solid var(--neonBlue);`;
    document.body.appendChild(countdownEl);
    this.countdownElement = countdownEl;
    let count = 3;
    countdownEl.textContent = String(count);
    this.countdownInterval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        countdownEl.textContent = String(count);
        return;
      }
      if (this.countdownInterval !== null) clearInterval(this.countdownInterval);
      this.countdownInterval = null;
      countdownEl.textContent = 'RECORD';
      this.countdownCleanupTimer = setTimeout(() => {
        this.countdownCleanupTimer = null;
        countdownEl.remove();
        if (this.countdownElement === countdownEl) this.countdownElement = null;
      }, 500);
      this.countdownPending = false;
      this.autoPlayAudioIfNeeded();
      this.start(options);
    }, 1000);
  }

  private autoPlayAudioIfNeeded(): void {
    const mediaEl = this.opts.getMediaEl();
    if (!mediaEl || this.opts.getIsPlaying() || this.opts.getIsMicActive()) return;
    this.opts.setIsPlaying(true);
    void this.opts.getAC()?.resume();
    const playPromise = mediaEl.play() as Promise<void> | undefined;
    if (playPromise) {
      this.opts.setCurrentPlayPromise(playPromise);
      playPromise.then(() => {
        this.opts.setAudioStartTime(performance.now());
        this.opts.setCurrentPlayPromise(null);
      }).catch((error: Error) => {
        if (error.name !== 'AbortError') this.opts.setIsPlaying(false);
        this.opts.setCurrentPlayPromise(null);
      });
    } else {
      this.opts.setAudioStartTime(performance.now());
    }
  }

  private cancelCountdown(): void {
    if (this.countdownInterval !== null) clearInterval(this.countdownInterval);
    if (this.countdownCleanupTimer !== null) clearTimeout(this.countdownCleanupTimer);
    this.countdownInterval = null;
    this.countdownCleanupTimer = null;
    this.countdownElement?.remove();
    this.countdownElement = null;
    this.countdownPending = false;
  }

  // ── Private: GIF Export ───────────────────────────────────────────────────

  private async initGIFExporter(): Promise<void> {
    if (!this.gifExporter) {
      const mod = this.gifExportModule ?? (this.gifExportModule = await import('../utils/gifExport'));
      this.gifExporter = new mod.GIFExporter(this.opts.canvas);
    }
  }

  private async startGIFRecording(): Promise<void> {
    await this.initGIFExporter();
    const gifModule = this.gifExportModule!;

    const duration = 5;
    this.gifTargetDuration = duration;
    this.gifStartTime = performance.now();

    this.showGIFProgressModal();

    await this.gifExporter!.startRecording({
      duration,
      fps: 30,
      quality: 10,
      onPlan: (plan) => {
        this.gifTargetDuration = plan.duration;
        const statusText = document.getElementById('gifStatusText');
        if (statusText && plan.adjusted) {
          statusText.textContent = `Memory-safe capture: ${plan.width}×${plan.height} @ ${plan.fps} FPS`;
        }
      },
      onProgress: (progress) => {
        this.gifExportState.progress = progress;
        this.gifExportState.isRecording = progress < 0.5;
        this.gifExportState.isEncoding = progress >= 0.5 && progress < 1;
        this.updateGIFProgressModal();
        const elapsed = (performance.now() - this.gifStartTime) / 1000;
        const remaining = Math.max(0, this.gifTargetDuration - elapsed);
        this.opts.trackMetadata.recTime = progress < 0.5 ? gifModule.formatDuration(remaining) : 'ENC';
        this.opts.updateMetadataDisplay();
      },
      onError: (error: Error) => {
        console.error('GIF Export Error:', error);
        alert(`GIF Export Failed: ${error.message}`);
        this.resetGIFUI();
      },
    });

    const exporterState = this.gifExporter?.getState();
    if (!exporterState?.isRecording && !exporterState?.isEncoding) {
      this.resetGIFUI();
      return;
    }

    this.gifExportState.isRecording = exporterState.isRecording;
    this.gifExportState.isEncoding = exporterState.isEncoding;

    console.log(`🎬 GIF Recording started: ${this.gifTargetDuration}s`);
  }

  private stopGIFRecording(): void {
    if (this.gifExporter) {
      this.gifExporter.cancel();
      this.resetGIFUI();
      console.log('⏹️ GIF Recording cancelled');
    }
  }

  private showGIFProgressModal(): void {
    this.clearGIFModalCloseTimer();
    this.hideGIFProgressModal();
    const modal = document.createElement('div');
    modal.id = 'gifProgressModal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background: rgba(8, 12, 18, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(8px);
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: linear-gradient(135deg, #0a0e17 0%, #1a1e24 100%);
      border: 2px solid var(--neonBlue);
      border-radius: 12px;
      padding: 32px;
      min-width: 400px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(30, 144, 255, 0.4);
      text-align: center;
    `;
    content.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">🎨</div>
      <h2 style="color: var(--neonBlue); margin-bottom: 8px; font-size: 20px;">Creating GIF</h2>
      <div id="gifStatusText" style="color: #7a94aa; margin-bottom: 24px; font-size: 14px;">Recording frames...</div>
      <div style="background: #0a0e17; border-radius: 8px; overflow: hidden; height: 24px; margin-bottom: 12px;">
        <div id="gifProgressBar" style="background: linear-gradient(90deg, var(--neonBlue), #00BFFF); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
      </div>
      <div id="gifProgressPercent" style="color: var(--neonBlue); font-weight: bold; font-size: 18px; font-family: monospace;">0%</div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  private updateGIFProgressModal(): void {
    const progressBar = document.getElementById('gifProgressBar');
    const progressPercent = document.getElementById('gifProgressPercent');
    const statusText = document.getElementById('gifStatusText');

    if (progressBar) {
      progressBar.style.width = `${this.gifExportState.progress * 100}%`;
    }
    if (progressPercent) {
      progressPercent.textContent = `${Math.round(this.gifExportState.progress * 100)}%`;
    }
    if (statusText) {
      statusText.textContent = this.gifExportState.progress < 0.5
        ? 'Recording frames...'
        : 'Encoding GIF...';
    }

    if (this.gifExportState.progress >= 1.0 && this.gifModalCloseTimer === null) {
      this.gifModalCloseTimer = setTimeout(() => {
        this.gifModalCloseTimer = null;
        this.resetGIFUI();
      }, 1000);
    }
  }

  private clearGIFModalCloseTimer(): void {
    if (this.gifModalCloseTimer !== null) {
      clearTimeout(this.gifModalCloseTimer);
      this.gifModalCloseTimer = null;
    }
  }

  private resetGIFUI(): void {
    this.clearGIFModalCloseTimer();
    this.gifExportState = { isRecording: false, isEncoding: false, progress: 0 };
    this.hideGIFProgressModal();
    this.opts.trackMetadata.recTime = '—';
    this.opts.updateMetadataDisplay();
  }

  private hideGIFProgressModal(): void {
    document.getElementById('gifProgressModal')?.remove();
  }
}