import type { SpikeProgramLocations } from '../../../utils/webglShaders';

const VERTICES_PER_SPIKE = 6;
const MIN_SPIKE_HZ = 45;
const MAX_SPIKE_HZ = 12_000;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mirroredFourLobeNorm(circleNorm: number): number {
  const folded = circleNorm <= 0.5 ? circleNorm : 1 - circleNorm;
  const lobe = (folded * 4) % 1;
  return lobe <= 0.5 ? lobe * 2 : (1 - lobe) * 2;
}

function spikeAngleJitter(index: number): number {
  const x = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 0.018;
}

export interface WebGLSpikeRenderFrame {
  source: Float32Array;
  sampleRate: number;
  spikeCount: number;
  width: number;
  height: number;
  innerRadius: number;
  outerRadius: number;
  rotation: number;
  mirror: number;
  spikeTightness: number;
  zoom: number;
  chaosAmount: number;
  chaosTime: number;
  hue: number;
  saturation: number;
  lightness: number;
  spectrum: boolean;
  colorWaveActive: boolean;
  colorWaveTime: number;
  colorWaveAmount: number;
  bloom: number;
  gamma: number;
  gammaFlash: number;
  iridize: number;
  iridizeTime: number;
  beatPulse: number;
}

/**
 * Owns the legacy spike WebGL2 program's immutable state, VAO, FFT mapping,
 * amplitude profile, and draw submission outside the visualizer session.
 */
export class WebGLSpikeRenderer {
  private readonly vao: WebGLVertexArrayObject;
  private readonly indexBuffer: WebGLBuffer;
  private readonly amplitudeBuffer: WebGLBuffer;
  private readonly isEndBuffer: WebGLBuffer;
  private readonly sideBuffer: WebGLBuffer;
  private readonly jitterBuffer: WebGLBuffer;
  private readonly maxLineWidth: number;

  private spikeCount = 0;
  private sourceLength = 0;
  private sampleRate = 0;
  private indexData = new Float32Array(0);
  private amplitudeData = new Float32Array(0);
  private isEndData = new Float32Array(0);
  private sideData = new Float32Array(0);
  private jitterData = new Float32Array(0);
  private amplitudeProfile = new Float32Array(0);
  private frequencyBin0 = new Uint16Array(0);
  private frequencyBin1 = new Uint16Array(0);
  private frequencyFraction = new Float32Array(0);
  private amplitudeMicro = new Float32Array(0);

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly program: WebGLProgram,
    private readonly locations: SpikeProgramLocations,
    private readonly debug = false,
  ) {
    const lineWidthRange = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE) as Float32Array | number[] | null;
    this.maxLineWidth = Number(lineWidthRange?.[1]) || 1;

    const vao = gl.createVertexArray();
    const indexBuffer = gl.createBuffer();
    const amplitudeBuffer = gl.createBuffer();
    const isEndBuffer = gl.createBuffer();
    const sideBuffer = gl.createBuffer();
    const jitterBuffer = gl.createBuffer();
    if (!vao || !indexBuffer || !amplitudeBuffer || !isEndBuffer || !sideBuffer || !jitterBuffer) {
      throw new Error('Unable to allocate the WebGL spike VAO or attribute buffers.');
    }
    this.vao = vao;
    this.indexBuffer = indexBuffer;
    this.amplitudeBuffer = amplitudeBuffer;
    this.isEndBuffer = isEndBuffer;
    this.sideBuffer = sideBuffer;
    this.jitterBuffer = jitterBuffer;

    gl.bindVertexArray(this.vao);
    this.bindAttribute(this.indexBuffer, locations.a_index);
    this.bindAttribute(this.amplitudeBuffer, locations.a_amplitude);
    this.bindAttribute(this.isEndBuffer, locations.a_isEnd);
    this.bindAttribute(this.sideBuffer, locations.a_side);
    this.bindAttribute(this.jitterBuffer, locations.a_jitter);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.lineWidth(this.maxLineWidth);
    gl.clearColor(0, 0, 0, 0);
  }

  render(frame: WebGLSpikeRenderFrame): void {
    const count = Math.max(1, Math.floor(frame.spikeCount));
    this.ensureGeometry(count);
    this.ensureFrequencyMap(count, frame.source.length, frame.sampleRate);
    this.fillAuthoritativeAmplitudeProfile(frame.source);

    const gl = this.gl;
    const loc = this.locations;
    const vertexCount = count * VERTICES_PER_SPIKE;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.amplitudeBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.amplitudeData);

    gl.uniform2f(loc.u_resolution, frame.width, frame.height);
    gl.uniform1f(loc.u_innerRadius, frame.innerRadius);
    gl.uniform1f(loc.u_outerRadius, frame.outerRadius);
    gl.uniform1f(loc.u_rotation, frame.rotation);
    gl.uniform1f(loc.u_spikeCount, count);
    gl.uniform1f(loc.u_mirror, frame.mirror);
    gl.uniform1f(loc.u_spikeTightness, frame.spikeTightness);
    gl.uniform1f(loc.u_zoom, frame.zoom);
    gl.uniform1f(loc.u_centerX, frame.width * 0.5);
    gl.uniform1f(loc.u_centerY, frame.height * 0.5);
    gl.uniform1f(loc.u_chaosAmount, frame.chaosAmount);
    gl.uniform1f(loc.u_chaosTime, frame.chaosTime);
    gl.uniform3f(loc.u_baseColor, frame.hue / 360, frame.saturation, frame.lightness);
    gl.uniform1f(loc.u_spectrum, frame.spectrum ? 1 : 0);
    gl.uniform1f(loc.u_saturation, frame.saturation);
    gl.uniform1f(loc.u_lightness, frame.lightness);
    gl.uniform1f(loc.u_colorWaveActive, frame.colorWaveActive ? 1 : 0);
    gl.uniform1f(loc.u_colorWaveTime, frame.colorWaveTime);
    gl.uniform1f(loc.u_colorWaveAmount, frame.colorWaveAmount);
    gl.uniform1f(loc.u_bloom, frame.bloom);

    const gamma = clamp01(frame.gamma);
    gl.uniform1f(loc.u_gammaFx, gamma);
    gl.uniform1f(loc.u_gammaFlash, clamp01(frame.gammaFlash));
    gl.uniform1f(loc.u_gammaTipBoost, gamma * gamma);
    gl.uniform1f(loc.u_iridize, clamp01(frame.iridize));
    gl.uniform1f(loc.u_iridizeTime, frame.iridizeTime);
    gl.uniform1f(loc.u_iridizeBeat, clamp01(frame.beatPulse));
    gl.uniform1f(loc.u_alpha, 0.9);

    gl.uniform1f(loc.u_spikeDirection, 1);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    if (frame.mirror > 0.01) {
      gl.uniform1f(loc.u_spikeDirection, -1);
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    }

    gl.bindVertexArray(null);
    if (this.debug) {
      const error = gl.getError();
      if (error !== gl.NO_ERROR) console.error(`[WebGLSpikeRenderer] WebGL error ${error}`);
    }
  }

  clear(): void {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteBuffer(this.amplitudeBuffer);
    gl.deleteBuffer(this.isEndBuffer);
    gl.deleteBuffer(this.sideBuffer);
    gl.deleteBuffer(this.jitterBuffer);
  }

  private bindAttribute(buffer: WebGLBuffer, location: number): void {
    if (location < 0) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 1, gl.FLOAT, false, 0, 0);
  }

  private ensureGeometry(count: number): void {
    if (count === this.spikeCount) return;
    this.spikeCount = count;
    const vertexCount = count * VERTICES_PER_SPIKE;
    this.indexData = new Float32Array(vertexCount);
    this.amplitudeData = new Float32Array(vertexCount);
    this.isEndData = new Float32Array(vertexCount);
    this.sideData = new Float32Array(vertexCount);
    this.jitterData = new Float32Array(vertexCount);
    this.amplitudeProfile = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const base = index * VERTICES_PER_SPIKE;
      const jitter = spikeAngleJitter(index);
      this.indexData[base] = index;
      this.indexData[base + 1] = index;
      this.indexData[base + 2] = index;
      this.indexData[base + 3] = index;
      this.indexData[base + 4] = index;
      this.indexData[base + 5] = index;
      this.isEndData[base] = 0;
      this.isEndData[base + 1] = 0;
      this.isEndData[base + 2] = 1;
      this.isEndData[base + 3] = 1;
      this.isEndData[base + 4] = 0;
      this.isEndData[base + 5] = 1;
      this.sideData[base] = -1;
      this.sideData[base + 1] = 1;
      this.sideData[base + 2] = -1;
      this.sideData[base + 3] = -1;
      this.sideData[base + 4] = 1;
      this.sideData[base + 5] = 1;
      this.jitterData.fill(jitter, base, base + VERTICES_PER_SPIKE);
    }

    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    this.uploadStaticBuffer(this.indexBuffer, this.indexData);
    this.uploadStaticBuffer(this.isEndBuffer, this.isEndData);
    this.uploadStaticBuffer(this.sideBuffer, this.sideData);
    this.uploadStaticBuffer(this.jitterBuffer, this.jitterData);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.amplitudeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.amplitudeData.byteLength, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);

    this.sourceLength = 0;
    this.sampleRate = 0;
  }

  private uploadStaticBuffer(buffer: WebGLBuffer, data: Float32Array): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  private ensureFrequencyMap(count: number, sourceLength: number, sampleRate: number): void {
    if (
      count === this.frequencyBin0.length &&
      sourceLength === this.sourceLength &&
      sampleRate === this.sampleRate
    ) {
      return;
    }
    this.sourceLength = sourceLength;
    this.sampleRate = sampleRate;
    this.frequencyBin0 = new Uint16Array(count);
    this.frequencyBin1 = new Uint16Array(count);
    this.frequencyFraction = new Float32Array(count);
    this.amplitudeMicro = new Float32Array(count);
    if (sourceLength <= 0) return;

    const nyquist = Math.max(1, sampleRate * 0.5);
    const maxHz = Math.min(MAX_SPIKE_HZ, nyquist * 0.92);
    const logMin = Math.log(MIN_SPIKE_HZ);
    const logRange = Math.log(maxHz) - logMin;
    for (let index = 0; index < count; index += 1) {
      const norm = mirroredFourLobeNorm(index / Math.max(1, count));
      const jitter = Math.sin(index * 7.39) * 0.006;
      const hz = Math.exp(logMin + clamp01(norm + jitter) * logRange);
      const exactBin = (hz / nyquist) * (sourceLength - 1);
      const bin0 = Math.max(0, Math.min(sourceLength - 1, Math.floor(exactBin)));
      this.frequencyBin0[index] = bin0;
      this.frequencyBin1[index] = Math.min(sourceLength - 1, bin0 + 1);
      this.frequencyFraction[index] = exactBin - bin0;
      this.amplitudeMicro[index] = 0.94 + Math.abs(Math.sin(index * 2.618)) * 0.12;
    }
  }

  private fillAuthoritativeAmplitudeProfile(source: Float32Array): void {
    if (source.length === 0) {
      this.amplitudeProfile.fill(0);
      this.amplitudeData.fill(0);
      return;
    }
    for (let index = 0; index < this.spikeCount; index += 1) {
      const fraction = this.frequencyFraction[index];
      const rawAmplitude =
        source[this.frequencyBin0[index]] * (1 - fraction) +
        source[this.frequencyBin1[index]] * fraction;
      const cleaned = Math.max(0, rawAmplitude - 0.045);
      const launch = Math.pow(cleaned / 0.955, 0.72);
      const shaped = Math.pow(clamp01(launch), 1.1);
      const soft = 1 - Math.exp(-shaped * 1.55);
      const amplitude = clamp01(
        (soft / (1 + Math.max(0, soft - 0.88) * 0.45)) * this.amplitudeMicro[index],
      );
      this.amplitudeProfile[index] = amplitude;
      this.amplitudeData.fill(
        amplitude,
        index * VERTICES_PER_SPIKE,
        (index + 1) * VERTICES_PER_SPIKE,
      );
    }
  }
}
