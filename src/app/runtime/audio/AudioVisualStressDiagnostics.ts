import type { RuntimeResourceScope } from '../visualizer/session/RuntimeResourceDiagnostics';
import { DEVELOPMENT_DIAGNOSTICS_ENABLED, FIELD_CERTIFICATION_ENABLED } from '../../config/runtimeEnvironment';
export interface AudioVisualStressSnapshot {
  waiting: number;
  stalled: number;
  suspend: number;
  errors: number;
  longFramesNearFx: number;
  maxFrameGap: number;
  gamma: number;
  iridize: number;
  graphRevision: number;
  contextState: string;
  baseLatency: number;
  outputLatency: number;
  premiumFxMs: number;
  premiumFxMaxMs: number;
}

/** Debug-only correlation between heavy visual FX, frame stalls and media events. */
export class AudioVisualStressDiagnostics {
  constructor(
    private readonly resources?: RuntimeResourceScope,
    private readonly enabled = DEVELOPMENT_DIAGNOSTICS_ENABLED || FIELD_CERTIFICATION_ENABLED,
  ) {}
  private snapshot: AudioVisualStressSnapshot = {
    waiting: 0, stalled: 0, suspend: 0, errors: 0, longFramesNearFx: 0,
    maxFrameGap: 0, gamma: 0, iridize: 0, graphRevision: 0,
    contextState: 'unknown', baseLatency: 0, outputLatency: 0,
    premiumFxMs: 0, premiumFxMaxMs: 0,
  };
  private cleanups: Array<() => void> = [];
  private lastPublish = 0;

  attach(media: HTMLMediaElement | null): void {
    if (!this.enabled || !media) return;
    const bind = (name: keyof Pick<AudioVisualStressSnapshot, 'waiting'|'stalled'|'suspend'|'errors'>, event: string) => {
      const handler = () => { this.snapshot[name] += 1; this.publish(true); };
      media.addEventListener(event, handler, { passive: true });
      const release = this.resources?.track('activeListeners');
      this.cleanups.push(() => { media.removeEventListener(event, handler); release?.(); });
    };
    bind('waiting', 'waiting');
    bind('stalled', 'stalled');
    bind('suspend', 'suspend');
    bind('errors', 'error');
  }

  recordPremiumFxCost(durationMs: number): void {
    if (!this.enabled) return;
    const value = Math.max(0, Number.isFinite(durationMs) ? durationMs : 0);
    this.snapshot.premiumFxMs += (value - this.snapshot.premiumFxMs) * 0.2;
    this.snapshot.premiumFxMaxMs = Math.max(this.snapshot.premiumFxMaxMs * 0.997, value);
  }

  onFrame(deltaMs: number, gamma: number, iridize: number): void {
    if (!this.enabled) return;
    this.snapshot.gamma = gamma;
    this.snapshot.iridize = iridize;
    this.snapshot.maxFrameGap = Math.max(this.snapshot.maxFrameGap * 0.997, deltaMs);
    if (deltaMs > 34 && gamma > 0.01 && iridize > 0.01) this.snapshot.longFramesNearFx += 1;
    const graph = (window as any).__ORBITAL_AUDIO_GRAPH__;
    if (graph) {
      this.snapshot.graphRevision = graph.revision ?? 0;
      this.snapshot.contextState = graph.state ?? graph.contextState ?? 'unknown';
      this.snapshot.baseLatency = graph.baseLatency ?? 0;
      this.snapshot.outputLatency = graph.outputLatency ?? 0;
    }
    this.publish(false);
  }

  private publish(force: boolean): void {
    if (!this.enabled) return;
    const now = performance.now();
    if (!force && now - this.lastPublish < 250) return;
    this.lastPublish = now;
    (window as any).__ORBITAL_AUDIO_VISUAL_STRESS__ = { ...this.snapshot };
  }

  dispose(): void {
    this.cleanups.splice(0).forEach(fn => fn());
    delete (window as any).__ORBITAL_AUDIO_VISUAL_STRESS__;
  }
}
