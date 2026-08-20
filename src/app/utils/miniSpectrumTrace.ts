/**
 * ORBITAL — Mini Spectrum Trace Renderer
 * Phase 10H.2: modern curved spectrum analyzer with palette-linked gradient fill.
 *
 * Kept outside App.tsx to avoid adding more RAF drawing code there.
 */

export interface MiniSpectrumPalette {
  type?: 'mono' | 'grad' | 'heat' | string;
  h?: number;
  a?: number;
  b?: number;
  sat?: number;
  lum?: number;
  stops?: Array<{ p: number; h: number }>;
}

export interface MiniSpectrumTraceOptions {
  sampleRate: number;
  palette: MiniSpectrumPalette;
  minHz?: number;
  maxHz?: number;
  points?: number;
  showFill?: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface MiniSpectrumCache {
  values: Float32Array;
  lastPointCount: number;
}

const canvasCache = new WeakMap<HTMLCanvasElement, MiniSpectrumCache>();

function hasAudibleEnergy(arr: Uint8Array): boolean {
  if (!arr?.length) return false;
  let peak = 0;
  let sum = 0;
  const stride = Math.max(1, Math.floor(arr.length / 96));
  for (let i = 0; i < arr.length; i += stride) {
    const v = arr[i];
    if (v > peak) peak = v;
    sum += v;
  }
  const avg = sum / Math.ceil(arr.length / stride);
  return peak > 5 || avg > 2.2;
}

function avgFreq(arr: Uint8Array, sampleRate: number, startHz: number, endHz: number): number {
  const nyquist = sampleRate / 2;
  const binWidth = nyquist / Math.max(1, arr.length);
  const startBin = Math.max(0, Math.floor(startHz / binWidth));
  const endBin = Math.min(arr.length, Math.ceil(endHz / binWidth));
  if (startBin >= endBin) return 0;
  let sum = 0;
  for (let i = startBin; i < endBin; i++) sum += arr[i];
  return sum / (endBin - startBin);
}

function hueAt(palette: MiniSpectrumPalette, t: number): number {
  const p: any = palette || {};
  if (p.type === 'grad') {
    const a = p.a ?? 200;
    const b = p.b ?? a;
    const d = ((b - a + 540) % 360) - 180;
    return (a + d * t + 360) % 360;
  }
  if (p.type === 'heat' && Array.isArray(p.stops) && p.stops.length > 0) {
    const stops = p.stops;
    for (let i = 0; i < stops.length - 1; i++) {
      const s = stops[i], e = stops[i + 1];
      if (t >= s.p && t <= e.p) {
        const lt = (t - s.p) / Math.max(0.0001, e.p - s.p);
        const d = ((e.h - s.h + 540) % 360) - 180;
        return (s.h + d * lt + 360) % 360;
      }
    }
    return stops[stops.length - 1].h;
  }
  return p.h ?? 194;
}

function hsl(palette: MiniSpectrumPalette, t: number, lightBoost = 0, alpha = 1): string {
  const p: any = palette || {};
  const h = hueAt(palette, t);
  const sat = clamp((p.sat ?? 1) * 100 + 18, 0, 100);
  const lumBase = clamp((p.lum ?? 0.55) * 100, 24, 78);
  const lum = clamp(lumBase + lightBoost, 20, 84);
  return `hsla(${h},${sat}%,${lum}%,${clamp01(alpha)})`;
}

function smoothPoints(values: Float32Array): void {
  if (values.length < 3) return;
  let prev = values[0];
  for (let i = 1; i < values.length - 1; i++) {
    const cur = values[i];
    values[i] = prev * 0.20 + cur * 0.60 + values[i + 1] * 0.20;
    prev = cur;
  }
}

export function renderMiniSpectrumTrace(
  ctx: CanvasRenderingContext2D,
  freqArr: Uint8Array,
  options: MiniSpectrumTraceOptions
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  if (width <= 0 || height <= 0 || !freqArr?.length) return;

  const palette = options.palette || {};
  const sampleRate = options.sampleRate || 44100;
  const minHz = options.minHz ?? 20;
  const maxHz = options.maxHz ?? 20000;
  const pointCount = Math.max(24, Math.min(options.points ?? 72, 160));
  const showFill = options.showFill !== false;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#1a1e24';
  ctx.fillRect(0, 0, width, height);

  const padX = 2;
  const padY = 3;
  const usableW = Math.max(1, width - padX * 2);
  const usableH = Math.max(1, height - padY * 2);
  let cache = canvasCache.get(ctx.canvas);
  if (!cache || cache.lastPointCount !== pointCount) {
    cache = { values: new Float32Array(pointCount), lastPointCount: pointCount };
    canvasCache.set(ctx.canvas, cache);
  }
  const values = cache.values;
  const isActive = hasAudibleEnergy(freqArr);

  if (!isActive) {
    // Phase 10I: no idle bottom line / no fake analyzer trace before playback.
    values.fill(0);
    return;
  }

  const logMin = Math.log10(minHz);
  const logMax = Math.log10(maxHz);

  for (let i = 0; i < pointCount; i++) {
    const t0 = i / pointCount;
    const t1 = (i + 1) / pointCount;
    const hz0 = Math.pow(10, logMin + (logMax - logMin) * t0);
    const hz1 = Math.pow(10, logMin + (logMax - logMin) * t1);
    const raw = avgFreq(freqArr, sampleRate, hz0, hz1) / 255;
    // Phase 10I: faster analyzer timing. Fast attack, controlled release.
    const target = Math.pow(clamp01(raw), 0.54);
    const prev = values[i] || 0;
    const coeff = target > prev ? 0.82 : 0.38;
    values[i] = prev + (target - prev) * coeff;
  }

  // One light spatial smoothing pass only. Keeps accuracy/timing sharper than 10H.
  smoothPoints(values);

  const lineGradient = ctx.createLinearGradient(0, 0, width, 0);
  lineGradient.addColorStop(0.00, hsl(palette, 0.00, 5, 1));
  lineGradient.addColorStop(0.50, hsl(palette, 0.50, 14, 1));
  lineGradient.addColorStop(1.00, hsl(palette, 1.00, 8, 1));

  const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
  // Phase 10I: +10% fuller gradient body; keep top edge clean to avoid flickering crest artifacts.
  fillGradient.addColorStop(0.00, hsl(palette, 0.50, 10, 0.46));
  fillGradient.addColorStop(0.58, hsl(palette, 0.50, 2, 0.18));
  fillGradient.addColorStop(1.00, hsl(palette, 0.50, 0, 0.00));

  const xAt = (i: number) => padX + (i / (pointCount - 1)) * usableW;
  const yAt = (i: number) => {
    const v = values[i];
    return padY + usableH - v * usableH * 0.94;
  };

  // Filled spectral body.
  if (showFill) {
    ctx.beginPath();
    ctx.moveTo(xAt(0), height - padY);
    ctx.lineTo(xAt(0), yAt(0));
    for (let i = 1; i < pointCount - 1; i++) {
      const xc = (xAt(i) + xAt(i + 1)) * 0.5;
      const yc = (yAt(i) + yAt(i + 1)) * 0.5;
      ctx.quadraticCurveTo(xAt(i), yAt(i), xc, yc);
    }
    ctx.lineTo(xAt(pointCount - 1), yAt(pointCount - 1));
    ctx.lineTo(xAt(pointCount - 1), height - padY);
    ctx.closePath();
    ctx.fillStyle = fillGradient;
    ctx.fill();
  }

  // Main curved trace. Phase 10I: true single 1px trace above the fill.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = lineGradient;
  ctx.beginPath();
  ctx.moveTo(xAt(0), yAt(0));
  for (let i = 1; i < pointCount - 1; i++) {
    const xc = (xAt(i) + xAt(i + 1)) * 0.5;
    const yc = (yAt(i) + yAt(i + 1)) * 0.5;
    ctx.quadraticCurveTo(xAt(i), yAt(i), xc, yc);
  }
  ctx.lineTo(xAt(pointCount - 1), yAt(pointCount - 1));
  ctx.stroke();
  ctx.restore();
}