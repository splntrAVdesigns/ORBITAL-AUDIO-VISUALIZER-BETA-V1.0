import type { AudioData, ShaderParams, ShaderPreset } from '../ShaderRegistry';

type CubeParticle = { x: number; y: number; z: number; seed: number; phase: number };

let ctx: CanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let particles: CubeParticle[] = [];
let lastResolution = 0;
let lastFrameTime = 0;
let smoothEnergy = 0;
let smoothBeat = 0;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;

function rebuildParticles(resolution: number) {
  const res = Math.max(4, Math.min(15, Math.round(resolution || 9)));
  if (res === lastResolution && particles.length > 0) return;
  lastResolution = res;
  particles = [];
  const half = (res - 1) * 0.5;
  let idx = 0;
  for (let z = 0; z < res; z++) {
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const isShell = x === 0 || y === 0 || z === 0 || x === res - 1 || y === res - 1 || z === res - 1;
        // Keep the preset performance-safe by drawing shell particles plus a sparse inner lattice.
        if (!isShell && ((x + y + z) % 3 !== 0)) continue;
        particles.push({
          x: (x - half) / Math.max(1, half),
          y: (y - half) / Math.max(1, half),
          z: (z - half) / Math.max(1, half),
          seed: ((idx * 16807) % 2147483647) / 2147483647,
          phase: idx * 0.137,
        });
        idx++;
      }
    }
  }
}

function rotatePoint(x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  let yy = y * cx - z * sx;
  let zz = y * sx + z * cx;
  y = yy; z = zz;

  let xx = x * cy + z * sy;
  zz = -x * sy + z * cy;
  x = xx; z = zz;

  xx = x * cz - y * sz;
  yy = x * sz + y * cz;
  return { x: xx, y: yy, z };
}

export const ParticleCubeFieldShader: ShaderPreset = {
  id: 'particle-cube-field',
  name: 'Particle Cube Field',
  description: 'Performance-safe 3D cube particle lattice adapted from the cube.js concept',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23000510"/%3E%3Cg fill="%2300aaff" opacity=".85"%3E%3Ccircle cx="25" cy="25" r="2"/%3E%3Ccircle cx="50" cy="25" r="2"/%3E%3Ccircle cx="75" cy="25" r="2"/%3E%3Ccircle cx="25" cy="50" r="2"/%3E%3Ccircle cx="50" cy="50" r="2.5"/%3E%3Ccircle cx="75" cy="50" r="2"/%3E%3Ccircle cx="25" cy="75" r="2"/%3E%3Ccircle cx="50" cy="75" r="2"/%3E%3Ccircle cx="75" cy="75" r="2"/%3E%3C/g%3E%3Cpath d="M25 25h50v50H25zM38 12h50v50H38zM25 25l13-13M75 25l13-13M75 75l13-13" fill="none" stroke="%2300e5ff" stroke-width="2" opacity=".55"/%3E%3C/svg%3E',
  type: 'canvas2d',
  category: 'geometric',

  defaults: {
    audioIntensity: 0.0,
    frequencyRange: 'full',
    beatSync: true,
    scale: 1.0,
    speed: 0.72,
    opacity: 0.8,
    blendMode: 'screen',
    cubeDensity: 9,
    cubeSize: 0.78,
    depthSpread: 0.72,
    rotationX: 0.42,
    rotationY: 0.72,
    rotationZ: 0.22,
    audioExpansion: 0.72,
    beatPulse: 0.68,
    particleGlow: 0.72,
    formationTightness: 0.86,
    zAxisDrift: 0.48,
  },

  controls: {
    cubeDensity: { type: 'slider', label: 'Cube Density', min: 5, max: 14, step: 1, default: 9 },
    cubeSize: { type: 'slider', label: 'Cube Size', min: 0.45, max: 1.25, step: 0.05, default: 0.78 },
    depthSpread: { type: 'slider', label: 'Z Depth Spread', min: 0.25, max: 1.35, step: 0.05, default: 0.72 },
    rotationX: { type: 'slider', label: 'Rotation X', min: -1, max: 1, step: 0.05, default: 0.42 },
    rotationY: { type: 'slider', label: 'Rotation Y', min: -1, max: 1, step: 0.05, default: 0.72 },
    rotationZ: { type: 'slider', label: 'Rotation Z', min: -1, max: 1, step: 0.05, default: 0.22 },
    audioExpansion: { type: 'slider', label: 'Audio Expansion', min: 0, max: 1.4, step: 0.05, default: 0.72 },
    beatPulse: { type: 'slider', label: 'Beat Pulse', min: 0, max: 1.4, step: 0.05, default: 0.68 },
    particleGlow: { type: 'slider', label: 'Particle Glow', min: 0, max: 1, step: 0.05, default: 0.72 },
    formationTightness: { type: 'slider', label: 'Formation Tightness', min: 0.25, max: 1, step: 0.05, default: 0.86 },
    zAxisDrift: { type: 'slider', label: 'Z-Axis Drift', min: 0, max: 1, step: 0.05, default: 0.48 },
  },

  init(canvas: HTMLCanvasElement | OffscreenCanvas, params: ShaderParams) {
    ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    lastFrameTime = 0;
    smoothEnergy = 0;
    smoothBeat = 0;
    const quality = Math.max(0.5, Math.min(1, Number((params as any).renderQuality ?? 1)));
    rebuildParticles(Math.min((params as any).cubeDensity ?? 9, quality < 0.7 ? 6 : quality < 0.85 ? 7 : 8));
  },

  render(audioData: AudioData, params: ShaderParams, time: number) {
    if (!ctx) return;
    const now = time / 1000;
    const dt = lastFrameTime > 0 ? Math.min(0.05, Math.max(0.001, now - lastFrameTime)) : 1 / 60;
    lastFrameTime = now;

    const quality = Math.max(0.5, Math.min(1, Number((params as any).renderQuality ?? 1)));
    rebuildParticles(Math.min((params as any).cubeDensity ?? 9, quality < 0.7 ? 6 : quality < 0.85 ? 7 : 8));

    const cx = canvasWidth * 0.5;
    const cy = canvasHeight * 0.5;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.48;
    const hue = (params as any).hue ?? 190;
    const opacity = clamp01(params.opacity ?? 0.82);
    const audioIntensity = params.audioIntensity ?? 0.72;
    const energy = clamp01(audioData.energy * audioIntensity);
    const bass = clamp01(audioData.bass * audioIntensity);
    const mid = clamp01(audioData.mid * audioIntensity);
    const treble = clamp01(audioData.treble * audioIntensity);
    smoothEnergy += (energy - smoothEnergy) * Math.min(1, dt * 12);
    const beatTarget = params.beatSync ? clamp01(audioData.beatIntensity) : 0;
    smoothBeat += (beatTarget - smoothBeat) * Math.min(1, dt * (beatTarget > smoothBeat ? 18 : 7));

    const cubeSize = (params as any).cubeSize ?? 0.78;
    const spread = (params as any).depthSpread ?? 0.72;
    const expansion = 1 + smoothEnergy * ((params as any).audioExpansion ?? 0.72) * 0.42 + smoothBeat * ((params as any).beatPulse ?? 0.68) * 0.22;
    const tightness = (params as any).formationTightness ?? 0.86;
    const loose = 1 - tightness;
    const speed = params.speed ?? 0.72;
    const rx = now * speed * 0.38 * ((params as any).rotationX ?? 0.42) + bass * 0.55;
    const ry = now * speed * 0.46 * ((params as any).rotationY ?? 0.72) + mid * 0.42;
    const rz = now * speed * 0.25 * ((params as any).rotationZ ?? 0.22) + treble * 0.32;
    const zDrift = ((params as any).zAxisDrift ?? 0.48) * Math.sin(now * speed * 1.15 + smoothEnergy * 3.0) * 0.22;
    const glow = clamp01((params as any).particleGlow ?? 0.72);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.globalCompositeOperation = ((params.blendMode === 'normal' ? 'source-over' : params.blendMode) || 'screen') as GlobalCompositeOperation;
    ctx.lineCap = 'round';

    // Draw back-to-front for cleaner depth without WebGL state overhead.
    const projected: Array<{ x: number; y: number; z: number; a: number; size: number; seed: number }> = [];
    const base = radius * 0.46 * cubeSize;
    for (const p of particles) {
      const wobble = loose * 0.18 * Math.sin(now * 1.7 + p.phase + smoothEnergy * 4.0);
      const px = (p.x + wobble * (p.seed - 0.5)) * expansion;
      const py = (p.y + wobble * Math.sin(p.phase)) * (1 + mid * 0.18);
      const pz = (p.z * spread + zDrift + wobble * Math.cos(p.phase)) * (1 + bass * 0.28);
      const r = rotatePoint(px, py, pz, rx, ry, rz);
      const perspective = 1.8 / (1.8 + r.z * 0.72);
      projected.push({
        x: cx + r.x * base * perspective,
        y: cy + r.y * base * perspective,
        z: r.z,
        a: clamp01(0.22 + perspective * 0.42 + smoothEnergy * 0.22 + smoothBeat * 0.2),
        size: Math.max(1.1, radius * 0.0065 * perspective * (1 + treble * 0.75 + smoothBeat * 0.45)),
        seed: p.seed,
      });
    }
    projected.sort((a, b) => a.z - b.z);

    if (glow > 0) {
      ctx.shadowColor = hsl(hue, 100, 62, 0.36 * glow);
      ctx.shadowBlur = 6 + glow * 18 + smoothBeat * 10;
    }
    for (const p of projected) {
      const light = 48 + p.a * 32 + smoothBeat * 10;
      ctx.fillStyle = hsl(hue + p.seed * 26 + treble * 30, 96, light, opacity * p.a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    if (smoothBeat > 0.05) {
      ctx.strokeStyle = hsl(hue + 16, 100, 70, opacity * smoothBeat * 0.22);
      ctx.lineWidth = Math.max(1, radius * 0.004);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (0.22 + cubeSize * 0.3 + smoothBeat * 0.05), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  },

  cleanup() {
    particles = [];
    lastResolution = 0;
    ctx = null;
    lastFrameTime = 0;
  },

  resize(width: number, height: number) {
    canvasWidth = width;
    canvasHeight = height;
  },
};