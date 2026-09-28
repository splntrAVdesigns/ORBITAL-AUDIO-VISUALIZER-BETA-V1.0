/**
 * ORBITAL — Core Particles / Core Textures exclusivity (Sprint N).
 *
 * Both layers draw inside the core region. Running them together stacked two full-area
 * GPU/Canvas layers (a known frame-time bottleneck), so only one may be enabled:
 *
 *  - Enabling Core Particles turns Core Textures off.
 *  - Enabling Core Textures turns Core Particles off (last toggled wins).
 *  - A single patch/preset that enables BOTH keeps Core Particles (the dominant layer,
 *    same precedence Core Particles already has over the center graphic).
 *
 * Three entry points cover every way a toggle can change:
 *  1. resolveCoreLayerPatch()        pure; used by runtime parameter transactions
 *                                    (macros, MIDI, presets, settings import).
 *  2. installCoreLayerExclusivity()  document-level 'change' listener for the two switches
 *                                    (user clicks and programmatic control events).
 *  3. resolveCoreLayerConflict()     one-shot cleanup of already-conflicting live state.
 */

export const CORE_LAYER_EXCLUSIVITY_EVENT = 'orbital:core-layer-exclusivity';

interface LayerPatch {
  shapeOscillate?: boolean;
  coreTexturesEnabled?: boolean;
}

/** Pure. Returns the patch with the counterpart forced off, plus which keys were forced. */
export function resolveCoreLayerPatch<T extends object>(patch: T): { patch: T; forced: LayerPatch } {
  const p = patch as LayerPatch;
  const forced: LayerPatch = {};
  if (p.shapeOscillate === true && p.coreTexturesEnabled !== false) {
    // Particles enabled (alone, or together with textures in a preset): textures off.
    if (p.coreTexturesEnabled === true || p.coreTexturesEnabled === undefined) {
      (patch as LayerPatch).coreTexturesEnabled = false;
      forced.coreTexturesEnabled = false;
    }
  } else if (p.coreTexturesEnabled === true && p.shapeOscillate !== true && p.shapeOscillate !== false) {
    // Textures enabled on their own: particles off.
    (patch as LayerPatch).shapeOscillate = false;
    forced.shapeOscillate = false;
  }
  return { patch, forced };
}

function live(): { params: any; engine: any } | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return { params: w.params ?? null, engine: w.coreTexturesEngine ?? null };
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
  window.dispatchEvent(new CustomEvent(CORE_LAYER_EXCLUSIVITY_EVENT, { detail: { layer: 'textures', enabled: false } }));
}

/** Applies the UI/params side of "particles were forced off". */
export function syncCoreParticlesOff(): void {
  const state = live();
  if (!state) return;
  if (state.params) state.params.shapeOscillate = false;
  const toggle = document.getElementById('shapeOscillate') as HTMLInputElement | null;
  if (toggle && toggle.checked) {
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  }
  window.dispatchEvent(new CustomEvent(CORE_LAYER_EXCLUSIVITY_EVENT, { detail: { layer: 'particles', enabled: false } }));
}

export function syncForcedLayers(forced: LayerPatch): void {
  if (forced.coreTexturesEnabled === false) syncCoreTexturesOff();
  if (forced.shapeOscillate === false) syncCoreParticlesOff();
}

/** If live state already has both layers on (restore, unmanaged write), particles win. */
export function resolveCoreLayerConflict(): boolean {
  const state = live();
  if (!state?.params) return false;
  if (state.params.shapeOscillate && state.params.coreTexturesEnabled) {
    syncCoreTexturesOff();
    return true;
  }
  return false;
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
      if (target.id === 'shapeOscillate') syncCoreTexturesOff();
      else if (target.id === 'coreTexturesEnabled') syncCoreParticlesOff();
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
