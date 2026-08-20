/**
 * ORBITAL — Spike Ring Geometry Utilities
 *
 * Recreated geometry module for the WebGL spike ring pipeline.
 *
 * Purpose:
 * - Keep static spike quad geometry out of the frame/render loop.
 * - Preserve the current shader contract used by /utils/webglShaders.ts:
 *   a_index, a_amplitude, a_isEnd, a_side, a_jitter.
 * - Let the render loop update only amplitude data each frame.
 * - Keep deterministic angular jitter stable so spikes do not shimmer/reseed.
 *
 * This file is intentionally dependency-light so it can be imported from App.tsx,
 * a future SpikeRingLayer, or any other render-path module without pulling React state into
 * the geometry layer.
 */

export const SPIKE_VERTICES_PER_SPIKE = 6;

export interface SpikeGeometryOptions {
  /** Number of radial spikes/bars around the ring. */
  spikeCount: number;

  /**
   * Angular jitter amount in radians.
   * Keep subtle. The current App.tsx inline implementation used 0.018.
   */
  jitterAmount?: number;

  /**
   * Optional jitter phase/seed offset. Useful if outward and inward layers should
   * have slightly different but still deterministic jitter.
   */
  jitterSeedOffset?: number;
}

export interface SpikeGeometryBuffers {
  spikeCount: number;
  vertexCount: number;

  /** Attribute: a_index — repeated spike index per quad vertex. */
  indexData: Float32Array;

  /** Attribute: a_amplitude — dynamic lane, normally updated every frame. */
  amplitudeData: Float32Array;

  /** Attribute: a_isEnd — 0 base vertex, 1 tip vertex. Static. */
  isEndData: Float32Array;

  /** Attribute: a_side — -1 left edge, +1 right edge. Static. */
  sideData: Float32Array;

  /** Attribute: a_jitter — stable angular offset in radians. Static. */
  jitterData: Float32Array;
}

export interface SpikeAmplitudeOptions {
  /** Gain applied to every sampled amplitude before clamping. */
  ampScale?: number;

  /** Optional render gamma. Values below 1 open up mids; above 1 tightens peaks. */
  gamma?: number;

  /** Low-level gate to prevent weak FFT noise from filling the ring. */
  noiseGate?: number;

  /** Soft ceiling amount. Higher values clamp hot/crown behavior more strongly. */
  softCeiling?: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Deterministic pseudo-random angular jitter.
 * Stable by spike index, which prevents frame-to-frame swimming/flicker.
 */
export function getSpikeAngleJitter(
  spikeIndex: number,
  jitterAmount = 0.018,
  jitterSeedOffset = 0
): number {
  return Math.sin((spikeIndex + jitterSeedOffset) * 137.508) * jitterAmount;
}

/**
 * Creates the full WebGL quad attribute buffers for the spike ring.
 *
 * These are the exact two-triangle vertices currently built inline in App.tsx:
 * - base-left
 * - base-right
 * - tip-left
 * - tip-left
 * - base-right
 * - tip-right
 */
export function createSpikeGeometryBuffers(options: SpikeGeometryOptions): SpikeGeometryBuffers {
  const spikeCount = Math.max(1, Math.floor(options.spikeCount));
  const vertexCount = spikeCount * SPIKE_VERTICES_PER_SPIKE;
  const jitterAmount = options.jitterAmount ?? 0.018;
  const jitterSeedOffset = options.jitterSeedOffset ?? 0;

  const indexData = new Float32Array(vertexCount);
  const amplitudeData = new Float32Array(vertexCount);
  const isEndData = new Float32Array(vertexCount);
  const sideData = new Float32Array(vertexCount);
  const jitterData = new Float32Array(vertexCount);

  for (let i = 0; i < spikeCount; i++) {
    const base = i * SPIKE_VERTICES_PER_SPIKE;
    const angleJitter = getSpikeAngleJitter(i, jitterAmount, jitterSeedOffset);

    // Triangle 1: base-left, base-right, tip-left
    indexData[base + 0] = i;
    isEndData[base + 0] = 0;
    sideData[base + 0] = -1;

    indexData[base + 1] = i;
    isEndData[base + 1] = 0;
    sideData[base + 1] = 1;

    indexData[base + 2] = i;
    isEndData[base + 2] = 1;
    sideData[base + 2] = -1;

    // Triangle 2: tip-left, base-right, tip-right
    indexData[base + 3] = i;
    isEndData[base + 3] = 1;
    sideData[base + 3] = -1;

    indexData[base + 4] = i;
    isEndData[base + 4] = 0;
    sideData[base + 4] = 1;

    indexData[base + 5] = i;
    isEndData[base + 5] = 1;
    sideData[base + 5] = 1;

    for (let v = 0; v < SPIKE_VERTICES_PER_SPIKE; v++) {
      jitterData[base + v] = angleJitter;
    }
  }

  return {
    spikeCount,
    vertexCount,
    indexData,
    amplitudeData,
    isEndData,
    sideData,
    jitterData,
  };
}

/**
 * Ensures an existing geometry buffer matches the requested spike count.
 * Reuses buffers when possible to avoid unnecessary allocations.
 */
export function ensureSpikeGeometryBuffers(
  current: SpikeGeometryBuffers | null | undefined,
  options: SpikeGeometryOptions
): SpikeGeometryBuffers {
  const spikeCount = Math.max(1, Math.floor(options.spikeCount));
  if (current && current.spikeCount === spikeCount) {
    return current;
  }
  return createSpikeGeometryBuffers(options);
}

/**
 * Writes one amplitude value into all 6 vertices for a spike quad.
 */
export function writeSpikeAmplitude(
  geometry: SpikeGeometryBuffers,
  spikeIndex: number,
  amplitude: number
): void {
  if (spikeIndex < 0 || spikeIndex >= geometry.spikeCount) return;

  const value = clamp01(amplitude);
  const base = spikeIndex * SPIKE_VERTICES_PER_SPIKE;
  for (let v = 0; v < SPIKE_VERTICES_PER_SPIKE; v++) {
    geometry.amplitudeData[base + v] = value;
  }
}

/**
 * Fills the dynamic amplitude attribute using a callback sampler.
 *
 * Example:
 * fillSpikeAmplitudes(geometry, (i, n) => sampleSymmetricSpikeAmplitude(buf, i, n, opts));
 */
export function fillSpikeAmplitudes(
  geometry: SpikeGeometryBuffers,
  sampleAmplitude: (spikeIndex: number, spikeCount: number) => number
): Float32Array {
  for (let i = 0; i < geometry.spikeCount; i++) {
    writeSpikeAmplitude(geometry, i, sampleAmplitude(i, geometry.spikeCount));
  }
  return geometry.amplitudeData;
}

/**
 * Simple fallback amplitude sampler for direct FFT/byte buffers.
 *
 * Most Orbital builds should prefer sampleSymmetricSpikeAmplitude from
 * spikeSignalChain.ts, but this helper is useful for isolated tests or future
 * render layers that do not need the full signal chain.
 */
export function sampleLinearSpikeAmplitude(
  source: Uint8Array | Float32Array,
  spikeIndex: number,
  spikeCount: number,
  options: SpikeAmplitudeOptions = {}
): number {
  if (!source.length) return 0;

  const ampScale = options.ampScale ?? 1;
  const gamma = Math.max(0.1, options.gamma ?? 1);
  const noiseGate = clamp01(options.noiseGate ?? 0.035);
  const softCeiling = Math.max(0.001, options.softCeiling ?? 0.92);

  const sourceIndex = Math.min(
    source.length - 1,
    Math.max(0, Math.floor((spikeIndex / Math.max(1, spikeCount)) * source.length))
  );

  const raw = source[sourceIndex];
  const normalized = raw > 1 ? raw / 255 : raw;
  const gated = Math.max(0, (normalized - noiseGate) / Math.max(0.001, 1 - noiseGate));
  const shaped = Math.pow(clamp01(gated), gamma) * ampScale;

  // Soft knee instead of hard clipping, so a hot signal does not become a flat crown.
  const over = Math.max(0, shaped - softCeiling);
  return clamp01(shaped / (1 + over * 2.25));
}

/**
 * Convenience function for filling amplitudes from a direct FFT/byte buffer.
 */
export function fillSpikeAmplitudesFromSource(
  geometry: SpikeGeometryBuffers,
  source: Uint8Array | Float32Array,
  options: SpikeAmplitudeOptions = {}
): Float32Array {
  return fillSpikeAmplitudes(geometry, (i, n) => sampleLinearSpikeAmplitude(source, i, n, options));
}

export interface SpikeAttributeLocations {
  a_index: number;
  a_amplitude: number;
  a_isEnd: number;
  a_side: number;
  a_jitter: number;
}

export interface SpikeWebGLBuffers {
  indexBuffer: WebGLBuffer;
  amplitudeBuffer: WebGLBuffer;
  isEndBuffer: WebGLBuffer;
  sideBuffer: WebGLBuffer;
  jitterBuffer: WebGLBuffer;
}

function bindFloatAttribute(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  location: number,
  buffer: WebGLBuffer,
  data: Float32Array,
  usage: number
): void {
  if (location < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 1, gl.FLOAT, false, 0, 0);
}

/**
 * Creates GPU buffers and uploads the static spike geometry once.
 * The amplitude buffer is initialized but expected to be updated every frame.
 */
export function createSpikeWebGLBuffers(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  geometry: SpikeGeometryBuffers,
  locations: SpikeAttributeLocations
): SpikeWebGLBuffers | null {
  const indexBuffer = gl.createBuffer();
  const amplitudeBuffer = gl.createBuffer();
  const isEndBuffer = gl.createBuffer();
  const sideBuffer = gl.createBuffer();
  const jitterBuffer = gl.createBuffer();

  if (!indexBuffer || !amplitudeBuffer || !isEndBuffer || !sideBuffer || !jitterBuffer) {
    return null;
  }

  bindFloatAttribute(gl, locations.a_index, indexBuffer, geometry.indexData, gl.STATIC_DRAW);
  bindFloatAttribute(gl, locations.a_amplitude, amplitudeBuffer, geometry.amplitudeData, gl.DYNAMIC_DRAW);
  bindFloatAttribute(gl, locations.a_isEnd, isEndBuffer, geometry.isEndData, gl.STATIC_DRAW);
  bindFloatAttribute(gl, locations.a_side, sideBuffer, geometry.sideData, gl.STATIC_DRAW);
  bindFloatAttribute(gl, locations.a_jitter, jitterBuffer, geometry.jitterData, gl.STATIC_DRAW);

  return {
    indexBuffer,
    amplitudeBuffer,
    isEndBuffer,
    sideBuffer,
    jitterBuffer,
  };
}

/**
 * Updates only the dynamic amplitude buffer.
 * Call this after fillSpikeAmplitudes(...) and before drawArrays(...).
 */
export function uploadSpikeAmplitudeBuffer(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  webglBuffers: SpikeWebGLBuffers,
  geometry: SpikeGeometryBuffers,
  amplitudeLocation: number
): void {
  if (amplitudeLocation < 0) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, webglBuffers.amplitudeBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, geometry.amplitudeData);
  gl.enableVertexAttribArray(amplitudeLocation);
  gl.vertexAttribPointer(amplitudeLocation, 1, gl.FLOAT, false, 0, 0);
}

/**
 * Rebinds all spike attributes.
 * Useful after switching programs, recreating context, or when another layer has
 * changed ARRAY_BUFFER bindings.
 */
export function bindSpikeGeometryAttributes(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  webglBuffers: SpikeWebGLBuffers,
  locations: SpikeAttributeLocations
): void {
  const bindExisting = (location: number, buffer: WebGLBuffer) => {
    if (location < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 1, gl.FLOAT, false, 0, 0);
  };

  bindExisting(locations.a_index, webglBuffers.indexBuffer);
  bindExisting(locations.a_amplitude, webglBuffers.amplitudeBuffer);
  bindExisting(locations.a_isEnd, webglBuffers.isEndBuffer);
  bindExisting(locations.a_side, webglBuffers.sideBuffer);
  bindExisting(locations.a_jitter, webglBuffers.jitterBuffer);
}

export function deleteSpikeWebGLBuffers(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  buffers: SpikeWebGLBuffers | null | undefined
): void {
  if (!buffers) return;
  gl.deleteBuffer(buffers.indexBuffer);
  gl.deleteBuffer(buffers.amplitudeBuffer);
  gl.deleteBuffer(buffers.isEndBuffer);
  gl.deleteBuffer(buffers.sideBuffer);
  gl.deleteBuffer(buffers.jitterBuffer);
}