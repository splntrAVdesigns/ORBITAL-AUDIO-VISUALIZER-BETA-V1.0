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
  // Band-to-band interpolation state: carries the previous band's color
  // forward so each spike smoothly blends from it toward the new band's
  // target across the span of the new band, instead of jumping the instant
  // a new band starts.
  let prevBandHue = effectiveHue;
  let prevBandSat = sat;
  let prevBandLum = canvasFallbackGammaLum;
  let curBandHue = prevBandHue;
  let curBandSat = prevBandSat;
  let curBandLum = prevBandLum;
  // Seam fix: the ring is circular (i=N-1 sits visually next to i=0, at
  // angle 0 / 3 o'clock), but a single forward pass has no natural way to
  // blend the LAST band back toward the FIRST band's color — without this,
  // there's a hard, visible seam exactly at i=0 every time. Fix: remember
  // band 0's own computed target (firstBandHue/Sat/Lum, captured the first
  // time the loop computes it, below), and when the pass reaches the last
  // band boundary, blend toward that same remembered color instead of
  // computing an unrelated new one — closing the loop with zero seam.
  let firstBandHue = 0;
  let firstBandSat = 0;
  let firstBandLum = 0;
  let firstBandCaptured = false;
  const lastBandStart = canvasIridize ? Math.floor((N - 1) / iridizeBandSize) * iridizeBandSize : 0;

  const nyquist = sampleRate / 2;
  const minAudibleHz = 90;
  const maxAudibleHz = 2200;
  const minBin = Math.max(0, Math.floor((minAudibleHz / nyquist) * buf.length));
  const maxBin = Math.max(minBin, Math.min(Math.floor((maxAudibleHz / nyquist) * buf.length), buf.length - 1));
  const audibleBins = Math.max(1, maxBin - minBin);

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
    const amp = (Math.max(0, rawAmp) ** 0.9) * maxAmp * ampScale;
    const normalizedAmp = Math.max(0, rawAmp) ** 0.9;
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
        // This band's own new target color — the expensive math (trig,
        // amplitude read) still only runs once per band, exactly as before.
        prevBandHue = curBandHue;
        prevBandSat = curBandSat;
        prevBandLum = curBandLum;
        if (i === lastBandStart && firstBandCaptured) {
          // Closing the loop: blend the final band toward the exact same
          // color band 0 started from, instead of an unrelated new target,
          // so the wrap from i=N-1 back to i=0 has zero seam.
          curBandHue = firstBandHue;
          curBandSat = firstBandSat;
          curBandLum = firstBandLum;
        } else {
          // Amplitude gate lowered (0.15 -> 0.08) so quieter/moderate
          // content still shows color shift instead of reading as zero —
          // this was compounding with the linear slider scaling to make
          // the whole effect require both a loud band AND a high slider
          // setting before anything was visible anywhere.
          const iriIntensity = (iridizeCurve * IRIDIZE_INTENSITY_MULT) * Math.max(0, normalizedAmp - 0.08) / 0.92;
          const shimmer = Math.sin(spikeTimeAcc * 4.1 + (i / iridizeBandSize) * 0.72) * 0.5 + 0.5;
          const chromaPulse = Math.max(shimmer, beatPulse * 0.75);
          curBandHue = (localHue + iriIntensity * (28 + chromaPulse * 38) + beatPulse * 14 * iridizeCurve * IRIDIZE_INTENSITY_MULT + 360) % 360;
          curBandSat = Math.min(100, localSat + iriIntensity * 66 + beatPulse * 18 * iridizeCurve * IRIDIZE_INTENSITY_MULT);
          curBandLum = Math.min(85, localLum + iriIntensity * 11 * chromaPulse + beatPulse * 5 * iridizeCurve * IRIDIZE_INTENSITY_MULT);
          if (i === 0) {
            firstBandHue = curBandHue;
            firstBandSat = curBandSat;
            firstBandLum = curBandLum;
            firstBandCaptured = true;
          }
        }
      }
      // Soft fluid blend, every spike: interpolate from the previous band's
      // color toward this band's target across the span of the band, so
      // there's never a hard seam — just cheap arithmetic per spike (no new
      // trig), the same shape of per-spike cost the spectrum-mode branch
      // below already has.
      const t = (i % iridizeBandSize) / iridizeBandSize;
      let hueDelta = ((curBandHue - prevBandHue + 540) % 360) - 180;
      localHue = (prevBandHue + hueDelta * t + 360) % 360;
      localSat = prevBandSat + (curBandSat - prevBandSat) * t;
      localLum = prevBandLum + (curBandLum - prevBandLum) * t;
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
    const spikePulseMod = 0.35 + Math.min(1, amp) * 0.65;
    const spikeLen = amp * (Number(params.spikeTightness) || 1) * spikePulseMod;
    ctx.lineTo(cosA * (baseR + spikeLen), sinA * (baseR + spikeLen));
    ctx.stroke();
    if (params.mirror > 0) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(cosA * (baseR - amp * params.mirror), sinA * (baseR - amp * params.mirror));
      ctx.stroke();
    }
  }
}
