/** Sprint 21 — lightweight preset smoothing helper. */
export class PresetTransitionEngine {
  private from: Record<string, number> = {};
  private to: Record<string, number> = {};
  private elapsed = 0;
  active = false;
  constructor(private readonly duration = 0.22) {}

  start(params: any, next: any) {
    this.from = {};
    this.to = {};
    Object.keys(next || {}).forEach((key) => {
      const a = Number(params[key]);
      const b = Number(next[key]);
      if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 0.0001) {
        this.from[key] = a;
        this.to[key] = b;
      }
    });
    this.elapsed = 0;
    this.active = Object.keys(this.to).length > 0;
  }

  update(params: any, dt: number) {
    if (!this.active) return false;
    this.elapsed += dt;
    const x = Math.min(1, this.elapsed / this.duration);
    const e = 1 - Math.pow(1 - x, 3);
    Object.keys(this.to).forEach((key) => {
      params[key] = this.from[key] + (this.to[key] - this.from[key]) * e;
    });
    if (x >= 1) this.active = false;
    return this.active;
  }
}