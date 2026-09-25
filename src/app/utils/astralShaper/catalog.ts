/**
 * Liquid Shaper - Shape catalog: full shape list, curated auto-cycle, display names,
 * morph families, cycle timing and <select> sync.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */
import type { AutoCycleSpeed, ShapeType } from './types';

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
