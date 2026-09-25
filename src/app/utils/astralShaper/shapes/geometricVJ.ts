/**
 * Liquid Shaper - Expanded library, phase 5: geometric standard (VJ).
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import { connectPoints, drawCircle, getCirclePoints } from '../primitives';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5A: GEOMETRIC STANDARD (VJ) - Part 1 of 2 (7 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Isometric Grid: 3D-style grid
export function drawIsometricGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawConcentricSquares(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(3, Math.floor(complexity)), 12);
  
  for (let i = 0; i < layers; i++) {
    const size = baseRadius * (0.2 + (i / layers) * 0.9);
    const points = getCirclePoints(cx, cy, size, 4, rotation + Math.PI / 4);
    connectPoints(ctx, points, true);
  }
}

// Concentric Triangles
export function drawConcentricTriangles(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
  const layers = Math.min(Math.max(3, Math.floor(complexity)), 12);
  
  for (let i = 0; i < layers; i++) {
    const size = baseRadius * (0.2 + (i / layers) * 0.7);
    const offset = i % 2 === 0 ? 0 : Math.PI;
    const points = getCirclePoints(cx, cy, size, 3, rotation + offset);
    connectPoints(ctx, points, true);
  }
}

// Nested Polygons: Variable N-gons
export function drawNestedPolygons(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawStarPolygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawRadialLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawRadarSweep(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawOrbitalNodes(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawArcSegments(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawCrosshairRings(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
