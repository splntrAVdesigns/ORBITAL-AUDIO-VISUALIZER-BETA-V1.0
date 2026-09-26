/**
 * Beat Reactive Color FX effect types.
 *
 * Sprint I: "All Effects" removed.
 * Sprint J: Spark Impact gated off (SPARK_IMPACT_ENABLED). Its renderer code is
 * kept intact; it is only hidden from the UI, the randomizer and every load
 * path. Custom/saved presets that store 'spark' keep that value and load as the
 * fallback while gated. Built-in "Blang it Out" was moved to 'flash' (the
 * transaction authority must accept every built-in preset); its presets.ts line
 * is marked for a one-line restore when the flag is turned back on.
 *
 * normalizeBeatPulseType maps old 'all', gated 'spark', or any unknown value to
 * the fallback so the dropdown never ends up blank.
 */
export const SPARK_IMPACT_ENABLED = false;

export const BEAT_PULSE_TYPES = ['flash', 'color', 'rainbow', 'spark', 'dark-strobe', 'starfield'] as const;
export type BeatPulseType = typeof BEAT_PULSE_TYPES[number];

/** Effect types that can currently be selected, loaded or rolled. */
export const AVAILABLE_BEAT_PULSE_TYPES: readonly BeatPulseType[] = BEAT_PULSE_TYPES.filter(
  (type) => type !== 'spark' || SPARK_IMPACT_ENABLED,
);

export function normalizeBeatPulseType(value: unknown, fallback: BeatPulseType = 'flash'): BeatPulseType {
  return (AVAILABLE_BEAT_PULSE_TYPES as readonly string[]).includes(value as string) ? (value as BeatPulseType) : fallback;
}
