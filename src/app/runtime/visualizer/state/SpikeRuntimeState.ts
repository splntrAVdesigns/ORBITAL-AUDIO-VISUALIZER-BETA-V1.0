export interface SpikeLookupTables {
  spikeCosTable: Float32Array;
  spikeSinTable: Float32Array;
  transientBoostNoise: Float32Array;
}

/** Owns spike lookup buffers and rebuild lifecycle outside the runtime session closure. */
export class SpikeRuntimeState {
  spikeCosTable: Float32Array = new Float32Array(0);
  spikeSinTable: Float32Array = new Float32Array(0);
  transientBoostNoise: Float32Array = new Float32Array(0);
  lookupTablesSize = 0;
  staticGeometrySize = -1;

  constructor(
    private readonly buildTables: (size: number) => SpikeLookupTables,
    private readonly debug = false,
  ) {}

  rebuild(size: number): void {
    const tables = this.buildTables(size);
    this.spikeCosTable = tables.spikeCosTable;
    this.spikeSinTable = tables.spikeSinTable;
    this.transientBoostNoise = tables.transientBoostNoise;
    this.lookupTablesSize = size;
    if (this.debug) {
      console.log(`✅ Spike lookup tables ready (${(size * 12 / 1024).toFixed(1)} KB)`);
    }
  }

  reset(): void {
    this.spikeCosTable = new Float32Array(0);
    this.spikeSinTable = new Float32Array(0);
    this.transientBoostNoise = new Float32Array(0);
    this.lookupTablesSize = 0;
    this.staticGeometrySize = -1;
  }
}