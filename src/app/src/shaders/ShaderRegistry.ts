/**
 * Core Textures - Shader Registry
 * Central catalog of all available shader presets
 * ORBITAL Audio-Reactive Visualizer Engine
 */

export interface AudioData {
  energy: number;
  bass: number;
  mid: number;
  treble: number;
  beatIntensity: number;
  isBeat: boolean;
  bpm: number;
  frequencyData: Uint8Array;
  timeData: Float32Array;
}

export interface ShaderParams {
  // Audio Reactivity
  audioIntensity: number;      // 0-1
  frequencyRange: 'low' | 'mid' | 'high' | 'full';
  beatSync: boolean;
  
  // Visual FX (shader-specific)
  scale: number;
  speed: number;
  opacity: number;
  blendMode: 'normal' | 'add' | 'multiply' | 'screen';
  
  // Shader-specific params
  [key: string]: any;
}

export type ShaderCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface ShaderPreset {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // Data URL or path
  type: 'webgl' | 'canvas2d';
  category: 'classic' | 'experimental' | 'geometric';
  
  // Lifecycle
  init: (canvas: ShaderCanvas, params: ShaderParams) => void;
  render: (audioData: AudioData, params: ShaderParams, time: number) => void;
  cleanup: () => void;
  resize: (width: number, height: number) => void;
  /** Optional reset when a texture is re-enabled without a shader switch. */
  reset?: () => void;
  
  // Default parameters
  defaults: Partial<ShaderParams>;
  
  // Control schema for UI generation
  controls: {
    [key: string]: {
      type: 'slider' | 'toggle' | 'select' | 'dropdown';
      label: string;
      min?: number;
      max?: number;
      step?: number;
      default: any;
      options?: string[];
    };
  };
}

// Shader implementations will be imported here
import { DigitalMatrixShader } from './presets/DigitalMatrix';
import { LiquidGradientShader } from './presets/LiquidGradient';
import { GeometricPatternShader } from './presets/GeometricPattern';
import { NoiseGlitchShader } from './presets/NoiseGlitch';
import { PlasmaSphereShader } from './presets/PlasmaSphere';
import { TerrainWireframeShader } from './presets/TerrainWireframe';
import { ParticleCubeFieldShader } from './presets/ParticleCubeField';
import { HologridDepthTunnelShader } from './presets/HologridDepthTunnel';
import { CosmicOrbShader } from './presets/CosmicOrb';
import { ChromaticWavesShader } from './presets/ChromaticWaves';

export const SHADER_REGISTRY: ShaderPreset[] = [
  DigitalMatrixShader,
  LiquidGradientShader,
  GeometricPatternShader,
  NoiseGlitchShader,
  PlasmaSphereShader,
  TerrainWireframeShader,
  ParticleCubeFieldShader,
  HologridDepthTunnelShader,
  CosmicOrbShader,
  ChromaticWavesShader,
];

export function getShaderById(id: string): ShaderPreset | undefined {
  return SHADER_REGISTRY.find(shader => shader.id === id);
}

export function getShadersByCategory(category: string): ShaderPreset[] {
  return SHADER_REGISTRY.filter(shader => shader.category === category);
}