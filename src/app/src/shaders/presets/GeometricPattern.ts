/**
 * Geometric Pattern Shader
 * Animated center-forming pattern field for Core Textures.
 * Canvas2D, delta-time motion, BPM/beat pulse support.
 */

import type { ShaderPreset, AudioData, ShaderParams } from '../ShaderRegistry';

let ctx: CanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let lastTime = 0;
let rotation = 0;
let cycleProgress = 0;
let formationStartedAt = -Infinity;
let beatWasActive = false;

function hsl(h: number, s: number, l: number, a: number) {
  return `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;
}

function smooth01(v: number) {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
}

function notchPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, notch: number) {
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.42, y);
  ctx.lineTo(x + w * 0.42, y + notch);
  ctx.lineTo(x + w * 0.58, y + notch);
  ctx.lineTo(x + w * 0.58, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h * 0.42);
  ctx.lineTo(x + w - notch, y + h * 0.42);
  ctx.lineTo(x + w - notch, y + h * 0.62);
  ctx.lineTo(x + w, y + h * 0.62);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w * 0.58, y + h);
  ctx.lineTo(x + w * 0.58, y + h - notch);
  ctx.lineTo(x + w * 0.42, y + h - notch);
  ctx.lineTo(x + w * 0.42, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h * 0.62);
  ctx.lineTo(x + notch, y + h * 0.62);
  ctx.lineTo(x + notch, y + h * 0.42);
  ctx.lineTo(x, y + h * 0.42);
  ctx.closePath();
}

function drawCircuit(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, hue: number, scale: number, progress: number, audioBoost: number, lineEnergy = 0.55, patternSpread = 1.0, audioGrowth = 0.45, quality = 1) {
  const tile = radius * 0.22 * scale * (1 + audioBoost * audioGrowth * 0.18);
  const gap = tile * 0.22;
  const extent = radius * 0.9 * patternSpread;
  const rows = Math.min(7, Math.max(4, Math.floor(Math.ceil((extent * 2) / (tile + gap)) * quality)));
  const cols = rows;
  const startX = cx - ((cols - 1) * (tile + gap)) / 2 - tile / 2;
  const startY = cy - ((rows - 1) * (tile + gap)) / 2 - tile / 2;
  const visible = Math.floor(rows * cols * progress);
  let idx = 0;

  ctx.lineWidth = Math.max(1.2, radius * 0.006) * (1 + audioBoost * (0.2 + lineEnergy * 0.55));
  ctx.shadowColor = hsl(hue, 95, 68, 0.32);
  ctx.shadowBlur = 8 + audioBoost * 14;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      idx++;
      if (idx > visible) continue;
      const px = startX + x * (tile + gap);
      const py = startY + y * (tile + gap);
      const dx = px + tile / 2 - cx;
      const dy = py + tile / 2 - cy;
      if (Math.hypot(dx, dy) > radius * 0.86) continue;
      const phase = Math.sin((x * 1.7 + y * 2.1) + rotation * 2.0) * 0.5 + 0.5;
      ctx.globalAlpha = 0.38 + phase * 0.42;
      ctx.strokeStyle = hsl(hue, 82, 72, 0.78);
      ctx.beginPath();
      notchPath(ctx, px, py, tile, tile, tile * 0.28);
      ctx.stroke();
      ctx.globalAlpha *= 0.48;
      ctx.strokeStyle = hsl(hue + 42, 92, 82, 0.7);
      ctx.beginPath();
      notchPath(ctx, px + tile * 0.08, py - tile * 0.06, tile, tile, tile * 0.28);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawRoundedMaze(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, hue: number, scale: number, progress: number, audioBoost: number, lineEnergy = 0.55, patternSpread = 1.0, audioGrowth = 0.45, quality = 1) {
  const rows = quality < 0.8 ? 6 : 7;
  const cols = rows;
  const cell = radius * 0.23 * scale * patternSpread * (1 + audioBoost * audioGrowth * 0.12);
  const startX = cx - (cols - 1) * cell / 2;
  const startY = cy - (rows - 1) * cell / 2;
  const visible = Math.floor(rows * cols * progress);
  let idx = 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(5, radius * 0.026) * (1 + audioBoost * (0.12 + lineEnergy * 0.38));
  ctx.strokeStyle = hsl(hue, 22, 84, 0.76);
  ctx.shadowColor = hsl(hue, 90, 70, 0.24);
  ctx.shadowBlur = 8;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      idx++;
      if (idx > visible) continue;
      const px = startX + x * cell;
      const py = startY + y * cell;
      if (Math.hypot(px - cx, py - cy) > radius * 0.78) continue;
      const rot = ((x + y) % 4) * Math.PI / 2 + rotation * 0.15;
      const s = cell * 0.36;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.42 + 0.35 * Math.sin(rotation * 2 + x + y);
      ctx.beginPath();
      ctx.moveTo(-s, -s);
      ctx.lineTo(s * 0.35, -s);
      ctx.lineTo(s * 0.35, s * 0.2);
      ctx.lineTo(s, s * 0.2);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawRadialTunnel(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, hue: number, progress: number, audioBoost: number, lineEnergy = 0.55, patternSpread = 1.0, audioGrowth = 0.45, quality = 1) {
  const rings = Math.max(6, Math.round(9 * quality));
  const segments = Math.max(28, Math.round(40 * quality));
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, radius * 0.012) * (1 + audioBoost * (0.15 + lineEnergy * 0.5));
  ctx.shadowColor = hsl(hue, 95, 70, 0.26);
  ctx.shadowBlur = 8;
  for (let r = 1; r <= rings; r++) {
    const rr = radius * (0.08 + 0.78 * r / rings) * progress * patternSpread * (1 + audioBoost * audioGrowth * 0.15);
    const dash = Math.PI * 2 / segments;
    for (let i = 0; i < segments; i++) {
      if ((i + r) % 3 === 0) continue;
      const a0 = i * dash + rotation * (0.25 + r * 0.035);
      const a1 = a0 + dash * 0.46;
      ctx.strokeStyle = hsl(hue + r * 6, 88, 72, 0.18 + r / rings * 0.36);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, a0, a1);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}

export const GeometricPatternShader: ShaderPreset = {
  id: 'geometric-pattern',
  name: 'Geometric Pattern',
  description: 'Animated core-forming geometric pattern',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23000" width="100" height="100"/%3E%3Cpath d="M10 20h20v10h20V20h20v20H60v20h10v20H50V70H30v10H10V60h10V40H10z" fill="none" stroke="%23dfe7ff" stroke-width="2"/%3E%3C/svg%3E',
  type: 'canvas2d',
  category: 'geometric',
  defaults: { audioIntensity: 0.45, frequencyRange: 'mid', beatSync: true, scale: 1.0, speed: 0.75, opacity: 0.8, blendMode: 'screen', rotationSpeed: 0.55, pattern: 'circuit', formationDepth: 0.55, lineEnergy: 0.65, patternSpread: 1.0, audioGrowth: 0.5 },
  controls: {
    pattern: { type: 'select', label: 'Pattern Type', options: ['circuit', 'maze', 'radial-tunnel'], default: 'circuit' },
    rotationSpeed: { type: 'slider', label: 'Rotation Speed', min: 0, max: 2, step: 0.1, default: 0.55 },
    scale: { type: 'slider', label: 'Pattern Scale', min: 0.45, max: 1.6, step: 0.05, default: 1 },
    formationDepth: { type: 'slider', label: 'Formation Depth', min: 0.2, max: 1.6, step: 0.05, default: 0.55 },
    lineEnergy: { type: 'slider', label: 'Line Energy', min: 0, max: 1.4, step: 0.05, default: 0.65 },
    patternSpread: { type: 'slider', label: 'Pattern Spread', min: 0.7, max: 1.35, step: 0.05, default: 1.0 },
    audioGrowth: { type: 'slider', label: 'Audio Growth', min: 0, max: 1.4, step: 0.05, default: 0.5 },
  },
  init(canvas: HTMLCanvasElement | OffscreenCanvas) { ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D; canvasWidth = canvas.width; canvasHeight = canvas.height; lastTime = 0; rotation = 0; cycleProgress = 0; formationStartedAt = -Infinity; beatWasActive = false; },
  render(audioData: AudioData, params: ShaderParams, time: number) {
    if (!ctx) return;
    const now = time / 1000;
    const dt = lastTime > 0 ? Math.min(0.05, Math.max(0.001, now - lastTime)) : 1 / 60;
    lastTime = now;
    const cx = canvasWidth / 2, cy = canvasHeight / 2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.49;
    const hue = (params as any).hue ?? 205;
    const bpm = Math.max(1, audioData.bpm || 174);
    const formationDepth = (params as any).formationDepth ?? 0.55;
    // Anchor formation to the observed beat edge rather than a free-running
    // wall clock. The pattern completes before the next beat and avoids a
    // visibly late four-beat formation cycle.
    const isBeat = Boolean(params.beatSync && audioData.isBeat);
    if (isBeat && !beatWasActive) formationStartedAt = now;
    beatWasActive = isBeat;
    const formationDuration = (60 / bpm) * (0.56 + formationDepth * 0.14);
    const fallbackPhase = (now * bpm / 60) % 1;
    const beatProgress = Number.isFinite(formationStartedAt)
      ? Math.min(1, (now - formationStartedAt) / Math.max(0.08, formationDuration))
      : fallbackPhase;
    cycleProgress = params.beatSync
      ? smooth01(beatProgress)
      : Math.min(1, cycleProgress + dt * (0.35 + (params.speed ?? 0.75) * 0.35));
    const selectedEnergy = params.frequencyRange === 'low' ? audioData.bass : params.frequencyRange === 'high' ? audioData.treble : params.frequencyRange === 'mid' ? audioData.mid : audioData.energy;
    const audioBoost = selectedEnergy * (params.audioIntensity ?? 0.45);
    rotation += dt * (params.rotationSpeed ?? 0.55) * (0.35 + audioBoost * 0.55);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = (params.opacity ?? 0.74) * (0.9 + audioBoost * 0.2);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation); ctx.translate(-cx, -cy);
    const pattern = params.pattern || 'circuit';
    const lineEnergy = (params as any).lineEnergy ?? 0.65;
    const patternSpread = (params as any).patternSpread ?? 1.0;
    const audioGrowth = (params as any).audioGrowth ?? 0.5;
    const quality = Math.max(0.6, Math.min(1, Number((params as any).renderQuality ?? 1)));
    if (pattern === 'maze') drawRoundedMaze(ctx, cx, cy, radius, hue, params.scale ?? 1, cycleProgress, audioBoost, lineEnergy, patternSpread, audioGrowth, quality);
    else if (pattern === 'radial-tunnel') drawRadialTunnel(ctx, cx, cy, radius, hue, cycleProgress, audioBoost, lineEnergy, patternSpread, audioGrowth, quality);
    else drawCircuit(ctx, cx, cy, radius, hue, params.scale ?? 1, cycleProgress, audioBoost, lineEnergy, patternSpread, audioGrowth, quality);
    ctx.restore(); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  },
  cleanup() { ctx = null; lastTime = 0; cycleProgress = 0; formationStartedAt = -Infinity; beatWasActive = false; },
  resize(width: number, height: number) { canvasWidth = width; canvasHeight = height; },
};