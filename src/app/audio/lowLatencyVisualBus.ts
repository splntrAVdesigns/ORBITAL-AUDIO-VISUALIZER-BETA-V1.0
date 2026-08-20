import type { AudioBandSnapshot } from './audioBands';
import { DEVELOPMENT_DIAGNOSTICS_ENABLED } from '../config/runtimeEnvironment';

export interface LowLatencyVisualBusSnapshot {
  transient: number;
  energy: number;
  bassTransient: number;
  micMode: boolean;
}

export class LowLatencyVisualBus {
  private fast = 0;
  private slow = 0;
  private lastBass = 0;
  snapshot: LowLatencyVisualBusSnapshot = { transient: 0, energy: 0, bassTransient: 0, micMode: false };

  reset() {
    this.fast = 0;
    this.slow = 0;
    this.lastBass = 0;
  }

  update(bands: AudioBandSnapshot, dt: number, opts: { micMode?: boolean; instant?: boolean } = {}) {
    const bass = Math.max(0, bands.energy20_160 || bands.energy20_600 || 0);
    const wide = Math.max(0, bands.energy20_8000 || 0);
    const rise = Math.max(0, bass - this.lastBass);
    this.lastBass = bass;

    const attack = opts.micMode ? 44 : opts.instant ? 52 : 36;
    const release = opts.micMode ? 18 : opts.instant ? 22 : 12;
    const targetFast = Math.min(1.6, wide * 0.70 + bass * 0.85 + rise * 5.5);
    const targetSlow = Math.min(1.25, wide * 0.78 + bass * 0.36);
    const fastRate = targetFast > this.fast ? attack : release;
    const slowRate = targetSlow > this.slow ? 14 : 7;
    const fFast = 1 - Math.exp(-fastRate * Math.max(0, dt));
    const fSlow = 1 - Math.exp(-slowRate * Math.max(0, dt));
    this.fast += (targetFast - this.fast) * fFast;
    this.slow += (targetSlow - this.slow) * fSlow;

    this.snapshot = {
      transient: this.fast,
      energy: this.slow,
      bassTransient: Math.min(1.5, rise * 6.5),
      micMode: Boolean(opts.micMode),
    };
    if (DEVELOPMENT_DIAGNOSTICS_ENABLED) (window as any).__ORBITAL_VISUAL_BUS__ = this.snapshot;
    return this.snapshot;
  }
}