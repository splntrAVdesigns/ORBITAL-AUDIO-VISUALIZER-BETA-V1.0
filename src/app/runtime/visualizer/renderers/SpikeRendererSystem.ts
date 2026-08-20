import { SpikeRuntimeState, type SpikeLookupTables } from '../state/SpikeRuntimeState';
import type { RendererAdapter, RendererSystem } from './RendererSystem';

export interface SpikeRendererFrame {
  spikeCount: number;
  frequencyData: Uint8Array | Float32Array;
  smoothing: number;
  mirrored: boolean;
  hue: number;
  saturation: number;
  luminance: number;
  payload: unknown;
}

/** Owns spike geometry lookup, FFT mapping and smoothing buffers. */
export class SpikeRendererSystem implements RendererSystem<SpikeRendererFrame, void> {
  readonly state: SpikeRuntimeState;
  private frame: SpikeRendererFrame | null = null;
  private smoothed = new Float32Array(0);

  constructor(buildTables: (size: number) => SpikeLookupTables, private adapter?: RendererAdapter<SpikeRendererFrame, void>) {
    this.state = new SpikeRuntimeState(buildTables);
  }

  update(frame: SpikeRendererFrame): void {
    this.frame = frame;
    if (this.state.lookupTablesSize !== frame.spikeCount) this.state.rebuild(frame.spikeCount);
    if (this.smoothed.length !== frame.spikeCount) this.smoothed = new Float32Array(frame.spikeCount);
    const source = frame.frequencyData;
    const alpha = Math.max(0.01, Math.min(1, 1 - frame.smoothing));
    for (let i = 0; i < frame.spikeCount; i++) {
      const sourceIndex = Math.min(source.length - 1, Math.floor((i / Math.max(1, frame.spikeCount - 1)) * source.length));
      const value = Number(source[sourceIndex] ?? 0);
      this.smoothed[i] += (value - this.smoothed[i]) * alpha;
    }
  }

  getSmoothedFFT(): Float32Array { return this.smoothed; }
  render(): void { if (this.frame) this.adapter?.render(this.frame, undefined); }
  reset(): void { this.frame = null; this.smoothed = new Float32Array(0); this.state.reset(); this.adapter?.reset?.(); }
  dispose(): void { this.reset(); this.adapter?.dispose?.(); this.adapter = undefined; }
}
