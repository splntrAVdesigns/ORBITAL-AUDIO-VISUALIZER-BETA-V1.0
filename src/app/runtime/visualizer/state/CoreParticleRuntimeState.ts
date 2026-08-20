export interface CoreParticleData {
  angle: number;
  radiusFactor: number;
  freqZoneIndex: number;
  freqIdx: number;
  chaosRandX: number;
  chaosRandY: number;
  jitterRandX: number;
  jitterRandY: number;
  id: number;
  sampleIdx: number;
  sampleOffset: number;
  depth: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phaseOffset: number;
  pulseDelay: number;
}

/** Owns mutable Core Particle simulation state and reset semantics. */
export class CoreParticleRuntimeState {
  readonly poolSize: number;
  particlePool: CoreParticleData[] = [];
  initialized = false;
  globalRadiusMultiplier = 1;
  pulseValue = 0;
  previousEnergy = 0;

  constructor(poolSize = 850) {
    this.poolSize = poolSize;
  }

  resetMotion(): void {
    this.globalRadiusMultiplier = 1;
    this.pulseValue = 0;
    this.previousEnergy = 0;
    for (const particle of this.particlePool) {
      particle.vx = 0;
      particle.vy = 0;
    }
  }

  dispose(): void {
    this.resetMotion();
    this.particlePool.length = 0;
    this.initialized = false;
  }
}
