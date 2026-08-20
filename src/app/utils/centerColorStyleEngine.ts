export type CenterColorStyleId =
  | 'none'
  | 'warmSunset'
  | 'coolCyberpunk'
  | 'vintageFilm'
  | 'neonDreams'
  | 'cyberBlue'
  | 'infrared'
  | 'chromeFade'
  | 'vaporPink'
  | 'acidGreen'
  | 'monoBlue'
  | 'warmFilm'
  | 'highContrastTech';

export type CenterColorStyle = {
  id: CenterColorStyleId;
  label: string;
  base: string;
  accent: string;
  highlight: string;
  strength: number;
  contrast: number;
  brightness: number;
  saturation: number;
  mode?: 'colorize' | 'chrome' | 'film' | 'contrast';
  /** When false/default, source hue is removed and style palette replaces color. */
  preserveSourceHue?: boolean;
  description: string;
};

/**
 * Strong logo/media color styles built for Center Graphic assets.
 * Unlike mild CSS color grades, this pipeline replaces source hue from alpha/luminance so
 * white PNG/SVG logos, grayscale art, uploaded media, and built-in logos respond
 * consistently without extra RAF loops or expensive image-data processing.
 */
export const CENTER_COLOR_STYLES: CenterColorStyle[] = [
  {
    id: 'none',
    label: 'None',
    base: '#ffffff',
    accent: '#ffffff',
    highlight: '#ffffff',
    strength: 0,
    contrast: 1,
    brightness: 1,
    saturation: 1,
    description: 'No color style.',
  },
  {
    id: 'warmSunset',
    label: 'Warm Sunset',
    base: '#ff6a00',
    accent: '#ff2d7a',
    highlight: '#ffe46b',
    strength: 0.94,
    contrast: 1.12,
    brightness: 1.06,
    saturation: 1.2,
    mode: 'colorize',
    description: 'Amber/orange sunset colorization with pink warmth.',
  },
  {
    id: 'coolCyberpunk',
    label: 'Cyberpunk',
    base: '#00f0ff',
    accent: '#1d5cff',
    highlight: '#ff32f6',
    strength: 0.96,
    contrast: 1.18,
    brightness: 1.08,
    saturation: 1.34,
    mode: 'colorize',
    description: 'Electric cyan and magenta cyberpunk styling.',
  },
  {
    id: 'vintageFilm',
    label: 'Vintage Film',
    base: '#d8a35b',
    accent: '#6f4a2b',
    highlight: '#ffe0a2',
    strength: 0.52,
    contrast: 0.96,
    brightness: 1.02,
    saturation: 0.82,
    mode: 'film',
    description: 'Soft sepia film tone with restrained contrast.',
  },
  {
    id: 'neonDreams',
    label: 'Neon Dreams',
    base: '#7a35ff',
    accent: '#00eaff',
    highlight: '#ff3df2',
    strength: 0.96,
    contrast: 1.2,
    brightness: 1.1,
    saturation: 1.42,
    mode: 'colorize',
    description: 'Violet, cyan, and pink neon color energy.',
  },
  {
    id: 'cyberBlue',
    label: 'Cyber Blue',
    base: '#008dff',
    accent: '#00f7ff',
    highlight: '#9eefff',
    strength: 0.88,
    contrast: 1.18,
    brightness: 1.08,
    saturation: 1.28,
    mode: 'colorize',
    description: 'Clean SPLNTR-style blue/cyan tech colorization.',
  },
  {
    id: 'infrared',
    label: 'Infrared',
    base: '#b90018',
    accent: '#ff3b00',
    highlight: '#ffd646',
    strength: 0.98,
    contrast: 1.28,
    brightness: 1.08,
    saturation: 1.44,
    mode: 'colorize',
    description: 'Red/orange thermal style with hot highlight accent.',
  },
  {
    id: 'chromeFade',
    label: 'Chrome Fade',
    base: '#b8c7d8',
    accent: '#f5f8ff',
    highlight: '#6e7f99',
    strength: 0.72,
    contrast: 1.34,
    brightness: 1.06,
    saturation: 0.22,
    mode: 'chrome',
    description: 'Graphite-to-silver metallic contrast.',
  },
  {
    id: 'vaporPink',
    label: 'Vapor Pink',
    base: '#ff3acb',
    accent: '#b04cff',
    highlight: '#ffd1ff',
    strength: 0.96,
    contrast: 1.12,
    brightness: 1.08,
    saturation: 1.32,
    mode: 'colorize',
    description: 'Pink/violet vaporwave colorization.',
  },
  {
    id: 'acidGreen',
    label: 'Acid Green',
    base: '#39ff14',
    accent: '#00ffa8',
    highlight: '#c9ff2f',
    strength: 0.96,
    contrast: 1.18,
    brightness: 1.08,
    saturation: 1.38,
    mode: 'colorize',
    description: 'Lime/green acid-tech colorization with sharp yellow highlights.',
  },
  {
    id: 'monoBlue',
    label: 'Mono Blue',
    base: '#1f7dff',
    accent: '#7ddcff',
    highlight: '#d2f6ff',
    strength: 0.84,
    contrast: 1.16,
    brightness: 1.05,
    saturation: 0.92,
    mode: 'colorize',
    description: 'Blue monochrome HUD styling.',
  },
  {
    id: 'warmFilm',
    label: 'Warm Film',
    base: '#f2b36a',
    accent: '#d56a34',
    highlight: '#ffe2aa',
    strength: 0.58,
    contrast: 1.05,
    brightness: 1.03,
    saturation: 0.92,
    mode: 'film',
    description: 'Balanced warm film tone.',
  },
  {
    id: 'highContrastTech',
    label: 'High Contrast Tech',
    base: '#f4fbff',
    accent: '#57c8ff',
    highlight: '#ffffff',
    strength: 0.34,
    contrast: 1.48,
    brightness: 1.04,
    saturation: 1.05,
    mode: 'contrast',
    description: 'Crisp high-contrast tech treatment with minimal color shift.',
  },
];

const STYLE_MAP = new Map<CenterColorStyleId, CenterColorStyle>(CENTER_COLOR_STYLES.map((style) => [style.id, style]));

export function getCenterColorStyle(id: string | undefined | null): CenterColorStyle {
  return STYLE_MAP.get((id || 'none') as CenterColorStyleId) || STYLE_MAP.get('none')!;
}

let styleCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
let styleCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function getStyleContext(width: number, height: number): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));

  if (!styleCanvas) {
    styleCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : document.createElement('canvas');
    styleCtx = styleCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  }

  if (!styleCtx || !styleCanvas) return null;
  if (styleCanvas.width !== w) styleCanvas.width = w;
  if (styleCanvas.height !== h) styleCanvas.height = h;

  styleCtx.setTransform(1, 0, 0, 1, 0, 0);
  styleCtx.globalAlpha = 1;
  styleCtx.globalCompositeOperation = 'source-over';
  styleCtx.filter = 'none';
  styleCtx.clearRect(0, 0, w, h);
  return styleCtx;
}

function createStyleGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  style: CenterColorStyle,
  width: number,
  height: number,
): CanvasGradient | string {
  if (style.mode === 'chrome' || style.mode === 'contrast') return style.base;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, style.base);
  gradient.addColorStop(0.56, style.accent);
  gradient.addColorStop(1, style.highlight);
  return gradient;
}

function drawElement(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  element: CanvasImageSource,
  width: number,
  height: number,
  filter = 'none',
): void {
  const prevFilter = ctx.filter;
  ctx.filter = filter;
  ctx.drawImage(element, 0, 0, width, height);
  ctx.filter = prevFilter;
}

function getLuminanceFilter(style: CenterColorStyle): string {
  if (style.id === 'none') return 'none';

  // Key architectural fix: remove source hue first, then rebuild from the
  // selected palette. This makes white, grayscale, and colored logos respond
  // predictably instead of mixing blue/orange/green through additive tinting.
  const contrast = style.mode === 'chrome' ? 1.42 : style.mode === 'film' ? 1.1 : 1.28;
  const brightness = style.mode === 'contrast' ? 1.08 : 1.04;
  return `grayscale(1) contrast(${contrast}) brightness(${brightness})`;
}

/**
 * Draws Center Graphic media with a strong color-style pipeline.
 * Uses offscreen compositing rather than getImageData, so white/transparent logos
 * can be recolored strongly while black detail stays black and alpha is preserved.
 */
export function drawCenterGraphicWithColorStyle(args: {
  ctx: CanvasRenderingContext2D;
  element: CanvasImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
  styleId?: string | null;
  extraFilter?: string | null;
}): void {
  const { ctx, element, x, y, width, height } = args;
  const extraFilter = args.extraFilter && args.extraFilter !== 'none' ? args.extraFilter : 'none';
  const style = getCenterColorStyle(args.styleId);

  if (!style || style.id === 'none' || style.strength <= 0.001) {
    const prevFilter = ctx.filter;
    ctx.filter = extraFilter;
    ctx.drawImage(element, x, y, width, height);
    ctx.filter = prevFilter;
    return;
  }

  const offCtx = getStyleContext(width, height);
  if (!offCtx || !styleCanvas) {
    const prevFilter = ctx.filter;
    ctx.filter = [`contrast(${style.contrast}) brightness(${style.brightness}) saturate(${style.saturation})`, extraFilter].filter((value) => value && value !== 'none').join(' ') || 'none';
    ctx.drawImage(element, x, y, width, height);
    ctx.filter = prevFilter;
    return;
  }

  const w = styleCanvas.width;
  const h = styleCanvas.height;

  // 1) Draw a hue-neutral luminance silhouette first. This is the important
  // consistency pass: source artwork hue is removed by default, while alpha and
  // brightness detail remain. Colored logos now behave like white logos instead
  // of mixing with the selected palette.
  drawElement(offCtx, element, w, h, getLuminanceFilter(style));

  // 2) Palette replacement. Multiply keeps dark line-art black and maps light
  // regions into the style palette. Because the source was grayscaled first,
  // Cyberpunk/Pink/Infrared/etc. are predictable on every upload.
  offCtx.globalAlpha = style.strength;
  offCtx.globalCompositeOperation = 'multiply';
  offCtx.fillStyle = createStyleGradient(offCtx, style, w, h);
  offCtx.fillRect(0, 0, w, h);

  // 3) Palette identity lift. This is intentionally a cheap single fill pass,
  // not bloom: it restores strong highlights and makes the selected style more
  // visible on white/transparent logos.
  if (style.mode !== 'film') {
    offCtx.globalAlpha = Math.min(0.42, style.strength * 0.32);
    offCtx.globalCompositeOperation = 'screen';
    offCtx.fillStyle = style.highlight;
    offCtx.fillRect(0, 0, w, h);
  }

  // 4) Reapply the original alpha only so transparent media stays clean without
  // bringing back the original hue.
  offCtx.globalAlpha = 1;
  offCtx.globalCompositeOperation = 'destination-in';
  drawElement(offCtx, element, w, h);

  offCtx.globalCompositeOperation = 'source-over';
  offCtx.filter = 'none';

  const prevFilter = ctx.filter;
  const prevShadowColor = ctx.shadowColor;
  const prevShadowBlur = ctx.shadowBlur;
  const prevShadowOffsetX = ctx.shadowOffsetX;
  const prevShadowOffsetY = ctx.shadowOffsetY;

  ctx.filter = [`contrast(${style.contrast}) brightness(${style.brightness}) saturate(${style.saturation})`, extraFilter].filter((value) => value && value !== 'none').join(' ') || 'none';
  if (style.id === 'infrared') {
    ctx.shadowColor = style.accent;
    ctx.shadowBlur = Math.max(3, Math.min(7, width * 0.012));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.drawImage(styleCanvas as CanvasImageSource, x, y, width, height);
  ctx.filter = prevFilter;
  ctx.shadowColor = prevShadowColor;
  ctx.shadowBlur = prevShadowBlur;
  ctx.shadowOffsetX = prevShadowOffsetX;
  ctx.shadowOffsetY = prevShadowOffsetY;
}

export function clearCenterColorStyleCache(): void {
  if (styleCtx && styleCanvas) {
    styleCtx.setTransform(1, 0, 0, 1, 0, 0);
    styleCtx.clearRect(0, 0, styleCanvas.width, styleCanvas.height);
  }
}