export type RefreshChannel = 'vu' | 'spectrum' | 'progress' | 'beatClock' | 'hud' | 'metadata' | 'diagnostics';

const DEFAULT_INTERVALS: Record<RefreshChannel, number> = {
  vu: 1000 / 30,
  spectrum: 1000 / 30,
  progress: 125,
  beatClock: 1000 / 30,
  hud: 200,
  metadata: 250,
  diagnostics: 125,
};

/**
 * Shares the authoritative visual RAF without creating secondary animation loops.
 * Call shouldRun(channel, now) from the main frame and draw only when it returns true.
 */
export class UIRefreshScheduler {
  private readonly last = new Map<RefreshChannel, number>();
  private readonly intervals: Record<RefreshChannel, number>;

  constructor(intervals: Partial<Record<RefreshChannel, number>> = {}) {
    this.intervals = { ...DEFAULT_INTERVALS, ...intervals };
  }

  shouldRun(channel: RefreshChannel, nowMs: number): boolean {
    const previous = this.last.get(channel) ?? -Infinity;
    if (nowMs - previous < this.intervals[channel]) return false;
    this.last.set(channel, nowMs);
    return true;
  }

  reset(): void {
    this.last.clear();
  }
}
