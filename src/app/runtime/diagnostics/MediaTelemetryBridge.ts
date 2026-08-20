import type { RuntimeResourceScope } from '../visualizer/session/RuntimeResourceDiagnostics';

const MEDIA_DIAGNOSTIC_EVENTS = ['waiting', 'stalled', 'emptied', 'abort', 'error', 'ended'] as const;

/** Owns diagnostic listeners for the currently active HTMLAudioElement. */
export class MediaTelemetryBridge {
  private controller: AbortController | null = null;
  private releases: Array<() => void> = [];

  constructor(private readonly resources: RuntimeResourceScope) {}

  attach(element: HTMLAudioElement | null, record: (type: string) => void): void {
    this.detach();
    if (!element) return;
    this.controller = new AbortController();
    for (const type of MEDIA_DIAGNOSTIC_EVENTS) {
      element.addEventListener(type, () => record(type), {
        passive: true,
        signal: this.controller.signal,
      });
      this.releases.push(this.resources.track('activeListeners'));
    }
  }

  detach(): void {
    this.controller?.abort();
    this.controller = null;
    for (const release of this.releases.splice(0)) release();
  }

  dispose(): void {
    this.detach();
  }
}
