/**
 * Liquid Shaper - LEGACY / UNUSED BY PRODUCTION RENDER PATH.
 * renderShapeWithCache (and the shape cache it fills) is not called by
 * drawAstralShaper or anywhere else in the app. clearStaleCache stays public
 * because the frame controller and presets still call it; clearCache lives in
 * the core because it must also clear the live texture cache.
 * Candidate for removal in a cleanup sprint.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import { createAstralCanvas } from './canvas';
import { drawShapeByType } from './shapes/drawShapeByType';
import type { ShapeType, StrokeStyle, Vec2 } from './types';

// ============================================================================
// PHASE 3: OFFSCREEN CANVAS CACHE SYSTEM
// ============================================================================

export interface ShapeCache {
  canvas: any;
  ctx: CanvasRenderingContext2D;
  cacheKey: string;
  timestamp: number;
  isRendered: boolean;
}

// Cache storage: Map<cacheKey, ShapeCache>
export const shapeCache = new Map<string, ShapeCache>();
export const MAX_CACHE_SIZE = 20; // Limit cache to prevent memory bloat
export const CACHE_DURATION = 5000; // Clear unused caches after 5s
export const scratchAlignedPoints: Vec2[] = [];

/**
 * Generate cache key from rendering parameters
 */
export function getCacheKey(
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
export function getOrCreateCache(cacheKey: string, size: number): ShapeCache {
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
 * PHASE 3: OPTIMIZED RENDERING WITH OFFSCREEN CANVAS CACHE
 * Renders shape once to cache, then instances for kaleidoscope mode
 */
export function renderShapeWithCache(
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

/** Empty the legacy shape cache (used by clearCache in the render core). */
export function clearLegacyShapeCache(): void {
  shapeCache.clear();
}
