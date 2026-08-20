/**
 * Liquid Gradient Shader
 * Flowing Perlin noise-based color gradients with audio reactivity
 * WebGL-accelerated for performance
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
let flowDirUniform: WebGLUniformLocation | null = null;
let depthUniform: WebGLUniformLocation | null = null;
let saturationUniform: WebGLUniformLocation | null = null;
let audioPulseUniform: WebGLUniformLocation | null = null;

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
  uniform vec2 u_flowDir;
  uniform float u_depth;
  uniform float u_saturation;
  uniform float u_audioPulse;
  
  // Simplex noise implementation
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= u_resolution.x / u_resolution.y;
    
    float t = u_time * u_speed * 0.32;
    vec2 flow = normalize(u_flowDir + vec2(0.0001));
    vec2 flow90 = vec2(-flow.y, flow.x);
    p += flow * t * 0.18 + flow90 * sin(t * 0.7) * 0.08 * u_depth;
    
    // Multi-layered noise
    // Larger, slower blob fields instead of noisy full-strength color flooding.
    float n1 = snoise(p * (0.85 + u_depth * 0.38) + flow * t * 0.55);
    float n2 = snoise(p * (1.35 + u_depth * 0.82) - flow90 * t * 0.52);
    float n3 = snoise(p * (0.58 + u_depth * 0.34) + vec2(t * 0.42, -t * 0.35));
    
    float noise = (n1 * 0.68 + n2 * 0.24 + n3 * 0.18) * (1.0 + u_audio * (0.35 + u_audioPulse * 0.85));
    
    // Color gradient based on noise
    vec3 color1 = u_color;
    vec3 color2 = mix(vec3(u_color.g, u_color.b, u_color.r), vec3(0.08, 0.92, 0.95), 0.14);
    vec3 color3 = mix(vec3(u_color.b, u_color.r, u_color.g), vec3(0.72, 0.22, 0.95), 0.12);
    
    float mixVal = (noise + 1.0) * 0.5;
    // Posterized blob mix keeps it gradient-like, not full-canvas flat yellow/green.
    mixVal = smoothstep(0.28, 0.82, mixVal);
    vec3 finalColor = mix(color1, color2, mixVal);
    finalColor = mix(finalColor, color3, smoothstep(0.18, 0.94, sin(mixVal * 3.14159) * 0.5 + 0.5) * 0.62);
    
    float pulse = 1.08 + u_audio * 0.34;
    finalColor = pow(finalColor * pulse, vec3(0.82));
    float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor = mix(vec3(gray), finalColor, 1.0 + u_saturation * 0.75);
    
    // Alpha remains below 1 so the center logo and rings remain visually dominant.
    gl_FragColor = vec4(finalColor, 0.78);
  }
`;

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


function hslToRgb01(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
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

export const LiquidGradientShader: ShaderPreset = {
  id: 'liquid-gradient',
  name: 'Liquid Gradient',
  description: 'Flowing Perlin noise color gradients',
  thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Cdefs%3E%3ClinearGradient id="lg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" stop-color="%23667eea"/%3E%3Cstop offset="50%25" stop-color="%23764ba2"/%3E%3Cstop offset="100%25" stop-color="%23f093fb"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23lg)" width="100" height="100"/%3E%3C/svg%3E',
  type: 'webgl',
  category: 'experimental',
  
  defaults: {
    audioIntensity: 0.7,
    frequencyRange: 'full',
    beatSync: true,
    scale: 1.0,
    speed: 1.0,
    opacity: 1.0,
    blendMode: 'normal',
    flowSpeed: 1.0,
    flowAngle: 0,
    liquidDepth: 0.55,
    saturationBoost: 0.45,
    audioPulseAmount: 0.55,
  },
  
  controls: {
    flowSpeed: {
      type: 'slider',
      label: 'Flow Speed',
      min: 0.05,
      max: 6.0,
      step: 0.1,
      default: 1.0,
    },
    speed: {
      type: 'slider',
      label: 'Animation Speed',
      min: 0.15,
      max: 5.0,
      step: 0.1,
      default: 1.0,
    },
    flowAngle: { type: 'slider', label: 'Flow Direction', min: 0, max: 360, step: 5, default: 0 },
    liquidDepth: { type: 'slider', label: 'Liquid Depth', min: 0, max: 1, step: 0.05, default: 0.55 },
    saturationBoost: { type: 'slider', label: 'Saturation Boost', min: 0, max: 1, step: 0.05, default: 0.45 },
    audioPulseAmount: { type: 'slider', label: 'Audio Pulse Amount', min: 0, max: 1.4, step: 0.05, default: 0.55 },
  },
  
  init(canvas: HTMLCanvasElement | OffscreenCanvas, params: ShaderParams) {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) as WebGLRenderingContext | null;
    if (!gl) return;
    
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      console.error('Failed to compile Liquid Gradient shaders');
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
    flowDirUniform = gl.getUniformLocation(program, 'u_flowDir');
    depthUniform = gl.getUniformLocation(program, 'u_depth');
    saturationUniform = gl.getUniformLocation(program, 'u_saturation');
    audioPulseUniform = gl.getUniformLocation(program, 'u_audioPulse');
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
    gl.uniform1f(speedUniform, (params.flowSpeed || 1.0) * (params.speed || 1.0));
    const angle = (((params as any).flowAngle ?? 0) * Math.PI) / 180;
    gl.uniform2f(flowDirUniform, Math.cos(angle), Math.sin(angle));
    gl.uniform1f(depthUniform, (params as any).liquidDepth ?? 0.55);
    gl.uniform1f(saturationUniform, (params as any).saturationBoost ?? 0.45);
    gl.uniform1f(audioPulseUniform, (params as any).audioPulseAmount ?? 0.55);
    
    const hue = (params as any).hue;
    const baseColor = Array.isArray(params.baseColor)
      ? params.baseColor
      : (typeof hue === 'number'
        ? hslToRgb01(hue, 96, 60)
        : [0.18, 0.72, 0.95]);
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
    flowDirUniform = null;
    depthUniform = null;
    saturationUniform = null;
    audioPulseUniform = null;
  },
   
  resize(width: number, height: number) {
    if (gl) {
      gl.viewport(0, 0, width, height);
    }
  },
};
