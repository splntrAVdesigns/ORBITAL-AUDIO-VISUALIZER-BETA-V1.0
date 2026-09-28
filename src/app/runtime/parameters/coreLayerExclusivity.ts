/**
 * ORBITAL — Core layer exclusivity (Sprint N, extended to three layers in Sprint O1).
 *
 * Core Particles, Liquid Shaper and Core Textures all draw in the core region. Only one
 * may be enabled at a time (Center Graphic may still run alongside Core Textures).
 *
 *  - Enabling any one layer switches the other two off (last toggled wins).
 *  - A single patch/preset that enables more than one keeps the highest-precedence
 *    layer: Liquid Shaper > Core Particles > Core Textures. This matches what the frame
 *    pipeline already drew when Liquid Shaper and Core Particles were both on.
 *
 * Entry points:
 *  1. resolveCoreLayerPatch()        pure; used by runtime parameter transactions
 *                                    (macros, MIDI, presets, settings import).
 *  2. installCoreLayerExclusivity()  document-level 'change' listener for the three switches.
 *  3. resolveCoreLayerConflict()     one-shot cleanup of already-conflicting live state.
 */

export const CORE_LAYER_EXCLUSIVITY_EVENT = 'orbital:core-layer-exclusivity';

export type CoreLayerKey = 'astralShaper' | 'shapeOscillate' | 'coreTexturesEnabled';
/** Highest precedence first. */
export const CORE_LAYER_KEYS: readonly CoreLayerKey[] = ['astralShaper', 'shapeOscillate', 'coreTexturesEnabled'];
const LAYER_NAMES: Record<CoreLayerKey, string> = {
  astralShaper: 'liquid', shapeOscillate: 'particles', coreTexturesEnabled: 'textures',
};

type LayerPatch = Partial<Record<CoreLayerKey, boolean>>;

/** Pure. Returns the patch with every non-winning layer forced off, plus which keys were forced. */
export function resolveCoreLayerPatch<T extends object>(patch: T): { patch: T; forced: LayerPatch } {
  const p = patch as LayerPatch;
  const forced: LayerPatch = {};
  const winner = CORE_LAYER_KEYS.find((key) => p[key] === true);
  if (!winner) return { patch, forced };
  for (const key of CORE_LAYER_KEYS) {
    if (key === winner || p[key] === false) continue;
    p[key] = false;
    forced[key] = false;
  }
  return { patch, forced };
}

function live(): { params: any; engine: any } | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return { params: w.params ?? null, engine: w.coreTexturesEngine ?? null };
}

function announce(key: CoreLayerKey): void {
  window.dispatchEvent(new CustomEvent(CORE_LAYER_EXCLUSIVITY_EVENT, { detail: { layer: LAYER_NAMES[key], enabled: false } }));
}

/** Applies the UI/engine side of "textures were forced off". */
export function syncCoreTexturesOff(): void {
  const state = live();
  if (!state) return;
  if (state.params) state.params.coreTexturesEnabled = false;
  (window as any).__coreTexturesUIEnabled = false;
  state.engine?.setEnabled?.(false);
  const toggle = document.getElementById('coreTexturesEnabled') as HTMLInputElement | null;
  if (toggle) toggle.checked = false;
  announce('coreTexturesEnabled');
}

/** Checkbox-backed layers (particles, liquid): params + switch + change event for bound UI. */
function syncCheckboxLayerOff(key: 'shapeOscillate' | 'astralShaper'): void {
  const state = live();
  if (!state) return;
  if (state.params) state.params[key] = false;
  const toggle = document.getElementById(key) as HTMLInputElement | null;
  if (toggle && toggle.checked) {
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  }
  announce(key);
}

export function syncCoreParticlesOff(): void { syncCheckboxLayerOff('shapeOscillate'); }
export function syncLiquidShaperOff(): void { syncCheckboxLayerOff('astralShaper'); }

const SYNC_OFF: Record<CoreLayerKey, () => void> = {
  astralShaper: syncLiquidShaperOff,
  shapeOscillate: syncCoreParticlesOff,
  coreTexturesEnabled: syncCoreTexturesOff,
};

export function syncForcedLayers(forced: LayerPatch): void {
  for (const key of CORE_LAYER_KEYS) if (forced[key] === false) SYNC_OFF[key]();
}

/** If live state already has more than one layer on (restore, unmanaged write), precedence wins. */
export function resolveCoreLayerConflict(): boolean {
  const state = live();
  if (!state?.params) return false;
  const on = CORE_LAYER_KEYS.filter((key) => Boolean(state.params[key]));
  if (on.length < 2) return false;
  on.slice(1).forEach((key) => SYNC_OFF[key]());
  return true;
}

function isLayerKey(id: string): id is CoreLayerKey {
  return (CORE_LAYER_KEYS as readonly string[]).includes(id);
}

let installCount = 0;
let removeListener: (() => void) | null = null;

/** Idempotent, ref-counted. Returns a disposer. */
export function installCoreLayerExclusivity(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  installCount += 1;
  if (installCount === 1) {
    const onChange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.type !== 'checkbox' || !target.checked) return;
      if (!isLayerKey(target.id)) return;
      for (const key of CORE_LAYER_KEYS) if (key !== target.id) SYNC_OFF[key]();
    };
    document.addEventListener('change', onChange, true);
    removeListener = () => document.removeEventListener('change', onChange, true);
    resolveCoreLayerConflict();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    installCount = Math.max(0, installCount - 1);
    if (installCount === 0) { removeListener?.(); removeListener = null; }
  };
}
