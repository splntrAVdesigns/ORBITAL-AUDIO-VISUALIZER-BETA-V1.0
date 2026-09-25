/**
 * Liquid Shaper - Public and internal type definitions for the Liquid Shaper.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface FieldModulationParams {
  strength: number;
  timeSpeed: number;
  angularFreq: number;
  audioInfluence: number;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ShapeType = 
  // A. Sacred Geometry Classics
  | 'sg-seed-of-life'
  | 'sg-flower-of-life'
  | 'sg-flower-extended'
  | 'sg-vesica-piscis'
  | 'sg-vesica-chain'
  | 'sg-torus-halo'
  | 'sg-metatron-cube'
  | 'sg-metatron-dense'
  | 'sg-fruit-of-life'
  | 'sg-cube-of-space'
  | 'sg-sri-yantra'
  | 'sg-sri-yantra-dense'
  | 'sg-merkaba'
  | 'sg-tetrahedron'
  | 'sg-icosahedron'
  | 'sg-dodecahedron'
  | 'sg-platonic-stack'
  
  // B. Kaleidoscope & Symmetry
  | 'kx-mirror-quad'
  | 'kx-mirror-hex'
  | 'kx-mirror-oct'
  | 'kx-polar-wedge'
  | 'kx-rosette'
  | 'kx-mandala-rings'
  | 'kx-radial-tiles'
  | 'kx-dihedral'
  | 'kx-seam-hide'
  
  // C. Spirograph / Guilloché / Moiré
  | 'fx-spirograph-hypo'
  | 'fx-spirograph-epi'
  | 'fx-guilloche-rosette'
  | 'fx-guilloche-ribbon'
  | 'fx-moire-disc'
  | 'fx-moire-lattice'
  | 'fx-lissajous'
  | 'fx-harmonograph'
  | 'fx-fibonacci-spiral'
  | 'fx-golden-spiral'
  | 'fx-torus-knot'
  
  // D. Glyph / Rune / Hieroglyph
  | 'gl-runic-ring'
  | 'gl-sigil-circle'
  | 'gl-solar-disc'
  | 'gl-lunar-phases'
  | 'gl-alchemy-symbols'
  | 'gl-astral-chart'
  | 'gl-techno-hiero'
  | 'gl-circuit-glyph'
  | 'gl-tablet-lines'
  | 'gl-compass-rose'
  | 'gl-celtic-knot'
  | 'gl-lotus-mandala'
  | 'gl-labyrinth'
  
  // E. Geometric Standard (VJ)
  | 'vj-hex-grid'
  | 'vj-triangle-grid'
  | 'vj-isometric-grid'
  | 'vj-concentric-squares'
  | 'vj-concentric-triangles'
  | 'vj-nested-polygons'
  | 'vj-star-polygon'
  | 'vj-radial-lines'
  | 'vj-radar-sweep'
  | 'vj-orbital-nodes'
  | 'vj-arc-segments'
  | 'vj-crosshair-rings'
  | 'vj-circle'
  | 'vj-square'
  | 'vj-triangle'
  | 'vj-pentagon'
  | 'vj-octagon'

  // Legacy preset identifiers retained for backwards-compatible imports.
  | 'flower-of-life'
  | 'seed-of-life'
  | 'metatron-cube'
  | 'sri-yantra'
  | 'hexagon-lattice'
  | 'triangle-grid'
  | 'vesica-piscis'
  | 'circle'
  | 'square'
  | 'triangle'
  | 'pentagon'
  | 'octagon'
  | 'torus-knot'
  | 'mandala'
  | 'star-tetrahedron'
  | 'icosahedron'
  | 'merkaba'
  | 'double-helix'
  | 'fibonacci-spiral'
  | 'golden-spiral'
  | 'lotus-mandala'
  | 'celtic-knot'
  | 'platonic-solid'
  | 'labyrinth';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted' | 'glowing';
export type MorphMode = 'crossfade' | 'path-interpolate';
export type MorphOrigin = 'uniform' | 'center' | 'polarity';
export type AutoCycleSpeed = 'slug' | 'slow' | 'medium' | 'fast' | 'chaos';

export interface AstralShaperParams {
  enabled: boolean;
  
  // Shape & Morphing
  shape: ShapeType;
  nextShape: ShapeType;
  morphAmount: number;          // 0-1 (blend between current and next shape)
  morphMode: MorphMode;
  morphOrigin: MorphOrigin;     // NEW: How the morph propagates
  fieldModulation: number;      // NEW: 0-1 (per-point audio-reactive animation strength)
  
  // Auto-Cycle
  autoCycle: boolean;
  cycleSpeed: AutoCycleSpeed;   // 'slug' (32 beats), 'slow' (24 beats), 'medium' (16), 'fast' (8), 'chaos' (4)
  
  // Audio Reactivity
  audioInfluence: number;        // 0-1 (how much audio affects the visuals)
  pulseDepth: number;            // 0-1 (breathing/pulsing intensity)
  // REMOVED: beatFlash - was causing performance issues and visual problems
  energyGlow: number;            // ENHANCED: 0-1 (glow intensity slider, was boolean)
  
  // Rotation & Animation
  rotationMultiplier: number;    // 0-4 (multiplies global rotation)
  rotationSpeedMod?: boolean;    // BPM/audio assisted rotation modulation
  rotationJitter: number;        // 0-1 (displacement/echo effect strength)
  
  // Geometry Properties
  complexity: number;            // 1-10 (recursion depth / detail level)
  lineThickness: number;         // 0.5-4 (stroke width in pixels) - REDUCED from 1-8
  strokeStyle: StrokeStyle;
  scale: number;                 // 0.3-1.5 (size multiplier for all shapes) - REDUCED from 0.1-2.0
  
  // Visual Effects
  symmetryFold: number;          // 3, 6, 8, 12 (radial symmetry count)
  depthEffect: boolean;          // Vary opacity/thickness for 3D feel
  kaleidoscope: boolean;         // Mirror patterns across axes
  rainbowSpectrum: boolean;      // Color gradient across vertices
  
  // Color
  useGlobalColor: boolean;       // Use global theme colors
  customColor: string;           // Override color (if not using global)
  
  // Performance
  maxSize: number;               // Maximum radius (stays inside inner ring)
}

export interface AudioAnalysisData {
  rms: number;           // 0-1 overall energy
  peak: number;          // 0-1 peak level
  bass: number;          // 0-1 bass energy
  mid: number;           // 0-1 mid energy
  high: number;          // 0-1 high energy
  beatPulse: number;     // 0-1 current beat pulse (decaying)
  isBeat: boolean;       // True on beat detection hit
}
