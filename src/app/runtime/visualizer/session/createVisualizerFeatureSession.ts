import type { VisualizerRuntimeBindings } from '../VisualizerRuntimeBindings';
import { BeatDetectionRuntime } from '../../audio/BeatDetectionRuntime';
import { AutoZoomMotionRuntime } from '../motion/AutoZoomMotionRuntime';
import { SchedulerMotionPhaseRuntime } from '../motion/SchedulerMotionPhaseRuntime';
import { createAudioFrameStateRuntime } from '../frame/AudioFrameStateRuntime';
import { createProductionColorStateRuntime } from '../color/ProductionColorStateRuntime';
import { createProductionMotionStateRuntime } from '../motion/ProductionMotionStateRuntime';
import { createLiquidShaperFeatureRuntime } from '../features/LiquidShaperFeatureRuntime';
import {
  attachCenterMediaAuthority,
  attachRuntimeParameterAuthority,
} from './createRuntimeAuthoritySetup';
import type { RuntimeResourceScope } from './RuntimeResourceDiagnostics';
import type { RuntimeSessionDisposer } from './RuntimeSessionDisposer';

type FeatureSessionBindings = Pick<
  VisualizerRuntimeBindings,
  | 'BeatEffectRuntime'
  | 'CenterGraphicController'
  | 'CoreParticleImpulseRuntime'
  | 'CoreTexturesEngine'
  | 'FramePacingRuntime'
  | 'MotionRotationRuntime'
  | 'RotationAuthority'
  | 'VisualAudioRuntime'
  | 'coreTexturesCanvasRef'
  | 'coreTexturesEngineRef'
  | 'defaultParams'
  | 'pendingLiquidChangesRef'
>;

export interface VisualizerFeatureSessionOptions extends FeatureSessionBindings {
  sessionDisposer: RuntimeSessionDisposer;
  resourceScope: RuntimeResourceScope;
  querySelector: (selector: string) => Element | null;
  debugGeneral: boolean;
}

/**
 * Phase 2 runtime extraction.
 *
 * Owns construction and deterministic disposal of persistent visualizer feature
 * state. It intentionally contains no scheduler, render pass, RAF, timer, or
 * per-frame method; the certified production frame remains session-hosted.
 */
export function createVisualizerFeatureSession(options: VisualizerFeatureSessionOptions) {
  const {
    BeatEffectRuntime,
    CenterGraphicController,
    CoreParticleImpulseRuntime,
    CoreTexturesEngine,
    FramePacingRuntime,
    MotionRotationRuntime,
    RotationAuthority,
    VisualAudioRuntime,
    coreTexturesCanvasRef,
    coreTexturesEngineRef,
    defaultParams,
    pendingLiquidChangesRef,
    sessionDisposer,
    resourceScope,
    querySelector,
    debugGeneral,
  } = options;

  const params = { ...defaultParams };
  const parameterStore = attachRuntimeParameterAuthority(params, sessionDisposer);
  const liquidShaperFeature = createLiquidShaperFeatureRuntime(pendingLiquidChangesRef as any);

  // Core Textures must initialize after the authoritative parameter object exists.
  if (!coreTexturesEngineRef.current) {
    try {
      const coreTexturesCanvas = document.createElement('canvas');
      coreTexturesCanvas.width = 800;
      coreTexturesCanvas.height = 800;
      coreTexturesCanvasRef.current = coreTexturesCanvas;

      const initialParams: any = (window as any).params || params || defaultParams;
      coreTexturesEngineRef.current = new CoreTexturesEngine(coreTexturesCanvas, {
        audioIntensity: initialParams.coreTexturesAudioIntensity ?? 0.5,
        frequencyRange: initialParams.coreTexturesFrequencyRange ?? 'full',
        beatSync: initialParams.coreTexturesBeatSync ?? true,
        opacity: initialParams.coreTexturesOpacity ?? 0.85,
        blendMode: initialParams.coreTexturesBlendMode ?? 'screen',
        scale: initialParams.coreTexturesScale ?? 1.0,
        speed: initialParams.coreTexturesSpeed ?? 1.0,
        density: initialParams.coreTexturesDensity ?? 0.5,
        glowIntensity: initialParams.coreTexturesGlowIntensity ?? 0.6,
      });
      coreTexturesEngineRef.current.init();

      const initialShaderId = initialParams.coreTexturesShaderId
        || initialParams.selectedCoreTextureShader
        || 'digital-matrix';
      if (initialShaderId) coreTexturesEngineRef.current.selectShader(initialShaderId);
      coreTexturesEngineRef.current.setEnabled(Boolean(initialParams.coreTexturesEnabled));
      (window as any).coreTexturesEngine = coreTexturesEngineRef.current;
      window.dispatchEvent(new CustomEvent('core-textures-ready'));
    } catch (error) {
      console.error('Failed to init CoreTexturesEngine:', error);
      coreTexturesEngineRef.current = null;
    }
  }

  if (coreTexturesEngineRef.current) {
    const trackedEngine = coreTexturesEngineRef.current;
    const releaseContext = resourceScope.track('activeWebGLContexts');
    sessionDisposer.add(() => {
      trackedEngine.cleanup();
      if (coreTexturesEngineRef.current === trackedEngine) coreTexturesEngineRef.current = null;
      const runtimeWindow = window as any;
      if (runtimeWindow.coreTexturesEngine === trackedEngine) runtimeWindow.coreTexturesEngine = null;
      releaseContext();
    });
  }

  const centerGraphicController = new CenterGraphicController({
    params,
    defaultParams,
    debug: debugGeneral,
    querySelector,
  });
  const centerImageRotationHomeTween = centerGraphicController.rotationHomeTween;
  centerGraphicController.loadDefaultLogos();
  sessionDisposer.add(() => centerGraphicController.dispose());
  attachCenterMediaAuthority(centerGraphicController, params, sessionDisposer);

  const colorState = createProductionColorStateRuntime();
  const audioFrameStateRuntime = createAudioFrameStateRuntime({
    createVisualAudioRuntime: () => new VisualAudioRuntime(240),
    createBeatEffectRuntime: () => new BeatEffectRuntime(),
    createBeatDetectionRuntime: () => new BeatDetectionRuntime(),
    createCoreParticleImpulseRuntime: () => new CoreParticleImpulseRuntime(),
  });
  const motionState = createProductionMotionStateRuntime({
    createRotationAuthority: () => new RotationAuthority(),
    createFramePacingRuntime: () => new FramePacingRuntime(),
    createMotionRotationRuntime: () => new MotionRotationRuntime(),
    createSchedulerMotionPhaseRuntime: () => new SchedulerMotionPhaseRuntime(),
    createAutoZoomMotionRuntime: () => new AutoZoomMotionRuntime(),
    initialRotation: params.rotation || 0,
    initialSyncMode: 'free',
  });

  sessionDisposer.add(() => {
    audioFrameStateRuntime.reset();
    motionState.reset();
    colorState.reset();
  });

  const rotationAuthority = motionState.rotationAuthority;
  const rotationHomeTween = {
    get active() { return false; },
    set active(value: boolean) { if (!value) rotationAuthority.clear(); },
  };

  return {
    params,
    parameterStore,
    liquidShaperFeature,
    centerGraphicController,
    centerImageRotationHomeTween,
    colorState,
    audioFrameStateRuntime,
    visualAudioRuntime: audioFrameStateRuntime.visualAudioRuntime,
    beatEffectRuntime: audioFrameStateRuntime.beatEffectRuntime,
    beatDetectionRuntime: audioFrameStateRuntime.beatDetectionRuntime,
    coreParticleImpulseRuntime: audioFrameStateRuntime.coreParticleImpulseRuntime,
    motionState,
    rotationAuthority,
    framePacingRuntime: motionState.framePacingRuntime,
    motionRotationRuntime: motionState.motionRotationRuntime,
    schedulerMotionPhaseRuntime: motionState.schedulerMotionPhaseRuntime,
    autoZoomMotionRuntime: motionState.autoZoomMotionRuntime,
    rotationHomeTween,
  };
}
