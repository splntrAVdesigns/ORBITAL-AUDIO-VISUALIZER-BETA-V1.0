import { SHADER_REGISTRY } from './ShaderRegistry';

const cap = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

export interface CoreTextureEnergySnapshot {
  opacity?: number;
  audioIntensity?: number;
  frequencyRange?: string;
  beatSync?: boolean;
  blendMode?: string;
  hue?: number;
}

/**
 * Builds the live parameter object for the selected Core Texture preset.
 * Keeps shader-specific UI mapping out of App.tsx and allows new controls
 * to be added by editing preset.controls/defaults only.
 */
export function resolveCoreTextureParams(liveParams: any, shaderId: string | null | undefined, snapshot: CoreTextureEnergySnapshot) {
  const shader = SHADER_REGISTRY.find((s: any) => s.id === shaderId) || SHADER_REGISTRY[0];
  const resolved: Record<string, any> = {
    ...(shader?.defaults || {}),
    opacity: liveParams.coreTexturesOpacity ?? snapshot.opacity ?? 0.8,
    audioIntensity: liveParams.coreTexturesAudioIntensity ?? snapshot.audioIntensity ?? 0.6,
    frequencyRange: liveParams.coreTexturesFrequencyRange ?? snapshot.frequencyRange ?? 'full',
    beatSync: liveParams.coreTexturesBeatSync ?? snapshot.beatSync ?? true,
    blendMode: liveParams.coreTexturesBlendMode ?? snapshot.blendMode ?? 'screen',
    hue: snapshot.hue,
  };

  const controls = (shader as any)?.controls || {};
  Object.keys(controls).forEach((key) => {
    const control = controls[key];
    const paramKey = `coreTextures${cap(key)}`;
    resolved[key] = liveParams[paramKey] ?? control?.default ?? resolved[key];
  });

  // Legacy aliases kept for older presets/saves.
  resolved.density = resolved.density ?? liveParams.coreTexturesDensity ?? liveParams.coreTexturesColumnDensity ?? 20;
  resolved.speed = resolved.speed ?? liveParams.coreTexturesSpeed ?? liveParams.coreTexturesFallSpeed ?? 1.0;
  resolved.glowIntensity = resolved.glowIntensity ?? liveParams.coreTexturesGlowIntensity ?? 0.7;
  resolved.filterEffect = resolved.filterEffect ?? liveParams.coreTexturesFilterEffect ?? 'Normal';
  resolved.filterIntensity = resolved.filterIntensity ?? liveParams.coreTexturesFilterIntensity ?? 1.0;

  return resolved;
}