import { CORE_PARTICLE_CAPACITY } from './CoreParticleSeedData';

export const CORE_PARTICLE_MIN_FIELD_SCALE = 0.115;
export const CORE_PARTICLE_MAX_FIELD_SCALE = 0.315;

export function clampCoreParticleControl(
  value: number,
  minimum = 0,
  maximum = 1,
): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}

/**
 * Converts Spread into a useful core-area radius. The Phase 4.3 shader used
 * 4.5–15% of the short canvas side, which compressed the full particle field
 * into a small center knot. This curve reserves 11.5% at zero and expands to
 * 31.5% at full Spread while retaining headroom inside the spike ring.
 */
export function resolveCoreParticleFieldRadius(minSide: number, spread: number): number {
  const normalizedSpread = Math.pow(clampCoreParticleControl(spread), 0.78);
  const fieldScale = CORE_PARTICLE_MIN_FIELD_SCALE +
    (CORE_PARTICLE_MAX_FIELD_SCALE - CORE_PARTICLE_MIN_FIELD_SCALE) * normalizedSpread;
  return Math.max(1, minSide) * fieldScale;
}

/** Perceptual lift for analyser bands without hard-clipping typical program audio. */
export function liftCoreParticleBand(value: number, drive: number): number {
  return clampCoreParticleControl(1 - Math.exp(-clampCoreParticleControl(value) * drive));
}

/** Color-only flash envelope. Motion and point size never consume this value. */
export function resolveCoreParticlePulse(pulseEnvelope: number, control: number): number {
  const amount = clampCoreParticleControl(control);
  return clampCoreParticleControl(pulseEnvelope) * amount * (0.55 + amount * 0.75);
}

/** One progressive Burst mapping. The upstream envelope is deliberately unscaled. */
export function resolveCoreParticleImpulse(
  impulse: number,
  burstStrength: number,
): number {
  const strength = clampCoreParticleControl(burstStrength);
  return clampCoreParticleControl(impulse) * strength * (0.72 + strength * 0.20);
}

const LEGACY_INTENSITY_DRIVE = 2.35;
const LEGACY_ZERO_SOURCE = 0.25;

function resolveLegacyCoreParticleIntensity(value: number): number {
  return clampCoreParticleControl(
    (1 - Math.exp(-LEGACY_INTENSITY_DRIVE * value)) /
    (1 - Math.exp(-LEGACY_INTENSITY_DRIVE)),
  );
}

/**
 * Keeps the simulation normalized while making the former 25% appearance the
 * new zero point. This changes the floor without overdriving forces above 1.
 */
export function resolveCoreParticleIntensity(intensity: number): number {
  const value = clampCoreParticleControl(intensity);
  const floor = resolveLegacyCoreParticleIntensity(LEGACY_ZERO_SOURCE);
  return floor + (1 - floor) * resolveLegacyCoreParticleIntensity(value);
}

/** Four-times perceptual energy range, separate from normalized simulation force. */
export function resolveCoreParticleVisualEnergy(intensity: number): number {
  return 1 + clampCoreParticleControl(intensity) * 3;
}

/** Bounded diameter authority; alpha/luminance supplies the remainder of the 4x gain. */
export function resolveCoreParticleDiameterGain(intensity: number): number {
  return 1 + Math.pow(clampCoreParticleControl(intensity), 0.82) * 0.70;
}

/** Density now spans a clearly visible 96–850 particle range. */
export function resolveCoreParticleDrawCount(density: number): number {
  const normalized = clampCoreParticleControl((density - 0.25) / 0.75);
  return Math.round(96 + (CORE_PARTICLE_CAPACITY - 96) * Math.pow(normalized, 0.82));
}
