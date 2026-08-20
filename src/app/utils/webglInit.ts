// ORBITAL WebGL Initialization Utilities
// Extracted from App.tsx to reduce file size

export interface WebGLInitResult {
  success: boolean;
  gl: WebGLRenderingContext | null;
  program: WebGLProgram | null;
  error?: string;
}

/**
 * Initialize WebGL context with optimal settings
 */
export function initWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  try {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false, // Disabled for performance
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    }) as WebGLRenderingContext | null;

    if (!gl) {
      console.warn('WebGL not available, falling back to Canvas2D');
      return null;
    }

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return gl;
  } catch (error) {
    console.error('WebGL initialization error:', error);
    return null;
  }
}

/**
 * Compile shader from source
 */
export function compileShader(
  gl: WebGLRenderingContext | null,
  type: number,
  source: string
): WebGLShader | null {
  // Validate WebGL context
  if (!gl) {
    console.error('❌ Invalid WebGL context passed to compileShader: gl is null or undefined');
    return null;
  }
  
  if (typeof gl.createShader !== 'function') {
    console.error('❌ Invalid WebGL context passed to compileShader: createShader is not a function');
    console.error('Context properties:', Object.keys(gl || {}));
    return null;
  }
  
  // Check if context is lost
  if (gl.isContextLost && gl.isContextLost()) {
    console.error('❌ WebGL context is lost - cannot compile shader');
    return null;
  }

  const shader = gl.createShader(type);
  if (!shader) {
    console.error('❌ Failed to create shader object');
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const shaderType = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
    console.error(`❌ ${shaderType} shader compilation error:`, gl.getShaderInfoLog(shader));
    console.error('Shader source:', source);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Create and link WebGL program
 */
export function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program linking error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  // Clean up shaders (no longer needed after linking)
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

/**
 * Create and link WebGL program from already-compiled shaders
 * Used when shaders are compiled separately for error handling
 */
export function linkProgram(
  gl: WebGLRenderingContext | null,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  // Validate WebGL context
  if (!gl) {
    console.error('❌ Invalid WebGL context passed to linkProgram: gl is null');
    return null;
  }
  
  if (typeof gl.createProgram !== 'function') {
    console.error('❌ Invalid WebGL context passed to linkProgram: createProgram is not a function');
    return null;
  }
  
  // Check if context is lost
  if (gl.isContextLost && gl.isContextLost()) {
    console.error('❌ WebGL context is lost - cannot link program');
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    console.error('❌ Failed to create program object');
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('❌ Program linking error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  // Clean up shaders (no longer needed after linking)
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

/**
 * Create WebGL buffer
 */
export function createBuffer(
  gl: WebGLRenderingContext,
  data: Float32Array | Uint16Array,
  target: number = WebGLRenderingContext.ARRAY_BUFFER,
  usage: number = WebGLRenderingContext.STATIC_DRAW
): WebGLBuffer | null {
  const buffer = gl.createBuffer();
  if (!buffer) return null;

  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);

  return buffer;
}

/**
 * Initialize WebGL with shaders and buffers
 */
export function initWebGL(
  canvas: HTMLCanvasElement,
  vertexShader: string,
  fragmentShader: string
): WebGLInitResult {
  const gl = initWebGLContext(canvas);
  if (!gl) {
    return { success: false, gl: null, program: null, error: 'WebGL not available' };
  }

  const program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) {
    return { success: false, gl, program: null, error: 'Failed to create shader program' };
  }

  return { success: true, gl, program };
}

/**
 * Resize WebGL canvas and viewport
 */
export function resizeWebGLCanvas(
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): void {
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
}

/**
 * Clear WebGL canvas
 */
export function clearWebGLCanvas(
  gl: WebGLRenderingContext,
  r: number = 0,
  g: number = 0,
  b: number = 0,
  a: number = 0
): void {
  gl.clearColor(r, g, b, a);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

/**
 * Cleanup WebGL resources
 */
export function cleanupWebGLResources(
  gl: WebGLRenderingContext | null,
  program: WebGLProgram | null,
  buffers: WebGLBuffer[]
): void {
  if (!gl) return;

  // Delete buffers
  buffers.forEach(buffer => {
    if (buffer) gl.deleteBuffer(buffer);
  });

  // Delete program
  if (program) {
    gl.deleteProgram(program);
  }

  // Lose context (force cleanup)
  const ext = gl.getExtension('WEBGL_lose_context');
  if (ext) {
    ext.loseContext();
  }
}