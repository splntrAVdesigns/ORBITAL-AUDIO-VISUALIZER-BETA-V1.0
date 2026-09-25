/**
 * Liquid Shaper - Expanded library, phase 3: spirograph, guilloche, moire.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import { drawCircle } from '../primitives';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: SPIROGRAPH / GUILLOCHÉ / MOIRÉ (8 shapes)
// ═══════════════════════════════════════════════════════════════════════════

// Spirograph Hypotrochoid: Classic inner spiral
export function drawSpirographHypo(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawSpirographEpi(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawGuillocheRosette(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawGuillocheRibbon(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawMoireDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawMoireLattice(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawLissajous(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawHarmonograph(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
