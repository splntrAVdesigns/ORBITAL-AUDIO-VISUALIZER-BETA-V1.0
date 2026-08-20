import { MediaTelemetryBridge } from '../../diagnostics/MediaTelemetryBridge';
import type { RuntimeResourceScope } from '../session/RuntimeResourceDiagnostics';

/** Mutable audio/media state shared by initialization, controls, recording, and frames. */
export class RuntimeAudioSessionState {
  isPlaying = false;
  usingMic = false;
  currentPlayPromise: Promise<void> | null = null;
  mediaElement: HTMLAudioElement | null = null;
  monitorEnabled = false;
  beatCounter = 0;
  initializationStartTime = 0;
  audioStartTime = 0;

  private metadataUpdater: () => void = () => {};
  private attachStressDiagnostics: (media: HTMLMediaElement | null) => void = () => {};
  private readonly mediaTelemetryBridge: MediaTelemetryBridge;
  private disposed = false;

  constructor(
    resourceScope: RuntimeResourceScope,
    private readonly developmentDiagnosticsEnabled: boolean,
  ) {
    this.mediaTelemetryBridge = new MediaTelemetryBridge(resourceScope);
  }

  setMediaElement(mediaElement: HTMLAudioElement | null): void {
    this.mediaElement = mediaElement;
    (window as any).mediaEl = mediaElement as any;
    this.attachStressDiagnostics(mediaElement);
    if (this.developmentDiagnosticsEnabled) {
      this.mediaTelemetryBridge.attach(
        mediaElement,
        (type) => (window as any).__ORBITAL_CRASH_TELEMETRY__?.recordAudioEvent?.(type),
      );
    }
  }

  setMetadataUpdater(metadataUpdater: () => void): void {
    this.metadataUpdater = metadataUpdater;
  }

  notifyMetadataUpdated(): void {
    this.metadataUpdater();
  }

  setStressDiagnosticsAttacher(attachStressDiagnostics: (media: HTMLMediaElement | null) => void): void {
    this.attachStressDiagnostics = attachStressDiagnostics;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.currentPlayPromise?.catch(() => {});
    this.currentPlayPromise = null;
    if (this.mediaElement) {
      try { this.mediaElement.pause(); } catch {}
      this.mediaElement.removeAttribute('src');
      this.mediaElement.load();
    }
    this.mediaElement = null;
    const runtimeWindow = window as any;
    if (runtimeWindow.mediaEl) runtimeWindow.mediaEl = null;
    this.mediaTelemetryBridge.dispose();
  }
}
