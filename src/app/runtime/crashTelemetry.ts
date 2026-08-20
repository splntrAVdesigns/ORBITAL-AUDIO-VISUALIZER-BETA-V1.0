import type { FramePacingSnapshot } from './framePacingRuntime';
import type { RuntimeResourceSnapshot } from './visualizer/session/RuntimeResourceDiagnostics';
import type { SparkCometDiagnostics } from './visualizer/renderers/SparkCometRuntime';
import { getSessionRecoverySupervisor } from './session/SessionRecoverySupervisor';

export type RuntimeExitKind =
  | 'running'
  | 'pagehide'
  | 'react-unmount'
  | 'user-reload'
  | 'settings-import'
  | 'vite-full-reload'
  | 'error'
  | 'unhandled-rejection'
  | 'webgl-context-lost'
  | 'raf-crash';

export interface RuntimeHeartbeatContext {
  framePacing?: Partial<FramePacingSnapshot> | null;
  renderScale?: number;
  renderCosts?: Record<string, unknown> | null;
  activeEffects?: Record<string, boolean | number | string>;
  audioState?: {
    present: boolean;
    paused?: boolean;
    ended?: boolean;
    readyState?: number;
    networkState?: number;
    currentTime?: number;
    duration?: number;
  };
}

export interface RuntimeLifecycleEvent {
  type: string;
  at: number;
  details?: Record<string, unknown>;
}

export interface RuntimeResumeSample {
  at: number;
  timeSinceResumeMs: number;
  framePacing?: Partial<FramePacingSnapshot> | null;
  renderScale?: number;
  renderCosts?: Record<string, unknown> | null;
  activeEffects?: Record<string, boolean | number | string>;
  audioState?: RuntimeHeartbeatContext['audioState'];
  resources?: RuntimeResourceSnapshot;
  spark?: SparkCometDiagnostics;
  heapMB?: number | null;
}

export interface CrashTelemetryRecord {
  version: 3;
  bootId: string;
  bootCount: number;
  startedAt: number;
  currentUrl: string;
  navigationType: string;
  exitKind: RuntimeExitKind;
  cleanShutdown: boolean;
  bootClassification?: {
    kind: string;
    message: string;
    previousBootId?: string;
    at: number;
  };
  runtimeEvents: RuntimeLifecycleEvent[];
  terminationEvidence: {
    exitKind: RuntimeExitKind;
    cleanShutdown: boolean;
    observedAt?: number;
    pagehidePersisted?: boolean;
    observedBy: 'none' | 'application' | 'browser-lifecycle' | 'vite';
    reason?: string;
  };
  lifecycle: {
    wasDiscarded: boolean;
    visibilityState: DocumentVisibilityState;
    lastHiddenAt?: number;
    lastVisibleAt?: number;
    lastVisibilityResumeAt?: number;
    timeSinceVisibilityResumeMs?: number;
    pagehidePersisted?: boolean;
    pageshowPersisted?: boolean;
    freezeCount: number;
    resumeCount: number;
    hmrAvailable: boolean;
    lastHostEvent?: RuntimeLifecycleEvent;
  };
  frame: {
    last?: Partial<FramePacingSnapshot> | null;
    renderScale?: number;
    renderCosts?: Record<string, unknown> | null;
    activeEffects?: Record<string, boolean | number | string>;
    longFrameCount: number;
    maximumLongFrameMs: number;
  };
  resumeWindow?: {
    active: boolean;
    startedAt: number;
    endsAt: number;
    lastSampleAt: number;
    samples: RuntimeResumeSample[];
  };
  lastHeartbeatAt: number;
  lastRafCrash?: { message: string; count: number; at: number };
  lastWindowError?: { message: string; at: number };
  lastUnhandledRejection?: { message: string; at: number };
  webglLosses: number;
  audioEvents: Record<string, number>;
  lastAudioEvent?: { type: string; at: number };
  audioState?: RuntimeHeartbeatContext['audioState'];
  resources?: RuntimeResourceSnapshot;
  spark?: SparkCometDiagnostics;
  heapMB?: number | null;
  // Kept only so older diagnostic readers do not fail; boot classification is
  // no longer stored here or carried into the current session.
  lastReason?: string;
}

interface LegacyCrashTelemetryRecord extends Omit<Partial<CrashTelemetryRecord>, 'version'> {
  version?: 2 | 3;
  bootId?: string;
  bootCount?: number;
  startedAt?: number;
  exitKind?: RuntimeExitKind;
  cleanShutdown?: boolean;
  lastReason?: string;
}

const KEY = 'orbital.runtime.session.v2';
const RELOAD_INTENT_KEY = 'orbital.runtime.reloadIntent';
const HOST_EVENT_KEY = 'orbital.runtime.hostEvent';
const MAX_RUNTIME_EVENTS = 32;
const MAX_RESUME_SAMPLES = 20;
const RESUME_WINDOW_MS = 10_000;
const RESUME_SAMPLE_INTERVAL_MS = 500;

const safeRead = <T>(key: string): T | null => {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') as T | null; } catch { return null; }
};

const safeWrite = (key: string, value: unknown): void => {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

const safeRemove = (key: string): void => {
  try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
};

const navigationType = (): string => {
  try {
    return ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type) || 'unknown';
  } catch {
    return 'unknown';
  }
};

const stringifyReason = (reason: unknown): string => {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  try { return typeof reason === 'string' ? reason : JSON.stringify(reason); } catch { return String(reason); }
};

const currentUrl = (): string => {
  // Do not retain query/hash values in the persistent session journal.
  try { return `${window.location.origin}${window.location.pathname}`; } catch { return 'unknown'; }
};

const wasDiscarded = (): boolean => {
  try { return Boolean((document as Document & { wasDiscarded?: boolean }).wasDiscarded); } catch { return false; }
};

const cloneRecordObject = <T extends Record<string, unknown> | undefined | null>(value: T): T => {
  if (!value) return value;
  return { ...value } as T;
};

function writeExternalHostEvent(type: string, details?: Record<string, unknown>): void {
  const event: RuntimeLifecycleEvent = { type, at: Date.now(), details };
  safeWrite(HOST_EVENT_KEY, event);
}

function markStoredViteFullReload(): void {
  const stored = safeRead<LegacyCrashTelemetryRecord>(KEY);
  if (stored) {
    const event: RuntimeLifecycleEvent = { type: 'vite-full-reload', at: Date.now() };
    const runtimeEvents = Array.isArray(stored.runtimeEvents)
      ? [...stored.runtimeEvents.slice(-(MAX_RUNTIME_EVENTS - 1)), event]
      : [event];
    safeWrite(KEY, {
      ...stored,
      exitKind: 'vite-full-reload',
      cleanShutdown: true,
      runtimeEvents,
      terminationEvidence: {
        exitKind: 'vite-full-reload',
        cleanShutdown: true,
        observedAt: event.at,
        observedBy: 'vite',
        reason: 'Vite requested a full preview reload.',
      },
    });
  }
  writeExternalHostEvent('vite-full-reload');
}

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeFullReload', markStoredViteFullReload);
  import.meta.hot.dispose(() => writeExternalHostEvent('vite-module-dispose'));
}

export function markUserRequestedReload(reason: 'user-reload' | 'settings-import' = 'user-reload'): void {
  getSessionRecoverySupervisor().recordManualReload(reason === 'settings-import' ? 'Settings import requested reload.' : 'User requested reload.');
  safeWrite(RELOAD_INTENT_KEY, { reason, at: Date.now() });
  const bridge = (window as any).__ORBITAL_CRASH_TELEMETRY__;
  bridge?.markReload?.(reason);
}

export class CrashTelemetry {
  readonly bootId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  readonly previous: LegacyCrashTelemetryRecord | null;
  private record: CrashTelemetryRecord;

  constructor() {
    const previous = safeRead<LegacyCrashTelemetryRecord>(KEY);
    const reloadIntent = safeRead<{ reason: RuntimeExitKind; at: number }>(RELOAD_INTENT_KEY);
    const hostEvent = safeRead<RuntimeLifecycleEvent>(HOST_EVENT_KEY);
    safeRemove(RELOAD_INTENT_KEY);
    safeRemove(HOST_EVENT_KEY);
    this.previous = previous;

    const currentNavigationType = navigationType();
    const bootClassification = this.classifyPrevious(previous, reloadIntent, hostEvent, currentNavigationType);
    const now = Date.now();
    this.record = {
      version: 3,
      bootId: this.bootId,
      bootCount: (previous?.bootCount || 0) + 1,
      startedAt: now,
      currentUrl: currentUrl(),
      navigationType: currentNavigationType,
      exitKind: 'running',
      cleanShutdown: false,
      bootClassification,
      runtimeEvents: [{ type: 'boot', at: now, details: { navigationType: currentNavigationType, wasDiscarded: wasDiscarded(), resetClassification: bootClassification?.kind ?? 'none' } }],
      terminationEvidence: {
        exitKind: 'running',
        cleanShutdown: false,
        observedBy: 'none',
      },
      lifecycle: {
        wasDiscarded: wasDiscarded(),
        visibilityState: document.visibilityState,
        lastVisibleAt: document.visibilityState === 'visible' ? now : undefined,
        lastHiddenAt: document.visibilityState === 'hidden' ? now : undefined,
        freezeCount: 0,
        resumeCount: 0,
        hmrAvailable: Boolean(import.meta.hot),
        lastHostEvent: hostEvent || undefined,
      },
      frame: {
        longFrameCount: 0,
        maximumLongFrameMs: 0,
      },
      lastHeartbeatAt: now,
      webglLosses: previous?.webglLosses || 0,
      audioEvents: {},
      heapMB: null,
    };
    this.persist(true);
    if (bootClassification) getSessionRecoverySupervisor().recordPreviousExit(bootClassification.message);

    if (bootClassification) {
      console.warn(`[ORBITAL runtime] ${bootClassification.message}`, previous || 'no previous record');
    }

    window.addEventListener('pagehide', this.onPageHide, { passive: true });
    window.addEventListener('pageshow', this.onPageShow, { passive: true });
    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
    window.addEventListener('orbital:astral-webgl', this.onAstralWebGL as EventListener);
    document.addEventListener('visibilitychange', this.onVisibilityChange, { passive: true });
    document.addEventListener('freeze', this.onFreeze as EventListener, { passive: true });
    document.addEventListener('resume', this.onResume as EventListener, { passive: true });
  }

  private classifyPrevious(
    previous: LegacyCrashTelemetryRecord | null,
    reloadIntent: { reason: RuntimeExitKind; at: number } | null,
    hostEvent: RuntimeLifecycleEvent | null,
    currentNavigationType: string,
  ): CrashTelemetryRecord['bootClassification'] {
    const now = Date.now();
    if (reloadIntent?.reason) {
      return {
        kind: reloadIntent.reason,
        message: `Previous session was intentionally restarted: ${reloadIntent.reason}.`,
        previousBootId: previous?.bootId,
        at: now,
      };
    }
    if (hostEvent?.type === 'vite-full-reload' || previous?.exitKind === 'vite-full-reload') {
      return {
        kind: 'vite-full-reload',
        message: 'Previous session was recreated by the Vite/Figma preview host.',
        previousBootId: previous?.bootId,
        at: now,
      };
    }
    if (!previous) return undefined;
    if (previous.exitKind === 'user-reload' || previous.exitKind === 'settings-import' || previous.exitKind === 'react-unmount') return undefined;
    if (previous.exitKind === 'error' || previous.exitKind === 'unhandled-rejection' || previous.exitKind === 'raf-crash' || previous.exitKind === 'webgl-context-lost') {
      return {
        kind: previous.exitKind,
        message: `Previous session stopped after ${previous.exitKind}: ${previous.lastReason || previous.terminationEvidence?.reason || 'unknown reason'}`,
        previousBootId: previous.bootId,
        at: now,
      };
    }
    const previousObservedBy = previous.terminationEvidence?.observedBy;
    const previousHadRuntimeFault = Boolean(
      previous.lastRafCrash ||
      previous.lastWindowError ||
      previous.lastUnhandledRejection
    );
    if (currentNavigationType === 'reload' && previous.exitKind === 'pagehide' && previousObservedBy === 'browser-lifecycle') {
      return {
        kind: 'host-navigation-reload',
        message: 'Previous document was reloaded through browser/preview-host navigation; no Orbital runtime crash evidence was recorded.',
        previousBootId: previous.bootId,
        at: now,
      };
    }
    if (currentNavigationType === 'reload' && !previousHadRuntimeFault) {
      return {
        kind: 'host-reload-unattributed',
        message: 'The document was reloaded by the browser or preview host without recorded Orbital RAF, WebGL, window-error, or rejection evidence.',
        previousBootId: previous.bootId,
        at: now,
      };
    }
    if (wasDiscarded()) {
      return {
        kind: 'browser-discarded',
        message: 'Previous page was discarded by the browser and restored as a new document.',
        previousBootId: previous.bootId,
        at: now,
      };
    }
    if (!previous.cleanShutdown || previous.exitKind === 'running') {
      return {
        kind: 'abrupt-host-reset',
        message: 'Previous session ended without a clean shutdown (host reset, renderer recovery, or abrupt process stop).',
        previousBootId: previous.bootId,
        at: now,
      };
    }
    if (previous.exitKind === 'pagehide') {
      return {
        kind: 'pagehide-navigation',
        message: 'Previous session ended through a browser pagehide/navigation lifecycle event.',
        previousBootId: previous.bootId,
        at: now,
      };
    }
    return undefined;
  }

  private pushRuntimeEvent(type: string, details?: Record<string, unknown>): void {
    const event: RuntimeLifecycleEvent = { type, at: Date.now(), details };
    this.record.runtimeEvents.push(event);
    if (this.record.runtimeEvents.length > MAX_RUNTIME_EVENTS) {
      this.record.runtimeEvents.splice(0, this.record.runtimeEvents.length - MAX_RUNTIME_EVENTS);
    }
    if (type.startsWith('vite-') || type === 'freeze' || type === 'resume') {
      this.record.lifecycle.lastHostEvent = event;
    }
  }

  private beginResumeWindow(at: number, source: string): void {
    this.record.lifecycle.lastVisibilityResumeAt = at;
    this.record.lifecycle.timeSinceVisibilityResumeMs = 0;
    this.record.resumeWindow = {
      active: true,
      startedAt: at,
      endsAt: at + RESUME_WINDOW_MS,
      lastSampleAt: 0,
      samples: [],
    };
    this.pushRuntimeEvent('resume-window-started', { source, durationMs: RESUME_WINDOW_MS });
  }

  attachWebGLCanvas(canvas: HTMLCanvasElement) {
    const lost = (event: Event) => {
      event.preventDefault();
      this.record.webglLosses += 1;
      this.record.exitKind = 'webgl-context-lost';
      this.record.cleanShutdown = false;
      this.record.lastReason = 'webgl context lost';
      this.record.terminationEvidence = {
        exitKind: 'webgl-context-lost',
        cleanShutdown: false,
        observedAt: Date.now(),
        observedBy: 'application',
        reason: 'WebGL context lost.',
      };
      this.pushRuntimeEvent('webgl-context-lost');
      this.persist(true);
    };
    const restored = () => {
      this.pushRuntimeEvent('webgl-context-restored');
      this.persist(true);
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }

  markReload(kind: 'user-reload' | 'settings-import'): void {
    const now = Date.now();
    this.record.exitKind = kind;
    this.record.cleanShutdown = true;
    this.record.lastReason = kind;
    this.record.terminationEvidence = {
      exitKind: kind,
      cleanShutdown: true,
      observedAt: now,
      observedBy: 'application',
      reason: kind,
    };
    this.pushRuntimeEvent(kind);
    this.persist(true);
  }

  heartbeat(
    resources?: RuntimeResourceSnapshot,
    spark?: SparkCometDiagnostics,
    heapMB?: number | null,
    context?: RuntimeHeartbeatContext,
  ): void {
    const now = Date.now();
    this.record.lastHeartbeatAt = now;
    if (resources) this.record.resources = { ...resources };
    if (spark) this.record.spark = { ...spark };
    if (heapMB !== undefined) this.record.heapMB = heapMB;
    if (context?.audioState) this.record.audioState = { ...context.audioState };

    if (context?.framePacing) {
      const frameInterval = Number(context.framePacing.frameInterval || 0);
      this.record.frame.last = { ...context.framePacing };
      if (frameInterval > 24) this.record.frame.longFrameCount += 1;
      this.record.frame.maximumLongFrameMs = Math.max(this.record.frame.maximumLongFrameMs, frameInterval);
    }
    if (context?.renderScale !== undefined) this.record.frame.renderScale = context.renderScale;
    if (context?.renderCosts !== undefined) this.record.frame.renderCosts = cloneRecordObject(context.renderCosts);
    if (context?.activeEffects) this.record.frame.activeEffects = { ...context.activeEffects };

    const resumedAt = this.record.lifecycle.lastVisibilityResumeAt;
    if (resumedAt) this.record.lifecycle.timeSinceVisibilityResumeMs = Math.max(0, now - resumedAt);

    const resumeWindow = this.record.resumeWindow;
    if (resumeWindow?.active) {
      if (now > resumeWindow.endsAt) {
        resumeWindow.active = false;
        this.pushRuntimeEvent('resume-window-complete', { sampleCount: resumeWindow.samples.length });
      } else if (now - resumeWindow.lastSampleAt >= RESUME_SAMPLE_INTERVAL_MS) {
        resumeWindow.lastSampleAt = now;
        resumeWindow.samples.push({
          at: now,
          timeSinceResumeMs: Math.max(0, now - resumeWindow.startedAt),
          framePacing: context?.framePacing ? { ...context.framePacing } : undefined,
          renderScale: context?.renderScale,
          renderCosts: cloneRecordObject(context?.renderCosts),
          activeEffects: context?.activeEffects ? { ...context.activeEffects } : undefined,
          audioState: context?.audioState ? { ...context.audioState } : undefined,
          resources: resources ? { ...resources } : undefined,
          spark: spark ? { ...spark } : undefined,
          heapMB,
        });
        if (resumeWindow.samples.length > MAX_RESUME_SAMPLES) resumeWindow.samples.shift();
      }
    }
    // Steady-state samples stay in memory. Synchronous storage is reserved for
    // boot, lifecycle, error, reload and shutdown evidence.
  }

  recordRafCrash(error: unknown, count: number): void {
    const message = stringifyReason(error);
    const now = Date.now();
    this.record.exitKind = 'raf-crash';
    this.record.cleanShutdown = false;
    this.record.lastReason = message;
    this.record.lastRafCrash = { message, count, at: now };
    this.record.terminationEvidence = {
      exitKind: 'raf-crash',
      cleanShutdown: false,
      observedAt: now,
      observedBy: 'application',
      reason: message,
    };
    this.pushRuntimeEvent('raf-crash', { message, count });
    this.persist(true);
  }

  recordAudioEvent(type: string): void {
    const at = Date.now();
    this.record.audioEvents[type] = (this.record.audioEvents[type] || 0) + 1;
    this.record.lastAudioEvent = { type, at };
    this.pushRuntimeEvent(`audio:${type}`);
  }

  note(reason: string): void {
    this.record.lastReason = reason;
    this.pushRuntimeEvent('note', { reason });
  }

  snapshot(): CrashTelemetryRecord {
    return {
      ...this.record,
      bootClassification: this.record.bootClassification ? { ...this.record.bootClassification } : undefined,
      runtimeEvents: this.record.runtimeEvents.map((event) => ({ ...event, details: event.details ? { ...event.details } : undefined })),
      terminationEvidence: { ...this.record.terminationEvidence },
      lifecycle: {
        ...this.record.lifecycle,
        lastHostEvent: this.record.lifecycle.lastHostEvent
          ? { ...this.record.lifecycle.lastHostEvent, details: this.record.lifecycle.lastHostEvent.details ? { ...this.record.lifecycle.lastHostEvent.details } : undefined }
          : undefined,
      },
      frame: {
        ...this.record.frame,
        last: this.record.frame.last ? { ...this.record.frame.last } : undefined,
        renderCosts: cloneRecordObject(this.record.frame.renderCosts),
        activeEffects: this.record.frame.activeEffects ? { ...this.record.frame.activeEffects } : undefined,
      },
      resumeWindow: this.record.resumeWindow ? {
        ...this.record.resumeWindow,
        samples: this.record.resumeWindow.samples.map((sample) => ({
          ...sample,
          framePacing: sample.framePacing ? { ...sample.framePacing } : undefined,
          renderCosts: cloneRecordObject(sample.renderCosts),
          activeEffects: sample.activeEffects ? { ...sample.activeEffects } : undefined,
          audioState: sample.audioState ? { ...sample.audioState } : undefined,
          resources: sample.resources ? { ...sample.resources } : undefined,
          spark: sample.spark ? { ...sample.spark } : undefined,
        })),
      } : undefined,
      audioEvents: { ...this.record.audioEvents },
      audioState: this.record.audioState ? { ...this.record.audioState } : undefined,
      resources: this.record.resources ? { ...this.record.resources } : undefined,
      spark: this.record.spark ? { ...this.record.spark } : undefined,
    };
  }

  dispose(): void {
    if (this.record.exitKind === 'running') {
      const now = Date.now();
      this.record.exitKind = 'react-unmount';
      this.record.cleanShutdown = true;
      this.record.terminationEvidence = {
        exitKind: 'react-unmount',
        cleanShutdown: true,
        observedAt: now,
        observedBy: 'application',
        reason: 'React runtime unmounted cleanly.',
      };
      this.pushRuntimeEvent('react-unmount');
      this.persist(true);
    }
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    window.removeEventListener('error', this.onError);
    window.removeEventListener('unhandledrejection', this.onRejection);
    window.removeEventListener('orbital:astral-webgl', this.onAstralWebGL as EventListener);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('freeze', this.onFreeze as EventListener);
    document.removeEventListener('resume', this.onResume as EventListener);
  }

  private persist(force: boolean): void {
    if (!force) return;
    safeWrite(KEY, this.record);
  }

  private onPageHide = (event: PageTransitionEvent): void => {
    const now = Date.now();
    if (this.record.exitKind === 'running') this.record.exitKind = 'pagehide';
    this.record.cleanShutdown = true;
    this.record.lifecycle.pagehidePersisted = Boolean(event.persisted);
    this.record.terminationEvidence = {
      exitKind: this.record.exitKind,
      cleanShutdown: true,
      observedAt: now,
      pagehidePersisted: Boolean(event.persisted),
      observedBy: 'browser-lifecycle',
      reason: event.persisted ? 'Page entered the back-forward cache.' : 'Browser pagehide/navigation observed.',
    };
    this.pushRuntimeEvent('pagehide', { persisted: Boolean(event.persisted) });
    this.persist(true);
  };

  private onPageShow = (event: PageTransitionEvent): void => {
    const now = Date.now();
    this.record.lifecycle.pageshowPersisted = Boolean(event.persisted);
    this.pushRuntimeEvent('pageshow', { persisted: Boolean(event.persisted) });
    if (event.persisted) this.beginResumeWindow(now, 'pageshow-bfcache');
    this.persist(true);
  };

  private onVisibilityChange = (): void => {
    const now = Date.now();
    this.record.lifecycle.visibilityState = document.visibilityState;
    if (document.visibilityState === 'hidden') {
      this.record.lifecycle.lastHiddenAt = now;
      this.pushRuntimeEvent('visibility-hidden');
    } else if (document.visibilityState === 'visible') {
      this.record.lifecycle.lastVisibleAt = now;
      this.pushRuntimeEvent('visibility-visible');
      this.beginResumeWindow(now, 'visibility-visible');
    }
    this.persist(true);
  };

  private onFreeze = (): void => {
    this.record.lifecycle.freezeCount += 1;
    this.pushRuntimeEvent('freeze');
    this.persist(true);
  };

  private onResume = (): void => {
    const now = Date.now();
    this.record.lifecycle.resumeCount += 1;
    this.pushRuntimeEvent('resume');
    this.beginResumeWindow(now, 'page-lifecycle-resume');
    this.persist(true);
  };

  private onAstralWebGL = (event: Event): void => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
    const type = String(detail.type || 'unknown');
    if (type === 'context-lost') this.record.webglLosses += 1;
    this.pushRuntimeEvent(`astral-webgl-${type}`, detail);
    this.persist(true);
  };

  private onError = (event: ErrorEvent): void => {
    const message = event.message || 'unknown window error';
    const now = Date.now();
    this.record.exitKind = 'error';
    this.record.cleanShutdown = false;
    this.record.lastReason = message;
    this.record.lastWindowError = { message, at: now };
    this.record.terminationEvidence = {
      exitKind: 'error',
      cleanShutdown: false,
      observedAt: now,
      observedBy: 'application',
      reason: message,
    };
    this.pushRuntimeEvent('window-error', { message });
    getSessionRecoverySupervisor().markDegraded('Application error recorded; session recovery remains available.');
    this.persist(true);
  };

  private onRejection = (event: PromiseRejectionEvent): void => {
    const message = stringifyReason(event.reason);
    const now = Date.now();
    this.record.exitKind = 'unhandled-rejection';
    this.record.cleanShutdown = false;
    this.record.lastReason = message;
    this.record.lastUnhandledRejection = { message, at: now };
    this.record.terminationEvidence = {
      exitKind: 'unhandled-rejection',
      cleanShutdown: false,
      observedAt: now,
      observedBy: 'application',
      reason: message,
    };
    this.pushRuntimeEvent('unhandled-rejection', { message });
    getSessionRecoverySupervisor().markDegraded('Unhandled runtime rejection recorded; session recovery remains available.');
    this.persist(true);
  };
}
