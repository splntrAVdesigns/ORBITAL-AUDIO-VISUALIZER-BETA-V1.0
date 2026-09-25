/**
 * Phase 10C — Spike Signal Chain Separation + Anti-Ceiling Fix
 *
 * Keeps Orbital's mirrored/symmetry look, but separates each modifier lane so
 * Motion Intensity, Bass Boost, Beat Boost, Frequency Smoothing and Motion
 * Smoothing no longer multiply the same final spike height stream.
 */

export interface SpikeSignalBuffers {
  amp: Float32Array;
  echo1: Float32Array;
  echo2: Float32Array;
  prevTarget: Float32Array;
  display: Float32Array;
  temp: Float32Array;
}

export interface SpikeSignalParams {
  motionIntensity: number;
  motionSmoothing: number;
  bassBoost: number;
  frequencySmoothing: boolean;
  beatReactivityBoost: boolean;
  beatDetect: boolean;
  spikeAttack: number;
  transientBoost: number;
}

export interface SpikeSignalState {
  sampleRate: number;
  dt: number;
  beatPulse: number;
  isBeat: boolean;
  visualEnvelope: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function dampValue(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-speed * Math.max(0.001, dt)));
}

function hzForBin(i: number, binCount: number, sampleRate: number): number {
  return (i / Math.max(1, binCount)) * (sampleRate * 0.5);
}

function lowBandWeight(hz: number, bassBoost: number): number {
  if (bassBoost <= 0.001) return 1;
  // Bass Boost is only low-band contribution. It does not raise the full ring.
  if (hz <= 55) return 1 + bassBoost * 0.18;
  if (hz <= 180) return 1 + bassBoost * 0.52;
  if (hz >= 520) return 1;
  const fade = 1 - ((hz - 180) / 340);
  return 1 + bassBoost * 0.52 * fade;
}

function neighborSmoothedByte(freqData: Uint8Array | Float32Array, i: number): number {
  const n = freqData.length;
  const a = freqData[Math.max(0, i - 1)] || 0;
  const b = freqData[i] || 0;
  const c = freqData[Math.min(n - 1, i + 1)] || 0;
  // Frequency Smoothing is neighboring-bin averaging only.
  return (a * 0.22 + b * 0.56 + c * 0.22) / 255;
}

export function processSpikeSignalChain(
  freqData: Uint8Array | Float32Array,
  buffers: SpikeSignalBuffers,
  params: SpikeSignalParams,
  state: SpikeSignalState
): void {
  const n = freqData.length;
  if (!n) return;

  const motionIntensity = clamp01(params.motionIntensity);
  const motionSmoothing = clamp01(params.motionSmoothing);
  const bassBoost = clamp01(params.bassBoost);
  const visualEnvelope = clamp01(state.visualEnvelope);
  const beatPulse = clamp01(state.beatPulse);

  let hotSum = 0;
  let hotCount = 0;
  let peak = 0;

  // Stage 1-4: raw FFT -> optional frequency smoothing -> bass weighting -> dynamic range expansion.
  for (let i = 0; i < n; i++) {
    const hz = hzForBin(i, n, state.sampleRate);
    let target = params.frequencySmoothing ? neighborSmoothedByte(freqData, i) : (freqData[i] || 0) / 255;

    // Noise floor before shaping; keeps quiet bins from filling the crown.
    const gate = 0.035;
    target = Math.max(0, (target - gate) / (1 - gate));

    // Bass Boost lane: only low-band contribution, tapered before global shaping.
    target *= lowBandWeight(hz, bassBoost);

    // Motion Intensity lane: dynamic range expansion, not blunt global gain.
    // Higher intensity increases contrast: weak bins stay low, active bins jump.
    const contrastPower = lerp(1.34, 0.82, motionIntensity);
    const peakLift = lerp(0.88, 1.28, motionIntensity);
    target = Math.pow(clamp01(target), contrastPower) * peakLift;

    // Visual envelope is a mild authority/breathing lane, not a full-height amplifier.
    target *= lerp(0.90, 1.10, visualEnvelope);

    buffers.temp[i] = target;
    if (target > 0.72) {
      hotSum += target;
      hotCount++;
    }
    if (target > peak) peak = target;
  }

  // Stage 5: anti-ceiling normalization. Only activates when too much of the ring is hot.
  const hotRatio = hotCount / n;
  const hotAvg = hotCount ? hotSum / hotCount : 0;
  const ceilingPressure = clamp01((hotRatio - 0.20) / 0.36) * clamp01((hotAvg - 0.78) / 0.34);
  const antiCeiling = 1 - ceilingPressure * 0.34;
  const softCeiling = lerp(0.86, 0.96, motionIntensity);

  for (let i = 0; i < n; i++) {
    let target = buffers.temp[i] * antiCeiling;

    // Beat Boost lane: only transient/onset overlay. It does not lift steady FFT levels.
    const transient = Math.max(0, target - buffers.prevTarget[i]);
    if (params.beatDetect && params.beatReactivityBoost) {
      const beatAccent = state.isBeat ? 1 : beatPulse;
      target += transient * (0.55 + beatAccent * 1.15);
    }

    // Soft knee, not hard clamp. Prevents sustained plateau/crown behavior.
    target = target / (1 + Math.max(0, target - softCeiling) * 2.25);

    // Sprint D2: Transient Boost, layered after the soft knee instead of before
    // it. Previously the boosted amount was squashed by the same compressor as
    // the base signal, and transients land exactly where the base signal is
    // already loud -- so most of the boost was being absorbed away. Now it adds
    // an accent on top of the compressed value, easing off as the bin nears
    // full height so a boosted attack can briefly punch to the max without a
    // hard clip, instead of quietly blending back into the crowd.
    if (params.transientBoost > 0.001) {
      target += transient * params.transientBoost * 1.05 * (1 - target * 0.4);
    }
    target = clamp01(target);
    buffers.prevTarget[i] = target;

    // Motion Smoothing lane: temporal smoothing only. It does not average frequency bins.
    const attackSpeed = lerp(58, 26, motionSmoothing) * lerp(0.95, 1.18, params.spikeAttack);
    const releaseSpeed = lerp(40, 17, motionSmoothing) * lerp(1.15, 0.90, params.spikeAttack);
    const speed = target > buffers.amp[i] ? attackSpeed : releaseSpeed;
    buffers.amp[i] = dampValue(buffers.amp[i], target, speed, state.dt);

    buffers.echo1[i] = dampValue(buffers.echo1[i], buffers.amp[i], 11, state.dt);
    buffers.echo2[i] = dampValue(buffers.echo2[i], buffers.echo1[i], 7, state.dt);

    // Display gate keeps the base clean while preserving peak variation.
    const displayGate = 0.07;
    const visible = Math.max(0, (buffers.amp[i] - displayGate) / (1 - displayGate));
    const displayTarget = Math.pow(visible, 1.18) * lerp(0.92, 1.08, visualEnvelope);
    const displaySpeed = displayTarget > buffers.display[i] ? 52 : 34;
    buffers.display[i] = dampValue(buffers.display[i], clamp01(displayTarget), displaySpeed, state.dt);
  }
}

export interface SymmetricSampleOptions {
  sampleRate: number;
  gamma: number;
  ampScale: number;
  ringIndex: number;
}

function mirroredFourLobeNorm(circleNorm: number): number {
  // Preserve the balanced mirrored Orbital look while avoiding one-sided bass/high imbalance.
  // Fold to left half, then split into four rising/falling lobes.
  const folded = circleNorm <= 0.5 ? circleNorm : 1 - circleNorm;
  const lobe = (folded * 4) % 1;
  return lobe <= 0.5 ? lobe * 2 : (1 - lobe) * 2;
}

export function sampleSymmetricSpikeAmplitude(
  buf: Float32Array,
  i: number,
  n: number,
  options: SymmetricSampleOptions
): number {
  const len = buf.length;
  if (!len) return 0;

  const circleNorm = i / Math.max(1, n);
  const freqNorm = mirroredFourLobeNorm(circleNorm);

  const nyquist = options.sampleRate * 0.5;
  const minHz = 45;
  const maxHz = Math.min(12000, nyquist * 0.92);
  const logMin = Math.log(minHz);
  const logMax = Math.log(maxHz);

  // Tiny deterministic offset prevents duplicated neighboring bars without breaking symmetry.
  const jitter = Math.sin(i * 7.39 + options.ringIndex * 3.11) * 0.006;
  const hz = Math.exp(logMin + clamp01(freqNorm + jitter) * (logMax - logMin));
  const exactBin = (hz / nyquist) * (len - 1);
  const b0 = Math.max(0, Math.min(len - 1, Math.floor(exactBin)));
  const b1 = Math.min(len - 1, b0 + 1);
  const frac = exactBin - b0;
  const rawAmp = (buf[b0] * (1 - frac)) + (buf[b1] * frac);

  const cleaned = Math.max(0, rawAmp - 0.045);
  const launch = Math.pow(cleaned / 0.955, 0.72);
  const renderGamma = Math.max(0.48, 1.10 - options.gamma * 0.50);
  const gammaShaped = Math.pow(clamp01(launch), renderGamma);

  // Soft headroom with micro-variation; never turn the full ring into one height.
  const soft = 1 - Math.exp(-gammaShaped * 1.55);
  const micro = 0.94 + Math.abs(Math.sin(i * 2.618)) * 0.12;
  return clamp01((soft / (1 + Math.max(0, soft - 0.88) * 0.45)) * options.ampScale * micro);
}