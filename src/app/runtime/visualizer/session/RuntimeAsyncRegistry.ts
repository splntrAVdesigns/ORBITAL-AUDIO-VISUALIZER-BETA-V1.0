import type { RuntimeResourceScope } from './RuntimeResourceDiagnostics';

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type IdleHandle = number;

type IdleCallbackLike = (deadline: IdleDeadline) => void;

/** Owns every cancellable deferred callback created by one runtime session. */
export class RuntimeAsyncRegistry {
  private readonly timers = new Map<TimeoutHandle, () => void>();
  private readonly idleCallbacks = new Map<IdleHandle, () => void>();
  private disposed = false;

  constructor(private readonly resources: RuntimeResourceScope) {}

  setTimeout(callback: () => void, delayMs = 0): TimeoutHandle {
    if (this.disposed) return 0 as unknown as TimeoutHandle;
    const release = this.resources.track('activeTimers');
    let handle: TimeoutHandle;
    const wrapped = () => {
      this.timers.delete(handle);
      release();
      if (!this.disposed) callback();
    };
    handle = globalThis.setTimeout(wrapped, delayMs);
    this.timers.set(handle, release);
    return handle;
  }

  clearTimeout(handle: TimeoutHandle | null | undefined): void {
    if (handle == null) return;
    globalThis.clearTimeout(handle);
    const release = this.timers.get(handle);
    if (release) {
      this.timers.delete(handle);
      release();
    }
  }

  requestIdle(callback: IdleCallbackLike, options?: IdleRequestOptions): IdleHandle | TimeoutHandle {
    if (this.disposed) return 0;
    if (typeof globalThis.requestIdleCallback === 'function') {
      const release = this.resources.track('activeIdleCallbacks');
      let handle = 0;
      const wrapped: IdleCallbackLike = (deadline) => {
        this.idleCallbacks.delete(handle);
        release();
        if (!this.disposed) callback(deadline);
      };
      handle = globalThis.requestIdleCallback(wrapped, options);
      this.idleCallbacks.set(handle, release);
      return handle;
    }

    return this.setTimeout(() => {
      callback({
        didTimeout: true,
        timeRemaining: () => 0,
      } as IdleDeadline);
    }, Math.min(options?.timeout ?? 0, 50));
  }

  cancelIdle(handle: IdleHandle | TimeoutHandle | null | undefined): void {
    if (handle == null) return;
    if (this.idleCallbacks.has(handle as IdleHandle)) {
      if (typeof globalThis.cancelIdleCallback === 'function') {
        globalThis.cancelIdleCallback(handle as IdleHandle);
      }
      const release = this.idleCallbacks.get(handle as IdleHandle);
      this.idleCallbacks.delete(handle as IdleHandle);
      release?.();
      return;
    }
    this.clearTimeout(handle as TimeoutHandle);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [handle, release] of this.timers) {
      globalThis.clearTimeout(handle);
      release();
    }
    this.timers.clear();
    for (const [handle, release] of this.idleCallbacks) {
      if (typeof globalThis.cancelIdleCallback === 'function') globalThis.cancelIdleCallback(handle);
      release();
    }
    this.idleCallbacks.clear();
  }
}
