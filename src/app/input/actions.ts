import { cancelTrackedTimeout, scheduleTrackedTimeout } from '../runtime/mainThread/MainThreadAsyncDiagnostics';
import {
  CORE_TEXTURES_STEP_REQUEST_EVENT,
  MACRO_SET_TOGGLE_REQUEST_EVENT,
  type InputActionId,
} from './types';

/**
 * ORBITAL — input actions (Sprint O4).
 *
 * Every action goes through the same path the UI already uses, so presets, exclusivity,
 * shader control defaults and React state all stay consistent:
 *  - presets:   #presetSelect + 'change' (coalesced, shared with the arrow keys)
 *  - randomize: the #randomize button
 *  - textures:  CoreTexturesSettings' own handleSelect (via request event) and the
 *               #coreTexturesEnabled switch (core-layer exclusivity applies)
 *  - macro set: ControlPanel's setMacroSet (via request event)
 */

/* ---- Preset stepping (shared with usePresetKeyboardNavigation) ---- */

const PRESET_COMMIT_DELAY_MS = 70;
let presetPendingIndex: number | null = null;
let presetTimer: ReturnType<typeof setTimeout> | null = null;

function presetOptions(select: HTMLSelectElement): HTMLOptionElement[] {
  return Array.from(select.options).filter((o) => Number(o.value) >= 0);
}

/**
 * Step the preset selection. Rapid steps coalesce: only the final preset loads, ~70 ms after
 * the last step, so holding a direction skims through instead of loading every preset.
 */
export function stepPresetSelection(direction: 1 | -1): boolean {
  const select = document.getElementById('presetSelect') as HTMLSelectElement | null;
  if (!select) return false;
  const valid = presetOptions(select);
  if (!valid.length) return false;
  const i = presetPendingIndex ?? valid.findIndex((o) => o.value === select.value);
  // No preset selected yet: Down starts at the first preset, Up at the last (the pre-O4
  // arrow-key code treated "none" as index 0 and skipped the first preset).
  presetPendingIndex = i < 0
    ? (direction > 0 ? 0 : valid.length - 1)
    : (i + direction + valid.length) % valid.length;
  cancelTrackedTimeout(presetTimer);
  presetTimer = scheduleTrackedTimeout('preset-step-commit', () => {
    presetTimer = null;
    const target = presetPendingIndex;
    presetPendingIndex = null;
    const current = document.getElementById('presetSelect') as HTMLSelectElement | null;
    const options = current ? presetOptions(current) : [];
    if (!current || target === null || !options[target]) return;
    current.value = options[target].value;
    current.dispatchEvent(new Event('change', { bubbles: true }));
  }, PRESET_COMMIT_DELAY_MS);
  return true;
}

export function cancelPendingPresetStep(): void {
  cancelTrackedTimeout(presetTimer);
  presetTimer = null;
  presetPendingIndex = null;
}

/* ---- Action dispatch ---- */

function clickById(id: string): boolean {
  const el = document.getElementById(id) as HTMLElement | null;
  if (!el) return false;
  el.click();
  return true;
}

/** Run an action. Focus actions are handled by the router itself. Returns false if unavailable. */
export function runInputAction(action: InputActionId): boolean {
  if (typeof document === 'undefined') return false;
  switch (action) {
    case 'preset.next': return stepPresetSelection(1);
    case 'preset.prev': return stepPresetSelection(-1);
    case 'randomize': return clickById('randomize');
    case 'textures.toggle': return clickById('coreTexturesEnabled');
    case 'textures.next':
    case 'textures.prev':
      window.dispatchEvent(new CustomEvent(CORE_TEXTURES_STEP_REQUEST_EVENT, {
        detail: { direction: action === 'textures.next' ? 1 : -1 },
      }));
      return true;
    case 'macroSet.toggle':
      window.dispatchEvent(new Event(MACRO_SET_TOGGLE_REQUEST_EVENT));
      return true;
    default:
      return false;
  }
}
