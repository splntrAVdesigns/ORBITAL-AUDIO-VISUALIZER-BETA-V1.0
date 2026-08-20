export interface CenterEmitterGeometry {
  centerGlowRadius: number;
  emitterRadius: number;
  emitterBand: number;
  minimumOriginRadius: number;
  maximumOriginRadius: number;
}

export interface CenterEmitterGeometryInput {
  minSide: number;
  energy: number;
  coreRadius?: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function createCenterEmitterGeometry(): CenterEmitterGeometry {
  return {
    centerGlowRadius: 1,
    emitterRadius: 1,
    emitterBand: 1,
    minimumOriginRadius: 0.5,
    maximumOriginRadius: 1.5,
  };
}

/**
 * Shared worker-safe center geometry for Center Glow and Spark Impact.
 * The source is a narrow annular shell, never the exact canvas origin.
 */
export function updateCenterEmitterGeometry(
  target: CenterEmitterGeometry,
  input: CenterEmitterGeometryInput,
): CenterEmitterGeometry {
  const minSide = Math.max(1, input.minSide);
  const energy = clamp01(input.energy);
  const centerGlowRadius = minSide * 0.2 * (1 + energy * 0.5);
  const coreRadius = Number.isFinite(input.coreRadius) && (input.coreRadius ?? 0) > 0
    ? Math.max(1, input.coreRadius as number)
    : centerGlowRadius * 0.82;

  // Keep the emission shell inside the visible center-glow body while also
  // respecting the current center-ring geometry. This stays stable when Spark
  // Dispersion changes; dispersion owns travel, not source position.
  const emitterRadius = Math.max(
    minSide * 0.042,
    Math.min(centerGlowRadius * 0.33, coreRadius * 0.46),
  );
  const emitterBand = Math.max(2, Math.min(emitterRadius * 0.16, minSide * 0.018));
  const halfBand = emitterBand * 0.5;

  target.centerGlowRadius = centerGlowRadius;
  target.emitterRadius = emitterRadius;
  target.emitterBand = emitterBand;
  target.minimumOriginRadius = Math.max(2, emitterRadius - halfBand);
  target.maximumOriginRadius = Math.max(target.minimumOriginRadius + 1, emitterRadius + halfBand);
  return target;
}
