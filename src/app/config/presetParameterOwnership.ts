/**
 * Preset parameter ownership (Sprint K1).
 *
 * Every parameter that has a UI control is either PRESET-OWNED (a preset load
 * sets it, a custom-preset save stores it) or listed below as NOT preset-owned
 * with a reason. scripts/unit-tests/preset-parameter-ownership.unit.test.mjs
 * fails if a new UI parameter is added without being classified here or
 * handled by applyPreset + getCurrentSettings.
 *
 * Why this exists: before K1, 30 UI parameters leaked across preset loads
 * (e.g. Motion Blur stayed on after loading a preset that never mentioned it),
 * 3 were saved into custom presets but never restored, and 38 were never saved.
 */
import { defaultParams } from './defaultParams';

/** Parameters that presets intentionally do NOT set or save, with the reason. */
export const NON_PRESET_PARAMETERS: Readonly<Record<string, string>> = Object.freeze({
  bpm: 'Track tempo: follows the playing track (detection / tap tempo), not the look.',
  bars: 'Track phrase length: follows the playing track, not the look.',
  reactivityHz: 'Audio analysis update rate: a device/performance setting.',
  macro1: 'Derived: recomputed from the preset values after every preset load.',
  macro2: 'Derived: recomputed from the preset values after every preset load.',
  macro3: 'Derived: recomputed from the preset values after every preset load.',
  macro4: 'Derived: recomputed from the preset values after every preset load.',
  macro5: 'Derived: recomputed from the preset values after every preset load.',
  macro6: 'Derived: recomputed from the preset values after every preset load.',
  macro7: 'Derived: recomputed from the preset values after every preset load.',
  macro8: 'Derived: recomputed from the preset values after every preset load.',
  centerImageMotionAudio: 'Retired control: its binding always forces false (Phase 12D.8).',
});

/**
 * How a generically-synced parameter maps between its value and its DOM control.
 *  - 'value':             range / select / hidden input, value written as a string
 *  - 'checked':           checkbox (or hidden input read via .checked), boolean value
 *  - 'direction-checked': checkbox driving a numeric direction (checked = -1, unchecked = 1)
 */
export type OwnedControlKind = 'value' | 'checked' | 'direction-checked';

/**
 * Preset-owned parameters synced generically by id (DOM id === parameter key).
 * `load` = applyPreset restores it (falling back to the default when a preset
 * omits it, so nothing leaks from the previous preset). `save` = custom-preset
 * save stores it. Parameters already handled explicitly in applyPreset /
 * getCurrentSettings have that side set to false here to avoid double-applying.
 */
export const GENERIC_PRESET_PARAMETERS: ReadonlyArray<{
  key: keyof typeof defaultParams;
  kind: OwnedControlKind;
  load: boolean;
  save: boolean;
}> = Object.freeze([
  // Color
  { key: 'spectrum', kind: 'checked', load: true, save: true },
  // Outer halo: orbital energy
  { key: 'orbitalEnergy', kind: 'value', load: true, save: true },
  { key: 'orbitalWidth', kind: 'value', load: true, save: true },
  { key: 'orbitalDirection', kind: 'direction-checked', load: true, save: true },
  // Halo Strobe / Halo Comet (load already explicit; save was missing)
  { key: 'haloStrobeEnabled', kind: 'checked', load: false, save: true },
  { key: 'haloStrobeDivision', kind: 'value', load: false, save: true },
  { key: 'haloCometEnabled', kind: 'checked', load: false, save: true },
  { key: 'haloCometSpeed', kind: 'value', load: false, save: true },
  { key: 'haloCometDirection', kind: 'value', load: false, save: true },
  { key: 'haloCometThickness', kind: 'value', load: false, save: true },
  { key: 'haloCometTailLength', kind: 'value', load: false, save: true },
  // Motion controls (save already explicit for the first three; load was missing)
  { key: 'motionIntensity', kind: 'value', load: true, save: false },
  { key: 'motionSmoothing', kind: 'value', load: true, save: false },
  { key: 'bassBoost', kind: 'value', load: true, save: false },
  { key: 'reactivityMode', kind: 'value', load: true, save: true },
  { key: 'reactivityBlend', kind: 'value', load: true, save: true },
  // Motion blur
  { key: 'motionBlurEnabled', kind: 'checked', load: true, save: true },
  { key: 'motionBlurPersistence', kind: 'value', load: true, save: true },
  // Rotation sync
  { key: 'rotationSyncMode', kind: 'value', load: true, save: true },
  { key: 'rotationQuantize', kind: 'value', load: true, save: true },
  // Shockwave rings
  { key: 'shockwaveSpeed', kind: 'value', load: true, save: true },
  { key: 'shockwaveDecay', kind: 'value', load: true, save: true },
  // Center image motion
  { key: 'centerImageKenBurns', kind: 'checked', load: true, save: true },
  { key: 'centerImageKenBurnsSpeed', kind: 'value', load: true, save: true },
  { key: 'centerImageMotionProfile', kind: 'value', load: true, save: true },
  // Energy gate (load already explicit; save was missing)
  { key: 'energyGate', kind: 'checked', load: false, save: true },
  { key: 'energyThreshold', kind: 'value', load: false, save: true },
  { key: 'energyRelease', kind: 'value', load: false, save: true },
  // Liquid Shaper (load already explicit; save was missing)
  { key: 'astralRotationJitter', kind: 'value', load: false, save: true },
]);

/** Write a preset value (or the default when absent) into its control. */
export function writeOwnedControl(
  el: HTMLInputElement | HTMLSelectElement,
  kind: OwnedControlKind,
  value: unknown,
): void {
  if (kind === 'checked') {
    (el as HTMLInputElement).checked = Boolean(value);
    if ((el as HTMLInputElement).type === 'hidden') el.value = String(Boolean(value));
  } else if (kind === 'direction-checked') {
    (el as HTMLInputElement).checked = Number(value) < 0;
  } else {
    el.value = String(value);
  }
}

/** Read a control back into a preset value, typed to match its default. */
export function readOwnedControl(
  el: HTMLInputElement | HTMLSelectElement,
  kind: OwnedControlKind,
  defaultValue: unknown,
): unknown {
  if (kind === 'checked') return (el as HTMLInputElement).checked;
  if (kind === 'direction-checked') return (el as HTMLInputElement).checked ? -1 : 1;
  if (typeof defaultValue === 'number') {
    const n = parseFloat(el.value);
    return Number.isFinite(n) ? n : defaultValue;
  }
  return el.value;
}
