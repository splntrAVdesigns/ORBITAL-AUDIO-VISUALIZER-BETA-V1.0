export interface CoreParticleImpulseInput {
  dt: number;
  beatTriggered: boolean;
  beatPulse: number;
  transient: number;
  bass: number;
  mid: number;
  high: number;
}

export interface CoreParticleImpulseFrame {
  impulse: number;
  bass: number;
  mid: number;
  high: number;
}

/**
 * Converts the authoritative beat/onset frame into a deterministic particle burst.
 * Continuous band energy remains separate from the one-shot outward impulse.
 */
export class CoreParticleImpulseRuntime {
  private impulse = 0;
  private cooldown = 0;
  private readonly frame: CoreParticleImpulseFrame = { impulse: 0, bass: 0, mid: 0, high: 0 };

  update(input: CoreParticleImpulseInput): CoreParticleImpulseFrame {
    const dt = Math.max(0, Math.min(0.1, input.dt || 0));
    this.cooldown = Math.max(0, this.cooldown - dt);

    const onset = Math.max(input.transient, input.beatPulse * 0.9);
    if (input.beatTriggered && this.cooldown <= 0) {
      this.impulse = Math.max(this.impulse, Math.min(1, 0.45 + onset * 0.75));
      this.cooldown = 0.085;
    } else if (onset > 0.72 && this.cooldown <= 0) {
      this.impulse = Math.max(this.impulse, Math.min(0.82, onset * 0.72));
      this.cooldown = 0.07;
    }

    // Fast attack is applied above; release is deterministic and frame-rate independent.
    this.impulse *= Math.exp(-dt * 8.8);
    if (this.impulse < 0.001) this.impulse = 0;

    this.frame.impulse = this.impulse;
    this.frame.bass = Math.max(0, Math.min(1, input.bass));
    this.frame.mid = Math.max(0, Math.min(1, input.mid));
    this.frame.high = Math.max(0, Math.min(1, input.high));
    return this.frame;
  }

  reset(): void {
    this.impulse = 0;
    this.cooldown = 0;
    this.frame.impulse = 0;
    this.frame.bass = 0;
    this.frame.mid = 0;
    this.frame.high = 0;
  }
}
