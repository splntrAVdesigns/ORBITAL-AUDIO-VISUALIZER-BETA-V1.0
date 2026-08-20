/**
 * Digital Matrix Shader
 * Core-region digital rain tuned for ORBITAL.
 * Canvas2D, delta-time motion, lower mutation rate, balanced columns.
 */

import type { ShaderPreset, AudioData, ShaderParams } from '../ShaderRegistry';

function getMatrixChar() {
  const ranges = [
    [0x3041, 0x30ff],
    [0x30, 0x39],
    [0x41, 0x5a],
  ];
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  return String.fromCharCode(Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0]);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

class MatrixColumn {
  x: number;
  y: number;
  speed: number;
  fontSize: number;
  length: number;
  chars: string[];
  maxY: number;
  baseOpacity: number;
  mutationTimer = 0;
  readonly activationDelay: number;

  constructor(x: number, topY: number, bottomY: number, fontSize: number) {
    this.x = x;
    this.maxY = bottomY + fontSize * 8;
    this.fontSize = fontSize;
    this.speed = 52 + Math.random() * 58;
    this.length = 8 + Math.floor(Math.random() * 8);
    // One visible column at activation, then a relaxed stagger rather than a first-frame wall.
    this.activationDelay = Math.random() * 0.18;
    this.y = topY - this.length * fontSize - Math.random() * 160;
    this.baseOpacity = 0.52 + Math.random() * 0.28;
    this.chars = Array.from({ length: this.length }, getMatrixChar);
  }

  reset(topY: number, bottomY: number) {
    this.y = topY - Math.random() * 160;
    this.maxY = bottomY + this.fontSize * 8;
    this.chars = Array.from({ length: this.length }, getMatrixChar);
  }

  update(dt: number, topY: number, bottomY: number, speed: number, audioBoost: number, cycleRate: number) {
    this.y += this.speed * (0.65 + speed * 0.65) * (1 + audioBoost * 0.85) * dt;

    this.mutationTimer += dt;
    const mutateEvery = (0.045 + Math.random() * 0.055) / Math.max(0.4, cycleRate);
    if (this.mutationTimer > mutateEvery) {
      this.mutationTimer = 0;
      const count = Math.max(1, Math.floor(this.length * 0.34));
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * this.chars.length);
        this.chars[idx] = getMatrixChar();
      }
    }

    if (this.y - this.length * this.fontSize > this.maxY) {
      this.reset(topY, bottomY);
    }
  }

  draw(ctx: CanvasRenderingContext2D, hue: number, glow: number, opacity: number, flickerAmount: number, zDepthPulse: number, audioBoost: number) {
    ctx.font = `700 ${this.fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < this.chars.length; i++) {
      const y = this.y - i * this.fontSize * 0.92;
      const t = 1 - i / this.chars.length;
      const [r, g, b] = hslToRgb(hue + i * 2.5, 92, 42 + t * 36);
      const flicker = 1 - flickerAmount * 0.32 + Math.random() * (0.18 + flickerAmount * 0.62);
      const depthLift = 1 + zDepthPulse * audioBoost * Math.pow(t, 0.7);
      const alpha = Math.min(1, opacity * this.baseOpacity * Math.pow(t, 1.05) * flicker * depthLift);

      if (i === 0) {
        ctx.shadowColor = `rgba(${r},${g},${b},${0.55 * glow})`;
        ctx.shadowBlur = 12 + 26 * glow;
        ctx.fillStyle = `rgba(235,255,255,${Math.min(1, alpha * 1.8)})`;
      } else {
        ctx.shadowBlur = 6 + 16 * glow;
        ctx.shadowColor = `rgba(${r},${g},${b},${0.34 * glow})`;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      }
      ctx.fillText(this.chars[i], this.x, y);
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
}

let ctx: CanvasRenderingContext2D | null = null;
let columns: MatrixColumn[] = [];
let canvasWidth = 0;
let canvasHeight = 0;
let lastTime = 0;
let activationElapsed = 0;

export const DigitalMatrixShader: ShaderPreset = {
  id: 'digital-matrix',
  name: 'Digital Matrix',
  description: 'Falling digital rain with balanced core-region columns',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23000" width="100" height="100"/%3E%3Ctext fill="%2300ff00" font-family="monospace" font-size="8"%3E%3Ctspan x="10" y="20"%3E01%3C/tspan%3E%3Ctspan x="30" y="40"%3E10%3C/tspan%3E%3Ctspan x="50" y="60"%3E11%3C/tspan%3E%3Ctspan x="70" y="80"%3E01%3C/tspan%3E%3C/text%3E%3C/svg%3E',
  type: 'canvas2d',
  category: 'classic',

  defaults: {
    audioIntensity: 0.65,
    frequencyRange: 'mid',
    beatSync: true,
    scale: 1.0,
    speed: 1.1,
    opacity: 0.72,
    blendMode: 'screen',
    density: 16,
    glowIntensity: 0.62,
    filterEffect: 'Normal',
    filterIntensity: 1.0,
    symbolCycleRate: 0.9,
    flickerAmount: 0.42,
    columnSpread: 0.78,
    zDepthPulse: 0.24,
  },

  controls: {
    density: { type: 'slider', label: 'Column Density', min: 8, max: 48, step: 1, default: 16 },
    speed: { type: 'slider', label: 'Fall Speed', min: 0.35, max: 2.2, step: 0.05, default: 1.1 },
    glowIntensity: { type: 'slider', label: 'Glow Intensity', min: 0, max: 1, step: 0.05, default: 0.62 },
    filterEffect: { type: 'dropdown', label: 'Filter Effect', options: ['Normal', 'Vibrant', 'Neon Glow', 'Sharp', 'Faded', 'Inverted', 'Monochrome'], default: 'Normal' },
    filterIntensity: { type: 'slider', label: 'Filter Intensity', min: 0, max: 1, step: 0.05, default: 1.0 },
    symbolCycleRate: { type: 'slider', label: 'Symbol Cycle Rate', min: 0.4, max: 3.0, step: 0.05, default: 1.25 },
    flickerAmount: { type: 'slider', label: 'Flicker Amount', min: 0, max: 1, step: 0.05, default: 0.65 },
    columnSpread: { type: 'slider', label: 'Column Spread', min: 0.55, max: 1.15, step: 0.05, default: 0.84 },
    zDepthPulse: { type: 'slider', label: 'Z Depth Pulse', min: 0, max: 1, step: 0.05, default: 0.35 },
  },

  init(canvas: HTMLCanvasElement | OffscreenCanvas) {
    ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    columns = [];
    lastTime = 0;
    activationElapsed = 0;
  },

  render(audioData: AudioData, params: ShaderParams, time: number) {
    if (!ctx) return;

    const now = time / 1000;
    const dt = lastTime > 0 ? Math.min(0.05, Math.max(0.001, now - lastTime)) : 1 / 60;
    lastTime = now;
    activationElapsed += dt;

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.49;
    const topY = cy - radius * 0.92;
    const bottomY = cy + radius * 0.92;
    const hue = (params as any).hue ?? 188;
    const opacity = Math.max(0, Math.min(1, params.opacity ?? 0.9));
    const glow = Math.max(0, Math.min(1, params.glowIntensity ?? 0.55));

    let energy = audioData.energy;
    switch (params.frequencyRange) {
      case 'low': energy = audioData.bass || energy; break;
      case 'mid': energy = audioData.mid || energy; break;
      case 'high': energy = audioData.treble || energy; break;
    }
    const audioBoost = energy * (params.audioIntensity ?? 0.65);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Slight transparent wash keeps trails smooth without filling the whole core.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    const density = Math.max(8, Math.min(32, params.density ?? 16));
    const targetCount = Math.round(density);
    const columnSpread = Math.max(0.55, Math.min(1.15, (params as any).columnSpread ?? 0.84));
    const spacing = (radius * 2.0 * columnSpread) / Math.max(1, targetCount - 1);
    const startX = cx - radius * columnSpread;

    while (columns.length < targetCount) {
      const i = columns.length;
      const x = startX + i * spacing + (Math.random() - 0.5) * spacing * 0.28;
      const fontSize = 13 + Math.random() * 7;
      columns.push(new MatrixColumn(x, topY, bottomY, fontSize));
    }
    while (columns.length > targetCount) columns.pop();

    ctx.globalCompositeOperation = 'screen';
    columns.forEach((col) => {
      // Stagger column activation to avoid a one-frame text/shadow burst on enable.
      const stagger = columns.indexOf(col) * 0.115 + col.activationDelay;
      if (activationElapsed < stagger) return;
      col.update(dt, topY, bottomY, params.speed ?? 1.1, audioBoost, (params as any).symbolCycleRate ?? 0.9);
      col.draw(ctx!, hue, glow, opacity, (params as any).flickerAmount ?? 0.42, (params as any).zDepthPulse ?? 0.24, audioBoost);
    });

    if (params.beatSync && audioData.isBeat) {
      const [r, g, b] = hslToRgb(hue, 100, 62);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${r},${g},${b},${0.08 + Math.min(0.12, audioData.beatIntensity * 0.12)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  },

  reset() {
    activationElapsed = 0;
    lastTime = 0;
    for (const column of columns) column.reset(-canvasHeight * 0.5, canvasHeight * 0.5);
  },

  cleanup() {
    columns = [];
    ctx = null;
    lastTime = 0;
    activationElapsed = 0;
  },

  resize(width: number, height: number) {
    canvasWidth = width;
    canvasHeight = height;
  },
};