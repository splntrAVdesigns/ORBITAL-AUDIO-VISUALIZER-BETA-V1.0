import { buildVuMeterGradients } from '../runtime/colorPipeline';
import { getSecondsPerDivision, type RotationQuantizeDivision } from '../utils/rotationSyncEngine';
import { type ColorPalette } from '../data/colorPalettes';
import type { CenterEmitterGeometry } from '../runtime/visualizer/renderers/CenterEmitterGeometry';

export type VuGradientCache = {
  grad: CanvasGradient | null;
  clip: CanvasGradient | null;
  width: number;
  cacheKey: string;
};

export interface HaloLayerTimings {
  haloMs: number;
  orbitalMs: number;
}

const SHOCKWAVE_RADIUS_BUCKET_PX = 12;
const SHOCKWAVE_HUE_BUCKET_DEG = 12;
const MAX_SHOCKWAVE_GRADIENTS_PER_CONTEXT = 48;
const shockwaveGradientCaches = new WeakMap<
  CanvasRenderingContext2D,
  Map<string, CanvasGradient>
>();
const MAX_ORBITAL_PATH_BUCKETS = 16;
const orbitalPathCaches = new WeakMap<CanvasRenderingContext2D, Map<number, Path2D>>();

function getOrbitalEnergyPath(
  ctx: CanvasRenderingContext2D,
  pulseWidth: number,
): Path2D | null {
  if (typeof Path2D === 'undefined') return null;
  let cache = orbitalPathCaches.get(ctx);
  if (!cache) {
    cache = new Map();
    orbitalPathCaches.set(ctx, cache);
  }
  const widthNorm = Math.max(0, Math.min(1, pulseWidth / (Math.PI * 0.5)));
  const bucket = Math.max(1, Math.min(MAX_ORBITAL_PATH_BUCKETS, Math.round(widthNorm * MAX_ORBITAL_PATH_BUCKETS)));
  const cached = cache.get(bucket);
  if (cached) return cached;

  const halfSpan = (bucket / MAX_ORBITAL_PATH_BUCKETS) * Math.PI * 0.25;
  const path = new Path2D();
  path.arc(0, 0, 1, -halfSpan, halfSpan);
  cache.set(bucket, path);
  return path;
}

function getShockwaveGradient(
  ctx: CanvasRenderingContext2D,
  radius: number,
  hue: number,
): CanvasGradient {
  let cache = shockwaveGradientCaches.get(ctx);
  if (!cache) {
    cache = new Map();
    shockwaveGradientCaches.set(ctx, cache);
  }
  const radiusBucket = Math.max(
    SHOCKWAVE_RADIUS_BUCKET_PX,
    Math.round(radius / SHOCKWAVE_RADIUS_BUCKET_PX) * SHOCKWAVE_RADIUS_BUCKET_PX,
  );
  const hueBucket = (
    Math.round((((hue % 360) + 360) % 360) / SHOCKWAVE_HUE_BUCKET_DEG) *
    SHOCKWAVE_HUE_BUCKET_DEG
  ) % 360;
  const key = `${radiusBucket}:${hueBucket}`;
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const gradient = ctx.createRadialGradient(
    0,
    0,
    Math.max(0, radiusBucket - 35),
    0,
    0,
    radiusBucket + 35,
  );
  gradient.addColorStop(0, `hsla(${hueBucket},100%,70%,0)`);
  gradient.addColorStop(0.25, `hsla(${hueBucket},100%,75%,0.33)`);
  gradient.addColorStop(0.40, `hsla(${hueBucket},100%,85%,0.71)`);
  gradient.addColorStop(0.50, `hsla(${hueBucket},100%,90%,1)`);
  gradient.addColorStop(0.60, `hsla(${hueBucket},100%,85%,0.71)`);
  gradient.addColorStop(0.75, `hsla(${hueBucket},100%,80%,0.42)`);
  gradient.addColorStop(1, `hsla(${hueBucket},100%,70%,0)`);
  cache.set(key, gradient);
  if (cache.size > MAX_SHOCKWAVE_GRADIENTS_PER_CONTEXT) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  return gradient;
}

export function withCanvasState<T>(ctx: CanvasRenderingContext2D, draw: () => T): T {
  ctx.save();
  try {
    return draw();
  } finally {
    ctx.restore();
  }
}

export function renderVuMeter(options: {
  canvas: HTMLCanvasElement | null;
  energyTimeArr: Uint8Array | Float32Array;
  palette: ColorPalette;
  params: any;
  timeMs: number;
  gradientCache: VuGradientCache;
}): void {
  const { canvas, energyTimeArr, palette, params, timeMs, gradientCache } = options;
  if (!canvas) return;

  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return;

  const width = canvas.width;
  const height = canvas.height;

  let sum = 0;
  for (let i = 0; i < energyTimeArr.length; i++) {
    const normalized = (energyTimeArr[i] - 128) / 128;
    sum += normalized * normalized;
  }

  const rms = Math.sqrt(sum / Math.max(1, energyTimeArr.length));
  const peakApprox = rms * 1.8;
  const level = Math.min(1.0, peakApprox * 0.95);

  ctx2d.fillStyle = '#1a1e24';
  ctx2d.fillRect(0, 0, width, height);

  const meterWidth = Math.min(width, width * level);
  const normalZoneWidth = width * 0.95;
  const meterColorKey = `${palette.name}|${params.hueSpeed}|${params.iridize}|${params.gamma}|${Math.floor(timeMs / 50)}`;

  if (!gradientCache.grad || gradientCache.width !== width || gradientCache.cacheKey !== meterColorKey) {
    const builtGradients = buildVuMeterGradients(ctx2d, width, normalZoneWidth, {
      palette,
      hueSpeed: params.hueSpeed,
      timeMs,
      iridize: params.iridize,
      gamma: params.gamma,
      spectrum: params.spectrum,
    });
    gradientCache.grad = builtGradients.grad;
    gradientCache.clip = builtGradients.clip;
    gradientCache.width = width;
    gradientCache.cacheKey = meterColorKey;
  }

  if (meterWidth > 0) {
    if (meterWidth <= normalZoneWidth) {
      ctx2d.fillStyle = gradientCache.grad!;
      ctx2d.fillRect(0, 0, meterWidth, height);
    } else {
      ctx2d.fillStyle = gradientCache.grad!;
      ctx2d.fillRect(0, 0, normalZoneWidth, height);
      ctx2d.fillStyle = gradientCache.clip!;
      ctx2d.fillRect(normalZoneWidth, 0, meterWidth - normalZoneWidth, height);
    }
  }

  ctx2d.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx2d.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const x = (width / 10) * i;
    ctx2d.beginPath();
    ctx2d.moveTo(x, 0);
    ctx2d.lineTo(x, height);
    ctx2d.stroke();
  }

  ctx2d.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx2d.lineWidth = 2;
  ctx2d.beginPath();
  ctx2d.moveTo(normalZoneWidth, 0);
  ctx2d.lineTo(normalZoneWidth, height);
  ctx2d.stroke();
}

export function renderOuterHalo(options: {
  ctx: CanvasRenderingContext2D;
  params: any;
  radius: number;
  effectiveHue: number;
  saturation: number;
  luminosity: number;
  timeMs: number;
  satBurstWavePhase: number;
  timings?: HaloLayerTimings;
}): void {
  const {
    ctx,
    params,
    radius: RH,
    effectiveHue,
    saturation: sat,
    luminosity: lum,
    timeMs,
    satBurstWavePhase,
    timings,
  } = options;
  if (timings) {
    timings.haloMs = 0;
    timings.orbitalMs = 0;
  }
  const halo = params.halo;
  const bloom = params.bloom;
  if (halo <= 0.01) return;
  const haloStartedAt = timings ? performance.now() : 0;

  // Halo Strobe: LFO gain synced to BPM division, an opacity multiplier only
  // (no extra draw calls, same passes as always). Envelope is a fast attack
  // eased in over the first ~12% of the cycle, then a slower eased release
  // over the rest -- a heartbeat/pulse feel rather than a linear flicker,
  // which reads poorly at fast divisions like 1/8.
  let haloStrobeGain = 1;
  if (params.haloStrobeEnabled) {
    const periodSeconds = Math.max(0.05, getSecondsPerDivision(
      Number(params.bpm) || 174,
      (params.haloStrobeDivision || '1/4') as RotationQuantizeDivision,
    ));
    const phase = ((timeMs / 1000) % periodSeconds) / periodSeconds;
    const attackFrac = 0.12;
    if (phase < attackFrac) {
      const t = phase / attackFrac;
      haloStrobeGain = t * t * (3 - 2 * t);
    } else {
      const t = (phase - attackFrac) / (1 - attackFrac);
      haloStrobeGain = 1 - t * t * (3 - 2 * t);
    }
  }

  let haloLum = lum;
  const satBurstActive = params.beatDetect && params.effectAmount > 0.01 && (params.beatPulseType === 'all' || params.beatPulseType === 'flash');
  if (satBurstActive) {
    const haloDelay = 0.6;
    const haloPhase = (satBurstWavePhase - haloDelay + 1) % 1;
    const peakDistance = Math.abs(haloPhase - 0.5) * 2;
    const waveIntensity = Math.pow(1 - peakDistance, 3) * params.effectAmount;
    if (waveIntensity > 0.01) haloLum = Math.min(98, haloLum + waveIntensity * 30);
  }

  const grd = ctx.createRadialGradient(0, 0, RH * 0.6, 0, 0, RH * 1.05);
  grd.addColorStop(0.00, `hsla(${effectiveHue},${sat}%,${haloLum}%,${0.8 * halo})`);
  grd.addColorStop(0.35, `hsla(${(effectiveHue + 30) % 360},${sat}%,${haloLum * 0.9}%,${0.6 * halo})`);
  grd.addColorStop(1.00, `hsla(${(effectiveHue + 140) % 360},${sat}%,50%,0)`);

  withCanvasState(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    const haloWidth = Math.min(4, 1.2 + halo * 2.8);
    ctx.strokeStyle = grd;
    ctx.lineWidth = haloWidth;
    ctx.globalAlpha = haloStrobeGain;
    ctx.beginPath();
    ctx.arc(0, 0, RH, 0, Math.PI * 2);
    ctx.stroke();

    const passes = Math.floor(4 + Math.min(bloom * 12, 8));
    const bloomAlpha = 0.28 * halo;
    const extendedSpread = bloom > 0.75 ? 1.4 : 1.0;
    const bloomColor = `hsla(${effectiveHue},${sat}%,${haloLum}%,1)`;
    ctx.strokeStyle = bloomColor;

    for (let i = 1; i <= passes; i++) {
      const a = bloomAlpha * (1 - i / (passes + 1));
      ctx.globalAlpha = a * haloStrobeGain;
      ctx.lineWidth = haloWidth + i * 3.5 * extendedSpread;
      ctx.beginPath();
      ctx.arc(0, 0, RH, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (timings) timings.haloMs = performance.now() - haloStartedAt;

    if (params.orbitalEnergy > 0.01) {
      const orbitalStartedAt = timings ? performance.now() : 0;
      const pulseSpeed = params.orbitalEnergy * 2.0 * params.orbitalDirection;
      const pulseAngle = ((timeMs / 1000) * pulseSpeed) % (Math.PI * 2);
      const pulseWidth = Math.max(0.08, params.orbitalWidth * Math.PI * 0.5);
      const orbitalAlpha = Math.min(1, halo * params.orbitalEnergy) * haloStrobeGain;
      const cachedPath = getOrbitalEnergyPath(ctx, pulseWidth);
      const orbitalLightness = Math.min(98, haloLum + 26 * params.orbitalEnergy);
      ctx.save();
      ctx.rotate(pulseAngle);
      ctx.globalAlpha = orbitalAlpha * 0.28;
      ctx.strokeStyle = `hsl(${effectiveHue},${sat}%,${orbitalLightness}%)`;
      if (cachedPath) {
        ctx.scale(RH, RH);
        ctx.lineWidth = (haloWidth + params.orbitalEnergy * 5) / Math.max(1, RH);
        ctx.stroke(cachedPath);
        ctx.globalAlpha = orbitalAlpha;
        ctx.lineWidth = (haloWidth + params.orbitalEnergy * 1.5) / Math.max(1, RH);
        ctx.stroke(cachedPath);
      } else {
        ctx.lineWidth = haloWidth + params.orbitalEnergy * 5;
        ctx.beginPath();
        ctx.arc(0, 0, RH, -pulseWidth * 0.5, pulseWidth * 0.5);
        ctx.stroke();
        ctx.globalAlpha = orbitalAlpha;
        ctx.lineWidth = haloWidth + params.orbitalEnergy * 1.5;
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      if (timings) timings.orbitalMs = performance.now() - orbitalStartedAt;
    }
  });
}

export function renderHaloComet(options: {
  ctx: CanvasRenderingContext2D;
  params: any;
  radius: number;
  maxRadius: number;
  phase: number;
  sceneRotation: number;
  effectiveHue: number;
  saturation: number;
  luminosity: number;
}): void {
  const { ctx, params, radius, maxRadius, phase, sceneRotation, effectiveHue, saturation, luminosity } = options;
  if (!params.haloCometEnabled) return;

  const direction = Number(params.haloCometDirection) < 0 ? -1 : 1;
  const thickness = Math.max(1, Math.min(10, Number(params.haloCometThickness) || 3));
  const tailFraction = Math.max(0.05, Math.min(0.65, Number(params.haloCometTailLength) || 0.22));
  const haloGeometryStrength = Math.max(0.2, Math.min(1, Number(params.halo) || 0));
  const bloom = Math.max(0, Math.min(1, Number(params.bloom) || 0));
  const haloWidth = Math.min(4, 1.2 + haloGeometryStrength * 2.8);
  const bloomPasses = Math.floor(4 + Math.min(bloom * 12, 8));
  const bloomSpread = bloom > 0.75 ? 1.4 : 1;
  const bloomOuterReach = (haloWidth + bloomPasses * 3.5 * bloomSpread) * 0.5;
  const tailGlowWidth = thickness * 1.9;
  const visualGap = Math.min(14, 8 + thickness * 0.6);
  const orbitOffset = bloomOuterReach + visualGap + tailGlowWidth * 0.5;
  const orbitRadius = Math.min(maxRadius, radius) + orbitOffset;
  const headAngle = phase - sceneRotation;
  const tailAngle = Math.PI * 2 * tailFraction;
  const tailStart = headAngle - direction * tailAngle;
  const segments = 24;
  const segmentProgress = 1 / segments;
  const overlapProgress = segmentProgress * 0.14;

  withCanvasState(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    ctx.globalAlpha = 0.075;
    ctx.strokeStyle = `hsl(${effectiveHue}, ${Math.min(100, saturation)}%, ${Math.min(92, luminosity + 10)}%)`;
    ctx.lineWidth = tailGlowWidth;
    ctx.beginPath();
    ctx.arc(0, 0, orbitRadius, tailStart, headAngle, direction < 0);
    ctx.stroke();

    for (let segment = 0; segment < segments; segment += 1) {
      const startProgress = Math.max(0, segment * segmentProgress - overlapProgress);
      const endProgress = Math.min(1, (segment + 1) * segmentProgress + overlapProgress);
      const sampleProgress = (segment + 0.5) * segmentProgress;
      const presence = sampleProgress * sampleProgress * (3 - 2 * sampleProgress);
      const startAngle = tailStart + direction * tailAngle * startProgress;
      const endAngle = tailStart + direction * tailAngle * endProgress;
      const hue = (effectiveHue + (1 - presence) * 72 + 360) % 360;
      const adaptiveSaturation = Math.min(100, saturation + 2 + presence * 6);
      const lightness = Math.min(96, luminosity + 4 + presence * 26);

      ctx.globalAlpha = 0.035 + presence * 0.79;
      ctx.strokeStyle = `hsl(${hue}, ${adaptiveSaturation}%, ${lightness}%)`;
      ctx.lineWidth = thickness * (0.42 + presence * 0.74);
      ctx.beginPath();
      ctx.arc(0, 0, orbitRadius, startAngle, endAngle, direction < 0);
      ctx.stroke();
    }

    const highlightLength = Math.min(tailAngle * 0.08, 0.12);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `hsl(${effectiveHue}, ${Math.min(100, saturation + 8)}%, 96%)`;
    ctx.lineWidth = thickness * 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, orbitRadius, headAngle - direction * highlightLength, headAngle, direction < 0);
    ctx.stroke();
  });
}

export function renderShockwaves(options: {
  ctx: CanvasRenderingContext2D;
  pool: Array<{ active: boolean; radius: number; alpha: number; maxRadius: number }>;
  maxShockwaves: number;
  dt: number;
  speed: number;
  decay: number;
  hue: number;
}): void {
  const { ctx, pool, maxShockwaves, dt, speed, decay, hue } = options;
  withCanvasState(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < maxShockwaves; i++) {
      const sw = pool[i];
      if (!sw.active) continue;

      sw.radius += speed * 180 * dt;
      const radiusProgress = sw.radius / sw.maxRadius;
      if (radiusProgress > 0.85) sw.alpha *= Math.pow(0.5, dt * 60);
      else sw.alpha *= Math.pow(decay, dt * 60);

      if (sw.alpha < 0.02 || sw.radius > sw.maxRadius) {
        sw.active = false;
        continue;
      }

      ctx.globalAlpha = Math.min(1, sw.alpha * 1.2);
      ctx.strokeStyle = getShockwaveGradient(ctx, sw.radius, hue);
      ctx.lineWidth = 80;
      ctx.beginPath();
      ctx.arc(0, 0, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

export function drawReactiveDot(options: {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  shadowBlur?: number;
  shadowColor?: string;
}): void {
  const { ctx, x, y, radius, color, alpha, shadowBlur = 0, shadowColor = color } = options;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  if (shadowBlur > 0) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function renderCenterGlow(options: {
  ctx: CanvasRenderingContext2D;
  params: any;
  minSide: number;
  energy: number;
  hueBase: number;
  geometry?: CenterEmitterGeometry;
  burstImpulse?: number;
}): void {
  const { ctx, params, minSide, energy, hueBase, geometry } = options;
  const shouldShowCenterGlow = !params.astralShaper;
  if (!params.glowCenter || params.glowStrength <= 0.01 || !shouldShowCenterGlow) return;

  withCanvasState(ctx, () => {
    ctx.globalCompositeOperation = 'lighter';
    const impulse = Math.max(0, Math.min(1, options.burstImpulse ?? 0));
    const baseSize = geometry?.centerGlowRadius ?? minSide * 0.2 * (1 + energy * 0.5);
    const centerSize = baseSize * (1 + impulse * 0.055);
    const centerAlpha = Math.min(1, params.glowStrength * (0.5 + energy * 0.5) * (1 + impulse * 0.16));
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, centerSize);
    grd.addColorStop(0.0, `hsla(${hueBase}, 80%, 60%, ${centerAlpha})`);
    grd.addColorStop(0.4, `hsla(${hueBase}, 80%, 60%, ${centerAlpha * 0.4})`);
    grd.addColorStop(1.0, `hsla(${hueBase}, 80%, 50%, 0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(-centerSize, -centerSize, centerSize * 2, centerSize * 2);
  });
}
