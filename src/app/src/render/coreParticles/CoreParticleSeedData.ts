export const CORE_PARTICLE_CAPACITY = 850;
export const CORE_PARTICLE_SEED_FLOATS = 4;
export const CORE_PARTICLE_STATE_FLOATS = 4;

export interface CoreParticleSeedData {
  readonly seed0: Float32Array;
  readonly seed1: Float32Array;
  readonly initialState: Float32Array;
}

/** Stable numeric hash retained from the frozen Canvas2D particle distribution. */
export function coreParticleHash(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Builds the immutable GPU seed buffers once. No random source or frame-time value
 * participates, so reference captures and presets are deterministic across sessions.
 */
export function createCoreParticleSeedData(
  count = CORE_PARTICLE_CAPACITY,
): CoreParticleSeedData {
  const seed0 = new Float32Array(count * CORE_PARTICLE_SEED_FLOATS);
  const seed1 = new Float32Array(count * CORE_PARTICLE_SEED_FLOATS);
  const initialState = new Float32Array(count * CORE_PARTICLE_STATE_FLOATS);

  for (let index = 0; index < count; index += 1) {
    const offset = index * CORE_PARTICLE_SEED_FLOATS;
    const angle = coreParticleHash(index * 7919.234) * Math.PI * 2;
    // Area-weighted distribution: Phase 4.3's power-of-2.5 curve placed most
    // particles at the origin, producing a glowing blob. A sub-linear curve
    // retains a calm circular rest state while using the full core field.
    const radiusFactor = Math.pow(coreParticleHash(index * 13579.246), 0.68);
    const zoneChoice = coreParticleHash(index * 3141.592);
    const zone = zoneChoice < 0.35 ? 0 : zoneChoice < 0.75 ? 1 : 2;

    seed0[offset] = angle;
    seed0[offset + 1] = radiusFactor;
    seed0[offset + 2] = coreParticleHash(index * 77391.251) * Math.PI * 2;
    seed0[offset + 3] = zone;

    seed1[offset] = coreParticleHash(index * 91234.111) * 2 - 1;
    seed1[offset + 1] = coreParticleHash(index * 67890.222) * 2 - 1;
    seed1[offset + 2] = 0.25 + coreParticleHash(index * 1357.999) * 0.75;
    seed1[offset + 3] = (coreParticleHash(index * 45678.333) * 2 - 1) * 40;
  }

  return { seed0, seed1, initialState };
}

/** Re-seeds both transform-feedback buffers when the renderer is first shown/restored. */
export function resetCoreParticleState(
  target: Float32Array,
  seed0: Float32Array,
  fieldRadius: number,
): void {
  const count = Math.min(
    target.length / CORE_PARTICLE_STATE_FLOATS,
    seed0.length / CORE_PARTICLE_SEED_FLOATS,
  );
  for (let index = 0; index < count; index += 1) {
    const offset = index * CORE_PARTICLE_STATE_FLOATS;
    const angle = seed0[offset];
    const radius = fieldRadius * (0.10 + seed0[offset + 1] * 0.76);
    target[offset] = Math.cos(angle) * radius;
    target[offset + 1] = Math.sin(angle) * radius;
    target[offset + 2] = 0;
    target[offset + 3] = 0;
  }
}
