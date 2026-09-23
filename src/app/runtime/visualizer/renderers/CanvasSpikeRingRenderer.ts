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

// Sprint "Integrity Lock" — Perf Win #1: bucket spikes by resolved stroke color and
// submit one Path2D per bucket instead of one beginPath()/stroke() pair per spike
// (up to 2N canvas paint calls per frame at high FFT). Path2D subpaths are drawn in
// one composite, cutting the paint-call count from O(N) to O(bucket count) with
// pixel-identical output. Module-scoped so the Map itself isn't reallocated every
// frame — only the (far fewer) Path2D instances touched this frame are.
const baseBucketPaths = new Map<string, Path2D>();
// Fresh Iridize design ("Chroma Flare", Sprint "Integrity Lock"): an additive,
// beat-reactive streak drawn past the spike tip in its own hue lane, composited
// with 'lighter' so it only ever ADDS light/alpha on top of the base spike —
// never dims or desaturates it — and reads as a distinct flare rather than a
// recolor of the existing line.
const flareBucketPaths = new Map<string, Path2D>();

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
  const iridizeAmount = canvasIridize ? Number(params.iridize) : 0;
  const iridizeBandSize = canvasIridize ? Math.max(1, Math.ceil(N / 24)) : N;
  const beatColorMode = Boolean(params.beatDetect) && (params.beatPulseType === 'all' || params.beatPulseType === 'color');
  // Color only varies per-index in spectrum/beat-color modes; iridize varies per
  // band; otherwise it's set once at i===0 and frozen for the whole frame — this
  // mirrors the original per-iteration `ctx.strokeStyle =` gating exactly, just
  // routed into bucket keys instead of immediate paint calls.
  const perIndexColor = !canvasIridize && (spectrumMode || beatColorMode);
  const lineWidthPx = Number(params.lineWidth) || 1;

  const nyquist = sampleRate / 2;
  const minAudibleHz = 90;
  const maxAudibleHz = 2200;
  const minBin = Math.max(0, Math.floor((minAudibleHz / nyquist) * buf.length));
  const maxBin = Math.max(minBin, Math.min(Math.floor((maxAudibleHz / nyquist) * buf.length), buf.length - 1));
  const audibleBins = Math.max(1, maxBin - minBin);

  baseBucketPaths.clear();
  if (canvasIridize) flareBucketPaths.clear();

  let currentBaseKey = '';
  let currentBasePath: Path2D | null = null;
  let currentFlareKey = '';
  let currentFlarePath: Path2D | null = null;

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
    let shimmer = 0;

    let updateBase = false;
    if (canvasIridize) {
      if (i % iridizeBandSize === 0) updateBase = true;
    } else if (perIndexColor || i === 0) {
      updateBase = true;
    }
    if (updateBase) {
      if (canvasIridize) {
        const iriIntensity = iridizeAmount * Math.max(0, normalizedAmp - 0.15) / 0.85;
        shimmer = Math.sin(spikeTimeAcc * 4.1 + (i / iridizeBandSize) * 0.72) * 0.5 + 0.5;
        const chromaPulse = Math.max(shimmer, beatPulse * 0.75);
        localHue = (localHue + iriIntensity * (28 + chromaPulse * 38) + beatPulse * 14 * iridizeAmount + 360) % 360;
        localSat = Math.min(100, localSat + iriIntensity * 66 + beatPulse * 18 * iridizeAmount);
        localLum = Math.min(76, localLum + iriIntensity * 11 * chromaPulse + beatPulse * 5 * iridizeAmount);
      }
      const baseColor = `hsla(${localHue},${localSat}%,${localLum}%,${finalAlpha})`;
      currentBaseKey = baseColor;
      let path = baseBucketPaths.get(currentBaseKey);
      if (!path) {
        path = new Path2D();
        baseBucketPaths.set(currentBaseKey, path);
      }
      currentBasePath = path;

      // ── Chroma Flare (fresh Iridize design) ─────────────────────────────────
      // Own hue lane (offset from the base spike color, not derived from it),
      // own alpha that only ever adds via 'lighter' compositing, and a distinct
      // beat-reactive surge so it reads as its own effect, not a recolor.
      if (canvasIridize) {
        const flareEnergy = iridizeAmount * (0.35 + beatPulse * 0.65);
        const flareHue = (localHue + 150 + shimmer * 40 + spikeTimeAcc * 30) % 360;
        const flareSat = Math.min(100, 70 + flareEnergy * 30);
        const flareLum = Math.min(85, 55 + flareEnergy * 30 + beatPulse * 10);
        const flareAlpha = Math.min(1, finalAlpha * (0.55 + flareEnergy * 1.1));
        currentFlareKey = `hsla(${flareHue.toFixed(1)},${flareSat.toFixed(1)}%,${flareLum.toFixed(1)}%,${flareAlpha.toFixed(3)})`;
        let flarePath = flareBucketPaths.get(currentFlareKey);
        if (!flarePath) {
          flarePath = new Path2D();
          flareBucketPaths.set(currentFlareKey, flarePath);
        }
        currentFlarePath = flarePath;
      }
    }

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
    const spikePulseMod = 0.35 + Math.min(1, amp) * 0.65;
    const spikeLen = amp * (Number(params.spikeTightness) || 1) * spikePulseMod;
    const tipX = cosA * (baseR + spikeLen);
    const tipY = sinA * (baseR + spikeLen);

    currentBasePath!.moveTo(x0, y0);
    currentBasePath!.lineTo(tipX, tipY);
    if (params.mirror > 0) {
      currentBasePath!.moveTo(x0, y0);
      currentBasePath!.lineTo(cosA * (baseR - amp * params.mirror), sinA * (baseR - amp * params.mirror));
    }

    // Flare streak: only past the tip, only when there's meaningful amplitude,
    // so silence stays quiet and the effect reads as riding the transient.
    if (canvasIridize && normalizedAmp > 0.12 && currentFlarePath) {
      const flareEnergy = iridizeAmount * (0.35 + beatPulse * 0.65);
      const flareLen = spikeLen * (0.35 + flareEnergy * 0.9);
      currentFlarePath.moveTo(tipX, tipY);
      currentFlarePath.lineTo(cosA * (baseR + spikeLen + flareLen), sinA * (baseR + spikeLen + flareLen));
    }
  }

  ctx.lineWidth = lineWidthPx;
  for (const [color, path] of baseBucketPaths) {
    ctx.strokeStyle = color;
    ctx.stroke(path);
  }

  if (canvasIridize && flareBucketPaths.size > 0) {
    const priorComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, lineWidthPx * 0.85);
    for (const [color, path] of flareBucketPaths) {
      ctx.strokeStyle = color;
      ctx.stroke(path);
    }
    ctx.globalCompositeOperation = priorComposite;
  }
}
