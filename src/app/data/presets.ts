/**
 * ORBITAL Audio Visualizer - Built-in Preset Data
 *
 * Phase 13A — Preset Redesign Pass
 * Strategy: preserve existing preset names, but remap their factory defaults so
 * each preset has a clearer visual identity without maxing every expensive feature.
 */

export const PRESET_VERSION = '13A.4-beta-preset-tuning';
export const PRESET_COUNT = 20;

export interface PresetSettings {
  rotation: number;
  mirror: number;
  zoom?: number;
  halo: number;
  bloom: number;
  dotsOn: boolean;
  trail: number;
  dotsDensity: number;
  gamma: number;
  iridize: number;
  chaos: number;
  glowCenter: boolean;
  glowStrength: number;
  haloCometEnabled?: boolean;
  haloCometSpeed?: number;
  haloCometDirection?: number;
  haloCometThickness?: number;
  haloCometTailLength?: number;
  autoZoom: boolean;
  dotsPulse: boolean;
  shockwave: boolean;
  shockwaveThreshold?: number;
  shockwaveRings?: number;
  dotSize?: number;
  dotGlow?: number;
  dotReactivity?: number;
  hueSpeed?: number;
  zoomOsc?: number;
  fftSize?: number;
  smoothing?: number;
  reactivity?: number;
  frequencySmoothing?: boolean;
  beatReactivityBoost?: boolean;
  autoRotateSpeed?: number;
  palette: number;

  // Spike Ring Enhancements
  spikeSharpness?: number;
  spikeAttack?: number;
  spikeTightness?: number;
  spikeTexture?: number;
  spikeBloom?: number; // Peak Drop (key kept for compatibility)
  spikeVariety?: number; // Spike Variety (per-spike height variation)
  transientBoost?: number;

  // Impact / Shock accents
  sparkAmps?: number;
  sparkTrail?: number;
  sparkDispersion?: number;

  // Liquid Shaper
  astralShaper?: boolean;
  astralShape?: string;
  astralScale?: number;
  astralLineThickness?: number;
  astralAutoCycle?: boolean;
  astralCycleSpeed?: string;
  astralEnergyGlow?: number | boolean;
  astralMorphAmount?: number;
  astralMorphDamping?: number;
  astralMorphMode?: string;
  astralMorphOrigin?: string;
  astralFieldModulation?: number;
  astralAudioInfluence?: number;
  astralPulseDepth?: number;
  astralRotationMult?: number;
  astralRotationSpeedMod?: boolean;
  astralRotationJitter?: number;
  astralComplexity?: number;
  astralStrokeStyle?: string;
  astralSymmetryFold?: number;
  astralDepthEffect?: boolean;
  astralKaleidoscope?: boolean;
  astralRainbowSpectrum?: boolean;
  astralUseGlobalColor?: boolean;

  // Core Particles
  shapeOscillate?: boolean;
  shapeEdgeTrails?: number;
  shapeDecay?: number;
  shapeDistortion?: number;
  shapeBurstStrength?: number;
  shapeTurbulence?: number;
  shapeOrbitDrift?: number;
  shapeDensity?: number;
  coreParticlesShapeMode?: 'dot' | 'tri' | 'dia' | 'all';

  // Beat / reactive controls
  beatDetect?: boolean;
  beatSensitivity?: number;
  beatPulseType?: string;
  beatAccent?: number;
  effectAmount?: number;
  darkStrobeDepth?: number;
  darkStrobeDisplacement?: number;
  frequencyBand?: string;

  // Center Graphic Layer
  centerImageVisible?: boolean;
  centerImageScale?: number;
  centerImageOpacity?: number;
  centerImageAutoRotate?: boolean;
  centerImageRotationSpeed?: number;
  centerImageReactive?: boolean;
  centerImageColorGrade?: string;
  centerImageSaturation?: number;
  centerImageHueShift?: number;
  centerImageHueShiftAuto?: boolean;
  centerImageDisplacement?: number;
  centerImageMotionType?: string;
  centerImageMotionAmount?: number;
  centerImageMotionIntensity?: number;
  centerImageXDrift?: boolean;
  centerImageYDrift?: boolean;
  centerImageRGBOffset?: number;
  centerImageRGBAngle?: number;
  centerImageTransitionType?: string;
  centerImageCycleSpeed?: string | number;
  centerImageAutoCycle?: boolean;

  // Core Textures / Shader Layer
  coreTexturesEnabled?: boolean;
  coreTexturesShaderId?: string;
  coreTexturesOpacity?: number;
  coreTexturesAudioIntensity?: number;
  coreTexturesFrequencyRange?: string;
  coreTexturesBeatSync?: boolean;
  coreTexturesBlendMode?: string;
  coreTexturesScale?: number;
  coreTexturesSpeed?: number;
  coreTexturesDensity?: number;
  coreTexturesGlowIntensity?: number;
}

export interface Preset {
  name: string;
  settings: PresetSettings;
}

const cleanCenter = {
  centerImageVisible: true,
  centerImageScale: 0.096,
  centerImageOpacity: 1,
  centerImageAutoRotate: false,
  centerImageRotationSpeed: 0.5,
  centerImageReactive: true,
  centerImageColorGrade: 'none',
  centerImageSaturation: 1,
  centerImageHueShift: 0,
  centerImageHueShiftAuto: false,
  centerImageDisplacement: 0,
  centerImageMotionType: 'verticalFloat',
  centerImageMotionAmount: 0.0,
  centerImageMotionIntensity: 0.0,
  centerImageXDrift: false,
  centerImageYDrift: false,
  centerImageTransitionType: 'fade',
  centerImageCycleSpeed: '4000',
  centerImageAutoCycle: false,
};

const coreOff = {
  coreTexturesEnabled: false,
  coreTexturesShaderId: 'digital-matrix',
  coreTexturesOpacity: 0.8,
  coreTexturesAudioIntensity: 0.45,
  coreTexturesFrequencyRange: 'full',
  coreTexturesBeatSync: true,
  coreTexturesBlendMode: 'screen',
  coreTexturesScale: 1,
  coreTexturesSpeed: 1,
  coreTexturesDensity: 0.45,
  coreTexturesGlowIntensity: 0.5,
};

export const presets: Preset[] = [
  {
    name: 'DEFAULT',
    settings: {
      rotation: 0.04, mirror: 0.0, zoom: 1.0, halo: 0.85, bloom: 0.38,
      dotsOn: true, trail: 0.50, dotsDensity: 0.26, gamma: 0.0, iridize: 0.0, chaos: 0.0,
      glowCenter: false, glowStrength: 0.45, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.76, shockwaveRings: 3,
      dotSize: 1.8, dotGlow: 0.55, dotReactivity: 0.85,
      hueSpeed: 0.35, zoomOsc: 0.0, fftSize: 9, reactivity: 0.52,
      frequencySmoothing: true, beatReactivityBoost: false, autoRotateSpeed: 2,
      palette: 0,
      spikeAttack: 0.34, spikeTightness: 0.62, spikeBloom: 0.15, spikeVariety: 0.35, transientBoost: 0.08,
      astralShaper: false, shapeOscillate: false, beatDetect: false,
      ...cleanCenter,
      centerImageMotionType: 'verticalFloat', centerImageMotionAmount: 0.36, centerImageMotionIntensity: 0.28,
      ...coreOff,
    }
  },
  {
    name: 'Chill Lofi',
    settings: {
      rotation: 0.06, mirror: 0.0, zoom: 0.95, halo: 0.62, bloom: 0.26,
      dotsOn: true, trail: 0.72, dotsDensity: 0.18, gamma: 0.05, iridize: 0.12, chaos: 0.0,
      glowCenter: true, glowStrength: 0.38, autoZoom: false, dotsPulse: true,
      shockwave: false, shockwaveThreshold: 0.82, shockwaveRings: 2,
      dotSize: 1.35, dotGlow: 0.28, dotReactivity: 0.55,
      hueSpeed: 0.18, zoomOsc: 0.0, fftSize: 9, reactivity: 0.34,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 15,
      spikeAttack: 0.26, spikeTightness: 0.42, spikeBloom: 0.00, spikeVariety: 0.20, transientBoost: 0.0,
      astralShaper: false, shapeOscillate: false, beatDetect: false,
      ...cleanCenter,
      centerImageColorGrade: 'monoBlue', centerImageSaturation: 0.86,
      centerImageMotionType: 'breathingZoom', centerImageMotionAmount: 0.28, centerImageMotionIntensity: 0.24,
      centerImageTransitionType: 'crossfade',
      ...coreOff,
    }
  },
  {
    name: 'Bass Earthquake',
    settings: {
      rotation: 0.02, mirror: 0.0, zoom: 1.12, halo: 1.0, bloom: 0.68,
      dotsOn: true, trail: 0.22, dotsDensity: 0.22, gamma: 0.45, iridize: 0.05, chaos: 0.18,
      glowCenter: true, glowStrength: 0.88, autoZoom: true, dotsPulse: false,
      shockwave: true, shockwaveThreshold: 0.50, shockwaveRings: 4,
      dotSize: 1.75, dotGlow: 0.55, dotReactivity: 1.2,
      hueSpeed: 0.22, zoomOsc: 0.025, fftSize: 9, reactivity: 0.76,
      frequencySmoothing: true, beatReactivityBoost: true, autoRotateSpeed: 1, palette: 7,
      spikeAttack: 0.70, spikeTightness: 0.92, spikeBloom: 0.55, spikeVariety: 0.70, transientBoost: 0.62,
      beatDetect: true, beatSensitivity: 0.58, beatPulseType: 'flash', beatAccent: 1.45, effectAmount: 0.62, frequencyBand: 'bass',
      astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageMotionType: 'beatPunch', centerImageMotionAmount: 0.54, centerImageMotionIntensity: 0.58,
      centerImageDisplacement: 5, centerImageTransitionType: 'pushFade',
      ...coreOff,
    }
  },
  {
    name: 'Electric Tempest',
    settings: {
      rotation: 0.34, mirror: 0.0, zoom: 1.02, halo: 1.08, bloom: 0.78,
      dotsOn: true, trail: 0.26, dotsDensity: 0.42, gamma: 0.30, iridize: 0.00, chaos: 0.20,
      glowCenter: false, glowStrength: 0.55, autoZoom: false, dotsPulse: true,
      shockwave: false, shockwaveThreshold: 0.64, shockwaveRings: 3,
      dotSize: 1.7, dotGlow: 0.52, dotReactivity: 1.1,
      hueSpeed: 0.75, zoomOsc: 0.0, fftSize: 10, reactivity: 0.62,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 0,
      spikeAttack: 0.54, spikeTightness: 0.78, spikeBloom: 0.45, spikeVariety: 0.80, transientBoost: 0.35,
      beatDetect: true, beatSensitivity: 0.64, beatPulseType: 'color', beatAccent: 1.15, effectAmount: 0.48, frequencyBand: 'mid',
      astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageMotionType: 'hologramDrift', centerImageMotionAmount: 0.64, centerImageMotionIntensity: 0.44,
      centerImageDisplacement: 8, centerImageTransitionType: 'signalScan',
      ...coreOff,
    }
  },
  {
    name: 'Neon Arcade',
    settings: {
      rotation: 0.14, mirror: 0.0, zoom: 1.0, halo: 0.92, bloom: 0.62,
      dotsOn: true, trail: 0.42, dotsDensity: 0.30, gamma: 0.10, iridize: 0.30, chaos: 0.0,
      glowCenter: true, glowStrength: 0.60, autoZoom: false, dotsPulse: true,
      shockwave: false, shockwaveThreshold: 0.74, shockwaveRings: 3,
      dotSize: 1.55, dotGlow: 0.62, dotReactivity: 0.95,
      hueSpeed: 0.55, zoomOsc: 0.0, fftSize: 10, reactivity: 0.54,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 4,
      spikeAttack: 0.42, spikeTightness: 0.64, spikeBloom: 0.65, spikeVariety: 0.55, transientBoost: 0.18,
      beatDetect: false,
      astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageColorGrade: 'cyberpunk', centerImageSaturation: 1.18,
      centerImageMotionType: 'horizontalFloat', centerImageMotionAmount: 0.42, centerImageMotionIntensity: 0.30,
      centerImageDisplacement: 0, centerImageTransitionType: 'signalScan',
      ...coreOff,
    }
  },
  {
    name: 'Hypnotic Trance',
    settings: {
      rotation: 0.10, mirror: 0.0, zoom: 1.04, halo: 0.78, bloom: 0.44,
      dotsOn: true, trail: 0.66, dotsDensity: 0.34, gamma: 0.12, iridize: 0.28, chaos: 0.0,
      glowCenter: true, glowStrength: 0.70, autoZoom: false, dotsPulse: true,
      shockwave: false, shockwaveThreshold: 0.78, shockwaveRings: 3,
      dotSize: 1.65, dotGlow: 0.42, dotReactivity: 0.82,
      hueSpeed: 0.22, zoomOsc: 0.0, fftSize: 10, reactivity: 0.38,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 3,
      spikeAttack: 0.32, spikeTightness: 0.54, spikeBloom: 0.25, spikeVariety: 0.15, transientBoost: 0.05,
      beatDetect: false,
      astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageMotionType: 'orbitDrift', centerImageMotionAmount: 0.34, centerImageMotionIntensity: 0.30,
      centerImageTransitionType: 'crossfade',
      ...coreOff,
      coreTexturesEnabled: true,
      coreTexturesShaderId: 'liquid-gradient',
      coreTexturesOpacity: 1.0,
      coreTexturesAudioIntensity: 0.18,
      coreTexturesFrequencyRange: 'full',
      coreTexturesBeatSync: false,
      coreTexturesSpeed: 0.42,
      coreTexturesDensity: 0.34,
      coreTexturesGlowIntensity: 0.28,
    }
  },
  {
    name: 'Minimal Zen',
    settings: {
      rotation: 0.0, mirror: 0.0, zoom: 0.82, halo: 0.22, bloom: 0.06,
      dotsOn: true, trail: 0.82, dotsDensity: 0.10, gamma: 0.0, iridize: 0.0, chaos: 0.0,
      glowCenter: false, glowStrength: 0.18, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.84, shockwaveRings: 2,
      dotSize: 1.05, dotGlow: 0.12, dotReactivity: 0.34,
      hueSpeed: 0.06, zoomOsc: 0.0, fftSize: 9, reactivity: 0.22,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 16,
      spikeAttack: 0.22, spikeTightness: 0.28, spikeBloom: 0.00, spikeVariety: 0.05, transientBoost: 0.0,
      beatDetect: false, astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageColorGrade: 'highContrastTech', centerImageOpacity: 0.88,
      centerImageMotionType: 'slowDrift', centerImageMotionAmount: 0.20, centerImageMotionIntensity: 0.16,
      centerImageTransitionType: 'fade',
      ...coreOff,
    }
  },
  {
    name: 'Minimalscape',
    settings: {
      rotation: 0.02, mirror: 0.23, zoom: 0.92, halo: 0.0, bloom: 0.10,
      dotsOn: true, trail: 0.74, dotsDensity: 0.14, gamma: 0.02, iridize: 0.10, chaos: 0.0,
      glowCenter: false, glowStrength: 0.18, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.84, shockwaveRings: 2,
      dotSize: 1.15, dotGlow: 0.18, dotReactivity: 0.42,
      hueSpeed: 0.08, zoomOsc: 0.0, fftSize: 9, reactivity: 0.30,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 0,
      spikeAttack: 0.26, spikeTightness: 0.34, spikeBloom: 0.08, spikeVariety: 0.12, transientBoost: 0.0,
      beatDetect: false, astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageMotionType: 'verticalFloat', centerImageMotionAmount: 0.24, centerImageMotionIntensity: 0.18,
      centerImageOpacity: 0.82, centerImageTransitionType: 'fade',
      ...coreOff,
      coreTexturesEnabled: true,
      coreTexturesShaderId: 'digital-matrix',
      coreTexturesOpacity: 0.8,
      coreTexturesAudioIntensity: 0.22,
      coreTexturesFrequencyRange: 'mid',
      coreTexturesBeatSync: false,
      coreTexturesSpeed: 0.55,
      coreTexturesDensity: 0.28,
      coreTexturesGlowIntensity: 0.22,
    }
  },
  {
    name: 'Cinematic Epic',
    settings: {
      rotation: 0.05, mirror: 0.0, zoom: 1.03, halo: 1.12, bloom: 0.76,
      dotsOn: true, trail: 0.46, dotsDensity: 0.16, gamma: 0.20, iridize: 0.15, chaos: 0.00,
      glowCenter: true, glowStrength: 0.72, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.68, shockwaveRings: 3,
      dotSize: 1.85, dotGlow: 0.40, dotReactivity: 0.72,
      hueSpeed: 0.16, zoomOsc: 0.0, fftSize: 10, reactivity: 0.42,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 10,
      spikeAttack: 0.38, spikeTightness: 0.58, spikeBloom: 0.35, spikeVariety: 0.30, transientBoost: 0.12,
      beatDetect: false,
      astralShaper: false, shapeOscillate: true, shapeEdgeTrails: 0.24, shapeDistortion: 0.30, shapeTurbulence: 0.06,
      ...cleanCenter,
      centerImageColorGrade: 'highContrastTech', centerImageSaturation: 1.05,
      centerImageMotionType: 'cinematicZoom', centerImageMotionAmount: 0.42, centerImageMotionIntensity: 0.46,
      centerImageTransitionType: 'flashZoom',
      ...coreOff,
    }
  },
  {
    name: 'Retro Synthwave',
    settings: {
      rotation: 0.18, mirror: 0.15, zoom: 1.0, halo: 0.98, bloom: 0.64,
      dotsOn: true, trail: 0.52, dotsDensity: 0.10, gamma: 0.22, iridize: 0.38, chaos: 0.0,
      glowCenter: true, glowStrength: 0.62, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.78, shockwaveRings: 3,
      dotSize: 1.10, dotGlow: 0.62, dotReactivity: 0.86,
      hueSpeed: 0.42, zoomOsc: 0.0, fftSize: 10, reactivity: 0.48,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 1,
      spikeAttack: 0.38, spikeTightness: 0.58, spikeBloom: 0.80, spikeVariety: 0.45, transientBoost: 0.08,
      beatDetect: true, beatPulseType: 'dark-strobe', darkStrobeDepth: 0.50, darkStrobeDisplacement: 0.45,
      astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageColorGrade: 'warmSunset', centerImageSaturation: 1.14,
      centerImageMotionType: 'horizontalFloat', centerImageMotionAmount: 0.34, centerImageMotionIntensity: 0.26,
      centerImageTransitionType: 'pushFade',
      ...coreOff,
    }
  },
  {
    name: 'Glitch Matrix',
    settings: {
      rotation: 0.28, mirror: 0.0, zoom: 1.0, halo: 0.70, bloom: 0.44,
      dotsOn: true, trail: 0.30, dotsDensity: 0.32, gamma: 0.20, iridize: 0.00, chaos: 0.35,
      glowCenter: false, glowStrength: 0.42, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.72, shockwaveRings: 2,
      dotSize: 1.28, dotGlow: 0.36, dotReactivity: 1.22,
      hueSpeed: 0.34, zoomOsc: 0.02, fftSize: 10, reactivity: 0.70,
      frequencySmoothing: true, beatReactivityBoost: true, autoRotateSpeed: 1, palette: 11,
      spikeAttack: 0.56, spikeTightness: 0.70, spikeBloom: 0.30, spikeVariety: 0.95, transientBoost: 0.42,
      beatDetect: true, beatSensitivity: 0.68, beatPulseType: 'dark-strobe', beatAccent: 1.25, effectAmount: 0.52,
      darkStrobeDepth: 0.78, darkStrobeDisplacement: 0.68, frequencyBand: 'mid',
      astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageColorGrade: 'infrared', centerImageSaturation: 1.08,
      centerImageMotionType: 'dataCorruption', centerImageMotionAmount: 0.78, centerImageMotionIntensity: 0.62,
      centerImageDisplacement: 18, centerImageTransitionType: 'glitchCut',
      ...coreOff,
      coreTexturesEnabled: true,
      coreTexturesShaderId: 'digital-matrix',
      coreTexturesOpacity: 0.8,
      coreTexturesAudioIntensity: 0.45,
      coreTexturesFrequencyRange: 'mid',
      coreTexturesBeatSync: true,
      coreTexturesSpeed: 1.05,
      coreTexturesDensity: 0.50,
      coreTexturesGlowIntensity: 0.42,
    }
  },
  {
    name: 'Blang it Out',
    settings: {
      rotation: 0.16, mirror: 0.0, zoom: 1.04, halo: 0.92, bloom: 0.58,
      dotsOn: true, trail: 0.36, dotsDensity: 0.45, gamma: 0.20, iridize: 0.00, chaos: 0.0,
      glowCenter: true, glowStrength: 0.76, autoZoom: true, dotsPulse: false,
      shockwave: true, shockwaveThreshold: 0.56, shockwaveRings: 3,
      dotSize: 1.00, dotGlow: 0.56, dotReactivity: 1.0,
      hueSpeed: 0.25, zoomOsc: 0.015, fftSize: 10, reactivity: 0.64,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 2,
      spikeAttack: 0.48, spikeTightness: 0.66, spikeBloom: 0.50, spikeVariety: 0.60, transientBoost: 0.26,
      beatDetect: true, beatSensitivity: 0.66, beatPulseType: 'all', beatAccent: 1.20, effectAmount: 0.44, frequencyBand: 'full',
      astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageMotionType: 'cinematicPush', centerImageMotionAmount: 0.48, centerImageMotionIntensity: 0.34,
      centerImageDisplacement: 0, centerImageTransitionType: 'flashZoom',
      ...coreOff,
    }
  },
  {
    name: 'Sacred Mandala',
    settings: {
      rotation: 0.35, mirror: 0.0, zoom: 0.96, halo: 0.62, bloom: 0.34,
      dotsOn: false, trail: 0.64, dotsDensity: 0.08, gamma: 0.16, iridize: 0.28, chaos: 0.0,
      glowCenter: false, glowStrength: 0.38, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.82, shockwaveRings: 2,
      dotSize: 1.0, dotGlow: 0.18, dotReactivity: 0.55,
      hueSpeed: 0.12, zoomOsc: 0.0, fftSize: 10, reactivity: 0.32,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 3,
      spikeAttack: 0.28, spikeTightness: 0.89, spikeBloom: 0.00, spikeVariety: 0.10, transientBoost: 0.0,
      beatDetect: false,
      astralShaper: true, astralShape: 'sg-flower-of-life', astralScale: 0.66, astralLineThickness: 0.85,
      astralAutoCycle: true, astralCycleSpeed: 'slow', astralEnergyGlow: 0.18, astralMorphAmount: 0.45,
      astralMorphDamping: 0.58, astralAudioInfluence: 0.75, astralPulseDepth: 0.24, astralRotationMult: 3.50,
      astralRotationSpeedMod: true, astralKaleidoscope: true,
      shapeOscillate: false,
      ...cleanCenter,
      centerImageVisible: false,
      ...coreOff,
    }
  },
  {
    name: 'Cosmic Geometry',
    settings: {
      rotation: 0.10, mirror: 0.0, zoom: 0.94, halo: 0.50, bloom: 0.30,
      dotsOn: true, trail: 0.68, dotsDensity: 0.12, gamma: 0.50, iridize: 0.00, chaos: 0.0,
      glowCenter: false, glowStrength: 0.42, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.80, shockwaveRings: 3,
      dotSize: 1.25, dotGlow: 0.28, dotReactivity: 0.70,
      hueSpeed: 0.22, zoomOsc: 0.0, fftSize: 10, reactivity: 0.38,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 16,
      spikeAttack: 0.32, spikeTightness: 0.48, spikeBloom: 0.18, spikeVariety: 0.25, transientBoost: 0.05,
      beatDetect: false,
      astralShaper: true, astralShape: 'sg-metatron-cube', astralScale: 0.72, astralLineThickness: 0.85,
      astralAutoCycle: false, astralEnergyGlow: 0.20, astralMorphAmount: 0.25, astralFieldModulation: 0.45,
      astralAudioInfluence: 0.18, astralPulseDepth: 0.22, astralRotationMult: 0.32, astralKaleidoscope: true,
      shapeOscillate: false,
      ...cleanCenter,
      centerImageMotionType: 'orbitDrift', centerImageMotionAmount: 0.30, centerImageMotionIntensity: 0.22,
      centerImageTransitionType: 'signalScan',
      ...coreOff,
    }
  },
  {
    name: 'Fractal Dreams',
    settings: {
      rotation: 0.06, mirror: 0.0, zoom: 1.02, halo: 0.30, bloom: 0.48,
      dotsOn: true, trail: 0.58, dotsDensity: 0.18, gamma: 0.50, iridize: 0.00, chaos: 0.00,
      glowCenter: true, glowStrength: 0.58, autoZoom: false, dotsPulse: true,
      shockwave: false, shockwaveThreshold: 0.82, shockwaveRings: 3,
      dotSize: 1.35, dotGlow: 0.38, dotReactivity: 0.86,
      hueSpeed: 0.26, zoomOsc: 0.006, fftSize: 10, reactivity: 0.36,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 5,
      spikeAttack: 0.34, spikeTightness: 0.52, spikeBloom: 0.22, spikeVariety: 0.50, transientBoost: 0.05,
      beatDetect: false,
      astralShaper: false,
      shapeOscillate: true,
      shapeEdgeTrails: 0.60,
      shapeDecay: 0.30,
      shapeDistortion: 0.30,
      shapeBurstStrength: 0.50,
      shapeTurbulence: 0.50,
      shapeOrbitDrift: 0.40,
      shapeDensity: 0.75,
      coreParticlesShapeMode: 'tri',
      haloCometEnabled: true,
      haloCometThickness: 2.8,
      haloCometTailLength: 0.50,
      ...cleanCenter,
      centerImageColorGrade: 'neonDreams', centerImageMotionType: 'organicDrift',
      centerImageMotionAmount: 0.32, centerImageMotionIntensity: 0.26,
      centerImageTransitionType: 'crossfade',
      ...coreOff,
    }
  },
  {
    name: 'Particle Storm',
    settings: {
      rotation: 0.20, mirror: 0.0, zoom: 1.0, halo: 0.82, bloom: 0.54,
      dotsOn: true, trail: 0.30, dotsDensity: 0.52, gamma: 0.34, iridize: 0.42, chaos: 0.0,
      glowCenter: false, glowStrength: 0.46, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.78, shockwaveRings: 3,
      dotSize: 1.05, dotGlow: 0.52, dotReactivity: 1.35,
      hueSpeed: 0.46, zoomOsc: 0.0, fftSize: 10, reactivity: 0.58,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 0,
      spikeAttack: 0.42, spikeTightness: 0.56, spikeBloom: 0.40, spikeVariety: 0.85, transientBoost: 0.22,
      beatDetect: false, astralShaper: false,
      shapeOscillate: true, shapeEdgeTrails: 0.72, shapeDistortion: 0.30, shapeTurbulence: 0.28, shapeOrbitDrift: 0.52, shapeDensity: 0.82,
      ...cleanCenter,
      centerImageVisible: false,
      ...coreOff,
    }
  },
  {
    name: 'Deep Bass Vision',
    settings: {
      rotation: 0.03, mirror: 0.0, zoom: 1.14, halo: 0.96, bloom: 0.62,
      dotsOn: true, trail: 0.24, dotsDensity: 0.20, gamma: 0.42, iridize: 0.16, chaos: 0.0,
      glowCenter: true, glowStrength: 0.82, autoZoom: false, dotsPulse: false,
      shockwave: true, shockwaveThreshold: 0.58, shockwaveRings: 3,
      dotSize: 1.85, dotGlow: 0.50, dotReactivity: 1.25,
      hueSpeed: 0.18, zoomOsc: 0.035, fftSize: 9, reactivity: 0.74,
      frequencySmoothing: true, beatReactivityBoost: true, autoRotateSpeed: 1, palette: 7,
      spikeAttack: 0.62, spikeTightness: 0.82, spikeBloom: 0.60, spikeVariety: 0.40, transientBoost: 0.50,
      beatDetect: true, beatSensitivity: 0.60, beatPulseType: 'flash', beatAccent: 1.34, effectAmount: 0.52, frequencyBand: 'bass',
      astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageVisible: false,
      ...coreOff,
    }
  },
  {
    name: 'Logo Spinner',
    settings: {
      rotation: 0.02, mirror: 0.0, zoom: 0.92, halo: 0.38, bloom: 0.28,
      dotsOn: true, trail: 0.66, dotsDensity: 0.12, gamma: 0.12, iridize: 0.22, chaos: 0.0,
      glowCenter: false, glowStrength: 0.28, autoZoom: false, dotsPulse: true,
      shockwave: false, shockwaveThreshold: 0.82, shockwaveRings: 2,
      dotSize: 1.35, dotGlow: 0.28, dotReactivity: 0.70,
      hueSpeed: 0.24, zoomOsc: 0.0, fftSize: 10, reactivity: 0.42,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 4,
      spikeAttack: 0.30, spikeTightness: 0.42, spikeBloom: 0.12, spikeVariety: 0.18, transientBoost: 0.0,
      beatDetect: false, astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageColorGrade: 'highContrastTech', centerImageMotionType: 'tickerScroll',
      centerImageMotionAmount: 0.46, centerImageMotionIntensity: 0.34,
      centerImageTransitionType: 'signalScan', centerImageAutoCycle: true, centerImageCycleSpeed: '8000',
      ...coreOff,
    }
  },
  {
    name: 'Frequency Bloom',
    settings: {
      rotation: 0.32, mirror: 0.0, zoom: 1.02, halo: 0.86, bloom: 0.58,
      dotsOn: true, trail: 0.24, dotsDensity: 0.40, gamma: 0.58, iridize: 0.74, chaos: 0.0,
      glowCenter: false, glowStrength: 0.46, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.72, shockwaveRings: 3,
      dotSize: 1.48, dotGlow: 0.48, dotReactivity: 1.45,
      hueSpeed: 0.76, zoomOsc: 0.024, fftSize: 12, reactivity: 0.78,
      frequencySmoothing: true, beatReactivityBoost: true, autoRotateSpeed: 1, palette: 11,
      spikeAttack: 0.58, spikeTightness: 0.78, spikeBloom: 0.70, spikeVariety: 0.65, transientBoost: 0.48,
      beatDetect: true, beatSensitivity: 0.72, beatPulseType: 'all', beatAccent: 1.28, effectAmount: 0.58, frequencyBand: 'full',
      astralShaper: false, shapeOscillate: false,
      ...cleanCenter,
      centerImageMotionType: 'breathingZoom', centerImageMotionAmount: 0.46, centerImageMotionIntensity: 0.34,
      centerImageDisplacement: 0, centerImageTransitionType: 'flashZoom',
      ...coreOff,
    }
  },
  {
    name: 'Ethereal Bloom',
    settings: {
      rotation: 0.06, mirror: 0.0, zoom: 0.96, halo: 1.16, bloom: 0.84,
      dotsOn: true, trail: 0.76, dotsDensity: 0.12, gamma: 0.00, iridize: 0.20, chaos: 0.0,
      glowCenter: true, glowStrength: 0.82, autoZoom: false, dotsPulse: false,
      shockwave: false, shockwaveThreshold: 0.82, shockwaveRings: 2,
      dotSize: 1.34, dotGlow: 0.46, dotReactivity: 0.68,
      hueSpeed: 0.14, zoomOsc: 0.01, fftSize: 10, reactivity: 0.30,
      frequencySmoothing: true, autoRotateSpeed: 1, palette: 12,
      spikeAttack: 0.30, spikeTightness: 0.44, spikeBloom: 0.28, spikeVariety: 0.22, transientBoost: 0.0,
      beatDetect: false, astralShaper: false,
      shapeOscillate: false, shapeEdgeTrails: 0.0, shapeDistortion: 0.0, shapeTurbulence: 0.0, shapeOrbitDrift: 0.0, shapeDensity: 0.0,
      ...cleanCenter,
      centerImageVisible: false,
      centerImageColorGrade: 'monoBlue', centerImageOpacity: 0.76,
      centerImageMotionType: 'breathingZoom', centerImageMotionAmount: 0.30, centerImageMotionIntensity: 0.28,
      centerImageTransitionType: 'crossfade',
      ...coreOff,
      coreTexturesEnabled: true,
      coreTexturesShaderId: 'particle-cube-field',
      coreTexturesOpacity: 0.8,
      coreTexturesAudioIntensity: 0.0,
      coreTexturesFrequencyRange: 'high',
      coreTexturesBeatSync: false,
      coreTexturesSpeed: 0.44,
      coreTexturesDensity: 0.55,
      coreTexturesGlowIntensity: 0.25,
    }
  }
];
