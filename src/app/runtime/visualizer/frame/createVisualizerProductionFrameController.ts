import type { VisualizerRuntimeBindings } from '../VisualizerRuntimeBindings';
import type { AudioRuntimeSetup } from '../audio/createAudioRuntimeSetup';
import type { createVisualizerFeatureSession } from '../session/createVisualizerFeatureSession';
import type { RuntimeSessionInfrastructure } from '../session/createRuntimeSessionInfrastructure';
import type { createVisualizerFrameServices } from '../setup/createVisualizerFrameServices';
import type { RendererViewportSetup } from '../setup/createRendererViewportSetup';
import type { createSessionInteractionSetup } from '../setup/createSessionInteractionSetup';
import type { ProductionUISideEffectRuntime } from '../ui/ProductionUISideEffectRuntime';
import type { PerformanceMetricsState } from '../../renderLoopHelpers';
import type { VuGradientCache } from '../../../renderers/canvasLayerRenderer';
import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';
import type { MotionBlurConfig } from '../../../utils/motionBlur';
import { DEVELOPMENT_DIAGNOSTICS_ENABLED, FIELD_CERTIFICATION_ENABLED } from '../../../config/runtimeEnvironment';
import { syncLiquidShapeSelect } from '../../../utils/astralShaper';
import { bpmClockRuntime } from '../../bpm/BpmClockRuntime';
import { updateCenterEmitterGeometry } from '../renderers/CenterEmitterGeometry';
import { resetFramePhaseCosts } from '../../renderFrameRuntime';
import { runtimeRenderAuthority } from '../RuntimeRenderAuthority';
import { renderCanvasSpikeRing } from '../renderers/CanvasSpikeRingRenderer';
import { createProductionFrameRuntime } from './ProductionFrameRuntime';
import { createProductionRuntimeDiagnostics } from '../diagnostics/ProductionRuntimeDiagnostics';
import { createProductionPerformanceCertification } from '../diagnostics/ProductionPerformanceCertification';
import { mainThreadUIRefreshBus } from '../pipeline/MainThreadUIRefreshBus';
import {
  resolveCoreParticleDiameterGain,
  resolveCoreParticleIntensity,
  resolveCoreParticleVisualEnergy,
} from '../../../src/render/coreParticles/CoreParticleControlMapping';

type FeatureSession = ReturnType<typeof createVisualizerFeatureSession>;
type FrameServices = ReturnType<typeof createVisualizerFrameServices>;
type InteractionRuntime = ReturnType<typeof createSessionInteractionSetup>;

export interface VisualizerViewportState {
  width: number;
  height: number;
  dpr: number;
  activeRenderScale: number;
}

export interface VisualizerAudioControlBuffers {
  freqArr: Uint8Array<ArrayBufferLike>;
  timeArr: Uint8Array<ArrayBufferLike>;
  filteredFreqArr: Uint8Array<ArrayBufferLike>;
  rawSpikeFreqArr: Uint8Array<ArrayBufferLike>;
}

export interface VisualizerProductionFrameControllerOptions {
  bindings: VisualizerRuntimeBindings;
  infrastructure: RuntimeSessionInfrastructure;
  rendererViewportSetup: RendererViewportSetup;
  audioRuntime: AudioRuntimeSetup;
  audioBuffers: VisualizerAudioControlBuffers;
  featureSession: FeatureSession;
  frameServices: FrameServices;
  interactionRuntime: InteractionRuntime;
  uiSideEffects: ProductionUISideEffectRuntime;
  viewportState: VisualizerViewportState;
  spikeFeature: any;
  querySelector: (selector: string) => Element | null;
  getPalette: () => any;
  resetRotationState: (mode: string, angle: number) => void;
  scheduleUIUpdate: (update: () => void) => void;
  requestSafeGraphicsRecovery: (reason: string) => void;
}

export interface VisualizerProductionFrameController {
  getAngle(): number;
  getCachedShapeSelect(): HTMLSelectElement | null;
  resetDotOwner(): void;
}

/**
 * Refactor Phase 3 production-frame owner.
 *
 * This is the sole home of the parity-frozen visual frame body and its mutable
 * frame-local state. Session setup, controls, audio ownership, and disposal stay
 * outside this boundary. The controller creates no additional scheduler: it
 * composes the existing ProductionFrameRuntime exactly once.
 */
export function createVisualizerProductionFrameController(
  options: VisualizerProductionFrameControllerOptions,
): VisualizerProductionFrameController {
  const {
    bindings,
    infrastructure,
    rendererViewportSetup,
    audioRuntime,
    audioBuffers,
    featureSession,
    frameServices,
    interactionRuntime,
    uiSideEffects,
    viewportState,
    spikeFeature,
    querySelector: $,
    getPalette,
    resetRotationState,
    scheduleUIUpdate,
    requestSafeGraphicsRecovery,
  } = options;
  const {
    AudioAmplifier,
    CORE_PARTICLES_SANDBOX,
    DEBUG_FLAGS,
    DEBUG_PERF,
    PresetTransitionEngine,
    RuntimeClock,
    avg,
    clamp,
    clearStaleCache,
    computeCoreParticleReactivity,
    coreTexturesCanvasRef,
    coreTexturesEngineRef,
    createFramePhaseCosts,
    createVisualizerRuntimeFoundation,
    damp,
    drawAstralShaper,
    formatTime,
    getAstralMorphEngine,
    getMotionBlurEngine,
    getUnifiedHue,
    leftAnalyserRef,
    leftTimeDataRef,
    measureElapsed,
    prepareRenderFrame,
    processSpikeSignalChain,
    publishRenderCostDebug,
    renderCenterGlow,
    renderMiniSpectrumTrace,
    renderShockwaves,
    renderVuMeter,
    resolveCoreTextureParams,
    rightAnalyserRef,
    rightTimeDataRef,
    startIdleCacheCleanup,
    stereoPanRef,
    stereoWidthRef,
    updatePerformanceMetricsHelper,
    useWebGLCoreParticlesRef,
    useWebGLRef,
    webglEngineRef,
    renderOnMainThread = true,
  } = bindings;
  const { canvas, ctx, sessionDisposer, resourceScope, asyncRegistry } = infrastructure;
  const {
    glCanvas,
    gl,
    webglSpikeRenderer,
    darkStrobeRenderer,
    ensureCoreParticlesGpuRenderer,
    disableCoreParticlesGpuRenderer,
    viewportPanelSetup,
  } = rendererViewportSetup;
  const viewportController = viewportPanelSetup.viewportController;
  const {
    AC,
    state: audioState,
    analyser,
    energyAnalyser,
    energyFreqArr,
    energyTimeArr,
    trackMetadata,
    updateMetadataDisplay,
  } = audioRuntime;
  const {
    params,
    parameterStore,
    liquidShaperFeature,
    centerGraphicController,
    centerImageRotationHomeTween,
    colorState,
    visualAudioRuntime,
    beatEffectRuntime,
    beatDetectionRuntime,
    coreParticleImpulseRuntime,
    motionState,
    rotationAuthority,
    framePacingRuntime,
    motionRotationRuntime,
    schedulerMotionPhaseRuntime,
    autoZoomMotionRuntime,
  } = featureSession;
  let ctTimeBuf = frameServices.ctTimeBuf;
  const {
    shockwaveRuntime,
    sparkCometRuntime,
    centerEmitterGeometry,
    audioSoakMonitor,
    shockwavePool,
    MAX_SHOCKWAVES,
    visualReactivityEngine,
    visualBus,
    spawnShockwaveRings,
    softParticleSpriteCache,
    colorWaveLUT,
    reusedVuMeterOptions,
    reusedCtEngineRenderOptions,
    reusedOuterHaloOptions,
    reusedDotRingOptions,
    reusedShockwaveOptions,
    reusedWebglEngineRenderOptions,
    reusedWebGLSpikeFrame,
    renderPipeline,
    renderFrameState,
    passOwners,
    uiRefreshScheduler,
    coreParticleFeature,
    PARTICLE_POOL_SIZE,
    particlePool,
    centerMediaFeature,
    COLOR_WAVE_SAMPLES,
    mainThreadAudioUIRefresh,
  } = frameServices;
  const { recordingEngine, uiInteractionRuntime, audioVisualStressDiagnostics } = interactionRuntime;

  let W = viewportState.width;
  let H = viewportState.height;
  let DPR = viewportState.dpr;
  let activeRenderScale = viewportState.activeRenderScale;
  let palette = getPalette();
  let freqArr = audioBuffers.freqArr as Uint8Array<ArrayBuffer>;
  let timeArr = audioBuffers.timeArr as Uint8Array<ArrayBuffer>;
  let filteredFreqArr = audioBuffers.filteredFreqArr as Uint8Array<ArrayBuffer>;
  let rawSpikeFreqArr = audioBuffers.rawSpikeFreqArr as Uint8Array<ArrayBuffer>;

  const FPS_HISTORY_SIZE = 60;
  const fpsHistoryBuffer = new Float32Array(FPS_HISTORY_SIZE);
  let fpsHistoryBufferIndex = 0;
  let fpsHistoryBufferCount = 0;
  let bpmShockwaveTimer = 0;
  let lastBeatShockwaveTime = 0;

  const performanceMetricsState: PerformanceMetricsState = {
    lastFpsUpdate: performance.now(),
    perfFrameCount: 0,
    lastPerfFrameTime: performance.now(),
  };
  let runtimeDiagnostics: ReturnType<typeof createProductionRuntimeDiagnostics> | null = null;
  function updatePerformanceMetrics(now: number) {
    runtimeDiagnostics?.updatePerformanceMetrics(now);
  }

  const hueFromPalette = (energy: number) =>
    getUnifiedHue({
      palette,
      hueSpeed: params.hueSpeed,
      timeMs: lastT,
      iridize: params.iridize,
      gamma: params.gamma,
      spectrum: params.spectrum,
    }, energy);

    let lastT = performance.now(), angle = 0, frameCount = 0, fpsTimer = 0;
    const runtimeClock = new RuntimeClock(1 / 45);
    runtimeClock.start(lastT);
    let latestBpmBarPhase = 0;
    const presetTransitionEngine = new PresetTransitionEngine(0.24);
    let lastEnergy = 1.0; // Default to 1.0 (Electric Blue end of gradient) instead of 0.0
    let audioEverStarted = false; // Track if audio has ever played
    // audio start time is owned by RuntimeAudioSessionState.
    // 🔧 FIX AUDIO DELAY 2: Grace period reduced 3000ms → 300ms.
    //    3 seconds of suppressed beat detection meant the visualiser was completely
    //    non-reactive for the first 3 beats of any track. 300ms is enough to let
    //    the Web Audio pipeline fill its initial buffer without false-triggering.
    let beatDetectionGracePeriod = 300;
    let lastMetadataUpdate = 0; // Track/audio metadata publication throttle
    let lastRecordingHudUpdate = 0; // Independent recording HUD throttle
    let pendingMetadataIdleHandle: ReturnType<typeof asyncRegistry.requestIdle> | null = null;
    
    // 🚨 PERFORMANCE OPTIMIZATION: Memory monitoring DISABLED for production
    // Memory monitor was causing 10-second micro-stutters
    // Browser handles memory management automatically - manual monitoring not needed
    
    // REMOVED: memoryMonitorInterval (was running every 10s, causing performance hits)
    
    // Cache cleanup timer (every 15 seconds, uses requestIdleCallback when available)
    // Sprint 22B: extracted self-scheduling/disposal logic to renderLoopHelpers.
    const cacheCleanupHandle = startIdleCacheCleanup(clearStaleCache, 15000, 800);
    sessionDisposer.add(() => cacheCleanupHandle.dispose());
    
    // CPU OPTIMIZATION: Adaptive quality based on frame rate
    let currentFPS = 60;
    let performanceQuality = 1.0; // 1.0 = full quality, 0.5 = half quality for performance
    let frameSkipCounter = 0;
    // ⚡ QUALITY SCALING DISABLED FOR TESTING (seam fix verification)
    // Re-enable after confirming seam is fixed
    let qualityScalingEnabled = false;
    // initialization timing is owned by RuntimeAudioSessionState.
    // FIX 3: Restore real grace period (was 999999000 = permanently disabled).
    //   3 seconds after audio starts allows the pipeline to warm up before
    //   adaptive quality kicks in — prevents jarring quality drop on load.
    const INIT_GRACE_PERIOD = 3000;
    
    // ⚡ PERFORMANCE FIX: Output sync throttling (prevents massive GC pressure)
    // Sync at 30fps max instead of 60fps to reduce allocation overhead by 50%
    let lastOutputSyncTime = 0;
    const OUTPUT_SYNC_INTERVAL = 33; // 33ms = ~30fps (output doesn't need full 60fps)
    
    // ⚡ FPS TRACKING: Adaptive quality governor (circular buffer declared at top - ZERO allocations!)
    
    const pulseColorAmount = params.shapeDecay; // reuse Pulse slider as color-pulse amount
    const pulseFlash = Math.pow(coreParticleFeature.pulseValue, 0.85) * pulseColorAmount;

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    const getSoftParticleSprite = (radius: number): HTMLCanvasElement => softParticleSpriteCache.get(radius);
    
    
    let astralLayerCanvas: HTMLCanvasElement | null = null;
    let astralLayerCtx: CanvasRenderingContext2D | null = null;
    let astralLayerDirty = true; // Flag to know when to redraw
    let lastAstralParams = { shape: '', scale: 0, rotation: 0, edgeGlow: 0 }; // Track changes
    
    
    // ⚡ PERFORMANCE FIX: Cache DOM element references (avoid repeated getElementById calls)
    let cachedFpsEl: HTMLElement | null = null;
    let cachedQualityEl: HTMLElement | null = null;
    let cachedBpmEl: HTMLInputElement | null = null;
    let cachedShapeSelectEl: HTMLSelectElement | null = null;
    let cachedBpmSyncEl: HTMLInputElement | null = null;
    let cachedBpmInputEl: HTMLInputElement | null = null;
    let cachedBarsEl: HTMLInputElement | null = null;
    let cachedCycleSpeedEl: HTMLSelectElement | null = null;
    // FIX 1: metaTL/metaTrack cached - were queried via getElementById every frame
    let cachedMetaTL: HTMLElement | null = null;
    let cachedMetaTrack: HTMLElement | null = null;
    // 🚀 ZERO-ALLOC PW-04: Canvas refs hoisted — were queried via getElementById inside RAF every frame
    let cachedVuMeterCanvas: HTMLCanvasElement | null = null;
    let cachedSpectrumCanvas: HTMLCanvasElement | null = null;
    // 🚀 ZERO-ALLOC CF-02: VU gradient cache hoisted — was re-created as a new object literal every frame
    // color field added: invalidate when palette auto-cycles so VU meter color tracks the ring color
    let vuGradientCache: VuGradientCache = {grad: null, clip: null, width: 0, cacheKey: ''};
    
    asyncRegistry.setTimeout(() => {
      cachedFpsEl = document.getElementById("fps");
      cachedQualityEl = document.getElementById("perfQuality");
      cachedBpmEl = document.querySelector('#bpm') as HTMLInputElement;
      cachedShapeSelectEl = document.getElementById('astralShape') as HTMLSelectElement;
      cachedBpmSyncEl = document.getElementById("bpmSync") as HTMLInputElement;
      cachedBpmInputEl = document.getElementById("bpm") as HTMLInputElement;
      cachedBarsEl = document.getElementById("bars") as HTMLInputElement;
      cachedCycleSpeedEl = document.getElementById('cycleSpeed') as HTMLSelectElement;
      cachedMetaTL = document.getElementById("metaTL");
      cachedMetaTrack = document.getElementById("metaTrack");
      // 🚀 ZERO-ALLOC PW-04: Populate canvas cache once (reused every frame instead of getElementById)
    }, 100);
    const { halo: haloOwner, dots: dotOwner, centerMedia: centerMediaOwner, postEffects: postEffectsOwner } = passOwners;


    interface PendingFramePublication {
      costs: ReturnType<typeof createFramePhaseCosts>;
      framePacing: ReturnType<typeof framePacingRuntime.tick>;
      canvas2DSpikeBaselineActive: boolean;
      engineOwnedGLActive: boolean;
      webglEngineActive: boolean;
    }
    const reusableFrameCosts = createFramePhaseCosts();
    const reusableRenderCostSnapshot: any = {};
    const reusableFramePublication: PendingFramePublication = {
      costs: reusableFrameCosts,
      framePacing: framePacingRuntime.snapshot,
      canvas2DSpikeBaselineActive: false,
      engineOwnedGLActive: false,
      webglEngineActive: false,
    };
    let pendingFramePublication: PendingFramePublication | null = null;
    const reusedDarkStrobeFrame = {
      pulse: 0,
      depth: 0,
      displacement: 0,
      timeSeconds: 0,
      baseLayerActive: false,
    };

    // Phase 4.8H.5: observational certification is dormant until explicitly
    // enabled from DevTools. It samples the already-separated runtime boundaries
    // without changing renderer state, scheduler cadence, or control behavior.
    const performanceCertification = createProductionPerformanceCertification({
      getInteractionState: () => uiInteractionRuntime.currentState,
      getFrameCosts: () => reusableFrameCosts,
    });
    sessionDisposer.add(() => performanceCertification.dispose());

    runtimeDiagnostics = createProductionRuntimeDiagnostics({
      canvas,
      performanceObj: performance,
      resourceScope,
      params,
      audioState,
      sparkCometRuntime,
      audioSoakMonitor,
      uiRefreshScheduler,
      mainThreadUIRefreshBus,
      publishRenderCostDebug,
      developmentDiagnosticsEnabled: DEVELOPMENT_DIAGNOSTICS_ENABLED,
      fieldCertificationEnabled: FIELD_CERTIFICATION_ENABLED,
      getRenderScale: () => activeRenderScale,
      getCurrentFps: () => currentFPS,
      getSpikeCount: () => filteredFreqArr.length,
      getUseWebGL: () => Boolean(useWebGLRef.current),
      reusableRenderCostSnapshot,
      performanceMetricsState,
      updatePerformanceMetricsHelper,
      getElement: $,
    });

    function publishCurrentFrameDiagnostics(): void {
      runtimeDiagnostics?.publish(pendingFramePublication, lastT);
    }

    function finalizeCurrentFrame(): void {
      const publication = pendingFramePublication;
      const interactionActive = uiInteractionRuntime.isActive;
      // Preserve visual frame budget during scroll/drag. Nonessential UI work stays
      // queued and flushes immediately after the short interaction tail expires.
      if (!interactionActive && uiSideEffects.hasPendingWork) {
        uiSideEffects.flush((ms) => {
          if (publication) publication.costs.uiFlushMs = ms;
        });
      }
      pendingFramePublication = null;
    }

    // 🚀 PHASE 1: NON-BLOCKING RENDER LOOP (never waits for worker!)
    function executeVisualFramePipeline(t: number, runtimeTiming: RuntimeFrameTiming) {
      // Sprint 22H.1: hard visibility guard. Browsers may still deliver one queued RAF
      // after a tab/window hide; do not tick clocks or advance motion while hidden.
      if (document.hidden) return;

      // ⚡ PERFORMANCE PROFILING: Track render time for optimization
      // Interaction frames are measured even outside field certification so the
      // frame-budget diagnostics can correlate panel gestures with actual pass cost.
      // This only enables timestamps; it does not alter the render path or quality.
      const measureFrameTimings = FIELD_CERTIFICATION_ENABLED ||
        Boolean((window as any).__ORBITAL_RENDER_COST_DEBUG__) ||
        uiInteractionRuntime.isActive;
      const frameCosts = resetFramePhaseCosts(reusableFrameCosts, undefined, measureFrameTimings);
      const framePacing = framePacingRuntime.tick(t);
      // Phase 4.8I: Macro 2 rotation commits are advanced exclusively by the
      // authoritative visual clock. Pointer movement never writes rotation; release
      // starts one bounded smooth transition that continues independently of UI work.
      motionState.updateMacro2RotationCommit(t, params);
      performanceQuality = framePacing.qualityScale;
      let phase7CanvasStart = 0;
      
      // Sprint 21: single runtime clock. Clamp is tighter so UI/GC stalls never become catch-up rotation snaps.
      const frame = runtimeClock.tick(t);
      const schedulerMotionFrame = schedulerMotionPhaseRuntime.advance(frame.dt);
      let dt = schedulerMotionFrame.deltaSeconds;
      const schedulerMotionTimeMs = schedulerMotionFrame.timeSeconds * 1000;
      lastT = t;
      
      frameCount++;
      fpsTimer += dt;
      
      // 🔧 PERFORMANCE FIX: Calculate time-based effect values ONCE per frame (not 900+ times!)
      // 🚀 IMPROVED: Infinite accumulation (no modulo = no wrap discontinuity!)
      const motionPhases = motionRotationRuntime.advancePhases(dt);
      colorState.colorWavePhase = motionPhases.colorWaveRotation;
      colorState.satBurstPhase = motionPhases.satBurstWavePhase;
      motionState.spikeTimeAcc = motionPhases.spikeTime;

      // 🔧 IMPROVEMENT #9c: Recompute colorWaveHueRange only when effectAmount changes
      if (params.effectAmount !== colorState.lastEffectAmount) {
        colorState.cachedColorWaveHueRange = params.effectAmount * 60;
        colorState.lastEffectAmount = params.effectAmount;
        colorState.colorWaveLUTDirty = true; // S4: mark LUT stale when its only input changes
      }
      const colorWaveHueRange = colorState.cachedColorWaveHueRange;
      
      // Extract wrapped values for calculations (keeps precision, no discontinuity)
      const colorWaveRotation = colorState.colorWavePhase; // Use directly (no modulo needed!)
      const satBurstWavePhase = colorState.satBurstPhase % 1; // Only wrap for 0-1 range calculations
      
      
      // 🔧 S4: colorWaveLUT rebuild now gated on dirty flag.
      //    The LUT is purely a function of colorWaveHueRange (set above).
      //    Since that value only changes when the effectAmount slider moves,
      //    the 360 sin() calls only run on slider interaction — not 60x per second.
      if (colorState.colorWaveLUTDirty && params.beatDetect && (params.beatPulseType === 'all' || params.beatPulseType === 'color')) {
        for (let i = 0; i < COLOR_WAVE_SAMPLES; i++) {
          const anglePosition = i / COLOR_WAVE_SAMPLES;
          colorWaveLUT[i] = Math.sin(anglePosition * Math.PI * 6) * colorWaveHueRange;
        }
        colorState.colorWaveLUTDirty = false;
      }
      
      // ⚡ PHASE 4: Removed expensive debug console.logs from render loop
      // 🗑️ REMOVED: Duplicate dt calculation (moved to top of function)
      
      // ⚡ PHASE 1 OPTIMIZATION: FPS tracking with circular buffer (ZERO allocations!)
      fpsHistoryBuffer[fpsHistoryBufferIndex] = currentFPS;
      fpsHistoryBufferIndex = (fpsHistoryBufferIndex + 1) % FPS_HISTORY_SIZE;
      if (fpsHistoryBufferCount < FPS_HISTORY_SIZE) fpsHistoryBufferCount++;
      
      if (fpsTimer >= 0.5) {
        currentFPS = Math.round(frameCount / fpsTimer);
        
        // ⚡ PERFORMANCE FIX: Move DOM update out of render loop (use cached element)
        scheduleUIUpdate(() => {
          if (cachedFpsEl) cachedFpsEl.textContent = currentFPS + " fps";
        });
        
        // Calculate average FPS from circular buffer (no reduce allocation!)
        let fpsSum = 0;
        for (let i = 0; i < fpsHistoryBufferCount; i++) {
          fpsSum += fpsHistoryBuffer[i];
        }
        const avgFPS = fpsHistoryBufferCount > 0 ? fpsSum / fpsHistoryBufferCount : currentFPS;
        
        // ⚡ INITIALIZATION GUARD: Check if enough time has passed to enable quality scaling
        if (!qualityScalingEnabled && audioState.initializationStartTime > 0) {
          const timeSinceInit = t - audioState.initializationStartTime;
          if (timeSinceInit >= INIT_GRACE_PERIOD) {
            qualityScalingEnabled = true;
            if (DEBUG_FLAGS.GENERAL) console.log('✅ Initialization complete - adaptive quality scaling now enabled');
          }
        }
        
        // Rolling p95/p99 frame pacing owns renderer-internal quality. User
        // controls remain untouched; recovery is intentionally slower than downshift.
        performanceQuality = qualityScalingEnabled ? framePacing.qualityScale : 1;
        
        // Canvas resolution scaling REMOVED.
        // Changing canvas.width/height inside the RAF loop mismatches the DPR transform
        // applied by the per-frame reset (ctx.setTransform(DPR,0,0,DPR,0,0)), causing
        // everything to render displaced/zoomed. Canvas size only changes on window resize.
        // Quality adaptation is handled via dot density reduction above (safe, no transform issues).
        
        // ⚡ PERFORMANCE FIX: Move quality indicator DOM update out of render loop (use cached element)
        const qualityPercent = Math.round(performanceQuality * 100);
        scheduleUIUpdate(() => {
          if (cachedQualityEl) {
            cachedQualityEl.textContent = qualityPercent + '%';
            // Color code: Green (100%), Yellow (70-99%), Orange (50-69%), Red (<50%)
            if (qualityPercent >= 100) {
              cachedQualityEl.style.color = '#00FF88'; // Green
            } else if (qualityPercent >= 70) {
              cachedQualityEl.style.color = '#FFD700'; // Yellow
            } else if (qualityPercent >= 50) {
              cachedQualityEl.style.color = '#FF8800'; // Orange
            } else {
              cachedQualityEl.style.color = '#FF4444'; // Red
            }
          }
        });
        
        frameCount = 0;
        fpsTimer = 0;
      }
      
      // ⚡ PERFORMANCE FIX: Memory monitoring moved to separate timer (prevents RAF blocking!)
      // Was causing 3-5 second stuttering - now runs outside render loop
      
      // Sprint 22N.C Stage 2: UI canvases stay live but refresh from the authoritative
      // scheduler at 30 Hz. No secondary RAF and no scroll-based suspension.
      frameSkipCounter++;
      const refreshVu = uiRefreshScheduler.shouldRun('vu', t);
      const refreshSpectrum = uiRefreshScheduler.shouldRun('spectrum', t);
      const refreshProgress = uiRefreshScheduler.shouldRun('progress', t);
      if (refreshVu || refreshSpectrum) {
        // 🚀 ZERO-ALLOC PW-04: Lazy-cache with isConnected guard —
        // re-queries getElementById only when element is missing OR was unmounted by React
        // (React unmounts vuMeter/miniSpectrum when audioTab switches away from 'controls')
        if (!cachedVuMeterCanvas || !cachedVuMeterCanvas.isConnected)
          cachedVuMeterCanvas = document.getElementById("vuMeter") as HTMLCanvasElement;
        if (!cachedSpectrumCanvas || !cachedSpectrumCanvas.isConnected)
          cachedSpectrumCanvas = document.getElementById("miniSpectrum") as HTMLCanvasElement;
        const vuMeterCanvas = cachedVuMeterCanvas;
        const spectrumCanvas = cachedSpectrumCanvas;

        // Sprint 22G: VU meter drawing moved to canvasLayerRenderer.
        Object.assign(reusedVuMeterOptions, {
          canvas: vuMeterCanvas,
          energyTimeArr,
          palette,
          params,
          timeMs: t,
          gradientCache: vuGradientCache,
        });
        if (refreshVu) renderVuMeter(reusedVuMeterOptions);
      
      // 🔥 MINI SPECTRUM: Phase 10H.2 curved spectral trace with palette-linked gradient fill.
      if (refreshSpectrum && spectrumCanvas) {
        const ctx2d = spectrumCanvas.getContext("2d");
        if (ctx2d) {
          renderMiniSpectrumTrace(ctx2d, energyFreqArr, {
            sampleRate: AC.sampleRate,
            palette,
            minHz: 20,
            maxHz: 20000,
            points: 72,
            showFill: true,
          });
        }
      }
      } // End shared-scheduler VU/Spectrum refresh block
      
      // Update TIME LEFT countdown, track metadata and progress from the authoritative RAF.
      if (audioState.mediaElement && isFinite(audioState.mediaElement.duration) && isFinite(audioState.mediaElement.currentTime)) {
        if (refreshProgress) {
          const duration = Math.max(0, audioState.mediaElement.duration);
          const currentTime = Math.max(0, audioState.mediaElement.currentTime);
          mainThreadUIRefreshBus.publishAudioProgress({
            currentTime,
            duration,
            percent: duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0,
          });
        }
        const remaining = audioState.mediaElement.duration - audioState.mediaElement.currentTime;
        trackMetadata.timeLeft = formatTime(remaining);
        
        // FIX 2: Defer React metadata update outside RAF via requestIdleCallback.
        //   updateMetadataDisplay calls setMetadata() (React state setter) which
        //   triggers a component re-render. Calling it from inside the RAF loop
        //   means the re-render competes with the animation for the main thread.
        //   requestIdleCallback fires AFTER the frame is composited — zero RAF impact.
        //   Throttled to 4fps (250ms) — HUD numbers don't need faster updates.
        const now = t;
        if (now - lastMetadataUpdate > 250 && pendingMetadataIdleHandle === null) {
          lastMetadataUpdate = now;
          pendingMetadataIdleHandle = asyncRegistry.requestIdle(() => {
            pendingMetadataIdleHandle = null;
            updateMetadataDisplay();
          }, { timeout: 500 });
        }
        
        // FIX 1b: Use cached elements instead of getElementById every frame
        if (cachedMetaTL) cachedMetaTL.textContent = trackMetadata.timeLeft;
        if (cachedMetaTrack && trackMetadata.track && trackMetadata.track !== "—") {
          cachedMetaTrack.textContent = trackMetadata.track;
        }
      }
      
      // Recording time has its own 4fps throttle. It must not share the audio
      // metadata timestamp, otherwise a playing track suppresses REC TIME forever.
      const recHudNow = t;
      if (recordingEngine.isRecording() && recHudNow - lastRecordingHudUpdate > 250) {
        recordingEngine.updateHUD();
        lastRecordingHudUpdate = recHudNow;
      }
      
      // Update performance metrics (FPS, CPU, Memory)
      if (mainThreadUIRefreshBus.hasPerformanceHUDSubscribers()) {
        updatePerformanceMetrics(t);
      }

      // 🚀 PHASE 1: NON-BLOCKING AUDIO ANALYSIS PIPELINE
      // Strategy: Fire-and-forget worker requests, always render with latest available data
      
      // Sprint 22N.B: analyser reads, shared energy bands, warm-up gating and
      // low-latency transient/energy buses now belong to VisualAudioRuntime.
      const needsTimeDomain = params.vizMode === 0 || params.coreParticles;
      const visualAudioFrame = visualAudioRuntime.update({
        now: t,
        dt,
        usingMic: audioState.usingMic,
        instant: params.motionSmoothing <= 0.18 || params.reactivityMode === 'instant',
        beatPulse: colorState.beatPulse,
        needsTimeDomain,
        analyser,
        energyAnalyser,
        freqArr,
        rawSpikeFreqArr,
        timeArr,
        energyFreqArr,
        energyTimeArr,
        sampleRate: AC.sampleRate,
        reactivityEngine: visualReactivityEngine,
        reactivityHz: params.reactivityHz,
        reactivityParams: {
          motionIntensity: params.motionIntensity,
          motionSmoothing: params.motionSmoothing,
          bassBoost: params.bassBoost,
          frequencySmoothing: params.frequencySmoothing,
          beatReactivityBoost: params.beatReactivityBoost,
          reactivityMode: params.reactivityMode,
          reactivityBlend: params.reactivityBlend,
        },
      });
      frameCosts.audioReadMs = visualAudioFrame.audioReadMs;
      const {
        energy20_160, energy20_600, energy40_500, energy60_150, energy150_250,
        energy500_2000, energy600_1600, energy1600_8000, energy20_8000,
      } = visualAudioFrame;

      // 🔧 FIX #5: AudioAmplifier moved AFTER energy band calculations.
      //    Previously it ran before avgFreq() calls — amplifying energyFreqArr caused
      //    energy values to saturate at high motionIntensity, then the spike smoother
      //    (spikeFeature.ampBuf) had to chase inflated values creating the "catch-up" sluggishness.
      //    Energy bands are read from raw data first, THEN freqArr is amplified for
      //    the visual spike target. The spike smoother now gets proportional input.
      AudioAmplifier.amplifyInPlace(freqArr, params.motionIntensity, params.bassReduce);
      // Note: energyFreqArr is NOT amplified — it feeds band calculations only.
      
      // 🔥 CRITICAL FIX: SEPARATE arrays for spike visualization vs beat detection!
      // This prevents frequency band selection from affecting spike ring reactivity
      
      // SPIKE VISUALIZATION: Apply frequency band filtering to visual display only
      // 🔧 SIMPLIFICATION S2: Eliminated two full Uint8Array memcpy operations per frame.
      //    filteredFreqArr and beatDetectionFreqArr were copied from freqArr each frame
      //    but never actually modified — pure aliases. Using freqArr directly saves
      //    ~2 x N bytes of writes per frame (N = FFT bin count, 60fps = significant pressure).
      const filteredFreqArr = rawSpikeFreqArr;
      const beatDetectionFreqArr = rawSpikeFreqArr;
      // Sprint 22N.B: beat onset state and visual beat consequences are owned
      // by BeatEffectRuntime. Existing render variables remain compatibility aliases
      // until the render passes move in Sprint 22N.C.
      beatEffectRuntime.seed(colorState.createBeatSeed());
      const beatFrame = beatEffectRuntime.update({
        now: t,
        dt,
        enabled: params.beatDetect,
        beatPulseType: params.beatPulseType,
        beatSensitivity: params.beatSensitivity,
        beatReactivityBoost: params.beatReactivityBoost,
        audioStartTime: audioState.audioStartTime,
        gracePeriodMs: beatDetectionGracePeriod,
        beatDetectionData: beatDetectionFreqArr,
        bassEnergy: energy20_160,
        midEnergy: energy600_1600,
        detectBeat: (energy: number, now: number) => beatDetectionRuntime.detect(energy, {
          now,
          sensitivity: params.beatSensitivity,
          bpmSync: params.bpmSync,
          bpm: params.bpm,
        }),
        damp,
        applyBeatPulse: (pulse, multiplier) => visualReactivityEngine.applyBeatPulse(pulse, multiplier),
        applyPendingMacroChanges: () => (window as any).applyPendingMacroChanges?.(),
        applyPendingLiquidChanges: () => (window as any).applyPendingLiquidChanges?.(),
      });
      const isBeat = beatFrame.isBeat;
      const coreParticleImpulseFrame = coreParticleImpulseRuntime.update({
        dt,
        beatTriggered: beatFrame.isBeat,
        beatPulse: beatFrame.beatPulse,
        transient: visualAudioFrame.transient,
        bass: energy20_160,
        mid: energy600_1600,
        high: energy1600_8000,
      });
      colorState.applyBeatFrame(beatFrame);

      // Phase 4.7R.5 — publish the exact, already-processed visual audio authority
      // used by the frozen renderer. The worker consumes this instead of rebuilding
      // a second approximation from analyser averages.
      runtimeRenderAuthority.publishVisualAudioFrame({
        now: t,
        sampleRate: AC.sampleRate,
        spectrum: rawSpikeFreqArr,
        energy: visualAudioFrame.energy20_8000,
        transient: visualAudioFrame.transient,
        energy20_160,
        energy20_600,
        energy40_500,
        energy60_150,
        energy150_250,
        energy500_2000,
        energy600_1600,
        energy1600_8000,
        energy20_8000,
        beat: beatFrame.isBeat,
        beatPulse: beatFrame.beatPulse,
      });

      // LIQUID SHAPER: Auto-cycle through shapes with BEAT-SYNCHRONIZED MORPHING
      let nextShape = undefined;
      let astralSmoothedMorphAmount = params.astralMorphAmount;
      if (params.astralShaper) {
        // 🔧 FIX 8b: Use cachedBpmEl instead of querySelector every frame
        const bpmValue = parseFloat(cachedBpmEl?.value || '174');
        const now = t;
        
        const astralEngine = getAstralMorphEngine();
        astralEngine.update(params, bpmValue, now);
        
        astralSmoothedMorphAmount = astralEngine.getSmoothedMorphAmount();
        nextShape = astralEngine.getNextShape();
        
        // Update UI dropdown
        // 🔧 FIX 8c: Use cachedShapeSelectEl instead of getElementById every frame
        if (cachedShapeSelectEl && cachedShapeSelectEl.value !== params.astralShape) {
          syncLiquidShapeSelect(cachedShapeSelectEl, params.astralShape);
        }
      }

      // Sprint 22N.C Stage 1: first low-risk pass now lives in the extracted pipeline.
      phase7CanvasStart = measureFrameTimings ? performance.now() : 0;
      prepareRenderFrame(renderFrameState, runtimeTiming, DPR, W, H);
      renderPipeline.renderPass('clear-background', renderFrameState);

      // 🎬 MOTION BLUR TRAILS - Pre-render (draw previous frame trails BEFORE current frame)
      if (params.motionBlurEnabled) {
        const motionBlurEngine = getMotionBlurEngine();
        const motionBlurConfig: MotionBlurConfig = {
          enabled: true,
          persistence: params.motionBlurPersistence,
          fadeMode: params.motionBlurMode
        };
        motionBlurEngine.preRenderTrail(ctx, motionBlurConfig);
      }

      const cx = W / 2, cy = H / 2, minSide = Math.min(W, H);
      const r0 = minSide * 0.28, r1 = minSide * 0.42, haloR = minSide * 0.46;
      
      // PHASE 1: Auto Zoom (BPM-SYNCED - Rhythmic pulsing with 3D ring effect)
      let zoomMod = 1.0;
      let zoomModCenterImage = 1.0; // Separate zoom for center image
      let zoomModDots = 1.0; // Separate zoom for dots
      let zoomModHalo = 1.0; // Separate zoom for halo
      
      let autoZoomEnergy = energy20_600 * 0.7 + energy600_1600 * 0.3;
      if (params.energyGate) {
        const threshold = params.energyThreshold;
        const release = params.energyRelease;
        if (autoZoomEnergy < threshold) {
          colorState.energyGateSmoother *= Math.pow(0.1, dt / (release * 1000 + 100));
          colorState.energyGateActive = colorState.energyGateSmoother < 0.05;
        } else {
          colorState.energyGateSmoother = Math.min(1.0, colorState.energyGateSmoother + (dt / 200));
          colorState.energyGateActive = false;
        }
        autoZoomEnergy *= colorState.energyGateSmoother;
      } else {
        colorState.energyGateSmoother = 1.0;
        colorState.energyGateActive = false;
      }
      const autoZoomFrame = autoZoomMotionRuntime.update(
        Boolean(params.autoZoom),
        Boolean(
          audioState.audioStartTime > 0 &&
          t - audioState.audioStartTime >= 200 &&
          (audioEverStarted || audioState.isPlaying || audioState.usingMic)
        ),
        dt,
        Number(params.bpm) || 174,
        Number(params.bars) || 8,
        latestBpmBarPhase,
        autoZoomEnergy,
      );
      zoomMod = autoZoomFrame.spike;
      zoomModCenterImage = autoZoomFrame.center;
      zoomModDots = autoZoomFrame.dots;
      zoomModHalo = autoZoomFrame.halo;
      
      // PHASE 4: Zoom Oscillation (Wave Effect) - increment global phase
      if (params.zoomOsc > 0.001) {
        motionState.zoomOscPhase += params.zoomOscSpeed * dt; // dt is in seconds, speed controls wave propagation speed
      }
      
      // 🔥 REMOVED: Beat zoom offset (too expensive)
      const finalZoom = params.zoom;
      
      // Apply zoom with safety clamping to keep all rings in canvas
      const zoom = clamp(finalZoom * zoomMod, 0.4, 2.5);
      const zoomCenter = clamp(finalZoom * zoomModCenterImage, 0.4, 2.5);
      const zoomDots = clamp(finalZoom * zoomModDots, 0.4, 2.5);
      const zoomHalo = clamp(finalZoom * zoomModHalo, 0.4, 2.5);
      
      // Calculate radii with individual zoom modifiers
      const R0 = r0 * zoom;
      const R1 = r1 * zoom;

      // Phase 10I: Chaos is an eased 8-segment radial displacement field shared by spikes + dots.
      motionState.chaosSegmentEase = damp(motionState.chaosSegmentEase, clamp(params.chaos || 0, 0, 1), 7.5, dt);
      const chaosSegments = 8;
      const chaosTime = schedulerMotionFrame.timeSeconds;
      const chaosSegmentOffset = (angleRad: number, radiusScale: number) => {
        if (motionState.chaosSegmentEase <= 0.001) return 0;
        const wrapped = ((angleRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const seg = Math.floor((wrapped / (Math.PI * 2)) * chaosSegments);
        const raw = Math.sin(chaosTime * 2.35 + seg * Math.PI * 0.5);
        const eased = Math.sign(raw) * (Math.abs(raw) * Math.abs(raw) * (3 - 2 * Math.abs(raw)));
        return eased * motionState.chaosSegmentEase * radiusScale;
      };
      
      // SAFETY: Clamp halo to never exceed canvas boundary (max 95% of half-screen)
      const maxHaloRadius = minSide * 0.475; // 95% of half minSide
      const RH = Math.min(haloR * zoomHalo, maxHaloRadius);
      const cometOverscanActive = params.autoZoom || params.allowZoom;
      const cometRadius = cometOverscanActive ? haloR * zoomHalo : RH;
      const maxCometRadius = minSide * (cometOverscanActive ? 0.62 : 0.49);

      // Sprint 21 — rotation sync authority pass.
      // One controller owns final angle across free/BPM/quantized/pingpong/oscillator modes.
      const syncMode = ((params as any).rotationSyncMode || 'free') as string;
      const rotationPhaseStart = measureFrameTimings ? performance.now() : 0;
      const motionFrame = motionRotationRuntime.updateRotation({
        dt,
        params,
        currentAngle: angle,
        lastSyncMode: motionState.lastSyncMode,
        rotationAuthority,
        resetRotationState,
        presetTransitionEngine,
      });
      angle = motionFrame.angle;
      motionState.rotationSyncAccumulator = motionFrame.rotationAccumulator;
      frameCosts.rotationMs = measureFrameTimings ? measureElapsed(rotationPhaseStart) : 0;
      motionState.lastSyncMode = syncMode;
      
      // Core Textures: clipped core-region background layer
      // Drawn BEFORE center graphic and rings so it stays behind the visual stack.
      {
        const ctEngine = coreTexturesEngineRef.current;
        const liveCoreParams = ((window as any).params || params) as any;
        const ctToggleEl = (typeof document !== 'undefined' ? (document.getElementById('coreTexturesEnabled') as HTMLInputElement | null) : null);
        const ctUiEnabled = Boolean(ctToggleEl?.checked);
        const ctEnabled = Boolean(ctUiEnabled || liveCoreParams.coreTexturesEnabled) || Boolean(ctEngine?.isEnabled?.());

        if (ctEnabled && ctEngine) {
          const desiredShaderId = liveCoreParams.coreTexturesShaderId || ctEngine.getCurrentShaderId?.() || 'digital-matrix';
          ctEngine.setEnabled?.(true);
          if (desiredShaderId && ctEngine.getCurrentShaderId?.() !== desiredShaderId) {
            ctEngine.selectShader?.(desiredShaderId);
          }

          const ctRawEnergy = (energy40_500 * 0.9 + energy500_2000 + energy1600_8000 * 0.6) / 2.5;
          const ctHue = hueFromPalette(Math.max(0, Math.min(1, ctRawEnergy || 0)));

          ctEngine.updateParams?.(resolveCoreTextureParams(liveCoreParams, desiredShaderId, {
            opacity: liveCoreParams.coreTexturesOpacity ?? 0.8,
            audioIntensity: liveCoreParams.coreTexturesAudioIntensity ?? 0.6,
            frequencyRange: liveCoreParams.coreTexturesFrequencyRange ?? 'full',
            beatSync: liveCoreParams.coreTexturesBeatSync ?? true,
            blendMode: liveCoreParams.coreTexturesBlendMode ?? 'screen',
            hue: ctHue,
          }));

          // 🚀 ZERO-ALLOC PW-02: Direct loops replace slice/reduce (eliminates 3 typed-array copies + 3 reduce passes per frame)
          const ctBassCount   = Math.max(1, Math.floor(energyFreqArr.length * 0.15));
          const ctMidStart    = Math.floor(energyFreqArr.length * 0.15);
          const ctMidEnd      = Math.max(ctMidStart + 1, Math.floor(energyFreqArr.length * 0.55));
          const ctMidCount    = Math.max(1, ctMidEnd - ctMidStart);
          const ctTrebleStart = Math.floor(energyFreqArr.length * 0.55);
          const ctTrebleCount = Math.max(1, energyFreqArr.length - ctTrebleStart);
          let _ctBassSum = 0, _ctMidSum = 0, _ctTrebleSum = 0;
          if (energyFreqArr.length > 0) {
            for (let _ci = 0; _ci < ctBassCount; _ci++) _ctBassSum += energyFreqArr[_ci];
            for (let _ci = ctMidStart; _ci < ctMidEnd; _ci++) _ctMidSum += energyFreqArr[_ci];
            for (let _ci = ctTrebleStart; _ci < energyFreqArr.length; _ci++) _ctTrebleSum += energyFreqArr[_ci];
          }
          const ctBass   = energyFreqArr.length > 0 ? (_ctBassSum   / ctBassCount   / 255) : 0;
          const ctMid    = energyFreqArr.length > 0 ? (_ctMidSum    / ctMidCount    / 255) : 0;
          const ctTreble = energyFreqArr.length > 0 ? (_ctTrebleSum / ctTrebleCount / 255) : 0;
          // 🚀 ZERO-ALLOC PW-01: Reuse pre-allocated ctTimeBuf — resize guard fires only if energy analyser FFT ever changes (it shouldn't)
          if (ctTimeBuf.length !== energyTimeArr.length) {
            ctTimeBuf = new Float32Array(energyTimeArr.length);
          }
          for (let i = 0; i < energyTimeArr.length; i++) ctTimeBuf[i] = (energyTimeArr[i] - 128) / 128;

          try {
            Object.assign(reusedCtEngineRenderOptions, {
              energy: ctRawEnergy,
              bass: ctBass,
              mid: ctMid,
              treble: ctTreble,
              beatIntensity: colorState.beatPulse,
              isBeat: colorState.beatPulse > 0.5,
              bpm: liveCoreParams.bpm || params.bpm || 174,
              frequencyData: energyFreqArr,
              timeData: ctTimeBuf,
            });
            ctEngine.render(reusedCtEngineRenderOptions);
          } catch {
            // Keep main visualizer RAF alive if one texture preset throws.
          }

          const ctCanvas = ctEngine.getCanvas?.() || ((coreTexturesCanvasRef as any).current as HTMLCanvasElement | null);
          if (ctCanvas && ctCanvas.width > 0 && ctCanvas.height > 0) {
            const coreRadius = Math.max(8, r0 * 0.76);
            const coreDiameter = coreRadius * 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = liveCoreParams.coreTexturesOpacity ?? 0.8;
            ctx.drawImage(ctCanvas, 0, 0, ctCanvas.width, ctCanvas.height, cx - coreRadius, cy - coreRadius, coreDiameter, coreDiameter);
            ctx.restore();
          }
        } else if (ctEngine) {
          ctEngine.setEnabled?.(false);
        }
      }

      const centerGraphicOptions = centerMediaFeature.prepareCenter({
        canvas,
        ctx,
        params,
        centerGraphicController,
        centerImageRotationHomeTween,
        cachedCycleSpeedEl,
        mediaEl: audioState.mediaElement,
        usingMic: audioState.usingMic,
        DEBUG_FLAGS,
        cx,
        cy,
        W,
        H,
        r0,
        zoomCenter,
        t,
        dt,
        energy40_500,
        energy500_2000,
        energy1600_8000,
        energy600_1600,
        energy20_600,
        energy20_160,
        energy60_150,
        energy150_250,
        energy20_8000,
        hueFromPalette,
        renderState: centerMediaFeature.renderState,
      });
      const centerGraphicEnergyState = centerMediaFeature.energyState;
      centerGraphicEnergyState.audioEverStarted = audioEverStarted;
      centerGraphicEnergyState.audioStartTime = audioState.audioStartTime;
      centerGraphicEnergyState.lastEnergy = lastEnergy;
      centerGraphicOptions.energyState = centerGraphicEnergyState;
      centerMediaOwner.prepare(centerGraphicOptions, (centerGraphicEnergyState: any) => {
        audioEverStarted = centerGraphicEnergyState.audioEverStarted;
        audioState.audioStartTime = centerGraphicEnergyState.audioStartTime;
        lastEnergy = centerGraphicEnergyState.lastEnergy;
      });
      renderPipeline.renderPass('centerMedia', renderFrameState);
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Deeper color breathing with smoothstep curve - NOW FFT-INDEPENDENT
      // Using actual Hz frequencies instead of array indices
      const rawEnergy = (energy40_500 * 0.9 + energy500_2000 + energy1600_8000 * 0.6) / 2.5;
      
      // 🔥 FIX: Separate effect flags to prevent iridize from triggering gamma's color breathing
      const hasGammaEffect = params.gamma > 0.01; // Only gamma triggers color flash/breathing
      const hasChaosEffect = params.chaos > 0.01; // Chaos can affect visuals
      const hasActiveEffects = hasGammaEffect || hasChaosEffect; // Iridize REMOVED from this check!
      
      // Apply smoothstep for more dramatic response to loudness (only when effects are active)
      const smoothstep = (x: number) => x * x * (3 - 2 * x);
      
      // FIX: Default to Electric Blue (1.0), freeze on pause, smooth transition on play
      const hasAudioPlaying = (audioState.mediaElement && !audioState.mediaElement.paused) || audioState.usingMic;
      let energy: number;
      
      if (hasAudioPlaying) {
        // Audio is playing - calculate energy from audio data
        const calculatedEnergy = hasActiveEffects ? smoothstep(smoothstep(rawEnergy)) : rawEnergy * 0.5;
        
        // Detect if we have valid audio data (rawEnergy > 0.01 means freq buffer has data)
        const hasValidAudioData = rawEnergy > 0.01;
        
        if (!audioEverStarted && hasValidAudioData) {
          // First time we get valid audio data - record the time
          audioEverStarted = true;
          audioState.audioStartTime = t;
        }
        
        if (!audioEverStarted || !hasValidAudioData) {
          // No valid audio data yet - use the palette's midpoint (see bug fix note below)
          energy = 0.5;
        } else {
          // We have valid audio data - start smooth transition
          const timeSinceStart = (t - audioState.audioStartTime) / 1000;
          // 🔧 FIX 1: Reduced 0.8s → 0.1s. This second fade-in was silently muting
          //    energy-driven reactivity (halo color, center graphic) for the first
          //    0.8 seconds of every track — identical to the beat delay we fixed earlier.
          const transitionDuration = 0.1;
          
          if (timeSinceStart < transitionDuration) {
            // Lerp from 0.5 (palette midpoint) to calculated energy
            const blend = timeSinceStart / transitionDuration;
            energy = 0.5 + (calculatedEnergy - 0.5) * blend;
          } else {
            energy = calculatedEnergy;
          }
        }
        
        lastEnergy = energy; // Store for pause freeze
      } else if (audioEverStarted) {
        // Audio paused - freeze at last energy value
        energy = lastEnergy;
      } else {
        // No audio loaded yet - default to the palette's midpoint (energy=0.5).
        // 🐛 BUG FIX: this was previously hardcoded to 1.0 (the gradient's endpoint),
        // on the assumption that energy=1.0 always means "Electric Blue" — true only
        // for the original default palette. For any palette whose gradient/last-stop
        // happens to land in yellow/orange, this made many differently-themed palettes
        // collapse to a near-identical yellow-ish appearance whenever idle (confirmed:
        // 11 of 40 palettes were affected). The midpoint is a far more representative
        // default for any palette's actual character.
        energy = 0.5;
      }
      
      let hueBase = hueFromPalette(energy);
      
      // 🌊 COLOR WAVE: Check if active (determines if we apply colorState.beatColorShift)
      const colorWaveActive = params.beatDetect && params.effectAmount > 0.01 && (params.beatPulseType === 'all' || params.beatPulseType === 'color');
      
      // 🎨 CRITICAL: When Color Wave is active, use hueBase WITHOUT colorState.beatColorShift!
      // Color Wave creates its own hue variations in the shader - colorState.beatColorShift would double-modify
      // When Color Wave is OFF, apply colorState.beatColorShift for mid-frequency reactive hue modulation
      const effectiveHue = colorWaveActive 
        ? hueBase  // Color Wave active: use pure base color from picker
        : (hueBase + colorState.beatColorShift) % 360; // Color Wave off: apply reactive modulation
      
      // 🎨 SATURATION BURST: Bass-reactive saturation BOOST pulse (replaces Corner Flash!)
      // Creates breathing color effect synchronized with bass (20-200Hz)
      let saturationMultiplier = 1.0; // Default: full saturation
      if (params.beatDetect && (params.beatPulseType === 'all' || params.beatPulseType === 'flash')) {
        // Map colorState.cornerFlashPulse (1.0 → 0) to saturation curve with effectAmount control
        // At pulse peak (1.0): BOOST saturation (amount controlled by effectAmount!)
        // At pulse end (0.0): Normal 100% saturation (baseline color)
        const breatheIntensity = colorState.cornerFlashPulse; // 1.0 at trigger, decays to 0
        const maxBoost = 0.4 + (params.effectAmount * 0.8); // 🔥 BOOSTED: 40%-120% boost range (was 30%-100%)
        saturationMultiplier = 1.0 + (breatheIntensity * maxBoost); // 1.4 → 2.2 (140% → 220% at max effectAmount!)
      }
      
      // 🚀 ENHANCED: Boost saturation & luminosity during hue oscillation for DRAMATIC visibility!
      const hueOscillateIntensity = Math.min(1.0, Math.abs(colorState.beatColorShift) / 120); // 0-1 based on shift amount
      const satBoost = hueOscillateIntensity * 0; // No sat boost - keep at 100% always
      const lumBoost = hueOscillateIntensity * 8; // +8% luminosity at peak shift
      
      const sat = Math.min(100, 100 * saturationMultiplier + satBoost); // Apply saturation breathing effect!
      const lumBase = Math.min(70, 62 + lumBoost); // Brighter during shifts!
      // WebGL Gamma is shader-owned. The former CPU pulse is evaluated only if
      // the Canvas2D spike compatibility fallback actually renders.
      let canvasFallbackGammaLum = lumBase;
      const lum = lumBase;
      
      // 🔥 BASE COLORS: Always use color picker values (effects applied separately in shader/canvas!)
      // Color Wave and Saturation Burst no longer modify base saturation/luminosity
      const effectiveSat = sat;
      const effectiveLum = lum;
      // colorWaveActive already defined above (line 7413)
      const satBurstActive = params.beatDetect && params.effectAmount > 0.01 && (params.beatPulseType === 'all' || params.beatPulseType === 'flash');

      const chaosAmt = params.chaos * 0.6;

      // Sprint 22N.C Stage 2: outer halo is now owned by the render pipeline.
      Object.assign(reusedOuterHaloOptions, {
        ctx,
        params,
        radius: RH,
        effectiveHue,
        saturation: sat,
        luminosity: lum,
        timeMs: schedulerMotionTimeMs,
        motionDeltaSeconds: dt,
        satBurstWavePhase,
        cometRadius,
        maxCometRadius,
        sceneRotation: angle,
        measureTimings: measureFrameTimings,
      });
      haloOwner.prepare(reusedOuterHaloOptions);
      renderPipeline.renderPass('halo', renderFrameState);
      if (measureFrameTimings) {
        frameCosts.haloMs = haloOwner.timings.haloMs;
        frameCosts.cometMs = haloOwner.timings.cometMs;
        frameCosts.orbitalMs = haloOwner.timings.orbitalMs;
      }

      // 🚀 WEBGL SPIKE RING - FREQUENCY-DOMAIN SPECTRUM ANALYZER
      const N = filteredFreqArr.length; // Use frequency bins, not time samples!
      
      // ⚡ PHASE 2 OPTIMIZATION: Rebuild lookup tables if spike count changed
      // 🐛 BUG FIX (Beta cleanup): lookupTablesSize was declared specifically to guard this
      // call ("Track current table size to know when to rebuild") but was never actually
      // used as a guard — rebuildSpikeLookupTables ran unconditionally every single frame,
      // allocating 3 fresh Float32Array(N) buffers and running a full N-iteration trig/hash
      // loop for data that's almost always identical to the previous frame (N only changes
      // when the user moves the FFT slider). Now only rebuilds when N actually changes.
      if (N !== spikeFeature.lookupTablesSize) {
        spikeFeature.ensureLookupTables(N);
      }
      
      const baseSpikeHeight = (R1 - R0) * 0.65;
      const maxAmp = baseSpikeHeight;
      
      // ========================================
      // FREQUENCY-DOMAIN PROCESSING - Direct FFT data (NO time-domain!)
      // ========================================
      
      if (spikeFeature.ampBuf.length !== N) {
        const oldBuf = spikeFeature.ampBuf;
        const oldPrevTargetBuf = spikeFeature.prevTargetBuf;
        const oldDisplayBuf = spikeFeature.spikeDisplayBuf;
        spikeFeature.spikeDisplayBuf = new Float32Array(N).fill(0);

        spikeFeature.ampBuf = new Float32Array(N).fill(0);
        spikeFeature.ampEcho1 = new Float32Array(N).fill(0);
        spikeFeature.ampEcho2 = new Float32Array(N).fill(0);
        spikeFeature.prevTargetBuf = new Float32Array(N).fill(0);
        spikeFeature.tempSmoothingBuf = new Float32Array(N);

      // Copy old spike state if possible
      for (let i = 0; i < N; i++) {
        const oldIdx = Math.floor((i / N) * oldBuf.length);

      if (oldIdx < oldBuf.length) {
      spikeFeature.ampBuf[i] = oldBuf[oldIdx];
      }

      if (oldIdx < oldPrevTargetBuf.length) {
        spikeFeature.prevTargetBuf[i] = oldPrevTargetBuf[oldIdx];
      }
    }
  }
      
      // PHASE 10C — Spike Signal Chain Separation + Anti-Ceiling Fix
      // Each control now has one dedicated lane:
      // - Frequency Smoothing: neighboring-bin averaging only
      // - Bass Boost: low-band contribution only
      // - Motion Intensity: dynamic range expansion only
      // - Beat Boost: transient/onset overlay only
      // - Motion Smoothing: temporal smoothing only
      processSpikeSignalChain(
        filteredFreqArr,
        {
          amp: spikeFeature.ampBuf,
          echo1: spikeFeature.ampEcho1,
          echo2: spikeFeature.ampEcho2,
          prevTarget: spikeFeature.prevTargetBuf,
          display: spikeFeature.spikeDisplayBuf,
          temp: spikeFeature.tempSmoothingBuf,
        },
        {
          motionIntensity: params.motionIntensity,
          motionSmoothing: params.motionSmoothing,
          bassBoost: params.bassBoost,
          frequencySmoothing: params.frequencySmoothing,
          beatReactivityBoost: params.beatReactivityBoost,
          beatDetect: params.beatDetect,
          spikeAttack: params.spikeAttack,
          transientBoost: params.transientBoost || 0,
        },
        {
          sampleRate: AC.sampleRate,
          dt,
          beatPulse: colorState.beatPulse,
          isBeat,
          visualEnvelope: visualBus.spikeEnvelope,
        }
      );
        

      // Phase 4.8F: removed D2 visual-state mirroring. Production renderer owns these accumulators.


      // ⚡ PHASE 2 OPTIMIZATION: Track spike rendering performance
      const spikeRenderStart = DEBUG_PERF ? performance.now() : 0;
      
      // Helper functions for dots/particles rendering
      // 🔧 MOTION FIX #4c: Use delta-accumulated motionState.spikeTimeAcc instead of
      //    performance.now() * 0.0015 — prevents float32 shimmer after ~30 seconds.
      const coreParticlesActive =
        !!params.shapeOscillate &&
        !params.astralShaper &&
        !!useWebGLCoreParticlesRef.current;

      let useEngineOwnedGL =
        CORE_PARTICLES_SANDBOX && coreParticlesActive;
      
      // ========================================
      // WEBGL SPIKE RENDERING - GPU-accelerated!
      // ========================================
      
      // ⚡ WEBGL ENHANCEMENT LAYER: Renders thick spike bars on top of Canvas2D baseline
      // Architecture: Canvas2D (zIndex 1) always renders thin spikes, WebGL (zIndex 2) overlays thick bars
      // This ensures spikes are ALWAYS visible (Canvas2D fallback), WebGL just enhances with thickness
      const legacyWebGLSpikeAllowed =
        !useEngineOwnedGL &&
        !!gl &&
        !!webglSpikeRenderer &&
        params.vizMode === 0 &&
        useWebGLRef.current;

      if (legacyWebGLSpikeAllowed && webglSpikeRenderer) {
        const gammaEnergyFlash =
          Math.max(isBeat ? 1 : 0, Math.min(1, colorState.beatPulse)) * 0.65 +
          Math.min(1, visualBus.spikeEnvelope || 0) * 0.35;
        Object.assign(reusedWebGLSpikeFrame, {
          source: spikeFeature.spikeDisplayBuf,
          sampleRate: AC.sampleRate,
          spikeCount: N,
          width: W,
          height: H,
          innerRadius: R0,
          outerRadius: R1,
          rotation: angle,
          mirror: params.mirror,
          spikeTightness: params.spikeTightness,
          zoom: motionState.zoomOscPhase > 0
            ? 1 + params.zoomOsc * Math.sin(motionState.zoomOscPhase * Math.PI * 2)
            : 1,
          chaosAmount: motionState.chaosSegmentEase,
          chaosTime,
          hue: effectiveHue,
          saturation: effectiveSat,
          lightness: effectiveLum,
          spectrum: Boolean(params.spectrum),
          colorWaveActive,
          colorWaveTime: colorWaveRotation,
          colorWaveAmount: params.effectAmount,
          bloom: params.spikeBloom,
          gamma: params.gamma,
          gammaFlash: gammaEnergyFlash,
          iridize: params.iridize,
          iridizeTime: schedulerMotionFrame.timeSeconds,
          beatPulse: colorState.beatPulse,
        });
        webglSpikeRenderer.render(reusedWebGLSpikeFrame);

        // Composite the already-rendered GPU layer once when spike bloom is active.
        if (params.spikeBloom > 0.01 && glCanvas) {
          const blurPx = params.spikeBloom * 22 * (1 + energy20_600 * 0.6);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.shadowBlur = blurPx;
          ctx.shadowColor = `hsl(${effectiveHue}, 100%, 65%)`;
          ctx.globalAlpha = 0.7 + params.spikeBloom * 0.3;
          ctx.drawImage(glCanvas, 0, 0, glCanvas.width, glCanvas.height, 0, 0, W, H);
          ctx.shadowBlur = 0;
          ctx.shadowColor = 'transparent';
          ctx.restore();
        }
      } else if (gl) {
        webglSpikeRenderer?.clear();
      }
      // PHASE 8: Only draw Canvas2D spike baseline when no GPU spike/core-particle engine owns the layer.
      // Previously core particles disabled legacy WebGL spikes but Canvas2D spikes could still draw,
      // causing overlapped ring systems and a smeared/fighting visual response.
      const webglSpikeActive = !!legacyWebGLSpikeAllowed;
      const canvas2DSpikeBaselineActive = params.vizMode === 0 && (!webglSpikeActive || useEngineOwnedGL);

      if (canvas2DSpikeBaselineActive) {
        const fallbackGamma = params.gamma * params.gamma;
        const fallbackGammaPulse = 1 + fallbackGamma * 0.15 * Math.sin(t * 3.5);
        canvasFallbackGammaLum = Math.min(88, lumBase * fallbackGammaPulse);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        drawSpikes(spikeFeature.spikeDisplayBuf, 1.0, 0.9, 0);

        // Iridize is already a shader-owned effect on the GPU path. On the Canvas2D
        // fallback, do not draw two extra full spike rings: that triples main-thread
        // path work at high FFT sizes and can starve the Web Audio callback.

        ctx.restore();
      }
      
      // ⚡ PHASE 2 OPTIMIZATION: Log spike render time every 5 seconds
      if (DEBUG_PERF && t % 5000 < 16) {
        const spikeRenderTime = performance.now() - spikeRenderStart;
        if (DEBUG_FLAGS.GENERAL) console.log(`⚡ WebGL Spike render: ${spikeRenderTime.toFixed(2)}ms (${N} spikes)`);
      }
      
      function drawSpikes(buf: Float32Array, alphaScale: number, ampScale: number, hueShift: number) {
        renderCanvasSpikeRing({
          ctx,
          params,
          buf,
          sampleRate: AC.sampleRate,
          innerRadius: R0,
          outerRadius: R1,
          spikeCosTable: spikeFeature.spikeCosTable,
          spikeSinTable: spikeFeature.spikeSinTable,
          effectiveHue,
          saturation: sat,
          luminance: lum,
          canvasFallbackGammaLum,
          spikeTimeAcc: motionState.spikeTimeAcc,
          beatPulse: colorState.beatPulse,
          colorWaveRotation,
          colorWaveLUT,
          colorWaveSamples: COLOR_WAVE_SAMPLES,
          zoomOscPhase: motionState.zoomOscPhase,
          chaosSegmentOffset,
          alphaScale,
          ampScale,
          hueShift,
        });
      }

      Object.assign(reusedDotRingOptions, {
        ctx,
        params,
        R0,
        haloR,
        dt,
        energy60_150,
        energy150_250,
        energy20_160,
        timeMs: t,
        bpmValue: parseFloat(cachedBpmEl?.value || '174'),
        zoomOscPhase: motionState.zoomOscPhase,
        chaosSegmentOffset,
        effectiveHue,
        sat,
        lum,
        colorWaveRotation,
        colorWaveLUT,
        colorWaveSamples: COLOR_WAVE_SAMPLES,
        satBurstWavePhase,
        cornerFlashPulse: colorState.cornerFlashPulse,
        beatPulse: colorState.beatPulse,
        spikeTimeAcc: motionState.spikeTimeAcc,
      });
      dotOwner.prepare(reusedDotRingOptions);
      renderPipeline.renderPass('dots', renderFrameState);
      frameCosts.dotsMs = renderFrameState.passCosts.dots ?? 0;

      // PHASE 1: Glowing Center + shared Spark emitter geometry.
      // The emitter shell is calculated even when Center Glow is disabled so
      // Spark Impact always has one coherent, non-zero center source.
      updateCenterEmitterGeometry(centerEmitterGeometry, {
        minSide,
        energy,
        coreRadius: R0,
      });
      const centerGlowOptions = centerMediaFeature.prepareGlow({
        ctx,
        params,
        minSide,
        energy,
        hueBase,
        geometry: centerEmitterGeometry,
        burstImpulse: sparkCometRuntime.centerBurstImpulse,
      });
      renderCenterGlow(centerGlowOptions);
      
      // LIQUID SHAPER: Restore render path (kept compact to avoid App.tsx bloat)
      if (params.astralShaper) {
        const liquidShaperStartedAt = measureFrameTimings ? performance.now() : 0;
        const liquidRms = energy20_8000;
        // Peak = max of pre-computed band energies (already 0-1, no FFT scan needed).
        // Avoids iterating all 1024 energyFreqArr bins every frame.
        const liquidPeak = Math.max(energy20_600, energy600_1600, energy1600_8000);
        const liquidAudio = liquidShaperFeature.prepareAudio({
          rms: liquidRms,
          peak: liquidPeak,
          bass: energy20_600,
          mid: energy600_1600,
          high: energy1600_8000,
          beatPulse: colorState.beatPulse,
          isBeat: colorState.beatPulse > 0.5,
        });
        const liquidParams = liquidShaperFeature.prepareParams({
          enabled: true,
          shape: params.astralShape,
          nextShape: nextShape || params.astralShape,
          morphAmount: astralSmoothedMorphAmount ?? params.astralMorphAmount,
          morphMode: params.astralMorphMode,
          morphOrigin: params.astralMorphOrigin,
          fieldModulation: params.astralFieldModulation,
          autoCycle: params.astralAutoCycle,
          cycleSpeed: params.astralCycleSpeed,
          audioInfluence: params.astralAudioInfluence,
          pulseDepth: params.astralPulseDepth,
          energyGlow: params.astralEnergyGlow,
          rotationMultiplier: params.astralRotationMult,
          rotationSpeedMod: params.astralRotationSpeedMod,
          rotationJitter: params.astralRotationJitter,
          complexity: params.astralComplexity,
          lineThickness: params.astralLineThickness,
          strokeStyle: params.astralStrokeStyle,
          scale: params.astralScale,
          symmetryFold: params.astralSymmetryFold,
          depthEffect: params.astralDepthEffect,
          kaleidoscope: params.astralKaleidoscope,
          rainbowSpectrum: params.astralRainbowSpectrum,
          useGlobalColor: params.astralUseGlobalColor,
          customColor: params.astralCustomColor,
          maxSize: r0 * 0.95,
        });
        drawAstralShaper(
          ctx,
          0,
          0,
          liquidParams as any,
          liquidAudio,
          angle,
          [
            `hsl(${hueBase}, 100%, 62%)`,
            `hsl(${(hueBase + 35) % 360}, 100%, 62%)`,
            `hsl(${(hueBase + 70) % 360}, 100%, 62%)`
          ],
          t * 0.001
        );
        frameCosts.liquidShaperMs = measureFrameTimings ? measureElapsed(liquidShaperStartedAt) : 0;
      }

      // 🎨 LAYER CACHING: Liquid Shaper Pre-rendering (+3-5 fps when enabled)
      // Strategy: Cache static geometry, only redraw when parameters change
      // NOTE: Audio-reactive elements (pulsing) are composited separately
      
      // LIQUID SHAPER: WebGL Sacred Geometry Rendering
      // PHASE 2: Shockwave Rings (Enhanced with Beat Detection & Frequency Band Integration)
      // ✅ FIX: Always show when enabled (no dependency on center image!)
      if (params.shockwave) {
        // HIGH PRIORITY #2: FREQUENCY BAND RESPECT - Use selected frequency band for trigger source
        let triggerEnergy = 0;
        if (params.frequencyBand === 'bass') {
          triggerEnergy = energy20_600; // Extended bass range - FFT-INDEPENDENT
        } else if (params.frequencyBand === 'mid') {
          triggerEnergy = energy600_1600; // Mid frequencies - FFT-INDEPENDENT
        } else if (params.frequencyBand === 'high') {
          triggerEnergy = energy1600_8000; // High frequencies - FFT-INDEPENDENT
        } else {
          // Full spectrum - weighted combination - FFT-INDEPENDENT
          const bassEnergy = energy20_600;
          const midEnergy = energy600_1600;
          const highEnergy = energy1600_8000;
          triggerEnergy = bassEnergy * 0.6 + midEnergy * 0.3 + highEnergy * 0.1;
        }
        
        // 🔧 FIX 8d: Use cachedBpmSyncEl instead of getElementById every frame
        const bpmSyncEnabled = cachedBpmSyncEl?.checked || false;
        
        // HIGH PRIORITY #1: BEAT DETECTION INTEGRATION - Use auto beat detection when enabled
        if (params.beatDetect && colorState.beatPulse === 1.0) {
          // Trigger on detected beat (prevent duplicates with 100ms cooldown)
          const now = t;
          if (now - lastBeatShockwaveTime > 100) {
            lastBeatShockwaveTime = now;
            // MEDIUM PRIORITY #1: Spawn rings using helper function
            spawnShockwaveRings(1.0, R0, RH); // Base alpha 1.0 for beat-triggered
          }
        }
        // BPM-synced mode (HALF SPEED)
        else if (bpmSyncEnabled) {
          // 🔧 FIX 8e: Use cachedBpmInputEl / cachedBarsEl instead of getElementById every frame
          const bpm = parseFloat(cachedBpmInputEl?.value || "174");
          const bars = parseInt(cachedBarsEl?.value || "8", 10);
          
          bpmShockwaveTimer += dt;
          
          // Trigger shockwave at HALF the BPM rate
          const beatInterval = (60.0 / bpm) * 2; // DOUBLED interval = HALF speed
          if (bpmShockwaveTimer >= beatInterval) {
            bpmShockwaveTimer = 0;
            // MEDIUM PRIORITY #1: Spawn rings using helper function
            spawnShockwaveRings(0.75, R0, RH); // Base alpha 0.75 for BPM sync
          }
        } 
        // Frequency-reactive mode (HIGHLY REACTIVE - when BPM sync and Beat Detect are OFF)
        else {
          // BUGFIX: Improved threshold logic with better reactivity
          // Threshold slider: 0 = constant triggers, 0.5 = medium sensitivity, 2 = only strong hits
          
          if (params.shockwaveThreshold <= 0.05) {
            // Threshold at 0: CONSTANT TRIGGERS (every frame with audio)
            if (triggerEnergy > 0.01) {
              const energyBoost = 0.9 + triggerEnergy * 0.6;
              spawnShockwaveRings(energyBoost, R0, RH);
            }
          } else {
            // Normal mode: Rising edge detection with MORE SENSITIVE threshold
            // Lower the multiplier for more frequent triggers
            const adjustedThreshold = params.shockwaveThreshold * 0.08; // Reduced from 0.125 for more reactivity
            
            // More relaxed rising edge: 90% -> 85% for more triggers
            if (triggerEnergy > adjustedThreshold && colorState.lastBassEnergy < adjustedThreshold * 0.85) {
              const energyBoost = 0.9 + triggerEnergy * 0.6;
              spawnShockwaveRings(energyBoost, R0, RH);
            }
          }
        }
        colorState.lastBassEnergy = triggerEnergy;
        
        // 🚀 TIER 1 FIX: Process pending shockwaves with circular buffer (ZERO allocations!)
        shockwaveRuntime.processPending(dt);
        
        // Sprint 22G: Shockwave pool drawing moved to canvasLayerRenderer.
        Object.assign(reusedShockwaveOptions, {
          ctx,
          pool: shockwavePool,
          maxShockwaves: MAX_SHOCKWAVES,
          dt,
          speed: params.shockwaveSpeed,
          decay: params.shockwaveDecay,
          hue: hueBase,
        });
        const shockwaveStartedAt = measureFrameTimings ? performance.now() : 0;
        renderShockwaves(reusedShockwaveOptions);
        if (measureFrameTimings) {
          frameCosts.shockwaveMs = performance.now() - shockwaveStartedAt;
        }
      }
      
      // IMPACT SPARKS: modern pooled micro-comets driven by a fast composite onset signal.
      const sparkImpactEnabled = params.beatDetect && (params.beatPulseType === 'spark' || params.beatPulseType === 'all');
      if (sparkImpactEnabled) {
        // Spark onset history is owned entirely by SparkCometRuntime. It must not
        // depend on Shockwave's colorState.lastBassEnergy or any other effect's state.
        const bandEnergy = params.frequencyBand === 'bass'
          ? energy20_600
          : params.frequencyBand === 'mid'
            ? energy600_1600
            : params.frequencyBand === 'high'
              ? energy1600_8000
              : energy20_600 * 0.42 + energy600_1600 * 0.30 + energy1600_8000 * 0.28;
        const sparkImpact = clamp(bandEnergy * 0.58 + colorState.beatPulse * 0.52, 0, 1);
        const sparkFrame = {
          dt,
          width: W,
          height: H,
          originRadius: R0,
          emitterRadius: centerEmitterGeometry.emitterRadius,
          emitterBand: centerEmitterGeometry.emitterBand,
          hue: effectiveHue,
          impact: sparkImpact,
          amps: params.sparkAmps || 0,
          trail: params.sparkTrail || 0,
          density: params.sparkDensity || 0.5,
          dispersion: params.sparkDispersion ?? 0.45,
          bassEnergy: energy20_600,
          highEnergy: energy1600_8000,
          beatPulse: colorState.beatPulse,
          frameTimeMs: framePacing.avgFrameInterval,
        };
        sparkCometRuntime.update(sparkFrame);
        sparkCometRuntime.render(ctx, sparkFrame, angle);
      } else {
        sparkCometRuntime.reset();
      }

      // ========================================
// STEREO ANALYSIS FOR CORE PARTICLES
// ========================================
// Phase 4.8D.3: when Core Particles are worker-owned, expensive dual time-domain
// analyser readback is sampled at 20 Hz instead of every visual frame. The worker
// owns continuous motion between samples; the main renderer remains free for UI/scroll.
const leftAnalyser = leftAnalyserRef.current;
const rightAnalyser = rightAnalyserRef.current;
const leftTimeData = leftTimeDataRef.current;
const rightTimeData = rightTimeDataRef.current;
const shouldSampleCoreParticleStereo = t >= coreParticleFeature.nextStereoSampleAt;

if (
  coreParticlesActive &&
  shouldSampleCoreParticleStereo &&
  leftAnalyser &&
  rightAnalyser &&
  leftTimeData &&
  rightTimeData
) {
  leftAnalyser.getFloatTimeDomainData(leftTimeData);
  rightAnalyser.getFloatTimeDomainData(rightTimeData);

  let leftAbsSum = 0;
  let rightAbsSum = 0;
  let diffAbsSum = 0;
  const n = Math.min(leftTimeData.length, rightTimeData.length);

  for (let i = 0; i < n; i++) {
    const l = leftTimeData[i];
    const r = rightTimeData[i];
    leftAbsSum += Math.abs(l);
    rightAbsSum += Math.abs(r);
    diffAbsSum += Math.abs(l - r);
  }

  const leftAvg = leftAbsSum / Math.max(1, n);
  const rightAvg = rightAbsSum / Math.max(1, n);
  const total = leftAvg + rightAvg + 1e-6;
  const rawPan = (rightAvg - leftAvg) / total;
  const rawWidth = Math.min(1, (diffAbsSum / Math.max(1, n)) * 2.4);
  coreParticleFeature.stereoPanSample = Math.max(-1, Math.min(1, rawPan * 6.0));
  coreParticleFeature.stereoWidthSample = Math.max(0, Math.min(1, 0.18 + rawWidth * 2.2));
  // Stereo spatialization is perceptually smooth at 30 Hz and is independently
  // damped below. Avoid two analyser reads + a full sample scan every visual frame.
  coreParticleFeature.nextStereoSampleAt = t + 33;
}

      stereoPanRef.current += (coreParticleFeature.stereoPanSample - stereoPanRef.current) * 0.18;
      stereoWidthRef.current += (coreParticleFeature.stereoWidthSample - stereoWidthRef.current) * 0.18;


      frameCosts.canvas2DMs = phase7CanvasStart > 0 ? measureElapsed(phase7CanvasStart) : 0;

      // Phase 4.3: Core Particles initialize their WebGL2 renderer only on first enable.
      // A successful GPU frame is the sole authority; any init/context/render failure
      // flips this frame back to the untouched Canvas2D compatibility implementation.
      if (useEngineOwnedGL) {
        const coreParticlesGpu = ensureCoreParticlesGpuRenderer();
        if (!coreParticlesGpu) {
          useEngineOwnedGL = false;
        } else {
        // Merge routed and low-latency lanes so GPU motion lands on the current beat.
        const totalEnergyForWebGL = Math.max(
          visualBus.coreParticles,
          visualAudioFrame.energy * 0.82,
          visualAudioFrame.transient * 0.54,
        );
        const audioActive = totalEnergyForWebGL > 0.012;
        
  const phase7WebGLStart = measureFrameTimings ? performance.now() : 0;
  reusedWebglEngineRenderOptions.resolution = reusedWebglEngineRenderOptions.resolution || {};
  reusedWebglEngineRenderOptions.resolution.w = W;
  reusedWebglEngineRenderOptions.resolution.h = H;
  reusedWebglEngineRenderOptions.resolution.dpr = DPR;
  reusedWebglEngineRenderOptions.params = reusedWebglEngineRenderOptions.params || {};
  const gpuParams = reusedWebglEngineRenderOptions.params;
  gpuParams.coreParticlesEnabled = coreParticlesActive;
  gpuParams.coreParticlesIntensity = params.shapeEdgeTrails ?? 0.5;
  gpuParams.coreParticlesSpread = params.shapeDistortion ?? 0.30;
  gpuParams.coreParticlesChaos = params.shapeTurbulence ?? 0.0;
  gpuParams.coreParticlesPulse = params.shapeDecay ?? 0.0;
  gpuParams.coreParticlesEdgeFallback = params.shapeOrbitDrift ?? 0.35;
  gpuParams.coreParticlesShapeMode = params.coreParticlesShapeMode ?? 'dot';
  gpuParams.coreParticlesDensity = params.shapeDensity ?? 0.65;
  gpuParams.coreParticleBurstStrength = params.shapeBurstStrength ?? 0.20;
  gpuParams.coreParticleImpulse = coreParticleImpulseFrame.impulse;
  gpuParams.coreParticleBass = coreParticleImpulseFrame.bass;
  gpuParams.coreParticleMid = coreParticleImpulseFrame.mid;
  gpuParams.coreParticleHigh = coreParticleImpulseFrame.high;
  gpuParams.transient = visualAudioFrame.transient;
  gpuParams.motionSmoothing = params.motionSmoothing;
  gpuParams.effectiveHue = effectiveHue;
  gpuParams.satNorm = Math.min(1, sat / 100);
  gpuParams.spectrum = params.spectrum;
  gpuParams.rotationAngle = angle;
  gpuParams.stereoPan = stereoPanRef.current;
  gpuParams.stereoWidth = stereoWidthRef.current;
  gpuParams.vectorAmount = 0.14;
  gpuParams.energyGateSmoother = params.energyGate ? colorState.energyGateSmoother : 1;
  reusedWebglEngineRenderOptions.timeSec = t * 0.001;
  reusedWebglEngineRenderOptions.dtSec = dt || 1 / 60;
  // Scroll/drag stalls are main-thread presentation pressure, not Core Particle GPU
  // pressure. Do not let those transient gaps force the particle governor through
  // quality tiers and create visible size/density snapping after interaction.
  reusedWebglEngineRenderOptions.frameIntervalMs = uiInteractionRuntime.isActive
    ? Math.min(framePacing.frameInterval, 20)
    : framePacing.frameInterval;
  reusedWebglEngineRenderOptions.beatPulse = audioActive ? (colorState.beatPulse || 0) : 0;
  reusedWebglEngineRenderOptions.audioEnergy = audioActive ? totalEnergyForWebGL : 0;
        try {
          const gpuFrameRendered = coreParticlesGpu.render(reusedWebglEngineRenderOptions);
          frameCosts.webglMs = measureFrameTimings ? measureElapsed(phase7WebGLStart) : 0;
          frameCosts.coreParticlesMs = frameCosts.webglMs;
          if (!gpuFrameRendered) useEngineOwnedGL = false;
          // Throttle Figma diagnostics to avoid a per-frame allocation.
          if ((DEVELOPMENT_DIAGNOSTICS_ENABLED || FIELD_CERTIFICATION_ENABLED) && t >= coreParticleFeature.nextGpuDiagnosticAt) {
            (window as any).__ORBITAL_CORE_PARTICLES_GPU__ = coreParticlesGpu.getDiagnostics();
            coreParticleFeature.nextGpuDiagnosticAt = t + 500;
          }
        } catch (error) {
          disableCoreParticlesGpuRenderer(error);
          useEngineOwnedGL = false;
        }
        }
      } else {
        // One clear/hide on disable; no recurring inactive WebGL clears.
        webglEngineRef.current?.suspend();
      }
      
      // SHAPE OSCILLATE - TRUE VECTORSCOPE PARTICLE SYSTEM (Audio-Reactive Particle Cloud)
      // PLACED INSIDE MAIN TRANSFORM BLOCK - inherits translate(cx,cy) and angle rotation from parent
      // Disabled when Liquid Shaper is enabled (mutual exclusion via Macro 7/8)
      // Center image auto-hides when Core Particles is enabled
      if (params.shapeOscillate && !params.astralShaper && !useEngineOwnedGL) {
        // Always use full spectrum for particles (unaffected by frequency band selection)
        let shapeFreqData = freqArr;
        
        // Calculate energy from frequency bands
        const bassEnergy = avg(shapeFreqData, 0, 32) / 255;
        const midEnergy = avg(shapeFreqData, 32, 128) / 255;
        const highEnergy = avg(shapeFreqData, 128, 256) / 255;
        const totalEnergy = (bassEnergy * 0.5 + midEnergy * 0.3 + highEnergy * 0.1);
        
        // Silence damps reactivity, but enabled Core Particles retain a visible floor.
        const audioActive = totalEnergy > 0.015;

        if (audioActive || params.shapeOscillate) {
          
          const intensityControl = clamp01(params.shapeEdgeTrails);
          const intensity = resolveCoreParticleIntensity(intensityControl);
          const visualEnergy = resolveCoreParticleVisualEnergy(intensityControl);
          const diameterGain = resolveCoreParticleDiameterGain(intensityControl);
          const presenceGain = audioActive ? 1 : 0.42;
          const coreParticleResponse = computeCoreParticleReactivity({
            bass: energy20_160, mid: energy150_250, high: energy1600_8000,
            transient: visualBus.transient, beat: colorState.beatPulse || 0,
            coreParticleBass: bassEnergy, coreParticleMid: midEnergy, coreParticleHigh: highEnergy,
            chaos: params.shapeTurbulence, spread: params.shapeDistortion,
          });
          const spread = coreParticleResponse.spread; // stable area coverage
          const reactivity = Math.min(1, params.shapeTurbulence * 0.58 + coreParticleResponse.radialImpulse * 0.42);
          
          // BETTER HASH: Cryptographic-quality randomization (no correlation patterns!)
          const betterHash = (seed: number): number => {
            const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
            return x - Math.floor(x); // Returns 0.0 to 1.0
          };
          
          // ✨ PHASE 1a: Initialize particle pool once (only on first frame)
          if (!coreParticleFeature.initialized) {
            for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
              const randomAngle = betterHash(i * 7919.234) * Math.PI * 2;
              // 🚨 FIX: Use LOWER exponent for CENTER clustering (was 0.85 - too high!)
              // Exponent 2.5 = particles cluster heavily in center, avoid ring formation
              const randomRadiusFactor = Math.pow(betterHash(i * 13579.246), 2.5);
              
              // Pre-calculate frequency zone assignment
              const zoneRand = betterHash(i * 3141.592);
              const freqZones = [
                { start: 0, end: 64, weight: 0.35, ampBoost: 1.0 },
                { start: 64, end: 192, weight: 0.40, ampBoost: 1.1 },
                { start: 192, end: 384, weight: 0.15, ampBoost: 2.0 },
                { start: 384, end: 512, weight: 0.10, ampBoost: 3.0 }
              ];
              
              let freqZoneIndex = 0;
              let cumulativeWeight = 0;
              for (let z = 0; z < freqZones.length; z++) {
                cumulativeWeight += freqZones[z].weight;
                if (zoneRand < cumulativeWeight) {
                  freqZoneIndex = z;
                  break;
                }
              }
              
              const zone = freqZones[freqZoneIndex];
              const zonePhase = betterHash(i * 19123.555);
              const freqIdx = Math.floor(zone.start + zonePhase * (zone.end - zone.start));
              
              // Pre-calculate chaos random values
              const chaosRandX = betterHash(i * 91234.111) * 2 - 1;
              const chaosRandY = betterHash(i * 67890.222) * 2 - 1;
              
              // ⚡ Pre-calculate jitter random values (performance fix!)
              const jitterRandX = betterHash(i * 45678.333) * 2 - 1;
              const jitterRandY = betterHash(i * 98765.444) * 2 - 1;
              
              const sampleIdx = Math.floor(betterHash(i * 24691.135) * timeArr.length);
              const sampleOffset = 8 + Math.floor(betterHash(i * 54321.777) * 72);
              const depth = 0.25 + betterHash(i * 1357.999) * 0.75;
              // 🔧 FIX 7b: Per-particle phase and pulse delay.
              //    phaseOffset: each particle has its own sin() phase → ripple effect.
              //    pulseDelay: outer particles react slightly after inner ones →
              //    creates the outward torus ripple flow rather than uniform mass pulse.
              const phaseOffset = betterHash(i * 77391.251) * Math.PI * 2;
              const pulseDelay = (randomRadiusFactor * 0.4); // 0 at center, 0.4 at edge

              particlePool.push({
                angle: randomAngle,
                radiusFactor: randomRadiusFactor,
                freqZoneIndex,
                freqIdx,
                chaosRandX,
                chaosRandY,
                jitterRandX,
                jitterRandY,
                id: i,

                sampleIdx,
                sampleOffset,
                depth,
                x: Math.cos(randomAngle) * (R0 * 0.08 * randomRadiusFactor),
                y: Math.sin(randomAngle) * (R0 * 0.08 * randomRadiusFactor),
                vx: 0,
                vy: 0,
                phaseOffset,
                pulseDelay
              });
            }
            coreParticleFeature.initialized = true;
            
          }
          
          ctx.save();
          ctx.rotate(-angle); // Cancel parent rotation
          
          ctx.globalCompositeOperation = "lighter";
          
          // ✨ PHASE 1a: ADAPTIVE PARTICLE DENSITY based on performance
          // Reduce particle count when FPS drops (15-20% performance gain)
          const adaptiveParticleCount = Math.floor(PARTICLE_POOL_SIZE * Math.max(0.40, performanceQuality));
          
          // BEAT BURST
          const coreParticleLowMid = energy150_250;
          const coreParticleHighMid = energy500_2000;
          const coreParticleEnergyBoost = (coreParticleLowMid * 0.40 + coreParticleHighMid * 0.60);

          const particleSmoothing = params.motionSmoothing;
          const pulseAmount = params.shapeDecay; // reuse existing slider
          const pulseTransient = Math.max(0, coreParticleEnergyBoost - coreParticleFeature.previousEnergy * 0.92);
          coreParticleFeature.previousEnergy = coreParticleEnergyBoost;

          const pulseDrive = clamp01(
            coreParticleEnergyBoost * (1.15 + params.motionIntensity * 0.52) +
            pulseTransient * (1.15 + pulseAmount * 1.00) +
            (params.beatDetect ? colorState.beatPulse * 0.50 : 0)
          );

          // 🔥 EXPONENTIAL SMOOTHING: Dramatic smoothness difference across slider range
          // smoothing 0.0 → 0.50 attack, 0.20 release (SNAPPY - instant response)
          // smoothing 0.5 → 0.29 attack, 0.10 release (balanced)
          // smoothing 1.0 → 0.08 attack, 0.04 release (BUTTER - cinematic flow)
          const smoothCurve = Math.pow(particleSmoothing, 0.7); // Softer exponential curve
          const pulseAttack = 0.50 - smoothCurve * 0.42;  // Range: 0.50 → 0.08
          const pulseRelease = 0.20 - smoothCurve * 0.16; // Range: 0.20 → 0.04

          if (pulseDrive > coreParticleFeature.pulseValue) {
            coreParticleFeature.pulseValue += (pulseDrive - coreParticleFeature.pulseValue) * pulseAttack;
          } else {
            coreParticleFeature.pulseValue += (pulseDrive - coreParticleFeature.pulseValue) * pulseRelease;
          }

          coreParticleFeature.globalRadiusMultiplier =
            0.92 +
            coreParticleFeature.pulseValue * (0.35 + pulseAmount * 0.65 + params.motionIntensity * 0.15);
          
          // DIVIDE FREQUENCY SPECTRUM INTO 4 ZONES - EXPANDED TO 0-12kHz (bins 0-512)
          // Rebalanced weights to match music energy distribution (bass/mid-heavy)
          const freqZones = [
            { start: 0, end: 64, weight: 0.35, ampBoost: 1.0 },      // Bass (0-1.5kHz) - 35% - 168 particles
            { start: 64, end: 192, weight: 0.40, ampBoost: 1.1 },    // Low-mid (1.5-4.5kHz) - 40% - 192 particles
            { start: 192, end: 384, weight: 0.15, ampBoost: 2.0 },   // High-mid (4.5-9kHz) - 15% - 72 particles
            { start: 384, end: 512, weight: 0.10, ampBoost: 3.0 }    // Highs (9-12kHz) - 10% - 48 particles
          ];
          
          // ✨ PHASE 1a: USE PARTICLE POOL - Pre-calculated values (massive performance boost!)
          // TRUE VECTORSCOPE: Random particle cloud distribution!
          for (let i = 0; i < adaptiveParticleCount; i++) {
            const particle = particlePool[i]; // Reuse pre-calculated particle data
            
            // Get pre-calculated values from pool
            const randomAngle = particle.angle;
            const randomRadiusFactor = particle.radiusFactor;
            const freqZone = freqZones[particle.freqZoneIndex];
            const freqIdx = particle.freqIdx;
            
            let rawAudio = (shapeFreqData[freqIdx] || 0) / 255;
            rawAudio = Math.min(1.0, rawAudio * freqZone.ampBoost * 2.0);

            const sampleA = ((timeArr[particle.sampleIdx % timeArr.length] ?? 128) - 128) / 128;
            const sampleB = ((timeArr[(particle.sampleIdx + particle.sampleOffset) % timeArr.length] ?? 128) - 128) / 128;

            // Pseudo-vectorscope energy from time-domain plotting
            const waveformMag = Math.min(1, Math.hypot(sampleA, sampleB) * 1.35);

            // More aggressive response when reactivity is high
            const reactivityExponent = 1.5 - reactivity * 1.3;
            const processedAudio = Math.pow(rawAudio, reactivityExponent);

            // Reduce always-on look
            const visibleAudio = clamp01((processedAudio - 0.03) / 0.97);
            const finalAudioValue = clamp01(visibleAudio * 0.82 + waveformMag * 0.70);

            // Tighter cloud: much less foreground spread
            const spreadCurve = Math.pow(spread, 0.92);

            // Base field should already have some room at 0
            const baseAreaSize = R0 * 0.12;

            // Max spread should be about 3x the base size, but still stay inside the inner core ring
            const maxAreaSize = baseAreaSize * 3.0;

            // Pulse should not radically alter spread
            const pulseSpreadBoost = 1.0 + coreParticleFeature.pulseValue * 0.06;

            const areaSize = (baseAreaSize + spreadCurve * (maxAreaSize - baseAreaSize)) * pulseSpreadBoost;

            // Keep overall plotted scale modest and centered
            const scopeScale = areaSize * (0.94 + coreParticleFeature.pulseValue * 0.08);

            // Controlled audio-driven chaos
            let chaosX = 0;
            let chaosY = 0;

            if (reactivity > 0.01) {
              const audioDrivenChaos = Math.pow(Math.max(0, finalAudioValue - 0.06) / 0.94, 1.25);
              const pulseDrivenChaos = Math.pow(coreParticleFeature.pulseValue, 0.7);
              const chaosDrive = Math.pow(reactivity, 1.0) * (audioDrivenChaos * 0.90 + pulseDrivenChaos * 0.55);

              const chaosScale = chaosDrive * R0 * 0.080;

              chaosX = particle.chaosRandX * chaosScale;
              chaosY = particle.chaosRandY * chaosScale;

              if (reactivity > 0.48 && audioDrivenChaos > 0.06) {
                const jitterIntensity = (reactivity - 0.48) / 0.52;
                const jitterScale = R0 * 0.24 * jitterIntensity * (audioDrivenChaos + pulseDrivenChaos);
                chaosX += particle.jitterRandX * jitterScale;
                chaosY += particle.jitterRandY * jitterScale;
              }
            }

            const burstAmount = coreParticleFeature.pulseValue * (0.22 + pulseColorAmount * 0.28);

            let targetX =
              sampleA * scopeScale +
              chaosX * 0.34 +
              Math.cos(randomAngle) * particle.depth * areaSize * (0.12 + burstAmount * 0.26);

            let targetY =
              sampleB * scopeScale +
              chaosY * 0.34 +
              Math.sin(randomAngle) * particle.depth * areaSize * (0.12 + burstAmount * 0.26);

            // Soft dead-zone push so particles don't collapse into one white core
            const centerDist = Math.hypot(targetX, targetY);
            const deadZone = areaSize * 0.12;

            if (centerDist < deadZone) {
              const push = (deadZone - centerDist) / deadZone;
              const nx = centerDist > 0.0001 ? targetX / centerDist : Math.cos(randomAngle);
              const ny = centerDist > 0.0001 ? targetY / centerDist : Math.sin(randomAngle);

              targetX += nx * push * areaSize * 0.14;
              targetY += ny * push * areaSize * 0.14;
            }

            // Hard containment clamp: never let particles leave the core field
            const maxTargetRadius = areaSize * 1.44;
            const targetRadius = Math.hypot(targetX, targetY);

            if (targetRadius > maxTargetRadius) {
              const clampScale = maxTargetRadius / Math.max(targetRadius, 0.0001);
              targetX *= clampScale;
              targetY *= clampScale;
            }
            
            // 🔥 AUTONOMOUS EDGE FALLBACK: Particle flow (center → edges → return)
            // Controlled by Edge Fallback slider (0-1): continuous torus motion + opacity fadeout
            
            const edgeRatio = targetRadius / Math.max(maxTargetRadius, 0.0001);
            
            if (params.shapeOrbitDrift > 0.01) {
              const edgeDistance = 1.0 - edgeRatio;
              
              // Activate fallback in outer 40% of radius
              if (edgeDistance < 0.4) {
                const fallbackStrength = (0.4 - edgeDistance) / 0.4;
                const userControl = params.shapeOrbitDrift;
                
                // Calculate unit vectors for torus motion
                const inwardX = -targetX / Math.max(targetRadius, 0.0001);
                const inwardY = -targetY / Math.max(targetRadius, 0.0001);
                const swirlX = -inwardY;
                const swirlY = inwardX;
                
                // Autonomous inward pull (quadratic acceleration)
                const inwardPull = Math.pow(fallbackStrength, 1.5) * userControl;
                const inwardForce = areaSize * inwardPull * 120 * dt;
                targetX += inwardX * inwardForce;
                targetY += inwardY * inwardForce;
                
                // Toroidal swirl (circular motion)
                const swirlPull = fallbackStrength * userControl;
                const swirlForce = areaSize * swirlPull * 80 * dt;
                targetX += swirlX * swirlForce;
                targetY += swirlY * swirlForce;
              }
            }

            // Motion memory / inertia
            const spring = 0.12 + reactivity * 0.16 + intensity * 0.06;
            const damping = 0.78 - reactivity * 0.02;

            particle.vx += (targetX - particle.x) * spring;
            particle.vy += (targetY - particle.y) * spring;
            particle.vx *= damping;
            particle.vy *= damping;

            const maxVelocity = areaSize * 0.18;
            particle.vx = Math.max(-maxVelocity, Math.min(maxVelocity, particle.vx));
            particle.vy = Math.max(-maxVelocity, Math.min(maxVelocity, particle.vy));
            
            particle.x += particle.vx;
            particle.y += particle.vy;

            const maxLiveRadius = areaSize * 1.42;
            const liveRadius = Math.hypot(particle.x, particle.y);

            if (liveRadius > maxLiveRadius) {
              const liveClamp = maxLiveRadius / Math.max(liveRadius, 0.0001);
              particle.x *= liveClamp;
              particle.y *= liveClamp;

              // Stronger edge fallback return instead of weak deadening
              particle.vx *= 0.42;
              particle.vy *= 0.42;

              const nx = particle.x / Math.max(liveRadius, 0.0001);
              const ny = particle.y / Math.max(liveRadius, 0.0001);

              particle.vx -= nx * areaSize * 0.045;
              particle.vy -= ny * areaSize * 0.045;
            }

            const x = particle.x;
            const y = particle.y;

            // 🔧 FIX 7c: Per-particle pulse multiplier using phaseOffset and pulseDelay.
            //    coreParticleFeature.pulseValue drives all particles equally → uniform mass pulse (static feel).
            //    Now: each particle has its own sin phase that modulates its pulse contribution.
            //    pulseDelay staggers outer particles so the pulse ripples outward from center
            //    like a torus/shockwave rather than everything moving at once.
            //    particlePulse = 0.0 (no pulse) → 1.0 (full pulse) per particle individually.
            const particlePhasedPulse = coreParticleFeature.pulseValue *
              Math.max(0, Math.sin(colorState.colorWavePhase * 2.5 + particle.phaseOffset - particle.pulseDelay * 4.0));
            const particlePulse = clamp01(coreParticleFeature.pulseValue * 0.5 + particlePhasedPulse * 0.5);

            // Better size model: center depth + individual pulse + audio
            const intensityBoost = 1.10 + intensity * 1.55;
            const baseSize = 1.65 + particle.depth * 0.65;
            const pulseSizeBoost = 1.0 + particlePulse * 0.18; // was coreParticleFeature.pulseValue * 0.10
            const particleSize = Math.max(
              1.9,
              (baseSize * pulseSizeBoost +
              finalAudioValue * 0.55 * intensityBoost +
              particlePulse * 0.14 * intensityBoost) * diameterGain
            );

            // Color: less random, more controlled and data-like
            const pulseFlash = Math.pow(particlePulse, 0.90); // individual flash
            const hueVariation = particle.chaosRandX * 14 + finalAudioValue * 6 + pulseFlash * 20;
            const baseHue = params.spectrum
              ? ((effectiveHue + (randomAngle * 110 / Math.PI)) % 360)
              : effectiveHue;
            const particleHue = (baseHue + hueVariation + 360) % 360;

            const particleSat = Math.min(100, sat * 1.55 + 24 + intensity * 24 + pulseFlash * 14);
            const particleLum = Math.min(50, 20 + finalAudioValue * 7 + intensity * 2 + pulseFlash * 10);
            // 🔧 FIX 7d: Edge Fallback — more extreme fade + center respawn.
            //    Old: gentle quadratic fade in outer 40%, particles just dimmed.
            //    New: particles fade to transparent at edge AND respawn at center
            //    with outward velocity → continuous center→edge torus flow.
            //    edgeFallback=0: no effect. =1: aggressive torus recycling.
            const alphaGain = visualEnergy / Math.max(1, diameterGain * diameterGain);
            let particleAlpha = presenceGain * alphaGain * Math.max(0.16, Math.min(0.88,
              0.18 + finalAudioValue * 0.22 + intensity * 0.12 + pulseFlash * 0.22
            ));
            particleAlpha = Math.min(0.96, particleAlpha);
            
            if (params.shapeOrbitDrift > 0.01) {
              const currentRadius = Math.hypot(particle.x, particle.y);
              const currentRatio = currentRadius / Math.max(maxTargetRadius, 0.0001);
              const edgeDistance = 1.0 - currentRatio;
              const fallbackStrength = params.shapeOrbitDrift;
              
              if (edgeDistance < 0.45) {
                // Stronger cubic fade: 100% at 45% threshold → 0% at edge
                const fadeFactor = Math.pow(edgeDistance / 0.45, 1.8) * fallbackStrength;
                particleAlpha *= fadeFactor;
                
                // Respawn: when a particle becomes nearly invisible, reset it to center
                // with a randomised outward velocity — creates fresh center→edge flow
                if (particleAlpha < 0.04 && fallbackStrength > 0.3) {
                  const spawnAngle = particle.phaseOffset; // use phase for spawn angle variety
                  const spawnRadius = maxTargetRadius * 0.08;
                  particle.x = Math.cos(spawnAngle) * spawnRadius;
                  particle.y = Math.sin(spawnAngle) * spawnRadius;
                  const spawnSpeed = areaSize * 0.04 * (0.6 + fallbackStrength * 0.4);
                  particle.vx = Math.cos(spawnAngle) * spawnSpeed;
                  particle.vy = Math.sin(spawnAngle) * spawnSpeed;
                }
              }
            }
            
           // PASS 1: very subtle edge glow only
           const glowRadius = particleSize * 1.08;
           const glowSprite = getSoftParticleSprite(glowRadius);

           const glowAlpha = Math.max(
             0.0,
             Math.min(
               0.028,
               particleAlpha * (0.006 + finalAudioValue * 0.010 + pulseFlash * 0.018)
             )
          );

           ctx.globalAlpha = glowAlpha;
           ctx.drawImage(
             glowSprite,
             x - glowSprite.width / 2,
             y - glowSprite.height / 2
          );

           // PASS 2: colored particle body
           ctx.globalAlpha = 1;
           ctx.fillStyle = `hsla(${particleHue}, ${particleSat}%, ${particleLum}%, ${particleAlpha})`;
           ctx.beginPath();
           ctx.arc(x, y, particleSize, 0, Math.PI * 2);
           ctx.fill();

            // PASS 2b: crisp colored rim for premium particle look
            ctx.strokeStyle = `hsla(${particleHue}, ${Math.min(100, particleSat + 6)}%, ${Math.min(68, particleLum + 8)}%, ${Math.min(0.72, particleAlpha + 0.08)})`;
            ctx.lineWidth = Math.max(0.7, particleSize * 0.18);
            ctx.beginPath();
            ctx.arc(x, y, Math.max(0.5, particleSize - ctx.lineWidth * 0.35), 0, Math.PI * 2);
            ctx.stroke();

            // PASS 3: tiny hot core for sharper scientific feel
            if (finalAudioValue > 0.30 || coreParticleFeature.pulseValue > 0.12) {
              ctx.fillStyle = `hsla(${particleHue}, ${Math.min(100, particleSat + 6)}%, ${Math.min(62, particleLum + 6)}%, ${Math.min(0.62, particleAlpha + 0.08)})`;
              ctx.beginPath();
              ctx.arc(x, y, Math.max(0.55, particleSize * 0.65), 0, Math.PI * 2);
              ctx.fill();
            }
          }

          ctx.restore();
        }
      }

      ctx.restore(); // Close main transform block
      
      // 🎨 SATURATION BURST: Applied directly to sat variable (lines 7371-7391)
      // No additional rendering needed - effect modulates saturation of ALL orbital elements!
      
      // 🗑️ REMOVED (Beta cleanup): Corner-flash multi-layer glow block was permanently
      // disabled via `if (false && ...)` and never executed. Confirmed dead — deleted
      // rather than left as unreachable code. colorState.cornerFlashPulse/colorState.cornerFlashSequence state
      // (declared/updated elsewhere) is left in place in case this effect is revived later.
      
      // 🌈 RAINBOW CANVAS: Smooth rotating hue gradient overlay (PURE TIME-BASED - no audio jitter!)
      // Creates flowing color zones that sweep across the canvas like a color wheel searchlight
      if (params.beatDetect && (params.beatPulseType === 'all' || params.beatPulseType === 'rainbow')) {
        ctx.save();
        ctx.translate(cx, cy); // Center origin for rotation
        
        // 🚀 OPTIMIZED: Use shared rotation value (eliminates jitter from separate calculation!)
        // colorWaveRotation rotates at 0.00075 rad/ms = ~8.4 seconds per rotation
        // Scale by 0.4 for slower rotation: ~21 seconds per rotation (smooth, mesmerizing)
        const rotationAngle = colorWaveRotation * 0.4;
        
        // 🎨 SMOOTH HIGH-RESOLUTION GRADIENT: 36 stops for seamless blending!
        const gradient = ctx.createConicGradient(rotationAngle, 0, 0);
        
        // Build smooth gradient with sine wave modulation (no hard edges!)
        const numStops = 36; // High resolution for smooth blending
        const maxAlpha = params.effectAmount * 0.35; // 0-35% alpha controlled by effectAmount slider!
        
        for (let i = 0; i <= numStops; i++) {
          const stopPosition = i / numStops; // 0-1
          const stopAngle = stopPosition * Math.PI * 2; // 0-2π
          
          // 🌈 SMOOTH HUE WAVE: Hue shifts smoothly as we go around the circle
          // Creates 2 complete color cycles (0° → 360° → 0° twice around)
          const hueWave = Math.sin(stopAngle * 2) * 0.5 + 0.5; // 0-1 sine wave
          const hueShift = hueWave * 180; // 0-180° shift
          const localHue = (effectiveHue + hueShift) % 360;
          
          // 🔆 SMOOTH ALPHA WAVE: Peaks at wave centers, fades at transitions
          // Creates 3 bright zones that fade smoothly (eliminates hard edges!)
          const alphaWave = Math.abs(Math.sin(stopAngle * 3)) ** 0.7; // 3 peaks, power curve for sharper center
          const localAlpha = maxAlpha * alphaWave;
          
          // Add gradient stop with smooth transitions
          gradient.addColorStop(stopPosition, `hsla(${localHue}, 100%, 60%, ${localAlpha})`);
        }
        
        // Use "screen" blend mode for additive color mixing (brighter, more vibrant!)
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = gradient;
        
        // Fill the committed viewport rectangle. A circular fill can miss the
        // corners whenever the control panel makes the stage unusually wide.
        ctx.fillRect(-W / 2 - 1, -H / 2 - 1, W + 2, H + 2);
        
        ctx.restore();
      }
      
      
      // 🎨 SATURATION BURST: Global saturation breathing + per-angle quadrant flashing
      // Note: Global saturation breathing is applied at line ~7399 (saturationMultiplier)
      // Quadrant flashing is now applied PER-SPIKE in drawSpikes function (no canvas overlay!)

      ctx.restore();
      
      // 🗑️ Output Window feature removed (Beta cleanup) — no sync to run.
      // Note: BroadcastChannel is optional (disabled - future feature)
      
      // Sprint 22N.C Stage 2: post effects execute through the pipeline-owned pass.
      if (params.motionBlurEnabled) {
        const motionBlurEngine = getMotionBlurEngine();
        const motionBlurConfig: MotionBlurConfig = {
          enabled: true,
          persistence: params.motionBlurPersistence,
          fadeMode: params.motionBlurMode,
        };
        postEffectsOwner.prepare(ctx, motionBlurEngine, motionBlurConfig, {
          gamma: params.gamma || 0,
          iridize: params.iridize || 0,
          motionBlur: params.motionBlur || 0,
          rainbowOverlay: params.rainbowOverlay || 0,
          shockwave: params.shockwave || 0,
        });
      } else {
        postEffectsOwner.disable();
      }
      renderPipeline.renderPass('postEffects', renderFrameState);

      // Phase 2: final top-WebGL Dark Strobe pass. The recording compositor
      // already captures glCanvas after Canvas2D, so live and recorded output
      // share the exact same black-depth/displacement pixels.
      const darkStrobeActive = params.beatDetect &&
        (params.beatPulseType === 'dark-strobe' || params.beatPulseType === 'all');
      reusedDarkStrobeFrame.pulse = darkStrobeActive
        ? colorState.cornerFlashPulse * params.effectAmount
        : 0;
      reusedDarkStrobeFrame.depth = params.darkStrobeDepth;
      reusedDarkStrobeFrame.displacement = params.darkStrobeDisplacement;
      reusedDarkStrobeFrame.timeSeconds = schedulerMotionFrame.timeSeconds;
      reusedDarkStrobeFrame.baseLayerActive = webglSpikeActive || useEngineOwnedGL;
      darkStrobeRenderer?.render(reusedDarkStrobeFrame);
      
      // 🚀 TIER 3 FIX: Performance monitoring (optional - enable when debugging)
      if (false) { // Set to true to enable performance tracking
        const renderTime = measureElapsed(frameCosts.renderStartTime);
        if (renderTime > 16.67) { // Warn if frame exceeds 60fps budget
          console.warn(`⚠️ Slow frame: ${renderTime.toFixed(2)}ms (target: 16.67ms)`);
        }
      }
      
      uiInteractionRuntime.recordRenderCost({
        frameIntervalMs: framePacing.frameInterval,
        renderMs: measureFrameTimings ? measureElapsed(frameCosts.renderStartTime) : 0,
        canvas2DMs: frameCosts.canvas2DMs,
        webglMs: frameCosts.webglMs,
        dotsMs: frameCosts.dotsMs,
        haloMs: frameCosts.haloMs,
        uiFlushMs: frameCosts.uiFlushMs,
      });

      reusableFramePublication.canvas2DSpikeBaselineActive = Boolean(canvas2DSpikeBaselineActive);
      reusableFramePublication.engineOwnedGLActive = Boolean(useEngineOwnedGL);
      reusableFramePublication.webglEngineActive = Boolean(webglEngineRef.current);
      pendingFramePublication = reusableFramePublication;
    }

    // Phase 4.8H.1: the exact production frame callback now sits behind a
    // dedicated frame-shell runtime. Visual formulas and execution order inside
    // executeVisualFramePipeline remain unchanged; this only extracts host/kernel
    // orchestration from the session file.
    let lastParameterCompatibilitySyncAt = 0;

    const productionFrameRuntime = createProductionFrameRuntime({
      createVisualizerRuntimeFoundation,
      parameters: params,
      parameterStore,
      resourceScope,
      getViewport: () => viewportController?.current ?? null,
      renderEnabled: renderOnMainThread,
      surfaces: {
        canvas2D: canvas,
        context2D: ctx,
        webglCanvas: glCanvas,
      },
      executeProductionFrame: (now, timing) => {
        W = viewportState.width;
        H = viewportState.height;
        DPR = viewportState.dpr;
        activeRenderScale = viewportState.activeRenderScale;
        palette = getPalette();
        freqArr = audioBuffers.freqArr as Uint8Array<ArrayBuffer>;
        timeArr = audioBuffers.timeArr as Uint8Array<ArrayBuffer>;
        filteredFreqArr = audioBuffers.filteredFreqArr as Uint8Array<ArrayBuffer>;
        rawSpikeFreqArr = audioBuffers.rawSpikeFreqArr as Uint8Array<ArrayBuffer>;
        executeVisualFramePipeline(now, timing);
        performanceCertification.endRender();
      },
      publishRecordingFrame: (now) => {
        recordingEngine.publishFrame(now);
        performanceCertification.endRecording();
      },
      publishDiagnostics: () => {
        publishCurrentFrameDiagnostics();
        performanceCertification.endDiagnostics();
      },
      finalizeFrame: () => {
        finalizeCurrentFrame();
        performanceCertification.endFinalize();
      },
      onResume: (resumeNow) => {
        lastT = resumeNow;
        runtimeClock.start(resumeNow);
        framePacingRuntime.reset(resumeNow);
        visualAudioRuntime.reset();
        coreParticleImpulseRuntime.reset();
      },
      prepareFrame: (now, timing) => {
        performanceCertification.beginPrepare(now, timing);
        uiInteractionRuntime.onFrame(now);
        const bpmFrame = bpmClockRuntime.frame(now);
        params.bpm = bpmFrame.bpm;
        // The production renderer reads the shared params object directly. The store
        // scan exists only for transitional revision/listener compatibility, so keep
        // it off the 60 Hz hot path and never run it during panel interaction.
        if (!uiInteractionRuntime.isActive && now - lastParameterCompatibilitySyncAt >= 125) {
          parameterStore.synchronizeExternalMutations();
          lastParameterCompatibilitySyncAt = now;
        }
        runtimeRenderAuthority.publishBpmFrame(bpmFrame);
        latestBpmBarPhase = bpmFrame.barPhase;
        if (uiRefreshScheduler.shouldRun('beatClock', now)) mainThreadUIRefreshBus.publishBpmClock(bpmFrame);
        if (!renderOnMainThread) mainThreadAudioUIRefresh.tick(now);
        audioVisualStressDiagnostics.onFrame(timing.deltaMs, params.gamma || 0, params.iridize || 0);
        performanceCertification.endPrepare();
      },
      onCrash: (error, crashCount) => {
        console.error('❌ RAF LOOP CRASH:', error);
        if (DEVELOPMENT_DIAGNOSTICS_ENABLED) (window as any).__ORBITAL_RAF_CRASH_COUNT__ = crashCount;
        (window as any).__ORBITAL_CRASH_TELEMETRY__?.recordRafCrash?.(error, crashCount);
        requestSafeGraphicsRecovery(`Renderer fault ${crashCount}: graphics recovery engaged.`);
      },
    });
    productionFrameRuntime.start();
    sessionDisposer.add(() => productionFrameRuntime.dispose());

  return {
    getAngle: () => angle,
    getCachedShapeSelect: () => cachedShapeSelectEl,
    resetDotOwner: () => dotOwner.reset(),
  };
}
