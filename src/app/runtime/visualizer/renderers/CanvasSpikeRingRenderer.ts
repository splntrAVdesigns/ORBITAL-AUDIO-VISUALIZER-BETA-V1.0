const TAU = Math.PI * 2;

export interface CanvasSpikeRingFrame {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  params: Record<string, any>;
  buf: Float32Array;
  sampleRate: number;
  innerRadius: number;
  outerRadius: number;
  spikeCosTable: Float32Array;
  spikeSinTable: Float32Array;
  effectiveHue: number;
  saturation: number;
  luminance: number;
  canvasFallbackGammaLum: number;
  spikeTimeAcc: number;
  beatPulse: number;
  colorWaveRotation: number;
  colorWaveLUT: Float32Array;
  colorWaveSamples: number;
  zoomOscPhase: number;
  chaosSegmentOffset: (angle: number, scale: number) => number;
  alphaScale?: number;
  ampScale?: number;
  hueShift?: number;
}

// Reusable per-band color tables for seamless Iridize (24 bands max by
// construction: iridizeBandSize = ceil(N / 24)). Module-scoped so nothing
// is allocated per frame.
const MAX_IRIDIZE_BANDS = 32;
const bandHueTable = new Float32Array(MAX_IRIDIZE_BANDS);
const bandSatTable = new Float32Array(MAX_IRIDIZE_BANDS);
const bandLumTable = new Float32Array(MAX_IRIDIZE_BANDS);

// Peak Drop state (driven by the `spikeBloom` param, relabeled "Peak Drop"
// in the UI). One entry per spike; reallocated only when the spike count
// (FFT size) changes, never per frame.
let peakLen = new Float32Array(0);
let peakHold = new Float32Array(0);
let peakVel = new Float32Array(0);
let peakLastTime = -1;

function ensurePeakState(n: number): void {
  if (peakLen.length === n) return;
  peakLen = new Float32Array(n);
  peakHold = new Float32Array(n);
  peakVel = new Float32Array(n);
}

// Stable 0-1 hash per spike key (no allocation, deterministic across frames).
function spikeHash(k: number): number {
  const s = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Worker-neutral extraction of Orbital's certified Canvas2D spike submission.
 * The signal chain stays upstream; this function owns only frequency mapping,
 * color/iridize bands, zoom-ring geometry and mirrored line submission.
 */
export function renderCanvasSpikeRing(frame: CanvasSpikeRingFrame): void {
  const {
    ctx, params, buf, sampleRate, innerRadius: R0, outerRadius: R1,
    spikeCosTable, spikeSinTable, effectiveHue, saturation: sat,
    canvasFallbackGammaLum, spikeTimeAcc, beatPulse, colorWaveRotation,
    colorWaveLUT, colorWaveSamples: COLOR_WAVE_SAMPLES, zoomOscPhase,
    chaosSegmentOffset,
  } = frame;
  const N = buf.length;
  if (!N) return;
  const alphaScale = frame.alphaScale ?? 1;
  const ampScale = frame.ampScale ?? 0.9;
  const hueShift = frame.hueShift ?? 0;
  const maxAmp = (R1 - R0) * 0.65;

  const fftAlphaCompensation = Math.min(1.0, 2048 / N);
  const zoomWaveTransparency = params.zoomOsc > 0 ? Math.max(0, 1.0 - (params.zoomOsc / 0.1)) : 1.0;
  const finalAlpha = 0.9 * alphaScale * fftAlphaCompensation * zoomWaveTransparency;
  const spectrumMode = Boolean(params.spectrum);
  const canvasIridize = Number(params.iridize) > 0.01;
  const iridizeBandSize = canvasIridize ? Math.max(1, Math.ceil(N / 24)) : N;
  // Iridize enhancement: intensity now follows a front-loaded curve (power
  // < 1) instead of scaling linearly with the slider — per direct user
  // feedback that a linear 3x still required ~80% on the slider to read as
  // visible. A sub-1 exponent means low slider values already produce most
  // of the curve's range (0.2 -> ~0.52, 0.5 -> ~0.76), so the effect is
  // clearly present at 10-20% while still reaching full intensity at 100%.
  // Every downstream use is already clamped (Math.min(100,...) / Math.min(85,...)),
  // so this is safe regardless of how the curve is shaped.
  const IRIDIZE_INTENSITY_MULT = 3;
  const iridizeCurve = canvasIridize ? Math.pow(Number(params.iridize), 0.4) : 0;
  const nyquist = sampleRate / 2;
  const minAudibleHz = 90;
  const maxAudibleHz = 2200;
  const minBin = Math.max(0, Math.floor((minAudibleHz / nyquist) * buf.length));
  const maxBin = Math.max(minBin, Math.min(Math.floor((maxAudibleHz / nyquist) * buf.length), buf.length - 1));
  const audibleBins = Math.max(1, maxBin - minBin);


  // Seamless Iridize: every band's target color is computed up front, in a
  // small pre-pass over just the band-start spikes (at most 24 of them),
  // BEFORE any spike is drawn. Each spike then blends from its own band's
  // target toward the NEXT band's target, and the last band blends into
  // band 0 — so the ring has no start or end point and no seam anywhere.
  // (The previous single forward pass had to start band 0 from an untinted
  // seed color, which is what left the seam at 3 o'clock.) Frequency
  // mapping below intentionally mirrors the main loop's math exactly.
  let bandCount = 0;
  if (canvasIridize) {
    // floor, not ceil: any leftover spikes (N not divisible by the band size)
    // are absorbed into the LAST band, making it longer rather than creating
    // a short final band — so the wrap transition back into band 0 is never
    // compressed into fewer spikes than a normal band-to-band transition.
    bandCount = Math.min(MAX_IRIDIZE_BANDS, Math.max(1, Math.floor(N / iridizeBandSize)));
    const fallbackBaseHueForBands = (effectiveHue + hueShift + 360) % 360;
    const beatColorWave = params.beatDetect && params.effectAmount > 0.01 && (params.beatPulseType === 'all' || params.beatPulseType === 'color');
    for (let b = 0; b < bandCount; b += 1) {
      const bi = b * iridizeBandSize;
      const ba = (bi / N) * TAU;
      const cn = bi / N;
      let mn: number;
      if (cn >= 0.25 && cn <= 0.75) mn = cn;
      else if (cn > 0.75) mn = 1.5 - cn;
      else mn = 0.5 - cn;
      let fn: number;
      if (mn <= 0.375) fn = (mn - 0.25) / 0.125;
      else if (mn <= 0.5) fn = 1.0 - ((mn - 0.375) / 0.125);
      else if (mn <= 0.625) fn = (mn - 0.5) / 0.125;
      else fn = 1.0 - ((mn - 0.625) / 0.125);
      fn = Math.max(0, Math.min(1, fn));
      const efp = fn * audibleBins;
      const fb1 = Math.max(0, Math.min(buf.length - 1, minBin + Math.floor(efp)));
      const fb2 = Math.min(fb1 + 1, maxBin);
      const ff = efp - Math.floor(efp);
      const bRaw = (buf[fb1] ?? 0) * (1 - ff) + (buf[fb2] ?? 0) * ff;
      const bNorm = Math.max(0, bRaw) ** 0.9;
      let bHue = ((spectrumMode ? fallbackBaseHueForBands + (ba * 120 / Math.PI) : fallbackBaseHueForBands) + 360) % 360;
      if (beatColorWave) {
        const rotatedAngle = (ba + colorWaveRotation + TAU) % TAU;
        const lutIndex = Math.floor((rotatedAngle / TAU) * COLOR_WAVE_SAMPLES) % Math.max(1, COLOR_WAVE_SAMPLES);
        bHue = (bHue + (colorWaveLUT[lutIndex] ?? 0) + 360) % 360;
      }
      const iriIntensity = (iridizeCurve * IRIDIZE_INTENSITY_MULT) * Math.max(0, bNorm - 0.08) / 0.92;
      const shimmer = Math.sin(spikeTimeAcc * 4.1 + b * 0.72) * 0.5 + 0.5;
      const chromaPulse = Math.max(shimmer, beatPulse * 0.75);
      bandHueTable[b] = (bHue + iriIntensity * (28 + chromaPulse * 38) + beatPulse * 14 * iridizeCurve * IRIDIZE_INTENSITY_MULT + 360) % 360;
      bandSatTable[b] = Math.min(100, sat + iriIntensity * 66 + beatPulse * 18 * iridizeCurve * IRIDIZE_INTENSITY_MULT);
      bandLumTable[b] = Math.min(85, canvasFallbackGammaLum + iriIntensity * 11 * chromaPulse + beatPulse * 5 * iridizeCurve * IRIDIZE_INTENSITY_MULT);
    }
  }
  let bandIndex = 0;
  let bandStart = 0;
  let bandLen = iridizeBandSize;

  // Spike Variety: per-spike height variation so neighboring spikes differ,
  // like a classic bar spectrum. Keyed off the mirrored frequency position,
  // so the 4-fold mirror symmetry is preserved exactly. 0 = legacy behavior.
  const variety = Math.max(0, Math.min(1, Number(params.spikeVariety) || 0));
  const varietyKeyScale = Math.max(1, N / 8);

  // Peak Drop: tips break off at peaks, hold briefly, then fall with gravity.
  // spikeTimeAcc advances at 1.5x wall-clock seconds (MotionRotationRuntime).
  const peakDrop = Math.max(0, Math.min(1, Number(params.spikeBloom) || 0));
  const peakActive = peakDrop > 0.01;
  ensurePeakState(N);
  let peakDt = peakLastTime < 0 ? 0 : (spikeTimeAcc - peakLastTime) / 1.5;
  if (!(peakDt > 0) || peakDt > 0.05) peakDt = peakDt > 0.05 ? 0.05 : 0;
  peakLastTime = spikeTimeAcc;
  // Sprint D2: Thickness (spike length) remap, strengthened. The height-shaping
  // fix draws quiet bins at 35-100% of full length and Spike Variety further
  // scales typical bins down; together these left the ring visibly thinner than
  // its pre-fix look even at high Thickness settings. Gain now runs 2.2x at the
  // bottom of the slider (0.2) down to 1.55x at the top (1.5) -- real headroom
  // across the whole range instead of tapering back to no boost at the max.
  const rawTightness = Number(params.spikeTightness) || 1;
  const tightnessT = Math.max(0, Math.min(1, (rawTightness - 0.2) / 1.3));
  // Sprint F: ceiling trimmed 25% (2.2/1.55 -> 1.65/1.1625). Same curve shape/balance
  // across the slider, just scaled down uniformly so max Thickness reads less extreme.
  const tightness = rawTightness * (1.65 - 0.4875 * tightnessT);
  const peakRefMax = maxAmp * ampScale * tightness;
  const peakHoldTime = 0.06 + peakDrop * 0.3;
  const peakGravity = maxAmp * (22 - peakDrop * 16);
  const peakShowThreshold = peakRefMax * 0.4;
  const peakCapLen = Math.max(2, maxAmp * 0.025);

  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * TAU;
    const circleNorm = i / N;
    let mappedNorm: number;
    if (circleNorm >= 0.25 && circleNorm <= 0.75) mappedNorm = circleNorm;
    else if (circleNorm > 0.75) mappedNorm = 1.5 - circleNorm;
    else mappedNorm = 0.5 - circleNorm;

    let freqNorm: number;
    if (mappedNorm <= 0.375) freqNorm = (mappedNorm - 0.25) / 0.125;
    else if (mappedNorm <= 0.5) freqNorm = 1.0 - ((mappedNorm - 0.375) / 0.125);
    else if (mappedNorm <= 0.625) freqNorm = (mappedNorm - 0.5) / 0.125;
    else freqNorm = 1.0 - ((mappedNorm - 0.625) / 0.125);
    freqNorm = Math.max(0, Math.min(1, freqNorm));

    const exactFreqPos = freqNorm * audibleBins;
    const freqBin1 = Math.max(0, Math.min(buf.length - 1, minBin + Math.floor(exactFreqPos)));
    const freqBin2 = Math.min(freqBin1 + 1, maxBin);
    const freqFrac = exactFreqPos - Math.floor(exactFreqPos);
    const rawAmp = (buf[freqBin1] ?? 0) * (1 - freqFrac) + (buf[freqBin2] ?? 0) * freqFrac;
    let normalizedAmp = Math.max(0, rawAmp) ** 0.9;
    if (variety > 0) {
      const vk = Math.round(freqNorm * varietyKeyScale);
      const h1 = spikeHash(vk);
      const h2 = spikeHash(vk + 1000.5);
      const wobble = 0.5 + 0.5 * Math.sin(spikeTimeAcc * (1.0 + h2 * 2.6) + h1 * TAU);
      const jitter = 0.55 * h1 + 0.45 * wobble;
      normalizedAmp *= 1 - variety + variety * (0.25 + 0.75 * jitter);
    }
    const amp = normalizedAmp * maxAmp * ampScale;
    const fallbackBaseHue = (effectiveHue + hueShift + 360) % 360;
    const baseHue = ((spectrumMode ? fallbackBaseHue + (a * 120 / Math.PI) : fallbackBaseHue) + 360) % 360;
    let localHue = baseHue;

    if (params.beatDetect && params.effectAmount > 0.01 && (params.beatPulseType === 'all' || params.beatPulseType === 'color')) {
      const rotatedAngle = (a + colorWaveRotation + TAU) % TAU;
      const anglePosition = rotatedAngle / TAU;
      const lutIndex = Math.floor(anglePosition * COLOR_WAVE_SAMPLES) % Math.max(1, COLOR_WAVE_SAMPLES);
      localHue = (baseHue + (colorWaveLUT[lutIndex] ?? 0) + 360) % 360;
    }

    let localSat = sat;
    let localLum = canvasFallbackGammaLum;
    if (canvasIridize) {
      if (i % iridizeBandSize === 0) {
        // Band boundary: advance to this band's precomputed target. All
        // color math already ran once per band in the pre-pass above.
        const boundaryIndex = i / iridizeBandSize;
        if (boundaryIndex < bandCount) {
          bandIndex = boundaryIndex;
          bandStart = i;
          bandLen = boundaryIndex === bandCount - 1 ? N - i : iridizeBandSize;
        }
      }
      // Soft fluid blend: this band's target -> next band's target, where
      // the last band wraps into band 0, so the gradient is fully circular.
      const nextIndex = bandIndex + 1 < bandCount ? bandIndex + 1 : 0;
      const t = (i - bandStart) / bandLen;
      const fromHue = bandHueTable[bandIndex];
      const hueDelta = ((bandHueTable[nextIndex] - fromHue + 540) % 360) - 180;
      localHue = (fromHue + hueDelta * t + 360) % 360;
      localSat = bandSatTable[bandIndex] + (bandSatTable[nextIndex] - bandSatTable[bandIndex]) * t;
      localLum = bandLumTable[bandIndex] + (bandLumTable[nextIndex] - bandLumTable[bandIndex]) * t;
      ctx.strokeStyle = `hsla(${localHue},${localSat}%,${localLum}%,${finalAlpha})`;
    } else if (spectrumMode || i === 0 || (params.beatDetect && (params.beatPulseType === 'color' || params.beatPulseType === 'all'))) {
      ctx.strokeStyle = `hsla(${localHue},${localSat}%,${localLum}%,${finalAlpha})`;
    }
    ctx.lineWidth = Number(params.lineWidth) || 1;

    let binZoomMod = 1.0;
    if (params.zoomOsc > 0.001) {
      const depth = params.zoomOsc;
      const numRings = Math.max(1, Number(params.zoomRings) || 12);
      const ringIndex = Math.floor((i / N) * numRings);
      const ringDelay = ringIndex * 0.5 * (Number(params.zoomOscSpeed) || 1);
      binZoomMod = 1.0 + depth * Math.sin((zoomOscPhase - ringDelay) * TAU);
    }

    const segOffset = chaosSegmentOffset(a, (R1 - R0) * 0.42);
    const baseR = R0 * binZoomMod + segOffset;
    const cosA = spikeCosTable[i] ?? Math.cos(a);
    const sinA = spikeSinTable[i] ?? Math.sin(a);
    const x0 = cosA * baseR;
    const y0 = sinA * baseR;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    // Height shaping fix: this was `Math.min(1, amp)`, but `amp` is in
    // pixels (often hundreds), so it was always 1 and the intended shaping
    // never happened — every spike rendered at full scale. Using the 0-1
    // normalized amplitude restores the intent: quiet bins draw shorter
    // (down to 35%), loud peaks are unchanged (normalizedAmp 1 -> 1.0).
    const spikePulseMod = 0.35 + Math.min(1, normalizedAmp) * 0.65;
    const spikeLen = amp * tightness * spikePulseMod;
    ctx.lineTo(cosA * (baseR + spikeLen), sinA * (baseR + spikeLen));
    ctx.stroke();

    if (peakActive) {
      let pk = peakLen[i];
      if (spikeLen >= pk) {
        pk = spikeLen;
        peakHold[i] = peakHoldTime;
        peakVel[i] = 0;
      } else if (peakHold[i] > 0) {
        peakHold[i] -= peakDt;
      } else {
        peakVel[i] += peakGravity * peakDt;
        pk -= peakVel[i] * peakDt;
        if (pk < spikeLen) pk = spikeLen;
      }
      peakLen[i] = pk;
      // Only tips thrown from genuine peaks are drawn, and only once they
      // have visibly separated from the spike body.
      if (pk > peakShowThreshold && pk - spikeLen > peakCapLen) {
        const r0 = baseR + pk;
        const r1 = r0 + peakCapLen;
        ctx.beginPath();
        ctx.moveTo(cosA * r0, sinA * r0);
        ctx.lineTo(cosA * r1, sinA * r1);
        ctx.stroke();
      }
    } else {
      peakLen[i] = spikeLen;
      peakHold[i] = 0;
      peakVel[i] = 0;
    }
    if (params.mirror > 0) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(cosA * (baseR - amp * params.mirror), sinA * (baseR - amp * params.mirror));
      ctx.stroke();
    }
  }
}
