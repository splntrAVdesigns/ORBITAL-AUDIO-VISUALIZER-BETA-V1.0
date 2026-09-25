/**
 * ORBITAL - Liquid Metal Shaper
 * Audio-Reactive Sacred Geometry Engine
 * 
 * Generates mathematically precise sacred geometry patterns
 * with audio reactivity, morphing, and advanced visual effects.
 * 
 * NEW: WebGL-based Liquid Metal shader system for high-performance 60 FPS rendering
 * - GPU-accelerated metaball-style liquid transitions
 * - Continuous noise-based rotation and field modulation
 * - Automated texture cleanup for long-running sessions
 */

import { getWebGLAstralRenderer } from '../engine/WebGLAstralRenderer';
import { createAstralCanvas } from './astralShaper/canvas';
import { hslToHex } from './astralShaper/color';
import { clearLegacyShapeCache } from './astralShaper/legacyShapeCache';
import { drawShapeByType } from './astralShaper/shapes/drawShapeByType';
import type { AstralShaperParams, AudioAnalysisData, ShapeType, StrokeStyle } from './astralShaper/types';

// Sprint C: shape generators, catalog, types and helpers live in ./astralShaper/.
// This file keeps the render core (texture cache + drawAstralShaper) and
// re-exports the full public API, so every existing import path is unchanged.
export { getMorphFamily, getNextShapeInFamily, CURATED_LIQUID_SHAPER_SHAPES, getActiveCycleShapes, getCycleDuration, getAllShapes, getNextShape, getShapeDisplayName, syncLiquidShapeSelect } from './astralShaper/catalog';
export { clearShapeSampleCache } from './astralShaper/legacyMorphPath';
export { clearStaleCache } from './astralShaper/legacyShapeCache';
export type { ShapeType, StrokeStyle, MorphMode, MorphOrigin, AutoCycleSpeed, AstralShaperParams, AudioAnalysisData } from './astralShaper/types';

// ============================================================================
// PHASE 3: OPTIMIZED RENDERING WITH CACHING
// ============================================================================

/**
 * MAIN RENDER FUNCTION (PHASE 3: OPTIMIZED WITH CACHING)
 */
const texCache = new Map<string, any>();
const LIQUID_TEXTURE_SIZE = 1024;
const MAX_LIQUID_TEXTURE_CACHE_ENTRIES = 12;

function releaseTextureCanvas(canvas: any): void {
  // Dropping the backing store is essential: deleting from a Map alone leaves a
  // large Canvas allocation eligible for collection only at the browser's discretion.
  canvas.width = 1;
  canvas.height = 1;
}

function evictTextureCacheTo(limit: number): void {
  while (texCache.size > limit) {
    const oldestKey = texCache.keys().next().value as string | undefined;
    if (!oldestKey) return;
    const canvas = texCache.get(oldestKey);
    texCache.delete(oldestKey);
    if (canvas) releaseTextureCanvas(canvas);
  }
}

export function getLiquidShaperCacheDiagnostics(): { entries: number; estimatedBytes: number; textureSize: number } {
  return {
    entries: texCache.size,
    estimatedBytes: texCache.size * LIQUID_TEXTURE_SIZE * LIQUID_TEXTURE_SIZE * 4,
    textureSize: LIQUID_TEXTURE_SIZE,
  };
}

// 🔧 FIX RAINBOW SPECTRUM: Pre-allocated offscreen canvas for masked gradient compositing.
//    Re-used every frame — zero allocation at 60fps.
let _rainbowCanvas: any = null;
let _rainbowCtx: CanvasRenderingContext2D | null = null;
let _rainbowCanvasSize = 0;

// Zero-audio fade gate: tracks silence start time and smoothly damps globalAlpha
// after 300ms of liquidRms < 0.01. Recovers quickly when audio returns.
let _noAudioStartMs: number | null = null;
let _shaperAlphaGate = 1.0;

// Velocity-based rotation integration: rotationMultiplier is applied to the
// per-frame DELTA rather than the accumulated absolute angle. Changing the
// multiplier mid-play no longer causes discontinuous snap-backs.
let _astralPrevGlobalRotation: number | null = null;
let _astralIntegratedAngle = 0;

// Per-frame hslToHex cache: the input string is often identical across consecutive
// frames when iridize/palette are stable. Avoids repeated floating-point hue2rgb math.
let _hslHexCacheInput = '';
let _hslHexCacheOutput = '';

// Persistent OffscreenCanvas for isolated Liquid Shaper compositing.
// All jitter layers, glow, and rainbow compositing happen here; a single
// drawImage blits the result to the main canvas, reducing state churn.
let _shaperCompCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let _shaperCompCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
const _SHAPER_COMP_SIZE = 1024;

/**
 * Clear texture cache (call when stroke style or other visual params change)
 */
export function clearTextureCache(): void {
  for (const canvas of texCache.values()) releaseTextureCanvas(canvas);
  texCache.clear();
}

/** Releases persistent Liquid Shaper backing stores when a visualizer session ends. */
export function disposeLiquidShaperCanvasCaches(): void {
  clearTextureCache();
  if (_rainbowCanvas) {
    _rainbowCanvas.width = 1;
    _rainbowCanvas.height = 1;
  }
  _rainbowCanvas = null;
  _rainbowCtx = null;
  _rainbowCanvasSize = 0;
  if (_shaperCompCanvas) {
    _shaperCompCanvas.width = 1;
    _shaperCompCanvas.height = 1;
  }
  _shaperCompCanvas = null;
  _shaperCompCtx = null;
  _noAudioStartMs = null;
  _shaperAlphaGate = 1;
  _astralPrevGlobalRotation = null;
  _astralIntegratedAngle = 0;
}

function generateShapeTexture(
  shape: ShapeType, 
  complexity: number, 
  kaleidoscope: boolean,
  symmetryFold: number,
  lineThickness: number = 1.0,
  strokeStyle: StrokeStyle = 'solid'
): any {
  // Include line thickness and stroke style in cache key for proper invalidation
  const key = `${shape}_${complexity}_${kaleidoscope}_${symmetryFold}_${lineThickness.toFixed(1)}_${strokeStyle}_liquid_v7_adaptive_edges`;
  const cached = texCache.get(key);
  if (cached) {
    // Map insertion order is our LRU order; touching a texture keeps actively used
    // morph endpoints resident without allowing control sweeps to grow unbounded.
    texCache.delete(key);
    texCache.set(key, cached);
    return cached;
  }

  // 1024px matches the compositor/output layer and bounds per-texture backing
  // storage to 4 MiB rather than 16 MiB at 2048px.
  const size = LIQUID_TEXTURE_SIZE;
  const cx = size/2;
  const cy = size/2;
  const r = size * 0.35; 
  
  const canvas = createAstralCanvas();
  canvas.width = size;
  canvas.height = size;
  // ENHANCED: Enable imageSmoothingEnabled for better anti-aliasing
  const ctx = canvas.getContext('2d', { 
    alpha: true,
    willReadFrequently: false // GPU acceleration hint
  })!;
  
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.strokeStyle = '#ffffff';
  
  // Keep high settings expressive without allowing dense geometry to fill solid.
  // The prior 3.6× multiplier created ~14px source strokes at the slider maximum;
  // this curve preserves crisp low values and caps the visual mass at high values.
  const segmentDensity = complexity * (kaleidoscope ? Math.max(1, symmetryFold * 0.5) : 1);
  const thicknessDampen = segmentDensity > 8 ? 1 / Math.sqrt(segmentDensity / 8) : 1;
  const normalizedThickness = Math.max(0.5, Math.min(4, lineThickness));
  const sharpStroke = 0.92 + normalizedThickness * 1.02;
  ctx.lineWidth = Math.max(1.0, Math.min(4.8, sharpStroke * thicknessDampen));
  
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // FIX: Apply stroke style parameter
  // Note: 'glowing' now handled by final composite (shadowBlur + lighter mode)
  // Pattern scaling based on line thickness for consistent appearance
  const dashLength = Math.max(8, lineThickness * 8);
  const dotGap = Math.max(6, lineThickness * 6);
  
  switch (strokeStyle) {
    case 'dashed':
      ctx.setLineDash([dashLength, dashLength * 0.8]);
      ctx.shadowBlur = 3 + normalizedThickness * 0.8;
      ctx.shadowColor = '#ffffff';
      break;
    case 'dotted':
      ctx.setLineDash([lineThickness * 1.5, dotGap]);
      ctx.shadowBlur = 3 + normalizedThickness * 0.8;
      ctx.shadowColor = '#ffffff';
      break;
    case 'glowing':
      // Glow remains visible, but its source blur stays bounded so it does not
      // turn wide lines into a filled mass.
      ctx.setLineDash([]);
      ctx.shadowBlur = Math.min(16, 7 + normalizedThickness * 2.2);
      ctx.shadowColor = '#ffffff';
      break;
    case 'solid':
    default:
      ctx.setLineDash([]);
      ctx.shadowBlur = Math.min(5.5, 1.0 + normalizedThickness * 0.9);
      ctx.shadowColor = '#ffffff';
      break;
  }

  // FIX: Apply symmetry fold in texture ONLY if NOT using kaleidoscope mode
  // Kaleidoscope applies symmetry fold as post-processing for better mirror effects
  if (symmetryFold > 1 && !kaleidoscope) {
    for (let i = 0; i < symmetryFold; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((i / symmetryFold) * Math.PI * 2);
        ctx.translate(-cx, -cy);
        drawShapeByType(ctx, cx, cy, r, 0, shape, complexity);
        ctx.restore();
    }
  } else {
    drawShapeByType(ctx, cx, cy, r, 0, shape, complexity);
  }
  
  texCache.set(key, canvas);
  
  // Keep a strict, byte-bounded LRU cache. At 1024² this caps texture
  // backing stores at roughly 48 MiB before browser overhead.
  evictTextureCacheTo(MAX_LIQUID_TEXTURE_CACHE_ENTRIES);
  
  return canvas;
}

export function drawAstralShaper(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  params: AstralShaperParams,
  audioData: AudioAnalysisData,
  globalRotation: number,
  colors: string[],
  timeSec: number
): void {
  if (!params.enabled) return;
  
  const renderer = getWebGLAstralRenderer();
  
  // FIX: Pass line thickness and stroke style to texture generation
  const texA = generateShapeTexture(params.shape, params.complexity, params.kaleidoscope, params.symmetryFold, params.lineThickness, params.strokeStyle);
  const texB = generateShapeTexture(params.nextShape, params.complexity, params.kaleidoscope, params.symmetryFold, params.lineThickness, params.strokeStyle);
  
  // Calculate audio-reactive modulation
  const energyMod = params.audioInfluence * audioData.rms;
  const beatPulseMod = audioData.beatPulse * params.audioInfluence;

  // 🔧 FIX AUDIO INFLUENCE / PULSE DEPTH: Previous multipliers (0.5, 0.4) were too
  //    conservative — at full slider value the shape barely moved. Raised to 1.4 / 0.9
  //    so the shape visibly pulses and breathes with the music at mid-slider values.
  //    audioInfluence: controls HOW MUCH the RMS energy drives the pulse
  //    pulseDepth:     controls the SCALE of the breathing effect (size modulation)
  let breathe = params.pulseDepth > 0
    ? 1.0 + (energyMod * params.pulseDepth * 1.4) + (beatPulseMod * params.pulseDepth * 0.9)
    : 1.0;
  const effectiveScale = 0.6 + (params.scale * 0.75);
  const baseRadius = Math.min(params.maxSize, 200) * breathe * effectiveScale;
  
  let depthMultiplier = 1.0;
  let globalAlpha = 0.8;

  // ZERO-AUDIO FADE: Smoothly damp globalAlpha toward 0 when liquidRms < 0.01
  // for >300ms. Quick ramp-back (~20 frames) when audio returns. No hard cuts.
  const nowMs = performance.now();
  if (audioData.rms < 0.01) {
    if (_noAudioStartMs === null) _noAudioStartMs = nowMs;
    if (nowMs - _noAudioStartMs > 300) {
      _shaperAlphaGate = Math.max(0, _shaperAlphaGate - 0.016); // ~60 frames to fully fade at 60fps
    }
  } else {
    _noAudioStartMs = null;
    _shaperAlphaGate = Math.min(1, _shaperAlphaGate + 0.05); // ~20 frames recovery
  }
  globalAlpha *= _shaperAlphaGate;

  // Rotation tuning: multiplier remains a clean scale control; Speed Mod adds a
  // subtle BPM/audio-assisted phase so the toggle has an obvious purpose without
  // fighting the main rotation sync system.
  const rotationMod = params.rotationSpeedMod
    ? (Math.sin(timeSec * 0.65 + energyMod * 2.4) * 0.22 + Math.sin(timeSec * 1.15) * 0.08)
        * (0.35 + params.audioInfluence * 0.9 + params.pulseDepth * 0.45)
    : 0;
  // Accumulate angle by multiplying only the per-frame delta, not the total.
  // Old: `angle * multiplier` caused instant jumps when multiplier changed mid-play.
  let _delta = _astralPrevGlobalRotation !== null ? globalRotation - _astralPrevGlobalRotation : 0;
  // Correct for wrapAngle ±π boundary crossings so delta stays in (-π, π].
  if (_delta > Math.PI) _delta -= Math.PI * 2;
  if (_delta < -Math.PI) _delta += Math.PI * 2;
  _astralPrevGlobalRotation = globalRotation;
  _astralIntegratedAngle += _delta * params.rotationMultiplier;
  const baseRotation = _astralIntegratedAngle + rotationMod;
  
  // ROTATION JITTER: the two echo layers ping-pong clockwise/counter-clockwise
  // while the primary shape remains the stable top layer. Faster opposing periods
  // make the swaying readable in a live session rather than looking like static echoes.
  const jScale = params.rotationJitter * 0.65;
  const jOsc1 = jScale > 0 ? Math.sin(timeSec * 0.78) * jScale : 0;
  const jOsc2 = jScale > 0 ? Math.sin(timeSec * 0.52 + Math.PI) * jScale * 0.68 : 0;

  if (params.depthEffect) {
    const depthPhase = Math.sin(baseRotation) * 0.5 + 0.5; // 0-1 range
    globalAlpha *= 0.5 + depthPhase * 0.5; 
    depthMultiplier = 0.8 + depthPhase * 0.4; 
  }
  
  const finalRadius = baseRadius * depthMultiplier;
  const scale = finalRadius / 400.0; // Our texture has r=400 internally
  
  let strokeColor = params.useGlobalColor ? colors[0] : params.customColor;
  
  // Convert HSL to hex for WebGL shader compatibility — cached per unique string.
  if (strokeColor.startsWith('hsl')) {
    if (strokeColor !== _hslHexCacheInput) {
      _hslHexCacheOutput = hslToHex(strokeColor);
      _hslHexCacheInput = strokeColor;
    }
    strokeColor = _hslHexCacheOutput;
  }
  
  // Smooth Ease-in-out for the Morph Amount
  let t = params.morphAmount;
  let easedMorphAmount = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // 🔧 FIX MORPH GUARD: Removed the `params.nextShape === params.shape` zero-clamp.
  //    The engine now always provides a nextShape different from shape (FIX MORPH-B),
  //    so this guard was incorrectly zeroing morphs in manual mode where nextShape
  //    happened to match. Only zero out truly negligible values (< 0.005).
  if (easedMorphAmount < 0.005) {
    easedMorphAmount = 0;
  }

  // ENHANCED: Energy glow modulated by audio for reactive intensity
  const glowIntensity = params.energyGlow * (1.0 + energyMod * 0.3);
  
  // CPU OFFLOAD: Isolate all compositing onto a persistent OffscreenCanvas.
  // Jitter layers, glow, and rainbow all render here; one drawImage blits to main canvas,
  // eliminating repeated globalAlpha / shadowBlur / compositeOperation state changes on ctx.
  if (!_shaperCompCtx) {
    if (typeof OffscreenCanvas !== 'undefined') {
      _shaperCompCanvas = new OffscreenCanvas(_SHAPER_COMP_SIZE, _SHAPER_COMP_SIZE);
    } else {
      const c = createAstralCanvas();
      c.width = _SHAPER_COMP_SIZE;
      c.height = _SHAPER_COMP_SIZE;
      _shaperCompCanvas = c;
    }
    _shaperCompCtx = (_shaperCompCanvas as any).getContext('2d', { willReadFrequently: false });
  }
  const compCtx = _shaperCompCtx!;
  compCtx.clearRect(0, 0, _SHAPER_COMP_SIZE, _SHAPER_COMP_SIZE);

  // Render WebGL shader ONCE at baseRotation.
  // Ghost jitter layers are 2D-rotated copies — no re-render needed per layer.
  // Eliminates 2× redundant GPU pipeline flushes when jitter is active.
  const webglSize = 1024;
  const prerenderedCanvas = renderer.render(
    texA, texB, easedMorphAmount, baseRotation, scale, timeSec, energyMod,
    params.fieldModulation, strokeColor, params.pulseDepth, glowIntensity
  );

  // Private WebGL context loss is contained to the Liquid Shaper. Keep the
  // session/audio running by using the current shape texture as a tinted 2D fallback
  // until the renderer rebuilds on a restored context.
  const drawLiquidSource = () => {
    if (prerenderedCanvas) {
      compCtx.drawImage(prerenderedCanvas, -webglSize / 2, -webglSize / 2, webglSize, webglSize);
      return;
    }
    compCtx.drawImage(texA, -webglSize / 2, -webglSize / 2, webglSize, webglSize);
    compCtx.globalCompositeOperation = 'source-in';
    compCtx.fillStyle = strokeColor;
    compCtx.fillRect(-webglSize / 2, -webglSize / 2, webglSize, webglSize);
    compCtx.globalCompositeOperation = 'source-over';
  };

  // Composite one pre-rendered layer at a 2D rotation offset and alpha.
  // rotOffset is a small angular delta applied cheaply in 2D — no GPU re-bake.
  const renderLayer = (rotOffset: number, alphaMultiplier: number) => {
    const layerAlpha = globalAlpha * alphaMultiplier;
    compCtx.globalAlpha = layerAlpha;

    if (glowIntensity > 0.01 || params.strokeStyle === 'glowing') {
      compCtx.globalCompositeOperation = "lighter";
      const effectiveGlow = params.strokeStyle === 'glowing' ? Math.max(glowIntensity, 0.5) : glowIntensity;
      compCtx.shadowBlur = effectiveGlow * 60 * alphaMultiplier;
      compCtx.shadowColor = strokeColor;
    }

    compCtx.save();
    if (rotOffset !== 0) compCtx.rotate(rotOffset);

    if (params.kaleidoscope && params.symmetryFold > 1) {
      for (let i = 0; i < params.symmetryFold; i++) {
        compCtx.save();
        compCtx.rotate((i / params.symmetryFold) * Math.PI * 2);
        if (i % 2 === 1) compCtx.scale(-1, 1);
        drawLiquidSource();
        compCtx.restore();
      }
    } else {
      drawLiquidSource();
    }

    compCtx.restore();
    compCtx.globalCompositeOperation = "source-over";
    compCtx.shadowBlur = 0;
  };

  compCtx.save();
  compCtx.translate(_SHAPER_COMP_SIZE / 2, _SHAPER_COMP_SIZE / 2);

  // ROTATION JITTER: echo layers sway in opposing ping-pong arcs; the primary
  // shape is rendered last at its original rotation so it remains visually anchored.
  if (params.rotationJitter > 0) {
    renderLayer(jOsc1, 0.18);
    renderLayer(jOsc2, 0.32);
  }
  renderLayer(0, 1.0);
  
  // 🔧 FIX RAINBOW SPECTRUM v2: Offscreen canvas + destination-in masking.
  //
  //    Root cause of the bleed: 'multiply' blend mode darkens ALL pixels below the
  //    fill rect, including the spike ring which is already drawn on the same canvas
  //    (spikes render at ~line 8333, liquid shaper at ~line 9234 — spikes are below).
  //    The circular clip prevented overflow but didn't stop multiply from tinting spikes
  //    that happened to fall inside the clip radius.
  //
  //    Fix (2-step offscreen mask):
  //    Step 1 — Draw the radial gradient onto an offscreen canvas the same size as
  //              the liquid shape's display area.
  //    Step 2 — Use 'destination-in' to mask the gradient to the webglCanvas pixels
  //              (the liquid shape). destination-in keeps only pixels where BOTH the
  //              destination (gradient) AND source (shape) have alpha — so the gradient
  //              is perfectly cut to the shape boundary.
  //    Step 3 — Draw the masked gradient onto the main canvas with 'source-over'.
  //              Because it's been pre-masked, only shape pixels receive color — the
  //              spike ring and all other layers are completely untouched.
  if (params.rainbowSpectrum && colors.length > 1) {
    const displaySize = 1024; // matches webglSize used in renderLayer
    const halfSize = displaySize / 2;

    // Resize offscreen canvas only when needed (zero cost at steady state)
    if (!_rainbowCanvas || _rainbowCanvasSize !== displaySize) {
      if (!_rainbowCanvas) _rainbowCanvas = createAstralCanvas();
      _rainbowCanvas.width  = displaySize;
      _rainbowCanvas.height = displaySize;
      _rainbowCtx = _rainbowCanvas.getContext('2d', { willReadFrequently: false })!;
      _rainbowCanvasSize = displaySize;
    }

    const rc = _rainbowCtx!;

    // FIX 8: Scale gradient to actual rendered shape radius.
    // Old: cycleRadius = halfSize * 0.32 = fixed 163px regardless of shape size.
    // Small shapes (r~80px): only 1 cycle visible → 1-2 colors max.
    // Large shapes (r~300px): all cycles far outside shape → outer color dominates.
    // Fix: shapeDisplayRadius from finalRadius (same scale used to drawImage the shape).
    // 3 cycles packed within the actual shape radius → full spectrum at every size.
    rc.clearRect(0, 0, displaySize, displaySize);
    const shapeDisplayRadius = Math.max(60, Math.min(finalRadius * 0.64, halfSize * 0.92));
    const cycleRadius = shapeDisplayRadius / 3.0;
    const numCycles = 3;
    
    for (let c = 0; c < numCycles; c++) {
      const innerR = c * cycleRadius;
      const outerR = (c + 1) * cycleRadius;
      const gradient = rc.createRadialGradient(halfSize, halfSize, innerR, halfSize, halfSize, outerR);
      // Full spectrum per cycle: each ring hits all colors
      colors.forEach((color, i) => {
        gradient.addColorStop(i / (colors.length - 1), color);
      });
      rc.globalCompositeOperation = 'source-over';
      rc.globalAlpha = c === 0 ? 1.0 : 0.85; // outer cycles slightly softer for natural blend
      rc.fillStyle = gradient;
      rc.fillRect(0, 0, displaySize, displaySize);
    }

    // Step 2: Use destination-in to mask the gradient to the last rendered webglCanvas.
    //    The webglCanvas from the last renderLayer call has the shape's alpha mask.
    //    destination-in: result = gradient * shape_alpha → gradient only where shape exists.
    const lastWebglCanvas = prerenderedCanvas ?? texA;
    if (lastWebglCanvas) {
      rc.globalCompositeOperation = 'destination-in';
      rc.drawImage(lastWebglCanvas, 0, 0, displaySize, displaySize);
    } else {
      // Fallback: clip to circle if webglCanvas unavailable
      rc.globalCompositeOperation = 'destination-in';
      rc.beginPath();
      rc.arc(halfSize, halfSize, halfSize * 0.85, 0, Math.PI * 2);
      rc.fillStyle = '#fff';
      rc.fill();
    }

    // Step 3: Draw masked gradient onto compositing canvas — no bleed possible
    rc.globalCompositeOperation = 'source-over'; // reset for next frame
    compCtx.globalCompositeOperation = 'source-over';
    compCtx.globalAlpha = 0.75; // semi-transparent so shape details show through
    compCtx.drawImage(_rainbowCanvas, -halfSize, -halfSize, displaySize, displaySize);
  }

  compCtx.restore();

  // Single blit: copy the fully composited Liquid Shaper onto the main canvas
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.globalAlpha = 1.0;
  ctx.drawImage(_shaperCompCanvas!, -_SHAPER_COMP_SIZE / 2, -_SHAPER_COMP_SIZE / 2);
  ctx.restore();
}

/**
 * Force clear entire cache (for major parameter changes)
 */
export function clearCache(): void {
  clearLegacyShapeCache();
  clearTextureCache();
}
