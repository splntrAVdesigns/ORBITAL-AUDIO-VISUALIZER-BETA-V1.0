/**
 * Liquid Shaper - LEGACY / UNUSED BY PRODUCTION RENDER PATH.
 * renderMorphedShape (and the sample cache it fills) is not called by
 * drawAstralShaper or anywhere else in the app. clearShapeSampleCache stays
 * public because App still calls it. Candidate for removal in a cleanup sprint.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import { getCirclePoints } from './primitives';
import type { AstralShaperParams, AudioAnalysisData, FieldModulationParams, MorphOrigin, ShapeType, Vec2 } from './types';

export const sampledShapeCache = new Map<string, Vec2[]>();

export function clearShapeSampleCache(): void {
  sampledShapeCache.clear();
}

export function getCachedSampledShape(
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

export function interpolateShapes(from: Vec2[], to: Vec2[], amount: number, origin: MorphOrigin): Vec2[] {
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

export function applyFieldModulation(
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

// ============================================================================
// PHASE 4: SHAPE SAMPLING FOR TRUE MORPHING
// ============================================================================

/**
 * Generate raw sample points for a shape (used by shape sampler)
 * Returns points in local space around origin (0, 0)
 * FIXED: Now extracts actual geometry-specific points for each shape
 */
export function generateShapeSamplePoints(
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
export function renderMorphedShape(
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
