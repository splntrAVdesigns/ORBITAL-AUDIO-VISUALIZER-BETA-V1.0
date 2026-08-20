/**
 * Noise Glitch Shader
 * Core-region glitch texture with BPM flashes, scanline sweeps, color-shift bars, and static.
 * Canvas2D, allocation-light, delta-time animation.
 */

import type { ShaderPreset, AudioData, ShaderParams } from '../ShaderRegistry';

let ctx: CanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let lastTime = 0;
let phase = 0;
let glitchHold = 0;
let ledBlinkPhase = 0;

function hsl(h: number, s: number, l: number, a: number) { return `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`; }
function pingpong(v: number) { const x = ((v % 2) + 2) % 2; return x < 1 ? x : 2 - x; }

function hashSquare(x: number, y: number): number { return ((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1 + 1) % 1; }

/**
 * Static is intentionally a blinking LED square field rather than random white
 * ImageData. It keeps the imported reference's rhythmic grid character while
 * staying bounded and native to the clipped Core Texture canvas.
 */
function drawBlinkSquares(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, hue: number, intensity: number, audio: number, opacity: number, dt: number, density: number, speed: number, fill: number) {
  ledBlinkPhase += dt * (0.45 + speed * 1.35 + audio * .55);
  const cells = Math.max(10, Math.min(28, Math.round(10 + density * 18)));
  const cell = (radius * 1.66) / cells;
  const startX = cx - cell * cells * .5;
  const startY = cy - cell * cells * .5;
  const inset = cell * (1 - Math.max(.2, Math.min(.92, fill))) * .5;
  ctx.shadowColor = hsl(hue, 100, 68, .22 + audio * .28);
  ctx.shadowBlur = 4 + audio * 9;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const dx = (x + .5) / cells * 2 - 1;
      const dy = (y + .5) / cells * 2 - 1;
      const radial = Math.sqrt(dx * dx + dy * dy);
      if (radial > 1) continue;
      const seed = hashSquare(x, y);
      const blink = .5 + .5 * Math.sin(ledBlinkPhase * (1.2 + seed * 2.8) * Math.PI * 2 + seed * 19.7);
      const threshold = .46 - intensity * .18 - audio * .16;
      if (blink < threshold) continue;
      const alpha = opacity * (0.15 + blink * .62 + audio * .2) * (1 - radial * .36);
      ctx.fillStyle = hsl(hue + seed * 58 + blink * 18, 94, 50 + blink * 28, alpha);
      ctx.fillRect(startX + x * cell + inset, startY + y * cell + inset, cell - inset * 2, cell - inset * 2);
    }
  }
  ctx.shadowBlur = 0;
}

export const NoiseGlitchShader: ShaderPreset = {
  id: 'noise-glitch',
  name: 'Noise Glitch',
  description: 'Split-scan glitch bursts and CRT noise',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23000" width="100" height="100"/%3E%3Cg opacity="0.7"%3E%3Crect fill="%23fff" x="0" y="10" width="100" height="2"/%3E%3Crect fill="%23fff" x="0" y="30" width="100" height="2"/%3E%3Crect fill="%23fff" x="0" y="50" width="100" height="2"/%3E%3Crect fill="%23fff" x="0" y="70" width="100" height="2"/%3E%3Crect fill="%23fff" x="0" y="90" width="100" height="2"/%3E%3C/g%3E%3C/svg%3E',
  type: 'canvas2d',
  category: 'experimental',
  defaults: { audioIntensity: 0.72, frequencyRange: 'high', beatSync: true, scale: 1.0, speed: 0.65, opacity: 0.8, blendMode: 'screen', noiseIntensity: 0.80, glitchType: 'split', scanlineSpeed: 0.30, glitchBurst: 0.80, rgbSplitAmount: 0.45, scanlineDensity: 0.95, staticGrain: 0.42, staticBlinkSpeed: .72, staticSquareFill: .7, beatShockAmount: 1.0 },
  controls: {
    glitchType: { type: 'select', label: 'Glitch Type', options: ['split', 'LED Pixels', 'scanlines', 'color-shift'], default: 'split' },
    noiseIntensity: { type: 'slider', label: 'Noise Intensity', min: 0, max: 1, step: 0.05, default: 0.80 },
    scanlineSpeed: { type: 'slider', label: 'Scanline Speed', min: 0, max: 2, step: 0.1, default: 0.30 },
    glitchBurst: { type: 'slider', label: 'Glitch Burst', min: 0, max: 1.5, step: 0.05, default: 0.80 },
    rgbSplitAmount: { type: 'slider', label: 'RGB Split Amount', min: 0, max: 1.2, step: 0.05, default: 0.45 },
    scanlineDensity: { type: 'slider', label: 'Scanline Density', min: 0.2, max: 1.6, step: 0.05, default: 0.95 },
    staticGrain: { type: 'slider', label: 'LED Square Density', min: 0, max: 1.2, step: 0.05, default: 0.42 },
    staticBlinkSpeed: { type: 'slider', label: 'LED Blink Speed', min: 0, max: 2, step: 0.05, default: .72 },
    staticSquareFill: { type: 'slider', label: 'LED Square Fill', min: .25, max: .92, step: .05, default: .7 },
    beatShockAmount: { type: 'slider', label: 'Beat Shock Amount', min: 0, max: 1.4, step: 0.05, default: 1.0 },
  },
  init(canvas: HTMLCanvasElement | OffscreenCanvas) { ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D; canvasWidth = canvas.width; canvasHeight = canvas.height; lastTime = 0; phase = 0; glitchHold = 0; ledBlinkPhase = 0; },
  render(audioData: AudioData, params: ShaderParams, time: number) {
    if (!ctx) return;
    const now = time / 1000;
    const dt = lastTime > 0 ? Math.min(0.05, Math.max(0.001, now - lastTime)) : 1 / 60;
    lastTime = now;
    const cx = canvasWidth / 2, cy = canvasHeight / 2;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.49;
    const hue = (params as any).hue ?? 196;
    const opacity = Math.max(0, Math.min(1, params.opacity ?? 0.54));
    const intensity = Math.max(0, Math.min(1.5, params.noiseIntensity ?? 0.42));
    const selectedEnergy = params.frequencyRange === 'low' ? audioData.bass : params.frequencyRange === 'mid' ? audioData.mid : params.frequencyRange === 'high' ? audioData.treble : audioData.energy;
    const audioBoost = selectedEnergy * (params.audioIntensity ?? 0.72);
    const glitchBurst = (params as any).glitchBurst ?? 0.55;
    const rgbSplit = (params as any).rgbSplitAmount ?? 0.45;
    const scanlineDensity = (params as any).scanlineDensity ?? 0.55;
    const staticGrain = (params as any).staticGrain ?? 0.42;
    const beatShock = (params as any).beatShockAmount ?? 0.55;
    const type = params.glitchType === 'rgb-shift' ? 'color-shift' : (params.glitchType || 'split');
    phase += dt * (params.scanlineSpeed ?? 0.65) * (0.45 + audioBoost * 0.7);
    if ((params.beatSync && audioData.isBeat) || Math.random() < dt * (0.22 + audioBoost * (0.8 + glitchBurst * 1.8))) glitchHold = 0.08 + audioBoost * (0.10 + glitchBurst * 0.22); else glitchHold = Math.max(0, glitchHold - dt);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = opacity;

    if (type === 'static' || type === 'LED Pixels') {
      drawBlinkSquares(ctx, cx, cy, radius, hue, intensity, audioBoost, opacity, dt, staticGrain, (params as any).staticBlinkSpeed ?? .72, (params as any).staticSquareFill ?? .7);
    } else if (type === 'scanlines') {
      ctx.lineWidth = Math.max(2, radius * 0.012);
      const lineCount = Math.round(3 + scanlineDensity * 8);
      for (let i = 0; i < lineCount; i++) {
        const travel = pingpong(phase * (0.28 + i * 0.035) + i * 0.22);
        const y = cy + (travel * 2 - 1) * radius * 0.82;
        const len = radius * (1.25 - i * 0.08);
        ctx.strokeStyle = hsl(hue + i * 18, 95, 72, 0.20 + intensity * 0.35 + audioBoost * 0.18);
        ctx.shadowColor = hsl(hue, 100, 72, 0.3); ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(cx - len * 0.5, y); ctx.lineTo(cx + len * 0.5, y + Math.sin(now * 2 + i) * 3); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    } else if (type === 'color-shift') {
      const bars = 10;
      for (let i = 0; i < bars; i++) {
        const x = cx - radius * 0.8 + (i / (bars - 1)) * radius * 1.6 + Math.sin(phase * 2 + i) * rgbSplit * radius * 0.025;
        const w = radius * (0.015 + 0.035 * pingpong(phase * 0.85 + i * 0.23)) * (1 + rgbSplit * 0.8);
        const h = radius * (0.55 + 0.38 * pingpong(phase * 0.45 + i * 0.13));
        ctx.fillStyle = hsl(hue + i * 18 + Math.sin(phase + i) * 28, 92, 66, 0.14 + intensity * 0.22);
        ctx.fillRect(x - w / 2, cy - h / 2, w, h);
      }
    } else {
      const shardCount = Math.round(3 + intensity * 7 + audioBoost * (5 + glitchBurst * 8) + (glitchHold > 0 ? 4 + glitchBurst * 6 : 0));
      for (let i = 0; i < shardCount; i++) {
        const y = cy - radius + Math.random() * radius * 2;
        const h = 4 + Math.random() * (14 + audioBoost * 22);
        const w = radius * (0.25 + Math.random() * 1.25);
        const x = cx - w / 2 + (Math.random() - 0.5) * radius * 0.45;
        const offset = (Math.random() - 0.5) * (8 + audioBoost * (22 + glitchBurst * 28) + (glitchHold > 0 ? 18 + rgbSplit * 24 : 0));
        ctx.fillStyle = hsl(hue + (Math.random() - 0.5) * 70, 95, 62 + Math.random() * 20, 0.08 + intensity * 0.16);
        ctx.fillRect(x + offset, y, w, h);
        ctx.strokeStyle = hsl(hue + 170, 90, 76, 0.12 + audioBoost * 0.16);
        ctx.beginPath(); ctx.moveTo(x + offset, y + h * 0.5); ctx.lineTo(x + w + offset, y + h * 0.5); ctx.stroke();
      }
    }
    if (params.beatSync && audioData.isBeat) { ctx.fillStyle = hsl(hue, 95, 68, 0.06 + Math.min(0.18, audioData.beatIntensity * (0.08 + beatShock * 0.12))); ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2); }
    ctx.restore(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  },
  cleanup() { ctx = null; lastTime = 0; ledBlinkPhase = 0; },
  resize(width: number, height: number) { canvasWidth = width; canvasHeight = height; },
};