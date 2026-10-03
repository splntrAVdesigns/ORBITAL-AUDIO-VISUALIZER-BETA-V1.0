import { safeLocalStorage } from '../utils/browserCompat';
import type { InputActionId, InputTarget } from './types';

/**
 * ORBITAL — gamepad configuration (Sprint O5).
 *
 * Bindings are FUNCTION-first: each function ("Knob 1", "Next preset") is assigned one
 * physical control. Learn asks "press/move the control you want for this function".
 * Indices follow the W3C "standard" gamepad layout (Xbox naming); non-standard pads still
 * work through Learn.
 */

export type GamepadControl =
  | { kind: 'button'; index: number }
  | { kind: 'axis'; index: number; invert: boolean };

export type GamepadFunctionId =
  | 'knob1' | 'knob2' | 'knob3' | 'knob4'
  | 'focusUp' | 'focusDown' | 'focusPrev' | 'focusNext'
  | 'fine' | 'fast'
  | 'presetPrev' | 'presetNext' | 'texturePrev' | 'textureNext' | 'texturesToggle'
  | 'randomize' | 'macroSet';

export type GamepadFunctionKind =
  | 'knob'      // stick axis: flick = step, hold = glide
  | 'focused'   // button: tap = step, hold = glide (focusDown: double-tap = reset to 0)
  | 'modifier'  // held: fine (¼ speed) / fast (3×)
  | 'action'    // press = action once
  | 'repeat'    // press = action, hold = auto-repeat (preset skim)
  | 'longPress';// action only after a deliberate hold (randomize)

export interface GamepadFunctionMeta {
  id: GamepadFunctionId;
  label: string;
  hint: string;
  group: 'Macro knobs' | 'Focused knob' | 'Speed' | 'Presets & textures' | 'Other';
  kind: GamepadFunctionKind;
  accepts: 'axis' | 'button';
  target?: InputTarget;
  direction?: 1 | -1;
  action?: InputActionId;
}

export const GAMEPAD_FUNCTIONS: readonly GamepadFunctionMeta[] = [
  { id: 'knob1', label: 'Knob 1', hint: 'Flick = one step · hold = glide', group: 'Macro knobs', kind: 'knob', accepts: 'axis', target: { kind: 'knob', index: 0 } },
  { id: 'knob2', label: 'Knob 2', hint: 'Flick = one step · hold = glide', group: 'Macro knobs', kind: 'knob', accepts: 'axis', target: { kind: 'knob', index: 1 } },
  { id: 'knob3', label: 'Knob 3', hint: 'Flick = one step · hold = glide', group: 'Macro knobs', kind: 'knob', accepts: 'axis', target: { kind: 'knob', index: 2 } },
  { id: 'knob4', label: 'Knob 4', hint: 'Flick = one step · hold = glide', group: 'Macro knobs', kind: 'knob', accepts: 'axis', target: { kind: 'knob', index: 3 } },
  { id: 'focusUp', label: 'Focused knob up', hint: 'Tap = step · hold = glide', group: 'Focused knob', kind: 'focused', accepts: 'button', target: { kind: 'focused' }, direction: 1 },
  { id: 'focusDown', label: 'Focused knob down', hint: 'Tap = step · hold = glide · double-tap = reset to 0', group: 'Focused knob', kind: 'focused', accepts: 'button', target: { kind: 'focused' }, direction: -1 },
  { id: 'focusPrev', label: 'Focus previous knob', hint: 'Moves the focus ring', group: 'Focused knob', kind: 'action', accepts: 'button', action: 'focus.prev' },
  { id: 'focusNext', label: 'Focus next knob', hint: 'Moves the focus ring', group: 'Focused knob', kind: 'action', accepts: 'button', action: 'focus.next' },
  { id: 'fine', label: 'Fine (hold)', hint: '¼ speed while held', group: 'Speed', kind: 'modifier', accepts: 'button' },
  { id: 'fast', label: 'Fast (hold)', hint: '3× speed while held', group: 'Speed', kind: 'modifier', accepts: 'button' },
  { id: 'presetPrev', label: 'Previous preset', hint: 'Hold to skim', group: 'Presets & textures', kind: 'repeat', accepts: 'button', action: 'preset.prev' },
  { id: 'presetNext', label: 'Next preset', hint: 'Hold to skim', group: 'Presets & textures', kind: 'repeat', accepts: 'button', action: 'preset.next' },
  { id: 'texturePrev', label: 'Previous Core Texture', hint: 'First press turns Core Textures on', group: 'Presets & textures', kind: 'action', accepts: 'button', action: 'textures.prev' },
  { id: 'textureNext', label: 'Next Core Texture', hint: 'First press turns Core Textures on', group: 'Presets & textures', kind: 'action', accepts: 'button', action: 'textures.next' },
  { id: 'texturesToggle', label: 'Core Textures on/off', hint: 'Other core layers switch off', group: 'Presets & textures', kind: 'action', accepts: 'button', action: 'textures.toggle' },
  { id: 'randomize', label: 'Randomize', hint: 'Hold 0.4 s (prevents accidental clicks)', group: 'Other', kind: 'longPress', accepts: 'button', action: 'randomize' },
  { id: 'macroSet', label: 'Swap Classic / Advanced', hint: 'Sticks always drive the visible knobs', group: 'Other', kind: 'action', accepts: 'button', action: 'macroSet.toggle' },
];

export const GAMEPAD_FUNCTION_BY_ID = Object.fromEntries(GAMEPAD_FUNCTIONS.map((f) => [f.id, f])) as Record<GamepadFunctionId, GamepadFunctionMeta>;

/** W3C standard mapping, Xbox names. */
export const STANDARD_BUTTON_LABELS = [
  'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3 (left stick click)', 'R3 (right stick click)',
  'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home',
];
export const STANDARD_AXIS_LABELS = ['Left stick ←→', 'Left stick ↑↓', 'Right stick ←→', 'Right stick ↑↓'];

export function describeControl(control: GamepadControl | undefined, standard = true): string {
  if (!control) return 'UNASSIGNED';
  if (control.kind === 'button') {
    return (standard && STANDARD_BUTTON_LABELS[control.index]) || `Button ${control.index}`;
  }
  return (standard && STANDARD_AXIS_LABELS[control.index]) || `Axis ${control.index}`;
}

export interface GamepadConfig {
  version: 1;
  enabled: boolean;
  /** Units (of 100) per tap/flick. */
  step: number;
  /** Glide speed at full deflection / held button, units per second. */
  speed: number;
  /** Radial stick deadzone, 0–1. */
  deadzone: number;
  bindings: Partial<Record<GamepadFunctionId, GamepadControl>>;
}

const button = (index: number): GamepadControl => ({ kind: 'button', index });
const axis = (index: number, invert = false): GamepadControl => ({ kind: 'axis', index, invert });

/** Standard-mapping axes report "up" as −1, so the Y axes are inverted: up = increase. */
export function defaultGamepadBindings(): GamepadConfig['bindings'] {
  return {
    knob1: axis(0), knob2: axis(1, true), knob3: axis(2), knob4: axis(3, true),
    focusUp: button(0), focusDown: button(1), focusPrev: button(4), focusNext: button(5),
    fine: button(6), fast: button(7),
    presetPrev: button(12), presetNext: button(13), texturePrev: button(14), textureNext: button(15),
    texturesToggle: button(11), randomize: button(10), macroSet: button(8),
  };
}

export const GAMEPAD_LIMITS = {
  step: { min: 1, max: 10, default: 2 },
  speed: { min: 10, max: 120, default: 40 },
  deadzone: { min: 0.05, max: 0.4, default: 0.18 },
} as const;

export function defaultGamepadConfig(): GamepadConfig {
  return {
    version: 1,
    enabled: true,
    step: GAMEPAD_LIMITS.step.default,
    speed: GAMEPAD_LIMITS.speed.default,
    deadzone: GAMEPAD_LIMITS.deadzone.default,
    bindings: defaultGamepadBindings(),
  };
}

const STORAGE = 'orbital-gamepad-config-v1';
const clampNum = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;

function sanitizeControl(raw: unknown): GamepadControl | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.index !== 'number' || !Number.isInteger(r.index) || r.index < 0 || r.index > 63) return null;
  if (r.kind === 'button') return { kind: 'button', index: r.index };
  if (r.kind === 'axis') return { kind: 'axis', index: r.index, invert: r.invert === true };
  return null;
}

export function sanitizeGamepadConfig(raw: unknown): GamepadConfig {
  const base = defaultGamepadConfig();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const bindings: GamepadConfig['bindings'] = {};
  if (r.bindings && typeof r.bindings === 'object') {
    for (const meta of GAMEPAD_FUNCTIONS) {
      const control = sanitizeControl((r.bindings as Record<string, unknown>)[meta.id]);
      if (control && control.kind === meta.accepts) bindings[meta.id] = control;
    }
  }
  return {
    version: 1,
    enabled: r.enabled !== false,
    step: clampNum(r.step, GAMEPAD_LIMITS.step.min, GAMEPAD_LIMITS.step.max, base.step),
    speed: clampNum(r.speed, GAMEPAD_LIMITS.speed.min, GAMEPAD_LIMITS.speed.max, base.speed),
    deadzone: clampNum(r.deadzone, GAMEPAD_LIMITS.deadzone.min, GAMEPAD_LIMITS.deadzone.max, base.deadzone),
    bindings: r.bindings && typeof r.bindings === 'object' ? bindings : base.bindings,
  };
}

export function loadGamepadConfig(): GamepadConfig {
  try { return sanitizeGamepadConfig(JSON.parse(safeLocalStorage.getItem(STORAGE) || 'null')); } catch { return defaultGamepadConfig(); }
}

export function saveGamepadConfig(config: GamepadConfig): void {
  safeLocalStorage.setItem(STORAGE, JSON.stringify(config));
}

export const GAMEPAD_CONFIG_IMPORTED_EVENT = 'orbital:gamepad-config-imported';

/** Settings export: null when the user never changed anything (defaults apply). */
export function exportGamepadConfig(): GamepadConfig | null {
  try { const raw = safeLocalStorage.getItem(STORAGE); return raw ? sanitizeGamepadConfig(JSON.parse(raw)) : null; } catch { return null; }
}

export function importGamepadConfig(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  saveGamepadConfig(sanitizeGamepadConfig(raw));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GAMEPAD_CONFIG_IMPORTED_EVENT));
  return true;
}

export function sameControl(a: GamepadControl | undefined, b: GamepadControl | undefined): boolean {
  return !!a && !!b && a.kind === b.kind && a.index === b.index;
}
