/**
 * Explicit conversions between UI-facing normalized controls and runtime values.
 * Keeping these in one place prevents factory resets/presets from mixing units.
 */
const DOT_MIN = 22;
const DOT_RANGE = 248;
const DOT_EXPONENT = 2.2;
export const SPIKE_FFT_MIN_EXPONENT = 9;
export const SPIKE_FFT_MAX_EXPONENT = 13;

export function dotDensitySliderToCount(value: number): number {
  const normalized = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return Math.round(DOT_MIN + Math.pow(normalized, DOT_EXPONENT) * DOT_RANGE);
}

export function dotDensityCountToSlider(value: number): number {
  const count = Math.max(DOT_MIN, Math.min(DOT_MIN + DOT_RANGE, Number.isFinite(value) ? value : DOT_MIN));
  return Math.pow((count - DOT_MIN) / DOT_RANGE, 1 / DOT_EXPONENT);
}

/** Accepts either a normalized preset/UI value or a runtime dot-count value. */
export function normalizeDotDensityForSlider(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return dotDensityCountToSlider(32.8);
  return numeric <= 1 ? Math.max(0, Math.min(1, numeric)) : dotDensityCountToSlider(numeric);
}

/** The Spike FFT control stores an exponent; Web Audio consumes the resulting FFT window. */
export function normalizeSpikeFftExponent(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric) : SPIKE_FFT_MIN_EXPONENT;
  return Math.max(SPIKE_FFT_MIN_EXPONENT, Math.min(SPIKE_FFT_MAX_EXPONENT, rounded));
}

export function spikeFftExponentToWindowSize(value: unknown): number {
  return 2 ** normalizeSpikeFftExponent(value);
}

/** AnalyserNode frequencyBinCount is the real number of visible frequency-domain spikes. */
export function spikeFftExponentToVisibleCount(value: unknown): number {
  return spikeFftExponentToWindowSize(value) / 2;
}
