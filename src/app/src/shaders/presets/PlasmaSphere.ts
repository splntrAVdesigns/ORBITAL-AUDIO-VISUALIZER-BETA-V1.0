/**
 * Plasma Sphere Shader
 * Classic demoscene plasma effect with audio reactivity
 * WebGL-accelerated for smooth 60 FPS performance
 */

import type { ShaderPreset, AudioData, ShaderParams } from '../ShaderRegistry';

let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let positionBuffer: WebGLBuffer | null = null;
let positionLocation: number = -1; // cached in init() — avoids per-frame driver lookup
let timeUniform: WebGLUniformLocation | null = null;
let resolutionUniform: WebGLUniformLocation | null = null;
let audioUniform: WebGLUniformLocation | null = null;
let colorUniform: WebGLUniformLocation | null = null;
let speedUniform: WebGLUniformLocation | null = null;
let complexityUniform: WebGLUniformLocation | null = null;
let plasmaDepthUniform: WebGLUniformLocation | null = null;
let corePullUniform: WebGLUniformLocation | null = null;
let swirlAmountUniform: WebGLUniformLocation | null = null;
let audioExpansionUniform: WebGLUniformLocation | null = null;

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_audio;
  uniform vec3 u_color;
  uniform float u_speed;
  uniform float u_complexity;
  uniform float u_plasmaDepth;
  uniform float u_corePull;
  uniform float u_swirlAmount;
  uniform float u_audioExpansion;
  
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;
    float r = length(p);
    float a = atan(p.y, p.x);
    a += sin(r * 4.0 - u_time * 0.8) * u_swirlAmount * 0.32;
    p = vec2(cos(a), sin(a)) * r * (1.0 - u_corePull * 0.12 + u_audio * u_audioExpansion * 0.08);
    
    float t = u_time * u_speed;
    
    // Classic plasma algorithm
    float plasma = 0.0;
    
    // Layer 1: Circular waves
    plasma += sin(length(p) * (8.0 + u_plasmaDepth * 6.0) - t * 2.0);
    
    // Layer 2: Horizontal waves
    plasma += sin(p.x * (7.0 + u_plasmaDepth * 3.0) + t);
    
    // Layer 3: Vertical waves
    plasma += sin(p.y * (7.0 + u_plasmaDepth * 3.0) - t * 1.5);
    
    // Layer 4: Diagonal interference
    plasma += sin((p.x + p.y) * 6.0 * u_complexity + t * 0.8);
    
    // Layer 5: Audio-reactive radial pulse
    float audioWave = sin(length(p) * (12.0 + u_plasmaDepth * 8.0) - t * 3.0) * u_audio * (1.3 + u_audioExpansion * 1.7);
    plasma += audioWave;
    
    // Normalize
    plasma = plasma / (4.0 + u_audio * 2.0);
    
    // Color mapping
    float colorPhase = plasma * 3.14159;
    
    vec3 color1 = u_color;
    vec3 color2 = vec3(u_color.b, u_color.r, u_color.g);
    vec3 color3 = vec3(u_color.g, u_color.b, u_color.r);
    
    vec3 finalColor = mix(color1, color2, sin(colorPhase) * 0.5 + 0.5);
    finalColor = mix(finalColor, color3, cos(colorPhase * 2.0) * 0.5 + 0.5);
    
    // Audio pulse brightness
    float brightness = 1.0 + u_audio * 0.5;
    finalColor *= brightness;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;


function hslToRgb01(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [r + m, g + m, b + m];
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}

export const PlasmaSphereShader: ShaderPreset = {
  id: 'plasma-sphere',
  name: 'Plasma Sphere',
  description: 'Classic demoscene plasma effect',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Cdefs%3E%3CradialGradient id="pg"%3E%3Cstop offset="0%25" stop-color="%23ff00ff"/%3E%3Cstop offset="50%25" stop-color="%230ff"/%3E%3Cstop offset="100%25" stop-color="%23f0f"/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect fill="url(%23pg)" width="100" height="100"/%3E%3C/svg%3E',
  type: 'webgl',
  category: 'classic',
  
  defaults: {
    audioIntensity: 0.7,
    frequencyRange: 'full',
    beatSync: true,
    scale: 1.0,
    speed: 1.0,
    opacity: 0.8,
    blendMode: 'normal',
    complexity: 1.0,
    plasmaDepth: 0.55,
    corePull: 0.35,
    swirlAmount: 0.45,
    audioExpansion: 0.65,
  },
  
  controls: {
    speed: {
      type: 'slider',
      label: 'Animation Speed',
      min: 0.1,
      max: 3.0,
      step: 0.1,
      default: 1.0,
    },
    complexity: {
      type: 'slider',
      label: 'Pattern Complexity',
      min: 0.5,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
    plasmaDepth: { type: 'slider', label: 'Plasma Depth', min: 0, max: 1.4, step: 0.05, default: 0.55 },
    corePull: { type: 'slider', label: 'Core Pull', min: 0, max: 1, step: 0.05, default: 0.35 },
    swirlAmount: { type: 'slider', label: 'Swirl Amount', min: 0, max: 1.2, step: 0.05, default: 0.45 },
    audioExpansion: { type: 'slider', label: 'Audio Expansion', min: 0, max: 1.5, step: 0.05, default: 0.65 },
  },
  
  init(canvas: HTMLCanvasElement | OffscreenCanvas, params: ShaderParams) {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) as WebGLRenderingContext | null;
    if (!gl) return;
    
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      console.error('Failed to compile Plasma Sphere shaders');
      return;
    }
    
    program = gl.createProgram();
    if (!program) return;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    
    // Create full-screen quad
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    // Cache attribute location once — avoids a driver hashtable lookup every frame
    positionLocation = gl.getAttribLocation(program, 'a_position');

    // Cache uniform locations
    timeUniform = gl.getUniformLocation(program, 'u_time');
    resolutionUniform = gl.getUniformLocation(program, 'u_resolution');
    audioUniform = gl.getUniformLocation(program, 'u_audio');
    colorUniform = gl.getUniformLocation(program, 'u_color');
    speedUniform = gl.getUniformLocation(program, 'u_speed');
    complexityUniform = gl.getUniformLocation(program, 'u_complexity');
    plasmaDepthUniform = gl.getUniformLocation(program, 'u_plasmaDepth');
    corePullUniform = gl.getUniformLocation(program, 'u_corePull');
    swirlAmountUniform = gl.getUniformLocation(program, 'u_swirlAmount');
    audioExpansionUniform = gl.getUniformLocation(program, 'u_audioExpansion');
  },
  
  render(audioData: AudioData, params: ShaderParams, time: number) {
    if (!gl || !program) return;
    
    gl.useProgram(program);

    // Use cached attribute location (set once in init)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    gl.uniform1f(timeUniform, time / 1000);
    gl.uniform2f(resolutionUniform, gl.canvas.width, gl.canvas.height);
    const selectedEnergy = params.frequencyRange === 'low' ? audioData.bass : params.frequencyRange === 'mid' ? audioData.mid : params.frequencyRange === 'high' ? audioData.treble : audioData.energy;
    gl.uniform1f(audioUniform, selectedEnergy * (params.audioIntensity || 0.7));
    gl.uniform1f(speedUniform, params.speed || 1.0);
    gl.uniform1f(complexityUniform, params.complexity || 1.0);
    gl.uniform1f(plasmaDepthUniform, (params as any).plasmaDepth ?? 0.55);
    gl.uniform1f(corePullUniform, (params as any).corePull ?? 0.35);
    gl.uniform1f(swirlAmountUniform, (params as any).swirlAmount ?? 0.45);
    gl.uniform1f(audioExpansionUniform, (params as any).audioExpansion ?? 0.65);
    
    // Base color (will be passed from engine)
    const hue = (params as any).hue;
    const baseColor = Array.isArray(params.baseColor)
      ? params.baseColor
      : (typeof hue === 'number' ? hslToRgb01(hue, 96, 60) : [0.6, 0.2, 0.8]);
    gl.uniform3f(colorUniform, baseColor[0], baseColor[1], baseColor[2]);
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  },
  
  cleanup() {
    if (gl && program) {
      gl.deleteProgram(program);
    }
    if (gl && positionBuffer) {
      gl.deleteBuffer(positionBuffer);
    }
    gl = null;
    program = null;
    positionBuffer = null;
    positionLocation = -1;
    // Null all uniform locations — prevents dangling references after context loss
    timeUniform = null;
    resolutionUniform = null;
    audioUniform = null;
    colorUniform = null;
    speedUniform = null;
    complexityUniform = null;
    plasmaDepthUniform = null;
    corePullUniform = null;
    swirlAmountUniform = null;
    audioExpansionUniform = null;
  },
  
  resize(width: number, height: number) {
    if (gl) {
      gl.viewport(0, 0, width, height);
    }
  },
};
