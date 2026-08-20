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

interface Vec2 {
  x: number;
  y: number;
}

interface FieldModulationParams {
  strength: number;
  timeSpeed: number;
  angularFreq: number;
  audioInfluence: number;
}

const sampledShapeCache = new Map<string, Vec2[]>();

export function clearShapeSampleCache(): void {
  sampledShapeCache.clear();
}

function getCachedSampledShape(
  shape: ShapeType,
  complexity: number,
  sampleCount: number,
  symmetryFold: number,
  sampler: () => Vec2[],
): Vec2[] {
  const cacheKey = `${shape}:${complexity}:${sampleCount}:${symmetryFold}`;
  const cached = sampledShapeCache.get(cacheKey);
  if (cached) return cached;

  const sampled = sampler();
  if (sampled.length === 0) return [];

  const normalized = Array.from({ length: sampleCount }, (_, index) => {
    const point = sampled[Math.floor(index * sampled.length / sampleCount)] ?? sampled[0];
    return { x: point.x, y: point.y };
  });
  sampledShapeCache.set(cacheKey, normalized);
  return normalized;
}

function interpolateShapes(from: Vec2[], to: Vec2[], amount: number, origin: MorphOrigin): Vec2[] {
  const count = Math.min(from.length, to.length);
  const clampedAmount = Math.max(0, Math.min(1, amount));

  return Array.from({ length: count }, (_, index) => {
    const a = from[index];
    const b = to[index];
    let localAmount = clampedAmount;

    if (origin === 'center') {
      const radialProgress = Math.min(1, Math.hypot(a.x, a.y));
      localAmount = Math.max(0, Math.min(1, clampedAmount * 1.5 - radialProgress * 0.5));
    } else if (origin === 'polarity') {
      const polarityProgress = (a.x + 1) * 0.5;
      localAmount = Math.max(0, Math.min(1, clampedAmount * 1.5 - polarityProgress * 0.5));
    }

    return {
      x: a.x + (b.x - a.x) * localAmount,
      y: a.y + (b.y - a.y) * localAmount,
    };
  });
}

function applyFieldModulation(
  points: Vec2[],
  morphAmount: number,
  audioMid: number,
  timeSec: number,
  params: FieldModulationParams,
): Vec2[] {
  const audioScale = 1 + Math.max(0, audioMid) * params.audioInfluence;
  const strength = params.strength * audioScale * (0.75 + morphAmount * 0.25);

  return points.map((point, index) => {
    const angle = Math.atan2(point.y, point.x);
    const radius = Math.hypot(point.x, point.y);
    const phase = angle * params.angularFreq + timeSec * params.timeSpeed + index * 0.015;
    const displacement = Math.sin(phase) * strength * 0.08;
    const nextRadius = Math.max(0, radius * (1 + displacement));
    return {
      x: Math.cos(angle) * nextRadius,
      y: Math.sin(angle) * nextRadius,
    };
  });
}

/**
 * Convert HSL color string to hex format for WebGL shader
 * HSL input format: "hsl(240, 100%, 62%)" or "hsla(...)"
 * Returns: "#RRGGBB"
 */
function hslToHex(hslString: string): string {
  // Extract H, S, L values from string
  const match = hslString.match(/hsla?\((\d+\.?\d*),\s*(\d+\.?\d*)%,\s*(\d+\.?\d*)%/);
  if (!match) return hslString; // Return original if not HSL format
  
  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  
  // HSL to RGB conversion
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  // Convert to hex
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}


// ============================================================================
// FIX 4: Shape family grouping for smart auto-cycle
// ============================================================================

export function getMorphFamily(shape: ShapeType): string {
  if (shape.startsWith('sg-')) return 'sacred';
  if (shape === 'vj-circle' || shape === 'vj-square' || shape === 'vj-triangle' || shape === 'vj-pentagon' || shape === 'vj-octagon') return 'polygon';
  if (shape === 'fx-fibonacci-spiral' || shape === 'fx-golden-spiral' || shape === 'fx-torus-knot') return 'spiral';
  return 'legacy';
}

/**
 * Get next shape index within the same family for believable morphing
 */
export function getNextShapeInFamily(currentShape: ShapeType, allShapes: ShapeType[]): number {
  const currentFamily = getMorphFamily(currentShape);
  const currentIndex = allShapes.indexOf(currentShape);
  
  // Find all shapes in the same family
  const familyIndices: number[] = [];
  allShapes.forEach((shape, idx) => {
    if (getMorphFamily(shape) === currentFamily) {
      familyIndices.push(idx);
    }
  });
  
  // If no family members found (shouldn't happen), return next sequential
  if (familyIndices.length === 0) {
    return (currentIndex + 1) % allShapes.length;
  }
  
  // Find current position in family
  const positionInFamily = familyIndices.indexOf(currentIndex);
  
  // If current shape not found in family (shouldn't happen), return first family member
  if (positionInFamily === -1) {
    return familyIndices[0];
  }
  
  // Return next shape in family (wrap around)
  const nextPositionInFamily = (positionInFamily + 1) % familyIndices.length;
  return familyIndices[nextPositionInFamily];
}

// ============================================================================
// PHASE 3: OFFSCREEN CANVAS CACHE SYSTEM
// ============================================================================

interface ShapeCache {
  canvas: any;
  ctx: CanvasRenderingContext2D;
  cacheKey: string;
  timestamp: number;
  isRendered: boolean;
}

// Cache storage: Map<cacheKey, ShapeCache>
const shapeCache = new Map<string, ShapeCache>();
const MAX_CACHE_SIZE = 20; // Limit cache to prevent memory bloat
const CACHE_DURATION = 5000; // Clear unused caches after 5s
const scratchAlignedPoints: Vec2[] = [];

/**
 * Generate cache key from rendering parameters
 */
function getCacheKey(
  shape: ShapeType,
  baseRadius: number,
  rotation: number,
  complexity: number,
  strokeColor: string,
  lineWidth: number,
  strokeStyle: StrokeStyle
): string {
  // Round values to reduce cache misses from floating point precision
  const r = Math.round(baseRadius * 10) / 10;
  const rot = Math.round((rotation % (Math.PI * 2)) * 100) / 100;
  return `${shape}_${r}_${rot}_${complexity}_${strokeColor}_${lineWidth}_${strokeStyle}`;
}

/**
 * Get or create cached shape canvas
 */
function getOrCreateCache(cacheKey: string, size: number): ShapeCache {
  // Check if cache exists
  if (shapeCache.has(cacheKey)) {
    const cache = shapeCache.get(cacheKey)!;
    cache.timestamp = performance.now();
    return cache;
  }
  
  // Create new offscreen canvas
  const canvas = createAstralCanvas();
  const canvasSize = Math.ceil(size * 2.5); // Extra padding for effects
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d', { alpha: true })!;
  
  const cache: ShapeCache = {
    canvas,
    ctx,
    cacheKey,
    timestamp: performance.now(),
    isRendered: false
  };
  
  // Add to cache
  shapeCache.set(cacheKey, cache);
  
  // Enforce cache size limit (LRU eviction)
  if (shapeCache.size > MAX_CACHE_SIZE) {
    let oldestKey = '';
    let oldestTime = Infinity;
    
    shapeCache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      shapeCache.delete(oldestKey);
    }
  }
  
  return cache;
}

/**
 * Clear stale cache entries
 */
export function clearStaleCache(): void {
  const now = performance.now();
  const keysToDelete: string[] = [];
  
  shapeCache.forEach((cache, key) => {
    if (now - cache.timestamp > CACHE_DURATION) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => shapeCache.delete(key));
}

/**
 * Force clear entire cache (for major parameter changes)
 */
export function clearCache(): void {
  shapeCache.clear();
  // Also clear texture cache (defined later in file)
  if (typeof texCache !== 'undefined') {
    clearTextureCache();
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ShapeType = 
  // A. Sacred Geometry Classics
  | 'sg-seed-of-life'
  | 'sg-flower-of-life'
  | 'sg-flower-extended'
  | 'sg-vesica-piscis'
  | 'sg-vesica-chain'
  | 'sg-torus-halo'
  | 'sg-metatron-cube'
  | 'sg-metatron-dense'
  | 'sg-fruit-of-life'
  | 'sg-cube-of-space'
  | 'sg-sri-yantra'
  | 'sg-sri-yantra-dense'
  | 'sg-merkaba'
  | 'sg-tetrahedron'
  | 'sg-icosahedron'
  | 'sg-dodecahedron'
  | 'sg-platonic-stack'
  
  // B. Kaleidoscope & Symmetry
  | 'kx-mirror-quad'
  | 'kx-mirror-hex'
  | 'kx-mirror-oct'
  | 'kx-polar-wedge'
  | 'kx-rosette'
  | 'kx-mandala-rings'
  | 'kx-radial-tiles'
  | 'kx-dihedral'
  | 'kx-seam-hide'
  
  // C. Spirograph / Guilloché / Moiré
  | 'fx-spirograph-hypo'
  | 'fx-spirograph-epi'
  | 'fx-guilloche-rosette'
  | 'fx-guilloche-ribbon'
  | 'fx-moire-disc'
  | 'fx-moire-lattice'
  | 'fx-lissajous'
  | 'fx-harmonograph'
  | 'fx-fibonacci-spiral'
  | 'fx-golden-spiral'
  | 'fx-torus-knot'
  
  // D. Glyph / Rune / Hieroglyph
  | 'gl-runic-ring'
  | 'gl-sigil-circle'
  | 'gl-solar-disc'
  | 'gl-lunar-phases'
  | 'gl-alchemy-symbols'
  | 'gl-astral-chart'
  | 'gl-techno-hiero'
  | 'gl-circuit-glyph'
  | 'gl-tablet-lines'
  | 'gl-compass-rose'
  | 'gl-celtic-knot'
  | 'gl-lotus-mandala'
  | 'gl-labyrinth'
  
  // E. Geometric Standard (VJ)
  | 'vj-hex-grid'
  | 'vj-triangle-grid'
  | 'vj-isometric-grid'
  | 'vj-concentric-squares'
  | 'vj-concentric-triangles'
  | 'vj-nested-polygons'
  | 'vj-star-polygon'
  | 'vj-radial-lines'
  | 'vj-radar-sweep'
  | 'vj-orbital-nodes'
  | 'vj-arc-segments'
  | 'vj-crosshair-rings'
  | 'vj-circle'
  | 'vj-square'
  | 'vj-triangle'
  | 'vj-pentagon'
  | 'vj-octagon'

  // Legacy preset identifiers retained for backwards-compatible imports.
  | 'flower-of-life'
  | 'seed-of-life'
  | 'metatron-cube'
  | 'sri-yantra'
  | 'hexagon-lattice'
  | 'triangle-grid'
  | 'vesica-piscis'
  | 'circle'
  | 'square'
  | 'triangle'
  | 'pentagon'
  | 'octagon'
  | 'torus-knot'
  | 'mandala'
  | 'star-tetrahedron'
  | 'icosahedron'
  | 'merkaba'
  | 'double-helix'
  | 'fibonacci-spiral'
  | 'golden-spiral'
  | 'lotus-mandala'
  | 'celtic-knot'
  | 'platonic-solid'
  | 'labyrinth';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted' | 'glowing';
export type MorphMode = 'crossfade' | 'path-interpolate';
export type MorphOrigin = 'uniform' | 'center' | 'polarity';
export type AutoCycleSpeed = 'slug' | 'slow' | 'medium' | 'fast' | 'chaos';

/**
 * Phase 2 curated Liquid Shaper catalog.
 *
 * These are the only shapes presented for new manual selection and the only
 * shapes traversed by Auto-Cycle. The complete renderer catalog remains
 * available through getAllShapes() for preset/import playback.
 */
export const CURATED_LIQUID_SHAPER_SHAPES: readonly ShapeType[] = Object.freeze([
  'sg-vesica-chain',
  'sg-sri-yantra',
  'sg-merkaba',
  'sg-dodecahedron',
  'kx-polar-wedge',
  'kx-rosette',
  'sg-metatron-cube',
  'fx-guilloche-ribbon',
  'fx-lissajous',
  'gl-runic-ring',
  'gl-compass-rose',
  'vj-orbital-nodes',
  'kx-mirror-hex',
  'kx-mandala-rings',
  'kx-dihedral',
  'gl-circuit-glyph',
  'gl-lotus-mandala',
  'vj-hex-grid',
  'vj-concentric-squares',
  'vj-star-polygon',
]);

export function getActiveCycleShapes(): readonly ShapeType[] {
  return CURATED_LIQUID_SHAPER_SHAPES;
}

function createAstralCanvas(width = 1, height = 1): any {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

export interface AstralShaperParams {
  enabled: boolean;
  
  // Shape & Morphing
  shape: ShapeType;
  nextShape: ShapeType;
  morphAmount: number;          // 0-1 (blend between current and next shape)
  morphMode: MorphMode;
  morphOrigin: MorphOrigin;     // NEW: How the morph propagates
  fieldModulation: number;      // NEW: 0-1 (per-point audio-reactive animation strength)
  
  // Auto-Cycle
  autoCycle: boolean;
  cycleSpeed: AutoCycleSpeed;   // 'slug' (32 beats), 'slow' (24 beats), 'medium' (16), 'fast' (8), 'chaos' (4)
  
  // Audio Reactivity
  audioInfluence: number;        // 0-1 (how much audio affects the visuals)
  pulseDepth: number;            // 0-1 (breathing/pulsing intensity)
  // REMOVED: beatFlash - was causing performance issues and visual problems
  energyGlow: number;            // ENHANCED: 0-1 (glow intensity slider, was boolean)
  
  // Rotation & Animation
  rotationMultiplier: number;    // 0-4 (multiplies global rotation)
  rotationSpeedMod?: boolean;    // BPM/audio assisted rotation modulation
  rotationJitter: number;        // 0-1 (displacement/echo effect strength)
  
  // Geometry Properties
  complexity: number;            // 1-10 (recursion depth / detail level)
  lineThickness: number;         // 0.5-4 (stroke width in pixels) - REDUCED from 1-8
  strokeStyle: StrokeStyle;
  scale: number;                 // 0.3-1.5 (size multiplier for all shapes) - REDUCED from 0.1-2.0
  
  // Visual Effects
  symmetryFold: number;          // 3, 6, 8, 12 (radial symmetry count)
  depthEffect: boolean;          // Vary opacity/thickness for 3D feel
  kaleidoscope: boolean;         // Mirror patterns across axes
  rainbowSpectrum: boolean;      // Color gradient across vertices
  
  // Color
  useGlobalColor: boolean;       // Use global theme colors
  customColor: string;           // Override color (if not using global)
  
  // Performance
  maxSize: number;               // Maximum radius (stays inside inner ring)
}

export interface AudioAnalysisData {
  rms: number;           // 0-1 overall energy
  peak: number;          // 0-1 peak level
  bass: number;          // 0-1 bass energy
  mid: number;           // 0-1 mid energy
  high: number;          // 0-1 high energy
  beatPulse: number;     // 0-1 current beat pulse (decaying)
  isBeat: boolean;       // True on beat detection hit
}

// ============================================================================
// GEOMETRY HELPER FUNCTIONS
// ============================================================================

/**
 * SOLUTION A: Progressive Alpha Helper
 * Applies progressive transparency to layers - inner layers more transparent, outer layers opaque
 * @param ctx Canvas context
 * @param layerIndex Current layer (0 = innermost)
 * @param totalLayers Total number of layers
 */
function setProgressiveAlpha(ctx: CanvasRenderingContext2D, layerIndex: number, totalLayers: number): void {
  if (totalLayers <= 1) {
    ctx.globalAlpha = 1.0; // Single layer = full opacity
    return;
  }
  
  // Progressive alpha: 0.6 (60%) → 1.0 (100%)
  // Inner layers are more transparent, outer layers fully opaque
  const progress = layerIndex / (totalLayers - 1);
  const alpha = 0.6 + progress * 0.4;
  ctx.globalAlpha = alpha;
}

// Helper: Get points on a circle
function getCirclePoints(cx: number, cy: number, radius: number, count: number, rotation: number = 0): Array<{x: number, y: number}> {
  const points: Array<{x: number, y: number}> = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rotation;
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    });
  }
  return points;
}

// Helper: Draw a circle
function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

// Helper: Connect all points
function connectPoints(ctx: CanvasRenderingContext2D, points: Array<{x: number, y: number}>, closed: boolean = false) {
  if (points.length < 2) return;
  
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (closed) {
    ctx.closePath();
  }
  ctx.stroke();
}

// Helper: Connect all points to each other (full mesh)
function connectAllPoints(ctx: CanvasRenderingContext2D, points: Array<{x: number, y: number}>) {
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[j].x, points[j].y);
      ctx.stroke();
    }
  }
}

// ============================================================================
// SACRED GEOMETRY GENERATORS
// ============================================================================

// Flower of Life: 7 overlapping circles in hexagonal pattern
function drawFlowerOfLife(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const centers = getCirclePoints(cx, cy, baseRadius * 0.5, 6, rotation);
  
  // Draw center circle
  drawCircle(ctx, cx, cy, baseRadius * 0.5);
  
  // Draw 6 surrounding circles
  centers.forEach(center => {
    drawCircle(ctx, center.x, center.y, baseRadius * 0.5);
  });
}

// Seed of Life: Inner 6 circles only (subset of Flower of Life)
function drawSeedOfLife(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const centers = getCirclePoints(cx, cy, baseRadius * 0.4, 6, rotation);
  
  // Draw 6 circles only (no center circle)
  centers.forEach(center => {
    drawCircle(ctx, center.x, center.y, baseRadius * 0.4);
  });
}

// Metatron's Cube: 13 circles + connecting lines
function drawMetatronsCube(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const innerRadius = baseRadius * 0.25;
  const outerRadius = baseRadius * 0.6;
  
  // 13 circle centers
  const points = [
    {x: cx, y: cy}, // center
    ...getCirclePoints(cx, cy, innerRadius, 6, rotation),        // inner ring
    ...getCirclePoints(cx, cy, outerRadius, 6, rotation + Math.PI / 6)  // outer ring (offset)
  ];
  
  // Draw connecting lines (creates the cube structure)
  if (complexity > 3) {
    connectAllPoints(ctx, points);
  } else {
    // Simplified version: just connect nearby points
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < Math.min(i + 4, points.length); j++) {
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
  }
  
  // Draw circles at each point (increased from 0.08 to 0.15 for better visibility)
  points.forEach(pt => {
    drawCircle(ctx, pt.x, pt.y, baseRadius * 0.15);
  });
}

// Sri Yantra: Nested triangles (upward and downward)
function drawSriYantra(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(3, Math.floor(complexity)), 9);
  const savedAlpha = ctx.globalAlpha; // Save original alpha
  
  for (let i = 0; i < layers; i++) {
    // SOLUTION A: Apply progressive alpha - inner layers transparent, outer opaque
    setProgressiveAlpha(ctx, i, layers);
    
    const radius = baseRadius * (0.3 + (i / layers) * 0.6);
    const offset = i % 2 === 0 ? 0 : Math.PI; // Alternate upward/downward
    
    // Draw triangle
    const points = getCirclePoints(cx, cy, radius, 3, rotation + offset);
    connectPoints(ctx, points, true);
  }
  
  ctx.globalAlpha = savedAlpha; // Restore original alpha
}

// Hexagon Lattice: Sacred hexagonal grid
function drawHexagonLattice(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(1, Math.floor(complexity / 2)), 4);
  const totalLayers = layers + 1; // +1 for center hexagon
  const savedAlpha = ctx.globalAlpha;
  
  // Center hexagon (innermost layer)
  setProgressiveAlpha(ctx, 0, totalLayers);
  const centerPoints = getCirclePoints(cx, cy, baseRadius * 0.3, 6, rotation);
  connectPoints(ctx, centerPoints, true);
  
  // Surrounding hexagons
  for (let layer = 1; layer <= layers; layer++) {
    // SOLUTION A: Apply progressive alpha
    setProgressiveAlpha(ctx, layer, totalLayers);
    
    const ringRadius = baseRadius * 0.3 * layer;
    const hexCenters = getCirclePoints(cx, cy, ringRadius, 6, rotation);
    
    hexCenters.forEach(center => {
      const hexPoints = getCirclePoints(center.x, center.y, baseRadius * 0.3, 6, rotation);
      connectPoints(ctx, hexPoints, true);
    });
  }
  
  ctx.globalAlpha = savedAlpha;
}

// Triangle Grid: Recursive triangular tessellation
function drawTriangleGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(2, Math.floor(complexity)), 8);
  const savedAlpha = ctx.globalAlpha;
  
  for (let i = 0; i < layers; i++) {
    // SOLUTION A: Apply progressive alpha
    setProgressiveAlpha(ctx, i, layers);
    
    const radius = baseRadius * (0.2 + (i / layers) * 0.7);
    const triangleCount = 3 + i * 3; // More triangles as we go outward
    
    for (let j = 0; j < triangleCount; j++) {
      const angle = (j / triangleCount) * Math.PI * 2 + rotation;
      const offset = i % 2 === 0 ? 0 : Math.PI; // Alternate orientation
      
      const triCx = cx + Math.cos(angle) * radius * 0.5;
      const triCy = cy + Math.sin(angle) * radius * 0.5;
      
      const points = getCirclePoints(triCx, triCy, radius / triangleCount, 3, rotation + offset);
      connectPoints(ctx, points, true);
    }
  }
  
  ctx.globalAlpha = savedAlpha;
}

// Vesica Piscis: Two overlapping circles forming almond shape
function drawVesicaPiscis(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const offset = baseRadius * 0.3;
  const angle = rotation;
  
  // Two circles
  const c1x = cx + Math.cos(angle) * offset;
  const c1y = cy + Math.sin(angle) * offset;
  const c2x = cx - Math.cos(angle) * offset;
  const c2y = cy - Math.sin(angle) * offset;
  
  drawCircle(ctx, c1x, c1y, baseRadius * 0.5);
  drawCircle(ctx, c2x, c2y, baseRadius * 0.5);
  
  // Draw the vesica (almond shape) by drawing lines at intersection
  const vesicaAngle = angle + Math.PI / 2;
  const vesicaHeight = baseRadius * 0.8;
  
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(vesicaAngle) * vesicaHeight, cy + Math.sin(vesicaAngle) * vesicaHeight);
  ctx.lineTo(cx - Math.cos(vesicaAngle) * vesicaHeight, cy - Math.sin(vesicaAngle) * vesicaHeight);
  ctx.stroke();
}

// Simple Shapes

function drawSimpleCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number) {
  drawCircle(ctx, cx, cy, baseRadius * 0.6);
}

function drawSimpleSquare(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.5, 4, rotation + Math.PI / 4);
  connectPoints(ctx, points, true);
}

function drawSimpleTriangle(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, 3, rotation);
  connectPoints(ctx, points, true);
}

function drawSimplePentagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, 5, rotation);
  connectPoints(ctx, points, true);
}

function drawSimpleOctagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, 8, rotation);
  connectPoints(ctx, points, true);
}

// NEW SACRED GEOMETRY SHAPES (12 more)

// Torus Knot: 3D knot projected to 2D (LARGER)
function drawTorusKnot(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const p = 2; // Winding number
  const q = 3; // Winding number
  const segments = Math.min(60 + complexity * 10, 200);
  
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2 * q;
    const r = baseRadius * 0.55 * (0.8 + 0.2 * Math.cos(p * t)); // INCREASED from 0.3 to 0.55 for larger size
    const angle = q * t + rotation;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.stroke();
}

// Mandala: Ornate circular pattern with petals
function drawMandala(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(3, Math.floor(complexity)), 8);
  const petals = 8;
  const savedAlpha = ctx.globalAlpha;
  
  for (let layer = 0; layer < layers; layer++) {
    // SOLUTION A: Apply progressive alpha
    setProgressiveAlpha(ctx, layer, layers);
    
    const radius = baseRadius * (0.2 + (layer / layers) * 0.6);
    const petalSize = radius * 0.3;
    
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2 + rotation;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      
      // Draw petal
      ctx.beginPath();
      ctx.arc(px, py, petalSize, 0, Math.PI * 2);
      ctx.stroke();
      
      // Connect to center
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    
    // Draw ring
    drawCircle(ctx, cx, cy, radius);
  }
  
  ctx.globalAlpha = savedAlpha;
}

// Star Tetrahedron (Merkaba variant): Two interlocking tetrahedrons
function drawStarTetrahedron(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  // Upward tetrahedron (triangle)
  const points1 = getCirclePoints(cx, cy, baseRadius * 0.6, 3, rotation);
  connectPoints(ctx, points1, true);
  
  // Downward tetrahedron (inverted triangle)
  const points2 = getCirclePoints(cx, cy, baseRadius * 0.6, 3, rotation + Math.PI);
  connectPoints(ctx, points2, true);
  
  // Connect vertices to create 3D illusion
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(points1[i].x, points1[i].y);
    ctx.lineTo(cx, cy);
    ctx.lineTo(points2[i].x, points2[i].y);
    ctx.stroke();
  }
}

// Icosahedron: 20-sided polyhedron projection
function drawIcosahedron(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const vertices = 12;
  const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
  const savedAlpha = ctx.globalAlpha;
  
  // Create dodecahedron vertices (dual of icosahedron)
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, vertices, rotation);
  
  // Draw pentagonal faces with progressive alpha
  const faceCount = Math.min(5 + Math.floor(complexity), 12);
  for (let i = 0; i < faceCount; i++) {
    // SOLUTION A: Apply progressive alpha based on face depth
    setProgressiveAlpha(ctx, i, faceCount);
    
    const angle = (i / faceCount) * Math.PI * 2 + rotation;
    const radius = baseRadius * (0.3 + (i % 3) * 0.15);
    const facePoints = getCirclePoints(cx, cy, radius, 5, angle);
    connectPoints(ctx, facePoints, true);
  }
  
  // Connect to form icosahedron structure (full opacity for structure lines)
  ctx.globalAlpha = savedAlpha;
  for (let i = 0; i < vertices; i++) {
    const next = (i + 1) % vertices;
    const skip = (i + 5) % vertices;
    
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[next].x, points[next].y);
    ctx.stroke();
    
    if (complexity > 5) {
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[skip].x, points[skip].y);
      ctx.stroke();
    }
  }
}

// Merkaba: 3D star tetrahedron with energy field
function drawMerkaba(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  // Outer energy field (circle)
  drawCircle(ctx, cx, cy, baseRadius * 0.7);
  
  // Upward pyramid
  const up = getCirclePoints(cx, cy, baseRadius * 0.5, 3, rotation);
  connectPoints(ctx, up, true);
  
  // Downward pyramid
  const down = getCirclePoints(cx, cy, baseRadius * 0.5, 3, rotation + Math.PI);
  connectPoints(ctx, down, true);
  
  // Center connections
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(up[i].x, up[i].y);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(down[i].x, down[i].y);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }
  
  // Inner hexagon
  const innerHex = getCirclePoints(cx, cy, baseRadius * 0.25, 6, rotation);
  connectPoints(ctx, innerHex, true);
}

// Double Helix: DNA-like spiral structure
function drawDoubleHelix(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const turns = Math.min(Math.max(2, Math.floor(complexity / 2)), 6);
  const segments = turns * 20;
  
  // Draw two intertwined spirals
  for (let strand = 0; strand < 2; strand++) {
    const offset = strand * Math.PI;
    
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * turns * Math.PI * 2;
      const r = baseRadius * 0.4 * Math.cos(t + offset);
      const angle = t / turns + rotation;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  
  // Draw connecting base pairs
  for (let i = 0; i < turns * 4; i++) {
    const t = (i / (turns * 4)) * turns * Math.PI * 2;
    const r1 = baseRadius * 0.4 * Math.cos(t);
    const r2 = baseRadius * 0.4 * Math.cos(t + Math.PI);
    const angle = t / turns + rotation;
    
    const x1 = cx + r1 * Math.cos(angle);
    const y1 = cy + r1 * Math.sin(angle);
    const x2 = cx + r2 * Math.cos(angle);
    const y2 = cy + r2 * Math.sin(angle);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// Fibonacci Spiral: Natural growth spiral - NORMALIZED SIZE (LARGER)
function drawFibonacciSpiral(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const segments = Math.min(50 + complexity * 10, 150);
  const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
  
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2.5; // INCREASED from 1.5 to 2.5 rotations for larger spiral
    const r = Math.min(baseRadius * 0.09 * Math.pow(phi, t / Math.PI), baseRadius * 1.8); // BOOSTED 2.25×: 0.04->0.09 scale, 0.85->1.8 max
    const angle = t + rotation;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  
  // Draw Fibonacci squares - MEDIUM SIZE
  if (complexity > 5) {
    let fib1 = 1, fib2 = 1;
    for (let i = 0; i < 5; i++) {
      const size = (fib1 / 50) * baseRadius * 0.5625; // BOOSTED 2.25×: 0.25->0.5625
      const angle = (i * Math.PI / 2) + rotation;
      const dist = baseRadius * 0.45; // BOOSTED 2.25×: 0.2->0.45
      const sqx = cx + Math.cos(angle) * dist;
      const sqy = cy + Math.sin(angle) * dist;
      
      ctx.strokeRect(sqx - size / 2, sqy - size / 2, size, size);
      
      const temp = fib2;
      fib2 = fib1 + fib2;
      fib1 = temp;
    }
  }
}

// Golden Spiral: Logarithmic spiral based on golden ratio - NORMALIZED SIZE (LARGER)
function drawGoldenSpiral(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const segments = Math.min(60 + complexity * 10, 180);
  const phi = (1 + Math.sqrt(5)) / 2;
  const b = Math.log(phi) / (Math.PI / 2);
  
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 3; // INCREASED from 2 to 3 rotations for larger spiral
    const r = Math.min(baseRadius * 0.046875 * Math.exp(b * t), baseRadius * 1.5); // BOOSTED 1.875×: 0.025->0.046875 scale, 0.85->1.5 max
    const angle = t + rotation;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

// Lotus Mandala: Sacred lotus with layered petals
function drawLotusMandala(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(3, Math.floor(complexity)), 7);
  const savedAlpha = ctx.globalAlpha;
  
  for (let layer = 0; layer < layers; layer++) {
    // SOLUTION A: Apply progressive alpha
    setProgressiveAlpha(ctx, layer, layers);
    
    const radius = baseRadius * (0.2 + (layer / layers) * 0.5);
    const petals = 8 + layer * 4; // More petals in outer layers
    const petalLength = radius * 0.4;
    
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2 + rotation + (layer * 0.1);
      const px1 = cx + Math.cos(angle) * radius;
      const py1 = cy + Math.sin(angle) * radius;
      const px2 = cx + Math.cos(angle) * (radius + petalLength);
      const py2 = cy + Math.sin(angle) * (radius + petalLength);
      
      // Draw petal as curved line
      ctx.beginPath();
      ctx.moveTo(px1, py1);
      
      const cpAngle1 = angle - Math.PI / (petals * 2);
      const cpAngle2 = angle + Math.PI / (petals * 2);
      const cpDist = radius + petalLength * 0.5;
      
      ctx.quadraticCurveTo(
        cx + Math.cos(cpAngle1) * cpDist,
        cy + Math.sin(cpAngle1) * cpDist,
        px2, py2
      );
      ctx.quadraticCurveTo(
        cx + Math.cos(cpAngle2) * cpDist,
        cy + Math.sin(cpAngle2) * cpDist,
        px1, py1
      );
      ctx.stroke();
    }
    
    // Draw ring between layers
    drawCircle(ctx, cx, cy, radius);
  }
  
  // Center circle (always full opacity)
  ctx.globalAlpha = savedAlpha;
  drawCircle(ctx, cx, cy, baseRadius * 0.15);
}

// Celtic Knot: Interwoven endless knot pattern
function drawCelticKnot(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const strands = Math.min(Math.max(3, Math.floor(complexity / 2)), 6);
  const savedAlpha = ctx.globalAlpha;
  
  for (let strand = 0; strand < strands; strand++) {
    // SOLUTION A: Apply progressive alpha - inner strands transparent, outer opaque
    setProgressiveAlpha(ctx, strand, strands);
    
    const offset = (strand / strands) * Math.PI * 2;
    const segments = 60;
    
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const r = baseRadius * 0.4 * (1 + 0.3 * Math.sin(t * 4 + offset));
      const angle = t + rotation + offset;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }
  
  ctx.globalAlpha = savedAlpha;
  
  // Add interlacing circles
  const nodes = 4;
  for (let i = 0; i < nodes; i++) {
    const angle = (i / nodes) * Math.PI * 2 + rotation;
    const nx = cx + Math.cos(angle) * baseRadius * 0.4;
    const ny = cy + Math.sin(angle) * baseRadius * 0.4;
    drawCircle(ctx, nx, ny, baseRadius * 0.15);
  }
}

// Platonic Solid: Dodecahedron projection
function drawPlatonicSolid(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
  const savedAlpha = ctx.globalAlpha;
  
  // Draw dodecahedron as nested pentagons
  const layers = Math.min(Math.max(2, Math.floor(complexity / 2)), 5);
  
  for (let layer = 0; layer < layers; layer++) {
    // SOLUTION A: Apply progressive alpha
    setProgressiveAlpha(ctx, layer, layers);
    
    const radius = baseRadius * (0.3 + (layer / layers) * 0.4);
    const angle = rotation + (layer * Math.PI / 5);
    
    // Pentagon face
    const points = getCirclePoints(cx, cy, radius, 5, angle);
    connectPoints(ctx, points, true);
    
    // Connect to center for 3D effect
    if (complexity > 5) {
      points.forEach(pt => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      });
    }
  }
  
  // Outer structure (full opacity)
  ctx.globalAlpha = savedAlpha;
  const outerPoints = getCirclePoints(cx, cy, baseRadius * 0.7, 10, rotation);
  for (let i = 0; i < 10; i += 2) {
    const next = (i + 2) % 10;
    ctx.beginPath();
    ctx.moveTo(outerPoints[i].x, outerPoints[i].y);
    ctx.lineTo(outerPoints[next].x, outerPoints[next].y);
    ctx.stroke();
  }
}

// Labyrinth: Classical 7-circuit labyrinth
function drawLabyrinth(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const circuits = Math.min(Math.max(3, Math.floor(complexity)), 9);
  const segments = 60;
  
  for (let circuit = 0; circuit < circuits; circuit++) {
    const innerRadius = baseRadius * (0.1 + (circuit / circuits) * 0.6);
    const outerRadius = baseRadius * (0.1 + ((circuit + 1) / circuits) * 0.6);
    
    // Draw circuit path with gaps
    const gapCount = 4;
    for (let gap = 0; gap < gapCount; gap++) {
      const startAngle = (gap / gapCount) * Math.PI * 2 + rotation;
      const gapSize = Math.PI * 0.1;
      const arcAngle = (Math.PI * 2 / gapCount) - gapSize;
      
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius, startAngle, startAngle + arcAngle);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, startAngle, startAngle + arcAngle);
      ctx.stroke();
    }
    
    // Connect inner and outer with radial lines
    for (let i = 0; i < gapCount * 2; i++) {
      const angle = (i / (gapCount * 2)) * Math.PI * 2 + rotation + Math.PI / (gapCount * 4);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius);
      ctx.lineTo(cx + Math.cos(angle) * outerRadius, cy + Math.sin(angle) * outerRadius);
      ctx.stroke();
    }
  }
}

// ============================================================================
// NEW SHAPES - EXPANDED LIBRARY
// ============================================================================

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: SACRED GEOMETRY CLASSICS - NEW ADDITIONS (10 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Flower of Life Extended: Larger lattice with 19 circles
function drawFlowerExtended(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const r = baseRadius * 0.35;
  
  // Center circle
  drawCircle(ctx, cx, cy, r);
  
  // First ring (6 circles)
  const ring1 = getCirclePoints(cx, cy, r, 6, rotation);
  ring1.forEach(pt => drawCircle(ctx, pt.x, pt.y, r));
  
  // Second ring (12 circles)
  const ring2 = getCirclePoints(cx, cy, r * 2, 12, rotation);
  ring2.forEach(pt => drawCircle(ctx, pt.x, pt.y, r));
}

// Vesica Chain: Stacked vesica piscis
function drawVesicaChain(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const count = 5;
  const spacing = baseRadius * 0.25;
  const circleRadius = baseRadius * 0.3;
  
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spacing;
    const angle = rotation;
    const x = cx + Math.cos(angle) * offset;
    const y = cy + Math.sin(angle) * offset;
    drawCircle(ctx, x, y, circleRadius);
  }
}

// Torus Halo: Double concentric rings
function drawTorusHalo(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  // Outer ring
  drawCircle(ctx, cx, cy, baseRadius * 0.7);
  // Inner ring
  drawCircle(ctx, cx, cy, baseRadius * 0.5);
  
  // Connecting radial lines
  const spokes = 12;
  for (let i = 0; i < spokes; i++) {
    const angle = (i / spokes) * Math.PI * 2 + rotation;
    const x1 = cx + Math.cos(angle) * baseRadius * 0.5;
    const y1 = cy + Math.sin(angle) * baseRadius * 0.5;
    const x2 = cx + Math.cos(angle) * baseRadius * 0.7;
    const y2 = cy + Math.sin(angle) * baseRadius * 0.7;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// Metatron Dense: Heavy chord connections
function drawMetatronDense(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const innerRadius = baseRadius * 0.25;
  const outerRadius = baseRadius * 0.6;
  
  const points = [
    {x: cx, y: cy},
    ...getCirclePoints(cx, cy, innerRadius, 6, rotation),
    ...getCirclePoints(cx, cy, outerRadius, 6, rotation + Math.PI / 6)
  ];
  
  // Connect ALL points (full mesh)
  connectAllPoints(ctx, points);
  
  // Draw small circles at each point (increased from 0.05 to 0.12 for better visibility)
  points.forEach(pt => {
    drawCircle(ctx, pt.x, pt.y, baseRadius * 0.12);
  });
}

// Fruit of Life: 13-node sacred pattern
function drawFruitOfLife(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const r = baseRadius * 0.3;
  
  // Center circle
  drawCircle(ctx, cx, cy, r);
  
  // 6 surrounding circles
  const centers = getCirclePoints(cx, cy, r, 6, rotation);
  centers.forEach(center => {
    drawCircle(ctx, center.x, center.y, r);
  });
  
  // 6 outer circles
  const outerCenters = getCirclePoints(cx, cy, r * 1.732, 6, rotation + Math.PI / 6); // sqrt(3) spacing
  outerCenters.forEach(center => {
    drawCircle(ctx, center.x, center.y, r);
  });
}

// Cube of Space: 3D cube projection lattice
function drawCubeOfSpace(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const size = baseRadius * 0.5;
  const offset = size * 0.3;
  
  // Front face
  const frontPoints = [
    {x: cx - size + offset, y: cy - size + offset},
    {x: cx + size + offset, y: cy - size + offset},
    {x: cx + size + offset, y: cy + size + offset},
    {x: cx - size + offset, y: cy + size + offset}
  ];
  connectPoints(ctx, frontPoints, true);
  
  // Back face
  const backPoints = [
    {x: cx - size - offset, y: cy - size - offset},
    {x: cx + size - offset, y: cy - size - offset},
    {x: cx + size - offset, y: cy + size - offset},
    {x: cx - size - offset, y: cy + size - offset}
  ];
  connectPoints(ctx, backPoints, true);
  
  // Connect front to back
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(frontPoints[i].x, frontPoints[i].y);
    ctx.lineTo(backPoints[i].x, backPoints[i].y);
    ctx.stroke();
  }
}

// Sri Yantra Dense: Layered with more triangles
function drawSriYantraDense(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(5, Math.floor(complexity * 1.5)), 15);
  
  for (let i = 0; i < layers; i++) {
    const radius = baseRadius * (0.2 + (i / layers) * 0.7);
    const offset = i % 2 === 0 ? 0 : Math.PI;
    const points = getCirclePoints(cx, cy, radius, 3, rotation + offset);
    connectPoints(ctx, points, true);
    
    // Add inner lines
    if (i % 3 === 0) {
      points.forEach(pt => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      });
    }
  }
}

// Tetrahedron: Simple 4-sided pyramid
function drawTetrahedron(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, 3, rotation);
  connectPoints(ctx, points, true);
  
  // Connect all to center for 3D effect
  points.forEach(pt => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  });
}

// Dodecahedron: 12-sided polyhedron
function drawDodecahedron(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const layers = 3;
  for (let layer = 0; layer < layers; layer++) {
    const radius = baseRadius * (0.3 + (layer / layers) * 0.4);
    const angle = rotation + (layer * Math.PI / 5);
    const points = getCirclePoints(cx, cy, radius, 5, angle);
    connectPoints(ctx, points, true);
  }
  
  // Outer pentagon
  const outerPoints = getCirclePoints(cx, cy, baseRadius * 0.7, 5, rotation);
  connectPoints(ctx, outerPoints, true);
}

// Platonic Stack: Triangle → Hexagon → Circle evolution
function drawPlatonicStack(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  // Inner triangle
  const tri = getCirclePoints(cx, cy, baseRadius * 0.3, 3, rotation);
  connectPoints(ctx, tri, true);
  
  // Mid hexagon
  const hex = getCirclePoints(cx, cy, baseRadius * 0.5, 6, rotation);
  connectPoints(ctx, hex, true);
  
  // Outer circle
  drawCircle(ctx, cx, cy, baseRadius * 0.7);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: KALEIDOSCOPE & SYMMETRY (9 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Mirror Quad: 2-axis mirror (90° symmetry)
function drawMirrorQuad(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + rotation;
    const x1 = cx;
    const y1 = cy;
    const x2 = cx + Math.cos(angle) * baseRadius * 0.7;
    const y2 = cy + Math.sin(angle) * baseRadius * 0.7;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Cross bars
    const nextAngle = ((i + 1) / 4) * Math.PI * 2 + rotation;
    const x3 = cx + Math.cos(nextAngle) * baseRadius * 0.7;
    const y3 = cy + Math.sin(nextAngle) * baseRadius * 0.7;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  }
}

// Mirror Hex: 60° symmetry
function drawMirrorHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.7, 6, rotation);
  
  // Draw lines from center to each point
  points.forEach((pt, i) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    
    // Connect adjacent points
    const nextPt = points[(i + 1) % points.length];
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(nextPt.x, nextPt.y);
    ctx.stroke();
  });
}

// Mirror Oct: 45° symmetry
function drawMirrorOct(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.7, 8, rotation);
  
  points.forEach(pt => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  });
  
  connectPoints(ctx, points, true);
}

// Polar Wedge: N slices
function drawPolarWedge(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const slices = Math.min(Math.max(6, Math.floor(complexity * 2)), 24);
  
  for (let i = 0; i < slices; i++) {
    const angle = (i / slices) * Math.PI * 2 + rotation;
    const x = cx + Math.cos(angle) * baseRadius * 0.7;
    const y = cy + Math.sin(angle) * baseRadius * 0.7;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  
  // Rings
  drawCircle(ctx, cx, cy, baseRadius * 0.35);
  drawCircle(ctx, cx, cy, baseRadius * 0.7);
}

// Rosette: N petals
function drawRosette(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const petals = Math.min(Math.max(5, Math.floor(complexity * 1.5)), 16);
  const petalRadius = baseRadius * 0.4;
  
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2 + rotation;
    const px = cx + Math.cos(angle) * baseRadius * 0.4;
    const py = cy + Math.sin(angle) * baseRadius * 0.4;
    
    drawCircle(ctx, px, py, petalRadius);
  }
  
  // Center
  drawCircle(ctx, cx, cy, baseRadius * 0.2);
}

// Radial Tiles: Repeat/rotate pattern
function drawRadialTiles(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const tiles = Math.min(Math.max(6, Math.floor(complexity * 1.5)), 16);
  const tileSize = baseRadius * 0.25;
  
  for (let i = 0; i < tiles; i++) {
    const angle = (i / tiles) * Math.PI * 2 + rotation;
    const dist = baseRadius * 0.5;
    const tx = cx + Math.cos(angle) * dist;
    const ty = cy + Math.sin(angle) * dist;
    
    // Draw tile (small square)
    const tilePoints = getCirclePoints(tx, ty, tileSize, 4, angle + Math.PI / 4);
    connectPoints(ctx, tilePoints, true);
  }
}

// Dihedral: N-fold with reflection
function drawDihedral(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const sides = Math.min(Math.max(5, Math.floor(complexity * 1.5)), 12);
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, sides, rotation);
  
  connectPoints(ctx, points, true);
  
  // Mirror lines
  for (let i = 0; i < sides; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}

// Seam-Hide Mirror: Polar seam concealment
function drawSeamHide(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  // Overlapping concentric patterns that hide polar seams
  const rings = 5;
  for (let i = 0; i < rings; i++) {
    const radius = baseRadius * (0.2 + (i / rings) * 0.5);
    const segments = 6 + i * 2;
    
    const points = getCirclePoints(cx, cy, radius, segments, rotation + (i * Math.PI / segments));
    connectPoints(ctx, points, true);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: SPIROGRAPH / GUILLOCHÉ / MOIRÉ (8 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Spirograph Hypotrochoid: Classic inner spiral
function drawSpirographHypo(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const R = baseRadius * 0.625; // 0.5 * 1.25 = 0.625 (25% larger)
  const r = baseRadius * 0.3125; // 0.25 * 1.25 = 0.3125 (25% larger)
  const d = baseRadius * 0.5; // 0.4 * 1.25 = 0.5 (25% larger)
  const segments = Math.min(100 + complexity * 20, 300);
  
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2 * 3;
    const x = cx + ((R - r) * Math.cos(t + rotation) + d * Math.cos(((R - r) / r) * t));
    const y = cy + ((R - r) * Math.sin(t + rotation) + d * Math.sin(((R - r) / r) * t));
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.stroke();
}

// Spirograph Epitrochoid: Outer spiral
function drawSpirographEpi(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const R = baseRadius * 0.375; // 0.3 * 1.25 = 0.375 (25% larger)
  const r = baseRadius * 0.1875; // 0.15 * 1.25 = 0.1875 (25% larger)
  const d = baseRadius * 0.3125; // 0.25 * 1.25 = 0.3125 (25% larger)
  const segments = Math.min(100 + complexity * 20, 300);
  
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2 * 5;
    const x = cx + ((R + r) * Math.cos(t + rotation) - d * Math.cos(((R + r) / r) * t));
    const y = cy + ((R + r) * Math.sin(t + rotation) - d * Math.sin(((R + r) / r) * t));
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.stroke();
}

// Guilloché Rosette: Banknote-style precision pattern
function drawGuillocheRosette(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const waves = Math.min(Math.max(8, Math.floor(complexity * 2)), 24);
  const amplitude = baseRadius * 0.1875; // 0.15 * 1.25 = 0.1875 (25% larger)
  const segments = 120;
  
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const r = baseRadius * 0.5 + amplitude * Math.sin(waves * t); // 0.4 * 1.25 = 0.5 (25% larger)
    const angle = t + rotation;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.stroke();
}

// Guilloché Ribbon: Interwoven ribbon rings
function drawGuillocheRibbon(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const ribbons = Math.min(Math.max(3, Math.floor(complexity)), 8);
  
  for (let r = 0; r < ribbons; r++) {
    const phase = (r / ribbons) * Math.PI * 2;
    const segments = 100;
    
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const radius = baseRadius * 0.5 + baseRadius * 0.25 * Math.sin(6 * t + phase); // 0.4->0.5, 0.2->0.25 (25% larger)
      const angle = t + rotation;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }
}

// Moiré Interference Disc: Overlapping frequency patterns
function drawMoireDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const rings = Math.min(Math.max(10, Math.floor(complexity * 3)), 40);
  
  for (let i = 0; i < rings; i++) {
    const radius = baseRadius * (0.25 + (i / rings) * 0.75); // 0.2->0.25, 0.6->0.75 (25% larger)
    drawCircle(ctx, cx, cy, radius);
  }
  
  // Offset pattern for moiré effect
  const offsetX = baseRadius * 0.125 * Math.cos(rotation); // 0.1 * 1.25 = 0.125 (25% larger)
  const offsetY = baseRadius * 0.125 * Math.sin(rotation); // 0.1 * 1.25 = 0.125 (25% larger)
  
  for (let i = 0; i < rings; i++) {
    const radius = baseRadius * (0.25 + (i / rings) * 0.75); // 0.2->0.25, 0.6->0.75 (25% larger)
    drawCircle(ctx, cx + offsetX, cy + offsetY, radius);
  }
}

// Moiré Lattice: Grid interference
function drawMoireLattice(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const lines = Math.min(Math.max(8, Math.floor(complexity * 2)), 24);
  const size = baseRadius * 1.5; // 1.2 * 1.25 = 1.5 (25% larger)
  
  // First grid
  for (let i = 0; i < lines; i++) {
    const offset = (i / lines - 0.5) * size;
    
    // Horizontal lines
    const x1 = cx - size / 2;
    const y1 = cy + offset;
    const x2 = cx + size / 2;
    const y2 = cy + offset;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(cx + offset, cy - size / 2);
    ctx.lineTo(cx + offset, cy + size / 2);
    ctx.stroke();
  }
}

// Lissajous Knot: 2D parametric curve
function drawLissajous(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const a = 3;
  const b = 4;
  const delta = Math.PI / 2 + rotation;
  const segments = Math.min(100 + complexity * 20, 300);
  
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = cx + baseRadius * 0.75 * Math.sin(a * t + delta); // 0.6 * 1.25 = 0.75 (25% larger)
    const y = cy + baseRadius * 0.75 * Math.sin(b * t); // 0.6 * 1.25 = 0.75 (25% larger)
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

// Harmonograph: Smooth pendulum trails
function drawHarmonograph(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const segments = Math.min(200 + complexity * 30, 500);
  const decay = 0.998;
  
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 10;
    const damping = Math.pow(decay, i);
    
    const x = cx + baseRadius * 0.75 * damping * Math.sin(2.1 * t + rotation) * Math.sin(1.3 * t); // 0.6 * 1.25 = 0.75 (25% larger)
    const y = cy + baseRadius * 0.75 * damping * Math.cos(3.3 * t) * Math.cos(1.7 * t + rotation); // 0.6 * 1.25 = 0.75 (25% larger)
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4A: GLYPH / RUNE / HIEROGLYPH (Part 1 of 2 - 5 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Runic Ring: Elder-style strokes
function drawRunicRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const runes = Math.min(Math.max(8, Math.floor(complexity * 1.5)), 16);
  
  drawCircle(ctx, cx, cy, baseRadius * 0.6);
  
  for (let i = 0; i < runes; i++) {
    const angle = (i / runes) * Math.PI * 2 + rotation;
    const x = cx + Math.cos(angle) * baseRadius * 0.6;
    const y = cy + Math.sin(angle) * baseRadius * 0.6;
    
    // Draw rune-like marks (vertical lines with branches)
    const lineLen = baseRadius * 0.15;
    ctx.beginPath();
    ctx.moveTo(x - Math.sin(angle) * lineLen, y + Math.cos(angle) * lineLen);
    ctx.lineTo(x + Math.sin(angle) * lineLen, y - Math.cos(angle) * lineLen);
    ctx.stroke();
    
    // Branch
    const branchLen = lineLen * 0.6;
    const branchAngle = angle + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(branchAngle) * branchLen, y + Math.sin(branchAngle) * branchLen);
    ctx.stroke();
  }
}

// Sigil Circle: Procedural stroke pattern
function drawSigilCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const nodes = Math.min(Math.max(5, Math.floor(complexity * 1.5)), 12);
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, nodes, rotation);
  
  // Connect points in star pattern
  for (let i = 0; i < nodes; i++) {
    const target = (i + Math.floor(nodes / 2)) % nodes;
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[target].x, points[target].y);
    ctx.stroke();
  }
  
  // Center connections
  points.forEach(pt => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  });
}

// Solar Disc Glyph: Simple sun symbol
function drawSolarDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  drawCircle(ctx, cx, cy, baseRadius * 0.3);
  drawCircle(ctx, cx, cy, baseRadius * 0.5);
  
  // Rays
  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2 + rotation;
    const x1 = cx + Math.cos(angle) * baseRadius * 0.5;
    const y1 = cy + Math.sin(angle) * baseRadius * 0.5;
    const x2 = cx + Math.cos(angle) * baseRadius * 0.7;
    const y2 = cy + Math.sin(angle) * baseRadius * 0.7;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// Lunar Phases Glyph: Moon cycle ring
function drawLunarPhases(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const phases = 8;
  
  for (let i = 0; i < phases; i++) {
    const angle = (i / phases) * Math.PI * 2 + rotation;
    const x = cx + Math.cos(angle) * baseRadius * 0.5;
    const y = cy + Math.sin(angle) * baseRadius * 0.5;
    const moonRadius = baseRadius * 0.12;
    
    // Full circle
    drawCircle(ctx, x, y, moonRadius);
    
    // Phase (filled portion)
    const phaseAmount = i / phases;
    if (phaseAmount > 0.25 && phaseAmount < 0.75) {
      ctx.beginPath();
      ctx.arc(x, y, moonRadius, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }
  }
  
  drawCircle(ctx, cx, cy, baseRadius * 0.5);
}

// Alchemy Symbols Ring: Classic alchemical marks
function drawAlchemySymbols(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const symbols = 7;
  
  drawCircle(ctx, cx, cy, baseRadius * 0.6);
  
  for (let i = 0; i < symbols; i++) {
    const angle = (i / symbols) * Math.PI * 2 + rotation;
    const x = cx + Math.cos(angle) * baseRadius * 0.6;
    const y = cy + Math.sin(angle) * baseRadius * 0.6;
    
    // Draw simple alchemical symbols (triangles, circles, crosses)
    const symSize = baseRadius * 0.1;
    
    if (i % 3 === 0) {
      // Triangle
      const tri = getCirclePoints(x, y, symSize, 3, angle);
      connectPoints(ctx, tri, true);
    } else if (i % 3 === 1) {
      // Circle
      drawCircle(ctx, x, y, symSize);
    } else {
      // Cross
      ctx.beginPath();
      ctx.moveTo(x - symSize, y);
      ctx.lineTo(x + symSize, y);
      ctx.moveTo(x, y - symSize);
      ctx.lineTo(x, y + symSize);
      ctx.stroke();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4B: GLYPH / RUNE / HIEROGLYPH (Part 2 of 2 - 5 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Astral Chart: Constellation ring
function drawAstralChart(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const stars = Math.min(Math.max(12, Math.floor(complexity * 3)), 36);
  
  // Outer ring
  drawCircle(ctx, cx, cy, baseRadius * 0.7);
  
  // Stars and connections
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, stars, rotation);
  
  for (let i = 0; i < stars; i++) {
    // Star marker
    const pt = points[i];
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, baseRadius * 0.02, 0, Math.PI * 2);
    ctx.fill();
    
    // Connect to nearby stars
    if (i % 3 === 0 && i + 1 < stars) {
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.stroke();
    }
  }
}

// Techno-Hiero: Modular blocks
function drawTechnoHiero(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const blocks = Math.min(Math.max(6, Math.floor(complexity * 1.5)), 12);
  
  for (let i = 0; i < blocks; i++) {
    const angle = (i / blocks) * Math.PI * 2 + rotation;
    const dist = baseRadius * 0.5;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const size = baseRadius * 0.15;
    
    // Draw modular block
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    
    // Inner detail
    ctx.strokeRect(x - size / 4, y - size / 4, size / 2, size / 2);
  }
  
  drawCircle(ctx, cx, cy, baseRadius * 0.25);
}

// Circuit Glyph Mandala: Circuit board aesthetic
function drawCircuitGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(3, Math.floor(complexity)), 7);
  
  for (let layer = 0; layer < layers; layer++) {
    const radius = baseRadius * (0.2 + (layer / layers) * 0.5);
    const nodes = 6 + layer * 2;
    const points = getCirclePoints(cx, cy, radius, nodes, rotation + layer * 0.1);
    
    // Circuit nodes
    points.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, baseRadius * 0.03, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // Connections
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length;
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[next].x, points[next].y);
      ctx.stroke();
    }
  }
}

// Tablet Lines: Etched grid
function drawTabletLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const lines = Math.min(Math.max(5, Math.floor(complexity * 1.5)), 15);
  const size = baseRadius * 1.2;
  
  for (let i = 0; i < lines; i++) {
    const offset = (i / lines - 0.5) * size;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    
    // Rotated horizontal lines
    const x1 = cx + (-size / 2) * cos - offset * sin;
    const y1 = cy + (-size / 2) * sin + offset * cos;
    const x2 = cx + (size / 2) * cos - offset * sin;
    const y2 = cy + (size / 2) * sin + offset * cos;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  
  // Border
  const corners = getCirclePoints(cx, cy, baseRadius * 0.7, 4, rotation + Math.PI / 4);
  connectPoints(ctx, corners, true);
}

// Compass Rose Glyph: Navigation markers
function drawCompassRose(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  // Main directions (N, S, E, W)
  const mainDirs = 4;
  for (let i = 0; i < mainDirs; i++) {
    const angle = (i / mainDirs) * Math.PI * 2 + rotation;
    const x1 = cx + Math.cos(angle) * baseRadius * 0.2;
    const y1 = cy + Math.sin(angle) * baseRadius * 0.2;
    const x2 = cx + Math.cos(angle) * baseRadius * 0.7;
    const y2 = cy + Math.sin(angle) * baseRadius * 0.7;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Arrowhead
    const arrowSize = baseRadius * 0.1;
    const perpAngle = angle + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(angle) * arrowSize + Math.cos(perpAngle) * arrowSize * 0.5,
               y2 - Math.sin(angle) * arrowSize + Math.sin(perpAngle) * arrowSize * 0.5);
    ctx.lineTo(x2 - Math.cos(angle) * arrowSize - Math.cos(perpAngle) * arrowSize * 0.5,
               y2 - Math.sin(angle) * arrowSize - Math.sin(perpAngle) * arrowSize * 0.5);
    ctx.closePath();
    ctx.stroke();
  }
  
  // Secondary directions
  const secDirs = 4;
  for (let i = 0; i < secDirs; i++) {
    const angle = (i / secDirs) * Math.PI * 2 + rotation + Math.PI / 4;
    const x1 = cx + Math.cos(angle) * baseRadius * 0.3;
    const y1 = cy + Math.sin(angle) * baseRadius * 0.3;
    const x2 = cx + Math.cos(angle) * baseRadius * 0.6;
    const y2 = cy + Math.sin(angle) * baseRadius * 0.6;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  
  // Center circle
  drawCircle(ctx, cx, cy, baseRadius * 0.15);
  drawCircle(ctx, cx, cy, baseRadius * 0.7);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5A: GEOMETRIC STANDARD (VJ) - Part 1 of 2 (7 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Isometric Grid: 3D-style grid
function drawIsometricGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const lines = Math.min(Math.max(4, Math.floor(complexity)), 10);
  const spacing = baseRadius * 0.15;
  
  // Three directions for isometric
  const angles = [0, Math.PI / 3, 2 * Math.PI / 3];
  
  angles.forEach(baseAngle => {
    const angle = baseAngle + rotation;
    for (let i = -lines; i <= lines; i++) {
      const perpAngle = angle + Math.PI / 2;
      const offset = i * spacing;
      
      const x1 = cx + Math.cos(perpAngle) * offset - Math.cos(angle) * baseRadius;
      const y1 = cy + Math.sin(perpAngle) * offset - Math.sin(angle) * baseRadius;
      const x2 = cx + Math.cos(perpAngle) * offset + Math.cos(angle) * baseRadius;
      const y2 = cy + Math.sin(perpAngle) * offset + Math.sin(angle) * baseRadius;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  });
}

// Concentric Squares
function drawConcentricSquares(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(3, Math.floor(complexity)), 12);
  
  for (let i = 0; i < layers; i++) {
    const size = baseRadius * (0.2 + (i / layers) * 0.9);
    const points = getCirclePoints(cx, cy, size, 4, rotation + Math.PI / 4);
    connectPoints(ctx, points, true);
  }
}

// Concentric Triangles
function drawConcentricTriangles(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(3, Math.floor(complexity)), 12);
  
  for (let i = 0; i < layers; i++) {
    const size = baseRadius * (0.2 + (i / layers) * 0.7);
    const offset = i % 2 === 0 ? 0 : Math.PI;
    const points = getCirclePoints(cx, cy, size, 3, rotation + offset);
    connectPoints(ctx, points, true);
  }
}

// Nested Polygons: Variable N-gons
function drawNestedPolygons(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(3, Math.floor(complexity)), 10);
  const baseSides = 5;
  
  for (let i = 0; i < layers; i++) {
    const size = baseRadius * (0.2 + (i / layers) * 0.7);
    const sides = baseSides + Math.floor(i / 2);
    const points = getCirclePoints(cx, cy, size, sides, rotation);
    connectPoints(ctx, points, true);
  }
}

// Star Polygon: N/step pattern
function drawStarPolygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const points = Math.min(Math.max(5, Math.floor(complexity * 1.5)), 16);
  const step = Math.max(2, Math.floor(points / 3));
  
  const vertices = getCirclePoints(cx, cy, baseRadius * 0.7, points, rotation);
  
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const current = vertices[i];
    const next = vertices[(i * step) % points];
    
    if (i === 0) {
      ctx.moveTo(current.x, current.y);
    }
    ctx.lineTo(next.x, next.y);
  }
  ctx.closePath();
  ctx.stroke();
}

// Radial Lines Burst
function drawRadialLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const lines = Math.min(Math.max(12, Math.floor(complexity * 3)), 48);
  
  for (let i = 0; i < lines; i++) {
    const angle = (i / lines) * Math.PI * 2 + rotation;
    const innerRadius = baseRadius * 0.2;
    const outerRadius = baseRadius * 0.7;
    
    const x1 = cx + Math.cos(angle) * innerRadius;
    const y1 = cy + Math.sin(angle) * innerRadius;
    const x2 = cx + Math.cos(angle) * outerRadius;
    const y2 = cy + Math.sin(angle) * outerRadius;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

// Radar Sweep Lines: HUD-style
function drawRadarSweep(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const rings = 5;
  for (let i = 1; i <= rings; i++) {
    const radius = (i / rings) * baseRadius * 0.7;
    drawCircle(ctx, cx, cy, radius);
  }
  
  // Crosshairs
  const crossSize = baseRadius * 0.7;
  ctx.beginPath();
  ctx.moveTo(cx - crossSize, cy);
  ctx.lineTo(cx + crossSize, cy);
  ctx.moveTo(cx, cy - crossSize);
  ctx.lineTo(cx, cy + crossSize);
  ctx.stroke();
  
  // Sweep line
  const sweepAngle = rotation;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * baseRadius * 0.7, cy + Math.sin(sweepAngle) * baseRadius * 0.7);
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5B: GEOMETRIC STANDARD (VJ) - Part 2 of 2 (6 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Orbital Nodes + Links: Network visualization
function drawOrbitalNodes(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const nodes = Math.min(Math.max(6, Math.floor(complexity * 1.5)), 16);
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, nodes, rotation);
  
  // Draw connections
  for (let i = 0; i < nodes; i++) {
    const next = (i + 1) % nodes;
    const skip = (i + 2) % nodes;
    
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[next].x, points[next].y);
    ctx.stroke();
    
    if (complexity > 5) {
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[skip].x, points[skip].y);
      ctx.stroke();
    }
  }
  
  // Draw nodes
  points.forEach(pt => {
    drawCircle(ctx, pt.x, pt.y, baseRadius * 0.05);
  });
  
  // Center node
  drawCircle(ctx, cx, cy, baseRadius * 0.08);
}

// Arc Segments HUD: Segmented arcs
function drawArcSegments(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const segments = Math.min(Math.max(8, Math.floor(complexity * 2)), 24);
  const rings = 3;
  
  for (let ring = 0; ring < rings; ring++) {
    const radius = baseRadius * (0.3 + (ring / rings) * 0.4);
    
    for (let i = 0; i < segments; i++) {
      const startAngle = (i / segments) * Math.PI * 2 + rotation;
      const arcLength = (Math.PI * 2 / segments) * 0.7;
      const endAngle = startAngle + arcLength;
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.stroke();
    }
  }
}

// Crosshair + Tick Rings: Targeting reticle
function drawCrosshairRings(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  // Main rings
  drawCircle(ctx, cx, cy, baseRadius * 0.4);
  drawCircle(ctx, cx, cy, baseRadius * 0.6);
  
  // Crosshair
  const crossSize = baseRadius * 0.7;
  const gap = baseRadius * 0.1;
  
  // Horizontal
  ctx.beginPath();
  ctx.moveTo(cx - crossSize, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(cx + crossSize, cy);
  ctx.stroke();
  
  // Vertical
  ctx.beginPath();
  ctx.moveTo(cx, cy - crossSize);
  ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap);
  ctx.lineTo(cx, cy + crossSize);
  ctx.stroke();
  
  // Tick marks
  const ticks = 12;
  for (let i = 0; i < ticks; i++) {
    const angle = (i / ticks) * Math.PI * 2 + rotation;
    const r1 = baseRadius * 0.6;
    const r2 = baseRadius * 0.65;
    
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
    ctx.stroke();
  }
}

/**
 * Draw shape by type
 */
function drawShapeByType(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  rotation: number,
  shapeType: ShapeType,
  complexity: number
) {
  switch (shapeType) {
    case 'flower-of-life':
      drawFlowerOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'seed-of-life':
      drawSeedOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'metatron-cube':
      drawMetatronsCube(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sri-yantra':
      drawSriYantra(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'hexagon-lattice':
      drawHexagonLattice(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'triangle-grid':
      drawTriangleGrid(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vesica-piscis':
      drawVesicaPiscis(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'circle':
      drawSimpleCircle(ctx, cx, cy, baseRadius);
      break;
    case 'square':
      drawSimpleSquare(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'triangle':
      drawSimpleTriangle(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'pentagon':
      drawSimplePentagon(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'octagon':
      drawSimpleOctagon(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'torus-knot':
      drawTorusKnot(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'mandala':
      drawMandala(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'star-tetrahedron':
      drawStarTetrahedron(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'icosahedron':
      drawIcosahedron(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'merkaba':
      drawMerkaba(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'double-helix':
      drawDoubleHelix(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fibonacci-spiral':
      drawFibonacciSpiral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'golden-spiral':
      drawGoldenSpiral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'lotus-mandala':
      drawLotusMandala(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'celtic-knot':
      drawCelticKnot(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'platonic-solid':
      drawPlatonicSolid(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'labyrinth':
      drawLabyrinth(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
      
    // A. Sacred Geometry Classics - NEW SHAPES
    case 'sg-seed-of-life':
      drawSeedOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-flower-of-life':
      drawFlowerOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-flower-extended':
      drawFlowerExtended(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-vesica-piscis':
      drawVesicaPiscis(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-vesica-chain':
      drawVesicaChain(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-torus-halo':
      drawTorusHalo(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-metatron-cube':
      drawMetatronsCube(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sg-metatron-dense':
      drawMetatronDense(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-fruit-of-life':
      drawFruitOfLife(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-cube-of-space':
      drawCubeOfSpace(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-sri-yantra':
      drawSriYantra(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sg-sri-yantra-dense':
      drawSriYantraDense(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sg-merkaba':
      drawMerkaba(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-tetrahedron':
      drawTetrahedron(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-icosahedron':
      drawIcosahedron(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'sg-dodecahedron':
      drawDodecahedron(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'sg-platonic-stack':
      drawPlatonicStack(ctx, cx, cy, baseRadius, rotation);
      break;
      
    // B. Kaleidoscope & Symmetry - NEW SHAPES
    case 'kx-mirror-quad':
      drawMirrorQuad(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'kx-mirror-hex':
      drawMirrorHex(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'kx-mirror-oct':
      drawMirrorOct(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'kx-polar-wedge':
      drawPolarWedge(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-rosette':
      drawRosette(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-mandala-rings':
      drawMandala(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-radial-tiles':
      drawRadialTiles(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-dihedral':
      drawDihedral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'kx-seam-hide':
      drawSeamHide(ctx, cx, cy, baseRadius, rotation);
      break;
      
    // C. Spirograph / Guilloché / Moiré - NEW SHAPES
    case 'fx-spirograph-hypo':
      drawSpirographHypo(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-spirograph-epi':
      drawSpirographEpi(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-guilloche-rosette':
      drawGuillocheRosette(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-guilloche-ribbon':
      drawGuillocheRibbon(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-moire-disc':
      drawMoireDisc(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-moire-lattice':
      drawMoireLattice(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-lissajous':
      drawLissajous(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-harmonograph':
      drawHarmonograph(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-fibonacci-spiral':
      drawFibonacciSpiral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-golden-spiral':
      drawGoldenSpiral(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'fx-torus-knot':
      drawTorusKnot(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
      
    // D. Glyph / Rune / Hieroglyph - NEW SHAPES
    case 'gl-runic-ring':
      drawRunicRing(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-sigil-circle':
      drawSigilCircle(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-solar-disc':
      drawSolarDisc(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'gl-lunar-phases':
      drawLunarPhases(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'gl-alchemy-symbols':
      drawAlchemySymbols(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'gl-astral-chart':
      drawAstralChart(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-techno-hiero':
      drawTechnoHiero(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-circuit-glyph':
      drawCircuitGlyph(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-tablet-lines':
      drawTabletLines(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-compass-rose':
      drawCompassRose(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'gl-celtic-knot':
      drawCelticKnot(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-lotus-mandala':
      drawLotusMandala(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'gl-labyrinth':
      drawLabyrinth(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
      
    // E. Geometric Standard (VJ) - NEW SHAPES
    case 'vj-hex-grid':
      drawHexagonLattice(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-triangle-grid':
      drawTriangleGrid(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-isometric-grid':
      drawIsometricGrid(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-concentric-squares':
      drawConcentricSquares(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-concentric-triangles':
      drawConcentricTriangles(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-nested-polygons':
      drawNestedPolygons(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-star-polygon':
      drawStarPolygon(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-radial-lines':
      drawRadialLines(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-radar-sweep':
      drawRadarSweep(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-orbital-nodes':
      drawOrbitalNodes(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-arc-segments':
      drawArcSegments(ctx, cx, cy, baseRadius, rotation, complexity);
      break;
    case 'vj-crosshair-rings':
      drawCrosshairRings(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-circle':
      drawSimpleCircle(ctx, cx, cy, baseRadius);
      break;
    case 'vj-square':
      drawSimpleSquare(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-triangle':
      drawSimpleTriangle(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-pentagon':
      drawSimplePentagon(ctx, cx, cy, baseRadius, rotation);
      break;
    case 'vj-octagon':
      drawSimpleOctagon(ctx, cx, cy, baseRadius, rotation);
      break;
  }
}

// ============================================================================
// PHASE 4: SHAPE SAMPLING FOR TRUE MORPHING
// ============================================================================

/**
 * Generate raw sample points for a shape (used by shape sampler)
 * Returns points in local space around origin (0, 0)
 * FIXED: Now extracts actual geometry-specific points for each shape
 */
function generateShapeSamplePoints(
  shapeType: ShapeType,
  baseRadius: number,
  rotation: number,
  complexity: number
): Vec2[] {
  const sampleCount = 256;
  const points: Vec2[] = [];
  
  // Helper: Sample a regular polygon
  const samplePolygon = (sides: number, radius: number, rot: number): Vec2[] => {
    const pts: Vec2[] = [];
    const vertices = getCirclePoints(0, 0, radius, sides, rot);
    const pointsPerEdge = Math.floor(sampleCount / sides);
    
    for (let i = 0; i < sides; i++) {
      const a = vertices[i];
      const b = vertices[(i + 1) % sides];
      for (let j = 0; j < pointsPerEdge; j++) {
        const t = j / pointsPerEdge;
        pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    while (pts.length < sampleCount) pts.push(pts[0]);
    return pts.slice(0, sampleCount);
  };
  
  // Extract geometry-specific points for each shape type
  
  // Sacred Geometry: Flower patterns
  if (shapeType === 'sg-seed-of-life' || shapeType === 'sg-flower-of-life') {
    const circles = 7;
    const circleRadius = baseRadius * 0.4;
    const pointsPerCircle = Math.floor(sampleCount / circles);
    
    // Center circle
    for (let i = 0; i < pointsPerCircle; i++) {
      const angle = (i / pointsPerCircle) * Math.PI * 2;
      points.push({ x: Math.cos(angle) * circleRadius, y: Math.sin(angle) * circleRadius });
    }
    
    // 6 surrounding circles
    const centers = getCirclePoints(0, 0, circleRadius, 6, rotation);
    for (let c = 0; c < 6; c++) {
      for (let i = 0; i < pointsPerCircle; i++) {
        const angle = (i / pointsPerCircle) * Math.PI * 2;
        points.push({
          x: centers[c].x + Math.cos(angle) * circleRadius,
          y: centers[c].y + Math.sin(angle) * circleRadius
        });
      }
    }
    while (points.length < sampleCount) points.push(points[0]);
    return points.slice(0, sampleCount);
  }
  
  // Metatron's Cube
  if (shapeType === 'sg-metatron-cube' || shapeType === 'sg-metatron-dense') {
    const innerRadius = baseRadius * 0.25;
    const outerRadius = baseRadius * 0.6;
    const keyPoints: Vec2[] = [
      {x: 0, y: 0},
      ...getCirclePoints(0, 0, innerRadius, 6, rotation),
      ...getCirclePoints(0, 0, outerRadius, 6, rotation + Math.PI / 6)
    ];
    
    const connections: Array<[Vec2, Vec2]> = [];
    for (let i = 0; i < keyPoints.length; i++) {
      for (let j = i + 1; j < keyPoints.length; j++) {
        connections.push([keyPoints[i], keyPoints[j]]);
      }
    }
    
    const pointsPerEdge = Math.floor(sampleCount / connections.length);
    connections.forEach(([a, b]) => {
      for (let i = 0; i < pointsPerEdge; i++) {
        const t = i / pointsPerEdge;
        points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    });
    while (points.length < sampleCount) points.push(points[0]);
    return points.slice(0, sampleCount);
  }
  
  // Sri Yantra - nested triangles
  if (shapeType === 'sg-sri-yantra' || shapeType === 'sg-sri-yantra-dense') {
    const layers = Math.min(Math.max(3, Math.floor(complexity)), 9);
    const pointsPerLayer = Math.floor(sampleCount / layers);
    
    for (let layer = 0; layer < layers; layer++) {
      const radius = baseRadius * (0.3 + (layer / layers) * 0.6);
      const offset = layer % 2 === 0 ? 0 : Math.PI;
      const tri = getCirclePoints(0, 0, radius, 3, rotation + offset);
      
      for (let i = 0; i < pointsPerLayer; i++) {
        const t = i / pointsPerLayer;
        const edgeIdx = Math.floor(t * 3);
        const edgeT = (t * 3) % 1;
        const a = tri[edgeIdx];
        const b = tri[(edgeIdx + 1) % 3];
        points.push({ x: a.x + (b.x - a.x) * edgeT, y: a.y + (b.y - a.y) * edgeT });
      }
    }
    while (points.length < sampleCount) points.push(points[0]);
    return points.slice(0, sampleCount);
  }
  
  // Merkaba - star tetrahedron
  if (shapeType === 'sg-merkaba') {
    const radius = baseRadius * 0.5;
    const third = Math.floor(sampleCount / 3);
    
    // Outer circle
    for (let i = 0; i < third; i++) {
      const angle = (i / third) * Math.PI * 2;
      points.push({ x: Math.cos(angle) * baseRadius * 0.7, y: Math.sin(angle) * baseRadius * 0.7 });
    }
    
    // Upward triangle
    const up = getCirclePoints(0, 0, radius, 3, rotation);
    for (let i = 0; i < third; i++) {
      const t = i / third;
      const idx = Math.floor(t * 3);
      const edgeT = (t * 3) % 1;
      const a = up[idx];
      const b = up[(idx + 1) % 3];
      points.push({ x: a.x + (b.x - a.x) * edgeT, y: a.y + (b.y - a.y) * edgeT });
    }
    
    // Downward triangle
    const down = getCirclePoints(0, 0, radius, 3, rotation + Math.PI);
    const remaining = sampleCount - third * 2;
    for (let i = 0; i < remaining; i++) {
      const t = i / remaining;
      const idx = Math.floor(t * 3);
      const edgeT = (t * 3) % 1;
      const a = down[idx];
      const b = down[(idx + 1) % 3];
      points.push({ x: a.x + (b.x - a.x) * edgeT, y: a.y + (b.y - a.y) * edgeT });
    }
    return points;
  }
  
  // Simple polygons
  if (shapeType === 'vj-circle') return samplePolygon(64, baseRadius * 0.6, rotation);
  if (shapeType === 'vj-triangle' || shapeType === 'sg-tetrahedron') return samplePolygon(3, baseRadius * 0.6, rotation);
  if (shapeType === 'vj-square') return samplePolygon(4, baseRadius * 0.5, rotation + Math.PI / 4);
  if (shapeType === 'vj-pentagon') return samplePolygon(5, baseRadius * 0.6, rotation);
  if (shapeType === 'vj-octagon') return samplePolygon(8, baseRadius * 0.6, rotation);
  
  // Spirals
  if (shapeType === 'fx-fibonacci-spiral') {
    const phi = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < sampleCount; i++) {
      const t = (i / sampleCount) * Math.PI * 2.5;
      const r = Math.min(baseRadius * 0.09 * Math.pow(phi, t / Math.PI), baseRadius * 1.8);
      const angle = t + rotation;
      points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return points;
  }
  
  if (shapeType === 'fx-golden-spiral') {
    const phi = (1 + Math.sqrt(5)) / 2;
    const b = Math.log(phi) / (Math.PI / 2);
    for (let i = 0; i < sampleCount; i++) {
      const t = (i / sampleCount) * Math.PI * 3;
      const r = Math.min(baseRadius * 0.046875 * Math.exp(b * t), baseRadius * 1.5);
      const angle = t + rotation;
      points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return points;
  }
  
  if (shapeType === 'fx-torus-knot') {
    const p = 2, q = 3;
    for (let i = 0; i < sampleCount; i++) {
      const t = (i / sampleCount) * Math.PI * 2 * q;
      const r = baseRadius * 0.55 * (0.8 + 0.2 * Math.cos(p * t));
      const angle = q * t + rotation;
      points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return points;
  }
  
  // Default: intelligent radial sampling with shape-specific modulation
  const getRadius = (angle: number): number => {
    if (shapeType.includes('star')) {
      const pts = 5;
      const inner = 0.4;
      const mod = (angle / (Math.PI * 2)) * pts % 1;
      return baseRadius * 0.6 * (inner + (1 - inner) * Math.abs(mod - 0.5) * 2);
    }
    if (shapeType.includes('mandala') || shapeType.includes('lotus')) {
      return baseRadius * 0.6 * (0.8 + Math.sin(angle * 8) * 0.2);
    }
    return baseRadius * 0.6;
  };
  
  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * Math.PI * 2 + rotation;
    const r = getRadius(angle);
    points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  
  return points;
}

/**
 * Render morphed shape using path interpolation
 * TRUE geometric morphing with point correspondence
 */
function renderMorphedShape(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  params: AstralShaperParams,
  audioData: AudioAnalysisData,
  baseRadius: number,
  rotation: number,
  strokeColor: string,
  thickness: number,
  shadowBlur: number,
  shadowColor: string,
  globalAlpha: number,
  colors: string[],
  timeSec: number
): void {
  // Get sampled shapes with caching
  const shapeASampler = () => generateShapeSamplePoints(params.shape, 1.0, 0, params.complexity);
  const shapeBSampler = () => generateShapeSamplePoints(params.nextShape, 1.0, 0, params.complexity);
  
  const sampledA = getCachedSampledShape(
    params.shape,
    params.complexity,
    256,
    params.symmetryFold,
    shapeASampler
  );
  
  const sampledB = getCachedSampledShape(
    params.nextShape,
    params.complexity,
    256,
    params.symmetryFold,
    shapeBSampler
  );
  
  // Interpolate shapes with morph origin
  let morphedPoints = interpolateShapes(
    sampledA,
    sampledB,
    params.morphAmount,
    params.morphOrigin
  );
  
  // FIX 3: Scale down field modulation during mid-morph for stability
  const morphMid = params.morphAmount > 0.2 && params.morphAmount < 0.8;
  const modulationScale = morphMid ? 0.35 : 1.0;
  
  // Apply field modulation if enabled (scaled during morph)
  if (params.fieldModulation > 0.01 && modulationScale > 0) {
    const fieldParams: FieldModulationParams = {
      strength: params.fieldModulation * modulationScale,
      timeSpeed: 1.0,
      angularFreq: 4.0,
      audioInfluence: params.audioInfluence
    };
    
    morphedPoints = applyFieldModulation(
      morphedPoints,
      params.morphAmount,
      audioData.mid,
      timeSec,
      fieldParams
    );
  }
  
  // FIX 6: Render directly without allocating scaledPoints array
  ctx.save();
  ctx.globalAlpha = globalAlpha;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = thickness;
  
  // Apply shadow/glow
  if (shadowBlur > 0) {
    ctx.shadowBlur = shadowBlur;
    ctx.shadowColor = shadowColor;
  }
  
  // Draw the path (no intermediate array allocation)
  if (params.kaleidoscope) {
    // Kaleidoscope mode: replicate path with rotational symmetry
    for (let i = 0; i < params.symmetryFold; i++) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((i / params.symmetryFold) * Math.PI * 2);
      ctx.translate(-centerX, -centerY);
      
      ctx.beginPath();
      for (let j = 0; j < morphedPoints.length; j++) {
        const x = centerX + morphedPoints[j].x * baseRadius;
        const y = centerY + morphedPoints[j].y * baseRadius;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      
      ctx.restore();
    }
  } else {
    // Normal mode: draw single path
    ctx.beginPath();
    for (let i = 0; i < morphedPoints.length; i++) {
      const x = centerX + morphedPoints[i].x * baseRadius;
      const y = centerY + morphedPoints[i].y * baseRadius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  
  ctx.restore();
}

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
 * PHASE 3: OPTIMIZED RENDERING WITH OFFSCREEN CANVAS CACHE
 * Renders shape once to cache, then instances for kaleidoscope mode
 */
function renderShapeWithCache(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  baseRadius: number,
  rotation: number,
  shapeType: ShapeType,
  complexity: number,
  strokeColor: string,
  lineWidth: number,
  strokeStyle: StrokeStyle,
  shadowBlur: number,
  shadowColor: string,
  globalAlpha: number,
  kaleidoscope: boolean,
  symmetryFold: number,
  rainbowSpectrum: boolean,
  colors: string[],
  isMorphing: boolean = false
): void {
  // BYPASS CACHING for effects that need live rendering (rainbow, glow effects, morphing)
  // FIX 3: Bypass cache during morphing to prevent jitter/kaleidoscope delay
  const bypassCache = rainbowSpectrum || shadowBlur > 0 || isMorphing;
  
  if (bypassCache) {
    // DIRECT RENDERING without cache - needed for gradients and shadow effects
    
    // Setup stroke color
    let finalStrokeStyle: string | CanvasGradient = strokeColor;
    
    // RAINBOW SPECTRUM: Create radial gradient
    if (rainbowSpectrum && colors.length > 1) {
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius);
      colors.forEach((color, i) => {
        gradient.addColorStop(i / (colors.length - 1), color);
      });
      finalStrokeStyle = gradient;
    }
    
    // FIX 4B: DISABLED composite glow for kaleidoscope - causes clipping issues
    // Instead, apply glow to each kaleidoscope fold individually (simpler, more reliable)
    const useCompositeGlow = false; // Disabled to prevent clipping with kaleidoscope
    let tempCanvas: any = null;
    let tempCtx: CanvasRenderingContext2D | null = null;
    
    if (useCompositeGlow) {
      // Create temporary canvas for kaleidoscope rendering WITHOUT glow
      // CRITICAL FIX: Expand canvas size to prevent glow clipping
      // Shadow blur can extend up to shadowBlur pixels in all directions
      const padding = Math.ceil(shadowBlur * 2); // Extra padding for glow overflow
      tempCanvas = createAstralCanvas();
      tempCanvas.width = ctx.canvas.width + padding * 2;
      tempCanvas.height = ctx.canvas.height + padding * 2;
      tempCtx = tempCanvas.getContext('2d')!;
      if (!tempCtx) return;
      
      // Offset drawing position to account for padding
      const offsetX = padding;
      const offsetY = padding;
      
      // Setup temp context (NO shadow here)
      tempCtx.globalAlpha = globalAlpha;
      tempCtx.strokeStyle = finalStrokeStyle;
      tempCtx.lineWidth = lineWidth;
      
      // Stroke style
      switch (strokeStyle) {
        case 'dashed':
          tempCtx.setLineDash([lineWidth * 2, lineWidth]);
          break;
        case 'dotted':
          tempCtx.setLineDash([lineWidth * 0.5, lineWidth * 1.5]);
          break;
        default:
          tempCtx.setLineDash([]);
          break;
      }
      
      // Render kaleidoscope to temp canvas WITHOUT shadow (with offset for padding)
      for (let i = 0; i < symmetryFold; i++) {
        tempCtx.save();
        tempCtx.translate(centerX + offsetX, centerY + offsetY);
        tempCtx.rotate((i / symmetryFold) * Math.PI * 2);
        tempCtx.translate(-(centerX + offsetX), -(centerY + offsetY));
        drawShapeByType(tempCtx, centerX + offsetX, centerY + offsetY, baseRadius, rotation, shapeType, complexity);
        tempCtx.restore();
      }
      
      // Now draw temp canvas to main context WITH shadow (single glow operation)
      // Offset back to original position to account for padding
      ctx.save();
      ctx.shadowBlur = shadowBlur;
      ctx.shadowColor = shadowColor;
      ctx.drawImage(tempCanvas, -padding, -padding);
      ctx.restore();
      
    } else {
      // Normal rendering (original path)
      ctx.save();
      ctx.globalAlpha = globalAlpha;
      ctx.strokeStyle = finalStrokeStyle;
      ctx.lineWidth = lineWidth;
      
      // Apply shadow/glow effect (non-kaleidoscope or no glow)
      if (shadowBlur > 0) {
        ctx.shadowBlur = shadowBlur;
        ctx.shadowColor = shadowColor;
      }
      
      // Stroke style
      switch (strokeStyle) {
        case 'dashed':
          ctx.setLineDash([lineWidth * 2, lineWidth]);
          break;
        case 'dotted':
          ctx.setLineDash([lineWidth * 0.5, lineWidth * 1.5]);
          break;
        default:
          ctx.setLineDash([]);
          break;
      }
      
      // Render with kaleidoscope if needed
      if (kaleidoscope) {
        for (let i = 0; i < symmetryFold; i++) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate((i / symmetryFold) * Math.PI * 2);
          ctx.translate(-centerX, -centerY);
          drawShapeByType(ctx, centerX, centerY, baseRadius, rotation, shapeType, complexity);
          ctx.restore();
        }
      } else {
        drawShapeByType(ctx, centerX, centerY, baseRadius, rotation, shapeType, complexity);
      }
      
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
    }
    return;
  }
  
  // NORMAL RENDERING: Use caching
  // Generate cache key
  const cacheKey = getCacheKey(
    shapeType,
    baseRadius,
    rotation,
    complexity,
    strokeColor,
    lineWidth,
    strokeStyle
  );
  
  // Get or create cache
  const cache = getOrCreateCache(cacheKey, baseRadius);
  
  // Check if we need to render to cache
  if (!cache.isRendered) {
    // Clear cache canvas
    const cacheCtx = cache.ctx;
    cacheCtx.clearRect(0, 0, cache.canvas.width, cache.canvas.height);
    
    // Setup rendering context for cache
    cacheCtx.strokeStyle = strokeColor;
    cacheCtx.lineWidth = lineWidth;
    cacheCtx.globalAlpha = 1.0; // Full alpha in cache, we'll apply alpha when drawing
    
    // Stroke style
    switch (strokeStyle) {
      case 'dashed':
        cacheCtx.setLineDash([lineWidth * 2, lineWidth]);
        break;
      case 'dotted':
        cacheCtx.setLineDash([lineWidth * 0.5, lineWidth * 1.5]);
        break;
      case 'glowing':
        cacheCtx.setLineDash([]);
        cacheCtx.shadowBlur = shadowBlur;
        cacheCtx.shadowColor = shadowColor;
        break;
      default:
        cacheCtx.setLineDash([]);
        break;
    }
    
    // Render shape to center of cache canvas
    const cacheCenterX = cache.canvas.width / 2;
    const cacheCenterY = cache.canvas.height / 2;
    
    drawShapeByType(cacheCtx, cacheCenterX, cacheCenterY, baseRadius, rotation, shapeType, complexity);
    
    // Mark as rendered
    cache.isRendered = true;
    
    // Reset cache context
    cacheCtx.setLineDash([]);
    cacheCtx.shadowBlur = 0;
  }
  
  // Now instance the cached shape to main canvas
  if (kaleidoscope) {
    // INSTANCING: Draw cached shape multiple times with transformations
    for (let i = 0; i < symmetryFold; i++) {
      ctx.save();
      
      ctx.globalAlpha = globalAlpha;
      
      // Apply shadow blur
      if (shadowBlur > 0) {
        ctx.shadowBlur = shadowBlur;
        ctx.shadowColor = shadowColor;
      }
      
      // Rotate around center point
      ctx.translate(centerX, centerY);
      ctx.rotate((i / symmetryFold) * Math.PI * 2);
      ctx.translate(-centerX, -centerY);
      
      // Draw cached shape
      const offsetX = centerX - cache.canvas.width / 2;
      const offsetY = centerY - cache.canvas.height / 2;
      ctx.drawImage(cache.canvas, offsetX, offsetY);
      
      ctx.restore();
    }
  } else {
    // Single instance
    ctx.save();
    ctx.globalAlpha = globalAlpha;
    
    if (shadowBlur > 0) {
      ctx.shadowBlur = shadowBlur;
      ctx.shadowColor = shadowColor;
    }
    
    // Draw cached shape centered
    const offsetX = centerX - cache.canvas.width / 2;
    const offsetY = centerY - cache.canvas.height / 2;
    ctx.drawImage(cache.canvas, offsetX, offsetY);
    
    ctx.restore();
  }
  
  // Reset main context
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get cycle duration in milliseconds based on speed and BPM
 */
export function getCycleDuration(speed: AutoCycleSpeed, bpm: number): number {
  const beatDuration = 60000 / bpm; // milliseconds per beat
  
  switch (speed) {
    case 'slug':
      return beatDuration * 32;
    case 'slow':
      return beatDuration * 24;
    case 'medium':
      return beatDuration * 16;
    case 'fast':
      return beatDuration * 8;
    case 'chaos':
      return beatDuration * 4;
    default:
      return beatDuration * 24; // Default to slow
  }
}

/**
 * Get all available shapes for cycling - NEW CATEGORIZED STRUCTURE
 */
export function getAllShapes(): ShapeType[] {
  return [
    // A. Sacred Geometry Classics
    'sg-seed-of-life',
    'sg-flower-of-life',
    'sg-flower-extended',
    'sg-vesica-piscis',
    'sg-vesica-chain',
    'sg-torus-halo',
    'sg-metatron-cube',
    'sg-metatron-dense',
    'sg-fruit-of-life',
    'sg-cube-of-space',
    'sg-sri-yantra',
    'sg-sri-yantra-dense',
    'sg-merkaba',
    'sg-tetrahedron',
    'sg-icosahedron',
    'sg-dodecahedron',
    'sg-platonic-stack',
    
    // B. Kaleidoscope & Symmetry
    'kx-mirror-quad',
    'kx-mirror-hex',
    'kx-mirror-oct',
    'kx-polar-wedge',
    'kx-rosette',
    'kx-mandala-rings',
    'kx-radial-tiles',
    'kx-dihedral',
    'kx-seam-hide',
    
    // C. Spirograph / Guilloché / Moiré
    'fx-spirograph-hypo',
    'fx-spirograph-epi',
    'fx-guilloche-rosette',
    'fx-guilloche-ribbon',
    'fx-moire-disc',
    'fx-moire-lattice',
    'fx-lissajous',
    'fx-harmonograph',
    'fx-fibonacci-spiral',
    'fx-golden-spiral',
    'fx-torus-knot',
    
    // D. Glyph / Rune / Hieroglyph
    'gl-runic-ring',
    'gl-sigil-circle',
    'gl-solar-disc',
    'gl-lunar-phases',
    'gl-alchemy-symbols',
    'gl-astral-chart',
    'gl-techno-hiero',
    'gl-circuit-glyph',
    'gl-tablet-lines',
    'gl-compass-rose',
    'gl-celtic-knot',
    'gl-lotus-mandala',
    'gl-labyrinth',
    
    // E. Geometric Standard (VJ)
    'vj-hex-grid',
    'vj-triangle-grid',
    'vj-isometric-grid',
    'vj-concentric-squares',
    'vj-concentric-triangles',
    'vj-nested-polygons',
    'vj-star-polygon',
    'vj-radial-lines',
    'vj-radar-sweep',
    'vj-orbital-nodes',
    'vj-arc-segments',
    'vj-crosshair-rings',
    'vj-circle',
    'vj-square',
    'vj-triangle',
    'vj-pentagon',
    'vj-octagon'
  ];
}

/**
 * Get next shape in cycle
 */
export function getNextShape(currentShape: ShapeType): ShapeType {
  const shapes = getAllShapes();
  const currentIndex = shapes.indexOf(currentShape);
  return shapes[(currentIndex + 1) % shapes.length];
}

/**
 * Get display name for shape (with abbreviation prefix)
 */
export function getShapeDisplayName(shape: ShapeType): string {
  const nameMap: Record<ShapeType, string> = {
    // A. Sacred Geometry Classics
    'sg-seed-of-life': 'SG: Seed of Life',
    'sg-flower-of-life': 'SG: Flower of Life',
    'sg-flower-extended': 'SG: Flower of Life Extended',
    'sg-vesica-piscis': 'SG: Vesica Piscis',
    'sg-vesica-chain': 'SG: Vesica Chain',
    'sg-torus-halo': 'SG: Torus Halo',
    'sg-metatron-cube': 'SG: Metatron\'s Cube',
    'sg-metatron-dense': 'SG: Metatron Dense',
    'sg-fruit-of-life': 'SG: Fruit of Life',
    'sg-cube-of-space': 'SG: Cube of Space',
    'sg-sri-yantra': 'SG: Sri Yantra',
    'sg-sri-yantra-dense': 'SG: Sri Yantra Dense',
    'sg-merkaba': 'SG: Merkaba Wireframe',
    'sg-tetrahedron': 'SG: Tetrahedron Wireframe',
    'sg-icosahedron': 'SG: Icosahedron Wireframe',
    'sg-dodecahedron': 'SG: Dodecahedron Wireframe',
    'sg-platonic-stack': 'SG: Platonic Stack',
    
    // B. Kaleidoscope & Symmetry
    'kx-mirror-quad': 'KX: Mirror Quad',
    'kx-mirror-hex': 'KX: Mirror Hex',
    'kx-mirror-oct': 'KX: Mirror Oct',
    'kx-polar-wedge': 'KX: Polar Wedge',
    'kx-rosette': 'KX: Rosette',
    'kx-mandala-rings': 'KX: Mandala Rings',
    'kx-radial-tiles': 'KX: Radial Tiles',
    'kx-dihedral': 'KX: Dihedral Symmetry',
    'kx-seam-hide': 'KX: Seam-Hide Mirror',
    
    // C. Spirograph / Guilloché / Moiré
    'fx-spirograph-hypo': 'FX: Spirograph Hypotrochoid',
    'fx-spirograph-epi': 'FX: Spirograph Epitrochoid',
    'fx-guilloche-rosette': 'FX: Guilloché Rosette',
    'fx-guilloche-ribbon': 'FX: Guilloché Ribbon Rings',
    'fx-moire-disc': 'FX: Moiré Interference Disc',
    'fx-moire-lattice': 'FX: Moiré Lattice Rings',
    'fx-lissajous': 'FX: Lissajous Knot',
    'fx-harmonograph': 'FX: Harmonograph',
    'fx-fibonacci-spiral': 'FX: Fibonacci Spiral',
    'fx-golden-spiral': 'FX: Golden Spiral',
    'fx-torus-knot': 'FX: Torus Knot',
    
    // D. Glyph / Rune / Hieroglyph
    'gl-runic-ring': 'GL: Runic Ring',
    'gl-sigil-circle': 'GL: Sigil Circle',
    'gl-solar-disc': 'GL: Solar Disc Glyph',
    'gl-lunar-phases': 'GL: Lunar Phases Glyph Ring',
    'gl-alchemy-symbols': 'GL: Alchemy Symbols Ring',
    'gl-astral-chart': 'GL: Astral Chart Marks',
    'gl-techno-hiero': 'GL: Techno-Hiero Blocks',
    'gl-circuit-glyph': 'GL: Circuit Glyph Mandala',
    'gl-tablet-lines': 'GL: Tablet Lines',
    'gl-compass-rose': 'GL: Compass Rose Glyph',
    'gl-celtic-knot': 'GL: Celtic Knot',
    'gl-lotus-mandala': 'GL: Lotus Mandala',
    'gl-labyrinth': 'GL: Labyrinth',
    
    // E. Geometric Standard (VJ)
    'vj-hex-grid': 'VJ: Wire Hex Grid',
    'vj-triangle-grid': 'VJ: Triangle Grid',
    'vj-isometric-grid': 'VJ: Isometric Grid',
    'vj-concentric-squares': 'VJ: Concentric Squares',
    'vj-concentric-triangles': 'VJ: Concentric Triangles',
    'vj-nested-polygons': 'VJ: Nested Polygons',
    'vj-star-polygon': 'VJ: Star Polygon',
    'vj-radial-lines': 'VJ: Radial Lines Burst',
    'vj-radar-sweep': 'VJ: Radar Sweep Lines',
    'vj-orbital-nodes': 'VJ: Orbital Nodes + Links',
    'vj-arc-segments': 'VJ: Arc Segments HUD',
    'vj-crosshair-rings': 'VJ: Crosshair + Tick Rings',
    'vj-circle': 'VJ: Circle',
    'vj-square': 'VJ: Square',
    'vj-triangle': 'VJ: Triangle',
    'vj-pentagon': 'VJ: Pentagon',
    'vj-octagon': 'VJ: Octagon',
    
    // Backwards compatibility (old names)
    'flower-of-life': 'Flower of Life',
    'seed-of-life': 'Seed of Life',
    'metatron-cube': 'Metatron\'s Cube',
    'sri-yantra': 'Sri Yantra',
    'hexagon-lattice': 'Hexagon Lattice',
    'triangle-grid': 'Triangle Grid',
    'vesica-piscis': 'Vesica Piscis',
    'circle': 'Circle',
    'square': 'Square',
    'triangle': 'Triangle',
    'pentagon': 'Pentagon',
    'octagon': 'Octagon',
    'torus-knot': 'Torus Knot',
    'mandala': 'Mandala',
    'star-tetrahedron': 'Star Tetrahedron',
    'icosahedron': 'Icosahedron',
    'merkaba': 'Merkaba',
    'double-helix': 'Double Helix',
    'fibonacci-spiral': 'Fibonacci Spiral',
    'golden-spiral': 'Golden Spiral',
    'lotus-mandala': 'Lotus Mandala',
    'celtic-knot': 'Celtic Knot',
    'platonic-solid': 'Platonic Solid',
    'labyrinth': 'Labyrinth'
  };
  
  return nameMap[shape] || shape;
}

/**
 * Keeps a preset/import-only shape visible in the curated selector without
 * permanently restoring the retired catalog to the active UI.
 */
export function syncLiquidShapeSelect(select: HTMLSelectElement, shape: ShapeType): void {
  let option: HTMLOptionElement | undefined;
  for (let index = select.options.length - 1; index >= 0; index -= 1) {
    const candidate = select.options[index];
    if (candidate.value === shape) option = candidate;
    else if (candidate.dataset.liquidCompatibility === 'true') candidate.remove();
  }
  if (!option) {
    option = document.createElement('option');
    option.value = shape;
    option.textContent = `Compatibility: ${getShapeDisplayName(shape)}`;
    option.dataset.liquidCompatibility = 'true';
    select.appendChild(option);
  }
  select.value = shape;
}
