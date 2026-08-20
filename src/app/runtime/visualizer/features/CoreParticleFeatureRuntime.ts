import type { CoreParticleData, CoreParticleRuntimeState } from '../state/CoreParticleRuntimeState';

/** Owns Core Particle orchestration state that previously lived as loose session variables. */
export class CoreParticleFeatureRuntime {
  nextGpuDiagnosticAt = 0;
  nextStereoSampleAt = 0;
  stereoPanSample = 0;
  stereoWidthSample = 0.85;

  constructor(readonly state: CoreParticleRuntimeState) {}
  get poolSize(): number { return this.state.poolSize; }
  get particlePool(): CoreParticleData[] { return this.state.particlePool; }
  get initialized(): boolean { return this.state.initialized; }
  set initialized(value: boolean) { this.state.initialized = value; }
  get globalRadiusMultiplier(): number { return this.state.globalRadiusMultiplier; }
  set globalRadiusMultiplier(value: number) { this.state.globalRadiusMultiplier = value; }
  get pulseValue(): number { return this.state.pulseValue; }
  set pulseValue(value: number) { this.state.pulseValue = value; }
  get previousEnergy(): number { return this.state.previousEnergy; }
  set previousEnergy(value: number) { this.state.previousEnergy = value; }
  shouldSampleStereo(now: number): boolean { return now >= this.nextStereoSampleAt; }
  commitStereoSample(now: number, pan: number, width: number, intervalMs = 33): void {
    this.stereoPanSample = pan; this.stereoWidthSample = width; this.nextStereoSampleAt = now + intervalMs;
  }
  shouldPublishGpuDiagnostics(now: number): boolean { return now >= this.nextGpuDiagnosticAt; }
  markGpuDiagnosticsPublished(now: number, intervalMs = 500): void { this.nextGpuDiagnosticAt = now + intervalMs; }
  reset(): void {
    this.nextGpuDiagnosticAt = 0; this.nextStereoSampleAt = 0; this.stereoPanSample = 0; this.stereoWidthSample = 0.85;
    this.state.resetMotion();
  }
}
export function createCoreParticleFeatureRuntime(state: CoreParticleRuntimeState): CoreParticleFeatureRuntime {
  return new CoreParticleFeatureRuntime(state);
}
