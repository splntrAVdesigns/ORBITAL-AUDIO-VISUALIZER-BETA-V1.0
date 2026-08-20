import type { BpmClockFrame } from '../../bpm/BpmClockRuntime';

export interface AudioProgressSnapshot {
  currentTime: number;
  duration: number;
  percent: number;
}

export type BpmClockSnapshot = BpmClockFrame;

export interface PerformanceHUDSnapshot {
  fps: number;
  cpu: number;
  memoryMB: number;
  resolution: string;
  quality: number;
  renderCosts: Record<string, any> | null;
}

type Listener<T> = (snapshot: T) => void;

/**
 * Main-thread UI publication bus driven by the authoritative visual scheduler.
 * It owns no RAF/timer and is intentionally separate from React state.
 */
class MainThreadUIRefreshBus {
  private readonly progressListeners = new Set<Listener<AudioProgressSnapshot>>();
  private readonly bpmClockListeners = new Set<Listener<BpmClockSnapshot>>();
  private readonly performanceListeners = new Set<Listener<PerformanceHUDSnapshot>>();

  subscribeAudioProgress(listener: Listener<AudioProgressSnapshot>): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  publishAudioProgress(snapshot: AudioProgressSnapshot): void {
    for (const listener of this.progressListeners) listener(snapshot);
  }

  subscribeBpmClock(listener: Listener<BpmClockSnapshot>): () => void {
    this.bpmClockListeners.add(listener);
    return () => this.bpmClockListeners.delete(listener);
  }

  publishBpmClock(snapshot: BpmClockSnapshot): void {
    for (const listener of this.bpmClockListeners) listener(snapshot);
  }

  subscribePerformanceHUD(listener: Listener<PerformanceHUDSnapshot>): () => void {
    this.performanceListeners.add(listener);
    return () => this.performanceListeners.delete(listener);
  }

  hasPerformanceHUDSubscribers(): boolean {
    return this.performanceListeners.size > 0;
  }

  publishPerformanceHUD(snapshot: PerformanceHUDSnapshot): void {
    for (const listener of this.performanceListeners) listener(snapshot);
  }

  reset(): void {
    // The bus owns no scheduled work or retained snapshot. React subscribers own
    // their own unsubscribe lifecycle, so a runtime-session restart must not
    // silently detach mounted UI consumers.
  }
}

export const mainThreadUIRefreshBus = new MainThreadUIRefreshBus();
