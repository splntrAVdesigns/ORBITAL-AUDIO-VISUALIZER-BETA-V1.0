export interface BeatEffectFrame {
  beatPulse: number;
  beatColorShift: number;
  cornerFlashPulse: number;
  cornerFlashSequence: number;
  cornerFlashTimer: number;
  targetHueShift: number;
  lastBassEnergy: number;
  isBeat: boolean;
  allowBeatDetection: boolean;
  quadrantFlashIntensity: number[];
}

export interface BeatEffectUpdateOptions {
  now: number;
  dt: number;
  enabled: boolean;
  beatPulseType: string;
  beatSensitivity: number;
  beatReactivityBoost: boolean;
  audioStartTime: number;
  gracePeriodMs: number;
  beatDetectionData: Uint8Array;
  bassEnergy: number;
  midEnergy: number;
  detectBeat(energy: number, now: number): boolean;
  damp(value: number, target: number, speed: number, dt: number): number;
  applyBeatPulse(pulse: number, multiplier: number): void;
  applyPendingMacroChanges?(): void;
  applyPendingLiquidChanges?(): void;
}

/** Owns beat onset state and the visual consequences of a detected beat. */
export class BeatEffectRuntime {
  private frame: BeatEffectFrame = {
    beatPulse: 0,
    beatColorShift: 0,
    cornerFlashPulse: 0,
    cornerFlashSequence: 0,
    cornerFlashTimer: 0,
    targetHueShift: 0,
    lastBassEnergy: 0,
    isBeat: false,
    allowBeatDetection: false,
    quadrantFlashIntensity: [0, 0, 0, 0],
  };

  seed(partial: Partial<BeatEffectFrame>): void {
    Object.assign(this.frame, partial);
    if (partial.quadrantFlashIntensity) {
      this.frame.quadrantFlashIntensity = partial.quadrantFlashIntensity;
    }
  }

  update(options: BeatEffectUpdateOptions): BeatEffectFrame {
    const f = this.frame;
    const allowBeatDetection = options.now - options.audioStartTime > options.gracePeriodMs;
    let isBeat = false;

    if (options.enabled) {
      let sum = 0;
      let count = 0;
      const data = options.beatDetectionData;
      for (let i = 0; i < data.length; i++) {
        if (data[i] > 0) {
          sum += data[i];
          count++;
        }
      }
      const beatEnergy = count > 0 ? (sum / count) / 255 : 0;
      isBeat = allowBeatDetection ? options.detectBeat(beatEnergy, options.now) : false;

      const bassThreshold = 0.15 + options.beatSensitivity * 0.3;
      const midThreshold = 0.20 + options.beatSensitivity * 0.3;

      if (
        options.beatPulseType === 'all' ||
        options.beatPulseType === 'flash' ||
        options.beatPulseType === 'dark-strobe'
      ) {
        const bassRise = Math.max(0, options.bassEnergy - f.lastBassEnergy);
        const onsetThreshold = 0.055 + (1 - options.beatSensitivity) * 0.10;
        const triggeredByOnset = bassRise > onsetThreshold;
        const triggeredByLevel = options.bassEnergy > bassThreshold && f.lastBassEnergy < bassThreshold * 0.7;
        if ((triggeredByOnset || triggeredByLevel) && allowBeatDetection) {
          f.beatPulse = 1;
          f.cornerFlashPulse = 1;
          f.cornerFlashSequence = 0;
          f.cornerFlashTimer = options.now;
          options.applyPendingMacroChanges?.();
          options.applyPendingLiquidChanges?.();

          const first = Math.floor(Math.random() * 4);
          f.quadrantFlashIntensity[first] = 1;
          if (Math.random() > 0.5) {
            let second = first;
            while (second === first) second = Math.floor(Math.random() * 4);
            f.quadrantFlashIntensity[second] = 1;
          }
        }
      }

      if ((options.beatPulseType === 'all' || options.beatPulseType === 'color') && options.midEnergy > midThreshold && allowBeatDetection) {
        f.targetHueShift = 120;
      }

      f.beatColorShift += (f.targetHueShift - f.beatColorShift) * 0.25;
      f.targetHueShift *= 0.88;
      f.beatPulse = options.damp(f.beatPulse, 0, 14, options.dt);
      options.applyBeatPulse(
        f.beatPulse,
        options.beatReactivityBoost ? (1 + f.beatPulse * 0.34) : 1,
      );
      f.lastBassEnergy = options.bassEnergy;

      if (f.cornerFlashPulse > 0.01) {
        const elapsed = options.now - f.cornerFlashTimer;
        if (elapsed > 100 && f.cornerFlashSequence < 3) f.cornerFlashSequence = 3;
        else if (elapsed > 50 && f.cornerFlashSequence < 2) f.cornerFlashSequence = 2;
        else if (elapsed > 0 && f.cornerFlashSequence < 1) f.cornerFlashSequence = 1;
        f.cornerFlashPulse *= 0.85;
      }

      for (let q = 0; q < 4; q++) {
        f.quadrantFlashIntensity[q] = f.quadrantFlashIntensity[q] > 0.01
          ? f.quadrantFlashIntensity[q] * 0.82
          : 0;
      }
    } else {
      f.beatPulse = options.damp(f.beatPulse, 0, 14, options.dt);
    }

    f.isBeat = isBeat;
    f.allowBeatDetection = allowBeatDetection;
    return f;
  }

  reset(): void {
    this.frame.beatPulse = 0;
    this.frame.beatColorShift = 0;
    this.frame.cornerFlashPulse = 0;
    this.frame.cornerFlashSequence = 0;
    this.frame.cornerFlashTimer = 0;
    this.frame.targetHueShift = 0;
    this.frame.lastBassEnergy = 0;
    this.frame.isBeat = false;
    this.frame.allowBeatDetection = false;
    this.frame.quadrantFlashIntensity.fill(0);
  }
}
