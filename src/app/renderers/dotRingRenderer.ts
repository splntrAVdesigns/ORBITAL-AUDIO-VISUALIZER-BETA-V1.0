import { drawReactiveDot } from './canvasLayerRenderer';
import { WebGLDotRenderer } from './webglDotRenderer';

function damp(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}

const TAU = Math.PI * 2;
function shortestAngleDelta(from: number, to: number): number {
  return ((to - from + Math.PI * 3) % TAU) - Math.PI;
}
function dampAngle(current: number, target: number, speed: number, dt: number): number {
  return current + shortestAngleDelta(current, target) * (1 - Math.exp(-speed * dt));
}

export type DotRingRenderOptions = {
  ctx: CanvasRenderingContext2D;
  params: any;
  R0: number;
  haloR: number;
  dt: number;
  energy60_150: number;
  energy150_250: number;
  energy20_160: number;
  timeMs: number;
  bpmValue: number;
  zoomOscPhase: number;
  chaosSegmentOffset: (angle: number, scale: number) => number;
  effectiveHue: number;
  sat: number;
  lum: number;
  colorWaveRotation: number;
  colorWaveLUT: Float32Array | number[];
  colorWaveSamples: number;
  satBurstWavePhase: number;
  cornerFlashPulse: number;
  beatPulse: number;
  spikeTimeAcc: number;
  renderWidth?: number;
  renderHeight?: number;
};

/**
 * Owns dot-ring runtime state and Canvas2D rendering.
 *
 * Extracted from App.tsx in Sprint 22G.2. This intentionally keeps the original
 * dot ring behavior: fixed-density cap, frame-rate independent spring motion,
 * BPM-swept organic fade, color wave, saturation burst, iridize shimmer, and
 * shared chaos segment offset.
 */
export class DotRingRuntime {
  private readonly dotRPrev: Float32Array;
  private readonly dotAPrev: Float32Array;
  private previousDotCount = 32;
  private layoutCount = 32;
  private requestedCount = 32;
  private pendingCount = 32;
  private pendingSinceMs = 0;
  private densityTransitionStartMs = 0;
  private densityTransitionFrom = 32;
  private densityTransitionTo = 32;
  private densityTransitionActive = false;
  private densityTransitionSwapped = false;
  private readonly maxSlots: number;
  private readonly fadeLUT = new Float32Array(256);
  private organicFadeStrength = 0.0;
  private dotFadeWindowAngle = 0;
  // Dot Ripple: a traveling wave phase (Sprint G). Separate from the Fade window
  // above -- ripple bunches/spreads dot *spacing*, fade dims dot *brightness*.
  private rippleWindowAngle = 0;
  private readonly dotFadeWindowWidth = Math.PI;
  private readonly colorCache = new Map<string, string>();
  private webglDots: WebGLDotRenderer | null = null;
  private webglFailed = false;

  constructor(maxDots = 2000) {
    this.maxSlots = Math.min(240, maxDots);
    for (let i = 0; i < this.fadeLUT.length; i++) this.fadeLUT[i] = Math.sin((i / (this.fadeLUT.length - 1)) * Math.PI);
    this.dotRPrev = new Float32Array(this.maxSlots);
    this.dotAPrev = new Float32Array(this.maxSlots).fill(0);
    try { this.webglDots = new WebGLDotRenderer(this.maxSlots); } catch { this.webglFailed = true; }
  }

  reset(): void {
    this.previousDotCount = 32;
    this.layoutCount = 32;
    this.requestedCount = 32;
    this.pendingCount = 32;
    this.pendingSinceMs = 0;
    this.densityTransitionStartMs = 0;
    this.densityTransitionFrom = 32;
    this.densityTransitionTo = 32;
    this.densityTransitionActive = false;
    this.densityTransitionSwapped = false;
    this.organicFadeStrength = 0.0;
    this.dotFadeWindowAngle = 0;
    this.rippleWindowAngle = 0;
    this.dotRPrev.fill(0);
    this.dotAPrev.fill(0);
    this.colorCache.clear();
  }

  private resolveDensityLayout(requested: number, timeMs: number): { count: number; alpha: number; swapped: boolean } {
    const next = Math.max(8, Math.min(requested, this.maxSlots));
    if (next !== this.pendingCount) {
      this.pendingCount = next;
      this.pendingSinceMs = timeMs;
    }

    // Coalesce rapid slider input. A density transaction only starts once the
    // latest value has remained stable briefly, preventing queued arc layouts.
    if (!this.densityTransitionActive && this.pendingCount !== this.layoutCount && timeMs - this.pendingSinceMs >= 50) {
      this.densityTransitionActive = true;
      this.densityTransitionStartMs = timeMs;
      this.densityTransitionFrom = this.layoutCount;
      this.densityTransitionTo = this.pendingCount;
      this.densityTransitionSwapped = false;
    }

    if (!this.densityTransitionActive) return { count: this.layoutCount, alpha: 1, swapped: false };

    const durationMs = 170;
    const p = Math.max(0, Math.min(1, (timeMs - this.densityTransitionStartMs) / durationMs));
    const swapAt = 0.44;
    let swapped = false;
    let alpha: number;

    if (p < swapAt) {
      alpha = 1 - (p / swapAt) * 0.82;
    } else {
      if (!this.densityTransitionSwapped) {
        this.layoutCount = this.densityTransitionTo;
        this.previousDotCount = this.layoutCount;
        this.densityTransitionSwapped = true;
        swapped = true;
      }
      alpha = 0.18 + ((p - swapAt) / (1 - swapAt)) * 0.82;
    }

    if (p >= 1) {
      this.layoutCount = this.densityTransitionTo;
      this.previousDotCount = this.layoutCount;
      this.densityTransitionActive = false;
      this.densityTransitionSwapped = false;
      alpha = 1;
    }

    return { count: this.layoutCount, alpha, swapped };
  }

  render(options: DotRingRenderOptions): void {
    const {
      ctx,
      params,
      R0,
      haloR,
      dt,
      energy60_150,
      energy150_250,
      timeMs: t,
      bpmValue,
      zoomOscPhase,
      chaosSegmentOffset,
      effectiveHue,
      sat,
      lum,
      colorWaveRotation,
      colorWaveLUT,
      colorWaveSamples,
      satBurstWavePhase,
      cornerFlashPulse,
      beatPulse,
      spikeTimeAcc,
    } = options;

    if (!params.dotsOn) return;

    // The Dot Ring uses one stable renderer path for its full visual lifetime.
    // Panel gestures are not allowed to swap WebGL sprites for Canvas2D discs,
    // because any backend swap is visible as a Dot Size / glow change.
    const useWebGLDots = Boolean(this.webglDots && !this.webglFailed && params.webglDots !== false);
    if (useWebGLDots) this.webglDots!.begin(options.renderWidth ?? ctx.canvas.width, options.renderHeight ?? ctx.canvas.height);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const requestedDots = Math.max(8, Math.min(Math.round(params.dotsDensity), this.maxSlots, this.dotRPrev.length));
    this.requestedCount = requestedDots;
    const densityLayout = this.resolveDensityLayout(requestedDots, t);
    const dots = densityLayout.count;
    const dotsBaseRadius = R0 * 1.15;
    const dotsAmplitudeRange = (haloR - R0) * 0.55;

    const targetStrength = params.dotsPulse ? 1.0 : 0.0;
    this.organicFadeStrength = damp(this.organicFadeStrength, targetStrength, 12, dt);

    if (params.dotsPulse) {
      const angularSpeed = (bpmValue / 60.0) * 0.125 * Math.PI * 2;
      this.dotFadeWindowAngle = (this.dotFadeWindowAngle + angularSpeed * dt) % (Math.PI * 2);
    }

    // Dot Ripple (Sprint G, replaces Dot Glow): a traveling wave nudges each
    // dot's angle, bunching some together and spreading others apart in packs
    // that circle the ring. Even spacing and dot count are untouched -- this
    // only offsets where each already-placed dot draws, so it stays O(n) with
    // no new per-dot state and no risk of dots visually swapping identity.
    const rippleDepth = Math.max(0, Math.min(1, Number(params.dotRipple) || 0));
    const rippleActive = rippleDepth > 0.01;
    if (rippleActive) {
      const rippleAngularSpeed = (bpmValue / 60.0) * 0.20 * Math.PI * 2;
      this.rippleWindowAngle = (this.rippleWindowAngle + rippleAngularSpeed * dt) % (Math.PI * 2);
    }
    const rippleWaveCount = 3;
    const rippleMaxOffset = rippleActive ? (TAU / Math.max(1, dots)) * 0.9 : 0;

    const dotsMidBassPulse = energy60_150;
    const dotsMidRangePulse = energy150_250;
    const energyBoost = (dotsMidBassPulse * 0.50 + dotsMidRangePulse * 0.70);
    const amplifiedEnergy = Math.min(energyBoost, 1.0);
    const globalTarget = dotsBaseRadius + dotsAmplitudeRange * amplifiedEnergy;
    if (densityLayout.swapped) {
      for (let i = 0; i < dots; i++) {
        this.dotRPrev[i] = globalTarget;
        this.dotAPrev[i] = 1;
      }
    }

    const dotSpectrumMode = params.spectrum;
    // Sprint 22I: dot glow is the expensive path in Vercel/Canvas2D because each dot
    // can trigger shadow blur work. Keep the look, but tier the blur down when the
    // organic dot fade is active or density is high.
    const dotGlowQuality = params.dotsPulse || dots > 96 ? 0.55 : 1.0;
    // Sprint G: Dot Glow retired. Its WebGL path inflated the same size attribute
    // the dot's core circle uses, so at any depth it read as bigger dots, not a
    // separate soft halo -- visually indistinguishable from Dot Size, for real
    // per-frame cost. Forced off here; params.dotGlow itself is left untouched so
    // old presets/saved states still load without error, they just no longer draw it.
    const useDotGlow = false && params.dotGlow > 0.01 && dotGlowQuality > 0.01;

    if (useDotGlow) {
      ctx.save();
    }

    const hueAt = (a: number, base: number) => dotSpectrumMode ? (base + (a * 120 / Math.PI)) % 360 : base;

    const renderCount = dots;
    for (let i = 0; i < renderCount; i++) {
      this.dotAPrev[i] = damp(this.dotAPrev[i], 1, 20, dt);
      // Every rendered density is a mathematically complete, equally-spaced ring.
      // Density changes cross-fade between complete layouts instead of exposing a
      // mixed old/new arc with uneven gaps.
      const a = (i / Math.max(1, dots)) * TAU;
      const dotSpringSpeed = globalTarget > this.dotRPrev[i] ? 32 : 20;
      this.dotRPrev[i] = damp(this.dotRPrev[i], globalTarget, dotSpringSpeed, dt);
      let pulseAlpha = 1.0;
      if (this.organicFadeStrength > 0.001) {
        const dotAngle = a;
        const angDist = (dotAngle - this.dotFadeWindowAngle + Math.PI * 2) % (Math.PI * 2);
        if (angDist < this.dotFadeWindowWidth) {
          const windowPos = angDist / this.dotFadeWindowWidth;
          const fadeDepth = this.fadeLUT[Math.min(255, Math.max(0, Math.round(windowPos * 255)))];
          const minAlpha = 0.05;
          pulseAlpha = 1.0 - fadeDepth * (1.0 - minAlpha) * this.organicFadeStrength;
        }
      }

      let dotZoomMod = 1.0;
      if (params.zoomOsc > 0.001) {
        const depth = params.zoomOsc;
        const numRings = params.zoomRings;
        const ringIndex = Math.floor((i / Math.max(1, dots)) * numRings);
        const ringDelay = ringIndex * 0.5 * params.zoomOscSpeed;
        dotZoomMod = 1.0 + depth * Math.sin((zoomOscPhase - ringDelay) * Math.PI * 2);
      }

      const finalDotR = this.dotRPrev[i] * dotZoomMod;
      const dotSegmentOffset = chaosSegmentOffset(a, R0 * 0.075);
      const rippleAngle = rippleActive
        ? a + rippleDepth * rippleMaxOffset * Math.sin(rippleWaveCount * a - this.rippleWindowAngle)
        : a;
      const x = Math.cos(rippleAngle) * (finalDotR + dotSegmentOffset);
      const y = Math.sin(rippleAngle) * (finalDotR + dotSegmentOffset);

      const baseHue = hueAt(a, effectiveHue);
      let localHue = baseHue;
      let dotSat = sat;
      let dotLum = lum;

      if (params.beatDetect && params.effectAmount > 0.01 && (params.beatPulseType === 'all' || params.beatPulseType === 'color')) {
        const rotatedAngle = (a + colorWaveRotation) % (Math.PI * 2);
        const anglePosition = rotatedAngle / (Math.PI * 2);
        const lutIndex = Math.floor(anglePosition * colorWaveSamples) % colorWaveSamples;
        const offset = colorWaveLUT[lutIndex] || 0;
        localHue = (baseHue + offset + 360) % 360;
      }

      const satBurstActive = params.beatDetect && params.effectAmount > 0.01 && (params.beatPulseType === 'all' || params.beatPulseType === 'flash');
      if (satBurstActive) {
        const dotDelay = 0.3;
        const dotPhase = (satBurstWavePhase - dotDelay + 1) % 1;
        const peakDistance = Math.abs(dotPhase - 0.5) * 2;
        const waveIntensity = Math.pow(1 - peakDistance, 3) * params.effectAmount;

        if (waveIntensity > 0.01) {
          const lumBoost = waveIntensity * 30;
          dotLum = Math.min(98, dotLum + lumBoost);
        }

        if (cornerFlashPulse > 0.02) {
          const breatheIntensity = cornerFlashPulse * params.effectAmount;
          const satPulseBoost = breatheIntensity * 25;
          dotSat = Math.min(100, dotSat + satPulseBoost);
          const lumPulseBoost = breatheIntensity * 9;
          dotLum = Math.min(98, dotLum + lumPulseBoost);
        }
      }

      if (params.iridize > 0.01) {
        const dotShimmer = Math.sin(spikeTimeAcc * 3.5 + i * 0.12) * 0.5 + 0.5;
        const iriStrength = params.iridize * (0.4 + this.dotAPrev[i] * 0.6);
        const metalHueShift = dotShimmer * 50 * iriStrength;
        localHue = ((localHue + metalHueShift) + 360) % 360;
        dotSat = Math.min(100, dotSat + iriStrength * 58 * (0.5 + dotShimmer * 0.5) + beatPulse * 22 * params.iridize);
        dotLum = Math.min(78, dotLum + iriStrength * 12 * dotShimmer + beatPulse * 7 * params.iridize);
      }

      const finalDotHue = (localHue + 360) % 360;
      const finalDotAlpha = this.dotAPrev[i] * pulseAlpha * densityLayout.alpha;
      // Quantized HSL cache avoids allocating 100+ unique CSS strings every frame.
      // The buckets are visually transparent but reduce drag/frame pressure when
      // Dot Fade + Spectrum/Iridize are stacked.
      const hueBucket = Math.round(finalDotHue);
      const satBucket = Math.round(dotSat);
      const lumBucket = Math.round(dotLum);
      const colorKey = `${hueBucket}|${satBucket}|${lumBucket}`;
      let dotColor = this.colorCache.get(colorKey);
      if (!dotColor) {
        dotColor = `hsla(${hueBucket},${satBucket}%,${lumBucket}%,1)`;
        if (this.colorCache.size > 720) this.colorCache.clear();
        this.colorCache.set(colorKey, dotColor);
      }
      const rad = 2.5 * params.dotSize;

      if (useWebGLDots) {
        this.webglDots!.add(x, y, rad, finalDotHue, dotSat, dotLum, finalDotAlpha, useDotGlow ? params.dotGlow * dotGlowQuality : 0);
      } else {
        drawReactiveDot({
          ctx,
          x,
          y,
          radius: rad,
          color: dotColor,
          alpha: finalDotAlpha,
          shadowBlur: useDotGlow ? rad * params.dotGlow * 2.5 * dotGlowQuality : 0,
          shadowColor: dotColor,
        });
      }
    }


    if (useWebGLDots) this.webglDots!.flush(ctx);

    if (useDotGlow) {
      ctx.restore();
    }

    ctx.restore();
  }

  dispose(): void {
    this.webglDots?.dispose();
    this.webglDots = null;
    this.webglFailed = true;
    this.reset();
  }
}