/**
 * ORBITAL — Motion Controls Controller
 * Sprint 21C: keeps Motion Controls tuning out of App.tsx.
 *
 * This module owns UI-level intent mapping for the Motion Controls panel:
 * - reactivity mode labels/help text
 * - Subtle/Balanced/Aggressive motion preset routing defaults
 * - safe bindings for reactivity controls
 */

export type ReactivityMode = 'instant' | 'smooth' | 'hybrid' | 'manual';

export interface MotionParamsLike {
  motionIntensity?: number;
  motionSmoothing?: number;
  bassBoost?: number;
  frequencySmoothing?: boolean;
  beatReactivityBoost?: boolean;
  reactivityMode?: ReactivityMode;
  reactivityBlend?: number;
  reactivityHz?: 30 | 60;
}

export interface MotionPresetConfig {
  motionIntensity: number;
  motionSmoothing: number;
  bassBoost: number;
  reactivityMode: ReactivityMode;
  reactivityBlend: number;
  frequencySmoothing: boolean;
  beatReactivityBoost: boolean;
}

const REACTIVITY_COPY: Record<ReactivityMode, { title: string; detail: string }> = {
  hybrid: {
    title: 'Layer Smart',
    detail: 'Punchy spikes/shockwaves, smooth-safe center motion.',
  },
  instant: {
    title: 'Punchy',
    detail: 'Fast transient response for drums, drops, and hard cuts.',
  },
  smooth: {
    title: 'Cinematic',
    detail: 'Longer release and gentler movement for melodic/ambient tracks.',
  },
  manual: {
    title: 'Manual',
    detail: 'Blend controls flexible layers; protected layers stay safe.',
  },
};

export const MOTION_PRESETS: Record<'subtle' | 'balanced' | 'aggressive', MotionPresetConfig> = {
  subtle: {
    motionIntensity: 0.20,
    motionSmoothing: 0.55,
    bassBoost: 0.42,
    reactivityMode: 'smooth',
    reactivityBlend: 0.72,
    frequencySmoothing: true,
    beatReactivityBoost: false,
  },
  balanced: {
    motionIntensity: 0.40,
    motionSmoothing: 0.35,
    bassBoost: 0.50,
    reactivityMode: 'hybrid',
    reactivityBlend: 0.45,
    frequencySmoothing: true,
    beatReactivityBoost: false,
  },
  aggressive: {
    motionIntensity: 0.68,
    motionSmoothing: 0.22,
    bassBoost: 0.62,
    reactivityMode: 'instant',
    reactivityBlend: 0.22,
    frequencySmoothing: false,
    beatReactivityBoost: true,
  },
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function setInputValue(id: string, value: number) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  el.value = String(clamp01(value));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function setCheckboxValue(id: string, checked: boolean) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  el.checked = checked;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setSelectValue(id: string, value: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function getReactivityCopy(mode: ReactivityMode) {
  return REACTIVITY_COPY[mode] ?? REACTIVITY_COPY.hybrid;
}

export function updateReactivityRoutingUi(mode: ReactivityMode, blend: number) {
  const copy = getReactivityCopy(mode);
  const badge = document.getElementById('reactivityModeBadge');
  if (badge) badge.textContent = copy.title;

  const blendControl = document.getElementById('reactivityBlend') as HTMLInputElement | null;
  if (blendControl) {
    blendControl.disabled = mode !== 'manual';
    blendControl.style.opacity = mode === 'manual' ? '1' : '0.72';
    blendControl.title = mode === 'manual'
      ? 'Manual Blend: left = instant/transient, right = smooth/cinematic'
      : 'Blend is preset by selected mode. Choose Manual Blend to edit directly.';
  }
}

export function applyMotionControlPreset(name: keyof typeof MOTION_PRESETS) {
  const preset = MOTION_PRESETS[name];
  if (!preset) return;

  setSelectValue('reactivityMode', preset.reactivityMode);
  setInputValue('reactivityBlend', preset.reactivityBlend);
  setInputValue('motionIntensity', preset.motionIntensity);
  setInputValue('motionSmoothing', preset.motionSmoothing);
  setInputValue('bassBoost', preset.bassBoost);
  setCheckboxValue('frequencySmoothing', preset.frequencySmoothing);
  setCheckboxValue('beatReactivityBoost', preset.beatReactivityBoost);

  updateReactivityRoutingUi(preset.reactivityMode, preset.reactivityBlend);
}

export function bindMotionControlsRouting(
  params: MotionParamsLike,
  bind: (selector: string, handler: (el: any) => void) => void,
  bindThrottled: (selector: string, handler: (el: any) => void) => void,
) {
  bind('#reactivityMode', el => {
    params.reactivityMode = el.value as ReactivityMode;
    updateReactivityRoutingUi(params.reactivityMode, params.reactivityBlend ?? 0.45);
  });

  bindThrottled('#reactivityBlend', el => {
    params.reactivityBlend = parseFloat(el.value);
    updateReactivityRoutingUi(params.reactivityMode ?? 'hybrid', params.reactivityBlend ?? 0.45);
  });

  bind('#reactivityHz', el => {
    params.reactivityHz = Number(el.value) === 30 ? 30 : 60;
  });

  updateReactivityRoutingUi(params.reactivityMode ?? 'hybrid', params.reactivityBlend ?? 0.45);
}