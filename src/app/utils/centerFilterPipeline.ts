import { getCenterColorGrade } from './centerColorGrades';

const MAX_FILTER_CACHE_SIZE = 96;
const filterCache = new Map<string, string>();

function normalizeFilter(filter: string): string {
  return filter && filter !== 'none' ? filter : 'none';
}

/**
 * Creates a stable filter string for Center Graphic media.
 * This keeps filter naming/curves out of App.tsx and prevents new string
 * allocations from ballooning during RAF playback.
 */
export function getCenterGraphicFilter(args: {
  grade?: string | null;
  extraFilter?: string | null;
  saturation?: number;
  hueShiftDeg?: number;
  hueShiftAuto?: boolean;
  t?: number;
}): string {
  const gradeFilter = normalizeFilter(getCenterColorGrade(args.grade).cssFilter);
  const filters: string[] = [];

  const saturation = Number.isFinite(args.saturation as number) ? Math.max(0, Math.min(2, args.saturation as number)) : 1;
  if (Math.abs(saturation - 1) > 0.001) filters.push(`saturate(${saturation})`);

  const hueStrength = Number.isFinite(args.hueShiftDeg as number) ? Math.max(0, Math.min(180, args.hueShiftDeg as number)) : 0;
  const effectiveHueStrength = args.hueShiftAuto
    ? Math.max(hueStrength, 60) // Auto Hue should visibly animate even when Hue Shift is 0.
    : hueStrength;
  if (effectiveHueStrength > 0.001) {
    const hue = args.hueShiftAuto ? Math.sin((args.t || 0) * 0.42) * effectiveHueStrength : effectiveHueStrength;
    filters.push(`hue-rotate(${hue.toFixed(2)}deg)`);
  }

  const extraFilter = normalizeFilter([args.extraFilter, ...filters].filter(Boolean).join(' ') || 'none');

  if (gradeFilter === 'none' && extraFilter === 'none') return 'none';
  const key = `${gradeFilter}|${extraFilter}`;
  const cached = filterCache.get(key);
  if (cached) return cached;

  const filter = [gradeFilter, extraFilter].filter((value) => value !== 'none').join(' ');
  filterCache.set(key, filter);
  if (filterCache.size > MAX_FILTER_CACHE_SIZE) filterCache.clear();
  return filter || 'none';
}

export type CenterGraphicDrawArgs = {
  ctx: CanvasRenderingContext2D;
  source: CanvasImageSource;
  x: number;
  y: number;
  width: number;
  height: number;
  grade?: string | null;
  opacity?: number;
  filter?: string | null;
};

/**
 * Draws center graphic media with the full lightweight grade pipeline.
 *
 * Why this exists: Canvas/CSS filters do not visibly recolor pure white transparent
 * logos. This helper applies the CSS grade first, then a bounded source-atop tint
 * pass that respects alpha. That makes grades work on uploaded white PNG/SVG logos,
 * default logos, photos, and video frames without getImageData or extra RAF loops.
 */
let gradeCanvas: HTMLCanvasElement | null = null;
let gradeCtx: CanvasRenderingContext2D | null = null;
let gradeCanvasW = 0;
let gradeCanvasH = 0;

function getGradeCanvas(width: number, height: number): CanvasRenderingContext2D | null {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  if (!gradeCanvas) {
    gradeCanvas = document.createElement('canvas');
    gradeCtx = gradeCanvas.getContext('2d', { willReadFrequently: false });
  }
  if (!gradeCtx || !gradeCanvas) return null;
  if (gradeCanvasW !== w || gradeCanvasH !== h) {
    gradeCanvas.width = w;
    gradeCanvas.height = h;
    gradeCanvasW = w;
    gradeCanvasH = h;
  }
  gradeCtx.setTransform(1, 0, 0, 1, 0, 0);
  gradeCtx.globalAlpha = 1;
  gradeCtx.globalCompositeOperation = 'source-over';
  gradeCtx.filter = 'none';
  gradeCtx.clearRect(0, 0, w, h);
  return gradeCtx;
}

/**
 * Draws center graphic media with the full lightweight grade pipeline.
 *
 * Why this exists: Canvas/CSS filters do not visibly recolor pure white transparent
 * logos. This helper applies the CSS grade first, then a bounded source-atop tint
 * pass on a reusable offscreen canvas that respects the media alpha. That makes
 * grades work on uploaded white PNG/SVG logos, default logos, photos, and videos
 * without getImageData or extra RAF loops.
 */
export function drawCenterGraphicMedia({
  ctx,
  source,
  x,
  y,
  width,
  height,
  grade,
  opacity = 1,
  filter,
}: CenterGraphicDrawArgs): void {
  const gradeSpec: any = getCenterColorGrade(grade);
  const gradeFilter = normalizeFilter(filter || gradeSpec.cssFilter);
  const alpha = Math.max(0, Math.min(1, opacity));
  if (alpha <= 0 || width <= 0 || height <= 0) return;

  // Fast path: no grade, no offscreen pass.
  if (gradeSpec.id === 'none' && gradeFilter === 'none') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = 'none';
    ctx.drawImage(source, x, y, width, height);
    ctx.restore();
    return;
  }

  const targetCtx = getGradeCanvas(width, height);
  if (!targetCtx || !gradeCanvas) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = gradeFilter;
    ctx.drawImage(source, x, y, width, height);
    ctx.restore();
    return;
  }

  const localW = gradeCanvasW;
  const localH = gradeCanvasH;

  // Base CSS-filter grade.
  targetCtx.globalAlpha = 1;
  targetCtx.globalCompositeOperation = 'source-over';
  targetCtx.filter = gradeFilter;
  targetCtx.drawImage(source, 0, 0, localW, localH);

  // Alpha-respecting tint pass: this is what makes white transparent logos colorize.
  if (gradeSpec.tint && (gradeSpec.tintStrength || 0) > 0) {
    targetCtx.globalAlpha = Math.max(0, Math.min(1, gradeSpec.tintStrength || 0));
    targetCtx.globalCompositeOperation = gradeSpec.tintBlend || 'source-atop';
    targetCtx.filter = 'none';
    targetCtx.fillStyle = gradeSpec.tint;
    targetCtx.fillRect(0, 0, localW, localH);
  }

  // Lightweight accent, not full bloom: one blurred alpha-respecting draw on the offscreen only.
  if (gradeSpec.edgeTint && (gradeSpec.edgeStrength || 0) > 0) {
    targetCtx.globalCompositeOperation = 'lighter';
    targetCtx.globalAlpha = Math.max(0, Math.min(0.35, gradeSpec.edgeStrength || 0));
    targetCtx.filter = `blur(${Math.max(0, Math.min(8, gradeSpec.edgeBlur || 0))}px)`;
    targetCtx.drawImage(source, 0, 0, localW, localH);
    targetCtx.globalCompositeOperation = 'source-atop';
    targetCtx.filter = 'none';
    targetCtx.fillStyle = gradeSpec.edgeTint;
    targetCtx.fillRect(0, 0, localW, localH);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = 'none';
  ctx.drawImage(gradeCanvas, x, y, width, height);
  ctx.restore();
}

export function clearCenterGraphicFilterCache(): void {
  filterCache.clear();
}