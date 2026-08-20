export type RenderDisplayMode = 'performance' | 'balanced' | 'large' | 'ultra';

export interface RenderScaleProfile {
  mode: RenderDisplayMode;
  label: string;
  dprCap: number;
  maxPixels: number;
  glowQuality: number;
}

export const RENDER_SCALE_STORAGE_KEY = 'orbital.renderDisplayMode.v1';

export const RENDER_SCALE_PROFILES: Record<RenderDisplayMode, RenderScaleProfile> = {
  performance: { mode: 'performance', label: 'Performance', dprCap: 1.15, maxPixels: 2_600_000, glowQuality: 0.65 },
  balanced: { mode: 'balanced', label: 'LCD / Balanced', dprCap: 1.5, maxPixels: 4_200_000, glowQuality: 0.82 },
  large: { mode: 'large', label: 'Large Display', dprCap: 1.75, maxPixels: 5_600_000, glowQuality: 0.92 },
  ultra: { mode: 'ultra', label: 'Ultra / Capture', dprCap: 2.0, maxPixels: 7_200_000, glowQuality: 1.0 },
};

export const DEFAULT_RENDER_DISPLAY_MODE: RenderDisplayMode = 'balanced';

export function isRenderDisplayMode(value: unknown): value is RenderDisplayMode {
  return value === 'performance' || value === 'balanced' || value === 'large' || value === 'ultra';
}

export function getStoredRenderDisplayMode(): RenderDisplayMode {
  try {
    const stored = window.localStorage?.getItem(RENDER_SCALE_STORAGE_KEY);
    return isRenderDisplayMode(stored) ? stored : DEFAULT_RENDER_DISPLAY_MODE;
  } catch {
    return DEFAULT_RENDER_DISPLAY_MODE;
  }
}

export function setStoredRenderDisplayMode(mode: RenderDisplayMode): void {
  try {
    window.localStorage?.setItem(RENDER_SCALE_STORAGE_KEY, mode);
  } catch { }
  window.dispatchEvent(new CustomEvent('orbital:render-scale-change', { detail: { mode } }));
}

export function resolveAdaptiveRenderScale(args: {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio?: number;
  mode?: RenderDisplayMode;
}) {
  const mode = args.mode ?? getStoredRenderDisplayMode();
  const profile = RENDER_SCALE_PROFILES[mode] ?? RENDER_SCALE_PROFILES.balanced;
  const deviceDpr = Math.max(1, Number.isFinite(args.devicePixelRatio || 0) ? (args.devicePixelRatio || 1) : 1);
  const cappedByMode = Math.min(deviceDpr, profile.dprCap);
  const cssPixels = Math.max(1, args.cssWidth * args.cssHeight);
  const maxDprByPixels = Math.sqrt(profile.maxPixels / cssPixels);
  const effectiveDpr = Math.max(0.75, Math.min(cappedByMode, maxDprByPixels));
  const pixelCount = Math.max(1, Math.floor(args.cssWidth * effectiveDpr) * Math.floor(args.cssHeight * effectiveDpr));
  return {
    mode,
    profile,
    deviceDpr,
    effectiveDpr,
    pixelCount,
    width: Math.max(1, Math.floor(args.cssWidth * effectiveDpr)),
    height: Math.max(1, Math.floor(args.cssHeight * effectiveDpr)),
  };
}