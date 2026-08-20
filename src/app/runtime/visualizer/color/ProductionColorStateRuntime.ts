export interface BeatColorSeedSnapshot {
  beatPulse: number;
  beatColorShift: number;
  cornerFlashPulse: number;
  cornerFlashSequence: number;
  cornerFlashTimer: number;
  targetHueShift: number;
  lastBassEnergy: number;
  quadrantFlashIntensity: number[];
}

/**
 * Phase 4.8H.2 color-state owner.
 *
 * Holds persistent color/beat/energy-gate phase state only. Color formulas and
 * palette interpretation remain in the frozen production frame until the later
 * feature-runtime extraction phase.
 */
export class ProductionColorStateRuntime {
  beatPulse = 0;
  beatFlashIntensity = 0;
  beatColorShift = 0;
  targetHueShift = 0;
  cornerFlashPulse = 0;
  cornerFlashSequence = 0;
  cornerFlashTimer = 0;
  readonly quadrantFlashIntensity = [0, 0, 0, 0];

  energyGateActive = false;
  energyGateSmoother = 1.0;

  colorWavePhase = 0;
  satBurstPhase = 0;
  cachedColorWaveHueRange = 0;
  lastEffectAmount = -1;
  colorWaveLUTDirty = true;
  lastBassEnergy = 0;

  createBeatSeed(): BeatColorSeedSnapshot {
    return {
      beatPulse: this.beatPulse,
      beatColorShift: this.beatColorShift,
      cornerFlashPulse: this.cornerFlashPulse,
      cornerFlashSequence: this.cornerFlashSequence,
      cornerFlashTimer: this.cornerFlashTimer,
      targetHueShift: this.targetHueShift,
      lastBassEnergy: this.lastBassEnergy,
      quadrantFlashIntensity: this.quadrantFlashIntensity,
    };
  }

  applyBeatFrame(frame: Record<string, any>): void {
    this.beatPulse = frame.beatPulse;
    this.beatColorShift = frame.beatColorShift;
    this.cornerFlashPulse = frame.cornerFlashPulse;
    this.cornerFlashSequence = frame.cornerFlashSequence;
    this.cornerFlashTimer = frame.cornerFlashTimer;
    this.targetHueShift = frame.targetHueShift;
    this.lastBassEnergy = frame.lastBassEnergy;
  }

  reset(): void {
    this.beatPulse = 0;
    this.beatFlashIntensity = 0;
    this.beatColorShift = 0;
    this.targetHueShift = 0;
    this.cornerFlashPulse = 0;
    this.cornerFlashSequence = 0;
    this.cornerFlashTimer = 0;
    this.quadrantFlashIntensity.fill(0);
    this.energyGateActive = false;
    this.energyGateSmoother = 1.0;
    this.colorWavePhase = 0;
    this.satBurstPhase = 0;
    this.cachedColorWaveHueRange = 0;
    this.lastEffectAmount = -1;
    this.colorWaveLUTDirty = true;
    this.lastBassEnergy = 0;
  }
}

export function createProductionColorStateRuntime(): ProductionColorStateRuntime {
  return new ProductionColorStateRuntime();
}
