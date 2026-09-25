/**
 * Liquid Shaper - Low-level geometry drawing helpers shared by shape generators.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */

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
export function setProgressiveAlpha(ctx: CanvasRenderingContext2D, layerIndex: number, totalLayers: number): void {
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
export function getCirclePoints(cx: number, cy: number, radius: number, count: number, rotation: number = 0): Array<{x: number, y: number}> {
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
export function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

// Helper: Connect all points
export function connectPoints(ctx: CanvasRenderingContext2D, points: Array<{x: number, y: number}>, closed: boolean = false) {
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
export function connectAllPoints(ctx: CanvasRenderingContext2D, points: Array<{x: number, y: number}>) {
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[j].x, points[j].y);
      ctx.stroke();
    }
  }
}
