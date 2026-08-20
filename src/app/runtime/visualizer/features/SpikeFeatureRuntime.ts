import type { SpikeRuntimeState } from '../state/SpikeRuntimeState';

/** Owns persistent Spike Ring feature state without changing production rendering formulas. */
export class SpikeFeatureRuntime {
  private runtimeState: SpikeRuntimeState | null = null;
  ampBuf: Float32Array;
  ampEcho1: Float32Array;
  ampEcho2: Float32Array;
  prevTargetBuf: Float32Array;
  spikeDisplayBuf: Float32Array;
  tempSmoothingBuf: Float32Array;

  constructor(initialLength: number) {
    this.ampBuf = new Float32Array(initialLength);
    this.ampEcho1 = new Float32Array(initialLength);
    this.ampEcho2 = new Float32Array(initialLength);
    this.prevTargetBuf = new Float32Array(initialLength);
    this.spikeDisplayBuf = new Float32Array(initialLength);
    this.tempSmoothingBuf = new Float32Array(initialLength);
  }

  attachRuntimeState(runtimeState: SpikeRuntimeState): void { this.runtimeState = runtimeState; }
  get lookupTablesSize(): number { return this.runtimeState?.lookupTablesSize ?? 0; }
  get spikeCosTable(): Float32Array { return this.runtimeState?.spikeCosTable ?? EMPTY; }
  get spikeSinTable(): Float32Array { return this.runtimeState?.spikeSinTable ?? EMPTY; }
  get transientBoostNoise(): Float32Array { return this.runtimeState?.transientBoostNoise ?? EMPTY; }

  ensureLookupTables(size: number): void {
    if (!this.runtimeState || this.runtimeState.lookupTablesSize === size) return;
    this.runtimeState.rebuild(size);
  }

  reset(): void {
    this.ampBuf.fill(0); this.ampEcho1.fill(0); this.ampEcho2.fill(0);
    this.prevTargetBuf.fill(0); this.spikeDisplayBuf.fill(0); this.tempSmoothingBuf.fill(0);
  }
}

const EMPTY = new Float32Array(0);
export function createSpikeFeatureRuntime(initialLength: number): SpikeFeatureRuntime {
  return new SpikeFeatureRuntime(initialLength);
}
