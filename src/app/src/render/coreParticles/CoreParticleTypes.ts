export type CoreParticleShapeMode = 'dot' | 'tri' | 'dia' | 'all';

export interface CoreParticleGpuFrame {
  timeSec: number;
  dtSec: number;
  frameIntervalMs?: number;
  resolution: { w: number; h: number; dpr: number };
  params?: {
    coreParticlesEnabled?: boolean;
    coreParticlesIntensity?: number;
    coreParticlesSpread?: number;
    coreParticlesChaos?: number;
    coreParticlesPulse?: number;
    coreParticlesEdgeFallback?: number;
    coreParticlesShapeMode?: CoreParticleShapeMode | string;
    coreParticlesDensity?: number;
    coreParticleBurstStrength?: number;
    coreParticleImpulse?: number;
    coreParticleBass?: number;
    coreParticleMid?: number;
    coreParticleHigh?: number;
    transient?: number;
    motionSmoothing?: number;
    effectiveHue?: number;
    satNorm?: number;
    spectrum?: boolean;
    stereoPan?: number;
    stereoWidth?: number;
    vectorAmount?: number;
    rotationAngle?: number;
    energyGateSmoother?: number;
  };
  beatPulse?: number;
  audioEnergy?: number;
}

export interface CoreParticleGpuDiagnostics {
  backend: 'webgl2-transform-feedback';
  state: 'ready' | 'suspended' | 'context-lost' | 'disposed' | 'unavailable';
  particleCapacity: number;
  drawCount: number;
  submittedFrames: number;
  contextLosses: number;
  contextRecoveries: number;
  fallbackFrames: number;
  lastSubmitMs: number;
  averageSubmitMs: number;
  maximumSubmitMs: number;
  lastGpuMs: number | null;
  averageGpuMs: number | null;
  maximumGpuMs: number | null;
  gpuTimerSupported: boolean;
  fieldRadius: number;
  spread: number;
  intensity: number;
  burstStrength: number;
  shapeMode: CoreParticleShapeMode;
  qualityTier: 'full' | 'balanced' | 'critical';
  p95FrameMs: number;
  p99FrameMs: number;
  pointScale: number;
  estimatedPointArea: number;
  pointAreaBudget: number;
}
