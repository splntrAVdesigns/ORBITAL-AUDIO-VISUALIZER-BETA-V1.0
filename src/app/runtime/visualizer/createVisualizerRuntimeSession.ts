import type { VisualizerRuntimeBindings } from './VisualizerRuntimeBindings';
import { createRendererViewportSetup } from './setup/createRendererViewportSetup';
import { createRuntimeSessionInfrastructure } from './session/createRuntimeSessionInfrastructure';
import { createAudioRuntimeSetup } from './audio/createAudioRuntimeSetup';
import { createSessionInteractionSetup } from './setup/createSessionInteractionSetup';
import { DEVELOPMENT_DIAGNOSTICS_ENABLED } from '../../config/runtimeEnvironment';
import { disposeWebGLAstralRenderer } from '../../engine/WebGLAstralRenderer';
import { disposeLiquidShaperCanvasCaches } from '../../utils/astralShaper';
import { getSessionRecoverySupervisor } from '../session/SessionRecoverySupervisor';
import { attachAudioSourceAuthority } from './session/createRuntimeAuthoritySetup';
import { createSpikeFeatureRuntime } from './features';
import { createProductionUISideEffectRuntime } from './ui/ProductionUISideEffectRuntime';
import { createProductionControlBindingRuntime } from './controls/ProductionControlBindingRuntime';
import { registerVisualizerControlPlane } from './controls/registerVisualizerControlPlane';
import { createVisualizerFeatureSession } from './session/createVisualizerFeatureSession';
import { createVisualizerFrameServices } from './setup/createVisualizerFrameServices';
import { createVisualizerProductionFrameController } from './frame/createVisualizerProductionFrameController';
import {
  applyRuntimeParameterStoreTransaction,
  type RuntimeParameterKey,
} from '../parameters/RuntimeParameterTransactions';

/** Non-React runtime session. Owns setup and returns deterministic cleanup. */
export function createVisualizerRuntimeSession(bindings: VisualizerRuntimeBindings): void | (() => void) {
  const {
    AudioVisualStressDiagnostics,
    AutoReactivityEngine,
    BeatEffectRuntime,
    CORE_PARTICLES_SANDBOX,
    CanvasViewportController,
    CenterGraphicController,
    CoreParticleImpulseRuntime,
    CoreTexturesEngine,
    DEBUG_FLAGS,
    DEBUG_WEBGL,
    FramePacingRuntime,
    MidiController,
    MotionRotationRuntime,
    RecordingEngine,
    RenderPipeline,
    RotationAuthority,
    ShockwaveRuntime,
    SoftParticleSpriteCache,
    UIInteractionRuntime,
    UIRefreshScheduler,
    VisualAudioRuntime,
    VisualReactivityEngine,
    WebGLEngine,
    appState,
    renderWebGLOnMainThread = true,
    applyPendingLiquidChanges,
    applyPendingMacroChanges,
    clearPendingMacroTransactions,
    audioContextRef,
    autoAdvance,
    bindMotionControlsRouting,
    buildSpikeLookupTables,
    canvasRef,
    captureCanvasScreenshot,
    centerMediaPass,
    clamp,
    clearBackgroundPass,
    clearTextureCache,
    compileShader,
    coreTexturesCanvasRef,
    coreTexturesEngineRef,
    createAudioUIController,
    createCenterGraphicRenderState,
    createDomBindingController,
    createFullscreenController,
    createKeyboardShortcutHandler,
    createPanelController,
    createPresetActions,
    createRenderFrameState,
    defaultParams,
    dotPass,
    easeOutSine,
    flushQueuedUIUpdates,
    getAllShapes,
    getAstralMorphEngine,
    getMotionBlurEngine,
    glCanvasRef,
    haloPass,
    initAudioSystem,
    initializedRef,
    initializingRef,
    leftAnalyserRef,
    leftTimeDataRef,
    linkProgram,
    micStreamRef,
    palettes,
    pendingLiquidChangesRef,
    playlist,
    postEffectsPass,
    recordingFPS,
    recordingResolution,
    recordingControllerRef,
    recordingSettingsRef,
    resolveAdaptiveRenderScale,
    rightAnalyserRef,
    rightTimeDataRef,
    rootRef,
    setAudioDuration,
    setAudioTab,
    setCurrentTime,
    setCurrentTrackIndex,
    setIsAudioPlaying,
    setIsMicActive,
    setIsRecording,
    setMacroValues,
    setMetadata,
    setMonitorEnabled,
    setPlaylist,
    setRecordingLibrary,
    setRecordingTimeLeft,
    setShowKeyboardHelper,
    setUseWebGL,
    shuffleEnabled,
    spikeRingFragmentShader,
    spikeRingVertexShader,
    startAngleTween,
    stereoSplitterRef,
    useWebGLCoreParticlesRef,
    useWebGLRef,
    webglEngineRef
  } = bindings;

    const infrastructure = createRuntimeSessionInfrastructure({
      appState,
      debugGeneral: DEBUG_FLAGS.GENERAL,
      canvasRef,
      rootRef,
      initializedRef,
      initializingRef,
    });
    if (!infrastructure) return;

    const {
      canvas,
      root,
      ctx,
      sessionDisposer,
      resourceScope,
      asyncRegistry,
      eventRegistry,
      astralStrokeStyleRaf,
      abortInitialization,
    } = infrastructure;
    const $ = (sel: string) => document.querySelector(sel);
    const sessionRecoverySupervisor = getSessionRecoverySupervisor();

    // ✅ Canvas2D context initialized

    const viewportState = {
      width: 0,
      height: 0,
      dpr: Math.max(window.devicePixelRatio || 1, 1),
      activeRenderScale: 1,
    };
    viewportState.activeRenderScale = resolveAdaptiveRenderScale({
      cssWidth: 1,
      cssHeight: 1,
      devicePixelRatio: viewportState.dpr,
    });

    const rendererViewportSetup = createRendererViewportSetup({
      canvas,
      context2D: ctx,
      root,
      glCanvasRef,
      sessionDisposer,
      resourceScope,
      abortInitialization,
      CORE_PARTICLES_SANDBOX,
      CanvasViewportController,
      DEBUG_FLAGS,
      DEBUG_WEBGL,
      WebGLEngine,
      createPanelController,
      setUseWebGL,
      useWebGLRef,
      useWebGLCoreParticlesRef,
      webglEngineRef,
      compileShader,
      linkProgram,
      spikeRingVertexShader,
      spikeRingFragmentShader,
      resolveAdaptiveRenderScale,
      getElement: $,
      getViewportMetrics: () => viewportState,
      renderWebGLOnMainThread,
      onViewportCommitted: (snapshot) => {
        viewportState.width = snapshot.width;
        viewportState.height = snapshot.height;
        viewportState.dpr = snapshot.dpr;
        viewportState.activeRenderScale = snapshot.activeRenderScale;
      },
    });
    if (!rendererViewportSetup) return;

    const {
      glCanvas,
      viewportPanelSetup,
    } = rendererViewportSetup;
    const setPanelW = viewportPanelSetup.setPanelW;
    const toggleCollapse = viewportPanelSetup.toggleCollapse;
    const resize = viewportPanelSetup.resize;
    const eventHandlers = viewportPanelSetup.eventHandlers;
    const fullscreenState = viewportPanelSetup.fullscreenState;

    // Deferred callbacks are defined before the audio/UI factories that reference them.
    let setPaletteByName: (name: string) => void = () => {};
    let applyMacro: (macroName: string, value: number) => void = () => {};
    let getProductionAngle: () => number = () => 0;
    let getProductionShapeSelect: () => HTMLSelectElement | null = () => null;
    let resetProductionDotOwner: () => void = () => {};

    // ─── PHASE 3 REFACTOR: Audio Pipeline ──────────────────────────────────────
    // Audio bootstrap and mutable media state live in the runtime-owned audio boundary.
    const audioRuntime = createAudioRuntimeSetup({
      audioContextRef,
      micStreamRef,
      leftAnalyserRef,
      rightAnalyserRef,
      leftTimeDataRef,
      rightTimeDataRef,
      stereoSplitterRef,
      sessionDisposer,
      resourceScope,
      abortInitialization,
      initAudioSystem,
      createAudioUIController,
      getElement: $,
      getParams: () => params,
      playlist,
      autoAdvance,
      shuffleEnabled,
      setMetadata,
      setPlaylist,
      setAudioTab,
      setCurrentTrackIndex,
      setCurrentTime,
      setAudioDuration,
      setMonitorEnabled,
      setIsAudioPlaying,
      setIsMicActive,
      debugAudio: DEBUG_FLAGS.AUDIO,
      debugGeneral: DEBUG_FLAGS.GENERAL,
      debugUIEvents: DEBUG_FLAGS.UI_EVENTS,
    });
    if (!audioRuntime) return;

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
    attachAudioSourceAuthority(audioState, sessionDisposer);
    // These arrays are intentionally mutable because the FFT control replaces them.
    let {
      freqArr,
      timeArr,
      filteredFreqArr,
      beatDetectionFreqArr,
      rawSpikeFreqArr,
    } = audioRuntime;

    // Expose RadialAnalyzer setPalette (needs setPaletteByName from outer closure)
    if ((window as any).RadialAnalyzer) {
      (window as any).RadialAnalyzer.setPalette = (name: string) => setPaletteByName(name);
    }

    // File input — using React onChange handler in JSX
    const fileInput = $('#file') as HTMLInputElement;
    if (fileInput) {
      if (DEBUG_FLAGS.GENERAL) console.log('ℹ️ File input found - using React onChange handler');
    }

    // Phase 2: persistent feature/session construction is owned outside the
    // orchestration entry point. The production frame consumes the same objects.
    const featureSession = createVisualizerFeatureSession({
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
      querySelector: $,
      debugGeneral: DEBUG_FLAGS.GENERAL,
    });
    const {
      params,
      parameterStore,
      liquidShaperFeature,
      centerGraphicController,
      centerImageRotationHomeTween,
      colorState,
      beatDetectionRuntime,
      motionState,
      rotationAuthority,
      rotationHomeTween,
    } = featureSession;


    function startRotationHomeEase(fromAngle: number, duration = 1.2) {
      rotationAuthority.startHomeEase(fromAngle, duration);
    }

    function resetRotationState(newMode: string, currentGlobalAngle: number) {
      audioState.beatCounter = 0;
      rotationAuthority.reset(newMode, currentGlobalAngle);
      motionState.lastSyncMode = newMode;
    }

    function recalculateRotationSpeed() {
      motionState.lastSyncMode = ((params as any).rotationSyncMode || 'free') as string;
    }

    // Phase 4.8H.4: deferred UI/React mutations and control-listener lifecycle
    // have explicit owners. The visual frame now only decides when side effects may flush.
    const uiSideEffects = createProductionUISideEffectRuntime({
      params,
      setMacroValues,
      flushQueuedUIUpdates,
      applyMacro: (macroName, value) => applyMacro(macroName, value),
      requestIdle: (callback, options) => asyncRegistry.requestIdle(callback, options),
    });
    const scheduleUIUpdate = (updateFn: () => void) => uiSideEffects.schedule(updateFn);
    const scheduleMacroUpdate = (macroName: string, value: number) => uiSideEffects.scheduleMacro(macroName, value);

    const controlBindings = createProductionControlBindingRuntime({
      document,
      createDomBindingController,
      onDispose: (cleanup) => sessionDisposer.add(cleanup),
    });
    const bind = controlBindings.bind;
    const bindThrottled = controlBindings.bindThrottled;
    const commitRuntimeParameter = (key: RuntimeParameterKey, value: unknown): void => {
      applyRuntimeParameterStoreTransaction(parameterStore, { [key]: value });
    };
    
    // Phase 1 control-plane extraction: UI registration/default synchronization
    // run once, outside the visual frame pipeline, with session-owned cleanup.
    const spikeFeature = createSpikeFeatureRuntime(timeArr.length);
    const audioControlBuffers = {
      get freqArr() { return freqArr; },
      set freqArr(value: Uint8Array<ArrayBufferLike>) { freqArr = value as Uint8Array<ArrayBuffer>; },
      get timeArr() { return timeArr; },
      set timeArr(value: Uint8Array<ArrayBufferLike>) { timeArr = value as Uint8Array<ArrayBuffer>; },
      get filteredFreqArr() { return filteredFreqArr; },
      set filteredFreqArr(value: Uint8Array<ArrayBufferLike>) { filteredFreqArr = value as Uint8Array<ArrayBuffer>; },
      get beatDetectionFreqArr() { return beatDetectionFreqArr; },
      set beatDetectionFreqArr(value: Uint8Array<ArrayBufferLike>) { beatDetectionFreqArr = value as Uint8Array<ArrayBuffer>; },
      get rawSpikeFreqArr() { return rawSpikeFreqArr; },
      set rawSpikeFreqArr(value: Uint8Array<ArrayBufferLike>) { rawSpikeFreqArr = value as Uint8Array<ArrayBuffer>; },
    };
    registerVisualizerControlPlane({
      params,
      analyser,
      audioBuffers: audioControlBuffers,
      spikeFeature,
      liquidShaperFeature,
      motionState,
      audioState,
      centerGraphicController,
      centerImageRotationHomeTween,
      rotationHomeTween,
      bind,
      bindThrottled,
      bindMotionControlsRouting,
      commitRuntimeParameter,
      scheduleMacroUpdate,
      updateMetadataDisplay,
      trackMetadata,
      getMotionBlurEngine,
      clearTextureCache,
      astralStrokeStyleRaf,
      startAngleTween,
      easeOutSine,
      startRotationHomeEase,
      resetRotationState,
      recalculateRotationSpeed,
      getAngle: () => getProductionAngle(),
      query: $,
      asyncRegistry,
      eventRegistry,
      sessionDisposer,
      debugGeneral: DEBUG_FLAGS.GENERAL,
    });
    // Palettes imported from /data/colorPalettes.ts
    
    // Custom dropdown elements
    // Palette state — kept here (not moved into presetActions.ts) because the render
    // loop reads `palette` directly, many times per frame. Bridged into presetActions
    // via getPalette/getSelectedPaletteIndex/setPaletteState below.
    let selectedPaletteIndex = 0;
    let palette = palettes[0];

    // 🚀 (Beta cleanup, Phase 1 of mega-effect decomposition): the ~1,680 lines that used
    // to sit here (palette dropdown, presets, macro reset helpers, the 10 resetX() functions)
    // have moved to utils/presetActions.ts as a single factory call. This is a verbatim
    // relocation — see that file's header comment for the full explanation of what's bridged
    // here vs. moved there, and why.
    const presetActions = createPresetActions({
      params,
      coreTexturesEngineRef,
      eventHandlers,
      centerImageRotationHomeTween,
      rotationHomeTween,
      setMacroValues,
      applyPendingLiquidChanges,
      applyPendingMacroChanges,
      updateMetadataDisplay,
      getAstralMorphEngine,
      toggleAutoCycle: centerGraphicController.toggleAutoCycle.bind(centerGraphicController),
      replayCenterTransitionPreview: centerGraphicController.replayTransitionPreview.bind(centerGraphicController),
      startRotationHomeEase,
      startMacro2RotationCommit: (targetRotation: number) => {
        motionState.startMacro2RotationCommit(Number(params.rotation || 0), targetRotation, performance.now());
      },
      getAngle: () => getProductionAngle(),
      getPalette: () => palette,
      getSelectedPaletteIndex: () => selectedPaletteIndex,
      setPaletteState: (idx: number) => { selectedPaletteIndex = idx; palette = palettes[idx]; },
      getAutoCycleEnabled: () => centerGraphicController.autoCycleEnabled,
      getAutoCycleSpeed: () => centerGraphicController.autoCycleSpeed,
      setAutoCycleSpeed: (v: number) => centerGraphicController.setAutoCycleSpeed(v),
      setCenterImageHidden: (v: boolean) => centerGraphicController.setHidden(v),
      setCenterImageAutoRotationAngle: (v: number) => centerGraphicController.setAutoRotationAngle(v),
      clearPendingControlTransactions: () => {
        uiSideEffects.clear();
        liquidShaperFeature.resetPendingChanges();
        clearPendingMacroTransactions();
      },
      resetRenderLoopMiscState: () => {
        centerGraphicController.autoRotationAngle = 0;
        colorState.beatPulse = 0;
        colorState.beatFlashIntensity = 0;
        colorState.beatColorShift = 0;
        colorState.cornerFlashPulse = 0;
        colorState.cornerFlashSequence = 0;
        colorState.cornerFlashTimer = 0;
        colorState.quadrantFlashIntensity.fill(0);
        beatDetectionRuntime.reset();
        resetProductionDotOwner();
        colorState.energyGateActive = false;
        colorState.energyGateSmoother = 1.0;
        getAstralMorphEngine().reset();
        motionState.rotationSyncAccumulator = 0;
        motionState.lastRotationSnapTime = 0;
        centerGraphicController.transitionProgress = 1.0;
        centerGraphicController.transitionFrom = -1;
      },
    });

    const {
      saveCustomPresetsToStorage,
      updatePresetDropdown,
      customPresets,
      resetToDefaults,
    } = presetActions;
    // setPaletteByName/applyMacro were pre-declared via `let` above (closures earlier in
    // this effect reference them before this point) — assign, don't redeclare.
    setPaletteByName = presetActions.setPaletteByName;
    applyMacro = presetActions.applyMacro;
    sessionDisposer.add(() => presetActions.dispose());

    
    // Phase 4.8H.4: macro DOM feedback is owned by the UI side-effect runtime.
    const updateMacroVisuals = () => uiSideEffects.updateMacroVisuals();
    
    // Initialize macro visuals after DOM loads
    asyncRegistry.setTimeout(() => {
      updateMacroVisuals();
      centerGraphicController.updatePreviewBoxes(); // Initialize preview boxes
    }, 100);
    
    // PHASE 3: Center Graphic media controls (Sprint 22A extraction)
    centerGraphicController.bindControls();
    (window as any).centerGraphicController = centerGraphicController;
    sessionDisposer.add(() => {
      const runtimeWindow = window as any;
      if (runtimeWindow.centerGraphicController === centerGraphicController) delete runtimeWindow.centerGraphicController;
    });

    // Helper function to check if user is typing in an input
    function isTypingTarget(el: any) {
      return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    }

    // Sprint 22C / Phase 4.8H.4: slider display setup is exposed by the control-binding runtime.
    const setupSliderValueDisplays = controlBindings.setupSliderValueDisplays;
    
    // Initialize controls after DOM loads (AFTER initializeUIFromDefaults at 300ms)
    asyncRegistry.setTimeout(() => {
      // ⚡ Initialize slider value displays
      setupSliderValueDisplays();
      centerGraphicController.bindDeferredControls();
    }, 350); // 🎯 Wait for initializeUIFromDefaults (300ms) to complete first

    eventHandlers.windowWheel = (e: WheelEvent) => {
      if (!params.allowZoom) return;
      params.zoom *= (e.deltaY < 0) ? 1.05 : 0.95;
      params.zoom = clamp(params.zoom, 0.4, 2.5);
    };
    eventRegistry.listen(canvas, "wheel", eventHandlers.windowWheel, { passive: true });

    // Phase 2: reusable feature/render services are assembled once and expose
    // no scheduler of their own. The session remains the production frame authority.
    const frameServices = createVisualizerFrameServices({
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
      context2D: ctx,
      createCenterGraphicRenderState,
      createRenderFrameState,
      dotPass,
      energyAnalyser,
      energyFreqArr,
      energyTimeArr,
      getPalette: () => palette,
      haloPass,
      params,
      postEffectsPass,
      resourceScope,
      sampleRate: AC.sampleRate,
      sessionDisposer,
      spikeFeature,
      debugBeatDetection: DEBUG_FLAGS.BEAT_DETECTION,
      debugGeneral: DEBUG_FLAGS.GENERAL,
      developmentDiagnosticsEnabled: DEVELOPMENT_DIAGNOSTICS_ENABLED,
    });
    const interactionRuntime = createSessionInteractionSetup({
      canvas,
      glCanvas,
      root,
      params,
      customPresets,
      audioState,
      AC,
      trackMetadata,
      updateMetadataDisplay,
      sessionDisposer,
      resourceScope,
      eventRegistry,
      asyncRegistry,
      getElement: $,
      captureCanvasScreenshot,
      resetToDefaults,
      getAstralMorphEngine,
      getAllShapes,
      getCachedShapeSelect: () => getProductionShapeSelect(),
      saveCustomPresetsToStorage,
      updatePresetDropdown,
      debugGeneral: DEBUG_FLAGS.GENERAL,
      fullscreenState,
      resize,
      setPanelW,
      createFullscreenController,
      RecordingEngine,
      recordingSettingsRef,
      recordingFPS,
      recordingResolution,
      setRecordingCaptureResolution: (resolution) => viewportPanelSetup.setRecordingCaptureResolution(resolution),
      setIsRecording,
      setRecordingTimeLeft,
      setRecordingLibrary,
      recordingControllerRef,
      MidiController,
      setMacroValues,
      getSelectedPaletteIndex: () => selectedPaletteIndex,
      setSelectedPaletteIndex: (value: number) => { selectedPaletteIndex = value; },
      palettesLength: palettes.length,
      UIInteractionRuntime,
      AudioVisualStressDiagnostics,
      createKeyboardShortcutHandler,
      isTypingTarget,
      toggleCollapse,
      palettes,
      setShowKeyboardHelper,
      debugUIEvents: DEBUG_FLAGS.UI_EVENTS,
    });
    const productionFrameController = createVisualizerProductionFrameController({
      bindings,
      infrastructure,
      rendererViewportSetup,
      audioRuntime,
      audioBuffers: audioControlBuffers,
      featureSession,
      frameServices,
      interactionRuntime,
      uiSideEffects,
      viewportState,
      spikeFeature,
      querySelector: $,
      getPalette: () => palette,
      resetRotationState,
      scheduleUIUpdate,
      requestSafeGraphicsRecovery: (reason) => sessionRecoverySupervisor.requestSafeGraphicsRecovery(reason),
    });
    getProductionAngle = productionFrameController.getAngle;
    getProductionShapeSelect = productionFrameController.getCachedShapeSelect;
    resetProductionDotOwner = productionFrameController.resetDotOwner;

    // Session-preserving graphics recovery: release renderer-owned GPU/canvas
    // resources without touching the AudioContext, media element, parameters, or UI.
    const unregisterGraphicsRecovery = sessionRecoverySupervisor.registerGraphicsRecovery((reason) => {
      try { coreTexturesEngineRef.current?.dispose(); } catch { /* fallback remains valid */ }
      coreTexturesEngineRef.current = null;
      try { webglEngineRef.current?.dispose(); } catch { /* fallback remains valid */ }
      webglEngineRef.current = null;
      disposeWebGLAstralRenderer();
      disposeLiquidShaperCanvasCaches();
      useWebGLRef.current = false;
      setUseWebGL(false);
      try { ctx.clearRect(0, 0, canvas.width, canvas.height); } catch { /* preserve session */ }
      sessionRecoverySupervisor.markDegraded(`${reason} Canvas2D fallback is active; audio and controls were preserved.`);
    });
    sessionDisposer.add(unregisterGraphicsRecovery);
    eventRegistry.listen(window, 'orbital:astral-webgl', (event: Event) => {
      const type = String((event as CustomEvent<{ type?: string }>).detail?.type || 'unknown');
      if (type === 'context-lost' || type === 'rebuild-failed') {
        sessionRecoverySupervisor.markDegraded(`Liquid Shaper GPU ${type}; a contained fallback is active.`);
      } else if (type === 'context-restored') {
        sessionRecoverySupervisor.markRunning('Liquid Shaper GPU context restored.');
      }
    });
    sessionRecoverySupervisor.markRunning('Visualizer runtime active.');
    if (DEBUG_FLAGS.PERFORMANCE) console.log('✅ RAF STARTED: RuntimeFrameScheduler authority active');

    // Sprint 22N.C.4C: every runtime-owned resource is registered with the
    // LIFO disposer at creation time. Cleanup is now one deterministic operation.
    return () => {
      if (DEBUG_FLAGS.GENERAL) console.log('🧹 Cleaning up visualizer...');
      sessionDisposer.dispose();

      // React Strict Mode performs setup → cleanup → setup in development.
      initializingRef.current = false;
      initializedRef.current = false;
    };

}
