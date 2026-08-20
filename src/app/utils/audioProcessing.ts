/**
 * 🔥 Audio Limiter/Compressor (Prevents clipping artifacts)
 * Hardware-accelerated DynamicsCompressor for clean output
 */
export class AudioLimiter {
  private compressor: DynamicsCompressorNode;
  
  constructor(audioContext: AudioContext) {
    this.compressor = audioContext.createDynamicsCompressor();
    
    // LIMITER SETTINGS (prevents clipping while preserving dynamics)
    this.compressor.threshold.value = -3;     // Start limiting at -3dB (headroom)
    this.compressor.knee.value = 0;           // Hard knee (brick-wall limiting)
    this.compressor.ratio.value = 20;         // 20:1 ratio (aggressive limiting)
    this.compressor.attack.value = 0.003;     // 3ms attack (fast, prevents clicks)
    this.compressor.release.value = 0.25;     // 250ms release (natural decay)
  }
  
  /**
   * Connect limiter to audio chain
   * Chain: Input → Limiter → Destination
   */
  connect(inputNode: AudioNode, destination: AudioNode): void {
    inputNode.connect(this.compressor);
    this.compressor.connect(destination);
  }
  
  /**
   * Get limiter node for routing
   */
  getNode(): DynamicsCompressorNode {
    return this.compressor;
  }
  
  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.compressor.disconnect();
  }
}

/**
 * 🔥 HOTFIX: Reactivity Amplifier (Balanced for realistic dynamics)
 * Phase 5A regression fix: Reduced amplification to prevent clipping
 */
export class AudioAmplifier {
  /**
   * Amplify frequency data in-place (zero allocations!)
   * 🚨 HOTFIX: Reduced amplification from 2.0-5.0x to 1.2-2.2x (prevents clipping)
   */
  static amplifyInPlace(
    freqData: Uint8Array,
    reactivity: number,
    bassReduce: number = 0
  ): void {
    // 🛡️ SAFETY: Guard against undefined reactivity (silent failure prevention)
    if (typeof reactivity !== 'number' || isNaN(reactivity)) {
      console.error('❌ AudioAmplifier: Invalid reactivity value:', reactivity);
      return; // Skip amplification rather than corrupt data with NaN
    }
    
    // 🔥 EXPONENTIAL CURVE: Smoother progression, less clipping at high values
    // reactivity 0.0 → 1.0x multiplier (neutral, clean dynamics)
    // reactivity 0.5 → 1.5x multiplier (balanced, musical)
    // reactivity 1.0 → 1.9x multiplier (reactive, with headroom!)
    const baseAmp = 1.0 + Math.pow(reactivity, 1.3) * 0.9; // Exponential curve for finer control
    
    for (let i = 0; i < freqData.length; i++) {
      const normalized = freqData[i] / 255;
      
      // Apply bass reduction (reduce low frequencies)
      const bassWeight = i < 10 ? (1.0 - bassReduce * 0.5) : 1.0;
      
      // Apply amplification
      let amplified = normalized * baseAmp * bassWeight;
      
      // 🔥 OPTIMIZED: Lighter soft clipping since we have hardware limiter on output
      // This prevents visual data from saturating while limiter handles audio clipping
      amplified = amplified / (1.0 + amplified * 0.08); // Reduced from 0.15 (less aggressive)
      
      // Scale back to 0-255 and clamp
      freqData[i] = Math.min(255, Math.round(amplified * 255));
    }
  }

  /**
   * Auto-gain adjustment for weak signals (in-place, zero allocations!)
   * 🚨 HOTFIX: Reduced max gain from 3.5x to 2.0x
   */
  static autoGainInPlace(freqData: Uint8Array): void {
    // Calculate average signal level
    let sum = 0;
    for (let i = 0; i < freqData.length; i++) {
      sum += freqData[i];
    }
    const avg = sum / freqData.length;
    
    // If signal is too weak, boost it (but not too much!)
    if (avg < 30) { // Lowered threshold from 40 (only boost VERY weak signals)
      // Target average of 50 (reduced from 70 for more headroom)
      const targetAvg = 50;
      const gain = avg > 0 ? targetAvg / avg : 1.8;
      const cappedGain = Math.min(2.0, gain); // 🚨 HOTFIX: Reduced from 3.5x to 2.0x
      
      for (let i = 0; i < freqData.length; i++) {
        freqData[i] = Math.min(255, Math.round(freqData[i] * cappedGain));
      }
    }
  }

  /**
   * Apply exponential boost to emphasize peaks (in-place)
   */
  static emphasizePeaks(freqData: Uint8Array, intensity: number = 0.7): void {
    if (intensity <= 0) return;
    
    for (let i = 0; i < freqData.length; i++) {
      const normalized = freqData[i] / 255;
      // Power curve: values closer to 1.0 get boosted more
      // intensity 0.7 → exponent 0.7 (lifts mids and highs)
      const boosted = Math.pow(normalized, 1.0 - intensity * 0.4);
      freqData[i] = Math.min(255, Math.round(boosted * 255));
    }
  }
}

/**
 * Beat detection utilities (extracted for reuse)
 */
export class BeatDetector {
  private static lastBeatTime = 0;
  private static beatEnergyHistory: number[] = [];
  private static readonly HISTORY_SIZE = 43; // ~0.7 seconds at 60fps

  /**
   * Detect beat from energy array
   * Returns { detected: boolean, strength: number }
   */
  static detectBeat(
    energyFreqData: Uint8Array,
    sensitivity: number,
    timestamp: number
  ): { detected: boolean; strength: number } {
    // Calculate bass energy (bins 0-10)
    let bassEnergy = 0;
    const bassEnd = Math.min(10, energyFreqData.length);
    for (let i = 0; i < bassEnd; i++) {
      bassEnergy += energyFreqData[i];
    }
    bassEnergy /= bassEnd;
    bassEnergy /= 255; // Normalize to 0-1
    
    // Update history
    this.beatEnergyHistory.push(bassEnergy);
    if (this.beatEnergyHistory.length > this.HISTORY_SIZE) {
      this.beatEnergyHistory.shift();
    }
    
    // Calculate average energy
    const avgEnergy = this.beatEnergyHistory.reduce((a, b) => a + b, 0) / this.beatEnergyHistory.length;
    
    // Dynamic threshold based on sensitivity
    const threshold = avgEnergy * (1.3 + sensitivity * 0.5);
    
    // Minimum time between beats (prevent double-triggers)
    const timeSinceLastBeat = timestamp - this.lastBeatTime;
    const minBeatInterval = 200; // 200ms = max 300 BPM
    
    // Detect beat
    const detected = bassEnergy > threshold && timeSinceLastBeat > minBeatInterval;
    
    if (detected) {
      this.lastBeatTime = timestamp;
    }
    
    return {
      detected,
      strength: detected ? Math.min(1.0, (bassEnergy - threshold) / threshold) : 0
    };
  }

  /**
   * Reset beat detector state
   */
  static reset(): void {
    this.lastBeatTime = 0;
    this.beatEnergyHistory = [];
  }
}

/**
 * Frequency band utilities
 */
export class FrequencyBands {
  /**
   * Get frequency in Hz for a given FFT bin
   */
  static binToFrequency(binIndex: number, fftSize: number, sampleRate: number): number {
    return (binIndex / fftSize) * (sampleRate / 2);
  }

  /**
   * Get FFT bin for a given frequency in Hz
   */
  static frequencyToBin(frequencyHz: number, fftSize: number, sampleRate: number): number {
    return Math.round((frequencyHz / (sampleRate / 2)) * fftSize);
  }

  /**
   * Filter frequency data to specific band (in-place, zero allocations!)
   */
  static filterBand(
    freqData: Uint8Array,
    band: 'bass' | 'mid' | 'high' | 'full',
    fftSize: number,
    sampleRate: number
  ): void {
    if (band === 'full') return; // No filtering needed
    
    let minFreq = 0;
    let maxFreq = sampleRate / 2;
    
    switch (band) {
      case 'bass':
        minFreq = 20;
        maxFreq = 250;
        break;
      case 'mid':
        minFreq = 250;
        maxFreq = 4000;
        break;
      case 'high':
        minFreq = 4000;
        maxFreq = 20000;
        break;
    }
    
    const minBin = this.frequencyToBin(minFreq, fftSize, sampleRate);
    const maxBin = this.frequencyToBin(maxFreq, fftSize, sampleRate);
    
    // Zero out bins outside the band
    for (let i = 0; i < freqData.length; i++) {
      if (i < minBin || i > maxBin) {
        freqData[i] = 0;
      }
    }
  }
}