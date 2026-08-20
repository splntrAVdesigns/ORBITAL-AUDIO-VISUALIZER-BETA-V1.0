export interface BeatDetectionSettings {
  now: number;
  sensitivity: number;
  bpmSync: boolean;
  bpm: number;
}

export interface BeatDetectionRuntimeOptions {
  historySize?: number;
  minimumSamples?: number;
  defaultMinIntervalMs?: number;
}

/**
 * Allocation-free adaptive onset detector shared by Orbital render hosts.
 *
 * This intentionally owns the history buffer and last-trigger timestamp so the
 * render session does not need beat-history globals. Call reset() on preset /
 * runtime resets that must discard onset history.
 */
export class BeatDetectionRuntime {
  private readonly history: Float32Array;
  private readonly minimumSamples: number;
  private readonly defaultMinIntervalMs: number;
  private historyIndex = 0;
  private historyCount = 0;
  private lastBeatTime = 0;

  constructor(options: BeatDetectionRuntimeOptions = {}) {
    const historySize = Math.max(8, Math.floor(options.historySize ?? 25));
    this.history = new Float32Array(historySize);
    this.minimumSamples = Math.min(
      historySize,
      Math.max(2, Math.floor(options.minimumSamples ?? 8)),
    );
    this.defaultMinIntervalMs = Math.max(0, options.defaultMinIntervalMs ?? 180);
  }

  detect(currentEnergy: number, settings: BeatDetectionSettings): boolean {
    const energy = Number.isFinite(currentEnergy) ? Math.max(0, currentEnergy) : 0;

    this.history[this.historyIndex] = energy;
    this.historyIndex = (this.historyIndex + 1) % this.history.length;
    if (this.historyCount < this.history.length) this.historyCount += 1;

    if (this.historyCount < this.minimumSamples) return false;

    let sum = 0;
    for (let i = 0; i < this.historyCount; i += 1) sum += this.history[i];
    const averageEnergy = sum / this.historyCount;

    const sensitivity = Math.min(1, Math.max(0, settings.sensitivity));
    const sensitivityMultiplier = 0.05 + (1 - sensitivity) * 1.5;
    const threshold = averageEnergy * (1 + sensitivityMultiplier);

    const bpm = Number.isFinite(settings.bpm) ? settings.bpm : 0;
    const minInterval = settings.bpmSync && bpm > 0
      ? (60000 / bpm) * 0.7
      : this.defaultMinIntervalMs;

    const now = Number.isFinite(settings.now) ? settings.now : 0;
    if (energy > threshold && now - this.lastBeatTime > minInterval) {
      this.lastBeatTime = now;
      return true;
    }

    return false;
  }

  reset(): void {
    this.history.fill(0);
    this.historyIndex = 0;
    this.historyCount = 0;
    this.lastBeatTime = 0;
  }

  getDiagnostics(): Readonly<{
    historySize: number;
    historyCount: number;
    lastBeatTime: number;
  }> {
    return {
      historySize: this.history.length,
      historyCount: this.historyCount,
      lastBeatTime: this.lastBeatTime,
    };
  }
}
