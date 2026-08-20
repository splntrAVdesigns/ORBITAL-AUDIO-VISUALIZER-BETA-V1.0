export type AutoBpmStatus = 'idle' | 'analyzing' | 'ready' | 'unavailable';

export interface BpmDetectionResult {
  readonly bpm: number;
  readonly confidence: number;
}

const MIN_BPM = 40;
const MAX_BPM = 220;
const TARGET_SAMPLE_RATE = 200;
const WINDOW_SECONDS = 0.05;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeTempo(value: number): number {
  let bpm = value;
  while (bpm < MIN_BPM) bpm *= 2;
  while (bpm > MAX_BPM) bpm /= 2;
  return bpm;
}

/**
 * Estimates tempo from decoded PCM using a mono energy-onset envelope and
 * normalized autocorrelation. Pure math: safe to move into the render/audio
 * worker later and deterministic enough for synthetic certification fixtures.
 */
export function analyzeTempoFromChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
): BpmDetectionResult | null {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || channels.length === 0) return null;
  const length = Math.min(...channels.map((channel) => channel.length));
  if (length < sampleRate * 4) return null;

  const hop = Math.max(1, Math.round(sampleRate / TARGET_SAMPLE_RATE));
  const envelopeLength = Math.floor(length / hop);
  const energy = new Float32Array(envelopeLength);

  for (let frame = 0; frame < envelopeLength; frame += 1) {
    const start = frame * hop;
    let sum = 0;
    for (let offset = 0; offset < hop && start + offset < length; offset += 1) {
      let mono = 0;
      for (const channel of channels) mono += channel[start + offset] || 0;
      mono /= channels.length;
      sum += mono * mono;
    }
    energy[frame] = Math.sqrt(sum / hop);
  }

  const smoothingRadius = Math.max(1, Math.round(TARGET_SAMPLE_RATE * WINDOW_SECONDS));
  const onset = new Float32Array(envelopeLength);
  let rolling = 0;
  for (let index = 0; index < envelopeLength; index += 1) {
    rolling += energy[index];
    if (index >= smoothingRadius) rolling -= energy[index - smoothingRadius];
    const mean = rolling / Math.min(index + 1, smoothingRadius);
    const previous = index > 0 ? energy[index - 1] : energy[index];
    onset[index] = Math.max(0, energy[index] - Math.max(mean * 0.82, previous * 0.92));
  }

  let onsetMean = 0;
  for (const value of onset) onsetMean += value;
  onsetMean /= onset.length;
  let onsetVariance = 0;
  for (const value of onset) onsetVariance += (value - onsetMean) ** 2;
  if (onsetVariance <= 1e-10) return null;

  // First use stable onset-to-onset intervals. This avoids the common
  // autocorrelation ambiguity where 140 BPM can look equally strong at 70/47.
  const onsetStdDev = Math.sqrt(onsetVariance / onset.length);
  const peakThreshold = onsetMean + onsetStdDev * 0.65;
  const refractory = Math.max(1, Math.floor(TARGET_SAMPLE_RATE * 60 / MAX_BPM * 0.72));
  const peaks: number[] = [];
  for (let index = 1; index < onset.length - 1; index += 1) {
    if (onset[index] < peakThreshold || onset[index] < onset[index - 1] || onset[index] <= onset[index + 1]) continue;
    if (peaks.length > 0 && index - peaks[peaks.length - 1] < refractory) {
      if (onset[index] > onset[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = index;
      continue;
    }
    peaks.push(index);
  }
  if (peaks.length >= 8) {
    const intervals: number[] = [];
    for (let index = 1; index < peaks.length; index += 1) {
      const interval = peaks[index] - peaks[index - 1];
      const bpm = 60 * TARGET_SAMPLE_RATE / interval;
      if (bpm >= MIN_BPM && bpm <= MAX_BPM) intervals.push(interval);
    }
    if (intervals.length >= 6) {
      const sorted = [...intervals].sort((a, b) => a - b);
      const medianInterval = sorted[Math.floor(sorted.length / 2)];
      const deviations = intervals.map((value) => Math.abs(value - medianInterval) / medianInterval);
      const stable = deviations.filter((value) => value <= 0.12).length / deviations.length;
      if (stable >= 0.55) {
        const bpm = Math.round(60 * TARGET_SAMPLE_RATE / medianInterval);
        return { bpm, confidence: clamp01(0.45 + stable * 0.5) };
      }
    }
  }

  const minLag = Math.floor(TARGET_SAMPLE_RATE * 60 / MAX_BPM);
  const maxLag = Math.ceil(TARGET_SAMPLE_RATE * 60 / MIN_BPM);
  let bestLag = 0;
  let bestScore = -Infinity;
  let secondScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let cross = 0;
    let leftPower = 0;
    let rightPower = 0;
    for (let index = lag; index < onset.length; index += 1) {
      const left = onset[index];
      const right = onset[index - lag];
      cross += left * right;
      leftPower += left * left;
      rightPower += right * right;
    }
    if (leftPower <= 0 || rightPower <= 0) continue;
    let score = cross / Math.sqrt(leftPower * rightPower);

    // Prefer the musically useful fundamental over common half/double aliases.
    const bpm = 60 * TARGET_SAMPLE_RATE / lag;
    const centerPreference = 1 - Math.min(0.12, Math.abs(bpm - 120) / 1000);
    score *= centerPreference;

    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestLag = lag;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (bestLag === 0 || bestScore < 0.08) return null;
  const rawBpm = normalizeTempo(60 * TARGET_SAMPLE_RATE / bestLag);
  const bpm = Math.round(rawBpm);
  const separation = Math.max(0, bestScore - Math.max(0, secondScore));
  const confidence = clamp01(bestScore * 0.72 + separation * 1.8);
  if (confidence < 0.08 || bpm < MIN_BPM || bpm > MAX_BPM) return null;
  return { bpm, confidence };
}
