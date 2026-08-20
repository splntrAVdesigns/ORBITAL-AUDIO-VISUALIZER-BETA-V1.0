const TAU = Math.PI * 2;

/**
 * Advances Halo Comet from the same scheduler-clamped delta used by rotation,
 * Auto Zoom, and Orbital Energy.
 */
export class HaloCometOrbitRuntime {
  private phase = -Math.PI * 0.5;

  update(enabled: boolean, speedValue: number, directionValue: number, deltaSeconds: number): number {
    if (!enabled) return this.phase;
    const elapsedSeconds = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(1 / 45, deltaSeconds))
      : 0;
    const speed = Math.max(0, Math.min(1.5, Number(speedValue) || 0));
    const direction = Number(directionValue) < 0 ? -1 : 1;
    this.phase = (this.phase + direction * speed * TAU * elapsedSeconds) % TAU;
    return this.phase;
  }

  reset(): void {
    this.phase = -Math.PI * 0.5;
  }
}
