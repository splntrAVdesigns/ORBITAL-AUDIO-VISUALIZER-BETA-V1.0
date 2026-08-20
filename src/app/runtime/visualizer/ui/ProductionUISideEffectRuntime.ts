export interface ProductionUISideEffectRuntimeOptions {
  params: Record<string, any>;
  setMacroValues: (updater: any) => void;
  flushQueuedUIUpdates: (options: any) => void;
  applyMacro: (macroName: string, value: number) => void;
  requestIdle: (callback: () => void, options?: { timeout?: number }) => unknown;
}

/** Phase 4.8H.4 — owns deferred DOM/React side effects outside the frame body. */
export class ProductionUISideEffectRuntime {
  private pending = false;
  private readonly queue: Array<() => void> = [];
  private pendingMacroUpdates: Record<string, number> = {};
  private macroUpdateQueued = false;

  constructor(private readonly options: ProductionUISideEffectRuntimeOptions) {}

  get hasPendingWork(): boolean {
    return this.pending && this.queue.length > 0;
  }

  schedule(update: () => void): void {
    this.queue.push(update);
    this.pending = true;
  }

  scheduleMacro(macroName: string, value: number): void {
    this.pendingMacroUpdates[macroName] = value;
    if (this.macroUpdateQueued) return;
    this.macroUpdateQueued = true;

    this.schedule(() => {
      this.macroUpdateQueued = false;
      const updates = this.pendingMacroUpdates;
      this.pendingMacroUpdates = {};
      const reactUpdates: Record<string, number> = {};

      Object.keys(updates).forEach(macro => {
        const val = updates[macro];
        this.options.applyMacro(macro, val);
        reactUpdates[macro] = val;
        const hiddenInput = document.getElementById(`${macro}-hidden`) as HTMLInputElement | null;
        if (hiddenInput) hiddenInput.value = String(val);
        const fillEl = document.querySelector<SVGPathElement>(`#${macro}-fill`);
        const valueEl = document.getElementById(`${macro}-value`);
        if (fillEl) {
          const path = fillEl;
          path.style.strokeDashoffset = String(val - 100);
          path.style.setProperty('--knob-angle', `${(val / 100) * 270}deg`);
          path.style.opacity = val > 0 ? '1' : '0';
          path.style.setProperty('--fill-percent', `${val}%`);
        }
        if (valueEl) valueEl.textContent = String(Math.round(val));
      });

      this.options.requestIdle(() => this.options.setMacroValues((prev: Record<string, number>) => {
        let changed = false;
        const next = { ...prev };
        for (const [macro, val] of Object.entries(reactUpdates)) {
          if (next[macro] !== val) {
            next[macro] = val;
            changed = true;
          }
        }
        return changed ? next : prev;
      }), { timeout: 150 });
    });
  }

  flush(setLastUIFlushMs: (ms: number) => void): void {
    if (!this.hasPendingWork) return;
    this.options.flushQueuedUIUpdates({
      pending: this.queue,
      setPending: (pending: boolean) => { this.pending = pending; },
      setLastUIFlushMs,
      maxUpdatesPerFlush: 4,
      maxFlushMs: 1.5,
    });
  }

  clear(): void {
    this.pendingMacroUpdates = {};
    this.macroUpdateQueued = false;
    this.queue.length = 0;
    this.pending = false;
  }

  updateMacroVisuals(): void {
    ['macro1', 'macro2', 'macro3', 'macro4'].forEach(macro => {
      const value = this.options.params[macro] !== undefined ? this.options.params[macro] : 0;
      const fillEl = document.querySelector<SVGPathElement>(`#${macro}-fill`);
      const valueEl = document.getElementById(`${macro}-value`);
      if (fillEl) {
        const path = fillEl;
        path.style.strokeDashoffset = String(value - 100);
        path.style.setProperty('--knob-angle', `${(value / 100) * 270}deg`);
        path.style.opacity = value > 0 ? '1' : '0';
        path.style.setProperty('--fill-percent', `${value}%`);
      }
      if (valueEl) valueEl.textContent = String(Math.round(value));
    });
  }
}

export function createProductionUISideEffectRuntime(options: ProductionUISideEffectRuntimeOptions) {
  return new ProductionUISideEffectRuntime(options);
}
