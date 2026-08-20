export type PersistentSessionState =
  | 'running'
  | 'degraded-rendering'
  | 'recovering-renderer'
  | 'manual-reload'
  | 'fatal-memory-protection';

export interface PersistentSessionSnapshot {
  state: PersistentSessionState;
  reason: string;
  updatedAt: number;
  recoveryCount: number;
  previousExitReason: string;
}

type GraphicsRecoveryHandler = (reason: string) => void;
type Listener = () => void;

const STORAGE_KEY = 'orbital.session.recovery.v1';
const initialSnapshot: PersistentSessionSnapshot = {
  state: 'running',
  reason: 'Session initialized.',
  updatedAt: Date.now(),
  recoveryCount: 0,
  previousExitReason: '',
};

function readSnapshot(): PersistentSessionSnapshot {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null') as Partial<PersistentSessionSnapshot> | null;
    if (!stored || typeof stored.state !== 'string') return initialSnapshot;
    return {
      state: stored.state as PersistentSessionState,
      reason: typeof stored.reason === 'string' ? stored.reason.slice(0, 180) : initialSnapshot.reason,
      updatedAt: Number.isFinite(stored.updatedAt) ? Number(stored.updatedAt) : Date.now(),
      recoveryCount: Number.isFinite(stored.recoveryCount) ? Math.max(0, Number(stored.recoveryCount)) : 0,
      previousExitReason: typeof stored.previousExitReason === 'string' ? stored.previousExitReason.slice(0, 180) : '',
    };
  } catch {
    return initialSnapshot;
  }
}

/**
 * Minimal session-resilience authority. It never reloads the page; it records a
 * classified state and delegates graphics-only recovery to the active runtime.
 */
export class SessionRecoverySupervisor {
  private snapshot = readSnapshot();
  private listeners = new Set<Listener>();
  private graphicsRecoveryHandler: GraphicsRecoveryHandler | null = null;

  getSnapshot = (): PersistentSessionSnapshot => this.snapshot;
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  registerGraphicsRecovery(handler: GraphicsRecoveryHandler): () => void {
    this.graphicsRecoveryHandler = handler;
    return () => {
      if (this.graphicsRecoveryHandler === handler) this.graphicsRecoveryHandler = null;
    };
  }

  recordPreviousExit(reason: string): void {
    this.snapshot = { ...this.snapshot, previousExitReason: reason.slice(0, 180) };
    this.persistAndNotify();
  }

  markRunning(reason = 'Visualizer runtime active.'): void {
    this.transition('running', reason);
  }

  markDegraded(reason: string): void {
    this.transition('degraded-rendering', reason);
  }

  requestSafeGraphicsRecovery(reason = 'Manual safe graphics recovery requested.'): void {
    if (!this.graphicsRecoveryHandler) {
      this.markDegraded('Graphics recovery is unavailable; the current session remains intact.');
      return;
    }
    this.transition('recovering-renderer', reason, true);
    try {
      this.graphicsRecoveryHandler(reason);
    } catch {
      this.markDegraded('Graphics recovery failed safely; audio and control state remain active.');
    }
  }

  enterFatalMemoryProtection(reason = 'Graphics memory pressure protection activated.'): void {
    // This is intentionally non-destructive. It disables/reclaims graphics work and
    // leaves the user in control; only an explicit Reload can restart the document.
    this.transition('fatal-memory-protection', reason, true);
    try { this.graphicsRecoveryHandler?.(reason); } catch { /* preserve session */ }
  }

  recordManualReload(reason = 'Manual reload requested.'): void {
    this.transition('manual-reload', reason);
  }

  private transition(state: PersistentSessionState, reason: string, isRecovery = false): void {
    this.snapshot = {
      state,
      reason: reason.slice(0, 180),
      updatedAt: Date.now(),
      recoveryCount: this.snapshot.recoveryCount + (isRecovery ? 1 : 0),
      previousExitReason: this.snapshot.previousExitReason,
    };
    this.persistAndNotify();
  }

  private persistAndNotify(): void {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot)); } catch { /* storage unavailable */ }
    this.listeners.forEach(listener => listener());
  }
}

const supervisor = new SessionRecoverySupervisor();
export const getSessionRecoverySupervisor = (): SessionRecoverySupervisor => supervisor;
