/**
 * ORBITAL — single Gamma response curve (Sprint M, linear gamma routing).
 *
 * The Gamma slider previously reached the spike ring through four different
 * curves: squared (Canvas2D baseline pulse, WebGL tip boost), pow(0.58)
 * (premium Canvas2D FX) and linear (WebGL gamma FX uniform). The same slider
 * position therefore looked different depending on which render path a preset
 * used. Every spike-ring consumer now reads this one linear response.
 *
 * Linear means: slider 0.5 → half the effect. At 1.0 every consumer produces
 * exactly what it produced before (1² = 1^0.58 = 1), so maximum looks are
 * unchanged; low/mid slider positions are what move.
 */
export function gammaResponse(gamma: number): number {
  if (!Number.isFinite(gamma)) return 0;
  return gamma <= 0 ? 0 : gamma >= 1 ? 1 : gamma;
}

/** Shared luminance pulse. Same phase clock (3.5 rad/s) as before; linear depth. */
export function gammaLuminancePulse(gamma: number, timeSeconds: number, depth = 0.15): number {
  return 1 + gammaResponse(gamma) * depth * Math.sin(timeSeconds * 3.5);
}
