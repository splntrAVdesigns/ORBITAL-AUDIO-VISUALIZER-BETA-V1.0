import type { VisualizerRuntimeBindings } from '../VisualizerRuntimeBindings';
import type { SpikeFeatureRuntime } from '../features/SpikeFeatureRuntime';
import { SpikeRendererSystem, CoreParticleRendererSystem } from '../renderers';
import { createCoreParticleFeatureRuntime } from '../features/CoreParticleFeatureRuntime';
import { createCenterMediaFeatureRuntime } from '../features/CenterMediaFeatureRuntime';
import { MainThreadAudioUIRefreshRuntime } from '../pipeline/MainThreadAudioUIRefreshRuntime';
import { SparkCometRuntime } from '../renderers/SparkCometRuntime';
import { createCenterEmitterGeometry } from '../renderers/CenterEmitterGeometry';
import { RuntimeAudioSoakMonitor } from '../../diagnostics/RuntimeAudioSoakMonitor';
import {
  createVisualEffectResources,
  createVisualFrameResources,
} from './createVisualRuntimeResources';
import type { RuntimeResourceScope } from '../session/RuntimeResourceDiagnostics';
import type { RuntimeSessionDisposer } from '../session/RuntimeSessionDisposer';

type FrameServiceBindings = Pick<
  VisualizerRuntimeBindings,
  | 'AutoReactivityEngine'
  | 'RenderPipeline'
  | 'ShockwaveRuntime'
  | 'SoftParticleSpriteCache'
  | 'UIRefreshScheduler'
  | 'VisualReactivityEngine'
  | 'buildSpikeLookupTables'
  | 'centerMediaPass'
  | 'clearBackgroundPass'
  | 'createCenterGraphicRenderState'
  | 'createRenderFrameState'
  | 'dotPass'
  | 'haloPass'
  | 'postEffectsPass'
>;

export interface VisualizerFrameServicesOptions extends FrameServiceBindings {
  canvas: HTMLCanvasElement;
  context2D: CanvasRenderingContext2D;
  params: Record<string, any>;
  sessionDisposer: RuntimeSessionDisposer;
  resourceScope: RuntimeResourceScope;
  spikeFeature: SpikeFeatureRuntime;
  energyAnalyser: AnalyserNode;
  energyFreqArr: Uint8Array<ArrayBuffer>;
  energyTimeArr: Uint8Array<ArrayBuffer>;
  sampleRate: number;
  getPalette: () => any;
  debugBeatDetection: boolean;
  debugGeneral: boolean;
  developmentDiagnosticsEnabled: boolean;
}

/**
 * Phase 2 frame-service extraction.
 *
 * Assembles reusable render resources and feature owners once per session. This
 * module does not schedule frames and does not contain production-frame logic.
 */
export function createVisualizerFrameServices(options: VisualizerFrameServicesOptions) {
  const {
    AutoReactivityEngine,
    RenderPipeline,
    ShockwaveRuntime,
    SoftParticleSpriteCache,
    UIRefreshScheduler,
    VisualReactivityEngine,
    buildSpikeLookupTables,
    canvas,
    centerMediaPass,
    clearBackgroundPass,
    context2D,
    createCenterGraphicRenderState,
    createRenderFrameState,
    dotPass,
    energyAnalyser,
    energyFreqArr,
    energyTimeArr,
    getPalette,
    haloPass,
    params,
    postEffectsPass,
    resourceScope,
    sampleRate,
    sessionDisposer,
    spikeFeature,
    debugBeatDetection,
    debugGeneral,
    developmentDiagnosticsEnabled,
  } = options;

  const autoReactivityEngine = new AutoReactivityEngine();
  const ctTimeBuf = new Float32Array(2048);

  const visualEffects = createVisualEffectResources({
    sessionDisposer,
    ShockwaveRuntime,
    SparkCometRuntime,
    createCenterEmitterGeometry,
    RuntimeAudioSoakMonitor,
    onAudioSoakDispose: (monitor, sparkRuntime) => {
      const resources = ((window as any).__ORBITAL_RUNTIME_RESOURCES__ || resourceScope.snapshot()) as any;
      const heapMB = (performance as any).memory
        ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
        : null;
      monitor.abort(resources, heapMB, sparkRuntime.diagnostics);
      if (developmentDiagnosticsEnabled) (window as any).__ORBITAL_AUDIO_SOAK__ = monitor.snapshot;
      sparkRuntime.dispose();
    },
  });
  const {
    shockwaveRuntime,
    sparkCometRuntime,
    centerEmitterGeometry,
    audioSoakMonitor,
  } = visualEffects;

  const visualReactivityEngine = new VisualReactivityEngine();
  const visualBus = visualReactivityEngine.bus;
  const visualBusBands = visualReactivityEngine.bands;

  const spawnShockwave = (radius: number, alpha: number, maxRadius: number) => {
    shockwaveRuntime.spawnShockwave(radius, alpha, maxRadius);
  };
  const spawnShockwaveRings = (baseAlpha: number, innerRadius: number, haloRadius: number) => {
    shockwaveRuntime.spawnShockwaveRings(
      params,
      baseAlpha,
      innerRadius,
      haloRadius,
      debugBeatDetection && debugGeneral
        ? (message: string) => console.log(message)
        : undefined,
    );
  };

  const visualFrameResources = createVisualFrameResources({
    canvas,
    ctx: context2D,
    sessionDisposer,
    CoreParticleRendererSystem,
    SpikeRendererSystem,
    buildSpikeLookupTables,
    SoftParticleSpriteCache,
    createCenterGraphicRenderState,
    RenderPipeline,
    createRenderFrameState,
    clearBackgroundPass,
    haloPass,
    dotPass,
    centerMediaPass,
    postEffectsPass,
    UIRefreshScheduler,
  });
  const coreParticleFeature = createCoreParticleFeatureRuntime(visualFrameResources.coreParticleState);
  spikeFeature.attachRuntimeState(visualFrameResources.spikeRuntimeState);
  const centerMediaFeature = createCenterMediaFeatureRuntime(visualFrameResources.centerGraphicRenderState);

  const mainThreadAudioUIRefresh = new MainThreadAudioUIRefreshRuntime({
    energyAnalyser,
    energyFreqArr,
    energyTimeArr,
    getPalette,
    getParams: () => params,
    getSampleRate: () => sampleRate,
  });
  sessionDisposer.add(() => mainThreadAudioUIRefresh.reset());

  return {
    autoReactivityEngine,
    ctTimeBuf,
    shockwaveRuntime,
    sparkCometRuntime,
    centerEmitterGeometry,
    audioSoakMonitor,
    shockwavePool: shockwaveRuntime.shockwavePool,
    pendingShockwavePool: shockwaveRuntime.pendingShockwavePool,
    MAX_SHOCKWAVES: shockwaveRuntime.maxShockwaves,
    MAX_PENDING_SHOCKWAVES: shockwaveRuntime.maxPendingShockwaves,
    visualReactivityEngine,
    visualBus,
    visualBusBands,
    spawnShockwave,
    spawnShockwaveRings,
    ...visualFrameResources,
    coreParticleFeature,
    PARTICLE_POOL_SIZE: coreParticleFeature.poolSize,
    particlePool: coreParticleFeature.particlePool,
    centerMediaFeature,
    COLOR_WAVE_SAMPLES: visualFrameResources.colorWaveLUT.length,
    mainThreadAudioUIRefresh,
  };
}
