export interface DarkStrobeFrame {
  pulse: number;
  depth: number;
  displacement: number;
  timeSeconds: number;
  baseLayerActive: boolean;
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 v_uv;
const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);
void main() {
  vec2 position = POSITIONS[gl_VertexID];
  v_uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform float u_pulse;
uniform float u_depth;
uniform float u_displacement;
uniform float u_time;

float hash11(float value) {
  return fract(sin(value * 127.1 + 311.7) * 43758.5453123);
}

void main() {
  float pulse = clamp(u_pulse, 0.0, 1.0);
  // User-facing 50% now matches the former maximum black-depth response.
  // Values above 50% extend the fully-dark portion of the pulse while alpha
  // remains physically clamped at the final composition boundary.
  float depthGain = clamp(u_depth, 0.0, 1.0) * 2.0;
  // Preserve the slider's normalized shape logic, but permit 50% more tear
  // travel at the top end without widening any allocations or pass count.
  float displacementGain = clamp(u_displacement, 0.0, 1.0) * 1.5;
  float displacement = min(displacementGain, 1.0);
  float bandCount = mix(9.0, 38.0, displacement);
  float band = floor(v_uv.y * bandCount);
  float timeCell = floor(u_time * mix(12.0, 34.0, displacement));
  float randomA = hash11(band + timeCell * 17.0);
  float randomB = hash11(band * 3.7 + timeCell * 29.0);

  // Horizontal tear offsets alter the black mask rather than sampling the
  // scene, keeping the pass readback-free while producing a displaced glitch.
  float tearOffset = (randomA - 0.5) * displacementGain * pulse * 0.42;
  float shiftedX = v_uv.x + tearOffset;
  float inside = step(0.0, shiftedX) * step(shiftedX, 1.0);
  float segmentCount = mix(1.0, 7.0, displacement);
  float segmentPhase = fract((shiftedX + randomB * 0.21) * segmentCount);
  float displacedBlocks = mix(
    1.0,
    step(0.14, segmentPhase) * step(segmentPhase, 0.86),
    displacement * 0.78
  );
  float tearGate = mix(1.0, step(0.28, randomB), displacement * 0.72);
  float scan = 0.86 + 0.14 * step(0.5, fract(v_uv.y * bandCount * 2.0 + randomA));
  float alpha = clamp(pulse * depthGain, 0.0, 1.0) * inside * displacedBlocks * tearGate * scan;
  outColor = vec4(0.0, 0.0, 0.0, alpha);
}`;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function setCanvasVisibility(canvas: HTMLCanvasElement, visible: boolean): void {
  canvas.style.visibility = visible ? 'visible' : 'hidden';
}

/**
 * Scheduler-owned top WebGL pass. It reuses the production overlay canvas and
 * creates no canvas, RAF, timer, readback, or per-frame collection.
 */
export class DarkStrobeRenderer {
  private readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private pulseLocation: WebGLUniformLocation | null = null;
  private depthLocation: WebGLUniformLocation | null = null;
  private displacementLocation: WebGLUniformLocation | null = null;
  private timeLocation: WebGLUniformLocation | null = null;
  private contextLost = false;
  private disposed = false;
  private wasActive = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      desynchronized: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('Dark Strobe requires the production WebGL2 overlay.');
    this.gl = gl;
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    this.createResources();
  }

  render(frame: DarkStrobeFrame): boolean {
    if (this.disposed || this.contextLost || this.gl.isContextLost()) return false;
    const pulse = clamp01(frame.pulse);
    const depth = clamp01(frame.depth);
    const active = pulse * depth > 0.002;

    if (!active) {
      if (this.wasActive && !frame.baseLayerActive) {
        this.clearOverlay();
        setCanvasVisibility(this.canvas, false);
      }
      this.wasActive = false;
      return false;
    }

    if (!this.program || !this.vao) this.createResources();
    if (!this.program || !this.vao) return false;

    const gl = this.gl;
    if (!frame.baseLayerActive) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    setCanvasVisibility(this.canvas, true);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform1f(this.pulseLocation, pulse);
    gl.uniform1f(this.depthLocation, depth);
    gl.uniform1f(this.displacementLocation, clamp01(frame.displacement));
    gl.uniform1f(this.timeLocation, Number.isFinite(frame.timeSeconds) ? frame.timeSeconds : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    this.wasActive = true;
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);
    this.releaseResources();
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.program = null;
    this.vao = null;
    this.wasActive = false;
  };

  private readonly handleContextRestored = (): void => {
    if (this.disposed) return;
    this.contextLost = false;
    this.createResources();
  };

  private compile(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Unable to allocate Dark Strobe shader.');
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const message = this.gl.getShaderInfoLog(shader) || 'Dark Strobe shader compilation failed.';
      this.gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  private createResources(): void {
    this.releaseResources();
    const vertex = this.compile(this.gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = this.compile(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = this.gl.createProgram();
    const vao = this.gl.createVertexArray();
    if (!program || !vao) {
      this.gl.deleteShader(vertex);
      this.gl.deleteShader(fragment);
      if (program) this.gl.deleteProgram(program);
      if (vao) this.gl.deleteVertexArray(vao);
      throw new Error('Unable to allocate Dark Strobe WebGL resources.');
    }
    this.gl.attachShader(program, vertex);
    this.gl.attachShader(program, fragment);
    this.gl.linkProgram(program);
    this.gl.deleteShader(vertex);
    this.gl.deleteShader(fragment);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const message = this.gl.getProgramInfoLog(program) || 'Dark Strobe program linking failed.';
      this.gl.deleteProgram(program);
      this.gl.deleteVertexArray(vao);
      throw new Error(message);
    }
    this.program = program;
    this.vao = vao;
    this.pulseLocation = this.gl.getUniformLocation(program, 'u_pulse');
    this.depthLocation = this.gl.getUniformLocation(program, 'u_depth');
    this.displacementLocation = this.gl.getUniformLocation(program, 'u_displacement');
    this.timeLocation = this.gl.getUniformLocation(program, 'u_time');
  }

  private clearOverlay(): void {
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private releaseResources(): void {
    if (this.vao) this.gl.deleteVertexArray(this.vao);
    if (this.program) this.gl.deleteProgram(this.program);
    this.vao = null;
    this.program = null;
    this.pulseLocation = null;
    this.depthLocation = null;
    this.displacementLocation = null;
    this.timeLocation = null;
  }
}
