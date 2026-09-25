/**
 * Liquid Shaper - Expanded library, phase 1: sacred geometry classics.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import { connectAllPoints, connectPoints, drawCircle, getCirclePoints } from '../primitives';

// ============================================================================
// NEW SHAPES - EXPANDED LIBRARY
// ============================================================================

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: SACRED GEOMETRY CLASSICS - NEW ADDITIONS (10 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Flower of Life Extended: Larger lattice with 19 circles
export function drawFlowerExtended(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawVesicaChain(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawTorusHalo(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawMetatronDense(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawFruitOfLife(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawCubeOfSpace(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawSriYantraDense(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawTetrahedron(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawDodecahedron(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawPlatonicStack(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  // Inner triangle
  const tri = getCirclePoints(cx, cy, baseRadius * 0.3, 3, rotation);
  connectPoints(ctx, tri, true);
  
  // Mid hexagon
  const hex = getCirclePoints(cx, cy, baseRadius * 0.5, 6, rotation);
  connectPoints(ctx, hex, true);
  
  // Outer circle
  drawCircle(ctx, cx, cy, baseRadius * 0.7);
}
