/**
 * Beat Reactive Color FX effect types (Sprint I: "All Effects" removed).
 *
 * Old custom presets, saved sessions or imported settings files may still
 * carry beatPulseType: 'all'. normalizeBeatPulseType maps that (and any other
 * unknown value) to the default effect so the dropdown never ends up blank.
 */
export const BEAT_PULSE_TYPES = ['flash', 'color', 'rainbow', 'spark', 'dark-strobe', 'starfield'] as const;
export type BeatPulseType = typeof BEAT_PULSE_TYPES[number];

export function normalizeBeatPulseType(value: unknown, fallback: BeatPulseType = 'flash'): BeatPulseType {
  return (BEAT_PULSE_TYPES as readonly string[]).includes(value as string) ? (value as BeatPulseType) : fallback;
}
