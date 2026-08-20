import type { AutoBpmStatus } from './BpmDetector';

export type BpmClockMode = 'auto' | 'manual';

export interface BpmClockState {
  readonly mode: BpmClockMode;
  readonly bpm: number;
  readonly autoBpm: number | null;
  readonly autoConfidence: number;
  readonly autoStatus: AutoBpmStatus;
  readonly manualBpm: number;
  readonly revision: number;
}

export interface BpmClockFrame extends BpmClockState {
  readonly beatIndex: 0 | 1 | 2 | 3;
  readonly beatPhase: number;
  readonly barPhase: number;
  readonly downbeat: boolean;
  readonly tapCount: 0 | 1 | 2 | 3 | 4;
  readonly tapSequenceActive: boolean;
}

export interface TapTempoResult {
  readonly committed: boolean;
  readonly bpm: number;
  readonly tapCount: 1 | 2 | 3 | 4;
}

type StateListener = (state: BpmClockState) => void;

const MIN_BPM = 40;
const MAX_BPM = 220;
const DEFAULT_BPM = 174;
const TAP_SEQUENCE_TIMEOUT_MS = 2200;
const MAX_ROLLING_TAPS = 8;
const OUTLIER_TOLERANCE = 0.25;

function clampBpm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BPM;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(value)));
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function estimateBpm(taps: readonly number[]): number | null {
  if (taps.length < 4) return null;

  const intervals: number[] = [];
  for (let index = 1; index < taps.length; index += 1) {
    const interval = taps[index] - taps[index - 1];
    if (Number.isFinite(interval) && interval > 0) intervals.push(interval);
  }
  if (intervals.length < 3) return null;

  const center = median(intervals);
  if (center <= 0) return null;

  const filtered = intervals.filter((interval) => (
    Math.abs(interval - center) / center <= OUTLIER_TOLERANCE
  ));
  const source = filtered.length >= 2 ? filtered : intervals;
  const meanInterval = source.reduce((sum, interval) => sum + interval, 0) / source.length;
  if (!Number.isFinite(meanInterval) || meanInterval <= 0) return null;

  const rawBpm = 60000 / meanInterval;
  if (rawBpm < MIN_BPM || rawBpm > MAX_BPM) return null;
  return clampBpm(rawBpm);
}

/**
 * Main-thread BPM authority used by Tap Tempo, automatic track analysis and the
 * future render worker frame contract. It owns no DOM, React state, timer or RAF.
 */
export class BpmClockRuntime {
  private mode: BpmClockMode = 'auto';
  private autoBpm: number | null = null;
  private autoConfidence = 0;
  private autoStatus: AutoBpmStatus = 'idle';
  private manualBpm = DEFAULT_BPM;
  private activeBpm = DEFAULT_BPM;
  private phaseOriginMs = -1;
  private revision = 0;
  private readonly listeners = new Set<StateListener>();
  private tapTimes: number[] = [];
  private tapSequenceCount = 0;
  private lastTapAt = -Infinity;

  get state(): BpmClockState {
    return {
      mode: this.mode,
      bpm: this.activeBpm,
      autoBpm: this.autoBpm,
      autoConfidence: this.autoConfidence,
      autoStatus: this.autoStatus,
      manualBpm: this.manualBpm,
      revision: this.revision,
    };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  beginAutoAnalysis(): void {
    if (this.autoStatus === 'analyzing') return;
    this.autoStatus = 'analyzing';
    this.autoConfidence = 0;
    this.publish();
  }

  setAutoUnavailable(): void {
    this.autoBpm = null;
    this.autoConfidence = 0;
    this.autoStatus = 'unavailable';
    this.publish();
  }

  setAutoBpm(value: number, nowMs: number, confidence = 1): void {
    const next = clampBpm(value);
    const changed = next !== this.autoBpm || this.autoStatus !== 'ready';
    this.autoBpm = next;
    this.autoConfidence = Math.max(0, Math.min(1, confidence));
    this.autoStatus = 'ready';
    if (this.mode === 'auto') {
      const activeChanged = this.activeBpm !== next;
      this.activeBpm = next;
      if (activeChanged) this.phaseOriginMs = this.safeNow(nowMs);
      if (changed || activeChanged) this.publish();
    } else if (changed) {
      this.publish();
    }
  }

  setManualBpm(value: number, nowMs: number, resetPhase = true): void {
    const next = clampBpm(value);
    const modeChanged = this.mode !== 'manual';
    const bpmChanged = this.activeBpm !== next || this.manualBpm !== next;
    this.mode = 'manual';
    this.manualBpm = next;
    this.activeBpm = next;
    this.clearTapSequence();
    if (resetPhase && (modeChanged || bpmChanged)) this.phaseOriginMs = this.safeNow(nowMs);
    if (modeChanged || bpmChanged) this.publish();
  }

  activateAuto(nowMs: number): void {
    const modeChanged = this.mode !== 'auto';
    const next = this.autoStatus === 'ready' && this.autoBpm !== null ? this.autoBpm : this.activeBpm;
    const bpmChanged = this.activeBpm !== next;
    this.mode = 'auto';
    this.activeBpm = next;
    this.clearTapSequence();
    if (modeChanged || bpmChanged) this.phaseOriginMs = this.safeNow(nowMs);
    if (modeChanged || bpmChanged) this.publish();
  }

  activateManual(nowMs: number): void {
    const modeChanged = this.mode !== 'manual';
    this.mode = 'manual';
    this.manualBpm = this.activeBpm;
    this.clearTapSequence();
    if (modeChanged) {
      this.phaseOriginMs = this.safeNow(nowMs);
      this.publish();
    }
  }

  reset(nowMs: number, bpm = DEFAULT_BPM): void {
    const next = clampBpm(bpm);
    this.mode = 'auto';
    this.autoBpm = null;
    this.autoConfidence = 0;
    this.autoStatus = 'idle';
    this.manualBpm = next;
    this.activeBpm = next;
    this.phaseOriginMs = this.safeNow(nowMs);
    this.clearTapSequence();
    this.publish();
  }

  tap(nowMs: number): TapTempoResult {
    const now = this.safeNow(nowMs);
    if (now - this.lastTapAt > TAP_SEQUENCE_TIMEOUT_MS) this.clearTapSequence();

    if (this.mode !== 'manual') {
      this.mode = 'manual';
      this.manualBpm = this.activeBpm;
    }

    this.lastTapAt = now;
    this.tapSequenceCount += 1;
    this.tapTimes.push(now);
    if (this.tapTimes.length > MAX_ROLLING_TAPS) this.tapTimes.shift();

    const estimated = estimateBpm(this.tapTimes);
    if (estimated !== null) {
      this.manualBpm = estimated;
      this.activeBpm = estimated;
      const beatIntervalMs = 60000 / estimated;
      this.phaseOriginMs = now - Math.max(0, this.tapSequenceCount - 1) * beatIntervalMs;
    } else if (this.tapSequenceCount === 1) {
      this.phaseOriginMs = now;
    }

    this.publish();
    return {
      committed: estimated !== null,
      bpm: this.activeBpm,
      tapCount: Math.min(4, this.tapSequenceCount) as 1 | 2 | 3 | 4,
    };
  }

  frame(nowMs: number): BpmClockFrame {
    const now = this.safeNow(nowMs);
    if (this.phaseOriginMs < 0) this.phaseOriginMs = now;
    const beatIntervalMs = 60000 / Math.max(MIN_BPM, this.activeBpm);
    const elapsed = Math.max(0, now - this.phaseOriginMs);
    const beatPosition = elapsed / beatIntervalMs;
    const wholeBeat = Math.floor(beatPosition);
    const beatPhase = beatPosition - wholeBeat;
    const beatIndex = (wholeBeat % 4) as 0 | 1 | 2 | 3;
    const sequenceActive = now - this.lastTapAt <= TAP_SEQUENCE_TIMEOUT_MS;
    const tapCount = sequenceActive
      ? Math.min(4, this.tapSequenceCount) as 0 | 1 | 2 | 3 | 4
      : 0;

    return {
      ...this.state,
      beatIndex,
      beatPhase,
      barPhase: (beatIndex + beatPhase) / 4,
      downbeat: beatIndex === 0,
      tapCount,
      tapSequenceActive: sequenceActive,
    };
  }

  private safeNow(nowMs: number): number {
    return Number.isFinite(nowMs) && nowMs >= 0 ? nowMs : 0;
  }

  private clearTapSequence(): void {
    this.tapTimes = [];
    this.tapSequenceCount = 0;
    this.lastTapAt = -Infinity;
  }

  private publish(): void {
    this.revision += 1;
    const snapshot = this.state;
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const bpmClockRuntime = new BpmClockRuntime();
