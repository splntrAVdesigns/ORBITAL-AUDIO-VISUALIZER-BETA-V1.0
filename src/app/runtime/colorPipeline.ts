import { type ColorPalette, hueFromPalette as sampleHueFromPalette } from '../data/colorPalettes';

export type CenterColorSource = 'master' | 'center' | 'lut' | 'manual' | 'hybrid';

export interface UnifiedColorPipelineOptions {
  palette: ColorPalette;
  hueSpeed?: number;
  timeMs?: number;
  iridize?: number;
  gamma?: number;
  colorCycle?: boolean;
  spectrum?: boolean;
}

export interface PaletteColorStops {
  start: string;
  mid: string;
  end: string;
  clipStart: string;
  clipEnd: string;
  cacheKey: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const wrapHue = (h: number) => ((h % 360) + 360) % 360;

export function getPipelineHueOffset(options: UnifiedColorPipelineOptions): number {
  const hueSpeed = options.hueSpeed ?? 1;
  if (hueSpeed === 1) return 0;
  return wrapHue((options.timeMs ?? 0) * 0.02 * hueSpeed);
}

export function getUnifiedHue(options: UnifiedColorPipelineOptions, energy: number): number {
  const baseHue = sampleHueFromPalette(options.palette, clamp01(energy));
  return wrapHue(baseHue + getPipelineHueOffset(options));
}

export function getUnifiedHsla(
  options: UnifiedColorPipelineOptions,
  energy: number,
  alpha = 1,
  lightBoost = 0,
): string {
  const palette = options.palette;
  const hue = getUnifiedHue(options, energy);
  // Multipliers capped at ×6 / ×5 (was ×12 / ×8): keeps saturation/luminance dramatic
  // while halving GPU shader cost on high-iridize presets and eliminating audio pops.
  const iridizeBoost = clamp(options.iridize ?? 0, 0, 1) * 6;
  const gammaLift = clamp(options.gamma ?? 0, 0, 1) * 5;
  const sat = clamp((palette.sat ?? 1) * 100 + iridizeBoost, 0, 100);
  const lum = clamp((palette.lum ?? 0.62) * 100 + gammaLift + lightBoost, 18, 88);
  return `hsla(${hue}, ${sat}%, ${lum}%, ${clamp01(alpha)})`;
}

export function getUnifiedPaletteStops(options: UnifiedColorPipelineOptions): PaletteColorStops {
  const start = getUnifiedHsla(options, 0, 1, -4);
  const mid = getUnifiedHsla(options, 0.5, 1, 4);
  const end = getUnifiedHsla(options, 1, 1, 10);
  return {
    start,
    mid,
    end,
    clipStart: '#ff6600',
    clipEnd: '#ff0000',
    cacheKey: `${options.palette.name}|${start}|${mid}|${end}`,
  };
}

/**
 * VU meter should follow the same selected palette + hue-speed/FX offset as the main canvas,
 * while keeping the final 5% as a fixed red clipping zone for signal safety.
 */
export function buildVuMeterGradients(
  ctx: CanvasRenderingContext2D,
  width: number,
  normalZoneWidth: number,
  options: UnifiedColorPipelineOptions,
): { grad: CanvasGradient; clip: CanvasGradient; cacheKey: string } {
  const stops = getUnifiedPaletteStops(options);
  const grad = ctx.createLinearGradient(0, 0, normalZoneWidth, 0);
  grad.addColorStop(0, stops.start);
  grad.addColorStop(0.5, stops.mid);
  grad.addColorStop(1, stops.end);

  const clip = ctx.createLinearGradient(normalZoneWidth, 0, width, 0);
  clip.addColorStop(0, stops.clipStart);
  clip.addColorStop(1, stops.clipEnd);

  return { grad, clip, cacheKey: stops.cacheKey };
}

/**
 * Center graphic color source is intentionally advisory. The LUT / Center Color Style Engine
 * remains the final image-processing authority; this only tells future renderers whether the
 * selected master palette should be offered as an input.
 */
export function shouldFeedMasterPaletteToCenter(source: CenterColorSource | undefined): boolean {
  return source === undefined || source === 'master' || source === 'hybrid';
}

export function getCenterColorSourceLabel(source: CenterColorSource | undefined): string {
  switch (source) {
    case 'center': return 'Center Graphic Only';
    case 'lut': return 'LUT Driven';
    case 'manual': return 'Manual';
    case 'hybrid': return 'Hybrid';
    case 'master':
    default:
      return 'Master Palette';
  }
}