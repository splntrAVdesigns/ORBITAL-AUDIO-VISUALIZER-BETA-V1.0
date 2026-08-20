import type { RuntimeResourceSnapshot } from '../visualizer/session/RuntimeResourceDiagnostics';
import type { SparkCometDiagnostics } from '../visualizer/renderers/SparkCometRuntime';

export interface RuntimeAudioSoakSnapshot {
  status: 'idle' | 'running' | 'complete' | 'aborted';
  targetMs: number;
  startedAt: number | null;
  elapsedMs: number;
  baselineResources: RuntimeResourceSnapshot | null;
  currentResources: RuntimeResourceSnapshot | null;
  finalResources: RuntimeResourceSnapshot | null;
  resourceDelta: Partial<RuntimeResourceSnapshot> | null;
  baselineHeapMB: number | null;
  currentHeapMB: number | null;
  finalHeapMB: number | null;
  spark: SparkCometDiagnostics | null;
}

const cloneResources = (snapshot: RuntimeResourceSnapshot): RuntimeResourceSnapshot => ({ ...snapshot });

const diffResources = (
  before: RuntimeResourceSnapshot,
  after: RuntimeResourceSnapshot,
): Partial<RuntimeResourceSnapshot> => {
  const delta: Partial<RuntimeResourceSnapshot> = {};
  for (const key of Object.keys(before) as Array<keyof RuntimeResourceSnapshot>) {
    delta[key] = after[key] - before[key];
  }
  return delta;
};

/** Frame-driven audio soak accounting. It owns no timer or RAF. */
export class RuntimeAudioSoakMonitor {
  private snapshotValue: RuntimeAudioSoakSnapshot;

  constructor(private readonly targetMs = 15 * 60 * 1000) {
    this.snapshotValue = this.emptySnapshot();
  }

  private emptySnapshot(): RuntimeAudioSoakSnapshot {
    return {
      status: 'idle',
      targetMs: this.targetMs,
      startedAt: null,
      elapsedMs: 0,
      baselineResources: null,
      currentResources: null,
      finalResources: null,
      resourceDelta: null,
      baselineHeapMB: null,
      currentHeapMB: null,
      finalHeapMB: null,
      spark: null,
    };
  }

  start(now: number, resources: RuntimeResourceSnapshot, heapMB: number | null): void {
    if (this.snapshotValue.status === 'running') return;
    this.snapshotValue = {
      ...this.emptySnapshot(),
      status: 'running',
      startedAt: now,
      baselineResources: cloneResources(resources),
      currentResources: cloneResources(resources),
      baselineHeapMB: heapMB,
      currentHeapMB: heapMB,
    };
  }

  update(
    now: number,
    playing: boolean,
    resources: RuntimeResourceSnapshot,
    heapMB: number | null,
    spark: SparkCometDiagnostics,
  ): RuntimeAudioSoakSnapshot {
    if (playing && this.snapshotValue.status === 'idle') this.start(now, resources, heapMB);
    if (this.snapshotValue.status !== 'running' || this.snapshotValue.startedAt === null) {
      return this.snapshot;
    }

    this.snapshotValue.elapsedMs = Math.max(0, now - this.snapshotValue.startedAt);
    this.snapshotValue.currentResources = cloneResources(resources);
    this.snapshotValue.currentHeapMB = heapMB;
    this.snapshotValue.spark = { ...spark };

    if (this.snapshotValue.elapsedMs >= this.targetMs) {
      this.complete(resources, heapMB, spark);
    }
    return this.snapshot;
  }

  complete(resources: RuntimeResourceSnapshot, heapMB: number | null, spark: SparkCometDiagnostics): void {
    if (!this.snapshotValue.baselineResources) return;
    const finalResources = cloneResources(resources);
    this.snapshotValue.status = 'complete';
    this.snapshotValue.currentResources = finalResources;
    this.snapshotValue.finalResources = finalResources;
    this.snapshotValue.resourceDelta = diffResources(this.snapshotValue.baselineResources, finalResources);
    this.snapshotValue.currentHeapMB = heapMB;
    this.snapshotValue.finalHeapMB = heapMB;
    this.snapshotValue.spark = { ...spark };
  }

  abort(resources: RuntimeResourceSnapshot, heapMB: number | null, spark: SparkCometDiagnostics): void {
    if (this.snapshotValue.status !== 'running' || !this.snapshotValue.baselineResources) return;
    const finalResources = cloneResources(resources);
    this.snapshotValue.status = 'aborted';
    this.snapshotValue.currentResources = finalResources;
    this.snapshotValue.finalResources = finalResources;
    this.snapshotValue.resourceDelta = diffResources(this.snapshotValue.baselineResources, finalResources);
    this.snapshotValue.currentHeapMB = heapMB;
    this.snapshotValue.finalHeapMB = heapMB;
    this.snapshotValue.spark = { ...spark };
  }

  reset(): void {
    this.snapshotValue = this.emptySnapshot();
  }

  get snapshot(): RuntimeAudioSoakSnapshot {
    return {
      ...this.snapshotValue,
      baselineResources: this.snapshotValue.baselineResources ? { ...this.snapshotValue.baselineResources } : null,
      currentResources: this.snapshotValue.currentResources ? { ...this.snapshotValue.currentResources } : null,
      finalResources: this.snapshotValue.finalResources ? { ...this.snapshotValue.finalResources } : null,
      resourceDelta: this.snapshotValue.resourceDelta ? { ...this.snapshotValue.resourceDelta } : null,
      spark: this.snapshotValue.spark ? { ...this.snapshotValue.spark } : null,
    };
  }
}
