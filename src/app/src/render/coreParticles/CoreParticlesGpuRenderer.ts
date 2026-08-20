import {
  CORE_PARTICLE_RENDER_FRAGMENT_SHADER,
  CORE_PARTICLE_RENDER_VERTEX_SHADER,
  CORE_PARTICLE_UPDATE_FRAGMENT_SHADER,
  CORE_PARTICLE_UPDATE_VERTEX_SHADER,
} from './CoreParticleShaders';
import {
  CORE_PARTICLE_CAPACITY,
  CORE_PARTICLE_SEED_FLOATS,
  createCoreParticleSeedData,
  resetCoreParticleState,
} from './CoreParticleSeedData';
import {
  liftCoreParticleBand,
  resolveCoreParticleDrawCount,
  resolveCoreParticleDiameterGain,
  resolveCoreParticleFieldRadius,
  resolveCoreParticleImpulse,
  resolveCoreParticleIntensity,
  resolveCoreParticlePulse,
  resolveCoreParticleVisualEnergy,
} from './CoreParticleControlMapping';
import { CoreParticleQualityGovernor } from './CoreParticleQualityGovernor';
import type {
  CoreParticleGpuDiagnostics,
  CoreParticleGpuFrame,
  CoreParticleShapeMode,
} from './CoreParticleTypes';

type UniformMap = Record<string, WebGLUniformLocation>;

interface GpuResources {
  updateProgram: WebGLProgram;
  renderProgram: WebGLProgram;
  updateUniforms: UniformMap;
  renderUniforms: UniformMap;
  seedBuffers: [WebGLBuffer, WebGLBuffer];
  stateBuffers: [WebGLBuffer, WebGLBuffer];
  updateVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  renderVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  transformFeedback: WebGLTransformFeedback;
}

const UPDATE_UNIFORMS = [
  'u_time', 'u_dtFrame', 'u_fieldRadius', 'u_chaos', 'u_intensity',
  'u_smoothing', 'u_bass', 'u_mid', 'u_high', 'u_transient', 'u_beatPulse',
  'u_impulse', 'u_edgeFallback', 'u_audioActive', 'u_stereoPan',
  'u_stereoWidth', 'u_vectorAmount',
] as const;

const RENDER_UNIFORMS = [
  'u_resolution', 'u_dpr', 'u_time', 'u_intensity', 'u_visualEnergy', 'u_diameterGain', 'u_baseHue', 'u_saturation',
  'u_spectrum', 'u_bass', 'u_mid', 'u_high', 'u_beatPulse', 'u_pulse',
  'u_audioActive', 'u_energyGate', 'u_shapeMode', 'u_density', 'u_rotation', 'u_qualityScale',
] as const;

interface TimerQueryExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  label: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`[Core Particles GPU] Unable to create ${label} shader.`);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const details = gl.getShaderInfoLog(shader) || 'Unknown shader compiler error';
    gl.deleteShader(shader);
    throw new Error(`[Core Particles GPU] ${label} shader failed: ${details}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  label: string,
  transformFeedbackVaryings?: readonly string[],
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource, `${label} vertex`);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, `${label} fragment`);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error(`[Core Particles GPU] Unable to create ${label} program.`);
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  if (transformFeedbackVaryings) {
    gl.transformFeedbackVaryings(program, [...transformFeedbackVaryings], gl.INTERLEAVED_ATTRIBS);
  }
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const details = gl.getProgramInfoLog(program) || 'Unknown program linker error';
    gl.deleteProgram(program);
    throw new Error(`[Core Particles GPU] ${label} program failed: ${details}`);
  }
  return program;
}

function collectUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly string[],
): UniformMap {
  const locations: UniformMap = {};
  for (const name of names) {
    const location = gl.getUniformLocation(program, name);
    if (location === null) throw new Error(`[Core Particles GPU] Required uniform ${name} is inactive.`);
    locations[name] = location;
  }
  return locations;
}

function createBuffer(gl: WebGL2RenderingContext, data: Float32Array, usage: number): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('[Core Particles GPU] Unable to allocate buffer.');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  return buffer;
}

function configureVao(
  gl: WebGL2RenderingContext,
  stateBuffer: WebGLBuffer,
  seedBuffers: readonly [WebGLBuffer, WebGLBuffer],
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('[Core Particles GPU] Unable to allocate vertex array.');
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, stateBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffers[0]);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, CORE_PARTICLE_SEED_FLOATS, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffers[1]);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, CORE_PARTICLE_SEED_FLOATS, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return vao;
}

export function normalizeCoreParticleShapeMode(
  mode: CoreParticleShapeMode | string | undefined,
): CoreParticleShapeMode {
  if (mode === 'tri' || mode === 'triangle') return 'tri';
  if (mode === 'dia' || mode === 'diamond') return 'dia';
  if (mode === 'all') return 'all';
  return 'dot';
}

function shapeModeToUniform(mode: CoreParticleShapeMode): number {
  if (mode === 'tri') return 1;
  if (mode === 'dia') return 2;
  if (mode === 'all') return 3;
  return 0;
}

/**
 * Authoritative main-thread WebGL2 Core Particles renderer.
 *
 * Particle integration runs through transform feedback; drawing is a single point-sprite
 * call. The class never creates a scheduler and is called only by ORBITAL's existing RAF.
 */
function setCanvasVisibility(canvas: HTMLCanvasElement | OffscreenCanvas, visible: boolean): void {
  if ('style' in canvas) canvas.style.visibility = visible ? 'visible' : 'hidden';
}

function setCanvasCssSize(canvas: HTMLCanvasElement | OffscreenCanvas, width: number, height: number): void {
  if ('style' in canvas) {
    canvas.style.width = `${Math.max(1, width)}px`;
    canvas.style.height = `${Math.max(1, height)}px`;
  }
}

export class CoreParticlesGpuRenderer {
  private readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  private readonly gl: WebGL2RenderingContext;
  private readonly seedData = createCoreParticleSeedData(CORE_PARTICLE_CAPACITY);
  private resources: GpuResources | null = null;
  private readStateIndex: 0 | 1 = 0;
  private stateSeeded = false;
  private suspended = true;
  private contextLost = false;
  private disposed = false;
  private pulse = 0;
  private submittedFrames = 0;
  private contextLosses = 0;
  private contextRecoveries = 0;
  private fallbackFrames = 0;
  private lastSubmitMs = 0;
  private averageSubmitMs = 0;
  private maximumSubmitMs = 0;
  private drawCount = 0;
  private fieldRadius = 0;
  private spread = 0;
  private intensity = 0;
  private burstStrength = 0;
  private shapeMode: CoreParticleShapeMode = 'dot';
  private readonly qualityGovernor = new CoreParticleQualityGovernor();
  private qualityTier: 'full' | 'balanced' | 'critical' = 'full';
  private p95FrameMs = 17;
  private p99FrameMs = 17;
  private pointScale = 1;
  private estimatedPointArea = 0;
  private pointAreaBudget = 1_300_000;
  private timerExtension: TimerQueryExtension | null = null;
  private readonly gpuQueries: WebGLQuery[] = [];
  private readonly gpuQueryPending = new Uint8Array(3);
  private nextGpuQuery = 0;
  private activeGpuQuery = -1;
  private gpuSamples = 0;
  private lastGpuMs: number | null = null;
  private averageGpuMs: number | null = null;
  private maximumGpuMs: number | null = null;
  private readonly gpuTimingEnabled: boolean;

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.contextLosses += 1;
    this.resources = null;
    this.timerExtension = null;
    this.gpuQueries.length = 0;
    this.gpuQueryPending.fill(0);
    this.activeGpuQuery = -1;
    setCanvasVisibility(this.canvas, false);
  };

  private readonly handleContextRestored = (): void => {
    if (this.disposed) return;
    try {
      this.contextLost = false;
      this.resources = this.initializeResources();
      if (this.gpuTimingEnabled) this.initializeGpuTimers();
      this.stateSeeded = false;
      this.contextRecoveries += 1;
    } catch (error) {
      this.contextLost = true;
      console.warn('[Core Particles GPU] Context recovery failed; Canvas2D fallback remains active.', error);
    }
  };

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options: { enableGpuTimers?: boolean } = {}) {
    this.canvas = canvas;
    this.gpuTimingEnabled = options.enableGpuTimers === true;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      desynchronized: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('[Core Particles GPU] WebGL2 is unavailable.');
    this.gl = gl;
    if (this.gpuTimingEnabled) this.initializeGpuTimers();
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    try {
      this.resources = this.initializeResources();
    } catch (error) {
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      throw error;
    }
    setCanvasVisibility(this.canvas, false);
  }

  private initializeResources(): GpuResources {
    const gl = this.gl;
    const updateProgram = createProgram(
      gl,
      CORE_PARTICLE_UPDATE_VERTEX_SHADER,
      CORE_PARTICLE_UPDATE_FRAGMENT_SHADER,
      'simulation',
      ['v_nextState'],
    );
    const renderProgram = createProgram(
      gl,
      CORE_PARTICLE_RENDER_VERTEX_SHADER,
      CORE_PARTICLE_RENDER_FRAGMENT_SHADER,
      'render',
    );
    const seedBuffers: [WebGLBuffer, WebGLBuffer] = [
      createBuffer(gl, this.seedData.seed0, gl.STATIC_DRAW),
      createBuffer(gl, this.seedData.seed1, gl.STATIC_DRAW),
    ];
    const stateBuffers: [WebGLBuffer, WebGLBuffer] = [
      createBuffer(gl, this.seedData.initialState, gl.DYNAMIC_COPY),
      createBuffer(gl, this.seedData.initialState, gl.DYNAMIC_COPY),
    ];
    const updateVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject] = [
      configureVao(gl, stateBuffers[0], seedBuffers),
      configureVao(gl, stateBuffers[1], seedBuffers),
    ];
    const renderVaos: [WebGLVertexArrayObject, WebGLVertexArrayObject] = [
      configureVao(gl, stateBuffers[0], seedBuffers),
      configureVao(gl, stateBuffers[1], seedBuffers),
    ];
    const transformFeedback = gl.createTransformFeedback();
    if (!transformFeedback) throw new Error('[Core Particles GPU] Unable to allocate transform feedback.');

    this.readStateIndex = 0;
    this.stateSeeded = false;
    return {
      updateProgram,
      renderProgram,
      updateUniforms: collectUniforms(gl, updateProgram, UPDATE_UNIFORMS),
      renderUniforms: collectUniforms(gl, renderProgram, RENDER_UNIFORMS),
      seedBuffers,
      stateBuffers,
      updateVaos,
      renderVaos,
      transformFeedback,
    };
  }

  resize(width: number, height: number, dpr = 1): void {
    if (this.disposed) return;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    setCanvasCssSize(this.canvas, width, height);
    this.stateSeeded = false;
  }

  private initializeGpuTimers(): void {
    this.gpuQueries.length = 0;
    this.gpuQueryPending.fill(0);
    this.activeGpuQuery = -1;
    this.nextGpuQuery = 0;
    this.timerExtension = this.gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExtension | null;
    if (!this.timerExtension) return;
    for (let i = 0; i < this.gpuQueryPending.length; i += 1) {
      const query = this.gl.createQuery();
      if (query) this.gpuQueries.push(query);
    }
    if (this.gpuQueries.length !== this.gpuQueryPending.length) {
      for (const query of this.gpuQueries) this.gl.deleteQuery(query);
      this.gpuQueries.length = 0;
      this.timerExtension = null;
    }
  }

  private pollGpuTimers(): void {
    const extension = this.timerExtension;
    if (!extension || this.gpuQueries.length === 0) return;
    const disjoint = Boolean(this.gl.getParameter(extension.GPU_DISJOINT_EXT));
    for (let i = 0; i < this.gpuQueries.length; i += 1) {
      if (!this.gpuQueryPending[i]) continue;
      const query = this.gpuQueries[i];
      if (!this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE)) continue;
      this.gpuQueryPending[i] = 0;
      if (disjoint) continue;
      const elapsedMs = Number(this.gl.getQueryParameter(query, this.gl.QUERY_RESULT)) / 1_000_000;
      if (!Number.isFinite(elapsedMs)) continue;
      this.gpuSamples += 1;
      this.lastGpuMs = elapsedMs;
      this.averageGpuMs = this.averageGpuMs === null
        ? elapsedMs
        : this.averageGpuMs + (elapsedMs - this.averageGpuMs) / this.gpuSamples;
      this.maximumGpuMs = Math.max(this.maximumGpuMs ?? 0, elapsedMs);
    }
  }

  private beginGpuTimer(): void {
    const extension = this.timerExtension;
    if (!extension || this.activeGpuQuery >= 0 || this.gpuQueries.length === 0) return;
    for (let attempt = 0; attempt < this.gpuQueries.length; attempt += 1) {
      const index = (this.nextGpuQuery + attempt) % this.gpuQueries.length;
      if (this.gpuQueryPending[index]) continue;
      try {
        this.gl.beginQuery(extension.TIME_ELAPSED_EXT, this.gpuQueries[index]);
        this.activeGpuQuery = index;
        this.nextGpuQuery = (index + 1) % this.gpuQueries.length;
      } catch {
        this.timerExtension = null;
      }
      return;
    }
  }

  private endGpuTimer(): void {
    if (!this.timerExtension || this.activeGpuQuery < 0) return;
    try {
      this.gl.endQuery(this.timerExtension.TIME_ELAPSED_EXT);
      this.gpuQueryPending[this.activeGpuQuery] = 1;
    } catch {
      this.timerExtension = null;
    }
    this.activeGpuQuery = -1;
  }

  render(frame: CoreParticleGpuFrame): boolean {
    return this.step(frame, true);
  }

  /**
   * Advances transform-feedback simulation every worker tick while allowing
   * presentation to run at an independently budgeted cadence. When present is
   * false the previous canvas image remains intact; no clear/raster pass occurs.
   */
  step(frame: CoreParticleGpuFrame, present: boolean): boolean {
    if (this.disposed || this.contextLost || !this.resources) {
      this.fallbackFrames += 1;
      return false;
    }

    const measureSubmitTime = this.gpuTimingEnabled;
    const start = measureSubmitTime ? performance.now() : 0;
    const gl = this.gl;
    const resources = this.resources;
    const params = frame.params ?? {};
    const width = Math.max(1, frame.resolution.w);
    const height = Math.max(1, frame.resolution.h);
    const dpr = clamp(frame.resolution.dpr, 0.5, 4);
    const audioEnergy = clamp(frame.audioEnergy ?? 0);
    const bass = liftCoreParticleBand(params.coreParticleBass ?? audioEnergy, 2.85);
    const mid = liftCoreParticleBand(params.coreParticleMid ?? audioEnergy * 0.75, 2.45);
    const high = liftCoreParticleBand(params.coreParticleHigh ?? audioEnergy * 0.55, 2.15);
    const transient = liftCoreParticleBand(params.transient ?? frame.beatPulse ?? 0, 1.75);
    const beatPulse = clamp(frame.beatPulse ?? 0);
    const spread = clamp(params.coreParticlesSpread ?? 0.30);
    const intensityControl = clamp(params.coreParticlesIntensity ?? 0.50);
    const intensity = resolveCoreParticleIntensity(intensityControl);
    const visualEnergy = resolveCoreParticleVisualEnergy(intensityControl);
    const diameterGain = resolveCoreParticleDiameterGain(intensityControl);
    const chaos = Math.pow(clamp(params.coreParticlesChaos ?? 0.50), 0.72);
    const edgeFallback = Math.pow(clamp(params.coreParticlesEdgeFallback ?? 0.40), 0.68);
    const burstStrength = clamp(params.coreParticleBurstStrength ?? 0.20);
    const impulse = resolveCoreParticleImpulse(
      params.coreParticleImpulse ?? 0,
      burstStrength,
    );
    const pulseAmount = clamp(params.coreParticlesPulse ?? 0.22);
    const pulseDrive = clamp(bass * 0.38 + mid * 0.24 + high * 0.18 + transient * 0.92 + beatPulse * 0.72);
    const smoothing = clamp(params.motionSmoothing ?? 0.35);
    const attack = 0.68 - Math.pow(smoothing, 0.7) * 0.35;
    const release = 0.22 - Math.pow(smoothing, 0.7) * 0.13;
    this.pulse += (pulseDrive - this.pulse) * (pulseDrive > this.pulse ? attack : release);
    const pulse = resolveCoreParticlePulse(this.pulse, pulseAmount);
    const audioActive = audioEnergy > 0.012 ? 1 : 0;
    const fieldRadius = resolveCoreParticleFieldRadius(Math.min(width, height), spread);
    const density = clamp(params.coreParticlesDensity ?? 0.75);
    const shapeMode = normalizeCoreParticleShapeMode(params.coreParticlesShapeMode);
    this.qualityGovernor.update(frame.frameIntervalMs ?? frame.dtSec * 1000);
    const requestedDrawCount = resolveCoreParticleDrawCount(density);
    const quality = this.qualityGovernor.resolve(requestedDrawCount, dpr);
    this.drawCount = Math.max(1, Math.round(requestedDrawCount * quality.drawScale));
    this.qualityTier = quality.tier;
    this.p95FrameMs = quality.p95FrameMs;
    this.p99FrameMs = quality.p99FrameMs;
    this.pointScale = quality.pointScale;
    this.estimatedPointArea = quality.estimatedPointArea;
    this.pointAreaBudget = quality.pointAreaBudget;

    if (!this.stateSeeded) {
      resetCoreParticleState(this.seedData.initialState, this.seedData.seed0, fieldRadius);
      for (const buffer of resources.stateBuffers) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.seedData.initialState);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      this.stateSeeded = true;
    }

    if (this.suspended) setCanvasVisibility(this.canvas, true);
    this.suspended = false;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    if (present) {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (this.gpuTimingEnabled) {
        this.pollGpuTimers();
        this.beginGpuTimer();
      }
    }

    const nextStateIndex = (1 - this.readStateIndex) as 0 | 1;
    const update = resources.updateUniforms;
    gl.useProgram(resources.updateProgram);
    gl.uniform1f(update.u_time, frame.timeSec);
    gl.uniform1f(update.u_dtFrame, clamp(frame.dtSec * 60, 0.25, 1));
    gl.uniform1f(update.u_fieldRadius, fieldRadius);
    gl.uniform1f(update.u_chaos, chaos);
    gl.uniform1f(update.u_intensity, intensity);
    gl.uniform1f(update.u_smoothing, smoothing);
    gl.uniform1f(update.u_bass, bass);
    gl.uniform1f(update.u_mid, mid);
    gl.uniform1f(update.u_high, high);
    gl.uniform1f(update.u_transient, transient);
    gl.uniform1f(update.u_beatPulse, beatPulse);
    gl.uniform1f(update.u_impulse, impulse);
    gl.uniform1f(update.u_edgeFallback, edgeFallback);
    gl.uniform1f(update.u_audioActive, audioActive);
    gl.uniform1f(update.u_stereoPan, clamp(params.stereoPan ?? 0, -1, 1));
    gl.uniform1f(update.u_stereoWidth, clamp(params.stereoWidth ?? 0.85));
    gl.uniform1f(update.u_vectorAmount, clamp(params.vectorAmount ?? 0.14));

    gl.enable(gl.RASTERIZER_DISCARD);
    gl.bindVertexArray(resources.updateVaos[this.readStateIndex]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, resources.transformFeedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, resources.stateBuffers[nextStateIndex]);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, CORE_PARTICLE_CAPACITY);
    gl.endTransformFeedback();
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    gl.disable(gl.RASTERIZER_DISCARD);
    this.readStateIndex = nextStateIndex;

    if (present) {
      const render = resources.renderUniforms;
      gl.useProgram(resources.renderProgram);
      gl.uniform2f(render.u_resolution, width, height);
      gl.uniform1f(render.u_dpr, dpr);
      gl.uniform1f(render.u_time, frame.timeSec);
      gl.uniform1f(render.u_intensity, intensity);
      gl.uniform1f(render.u_visualEnergy, visualEnergy);
      gl.uniform1f(render.u_diameterGain, diameterGain);
      gl.uniform1f(render.u_baseHue, ((params.effectiveHue ?? 200) % 360 + 360) % 360);
      gl.uniform1f(render.u_saturation, clamp(params.satNorm ?? 1));
      gl.uniform1f(render.u_spectrum, params.spectrum ? 1 : 0);
      gl.uniform1f(render.u_bass, bass);
      gl.uniform1f(render.u_mid, mid);
      gl.uniform1f(render.u_high, high);
      gl.uniform1f(render.u_beatPulse, beatPulse);
      gl.uniform1f(render.u_pulse, pulse);
      gl.uniform1f(render.u_audioActive, audioActive);
      gl.uniform1f(render.u_energyGate, clamp(params.energyGateSmoother ?? 1));
      gl.uniform1f(render.u_shapeMode, shapeModeToUniform(shapeMode));
      gl.uniform1f(render.u_density, density);
      gl.uniform1f(render.u_rotation, Number.isFinite(params.rotationAngle) ? params.rotationAngle as number : 0);
      gl.uniform1f(render.u_qualityScale, this.pointScale);

      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(resources.renderVaos[this.readStateIndex]);
      gl.drawArrays(gl.POINTS, 0, this.drawCount);
      gl.bindVertexArray(null);
      if (this.gpuTimingEnabled) this.endGpuTimer();
      this.submittedFrames += 1;
    }
    if (present && measureSubmitTime && this.submittedFrames > 0) {
      this.lastSubmitMs = performance.now() - start;
      this.averageSubmitMs += (this.lastSubmitMs - this.averageSubmitMs) / this.submittedFrames;
      this.maximumSubmitMs = Math.max(this.maximumSubmitMs, this.lastSubmitMs);
    }
    this.fieldRadius = fieldRadius;
    this.spread = spread;
    this.intensity = intensity;
    this.burstStrength = burstStrength;
    this.shapeMode = shapeMode;
    return true;
  }

  /** Clears once and then stops all GPU work until the feature is enabled again. */
  suspend(): void {
    if (this.disposed || this.suspended) return;
    if (!this.contextLost) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    this.suspended = true;
    setCanvasVisibility(this.canvas, false);
  }

  getContext(): WebGL2RenderingContext {
    return this.gl;
  }

  getDiagnostics(): CoreParticleGpuDiagnostics {
    return {
      backend: 'webgl2-transform-feedback',
      state: this.disposed
        ? 'disposed'
        : this.contextLost
          ? 'context-lost'
          : this.suspended
            ? 'suspended'
            : this.resources
              ? 'ready'
              : 'unavailable',
      particleCapacity: CORE_PARTICLE_CAPACITY,
      drawCount: this.drawCount,
      submittedFrames: this.submittedFrames,
      contextLosses: this.contextLosses,
      contextRecoveries: this.contextRecoveries,
      fallbackFrames: this.fallbackFrames,
      lastSubmitMs: this.lastSubmitMs,
      averageSubmitMs: this.averageSubmitMs,
      maximumSubmitMs: this.maximumSubmitMs,
      lastGpuMs: this.lastGpuMs,
      averageGpuMs: this.averageGpuMs,
      maximumGpuMs: this.maximumGpuMs,
      gpuTimerSupported: Boolean(this.timerExtension),
      fieldRadius: this.fieldRadius,
      spread: this.spread,
      intensity: this.intensity,
      burstStrength: this.burstStrength,
      shapeMode: this.shapeMode,
      qualityTier: this.qualityTier,
      p95FrameMs: this.p95FrameMs,
      p99FrameMs: this.p99FrameMs,
      pointScale: this.pointScale,
      estimatedPointArea: this.estimatedPointArea,
      pointAreaBudget: this.pointAreaBudget,
    };
  }

  private deleteResources(resources: GpuResources): void {
    const gl = this.gl;
    for (const vao of [...resources.updateVaos, ...resources.renderVaos]) gl.deleteVertexArray(vao);
    for (const buffer of [...resources.seedBuffers, ...resources.stateBuffers]) gl.deleteBuffer(buffer);
    gl.deleteTransformFeedback(resources.transformFeedback);
    gl.deleteProgram(resources.updateProgram);
    gl.deleteProgram(resources.renderProgram);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);
    if (this.resources && !this.contextLost) this.deleteResources(this.resources);
    if (!this.contextLost) for (const query of this.gpuQueries) this.gl.deleteQuery(query);
    this.gpuQueries.length = 0;
    this.qualityGovernor.reset();
    this.resources = null;
    setCanvasVisibility(this.canvas, false);
    const extension = this.gl.getExtension('WEBGL_lose_context');
    extension?.loseContext();
  }
}
