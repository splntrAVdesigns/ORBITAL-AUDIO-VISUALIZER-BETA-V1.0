export interface ResettableRuntime {
  reset(): void;
}

export interface AudioFrameStateRuntimeOptions {
  createVisualAudioRuntime: () => ResettableRuntime;
  createBeatEffectRuntime: () => ResettableRuntime;
  createBeatDetectionRuntime: () => ResettableRuntime;
  createCoreParticleImpulseRuntime: () => ResettableRuntime;
}

/**
 * Phase 4.8H.2 audio-state owner.
 *
 * Owns the long-lived audio/beat runtimes that participate in every production
 * frame. It intentionally does not reinterpret analyser data or change any
 * visual/audio formulas; callers continue invoking the exact existing runtime
 * methods through these stable references.
 */
export class AudioFrameStateRuntime {
  readonly visualAudioRuntime: ResettableRuntime & Record<string, any>;
  readonly beatEffectRuntime: ResettableRuntime & Record<string, any>;
  readonly beatDetectionRuntime: ResettableRuntime & Record<string, any>;
  readonly coreParticleImpulseRuntime: ResettableRuntime & Record<string, any>;

  constructor(options: AudioFrameStateRuntimeOptions) {
    this.visualAudioRuntime = options.createVisualAudioRuntime() as ResettableRuntime & Record<string, any>;
    this.beatEffectRuntime = options.createBeatEffectRuntime() as ResettableRuntime & Record<string, any>;
    this.beatDetectionRuntime = options.createBeatDetectionRuntime() as ResettableRuntime & Record<string, any>;
    this.coreParticleImpulseRuntime = options.createCoreParticleImpulseRuntime() as ResettableRuntime & Record<string, any>;
  }

  reset(): void {
    this.visualAudioRuntime.reset();
    this.beatEffectRuntime.reset();
    this.beatDetectionRuntime.reset();
    this.coreParticleImpulseRuntime.reset();
  }
}

export function createAudioFrameStateRuntime(options: AudioFrameStateRuntimeOptions): AudioFrameStateRuntime {
  return new AudioFrameStateRuntime(options);
}
