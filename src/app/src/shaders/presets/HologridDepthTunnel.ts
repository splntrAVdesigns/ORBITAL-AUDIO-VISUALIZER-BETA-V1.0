import type { AudioData, ShaderParams, ShaderPreset } from '../ShaderRegistry';

let ctx: CanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let lastFrameTime = 0;
let tunnelPhase = 0;
let smoothEnergy = 0;
let smoothBeat = 0;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
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
    // The tunnel can otherwise create thousands of glowing path segments.
    // Quality is supplied by the engine's adaptive budget, not React state.
    const quality = Math.max(0.5, Math.min(1, Number((params as any).renderQuality ?? 1)));
    const rings = Math.max(10, Math.min(24, Math.round(((params as any).ringCount ?? 26) * quality)));
    const segments = Math.max(20, Math.min(48, Math.round(((params as any).gridDensity ?? 64) * quality)));
    const depth = (params as any).tunnelDepth ?? 1.12;
    const perspective = (params as any).perspective ?? 1.18;
    const pulse = (params as any).pulseAmount ?? 0.92;
    const glow = clamp01((params as any).lineGlow ?? 0.78);
    const centerPull = (params as any).centerPull ?? 0.58;
    const twist = (params as any).twist ?? 0.32;
    const tilt = (params as any).horizonTilt ?? 0.12;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.globalCompositeOperation = ((params.blendMode === 'normal' ? 'source-over' : params.blendMode) || 'screen') as GlobalCompositeOperation;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Subtle volumetric center haze. One radial gradient per frame, no post processing.
    const fog = ctx.createRadialGradient(cx, cy, radius * 0.02, cx, cy, radius * (0.55 + bass * 0.08));
    fog.addColorStop(0, hsl(hue + 12, 96, 60 + smoothBeat * 12, opacity * (0.12 + smoothEnergy * 0.1)));
    fog.addColorStop(0.34, hsl(hue + 26, 90, 48, opacity * 0.045));
    fog.addColorStop(1, hsl(hue, 90, 36, 0));
    ctx.fillStyle = fog;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
    ctx.fill();

    if (glow > 0) {
      ctx.shadowColor = hsl(hue + 8, 100, 64, 0.42 * glow);
      ctx.shadowBlur = 8 + glow * 22 + smoothBeat * 16;
    }

    const ringPoints: Array<Array<{ x: number; y: number; alpha: number; z: number; node: number }>> = [];
    for (let r = 0; r < rings; r++) {
      const z = ((r / rings + tunnelPhase) % 1);
      const invZ = 1 - z;
      const perspectivePow = 1.04 + perspective * 0.33;
      const depthScale = Math.pow(invZ, perspectivePow);
      const depthReach = 0.96 + depth * 0.28;
      const ringRadius = radius * (0.045 + depthScale * depthReach);
      const audioPulse = 1 + bass * pulse * (0.16 + invZ * 0.36) + mid * pulse * 0.08 + smoothBeat * pulse * 0.09;
      const pull = centerPull * z * 0.28;
      // Keep rear rings visible longer while still implying depth fade.
      const alpha = opacity * (0.18 + Math.pow(invZ, 0.42) * 0.74) * (0.72 + z * 0.34);
      const ringTwist = now * speed * 0.18 + z * twist * Math.PI * 2.2 + mid * 0.42 + Math.sin(now * 0.35) * 0.05;
      const points: Array<{ x: number; y: number; alpha: number; z: number; node: number }> = [];
      for (let s = 0; s < segments; s++) {
        const a = (s / segments) * Math.PI * 2 + ringTwist;
        const shimmer = Math.sin(a * 6 + now * 2.4 + z * 12) * treble * 0.035;
        const bassWarp = Math.sin(a * 2 - now * 1.1 + z * 5.5) * bass * 0.035;
        const radial = ringRadius * audioPulse * (1 + shimmer + bassWarp);
        const x = cx + Math.cos(a) * radial * (1 - pull);
        const y = cy + Math.sin(a) * radial * (0.74 + tilt * 0.26) * (1 - pull)
          + tilt * radius * (z - 0.5) * 0.44
          + bass * radius * 0.035;
        const node = ((s % Math.max(2, Math.round(segments / 16)) === 0) || (r % 4 === 0)) ? 1 : 0;
        points.push({ x, y, alpha, z, node });
      }
      ringPoints.push(points);
    }

    // Outer-to-inner rings, now brighter and denser.
    for (let r = rings - 1; r >= 0; r--) {
      const points = ringPoints[r];
      if (!points?.length) continue;
      const z = points[0].z;
      const invZ = 1 - z;
      ctx.strokeStyle = hsl(hue + z * 42 + treble * 28, 98, 58 + invZ * 18 + smoothBeat * 10, points[0].alpha * 0.78);
      ctx.lineWidth = Math.max(0.85, radius * (0.0024 + invZ * 0.0038) * (1 + smoothBeat * 0.45));
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Dense radial spokes. Limit to max 32 spokes to stay lightweight.
    const radialStep = Math.max(1, Math.round(segments / 32));
    ctx.shadowBlur = Math.max(3, glow * 14);
    for (let s = 0; s < segments; s += radialStep) {
      ctx.strokeStyle = hsl(hue + 16 + treble * 18, 92, 66, opacity * (0.22 + smoothEnergy * 0.22));
      ctx.lineWidth = Math.max(0.65, radius * 0.0021 * (1 + smoothBeat * 0.25));
      ctx.beginPath();
      let started = false;
      for (let r = rings - 1; r >= 0; r--) {
        const p = ringPoints[r]?.[s % ringPoints[r].length];
        if (!p) continue;
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // Tiny grid intersection nodes at ring/spoke crossings.
    const nodeStep = Math.max(1, Math.round(segments / 24));
    ctx.shadowBlur = 4 + glow * 10;
    ctx.fillStyle = hsl(hue + 24 + treble * 22, 100, 72 + smoothBeat * 10, opacity * (0.28 + smoothEnergy * 0.18));
    for (let r = 2; r < rings; r += 3) {
      const points = ringPoints[r];
      if (!points) continue;
      const nodeRadius = Math.max(0.55, radius * 0.0022 * (1 + points[0].z * 0.9 + smoothBeat * 0.9));
      for (let s = 0; s < segments; s += nodeStep) {
        const p = points[s % points.length];
        if (!p) continue;
        ctx.globalAlpha = p.alpha * (0.22 + p.z * 0.38) * opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Vanishing-point glow and beat pulse.
    ctx.shadowBlur = 10 + glow * 18 + smoothBeat * 18;
    const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * (0.12 + smoothBeat * 0.05));
    centerGlow.addColorStop(0, hsl(hue + 24, 100, 72, opacity * (0.18 + smoothBeat * 0.18)));
    centerGlow.addColorStop(0.5, hsl(hue, 96, 56, opacity * 0.06));
    centerGlow.addColorStop(1, hsl(hue, 90, 40, 0));
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (0.14 + smoothBeat * 0.04), 0, Math.PI * 2);
    ctx.fill();

    if (smoothBeat > 0.04) {
      ctx.shadowBlur = 0;
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