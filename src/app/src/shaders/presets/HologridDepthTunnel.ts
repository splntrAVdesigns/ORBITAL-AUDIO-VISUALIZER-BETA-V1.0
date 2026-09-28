import type { AudioData, ShaderParams, ShaderPreset } from '../ShaderRegistry';

// Sprint N: Hologrid rewrite for frame time + working controls.
//  * No shadowBlur anywhere (it re-blurs every primitive; ~240 blur passes/frame before).
//    Glow is now one wider translucent stroke under each ring, driven by Line Glow.
//  * Zero per-frame allocation: ring geometry lives in preallocated typed arrays
//    (was ~1,150 objects + arrays per frame).
//  * Spokes are ONE batched path and follow depth order, so wrap-around no longer draws
//    a long back-to-front segment.
//  * Ring/grid sliders were clamped to 24 rings / 48 segments although they advertise
//    42 / 96, so the upper half of both did nothing. Real ranges now apply.
//  * Perspective, Tunnel Depth, Center Pull, Horizon Tilt and Audio Pulse had ranges too
//    narrow to notice; each curve now passes through the old value at the slider default
//    (default look unchanged) and reaches clearly different shapes at either end.
const MAX_RINGS = 42;
const MAX_SEGMENTS = 96;
const ringX = new Float32Array(MAX_RINGS * MAX_SEGMENTS);
const ringY = new Float32Array(MAX_RINGS * MAX_SEGMENTS);
const ringAlpha = new Float32Array(MAX_RINGS);
const ringZ = new Float32Array(MAX_RINGS);
const depthOrder = new Int16Array(MAX_RINGS);

let ctx: CanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let lastFrameTime = 0;
let tunnelPhase = 0;
let smoothEnergy = 0;
let smoothBeat = 0;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clampRange = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Two-segment linear map through (x0,y0) (x1,y1) (x2,y2); x1 is the slider default. */
function piecewise(x: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): number {
  const v = clampRange(x, x0, x2);
  return v <= x1 ? y0 + (y1 - y0) * ((v - x0) / (x1 - x0)) : y1 + (y2 - y1) * ((v - x1) / (x2 - x1));
}
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;

export const HologridDepthTunnelShader: ShaderPreset = {
  id: 'hologrid-depth-tunnel',
  name: 'Hologrid Depth Tunnel',
  description: 'Futuristic Z-depth wire tunnel with audio-pulsed perspective, dense grid geometry, and color-cycle support',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23000208"/%3E%3Cg fill="none" stroke="%2300d8ff" opacity=".85"%3E%3Ccircle cx="50" cy="50" r="7"/%3E%3Ccircle cx="50" cy="50" r="16"/%3E%3Ccircle cx="50" cy="50" r="27"/%3E%3Ccircle cx="50" cy="50" r="41"/%3E%3Cpath d="M50 50L8 10M50 50l84 0M50 50L18 88M50 50l2-46M50 50l42 38M50 50L8 50M50 50l38-40"/%3E%3C/g%3E%3Cg fill="%2300f6ff" opacity=".65"%3E%3Ccircle cx="50" cy="50" r="2"/%3E%3Ccircle cx="71" cy="50" r="1.4"/%3E%3Ccircle cx="29" cy="50" r="1.4"/%3E%3C/g%3E%3C/svg%3E',
  type: 'canvas2d',
  category: 'geometric',

  defaults: {
    audioIntensity: 0.78,
    frequencyRange: 'full',
    beatSync: true,
    scale: 1.08,
    speed: 0.82,
    opacity: 0.8,
    blendMode: 'screen',
    tunnelDepth: 1.12,
    ringCount: 26,
    gridDensity: 64,
    zSpeed: 0.84,
    perspective: 1.18,
    pulseAmount: 0.92,
    lineGlow: 0.78,
    centerPull: 0.58,
    twist: 0.32,
    horizonTilt: 0.12,
  },

  controls: {
    tunnelDepth: { type: 'slider', label: 'Tunnel Depth', min: 0.25, max: 2.25, step: 0.05, default: 1.12 },
    ringCount: { type: 'slider', label: 'Depth Rings', min: 10, max: 42, step: 1, default: 26 },
    gridDensity: { type: 'slider', label: 'Radial Grid Density', min: 20, max: 96, step: 1, default: 64 },
    zSpeed: { type: 'slider', label: 'Z Motion Speed', min: 0.05, max: 2.4, step: 0.05, default: 0.84 },
    perspective: { type: 'slider', label: 'Perspective Pull', min: 0.2, max: 2.25, step: 0.05, default: 1.18 },
    pulseAmount: { type: 'slider', label: 'Audio Pulse Depth', min: 0, max: 1.8, step: 0.05, default: 0.92 },
    lineGlow: { type: 'slider', label: 'Line Glow', min: 0, max: 1.2, step: 0.05, default: 0.78 },
    centerPull: { type: 'slider', label: 'Center Pull', min: 0, max: 1.2, step: 0.05, default: 0.58 },
    twist: { type: 'slider', label: 'Tunnel Twist', min: -1.5, max: 1.5, step: 0.05, default: 0.32 },
    horizonTilt: { type: 'slider', label: 'Horizon Tilt', min: -0.9, max: 0.9, step: 0.05, default: 0.12 },
  },

  init(canvas: HTMLCanvasElement | OffscreenCanvas) {
    ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    lastFrameTime = 0;
    tunnelPhase = 0;
    smoothEnergy = 0;
    smoothBeat = 0;
  },

  render(audioData: AudioData, params: ShaderParams, time: number) {
    if (!ctx) return;
    const now = time / 1000;
    const dt = lastFrameTime > 0 ? Math.min(0.05, Math.max(0.001, now - lastFrameTime)) : 1 / 60;
    lastFrameTime = now;

    const audioIntensity = params.audioIntensity ?? 0.78;
    const energy = clamp01(audioData.energy * audioIntensity);
    const bass = clamp01(audioData.bass * audioIntensity);
    const mid = clamp01(audioData.mid * audioIntensity);
    const treble = clamp01(audioData.treble * audioIntensity);
    smoothEnergy += (energy - smoothEnergy) * Math.min(1, dt * 13);
    const beatTarget = params.beatSync ? clamp01(audioData.beatIntensity) : 0;
    smoothBeat += (beatTarget - smoothBeat) * Math.min(1, dt * (beatTarget > smoothBeat ? 22 : 7));

    const speed = (params.speed ?? 0.82) * ((params as any).zSpeed ?? 0.84);
    tunnelPhase = (tunnelPhase + dt * speed * (0.42 + smoothEnergy * 0.95 + smoothBeat * 0.2)) % 1;

    const cx = canvasWidth * 0.5;
    const cy = canvasHeight * 0.5;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.57 * (params.scale ?? 1.08);
    const hue = (params as any).hue ?? 190;
    const opacity = clamp01(params.opacity ?? 0.9);
    // Adaptive quality (engine-supplied) scales counts; slider ranges are otherwise honoured in full.
    const quality = clampRange(Number((params as any).renderQuality ?? 1), 0.5, 1);
    const rings = clampRange(Math.round(((params as any).ringCount ?? 26) * quality), 6, MAX_RINGS);
    const segments = clampRange(Math.round(((params as any).gridDensity ?? 64) * quality), 16, MAX_SEGMENTS);
    const depth = (params as any).tunnelDepth ?? 1.12;
    const perspective = (params as any).perspective ?? 1.18;
    const pulse = (params as any).pulseAmount ?? 0.92;
    const glow = clampRange((params as any).lineGlow ?? 0.78, 0, 1.2);
    const centerPull = (params as any).centerPull ?? 0.58;
    const twist = (params as any).twist ?? 0.32;
    const tilt = (params as any).horizonTilt ?? 0.12;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.globalCompositeOperation = ((params.blendMode === 'normal' ? 'source-over' : params.blendMode) || 'screen') as GlobalCompositeOperation;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Volumetric center haze (one gradient).
    const fog = ctx.createRadialGradient(cx, cy, radius * 0.02, cx, cy, radius * (0.55 + bass * 0.08));
    fog.addColorStop(0, hsl(hue + 12, 96, 60 + smoothBeat * 12, opacity * (0.12 + smoothEnergy * 0.1)));
    fog.addColorStop(0.34, hsl(hue + 26, 90, 48, opacity * 0.045));
    fog.addColorStop(1, hsl(hue, 90, 36, 0));
    ctx.fillStyle = fog;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // Geometry -> typed arrays. Each curve passes through the OLD value at the slider's default,
    // so the default look is unchanged, but the ends now reach clearly different shapes.
    const perspectivePow = piecewise(perspective, 0.2, 0.55, 1.18, 1.4294, 2.25, 3.4);   // ring spacing
    const depthReach = piecewise(depth, 0.25, 0.42, 1.12, 1.2736, 2.25, 2.35);             // front-ring reach
    const pullGain = piecewise(centerPull, 0, 0, 0.58, 0.58, 1.2, 2.8);                    // throat squeeze
    const yScale = 0.771 + (tilt - 0.12) * 0.5;                  // was 0.74 + tilt*0.26
    const tiltShift = radius * (0.0528 + (tilt - 0.12) * 0.7);   // = old at default, 1.6x slope
    for (let r = 0; r < rings; r++) {
      const z = (r / rings + tunnelPhase) % 1;
      const invZ = 1 - z;
      const depthScale = Math.pow(invZ, perspectivePow);
      const ringRadius = radius * (0.045 + depthScale * depthReach);
      const audioPulse = 1 + bass * pulse * (0.20 + invZ * 0.5) + mid * pulse * 0.12 + smoothBeat * pulse * 0.16;
      const pull = Math.min(0.85, pullGain * z * 0.28);
      ringAlpha[r] = opacity * (0.18 + Math.pow(invZ, 0.42) * 0.74) * (0.72 + z * 0.34);
      ringZ[r] = z;
      const ringTwist = now * speed * 0.18 + z * twist * Math.PI * 2.2 + mid * 0.42 + Math.sin(now * 0.35) * 0.05;
      const base = r * MAX_SEGMENTS;
      const yShift = tiltShift * (z - 0.5) + bass * radius * 0.035;
      for (let s = 0; s < segments; s++) {
        const a = (s / segments) * Math.PI * 2 + ringTwist;
        const shimmer = Math.sin(a * 6 + now * 2.4 + z * 12) * treble * 0.05;
        const bassWarp = Math.sin(a * 2 - now * 1.1 + z * 5.5) * bass * 0.05;
        const radial = ringRadius * audioPulse * (1 + shimmer + bassWarp);
        ringX[base + s] = cx + Math.cos(a) * radial * (1 - pull);
        ringY[base + s] = cy + Math.sin(a) * radial * yScale * (1 - pull) + yShift;
      }
    }

    // Rings: optional wide translucent glow stroke under a crisp stroke. No shadowBlur.
    const glowPass = glow > 0.03;
    for (let r = rings - 1; r >= 0; r--) {
      const z = ringZ[r];
      const invZ = 1 - z;
      const base = r * MAX_SEGMENTS;
      const crisp = Math.max(0.85, radius * (0.0024 + invZ * 0.0038) * (1 + smoothBeat * 0.45));
      const color = hue + z * 42 + treble * 28;
      const light = 58 + invZ * 18 + smoothBeat * 10;
      if (glowPass) {
        ctx.strokeStyle = hsl(color + 8, 100, Math.min(62, light), ringAlpha[r] * 0.13 * glow);
        ctx.lineWidth = crisp * (1.8 + glow * 2.4);
        ctx.beginPath();
        ctx.moveTo(ringX[base], ringY[base]);
        for (let s = 1; s < segments; s++) ctx.lineTo(ringX[base + s], ringY[base + s]);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.strokeStyle = hsl(color, 98, light, ringAlpha[r] * 0.78);
      ctx.lineWidth = crisp;
      ctx.beginPath();
      ctx.moveTo(ringX[base], ringY[base]);
      for (let s = 1; s < segments; s++) ctx.lineTo(ringX[base + s], ringY[base + s]);
      ctx.closePath();
      ctx.stroke();
    }

    // Spokes: one batched path, back -> front in true depth order (no wrap-around jump).
    const cut = clampRange(Math.ceil(rings * (1 - tunnelPhase)), 0, rings);
    let n = 0;
    for (let r = cut - 1; r >= 0; r--) depthOrder[n++] = r;
    for (let r = rings - 1; r >= cut; r--) depthOrder[n++] = r;
    const spokeDensityFade = Math.min(1, 0.35 + 26 / segments);
    ctx.strokeStyle = hsl(hue + 16 + treble * 18, 92, 66, opacity * (0.22 + smoothEnergy * 0.22) * spokeDensityFade);
    ctx.lineWidth = Math.max(0.65, radius * 0.0021 * (1 + smoothBeat * 0.25));
    ctx.beginPath();
    for (let s = 0; s < segments; s++) {
      const first = depthOrder[0] * MAX_SEGMENTS + s;
      ctx.moveTo(ringX[first], ringY[first]);
      for (let k = 1; k < rings; k++) {
        const idx = depthOrder[k] * MAX_SEGMENTS + s;
        ctx.lineTo(ringX[idx], ringY[idx]);
      }
    }
    ctx.stroke();

    // Grid intersection nodes: one fill per sampled ring.
    const nodeStep = Math.max(1, Math.round(segments / 24));
    ctx.fillStyle = hsl(hue + 24 + treble * 22, 100, 72 + smoothBeat * 10, opacity * (0.28 + smoothEnergy * 0.18));
    for (let r = 2; r < rings; r += 3) {
      const base = r * MAX_SEGMENTS;
      const nodeRadius = Math.max(0.55, radius * 0.0022 * (1 + ringZ[r] * 0.9 + smoothBeat * 0.9));
      ctx.globalAlpha = ringAlpha[r] * (0.22 + ringZ[r] * 0.38) * opacity;
      ctx.beginPath();
      for (let s = 0; s < segments; s += nodeStep) {
        ctx.moveTo(ringX[base + s] + nodeRadius, ringY[base + s]);
        ctx.arc(ringX[base + s], ringY[base + s], nodeRadius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Vanishing-point glow and beat pulse.
    const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * (0.12 + smoothBeat * 0.05));
    centerGlow.addColorStop(0, hsl(hue + 24, 100, 72, opacity * (0.18 + smoothBeat * 0.18 + glow * 0.08)));
    centerGlow.addColorStop(0.5, hsl(hue, 96, 56, opacity * 0.06));
    centerGlow.addColorStop(1, hsl(hue, 90, 40, 0));
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (0.14 + smoothBeat * 0.04), 0, Math.PI * 2);
    ctx.fill();

    if (smoothBeat > 0.04) {
      ctx.strokeStyle = hsl(hue + 32, 100, 72, opacity * smoothBeat * 0.36);
      ctx.lineWidth = Math.max(1, radius * 0.006);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (0.075 + smoothBeat * 0.1), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  },

  cleanup() {
    ctx = null;
    lastFrameTime = 0;
    tunnelPhase = 0;
    smoothEnergy = 0;
    smoothBeat = 0;
  },

  resize(width: number, height: number) {
    canvasWidth = width;
    canvasHeight = height;
  },
};
