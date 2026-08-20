export type RuntimeDisposer = () => void;

interface ResourceRecord<T = unknown> {
  value: T;
  dispose?: (value: T) => void;
}

/** Central ownership registry for frame-rendering resources and teardown callbacks. */
export class RendererResourceRegistry {
  private readonly resources = new Map<string, ResourceRecord>();
  private readonly disposers: RuntimeDisposer[] = [];
  private disposed = false;

  register<T>(key: string, value: T, dispose?: (value: T) => void): T {
    if (this.disposed) throw new Error(`Cannot register runtime resource after disposal: ${key}`);
    const prior = this.resources.get(key);
    if (prior && prior.value !== value) this.disposeRecord(prior);
    this.resources.set(key, { value, dispose } as ResourceRecord);
    return value;
  }

  get<T>(key: string): T | null {
    return (this.resources.get(key)?.value as T | undefined) ?? null;
  }

  has(key: string): boolean {
    return this.resources.has(key);
  }

  unregister(key: string, dispose = false): void {
    const record = this.resources.get(key);
    if (!record) return;
    this.resources.delete(key);
    if (dispose) this.disposeRecord(record);
  }

  addDisposer(disposer: RuntimeDisposer): RuntimeDisposer {
    if (this.disposed) {
      disposer();
      return disposer;
    }
    this.disposers.push(disposer);
    return disposer;
  }

  get resourceCount(): number {
    return this.resources.size;
  }

  get disposableCount(): number {
    return this.disposers.length;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (let i = this.disposers.length - 1; i >= 0; i -= 1) {
      try { this.disposers[i](); } catch (error) { console.warn('Runtime disposer failed:', error); }
    }
    this.disposers.length = 0;

    const records = Array.from(this.resources.values());
    this.resources.clear();
    for (let i = records.length - 1; i >= 0; i -= 1) this.disposeRecord(records[i]);
  }

  private disposeRecord(record: ResourceRecord): void {
    if (!record.dispose) return;
    try { record.dispose(record.value); } catch (error) { console.warn('Runtime resource disposal failed:', error); }
  }
}
