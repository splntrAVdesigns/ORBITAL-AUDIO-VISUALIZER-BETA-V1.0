/**
 * Audio Visualization Helper Functions
 * Extracted from App.tsx to reduce file size
 */

import { type ColorPalette } from '../data/colorPalettes';
import { palettes } from '../data/colorPalettes';

/**
 * Calculate hue from palette based on energy level
 */
export function createHueFromPaletteFunction(selectedPaletteIndex: number) {
  return function hueFromPalette(energy: number): number {
    const p: any = palettes[selectedPaletteIndex] || palettes[0];
    
    if (p.type === "mono") {
      return p.h;
    }
    
    if (p.type === "grad") {
      let a = p.a, b = p.b;
      let d = ((b - a + 540) % 360) - 180;
      return (a + d * energy + 360) % 360;
    }
    
    if (p.type === "heat") {
      const stops = p.stops;
      for (let i = 0; i < stops.length - 1; i++) {
        const s = stops[i], e = stops[i + 1];
        if (energy >= s.p && energy <= e.p) {
          const t = (energy - s.p) / (e.p - s.p);
          let a = s.h, b = e.h;
          let d = ((b - a + 540) % 360) - 180;
          return (a + d * t + 360) % 360;
        }
      }
      return stops[stops.length - 1].h;
    }
    
    return 200;
  };
}

/**
 * Calculate average value of array in range
 */
export function avg(arr: Uint8Array, a: number, b: number): number {
  let s = 0, n = 0;
  for (let i = Math.max(0, a) | 0, end = Math.min(arr.length, b) | 0; i < end; i++) {
    s += arr[i];
    n++;
  }
  return n > 0 ? s / n : 0;
}

/**
 * Calculate energy level from frequency array
 */
export function calculateEnergy(
  freqArr: Uint8Array,
  lowBand: boolean,
  midBand: boolean,
  highBand: boolean,
  gainMultiplier: number
): number {
  const len = freqArr.length;
  let energy = 0;
  
  // Band ranges (assuming 2048 FFT size, 48kHz sample rate)
  const lowEnd = Math.floor(len * 0.15);   // ~0-3.6kHz
  const midEnd = Math.floor(len * 0.4);    // ~3.6-9.6kHz
  const highEnd = len;                     // ~9.6-24kHz
  
  if (lowBand) {
    energy += avg(freqArr, 0, lowEnd);
  }
  if (midBand) {
    energy += avg(freqArr, lowEnd, midEnd);
  }
  if (highBand) {
    energy += avg(freqArr, midEnd, highEnd);
  }
  
  // Normalize to 0-1 range and apply gain
  return Math.min(1, (energy / 255) * gainMultiplier);
}

/**
 * Smooth energy value with exponential smoothing
 */
export function smoothEnergy(
  currentEnergy: number,
  targetEnergy: number,
  smoothingFactor: number,
  dt: number
): number {
  // Exponential smoothing with time-based interpolation
  const alpha = 1 - Math.pow(smoothingFactor, dt * 60); // 60fps reference
  return currentEnergy + (targetEnergy - currentEnergy) * alpha;
}

/**
 * Beat detection using energy threshold
 */
export interface BeatDetectionState {
  lastBeatTime: number;
  beatCooldown: number;
  energyHistory: number[];
  energyHistoryIndex: number;
}

export function detectBeat(
  currentEnergy: number,
  state: BeatDetectionState,
  threshold: number = 1.5,
  minCooldown: number = 200
): boolean {
  const now = performance.now();
  
  // Check cooldown
  if (now - state.lastBeatTime < minCooldown) {
    return false;
  }
  
  // Calculate energy average from history
  let sum = 0;
  for (let i = 0; i < state.energyHistory.length; i++) {
    sum += state.energyHistory[i];
  }
  const avgEnergy = sum / state.energyHistory.length;
  
  // Detect beat if current energy exceeds threshold
  if (currentEnergy > avgEnergy * threshold) {
    state.lastBeatTime = now;
    return true;
  }
  
  return false;
}

/**
 * Update energy history circular buffer
 */
export function updateEnergyHistory(
  energy: number,
  buffer: number[],
  index: number,
  count: number
): { index: number; count: number } {
  buffer[index] = energy;
  const newIndex = (index + 1) % buffer.length;
  const newCount = Math.min(count + 1, buffer.length);
  return { index: newIndex, count: newCount };
}

/**
 * Map frequency index to Hz
 */
export function freqIndexToHz(index: number, fftSize: number, sampleRate: number): number {
  return (index * sampleRate) / fftSize;
}

/**
 * Map Hz to frequency index
 */
export function hzToFreqIndex(hz: number, fftSize: number, sampleRate: number): number {
  return Math.floor((hz * fftSize) / sampleRate);
}

/**
 * Calculate RMS (Root Mean Square) level from time domain data
 */
export function calculateRMS(timeArr: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < timeArr.length; i++) {
    const normalized = (timeArr[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / timeArr.length);
}

/**
 * Calculate peak level from time domain data
 */
export function calculatePeak(timeArr: Uint8Array): number {
  let max = 0;
  for (let i = 0; i < timeArr.length; i++) {
    const abs = Math.abs(timeArr[i] - 128) / 128;
    if (abs > max) max = abs;
  }
  return max;
}

/**
 * Apply frequency weighting (A-weighting approximation)
 */
export function applyAWeighting(hz: number, magnitude: number): number {
  // Simplified A-weighting curve (boosts mid-range, attenuates low and high)
  if (hz < 100) {
    return magnitude * 0.3; // Attenuate very low frequencies
  } else if (hz < 1000) {
    return magnitude * (0.3 + 0.7 * (hz - 100) / 900); // Gradual boost
  } else if (hz < 4000) {
    return magnitude * 1.0; // Peak sensitivity
  } else if (hz < 8000) {
    return magnitude * (1.0 - 0.3 * (hz - 4000) / 4000); // Gradual attenuation
  } else {
    return magnitude * 0.7; // Attenuate high frequencies
  }
}

/**
 * Convert linear magnitude to dB
 */
export function magnitudeToDb(magnitude: number): number {
  return 20 * Math.log10(Math.max(magnitude, 0.0001));
}

/**
 * Convert dB to linear magnitude
 */
export function dbToMagnitude(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Exponential ease out
 */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Exponential ease in
 */
export function easeInExpo(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
}
