export type SerializedAnalysisStatus = 'completed' | 'superseded' | 'disposed' | 'failed';

export interface SerializedAnalysisOutcome<Result> {
  readonly revision: number;
  readonly status: SerializedAnalysisStatus;
  readonly value: Result | null;
  readonly error?: unknown;
}

interface PendingJob<Input, Result> {
  readonly revision: number;
  readonly input: Input;
  readonly resolve: (outcome: SerializedAnalysisOutcome<Result>) => void;
}

/**
 * Runs at most one expensive analysis at a time and keeps only the latest queued
 * request. An in-flight browser decode cannot be cancelled, but stale results are
 * never published and no second decoded AudioBuffer is created concurrently.
 */
export class LatestOnlySerializedAnalysisQueue<Input, Result> {
  private pending: PendingJob<Input, Result> | null = null;
  private running = false;
  private disposed = false;
  private latestRevision = 0;
  private activeJobs = 0;
  private maximumConcurrentJobs = 0;

  constructor(private readonly analyze: (input: Input) => Promise<Result | null>) {}

  enqueue(input: Input): Promise<SerializedAnalysisOutcome<Result>> {
    if (this.disposed) {
      return Promise.resolve({ revision: this.latestRevision, status: 'disposed', value: null });
    }

    const revision = ++this.latestRevision;
    if (this.pending) {
      this.pending.resolve({ revision: this.pending.revision, status: 'superseded', value: null });
      this.pending = null;
    }

    const promise = new Promise<SerializedAnalysisOutcome<Result>>((resolve) => {
      this.pending = { revision, input, resolve };
    });
    void this.drain();
    return promise;
  }

  invalidate(): number {
    if (this.disposed) return this.latestRevision;
    const revision = ++this.latestRevision;
    if (this.pending) {
      this.pending.resolve({ revision: this.pending.revision, status: 'superseded', value: null });
      this.pending = null;
    }
    return revision;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.pending) {
      this.pending.resolve({ revision: this.pending.revision, status: 'disposed', value: null });
      this.pending = null;
    }
  }

  get snapshot(): Readonly<{
    running: boolean;
    hasPending: boolean;
    latestRevision: number;
    activeJobs: number;
    maximumConcurrentJobs: number;
    disposed: boolean;
  }> {
    return Object.freeze({
      running: this.running,
      hasPending: this.pending !== null,
      latestRevision: this.latestRevision,
      activeJobs: this.activeJobs,
      maximumConcurrentJobs: this.maximumConcurrentJobs,
      disposed: this.disposed,
    });
  }

  private async drain(): Promise<void> {
    if (this.running || this.disposed) return;
    this.running = true;

    try {
      while (!this.disposed && this.pending) {
        const job = this.pending;
        this.pending = null;
        this.activeJobs += 1;
        this.maximumConcurrentJobs = Math.max(this.maximumConcurrentJobs, this.activeJobs);

        try {
          const value = await this.analyze(job.input);
          const status: SerializedAnalysisStatus = this.disposed
            ? 'disposed'
            : job.revision === this.latestRevision
              ? 'completed'
              : 'superseded';
          job.resolve({ revision: job.revision, status, value: status === 'completed' ? value : null });
        } catch (error) {
          const status: SerializedAnalysisStatus = this.disposed
            ? 'disposed'
            : job.revision === this.latestRevision
              ? 'failed'
              : 'superseded';
          job.resolve({ revision: job.revision, status, value: null, error });
        } finally {
          this.activeJobs = Math.max(0, this.activeJobs - 1);
        }
      }
    } finally {
      this.running = false;
      if (!this.disposed && this.pending) void this.drain();
    }
  }
}
