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
        const iriIntensity = params.iridize * Math.max(0, normalizedAmp - 0.15) / 0.85;
        const shimmer = Math.sin(spikeTimeAcc * 4.1 + (i / iridizeBandSize) * 0.72) * 0.5 + 0.5;
        const chromaPulse = Math.max(shimmer, beatPulse * 0.75);
        localHue = (localHue + iriIntensity * (28 + chromaPulse * 38) + beatPulse * 14 * params.iridize + 360) % 360;
        localSat = Math.min(100, localSat + iriIntensity * 66 + beatPulse * 18 * params.iridize);
        localLum = Math.min(76, localLum + iriIntensity * 11 * chromaPulse + beatPulse * 5 * params.iridize);
        ctx.strokeStyle = `hsla(${localHue},${localSat}%,${localLum}%,${finalAlpha})`;
      }
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
