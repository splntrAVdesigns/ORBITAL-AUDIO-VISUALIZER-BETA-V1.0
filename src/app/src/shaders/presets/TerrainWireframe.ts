/**
 * Terrain Wireframe Shader
 * 3D height-mapped grid with audio-reactive displacement
 * Canvas2D-based with optimized line rendering
 */

import type { ShaderPreset, AudioData, ShaderParams } from '../ShaderRegistry';

let ctx: CanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let gridWidth = 40;
let gridHeight = 30;
let heightMap: number[][] = [];
let waveOffset = 0;
let lastFrameTime = 0;

function generateHeightMap(audioData: AudioData, params: ShaderParams) {
  const rows = gridHeight;
  const cols = gridWidth;
  const selectedEnergy = params.frequencyRange === 'mid' ? audioData.mid : params.frequencyRange === 'high' ? audioData.treble : params.frequencyRange === 'full' ? audioData.energy : audioData.bass;
  const audioBoost = selectedEnergy * (params.audioIntensity || 0.6);
  const zDepth = (params as any).zDepth ?? 0.7;
  const bassHeight = (params as any).bassHeight ?? 0.65;
  const gridBend = (params as any).gridBend ?? 0.35;
  
  for (let y = 0; y < rows; y++) {
    if (!heightMap[y]) heightMap[y] = [];
    
    for (let x = 0; x < cols; x++) {
      // Perlin-like noise using sine waves
      const nx = x / cols;
      const ny = y / rows;
      
      let height = 0;
      const waveCount = Math.max(1, Math.min(3, (params as any).waveCount || 2));
      height += Math.sin(nx * (2.8 * waveCount) + waveOffset) * 0.28;
      height += Math.sin(ny * (2.2 * waveCount) - waveOffset * 0.7) * 0.22;
      height += Math.sin((nx + ny) * (3.4 * waveCount) + waveOffset * 1.2) * 0.18;
      
      // Audio-reactive waves
      const distFromCenter = Math.sqrt(Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.5, 2));
      height += Math.sin(distFromCenter * (8 + gridBend * 7) - waveOffset * 2) * audioBoost * (0.35 + bassHeight * 0.65);
      height *= 0.75 + zDepth * 0.85;
      
      heightMap[y][x] = height;
    }
  }
}

function project3D(x: number, y: number, z: number, params: ShaderParams) {
  // Simple perspective projection
  const scale = (params.scale || 1.0) * 170;
  const perspective = 420 + (((params as any).zDepth ?? 0.7) * 220);
  const rotationX = -0.35 - (((params as any).perspectiveTilt ?? 0.55) * 0.62); // Look down angle
  
  // Rotate around X axis
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  const y2 = y * cosX - z * sinX;
  const z2 = y * sinX + z * cosX;
  
  // Perspective projection
  const depth = perspective / (perspective + z2);
  const px = x * scale * depth + canvasWidth / 2;
  const py = y2 * scale * depth + canvasHeight * 0.56;
  
  return { x: px, y: py, depth };
}

export const TerrainWireframeShader: ShaderPreset = {
  id: 'terrain-wireframe',
  name: 'Terrain Wireframe',
  description: '3D height-mapped grid visualization',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23000" width="100" height="100"/%3E%3Cg stroke="%2300ffff" fill="none"%3E%3Cpath d="M10,60 Q30,50 50,55 T90,60"/%3E%3Cpath d="M10,70 Q30,62 50,65 T90,70"/%3E%3Cpath d="M10,80 Q30,74 50,75 T90,80"/%3E%3C/g%3E%3C/svg%3E',
  type: 'canvas2d',
  category: 'experimental',
  
  defaults: {
    audioIntensity: 0.6,
    frequencyRange: 'low',
    beatSync: true,
    scale: 1.0,
    speed: 1.0,
    opacity: 0.8,
    blendMode: 'screen',
    gridResolution: 'medium',
    waveSpeed: 1.0,
    waveCount: 2,
    zDepth: 0.7,
    perspectiveTilt: 0.55,
    bassHeight: 0.65,
    gridBend: 0.35,
    waveDecay: 0.55,
  },
  
  controls: {
    gridResolution: {
      type: 'select',
      label: 'Grid Detail',
      options: ['low', 'medium', 'high'],
      default: 'medium',
    },
    waveSpeed: {
      type: 'slider',
      label: 'Wave Speed',
      min: 0.1,
      max: 3.0,
      step: 0.1,
      default: 1.0,
    },
    scale: {
      type: 'slider',
      label: 'Grid Scale',
      min: 0.7,
      max: 1.8,
      step: 0.1,
      default: 1.0,
    },
    waveCount: {
      type: 'slider',
      label: 'Wave Count',
      min: 1,
      max: 3,
      step: 1,
      default: 2,
    },
    zDepth: { type: 'slider', label: 'Z Depth', min: 0.2, max: 1.6, step: 0.05, default: 0.7 },
    perspectiveTilt: { type: 'slider', label: 'Perspective Tilt', min: 0, max: 1, step: 0.05, default: 0.55 },
    bassHeight: { type: 'slider', label: 'Bass Height', min: 0, max: 1.5, step: 0.05, default: 0.65 },
    gridBend: { type: 'slider', label: 'Grid Bend', min: 0, max: 1.2, step: 0.05, default: 0.35 },
    waveDecay: { type: 'slider', label: 'Wave Decay', min: 0.2, max: 1.4, step: 0.05, default: 0.55 },
  },
  
  init(canvas: HTMLCanvasElement | OffscreenCanvas, params: ShaderParams) {
    ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
    if (!ctx) return;
    
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    
    // Set grid resolution
    const resolution = params.gridResolution || 'medium';
    switch (resolution) {
      case 'low':
        gridWidth = 22;
        gridHeight = 16;
        break;
      case 'medium':
        gridWidth = 36;
        gridHeight = 24;
        break;
      case 'high':
        gridWidth = 52;
        gridHeight = 34;
        break;
    }
    
    heightMap = [];
    waveOffset = 0;
    lastFrameTime = 0;
  },
  
  render(audioData: AudioData, params: ShaderParams, time: number) {
    if (!ctx) return;
    
    const now = time / 1000;
    const dt = lastFrameTime > 0 ? Math.min(0.05, Math.max(0.001, now - lastFrameTime)) : 1 / 60;
    lastFrameTime = now;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    const decay = (params as any).waveDecay ?? 0.55;
    waveOffset += dt * 1.6 * (params.waveSpeed || 1.0) * (1 + audioData.energy * (0.25 + decay * 0.65));
    
    // Generate height map
    generateHeightMap(audioData, params);
    
    // Base color (will be passed from engine)
    const hue = params.hue || 180;
    const selectedEnergy = params.frequencyRange === 'mid' ? audioData.mid : params.frequencyRange === 'high' ? audioData.treble : params.frequencyRange === 'full' ? audioData.energy : audioData.bass;
  const audioBoost = selectedEnergy * (params.audioIntensity || 0.6);
  const zDepth = (params as any).zDepth ?? 0.7;
  const bassHeight = (params as any).bassHeight ?? 0.65;
  const gridBend = (params as any).gridBend ?? 0.35;
    const baseLightness = 50 + audioBoost * 20;
    
    ctx.strokeStyle = `hsla(${hue}, 80%, ${baseLightness}%, ${params.opacity || 0.8})`;
    ctx.lineWidth = 1;
    
    // Set blend mode
    ctx.globalCompositeOperation = ((params.blendMode === 'normal' ? 'source-over' : params.blendMode) || 'screen') as GlobalCompositeOperation;
    
    // Draw horizontal lines (rows)
    for (let y = 0; y < gridHeight - 1; y++) {
      ctx.beginPath();
      let firstPoint = true;
      
      for (let x = 0; x < gridWidth; x++) {
        const height = heightMap[y][x];
        const nx = (x / gridWidth - 0.5) * 2;
        const ny = (y / gridHeight - 0.5) * 2;
        const nz = height;
        
        const proj = project3D(nx, ny, nz, params);
        
        if (firstPoint) {
          ctx.moveTo(proj.x, proj.y);
          firstPoint = false;
        } else {
          ctx.lineTo(proj.x, proj.y);
        }
      }
      
      // Vary color by depth
      const depthFade = 1 - y / gridHeight;
      ctx.strokeStyle = `hsla(${hue}, 80%, ${baseLightness * depthFade}%, ${(params.opacity || 0.8) * depthFade})`;
      ctx.stroke();
    }
    
    // Draw vertical lines (columns)
    for (let x = 0; x < gridWidth; x++) {
      ctx.beginPath();
      let firstPoint = true;
      
      for (let y = 0; y < gridHeight; y++) {
        const height = heightMap[y][x];
        const nx = (x / gridWidth - 0.5) * 2;
        const ny = (y / gridHeight - 0.5) * 2;
        const nz = height;
        
        const proj = project3D(nx, ny, nz, params);
        
        if (firstPoint) {
          ctx.moveTo(proj.x, proj.y);
          firstPoint = false;
        } else {
          ctx.lineTo(proj.x, proj.y);
        }
      }
      
      ctx.strokeStyle = `hsla(${hue}, 80%, ${baseLightness}%, ${params.opacity || 0.8})`;
      ctx.stroke();
    }
    
    // Beat pulse effect
    if (params.beatSync && audioData.isBeat) {
      ctx.strokeStyle = `hsla(${hue}, 90%, 80%, 0.4)`;
      ctx.lineWidth = 3;
      
      // Draw horizon line
      ctx.beginPath();
      const horizonY = gridHeight / 2;
      for (let x = 0; x < gridWidth; x++) {
        const height = heightMap[Math.floor(horizonY)][x];
        const nx = (x / gridWidth - 0.5) * 2;
        const ny = (horizonY / gridHeight - 0.5) * 2;
        const proj = project3D(nx, ny, height, params);
        
        if (x === 0) ctx.moveTo(proj.x, proj.y);
        else ctx.lineTo(proj.x, proj.y);
      }
      ctx.stroke();
    }
    
    // Reset blend mode
    ctx.globalCompositeOperation = 'source-over';
  },
  
  cleanup() {
    ctx = null;
    heightMap = [];
    lastFrameTime = 0;
  },
  
  resize(width: number, height: number) {
    canvasWidth = width;
    canvasHeight = height;
  },
};