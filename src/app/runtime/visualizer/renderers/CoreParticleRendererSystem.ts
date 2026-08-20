import { CoreParticleRuntimeState, type CoreParticleData } from '../state/CoreParticleRuntimeState';
import type { RendererAdapter, RendererSystem } from './RendererSystem';

export interface CoreParticleAudioFrame {
  bass: number;
  mid: number;
  high: number;
  transient: number;
  beat: number;
}
export interface CoreParticleRendererFrame {
  dt: number;
  audio: CoreParticleAudioFrame;
  spread: number;
  chaos: number;
  damping: number;
  burstStrength: number;
  payload: unknown;
}

/** Owns particle pool, velocity integration, burst envelope and band mapping. */
export class CoreParticleRendererSystem implements RendererSystem<CoreParticleRendererFrame, void> {
  readonly state: CoreParticleRuntimeState;
  private frame: CoreParticleRendererFrame | null = null;
  private burstImpulse = 0;

  constructor(poolSize = 850, private adapter?: RendererAdapter<CoreParticleRendererFrame, void>) {
    this.state = new CoreParticleRuntimeState(poolSize);
  }

  setPool(pool: CoreParticleData[], initialized = true): void {
    this.state.particlePool = pool;
    this.state.initialized = initialized;
  }

  update(frame: CoreParticleRendererFrame): void {
    this.frame = frame;
    const dt = Math.max(0, Math.min(0.05, frame.dt));
    const beatDrive = Math.max(frame.audio.beat, frame.audio.transient) * frame.burstStrength;
    this.burstImpulse = Math.max(beatDrive, this.burstImpulse * Math.exp(-8.5 * dt));
    const radial = frame.audio.bass * 0.55 + this.burstImpulse * 0.85;
    const swirl = frame.audio.mid * frame.chaos * 0.18;
    const shimmer = frame.audio.high * 0.08;
    const damping = Math.exp(-Math.max(0.1, frame.damping) * 6 * dt);
    for (const particle of this.state.particlePool) {
      const cos = Math.cos(particle.angle);
      const sin = Math.sin(particle.angle);
      particle.vx = (particle.vx + (cos * radial - sin * swirl + particle.jitterRandX * shimmer) * dt) * damping;
      particle.vy = (particle.vy + (sin * radial + cos * swirl + particle.jitterRandY * shimmer) * dt) * damping;
      particle.x += particle.vx;
      particle.y += particle.vy;
    }
    this.state.pulseValue = this.burstImpulse;
  }

  getBurstImpulse(): number { return this.burstImpulse; }
  render(): void { if (this.frame) this.adapter?.render(this.frame, undefined); }
  reset(): void { this.frame = null; this.burstImpulse = 0; this.state.resetMotion(); this.adapter?.reset?.(); }
  dispose(): void { this.reset(); this.state.dispose(); this.adapter?.dispose?.(); this.adapter = undefined; }
}
