export type RuntimeResourceKind =
  | 'activeRuntimeSessions'
  | 'activeRafSchedulers'
  | 'activeAudioContexts'
  | 'activeWebGLContexts'
  | 'activeListeners'
  | 'activeTimers'
  | 'activeIdleCallbacks'
  | 'activeClassifiedTimeouts'
  | 'activeClassifiedIntervals'
  | 'activeShortLivedRafs';

export interface RuntimeResourceSnapshot {
  activeRuntimeSessions: number;
  activeRafSchedulers: number;
  activeAudioContexts: number;
  activeWebGLContexts: number;
  activeListeners: number;
  activeTimers: number;
  activeIdleCallbacks: number;
  activeClassifiedTimeouts: number;
  activeClassifiedIntervals: number;
  activeShortLivedRafs: number;
}

const EMPTY_SNAPSHOT: RuntimeResourceSnapshot = {
  activeRuntimeSessions: 0,
  activeRafSchedulers: 0,
  activeAudioContexts: 0,
  activeWebGLContexts: 0,
  activeListeners: 0,
  activeTimers: 0,
  activeIdleCallbacks: 0,
  activeClassifiedTimeouts: 0,
  activeClassifiedIntervals: 0,
  activeShortLivedRafs: 0,
};

const GLOBAL_KEY = '__ORBITAL_RUNTIME_RESOURCE_COUNTS__';
const INTERNAL_SNAPSHOT: RuntimeResourceSnapshot = { ...EMPTY_SNAPSHOT };
// Standalone lifecycle tests have no Vite environment and intentionally retain counters.
const standaloneEnvironment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
const DEVELOPMENT_DIAGNOSTICS_ENABLED = Boolean(standaloneEnvironment?.DEV ?? true);

type RuntimeGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: RuntimeResourceSnapshot;
  __ORBITAL_RUNTIME_RESOURCES__?: RuntimeResourceSnapshot;
};

function getGlobalSnapshot(): RuntimeResourceSnapshot {
  if (!DEVELOPMENT_DIAGNOSTICS_ENABLED) return INTERNAL_SNAPSHOT;
  const runtimeGlobal = globalThis as RuntimeGlobal;
  const snapshot = runtimeGlobal[GLOBAL_KEY] ?? { ...EMPTY_SNAPSHOT };
  // Hot reload can preserve an older snapshot shape. Fill new counters instead
  // of allowing undefined + 1 to become NaN after a diagnostics upgrade.
  for (const [kind, initial] of Object.entries(EMPTY_SNAPSHOT) as Array<[
    keyof RuntimeResourceSnapshot,
    number,
  ]>) {
    if (!Number.isFinite(snapshot[kind])) snapshot[kind] = initial;
  }
  runtimeGlobal[GLOBAL_KEY] = snapshot;
  runtimeGlobal.__ORBITAL_RUNTIME_RESOURCES__ = snapshot;
  return snapshot;
}

function once(fn: () => void): () => void {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    fn();
  };
}


export function trackGlobalRuntimeResource(kind: RuntimeResourceKind): () => void {
  const global = getGlobalSnapshot();
  global[kind] += 1;
  return once(() => {
    const current = getGlobalSnapshot();
    current[kind] = Math.max(0, current[kind] - 1);
  });
}

export function getGlobalRuntimeResourceSnapshot(): RuntimeResourceSnapshot {
  return { ...getGlobalSnapshot() };
}

/** Session-local resource accounting with a global debug snapshot. */
export class RuntimeResourceScope {
  private readonly local: RuntimeResourceSnapshot = { ...EMPTY_SNAPSHOT };
  private closed = false;

  constructor(private readonly label = 'visualizer-runtime') {
    this.increment('activeRuntimeSessions');
  }

  track(kind: RuntimeResourceKind): () => void {
    if (this.closed) return () => {};
    this.increment(kind);
    return once(() => this.decrement(kind));
  }

  snapshot(): RuntimeResourceSnapshot {
    return { ...this.local };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.decrement('activeRuntimeSessions');
    const leaks = Object.entries(this.local).filter(([, count]) => count !== 0);
    if (leaks.length > 0) {
      console.error(
        `[ORBITAL] Runtime resource leak detected after ${this.label} cleanup:`,
        Object.fromEntries(leaks),
      );
    }
  }

  private increment(kind: RuntimeResourceKind): void {
    this.local[kind] += 1;
    const global = getGlobalSnapshot();
    global[kind] += 1;
  }

  private decrement(kind: RuntimeResourceKind): void {
    this.local[kind] = Math.max(0, this.local[kind] - 1);
    const global = getGlobalSnapshot();
    global[kind] = Math.max(0, global[kind] - 1);
  }
}

export function createRuntimeResourceScope(label?: string): RuntimeResourceScope {
  return new RuntimeResourceScope(label);
}