/**
 * Liquid Shaper - Original sacred geometry generators.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import { connectAllPoints, connectPoints, drawCircle, getCirclePoints, setProgressiveAlpha } from '../primitives';

// ============================================================================
// SACRED GEOMETRY GENERATORS
// ============================================================================

// Flower of Life: 7 overlapping circles in hexagonal pattern
export function drawFlowerOfLife(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const centers = getCirclePoints(cx, cy, baseRadius * 0.5, 6, rotation);
  
  // Draw center circle
  drawCircle(ctx, cx, cy, baseRadius * 0.5);
  
  // Draw 6 surrounding circles
  centers.forEach(center => {
    drawCircle(ctx, center.x, center.y, baseRadius * 0.5);
  });
}

// Seed of Life: Inner 6 circles only (subset of Flower of Life)
export function drawSeedOfLife(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const centers = getCirclePoints(cx, cy, baseRadius * 0.4, 6, rotation);
  
  // Draw 6 circles only (no center circle)
  centers.forEach(center => {
    drawCircle(ctx, center.x, center.y, baseRadius * 0.4);
  });
}

// Metatron's Cube: 13 circles + connecting lines
export function drawMetatronsCube(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawSriYantra(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawHexagonLattice(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawTriangleGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawVesicaPiscis(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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

export function drawSimpleCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number) {
  drawCircle(ctx, cx, cy, baseRadius * 0.6);
}

export function drawSimpleSquare(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.5, 4, rotation + Math.PI / 4);
  connectPoints(ctx, points, true);
}

export function drawSimpleTriangle(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, 3, rotation);
  connectPoints(ctx, points, true);
}

export function drawSimplePentagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, 5, rotation);
  connectPoints(ctx, points, true);
}

export function drawSimpleOctagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
  const points = getCirclePoints(cx, cy, baseRadius * 0.6, 8, rotation);
  connectPoints(ctx, points, true);
}

// NEW SACRED GEOMETRY SHAPES (12 more)

// Torus Knot: 3D knot projected to 2D (LARGER)
export function drawTorusKnot(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawMandala(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawStarTetrahedron(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawIcosahedron(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawMerkaba(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number) {
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
export function drawDoubleHelix(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawFibonacciSpiral(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawGoldenSpiral(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawLotusMandala(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawCelticKnot(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawPlatonicSolid(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
export function drawLabyrinth(ctx: CanvasRenderingContext2D, cx: number, cy: number, baseRadius: number, rotation: number, complexity: number) {
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
