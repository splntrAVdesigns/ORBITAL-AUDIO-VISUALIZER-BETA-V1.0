export class FrameScheduler {
  private rafId: number | null = null;
  schedule(callback: FrameRequestCallback) {
    if (this.rafId !== null) return this.rafId;
    this.rafId = requestAnimationFrame((time) => { this.rafId = null; callback(time); });
    return this.rafId;
  }
  cancel() { if (this.rafId !== null) cancelAnimationFrame(this.rafId); this.rafId = null; }
  get pending() { return this.rafId !== null; }
}
