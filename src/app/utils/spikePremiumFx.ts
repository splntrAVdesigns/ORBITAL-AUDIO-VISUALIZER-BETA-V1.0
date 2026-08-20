import { sampleSymmetricSpikeAmplitude } from './spikeSignalChain';

export interface SpikePremiumFxParams {
  iridize: number;
  gamma: number;
  mirror: number;
  spikeTightness: number;
  spectrum: boolean;
}

export interface SpikePremiumFxState {
  sampleRate: number;
  timeSeconds: number;
  beatPulse: number;
  isBeat: boolean;
  peakEnergy: number;
  visualEnvelope: number;
  hue: number;
  saturation: number;
  lightness: number;
}

export interface SpikePremiumFxGeometry {
  innerRadius: number;
  outerRadius: number;
  spikeBaseHeight: number;
  spikeCount: number;
  zoom: number;
}

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

let perfWindowStart = 0;
let perfAccumMs = 0;
let perfFrames = 0;

function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${((h % 360) + 360) % 360},${clamp(s, 0, 100)}%,${clamp(l, 0, 100)}%,${clamp01(a)})`;
}

function shouldDebugFxCost(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('orbitalDebugSpikeFx') === '1';
  } catch {
    return false;
  }
}

function trackFxCost(start: number): void {
  if (!shouldDebugFxCost()) return;
  const now = performance.now();
  if (perfWindowStart <= 0) perfWindowStart = now;
  perfAccumMs += now - start;
  perfFrames++;
  if (now - perfWindowStart > 2000) {
    const avg = perfAccumMs / Math.max(1, perfFrames);
    // Lightweight debug path, opt-in only: localStorage.setItem('orbitalDebugSpikeFx','1')
    console.debug(`[SpikePremiumFx] avg ${avg.toFixed(3)}ms over ${perfFrames} frames`);
    perfWindowStart = now;
    perfAccumMs = 0;
    perfFrames = 0;
  }
}

function getFxMetrics(
  buf: Float32Array,
  params: SpikePremiumFxParams,
  state: SpikePremiumFxState,
  geo: SpikePremiumFxGeometry,
  direction: 1 | -1,
  sampleCount: number
): { avg: number; max: number; hotAvg: number; hotMax: number; avgTipRadius: number; maxTipRadius: number } {
  const N = Math.max(16, Math.min(geo.spikeCount, buf.length));
  const count = Math.max(24, Math.min(sampleCount, N));
  const ringScale = Math.max(0.001, params.spikeTightness || 1);
  let sum = 0;
  let maxAmp = 0;
  let hotSum = 0;
  let hotMax = 0;

  for (let j = 0; j < count; j++) {
    const i = Math.floor((j / count) * N);
    const amp = sampleSymmetricSpikeAmplitude(buf, i, N, {
      sampleRate: state.sampleRate,
      gamma: 0,
      ampScale: 1,
      ringIndex: direction < 0 ? 7 : 6,
    });
    const hot = clamp01((amp - 0.42) / 0.50);
    sum += amp;
    maxAmp = Math.max(maxAmp, amp);
    hotSum += hot;
    hotMax = Math.max(hotMax, hot);
  }

  const avg = sum / count;
  const hotAvg = hotSum / count;
  return {
    avg,
    max: maxAmp,
    hotAvg,
    hotMax,
    avgTipRadius: geo.innerRadius + direction * geo.spikeBaseHeight * avg * ringScale,
    maxTipRadius: geo.innerRadius + direction * geo.spikeBaseHeight * maxAmp * ringScale,
  };
}

function drawFlashContour(
  ctx: CanvasRenderingContext2D,
  buf: Float32Array,
  params: SpikePremiumFxParams,
  state: SpikePremiumFxState,
  geo: SpikePremiumFxGeometry,
  direction: 1 | -1,
  strength: number,
  radiusOffset: number,
  alpha: number,
  lineWidth: number,
  color: string,
  ringIndex: number,
  sampleCount: number
): void {
  const N = Math.max(16, Math.min(geo.spikeCount, buf.length));
  const count = Math.max(48, Math.min(sampleCount, N));
  const ringScale = Math.max(0.001, params.spikeTightness || 1);

  ctx.beginPath();
  for (let j = 0; j <= count; j++) {
    const t = j / count;
    const i = Math.floor(t * N) % N;
    const amp = sampleSymmetricSpikeAmplitude(buf, i, N, {
      sampleRate: state.sampleRate,
      gamma: 0,
      ampScale: 1,
      ringIndex,
    });
    const hot = clamp01((amp - 0.34) / 0.56);
    const a = t * TAU;
    const shellBreath = 0.78 + hot * 0.34 + Math.sin(state.timeSeconds * 7.0 + i * 0.029) * 0.035;
    const r = geo.innerRadius + direction * (geo.spikeBaseHeight * amp * ringScale + radiusOffset * shellBreath * strength);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (j === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = clamp01(alpha);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function renderIridizeShell(
  ctx: CanvasRenderingContext2D,
  buf: Float32Array,
  params: SpikePremiumFxParams,
  state: SpikePremiumFxState,
  geo: SpikePremiumFxGeometry,
  direction: 1 | -1
): void {
  const iri = clamp01(params.iridize);
  if (iri <= 0.01) return;

  const beatFlash = Math.max(state.isBeat ? 1 : 0, clamp01(state.beatPulse));
  const onsetFlash = clamp01(beatFlash * 0.92 + state.peakEnergy * 0.50 + state.visualEnvelope * 0.32);
  const iriStrength = Math.pow(iri, 0.54);
  const metrics = getFxMetrics(buf, params, state, geo, direction, 72);
  const colorEnergy = clamp01(metrics.hotAvg * 1.65 + metrics.hotMax * 0.56 + onsetFlash * 0.84);
  if (colorEnergy <= 0.018) return;

  const sampleCount = Math.max(64, Math.min(96, Math.floor(geo.spikeCount / 8)));
  const shellOut = geo.spikeBaseHeight * (0.10 + iriStrength * 0.26 + onsetFlash * 0.16);
  const alpha = clamp01(iriStrength * (0.12 + colorEnergy * 0.34 + onsetFlash * 0.28));
  const hue = state.hue;
  const sat = clamp(state.saturation + 42, 72, 100);
  // Phase 10I: Iridize stays chroma/color. Gamma owns white-hot luminance.
  const lum = clamp(state.lightness + 6 + onsetFlash * 8, 38, 72);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // IRIDIZE OWNERSHIP: saturated color energy only. No white blocks, no full duplicate white ring.
  // The shell follows spike tips and protrudes outward using the current palette hue.
  drawFlashContour(
    ctx,
    buf,
    params,
    state,
    geo,
    direction,
    1.0,
    shellOut,
    alpha,
    2.2 + iriStrength * 4.4 + onsetFlash * 2.2,
    hsla(hue, sat, lum, 1),
    direction < 0 ? 31 : 30,
    sampleCount
  );

  // Hot chroma core: same family as current color selector, brighter on beat/onset.
  drawFlashContour(
    ctx,
    buf,
    params,
    state,
    geo,
    direction,
    0.70,
    shellOut * 0.62,
    alpha * 0.70,
    1.15 + iriStrength * 2.0,
    hsla(hue + 18, 100, clamp(lum + 4, 42, 74), 1),
    direction < 0 ? 33 : 32,
    sampleCount
  );

  // Spectral fringe is color-only and thin, visible mainly at higher Iridize/onset values.
  if (iri > 0.24 || onsetFlash > 0.20) {
    const fringe = clamp01(alpha * (0.34 + onsetFlash * 0.26));
    drawFlashContour(ctx, buf, params, state, geo, direction, 1.16, shellOut * 1.03, fringe, 0.75 + iriStrength * 0.80, hsla(hue + 54, 100, 62, 1), direction < 0 ? 35 : 34, 96);
    drawFlashContour(ctx, buf, params, state, geo, direction, 1.27, shellOut * 1.08, fringe * 0.82, 0.62 + iriStrength * 0.65, hsla(hue - 46, 100, 60, 1), direction < 0 ? 37 : 36, 96);
  }

  // Per-spike color flash accents on taller spikes only. Colorized, not white-hot.
  const N = Math.max(16, Math.min(geo.spikeCount, buf.length));
  const accents = Math.min(88, N);
  const stride = Math.max(1, Math.floor(N / accents));
  const ringScale = Math.max(0.001, params.spikeTightness || 1);
  ctx.lineWidth = 0.9 + iriStrength * 1.8 + onsetFlash * 0.8;

  for (let i = 0; i < N; i += stride) {
    const amp = sampleSymmetricSpikeAmplitude(buf, i, N, {
      sampleRate: state.sampleRate,
      gamma: 0,
      ampScale: 1,
      ringIndex: direction < 0 ? 39 : 38,
    });
    const hot = clamp01((amp - 0.56) / 0.38);
    if (hot <= 0.018) continue;

    const a = (i / N) * TAU;
    const tipR = geo.innerRadius + direction * geo.spikeBaseHeight * amp * ringScale;
    const flareLen = direction * shellOut * (0.20 + hot * 0.72 + onsetFlash * 0.25);
    const x1 = Math.cos(a) * (tipR + direction * 0.5);
    const y1 = Math.sin(a) * (tipR + direction * 0.5);
    const x2 = Math.cos(a) * (tipR + flareLen);
    const y2 = Math.sin(a) * (tipR + flareLen);
    const localHue = hue + Math.sin(i * 0.173 + state.timeSeconds * 2.0) * 18 + hot * 18;
    ctx.strokeStyle = hsla(localHue, 100, clamp(52 + hot * 16 + onsetFlash * 6, 42, 72), alpha * hot * 1.35);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

function renderGammaEnergy(
  ctx: CanvasRenderingContext2D,
  buf: Float32Array,
  params: SpikePremiumFxParams,
  state: SpikePremiumFxState,
  geo: SpikePremiumFxGeometry,
  direction: 1 | -1
): void {
  const gamma = clamp01(params.gamma);
  if (gamma <= 0.01) return;

  const g = Math.pow(gamma, 0.58); // stronger direct-feeling curve than squared gamma
  const beatFlash = Math.max(state.isBeat ? 1 : 0, clamp01(state.beatPulse));
  const flash = clamp01(beatFlash * 0.60 + state.peakEnergy * 0.48 + state.visualEnvelope * 0.30);
  const metrics = getFxMetrics(buf, params, state, geo, direction, 96);
  const energy = clamp01(metrics.hotAvg * 1.45 + metrics.hotMax * 0.45 + flash * 0.65);
  if (energy <= 0.015) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const ringRadius = metrics.avgTipRadius + direction * geo.spikeBaseHeight * (0.020 + g * 0.025 + flash * 0.018);
  const bloomWidth = geo.spikeBaseHeight * (0.030 + g * 0.075 + energy * 0.040);
  const coreAlpha = clamp01(g * (0.055 + energy * 0.14 + flash * 0.12));
  const hotAlpha = clamp01(g * (0.035 + flash * 0.18));

  // Stronger luminance/bloom lane. Separate from Iridize and mostly same hue/white-hot, not chromatic.
  ctx.lineWidth = bloomWidth;
  ctx.strokeStyle = hsla(state.hue + 6, 100, 70 + energy * 22, coreAlpha);
  ctx.beginPath();
  ctx.arc(0, 0, Math.abs(ringRadius), 0, TAU);
  ctx.stroke();

  ctx.lineWidth = Math.max(1, bloomWidth * 0.36);
  ctx.strokeStyle = hsla(state.hue + 2, 55, 96, hotAlpha);
  ctx.beginPath();
  ctx.arc(0, 0, Math.abs(ringRadius + direction * bloomWidth * 0.42), 0, TAU);
  ctx.stroke();

  // Tip brightness: sampled/capped so high Gamma reads clearly without per-frame gradient spam.
  const N = Math.max(16, Math.min(geo.spikeCount, buf.length));
  const maxTips = Math.min(160, N);
  const stride = Math.max(1, Math.floor(N / maxTips));
  const ringScale = Math.max(0.001, params.spikeTightness || 1);
  for (let i = 0; i < N; i += stride) {
    const amp = sampleSymmetricSpikeAmplitude(buf, i, N, {
      sampleRate: state.sampleRate,
      gamma: gamma,
      ampScale: 1,
      ringIndex: direction < 0 ? 23 : 22,
    });
    const hot = clamp01((amp - 0.50) / 0.46);
    if (hot <= 0.01) continue;
    const a = (i / N) * TAU;
    const tipR = geo.innerRadius + direction * geo.spikeBaseHeight * amp * ringScale;
    const dot = 0.85 + hot * (1.45 + g * 2.25);
    const x = Math.cos(a) * tipR;
    const y = Math.sin(a) * tipR;
    ctx.fillStyle = hsla(state.hue + 4, 72, 96, clamp01(g * hot * (0.10 + flash * 0.24)));
    ctx.beginPath();
    ctx.arc(x, y, dot, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

export function renderSpikePremiumFx(
  ctx: CanvasRenderingContext2D,
  buf: Float32Array,
  params: SpikePremiumFxParams,
  state: SpikePremiumFxState,
  geo: SpikePremiumFxGeometry
): void {
  const start = shouldDebugFxCost() ? performance.now() : 0;

  // Iridize and Gamma are intentionally separate lanes:
  // - Iridize = current-palette color energy, chroma bloom, and spectral fringe.
  // - Gamma = stronger luminance, tip brightness, and white-hot high-energy bloom.
  renderIridizeShell(ctx, buf, params, state, geo, 1);
  renderGammaEnergy(ctx, buf, params, state, geo, 1);

  if (params.mirror > 0.01) {
    renderIridizeShell(ctx, buf, params, state, geo, -1);
    renderGammaEnergy(ctx, buf, params, state, geo, -1);
  }

  if (start > 0) trackFxCost(start);
}