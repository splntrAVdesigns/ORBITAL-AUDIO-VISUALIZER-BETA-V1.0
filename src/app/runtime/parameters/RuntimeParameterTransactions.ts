import { defaultParams, type VisualizerParams } from '../../config/defaultParams';

type Widen<T> = T extends number ? number : T extends boolean ? boolean : T extends string ? string : T;

export type RuntimeParameterKey = keyof VisualizerParams;
export type RuntimeParameterPatch = {
  [K in RuntimeParameterKey]?: Widen<VisualizerParams[K]>;
};

export type RuntimeParameterTarget = Partial<Record<RuntimeParameterKey, unknown>>;
export interface RuntimeParameterStoreTarget {
  patch(patch: RuntimeParameterPatch): readonly PropertyKey[];
}
export type RuntimeParameterTransactionSource =
  | 'control'
  | 'macro'
  | 'midi'
  | 'preset'
  | 'settings-import'
  | 'runtime';

export interface RuntimeParameterTransactionDetail {
  readonly patch: Readonly<RuntimeParameterPatch>;
  readonly source: RuntimeParameterTransactionSource;
}

export interface RuntimeParameterTransactionResult {
  readonly applied: RuntimeParameterKey[];
  readonly rejected: string[];
  readonly clamped: RuntimeParameterKey[];
}

interface NumericConstraint {
  readonly minimum: number;
  readonly maximum: number;
  readonly integer?: boolean;
  readonly allowedValues?: readonly number[];
}

export const RUNTIME_PARAMETER_TRANSACTION_EVENT = 'orbital:param-transaction';

const numericConstraints: Partial<Record<RuntimeParameterKey, NumericConstraint>> = {
  rotation: { minimum: -2, maximum: 2 },
  mirror: { minimum: 0, maximum: 1 },
  zoom: { minimum: 0.4, maximum: 2.5 },
  lineWidth: { minimum: 0.1, maximum: 12 },
  innerRadius: { minimum: 0.05, maximum: 0.8 },
  tail: { minimum: 0, maximum: 1 },
  halo: { minimum: 0, maximum: 1.5 },
  bloom: { minimum: 0, maximum: 1 },
  trail: { minimum: 0, maximum: 1 },
  // Presets may store normalized density (0-1); the live renderer stores 22-270 dots.
  dotsDensity: { minimum: 0, maximum: 270 },
  gamma: { minimum: 0, maximum: 1 },
  iridize: { minimum: 0, maximum: 1 },
  chaos: { minimum: 0, maximum: 1 },
  orbitalEnergy: { minimum: 0, maximum: 2 },
  orbitalWidth: { minimum: 0.1, maximum: 1.5 },
  orbitalDirection: { minimum: -1, maximum: 1, integer: true, allowedValues: [-1, 1] },
  haloCometSpeed: { minimum: 0.05, maximum: 1 },
  haloCometDirection: { minimum: -1, maximum: 1, integer: true, allowedValues: [-1, 1] },
  haloCometThickness: { minimum: 1, maximum: 10 },
  haloCometTailLength: { minimum: 0.05, maximum: 0.65 },
  vizMode: { minimum: 0, maximum: 3, integer: true },
  glowStrength: { minimum: 0, maximum: 1 },
  dotSize: { minimum: 0.5, maximum: 5 },
  dotGlow: { minimum: 0, maximum: 5 },
  hueSpeed: { minimum: 0, maximum: 3 },
  motionIntensity: { minimum: 0, maximum: 1 },
  motionSmoothing: { minimum: 0, maximum: 1 },
  bassBoost: { minimum: 0, maximum: 1 },
  reactivity: { minimum: 0, maximum: 1 },
  reactivityBlend: { minimum: 0, maximum: 1 },
  reactivityHz: { minimum: 30, maximum: 60, integer: true, allowedValues: [30, 60] },
  shockwaveThreshold: { minimum: 0, maximum: 2 },
  shockwaveSpeed: { minimum: 0.1, maximum: 3 },
  shockwaveDecay: { minimum: 0.5, maximum: 0.99 },
  shockwaveRings: { minimum: 1, maximum: 5, integer: true },
  sparkAmps: { minimum: 0, maximum: 1 },
  sparkTrail: { minimum: 0, maximum: 1 },
  sparkDensity: { minimum: 0, maximum: 1 },
  sparkDispersion: { minimum: 0, maximum: 1 },
  shapeEdgeTrails: { minimum: 0, maximum: 1 },
  shapeDistortion: { minimum: 0, maximum: 1 },
  shapeTurbulence: { minimum: 0, maximum: 1 },
  shapeDecay: { minimum: 0, maximum: 1 },
  shapeOrbitDrift: { minimum: 0, maximum: 1 },
  shapeDensity: { minimum: 0.25, maximum: 1 },
  shapeBurstStrength: { minimum: 0, maximum: 1 },
  centerImageScale: { minimum: 0, maximum: 1.2 },
  centerImageRotation: { minimum: -360, maximum: 360 },
  centerImageOpacity: { minimum: 0, maximum: 1 },
  centerImageX: { minimum: -100, maximum: 100 },
  centerImageY: { minimum: -100, maximum: 100 },
  centerImageSaturation: { minimum: 0, maximum: 2 },
  centerImageHueShift: { minimum: -180, maximum: 180 },
  centerImageDisplacement: { minimum: 0, maximum: 100 },
  centerImageKenBurnsSpeed: { minimum: 0.1, maximum: 4 },
  centerImageMotionAmount: { minimum: 0, maximum: 1 },
  centerImageMotionIntensity: { minimum: 0, maximum: 1 },
  recordFPS: { minimum: 30, maximum: 60, integer: true, allowedValues: [30, 60] },
  zoomOsc: { minimum: 0, maximum: 1 },
  zoomOscSpeed: { minimum: 0, maximum: 10 },
  zoomRings: { minimum: 1, maximum: 64, integer: true },
  centerImageAberration: { minimum: 0, maximum: 1 },
  centerImageJitter: { minimum: 0, maximum: 1 },
  centerImageKaleidoscope: { minimum: 0, maximum: 1 },
  autoRotateSpeed: { minimum: 0.1, maximum: 10 },
  centerImageRGBOffset: { minimum: 0, maximum: 1 },
  centerImageRGBAngle: { minimum: 0, maximum: 360 },
  eclipseWeight: { minimum: 0, maximum: 1 },
  gammaBlast: { minimum: 0, maximum: 1 },
  macro1: { minimum: 0, maximum: 100 },
  macro2: { minimum: 0, maximum: 100 },
  macro3: { minimum: 0, maximum: 100 },
  macro4: { minimum: 0, maximum: 100 },
  macro5: { minimum: 0, maximum: 100 },
  macro6: { minimum: 0, maximum: 100 },
  macro7: { minimum: 0, maximum: 100 },
  macro8: { minimum: 0, maximum: 100 },
  beatSensitivity: { minimum: 0, maximum: 1 },
  effectAmount: { minimum: 0, maximum: 1 },
  darkStrobeDepth: { minimum: 0, maximum: 1 },
  starFieldCount: { minimum: 150, maximum: 900 },
  starFieldSpeed: { minimum: 0.5, maximum: 15 },
  starFieldSpread: { minimum: 10, maximum: 150 },
  starFieldSize: { minimum: 0, maximum: 20 },
  starFieldFocalDepth: { minimum: 1, maximum: 30 },
  starFieldTurbulence: { minimum: 0, maximum: 10 },
  starFieldGlitter: { minimum: 0, maximum: 10 },
  starFieldTrail: { minimum: 0, maximum: 100 },
  darkStrobeDisplacement: { minimum: 0, maximum: 1 },
  motionBlur: { minimum: 0, maximum: 1 },
  motionBlurPersistence: { minimum: 0, maximum: 1 },
  beatAccent: { minimum: 0, maximum: 2 },
  bpm: { minimum: 40, maximum: 220, integer: true },
  bars: { minimum: 1, maximum: 32, integer: true },
  energyThreshold: { minimum: 0.05, maximum: 0.5 },
  energyRelease: { minimum: 0.1, maximum: 1 },
  fftSize: { minimum: 9, maximum: 13, integer: true },
  spikeAttack: { minimum: 0.1, maximum: 1.2 },
  spikeTightness: { minimum: 0.2, maximum: 1.5 },
  bassReduce: { minimum: 0, maximum: 1 },
  frequencyMix: { minimum: 0, maximum: 1 },
  spikeBloom: { minimum: 0, maximum: 1 },
  spikeVariety: { minimum: 0, maximum: 1 },
  dotRipple: { minimum: 0, maximum: 1 },
  transientBoost: { minimum: 0, maximum: 1 },
  astralMorphAmount: { minimum: 0, maximum: 1 },
  astralMorphDamping: { minimum: 0, maximum: 1 },
  astralFieldModulation: { minimum: 0, maximum: 1 },
  astralAudioInfluence: { minimum: 0, maximum: 1 },
  astralPulseDepth: { minimum: 0, maximum: 1 },
  astralEnergyGlow: { minimum: 0, maximum: 1 },
  astralRotationMult: { minimum: 0, maximum: 4 },
  astralRotationJitter: { minimum: 0, maximum: 1 },
  astralComplexity: { minimum: 1, maximum: 10, integer: true },
  astralLineThickness: { minimum: 0.5, maximum: 4 },
  astralScale: { minimum: 0.3, maximum: 1.5 },
  astralSymmetryFold: { minimum: 3, maximum: 12, integer: true, allowedValues: [3, 6, 8, 12] },
  astralRGBOffset: { minimum: 0, maximum: 1 },
  astralRGBAngle: { minimum: 0, maximum: 360 },
  coreTexturesOpacity: { minimum: 0, maximum: 1 },
  coreTexturesAudioIntensity: { minimum: 0, maximum: 1 },
  coreTexturesScale: { minimum: 0.1, maximum: 4 },
  coreTexturesSpeed: { minimum: 0, maximum: 4 },
  coreTexturesDensity: { minimum: 0, maximum: 1 },
  coreTexturesGlowIntensity: { minimum: 0, maximum: 1 },
};

const enumValues: Partial<Record<RuntimeParameterKey, readonly string[]>> = {
  reactivityMode: ['instant', 'smooth', 'hybrid', 'manual'],
  beatPulseType: ['flash', 'color', 'rainbow', 'spark', 'dark-strobe', 'starfield'],
  starFieldBlendMode: ['screen', 'lighter', 'source-over'],
  coreParticlesShapeMode: ['dot', 'tri', 'dia', 'all'],
  centerImageColorGrade: [
    'none', 'warmSunset', 'coolCyberpunk', 'vintageFilm', 'neonDreams',
    'cyberBlue', 'infrared', 'chromeFade', 'vaporPink', 'acidGreen',
    'monoBlue', 'warmFilm', 'highContrastTech',
  ],
  centerImageColorSource: ['master', 'center', 'lut', 'manual', 'hybrid'],
  centerImageMotionProfile: [
    'static', 'floating', 'cinematic', 'hologram', 'organic', 'broadcast', 'audioReactive',
  ],
  coreTexturesFrequencyRange: ['low', 'mid', 'high', 'full'],
  frequencyBand: ['bass', 'mid', 'high', 'full'],
  motionBlurMode: ['multiply', 'alpha'],
  rotationSyncMode: ['free', 'bpm', 'quantized', 'pingpong', 'oscillator'],
  rotationQuantize: ['4/1', '2/1', '1/1', '1/2', '1/4', '1/8'],
  haloStrobeDivision: ['1/1', '1/2', '1/4', '1/8'],
  centerImageMotionType: [
    'none', 'slowDrift', 'staticDrift', 'floating', 'verticalFloat',
    'horizontalFloat', 'slowFloat', 'orbitDrift', 'organicDrift',
    'hologramDrift', 'pendulumSwing', 'cinematicZoom', 'cinematicPush',
    'breathingZoom', 'logoRevealLoop', 'kenBurnsDrift', 'rockBack',
    'audioReactive', 'downSlide', 'fallTicker', 'tickerScroll',
    'broadcastSweep', 'sideSweep', 'popIn', 'glitchSnap', 'microJitter',
    'beatPunch', 'signalLock', 'shakeBurst', 'dataCorruption',
    'digitalSkip', 'pulseBurst', 'orbit', 'float', 'hover', 'pendulum',
    'zoomPulse', 'spiral', 'inertia',
  ],
  astralShape: [
    'sg-seed-of-life', 'sg-flower-of-life', 'sg-flower-extended',
    'sg-vesica-piscis', 'sg-vesica-chain', 'sg-torus-halo',
    'sg-metatron-cube', 'sg-metatron-dense', 'sg-fruit-of-life',
    'sg-cube-of-space', 'sg-sri-yantra', 'sg-sri-yantra-dense',
    'sg-merkaba', 'sg-tetrahedron', 'sg-icosahedron', 'sg-dodecahedron',
    'sg-platonic-stack', 'kx-mirror-quad', 'kx-mirror-hex', 'kx-mirror-oct',
    'kx-polar-wedge', 'kx-rosette', 'kx-mandala-rings', 'kx-radial-tiles',
    'kx-dihedral', 'kx-seam-hide', 'fx-spirograph-hypo', 'fx-spirograph-epi',
    'fx-guilloche-rosette', 'fx-guilloche-ribbon', 'fx-moire-disc',
    'fx-moire-lattice', 'fx-lissajous', 'fx-harmonograph',
    'fx-fibonacci-spiral', 'fx-golden-spiral', 'fx-torus-knot',
    'gl-runic-ring', 'gl-sigil-circle', 'gl-solar-disc', 'gl-lunar-phases',
    'gl-alchemy-symbols', 'gl-astral-chart', 'gl-techno-hiero',
    'gl-circuit-glyph', 'gl-tablet-lines', 'gl-compass-rose', 'gl-celtic-knot',
    'gl-lotus-mandala', 'gl-labyrinth', 'vj-hex-grid', 'vj-triangle-grid',
    'vj-isometric-grid', 'vj-concentric-squares', 'vj-concentric-triangles',
    'vj-nested-polygons', 'vj-star-polygon', 'vj-radial-lines', 'vj-radar-sweep',
    'vj-orbital-nodes', 'vj-arc-segments', 'vj-crosshair-rings', 'vj-circle',
    'vj-square', 'vj-triangle', 'vj-pentagon', 'vj-octagon',
    // Legacy identifiers stay valid for saved preset/import compatibility.
    'flower-of-life', 'seed-of-life', 'metatron-cube', 'sri-yantra',
    'hexagon-lattice', 'triangle-grid', 'vesica-piscis', 'circle', 'square',
    'triangle', 'pentagon', 'octagon', 'torus-knot', 'mandala',
    'star-tetrahedron', 'icosahedron', 'merkaba', 'double-helix',
    'fibonacci-spiral', 'golden-spiral', 'lotus-mandala', 'celtic-knot',
    'platonic-solid', 'labyrinth',
  ],
  astralMorphMode: ['crossfade', 'path-interpolate'],
  astralMorphOrigin: ['uniform', 'center', 'polarity'],
  astralCycleSpeed: ['slug', 'slow', 'medium', 'fast', 'chaos'],
  astralStrokeStyle: ['solid', 'dashed', 'dotted', 'glowing'],
  coreTexturesShaderId: [
    'digital-matrix', 'liquid-gradient', 'geometric-pattern', 'noise-glitch',
    'plasma-sphere', 'terrain-wireframe', 'particle-cube-field',
    'hologrid-depth-tunnel', 'cosmic-orb', 'chromatic-waves',
  ],
  coreTexturesBlendMode: ['normal', 'add', 'multiply', 'screen'],
};

const stringAliases: Partial<Record<RuntimeParameterKey, Readonly<Record<string, string>>>> = {
  // Preserve legacy preset/import values while committing only canonical runtime values.
  centerImageColorGrade: { cyberpunk: 'coolCyberpunk' },
  coreTexturesFrequencyRange: { bass: 'low' },
};

const stringValidators: Partial<Record<RuntimeParameterKey, (value: string) => boolean>> = {
  astralCustomColor: value => /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value),
};

export function getRuntimeParameterConstraintCoverage(): {
  numericWithoutConstraint: RuntimeParameterKey[];
  stringWithoutConstraint: RuntimeParameterKey[];
} {
  const numericWithoutConstraint: RuntimeParameterKey[] = [];
  const stringWithoutConstraint: RuntimeParameterKey[] = [];
  for (const key of Object.keys(defaultParams) as RuntimeParameterKey[]) {
    const fallback = defaultParams[key];
    if (typeof fallback === 'number' && !numericConstraints[key]) numericWithoutConstraint.push(key);
    if (typeof fallback === 'string' && !enumValues[key] && !stringValidators[key]) stringWithoutConstraint.push(key);
  }
  return { numericWithoutConstraint, stringWithoutConstraint };
}

const parameterKeys = new Set<RuntimeParameterKey>(Object.keys(defaultParams) as RuntimeParameterKey[]);

export function isRuntimeParameterKey(value: unknown): value is RuntimeParameterKey {
  return typeof value === 'string' && parameterKeys.has(value as RuntimeParameterKey);
}

function sanitizeValue(key: RuntimeParameterKey, value: unknown): { accepted: boolean; value?: unknown; clamped: boolean } {
  const fallback = defaultParams[key];
  if (typeof fallback === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return { accepted: false, clamped: false };
    const constraint = numericConstraints[key];
    if (!constraint) return { accepted: true, value, clamped: false };
    const bounded = Math.min(constraint.maximum, Math.max(constraint.minimum, value));
    let normalized = constraint.integer ? Math.round(bounded) : bounded;
    if (constraint.allowedValues && !constraint.allowedValues.includes(normalized)) {
      normalized = constraint.allowedValues.reduce((closest, candidate) => (
        Math.abs(candidate - normalized) < Math.abs(closest - normalized) ? candidate : closest
      ));
    }
    return { accepted: true, value: normalized, clamped: normalized !== value };
  }
  if (typeof fallback === 'boolean') {
    return typeof value === 'boolean'
      ? { accepted: true, value, clamped: false }
      : { accepted: false, clamped: false };
  }
  if (typeof fallback === 'string') {
    if (typeof value !== 'string' || value.length > 128) return { accepted: false, clamped: false };
    const normalized = stringAliases[key]?.[value] ?? value;
    const allowed = enumValues[key];
    if (allowed && !allowed.includes(normalized)) return { accepted: false, clamped: false };
    const validator = stringValidators[key];
    if (validator && !validator(normalized)) return { accepted: false, clamped: false };
    return { accepted: true, value: normalized, clamped: normalized !== value };
  }
  return { accepted: false, clamped: false };
}

export function sanitizeRuntimeParameterPatch(input: unknown): {
  patch: RuntimeParameterPatch;
  rejected: string[];
  clamped: RuntimeParameterKey[];
} {
  const patch: RuntimeParameterPatch = {};
  const rejected: string[] = [];
  const clamped: RuntimeParameterKey[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { patch, rejected: ['<transaction>'], clamped };

  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (!isRuntimeParameterKey(rawKey)) {
      rejected.push(rawKey);
      continue;
    }
    const sanitized = sanitizeValue(rawKey, rawValue);
    if (!sanitized.accepted) {
      rejected.push(rawKey);
      continue;
    }
    (patch as Record<string, unknown>)[rawKey] = sanitized.value;
    if (sanitized.clamped) clamped.push(rawKey);
  }
  return { patch, rejected, clamped };
}

export function applyRuntimeParameterTransaction(
  target: RuntimeParameterTarget | null | undefined,
  input: unknown,
): RuntimeParameterTransactionResult {
  const { patch, rejected, clamped } = sanitizeRuntimeParameterPatch(input);
  const applied = Object.keys(patch) as RuntimeParameterKey[];
  if (target) {
    for (const key of applied) target[key] = patch[key];
  }
  return { applied, rejected, clamped };
}

/** Applies the same validated patch through the session's canonical store authority. */
export function applyRuntimeParameterStoreTransaction(
  store: RuntimeParameterStoreTarget,
  input: unknown,
): RuntimeParameterTransactionResult {
  const { patch, rejected, clamped } = sanitizeRuntimeParameterPatch(input);
  const applied = Object.keys(patch) as RuntimeParameterKey[];
  if (applied.length > 0) store.patch(patch);
  return { applied, rejected, clamped };
}

export function dispatchRuntimeParameterTransaction(
  patch: RuntimeParameterPatch,
  source: RuntimeParameterTransactionSource,
): void {
  const sanitized = sanitizeRuntimeParameterPatch(patch);
  if (Object.keys(sanitized.patch).length === 0) return;
  window.dispatchEvent(new CustomEvent<RuntimeParameterTransactionDetail>(RUNTIME_PARAMETER_TRANSACTION_EVENT, {
    detail: Object.freeze({ patch: Object.freeze(sanitized.patch), source }),
  }));
}

export function readRuntimeParameterTransaction(event: Event): RuntimeParameterTransactionDetail | null {
  const detail = (event as CustomEvent<RuntimeParameterTransactionDetail>).detail;
  if (!detail || typeof detail !== 'object') return null;
  const source = detail.source;
  if (!['control', 'macro', 'midi', 'preset', 'settings-import', 'runtime'].includes(source)) return null;
  const sanitized = sanitizeRuntimeParameterPatch(detail.patch);
  return { patch: sanitized.patch, source };
}