import { mainThreadUIRefreshBus } from '../pipeline/MainThreadUIRefreshBus';
import { createRuntimePassOwners } from './createRuntimePassOwners';
import type { RuntimeSessionDisposer } from '../session/RuntimeSessionDisposer';
import type { WebGLSpikeRenderFrame } from '../renderers/WebGLSpikeRenderer';

export function createVisualEffectResources(options: {
  sessionDisposer: RuntimeSessionDisposer;
  ShockwaveRuntime: any;
  SparkCometRuntime: any;
  createCenterEmitterGeometry: () => any;
  RuntimeAudioSoakMonitor: any;
  onAudioSoakDispose: (monitor: any, sparkRuntime: any) => void;
}) {
  const { sessionDisposer, ShockwaveRuntime, SparkCometRuntime, createCenterEmitterGeometry, RuntimeAudioSoakMonitor, onAudioSoakDispose } = options;
  const shockwaveRuntime = new ShockwaveRuntime({ maxShockwaves: 50, maxPendingShockwaves: 20 });
  const sparkCometRuntime = new SparkCometRuntime(64);
  const centerEmitterGeometry = createCenterEmitterGeometry();
  const audioSoakMonitor = new RuntimeAudioSoakMonitor(15 * 60 * 1000);
  sessionDisposer.add(() => onAudioSoakDispose(audioSoakMonitor, sparkCometRuntime));
  return { shockwaveRuntime, sparkCometRuntime, centerEmitterGeometry, audioSoakMonitor };
}

/**
 * Constructs frame-adjacent visual resources at the historical post-interaction point.
 * Keeping this ordering avoids disturbing initialization timing for spike/rotation state.
 */
export function createVisualFrameResources(options: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sessionDisposer: RuntimeSessionDisposer;
  CoreParticleRendererSystem: any;
  SpikeRendererSystem: any;
  buildSpikeLookupTables: any;
  SoftParticleSpriteCache: any;
  createCenterGraphicRenderState: any;
  RenderPipeline: any;
  createRenderFrameState: any;
  clearBackgroundPass: any;
  haloPass: any;
  dotPass: any;
  centerMediaPass: any;
  postEffectsPass: any;
  UIRefreshScheduler: any;
}): any {
  const {
    canvas, ctx, sessionDisposer, CoreParticleRendererSystem, SpikeRendererSystem,
    buildSpikeLookupTables, SoftParticleSpriteCache, createCenterGraphicRenderState,
    RenderPipeline, createRenderFrameState, clearBackgroundPass, haloPass, dotPass,
    centerMediaPass, postEffectsPass, UIRefreshScheduler,
  } = options;
  const coreParticleRenderer = new CoreParticleRendererSystem(850);
  const coreParticleState = coreParticleRenderer.state;
  sessionDisposer.add(() => coreParticleRenderer.dispose());
  const spikeRenderer = new SpikeRendererSystem(buildSpikeLookupTables);
  const spikeRuntimeState = spikeRenderer.state;
  sessionDisposer.add(() => spikeRenderer.dispose());
  const softParticleSpriteCache = new SoftParticleSpriteCache();
  const centerGraphicRenderState = createCenterGraphicRenderState();
  const colorWaveLUT = new Float32Array(360);
  const renderPipeline = new RenderPipeline();
  const renderFrameState = createRenderFrameState(canvas, ctx);
  const passOwners = createRuntimePassOwners(renderFrameState);
  sessionDisposer.add(() => passOwners.dispose());
  sessionDisposer.add(() => renderPipeline.dispose());
  renderPipeline.register(clearBackgroundPass);
  renderPipeline.register(haloPass);
  renderPipeline.register(dotPass);
  renderPipeline.register(centerMediaPass);
  renderPipeline.register(postEffectsPass);
  const uiRefreshScheduler = new UIRefreshScheduler();
  sessionDisposer.add(() => uiRefreshScheduler.reset());
  sessionDisposer.add(() => mainThreadUIRefreshBus.reset());
  return {
    coreParticleRenderer, coreParticleState, spikeRenderer, spikeRuntimeState,
    softParticleSpriteCache, centerGraphicRenderState, colorWaveLUT,
    reusedVuMeterOptions: {}, reusedCtEngineRenderOptions: {},
    reusedOuterHaloOptions: {}, reusedDotRingOptions: {},
    reusedShockwaveOptions: {}, reusedWebglEngineRenderOptions: {},
    reusedWebGLSpikeFrame: {} as WebGLSpikeRenderFrame,
    renderPipeline, renderFrameState, passOwners, uiRefreshScheduler,
  };
}
