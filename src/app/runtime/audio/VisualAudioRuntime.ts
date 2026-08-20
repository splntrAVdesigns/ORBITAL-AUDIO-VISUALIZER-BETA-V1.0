import { LowLatencyVisualBus } from '../../audio/lowLatencyVisualBus';
import { readAudioAnalyserFrame } from '../audioFrameRuntime';

export interface VisualAudioBands {
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

export interface VisualAudioFrame extends VisualAudioBands {
  transient: number;
  energy: number;
  warmupGain: number;
  valid: boolean;
  audioReadMs: number;
}

export interface VisualAudioRuntimeUpdateOptions {
  now: number;
  dt: number;
  usingMic: boolean;
  instant: boolean;
  beatPulse: number;
  needsTimeDomain: boolean;
  analyser: AnalyserNode;
  energyAnalyser: AnalyserNode;
  freqArr: Uint8Array;
  rawSpikeFreqArr: Uint8Array;
  timeArr: Uint8Array;
  energyFreqArr: Uint8Array;
  energyTimeArr: Uint8Array;
  sampleRate: number;
  reactivityEngine: {
    update(input: any): { raw: VisualAudioBands };
  };
  reactivityParams: Record<string, unknown>;
  reactivityHz?: 30 | 60;
}

/**
 * Owns analyser reads, the shared musical-band model, warm-up gating and the
 * low-latency transient/energy buses. It deliberately does not own beat effects.
 */
export class VisualAudioRuntime {
  private readonly lowLatencyBus = new LowLatencyVisualBus();
  private warmupStartedAt = 0;
  private readonly warmupDurationMs: number;
  private lastSampleAt = -Infinity;
  private hasSample = false;
  private readonly target: VisualAudioFrame = {
    energy20_160: 0, energy20_600: 0, energy40_500: 0, energy60_150: 0, energy150_250: 0,
    energy500_2000: 0, energy600_1600: 0, energy1600_8000: 0, energy20_8000: 0,
    transient: 0, energy: 0, warmupGain: 0, valid: false, audioReadMs: 0,
  };
  private readonly frame: VisualAudioFrame = {
    energy20_160: 0,
    energy20_600: 0,
    energy40_500: 0,
    energy60_150: 0,
    energy150_250: 0,
    energy500_2000: 0,
    energy600_1600: 0,
    energy1600_8000: 0,
    energy20_8000: 0,
    transient: 0,
    energy: 0,
    warmupGain: 0,
    valid: false,
    audioReadMs: 0,
  };

  constructor(warmupDurationMs = 240) {
    this.warmupDurationMs = warmupDurationMs;
  }

  update(options: VisualAudioRuntimeUpdateOptions): VisualAudioFrame {
    const hz = options.reactivityHz === 30 ? 30 : 60;
    const cadenceMs = 1000 / hz;
    const shouldSample = !this.hasSample || options.now - this.lastSampleAt >= cadenceMs - 0.5;

    if (shouldSample) {
      const read = readAudioAnalyserFrame({
        analyser: options.analyser,
        energyAnalyser: options.energyAnalyser,
        freqArr: options.freqArr,
        rawSpikeFreqArr: options.rawSpikeFreqArr,
        timeArr: options.timeArr,
        energyFreqArr: options.energyFreqArr,
        energyTimeArr: options.energyTimeArr,
        needsTimeDomain: options.needsTimeDomain,
        needsEnergyTime: true,
      });

      const { raw } = options.reactivityEngine.update({
        freq: options.energyFreqArr,
        sampleRate: options.sampleRate,
        dt: Math.max(options.dt, cadenceMs / 1000),
        beatPulse: options.beatPulse,
        params: options.reactivityParams,
      });

      const valid = raw.energy20_8000 > 0.004 || raw.energy20_600 > 0.004 || raw.energy500_2000 > 0.004;
      if (valid && this.warmupStartedAt <= 0) this.warmupStartedAt = options.now;
      if (!valid) this.warmupStartedAt = 0;

      const warmupGain = this.warmupStartedAt > 0
        ? Math.min(1, Math.max(0, (options.now - this.warmupStartedAt) / this.warmupDurationMs))
        : 0;

      const lowLatency = this.lowLatencyBus.update(raw as any, Math.max(options.dt, cadenceMs / 1000), {
        micMode: options.usingMic,
        instant: options.instant,
      });

      Object.assign(this.target, {
        energy20_160: Math.max(raw.energy20_160 * warmupGain, lowLatency.transient * 0.32),
        energy20_600: Math.max(raw.energy20_600 * warmupGain, lowLatency.transient * 0.36),
        energy40_500: Math.max(raw.energy40_500 * warmupGain, lowLatency.transient * 0.30),
        energy60_150: raw.energy60_150 * warmupGain,
        energy150_250: raw.energy150_250 * warmupGain,
        energy500_2000: raw.energy500_2000 * warmupGain,
        energy600_1600: raw.energy600_1600 * warmupGain,
        energy1600_8000: raw.energy1600_8000 * warmupGain,
        energy20_8000: Math.max(raw.energy20_8000 * warmupGain, lowLatency.energy, lowLatency.transient * 0.22),
        transient: lowLatency.transient,
        energy: lowLatency.energy,
        warmupGain,
        valid,
        audioReadMs: read.audioReadMs,
      });

      this.lastSampleAt = options.now;
      this.hasSample = true;
    } else {
      this.target.audioReadMs = 0;
    }

    // Visual rendering remains display-rate. At 30 Hz, interpolate toward the most
    // recent analysis target between analyser reads instead of stepping at 30 FPS.
    // At 60 Hz this converges almost immediately and preserves the tighter response.
    const responseSeconds = 0.028;
    const alpha = hz === 60
      ? 1
      : (this.hasSample ? Math.min(1, 1 - Math.exp(-Math.max(0, options.dt) / responseSeconds)) : 1);
    const numericKeys: Array<keyof VisualAudioBands | 'transient' | 'energy' | 'warmupGain'> = [
      'energy20_160','energy20_600','energy40_500','energy60_150','energy150_250',
      'energy500_2000','energy600_1600','energy1600_8000','energy20_8000','transient','energy','warmupGain',
    ];
    for (const key of numericKeys) {
      this.frame[key] += (this.target[key] - this.frame[key]) * alpha;
    }
    this.frame.valid = this.target.valid;
    this.frame.audioReadMs = this.target.audioReadMs;
    return this.frame;
  }

  reset(): void {
    this.warmupStartedAt = 0;
    this.lastSampleAt = -Infinity;
    this.hasSample = false;
    Object.assign(this.target, {
      energy20_160: 0, energy20_600: 0, energy40_500: 0, energy60_150: 0, energy150_250: 0,
      energy500_2000: 0, energy600_1600: 0, energy1600_8000: 0, energy20_8000: 0,
      transient: 0, energy: 0, warmupGain: 0, valid: false, audioReadMs: 0,
    });
    Object.assign(this.frame, this.target);
    this.lowLatencyBus.reset?.();
  }
}