export interface AudioBandSnapshot {
  energy20_160: number;
  energy20_600: number;
  energy40_500: number;
  energy60_150: number;
  energy150_250: number;
  energy500_2000: number;
  energy600_1600: number;
  energy1600_8000: number;
  energy20_8000: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function averageFrequencyBand(freq: Uint8Array, sampleRate: number, startHz: number, endHz: number) {
  const nyquist = sampleRate / 2;
  const startBin = Math.max(0, Math.floor((startHz / nyquist) * freq.length));
  const endBin = Math.min(freq.length - 1, Math.ceil((endHz / nyquist) * freq.length));

  if (endBin <= startBin) return 0;

  let sum = 0;
  let count = 0;
  for (let i = startBin; i <= endBin; i++) {
    sum += freq[i];
    count++;
  }

  return count > 0 ? clamp01((sum / count) / 255) : 0;
}

export function readAudioBands(freq: Uint8Array, sampleRate: number): AudioBandSnapshot {
  return {
    energy20_160: averageFrequencyBand(freq, sampleRate, 20, 160),
    energy20_600: averageFrequencyBand(freq, sampleRate, 20, 600),
    energy40_500: averageFrequencyBand(freq, sampleRate, 40, 500),
    energy60_150: averageFrequencyBand(freq, sampleRate, 60, 150),
    energy150_250: averageFrequencyBand(freq, sampleRate, 150, 250),
    energy500_2000: averageFrequencyBand(freq, sampleRate, 500, 2000),
    energy600_1600: averageFrequencyBand(freq, sampleRate, 600, 1600),
    energy1600_8000: averageFrequencyBand(freq, sampleRate, 1600, 8000),
    energy20_8000: averageFrequencyBand(freq, sampleRate, 20, 8000),
  };
}