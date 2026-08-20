import type { RuntimeResourceScope } from './RuntimeResourceDiagnostics';

type Listener = EventListenerOrEventListenerObject;

/** Session-owned event listener registry using one AbortController. */
export class RuntimeEventRegistry {
  private readonly controller = new AbortController();
  private readonly releases: Array<() => void> = [];
  private disposed = false;

  constructor(private readonly resources: RuntimeResourceScope) {}

  listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (this: Window, event: WindowEventMap[K]) => unknown,
    options?: AddEventListenerOptions | boolean,
  ): void;
  listen<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (this: Document, event: DocumentEventMap[K]) => unknown,
    options?: AddEventListenerOptions | boolean,
  ): void;
  listen(
    target: EventTarget,
    type: string,
    listener: Listener,
    options?: AddEventListenerOptions | boolean,
  ): void;
  listen(
    target: EventTarget,
    type: string,
    listener: Listener,
    options?: AddEventListenerOptions | boolean,
  ): void {
    if (this.disposed) return;
    const normalized = typeof options === 'boolean'
      ? { capture: options, signal: this.controller.signal }
      : { ...(options ?? {}), signal: this.controller.signal };
    target.addEventListener(type, listener, normalized);
    this.releases.push(this.resources.track('activeListeners'));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.abort();
    for (const release of this.releases.splice(0)) release();
  }
}
