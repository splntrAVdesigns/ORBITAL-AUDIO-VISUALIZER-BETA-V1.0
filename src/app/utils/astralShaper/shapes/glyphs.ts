/**
 * Liquid Shaper - Expanded library, phase 4: glyph, rune, hieroglyph.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import { connectPoints, drawCircle, getCirclePoints } from '../primitives';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4A: GLYPH / RUNE / HIEROGLYPH (Part 1 of 2 - 5 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Runic Ring: Elder-style strokes
export function drawRunicRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawSigilCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawSolarDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawLunarPhases(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawAlchemySymbols(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawAstralChart(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawTechnoHiero(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawCircuitGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawTabletLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawCompassRose(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
