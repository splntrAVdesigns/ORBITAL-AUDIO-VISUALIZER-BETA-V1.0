/**
 * ORBITAL — Default Visualizer Parameters
 * Source of truth for all visualizer param defaults.
 *
 * Extracted from App.tsx (Phase 1 refactor).
 * Import as: import { defaultParams } from './config/defaultParams'
 * VisualizerParams type is derived automatically via typeof.
 */

import type { ShapeType, StrokeStyle, AutoCycleSpeed } from '../utils/astralShaper';
import type { CenterColorGradeId } from '../utils/centerColorGrades';
import type { CenterMotionProfile, CenterMotionType } from '../utils/centerMotionEngine';

export const defaultParams = {
  rotation: 0.00, mirror: 0.0, zoom: 1.0, lineWidth: 2.0,
  innerRadius: .28, tail: 0.30, halo: 1.0, bloom: 0.5, // 🎯 tail: 0.30 = spike attack
  dotsOn: true, trail: 0.50, dotsDensity: 32.8, allowZoom: false, gamma: 0.0, // 🎯 dotsDensity: 32.8 = slider 0.25 (exactly 25%)
  iridize: 0.0, chaos: 0.0, spectrum: false,
  orbitalEnergy: 0.0, // ORBITAL ENERGY: Animated pulse traveling around halo (0-2.0)
  orbitalWidth: 0.3, // Pulse width (0.1=narrow comet, 1.0=wide glow)
  orbitalDirection: 1, // Direction: 1=clockwise, -1=counter-clockwise
  haloCometEnabled: false,

  // Halo Strobe: LFO-driven fade on the halo ring, synced to BPM division.
  haloStrobeEnabled: false,
  haloStrobeDivision: '1/4', // '1/1' | '1/2' | '1/4' | '1/8'
  haloCometSpeed: 0.18, // Automatic orbit speed in revolutions per second
  haloCometDirection: 1, // 1=right/clockwise, -1=left/counter-clockwise
  haloCometThickness: 3.0,
  haloCometTailLength: 0.22, // Fraction of one circumference
  vizMode: 0, // Visualization mode: 0=Electric Chaos (spikes), 1=Particle Storm, 2=Heatmap, 3=Waveform
  // Phase 1 features
  glowCenter: false, glowStrength: 0.5, // Default 50% strength when enabled
  autoZoom: false,
  dotsPulse: false,
  dotSize: 2.0, dotGlow: 1.0, // ✨ DEFAULT: Increased from 0.6 to 1.0 for better visibility. dotGlow is retired
  // (Sprint G) -- kept only so old presets still load without error; the renderer no longer reads it.
  dotRipple: 0.35, // Dot Ripple: traveling wave that bunches/spreads dots in packs, replaces Dot Glow
  hueSpeed: 1.0, // Motion FX enhancements
  // 🎯 NEW MOTION ARCHITECTURE - Auto-reactivity with visual effect controls
  motionIntensity: 0.40, // Motion amplitude multiplier (0-1, default 40% = Balanced with headroom)
  motionSmoothing: 0.35, // Spring damping / smoothing factor (0-1, default 35% = Smooth feel)
  bassBoost: 0.50, // Bass frequency weighting (0-1, default 50%)
  reactivity: 0.50, // Legacy master reactivity control retained for reset/import compatibility
  frequencySmoothing: true, // Frequency-dependent smoothing (bass=punchy, treble=smooth)
  beatReactivityBoost: false, // Temporarily boost reactivity on beats for "punch through" effect
  reactivityMode: 'hybrid' as 'instant' | 'smooth' | 'hybrid' | 'manual', // Sprint 21B: user-controlled visual bus routing
  reactivityBlend: 0.45, // Manual blend: 0=Instant/transient, 1=Smooth/cinematic
  reactivityHz: 60 as 30 | 60, // Audio/reactivity sampling cadence; visual RAF remains display-driven
  // Phase 2 features
  shockwave: false, shockwaveThreshold: 0.7, shockwaveSpeed: 1.0, shockwaveDecay: 0.85, shockwaveRings: 3,
  // Spark impact is selected exclusively through beatPulseType ('spark').
  sparkAmps: 0.5, sparkTrail: 0.5, sparkDensity: 0.5, sparkDispersion: 0.45, // 🚀 PHASE 5A: sparkDensity added for Macro4
  // Vectorscope Analyzer (Radial Frequency Visualizer)
  shapeOscillate: false, shapeEdgeTrails: 0.50, shapeDistortion: 0.30, shapeTurbulence: 0.50, shapeDecay: 0.22, shapeOrbitDrift: 0.40, shapeDensity: 0.75, shapeBurstStrength: 0.20,
  coreParticlesShapeMode: 'dot' as 'dot' | 'tri' | 'dia' | 'all',
  // Phase 3 features (Image Upload, Recording, etc.)
  centerImageScale: 0.096, centerImageRotation: 0.0, centerImageReactive: true,
  centerImageOpacity: 1.0, // Opacity control (0-1)
  centerImageX: 0, // X position offset (-100 to 100) - computed by drift
  centerImageY: 0, // Y position offset (-100 to 100) - computed by drift
  centerImageXDrift: false, // Auto-pan left/right
  centerImageYDrift: false, // Auto-pan up/down
  centerImageColorGrade: 'none' as CenterColorGradeId,
  centerImageColorSource: 'master' as const,
  centerImageSaturation: 1.0,
  centerImageHueShift: 0,
  centerImageHueShiftAuto: false,
  centerImageDisplacement: 0, // Liquid warp effect (0-100)
  centerImageKenBurns: false, // Ken Burns drift effect
  centerImageKenBurnsSpeed: 0.5, // Drift speed multiplier
  centerImageMotionProfile: 'static' as CenterMotionProfile, // Legacy compatibility only; user-facing Profile was consolidated in Phase 12D.5
  centerImageMotionType: 'verticalFloat' as CenterMotionType, // Phase 12D.8: grouped motion library default
  centerImageMotionAmount: 0.0, // Motion Speed (0-1), default OFF on app load
  centerImageMotionIntensity: 0.0, // Motion Intensity / travel strength (0-1), default OFF on app load
  centerImageMotionAudio: false, // Legacy only; Audio Motion UI removed in Phase 12D.8
  recordFPS: 30, recordCountdown: true,
  // Phase 4 features (Zoom Osc)
  zoomOsc: 0.0, zoomOscSpeed: 1.0, zoomRings: 12,
  centerImageAberration: 0.0,
  centerImageJitter: 0.0, // Glitch/distortion jitter effect (0-1)
  centerImageKaleidoscope: 0.0,
  centerImageAutoRotate: false, autoRotateSpeed: 2,
  // RGB Offset Effect - Center Graphic
  centerImageRGBOffset: 0.0, // RGB chromatic aberration strength (0-1)
  centerImageRGBAngle: 0, // RGB offset direction (0-360 degrees)
  centerImageRGBAutoRotate: false, // Auto-rotate RGB channels at different speeds
  // Phase 5 features (Eclipse Glow, Gamma Blast)
  eclipseWeight: 0.0, gammaBlast: 0.0,
  // Phase 6 features (Macros, Frequency Bands, Beat Detection)
  macro1: 0, macro2: 0, macro3: 0, macro4: 0,
  macro5: 0, macro6: 0, macro7: 0, macro8: 0,
  frequencyBand: 'full', // 'bass', 'mid', 'high', 'full'
  beatDetect: false, beatSensitivity: 0.65, beatPulseType: 'flash', effectAmount: 0.5, // effectAmount: 0-1 controls intensity of selected effect
  darkStrobeDepth: 0.65, // Black-flash opacity/depth (0-1)

  // Star Field Tunnel (Beat Reactive Color FX > Star Field Tunnel), Sprint H.
  starFieldCount: 450,
  starFieldSpeed: 5,
  starFieldSpread: 100,
  starFieldSize: 6,
  starFieldFocalDepth: 13,
  starFieldTurbulence: 1,
  starFieldGlitter: 3,
  starFieldTrail: 88,
  starFieldReverse: false,
  starFieldBlendMode: 'lighter', // 'screen' | 'lighter' | 'source-over'
  starFieldBeatSync: true,
  darkStrobeDisplacement: 0.35, // Horizontal tear/band displacement strength (0-1)
  // Motion Blur Trails - True Afterimage Effect
  motionBlurEnabled: false, // Enable/disable motion blur trails
  motionBlur: 0.0, // Macro-owned post-FX intensity; independent from persistence
  motionBlurPersistence: 0.35, // Trail persistence (0-1, higher = longer trails)
  motionBlurMode: 'multiply' as 'multiply' | 'alpha', // Fade mode: multiply or alpha
  // TIER 1 FEATURES - Live Performance Enhancements
  beatAccent: 1.0, // Global beat multiplier (0-2.0)
  rotationSyncMode: 'free', // 'free', 'bpm', 'quantized', 'pingpong', 'oscillator'
  rotationQuantize: '2/1', // '4/1', '2/1', '1/1', '1/2', '1/4', '1/8' - BPM phrase interval for sync modes
  bpm: 174, // CACHED: BPM value for rotation sync (no more DOM queries!)
  bars: 8, // CACHED: Bars value for rotation sync
  energyGate: true, // Silence detection - ON BY DEFAULT
  energyThreshold: 0.15, // Gate threshold (0-1)
  energyRelease: 0.5, // Gate release speed (0-1)
  // SPIKE RING ENHANCEMENTS
  fftSize: 9, // 2^9 FFT window = 256 visible frequency bins
  spikeAttack: 0.30, // 🎯 Attack speed (0.2-0.95) - updated to match tail parameter
  spikeTightness: 0.6, // 🎯 Spike amplitude/spread control (0.2-1.0, 75% = default)
  bassReduce: 0.0, // Legacy spike tone control retained for reset/import compatibility
  frequencyMix: 0.5, // Legacy spike frequency blend retained for reset/import compatibility
  spikeBloom: 0.0, // Peak Drop: detached tips that hold then fall (0-1.0, 0% = off). Key kept as spikeBloom for preset/macro compatibility.
  spikeVariety: 0.10, // Spike Variety: per-spike height variation (0-1.0, 0% = legacy uniform envelope)
  transientBoost: 0.0, // 🔥 Transient emphasis for punchy reactivity (0-1.0, 0% = default)
  // LIQUID SHAPER - WebGL Sacred Geometry Engine
  astralShaper: false, // Enable/disable Liquid Shaper
  astralShape: 'sg-vesica-chain' as ShapeType, // First entry in the curated 20-shape cycle
  astralMorphAmount: 0.3, // DEFAULT: 0% morph blend on app load
  astralMorphDamping: 0.5, // Exponential smoothing for morphAmount (0-1, default: 0.5)
  astralMorphMode: 'path-interpolate' as 'crossfade' | 'path-interpolate', // Morph engine
  astralMorphOrigin: 'uniform' as 'uniform' | 'center' | 'polarity',
  astralFieldModulation: 0, // ENHANCED: Default to 0% (off)
  astralAutoCycle: true, // Auto-cycle through shapes
  astralCycleSpeed: 'slow' as AutoCycleSpeed, // 'slug' (32), 'slow' (24), 'medium' (16), 'fast' (8), 'chaos' (4)
  astralAudioInfluence: 0.3, // ENHANCED: Audio reactivity (0-1) - DEFAULT: 15%
  astralPulseDepth: 0.5, // ENHANCED: Breathing/pulsing intensity (0-1) - DEFAULT: 20%
  astralBeatFlash: false, // Legacy preset field; visual beat flash remains disabled by default
  astralEnergyGlow: 0, // ENHANCED: Glow intensity slider (0-1) - DEFAULT: OFF
  astralRotationMult: 0.5, // Rotation multiplier (0-4)
  astralRotationSpeedMod: false, // Adds BPM/audio-assisted rotation modulation
  astralRotationJitter: 0, // Default to 0 (no jitter echoes)
  astralComplexity: 5, // Geometry detail (1-10)
  astralLineThickness: 1.0, // ENHANCED: Stroke width (0.5-4)
  astralStrokeStyle: 'solid' as StrokeStyle, // 'solid', 'dashed', 'dotted', 'glowing'
  astralScale: 1.0, // ENHANCED: Size multiplier (0.3-1.5)
  astralSymmetryFold: 6, // Radial symmetry (3, 6, 8, 12)
  astralDepthEffect: true, // 3D depth variation
  astralKaleidoscope: false, // Mirror patterns
  astralRainbowSpectrum: false, // Color gradient
  astralUseGlobalColor: true, // Use global theme colors
  astralCustomColor: '#1E90FF', // Override color
  // RGB Offset Effect - Liquid Shaper
  astralRGBOffset: 0.0, // RGB chromatic aberration strength (0-1)
  astralRGBAngle: 0, // RGB offset direction (0-360 degrees)
  astralRGBAutoRotate: false, // Auto-rotate RGB channels at different speeds
  // Core Textures / Shader Layer — canonical defaults for typed transactions and presets
  coreTexturesEnabled: false,
  coreTexturesShaderId: 'digital-matrix',
  coreTexturesOpacity: 0.8,
  coreTexturesAudioIntensity: 0.45,
  coreTexturesFrequencyRange: 'full' as 'low' | 'mid' | 'high' | 'full',
  coreTexturesBeatSync: true,
  coreTexturesBlendMode: 'screen',
  coreTexturesScale: 1.0,
  coreTexturesSpeed: 1.0,
  coreTexturesDensity: 0.45,
  coreTexturesGlowIntensity: 0.5,
} as const;

/** Full type of the visualizer params object — derived automatically. */
export type VisualizerParams = {
  -readonly [K in keyof typeof defaultParams]: typeof defaultParams[K];
};
