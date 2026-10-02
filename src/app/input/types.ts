/**
 * ORBITAL — shared input vocabulary (Sprint O4).
 *
 * Every controller source (MIDI today, gamepad in O5) speaks to the InputRouter in these
 * terms. Sources own their own device identity and binding storage (a MIDI binding is
 * device + channel + CC; a gamepad binding is a button/axis index), but they all resolve to
 * the same TARGETS and the same macro motor, so behaviour is identical whichever hand
 * moved it.
 */

export type InputSource = 'midi' | 'gamepad';

export type MacroId = 'macro1' | 'macro2' | 'macro3' | 'macro4' | 'macro5' | 'macro6' | 'macro7' | 'macro8';
export const MACRO_IDS: readonly MacroId[] = ['macro1', 'macro2', 'macro3', 'macro4', 'macro5', 'macro6', 'macro7', 'macro8'];

export type MacroSet = 'classic' | 'advanced';

/** Discrete actions a button can trigger. */
export type InputActionId =
  | 'preset.next'
  | 'preset.prev'
  | 'textures.next'
  | 'textures.prev'
  | 'textures.toggle'
  | 'randomize'
  | 'macroSet.toggle'
  | 'focus.next'
  | 'focus.prev';

export const INPUT_ACTION_LABELS: Record<InputActionId, string> = {
  'preset.next': 'Next preset',
  'preset.prev': 'Previous preset',
  'textures.next': 'Next Core Texture',
  'textures.prev': 'Previous Core Texture',
  'textures.toggle': 'Core Textures on/off',
  randomize: 'Randomize',
  'macroSet.toggle': 'Swap Classic / Advanced macros',
  'focus.next': 'Focus next knob',
  'focus.prev': 'Focus previous knob',
};

/**
 * What a control drives.
 *  - macro:   a fixed macro (MIDI bindings use this).
 *  - knob:    the Nth knob (0–3) of whichever macro set is visible ("drive what you see").
 *  - focused: the knob the controller last touched (A/B buttons).
 */
export type InputTarget =
  | { kind: 'macro'; macroId: MacroId }
  | { kind: 'knob'; index: 0 | 1 | 2 | 3 }
  | { kind: 'focused' };

/* ---- DOM events shared across sources and UI ---- */

/** Per-message knob preview (paint only; React commit stays debounced). */
export const MACRO_LIVE_PREVIEW_EVENT = 'orbital:macro-live-preview';
/** A source started Learn; every other source cancels its own Learn. detail: { source } */
export const INPUT_LEARN_BEGIN_EVENT = 'orbital:input-learn-begin';
/** Request ControlPanel to swap the visible macro set. */
export const MACRO_SET_TOGGLE_REQUEST_EVENT = 'orbital:macro-set-toggle-request';
/** ControlPanel announces the visible macro set. detail: { macroSet } */
export const MACRO_SET_CHANGED_EVENT = 'orbital:macro-set-changed';
/** Ask CoreTextures to step its shader. detail: { direction: 1 | -1 } */
export const CORE_TEXTURES_STEP_REQUEST_EVENT = 'orbital:core-textures-step-request';
/** Router focus moved. detail: { macroId } */
export const INPUT_FOCUS_EVENT = 'orbital:input-focus';
