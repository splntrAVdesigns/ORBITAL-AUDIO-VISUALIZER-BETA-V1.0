export type RuntimeDisposer = () => void;

function once(disposer: RuntimeDisposer): RuntimeDisposer {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    disposer();
  };
}

/** LIFO cleanup registry. Every runtime-owned resource registers exactly once. */
export class RuntimeSessionDisposer {
  private disposers: RuntimeDisposer[] = [];
  private disposed = false;

  add(disposer: RuntimeDisposer | null | undefined): RuntimeDisposer {
    if (!disposer) return () => {};
    const guarded = once(disposer);
    if (this.disposed) {
      guarded();
      return () => {};
    }
    this.disposers.push(guarded);
    return guarded;
  }

  addDisposable(resource: { dispose?: () => void; cleanup?: () => void } | null | undefined): RuntimeDisposer {
    if (!resource) return () => {};
    if (typeof resource.dispose === 'function') return this.add(() => resource.dispose?.());
    if (typeof resource.cleanup === 'function') return this.add(() => resource.cleanup?.());
    return () => {};
  }

  get size(): number {
    return this.disposers.length;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (let i = this.disposers.length - 1; i >= 0; i -= 1) {
      try { this.disposers[i](); } catch (error) { errors.push(error); }
    }
    this.disposers.length = 0;
    if (errors.length) console.error('Runtime cleanup completed with errors:', errors);
  }
}
