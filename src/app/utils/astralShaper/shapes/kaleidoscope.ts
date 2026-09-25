/**
 * Liquid Shaper - Expanded library, phase 2: kaleidoscope and symmetry.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import { connectPoints, drawCircle, getCirclePoints } from '../primitives';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: KALEIDOSCOPE & SYMMETRY (9 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Mirror Quad: 2-axis mirror (90° symmetry)
export function drawMirrorQuad(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawMirrorHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawMirrorOct(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawPolarWedge(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawRosette(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawRadialTiles(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawDihedral(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawSeamHide(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  // Overlapping concentric patterns that hide polar seams
  const rings = 5;
  for (let i = 0; i < rings; i++) {
    const radius = baseRadius * (0.2 + (i / rings) * 0.5);
    const segments = 6 + i * 2;
    
    const points = getCirclePoints(cx, cy, radius, segments, rotation + (i * Math.PI / segments));
    connectPoints(ctx, points, true);
  }
}
