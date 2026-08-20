export type RuntimeParameterListener<T extends object> = (
  snapshot: Readonly<T>,
  changedKeys: readonly (keyof T)[],
) => void;

/**
 * Mutable, allocation-light parameter store for the render runtime.
 * It can wrap the existing legacy params object during the staged extraction,
 * so current DOM bindings continue to work without React churn or duplicated state.
 */
export class RuntimeParameterStore<T extends object> {
  private readonly snapshot: T;
  private readonly listeners = new Set<RuntimeParameterListener<T>>();
  private revision = 0;
  private readonly externalShadow = new Map<keyof T, unknown>();

  constructor(initialSnapshot: T) {
    this.snapshot = initialSnapshot;
    for (const key of Object.keys(initialSnapshot) as (keyof T)[]) this.externalShadow.set(key, initialSnapshot[key]);
  }

  get current(): Readonly<T> {
    return this.snapshot;
  }

  get version(): number {
    return this.revision;
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.snapshot[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): boolean {
    if (Object.is(this.snapshot[key], value)) return false;
    this.snapshot[key] = value;
    this.externalShadow.set(key, value);
    this.revision += 1;
    this.emit([key]);
    return true;
  }

  patch(patch: Partial<T>): readonly (keyof T)[] {
    const changed: (keyof T)[] = [];
    for (const key of Object.keys(patch) as (keyof T)[]) {
      const value = patch[key];
      if (value !== undefined && !Object.is(this.snapshot[key], value)) {
        this.snapshot[key] = value as T[typeof key];
        this.externalShadow.set(key, value);
        changed.push(key);
      }
    }
    if (changed.length > 0) {
      this.revision += 1;
      this.emit(changed);
    }
    return changed;
  }


  /**
   * Transitional compatibility bridge for legacy controls that still mutate the
   * shared parameter object directly. Worker publication calls this before
   * reading a revision so RuntimeParameterStore remains the single authority.
   */
  synchronizeExternalMutations(): readonly (keyof T)[] {
    const changed: (keyof T)[] = [];
    for (const key of Object.keys(this.snapshot) as (keyof T)[]) {
      const value = this.snapshot[key];
      if (!Object.is(this.externalShadow.get(key), value)) {
        this.externalShadow.set(key, value);
        changed.push(key);
      }
    }
    if (changed.length > 0) {
      this.revision += 1;
      this.emit(changed);
    }
    return changed;
  }

  subscribe(listener: RuntimeParameterListener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  private emit(changedKeys: readonly (keyof T)[]): void {
    for (const listener of this.listeners) listener(this.snapshot, changedKeys);
  }
}

export function createRuntimeParameterStore<T extends object>(initialSnapshot: T): RuntimeParameterStore<T> {
  return new RuntimeParameterStore(initialSnapshot);
}