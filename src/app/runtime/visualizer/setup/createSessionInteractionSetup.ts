import { installRecordingRuntimeController } from '../../../engine/recording/installRecordingRuntimeController';
import { RuntimeAudioSessionState } from '../audio/RuntimeAudioSessionState';
import type { RuntimeAsyncRegistry } from '../session/RuntimeAsyncRegistry';
import type { RuntimeEventRegistry } from '../session/RuntimeEventRegistry';
import type { RuntimeResourceScope } from '../session/RuntimeResourceDiagnostics';
import type { RuntimeSessionDisposer } from '../session/RuntimeSessionDisposer';
import { applyRuntimeParameterTransaction } from '../../parameters/RuntimeParameterTransactions';
import { getActiveCycleShapes, syncLiquidShapeSelect, type ShapeType } from '../../../utils/astralShaper';

export interface SessionInteractionSetupOptions {
  canvas: HTMLCanvasElement;
  glCanvas: HTMLCanvasElement;
  root: HTMLElement;
  params: any;
  customPresets: any[];
  audioState: RuntimeAudioSessionState;
  AC: AudioContext;
  trackMetadata: any;
  updateMetadataDisplay: () => void;
  sessionDisposer: RuntimeSessionDisposer;
  resourceScope: RuntimeResourceScope;
  eventRegistry: RuntimeEventRegistry;
  asyncRegistry: RuntimeAsyncRegistry;
  getElement(selector: string): Element | null;
  captureCanvasScreenshot: (canvas: HTMLCanvasElement) => void;
  resetToDefaults: () => void;
  getAstralMorphEngine: () => { reset(): void };
  getAllShapes: () => string[];
  getCachedShapeSelect: () => HTMLSelectElement | null;
  saveCustomPresetsToStorage: () => void;
  updatePresetDropdown: () => void;
  debugGeneral: boolean;
  fullscreenState: { wasCollapsedBeforeFullscreen: boolean };
  resize: () => void;
  setPanelW: (width: number) => void;
  createFullscreenController: any;
  RecordingEngine: any;
  recordingSettingsRef: any;
  recordingFPS: any;
  recordingResolution: any;
  setRecordingCaptureResolution: (resolution: { width: number; height: number } | null) => void;
  setIsRecording: any;
  setRecordingTimeLeft: any;
  setRecordingLibrary: any;
  recordingControllerRef: any;
  MidiController: any;
  setMacroValues: any;
  getSelectedPaletteIndex: () => number;
  setSelectedPaletteIndex: (value: number) => void;
  palettesLength: number;
  UIInteractionRuntime: any;
  AudioVisualStressDiagnostics: any;
  createKeyboardShortcutHandler: any;
  isTypingTarget: (element: Element | null) => boolean;
  toggleCollapse: () => void;
  palettes: Array<{ name: string }>;
  setShowKeyboardHelper: any;
  debugUIEvents: boolean;
}

export interface SessionInteractionSetup {
  captureScreenshot(): void;
  toggleFullscreen(): void;
  recordingEngine: any;
  uiInteractionRuntime: any;
  audioVisualStressDiagnostics: any;
}

/** Owns one-time interaction, recording, MIDI, fullscreen, and keyboard setup. */
export function createSessionInteractionSetup(options: SessionInteractionSetupOptions): SessionInteractionSetup {
  const {
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
    getElement,
    captureCanvasScreenshot,
    resetToDefaults,
    getAstralMorphEngine,
    getCachedShapeSelect,
    saveCustomPresetsToStorage,
    updatePresetDropdown,
    debugGeneral,
    fullscreenState,
    resize,
    setPanelW,
    createFullscreenController,
    RecordingEngine,
    recordingSettingsRef,
    recordingFPS,
    recordingResolution,
    setRecordingCaptureResolution,
    setIsRecording,
    setRecordingTimeLeft,
    setRecordingLibrary,
    recordingControllerRef,
    MidiController,
    setMacroValues,
    getSelectedPaletteIndex,
    setSelectedPaletteIndex,
    palettesLength,
    UIInteractionRuntime,
    AudioVisualStressDiagnostics,
    createKeyboardShortcutHandler,
    isTypingTarget,
    toggleCollapse,
    palettes,
    setShowKeyboardHelper,
    debugUIEvents,
  } = options;

  const snapBtn = getElement('#snap');
  const resetBtn = getElement('#resetToDefaults');
  if (resetBtn) eventRegistry.listen(resetBtn, 'click', resetToDefaults);

  const resetAutoCycleBtn = getElement('#resetAutoCycle');
  if (resetAutoCycleBtn) {
    eventRegistry.listen(resetAutoCycleBtn, 'click', () => {
      getAstralMorphEngine().reset();
      const shapes = getActiveCycleShapes();
      params.astralShape = shapes[0];
      const shapeSelect = getCachedShapeSelect();
      if (shapeSelect) syncLiquidShapeSelect(shapeSelect, params.astralShape as ShapeType);
      if (debugGeneral) console.log('🔄 Auto-cycle reset to first shape:', params.astralShape);
    });
  }

  const captureScreenshot = () => captureCanvasScreenshot(canvas);
  if (snapBtn) eventRegistry.listen(snapBtn, 'click', captureScreenshot);

  const fullscreenController = createFullscreenController({
    button: getElement('#toggleFullscreen') as HTMLElement | null,
    getWasCollapsedBeforeFullscreen: () => fullscreenState.wasCollapsedBeforeFullscreen,
    setWasCollapsedBeforeFullscreen: (value: boolean) => { fullscreenState.wasCollapsedBeforeFullscreen = value; },
    onLayoutChange: resize,
  });
  const toggleFullscreen = fullscreenController.toggleFullscreen;
  sessionDisposer.add(() => fullscreenController.dispose());

  const snapToGridBtn = getElement('#snapToGrid') as HTMLElement | null;
  const gridSnapPoints = [300, 350, 400, 450, 500];
  let currentSnapIndex = 0;
  if (snapToGridBtn) {
    eventRegistry.listen(snapToGridBtn, 'click', () => {
      currentSnapIndex = (currentSnapIndex + 1) % gridSnapPoints.length;
      setPanelW(gridSnapPoints[currentSnapIndex]);
      snapToGridBtn.style.background = 'rgba(30,144,255,0.5)';
      snapToGridBtn.style.borderColor = 'var(--neonBlue)';
      asyncRegistry.setTimeout(() => { snapToGridBtn.style.background = 'rgba(30,144,255,0.2)'; }, 200);
    });
  }

  const performanceModeCheckbox = getElement('#performanceMode') as HTMLInputElement | null;
  if (performanceModeCheckbox) {
    eventRegistry.listen(performanceModeCheckbox, 'change', (event) => {
      if (!(event.target as HTMLInputElement).checked) return;
      params.bloom = Math.min(params.bloom, 0.25);
      params.trail = Math.max(params.trail, 0.75);
      const bloom = getElement('#bloom') as HTMLInputElement | null;
      const trail = getElement('#trail') as HTMLInputElement | null;
      if (bloom) bloom.value = String(params.bloom);
      if (trail) trail.value = String(params.trail);
    });
  }

  const outputResolutionSelect = getElement('#outputResolution') as HTMLSelectElement | null;
  if (outputResolutionSelect) {
    eventRegistry.listen(outputResolutionSelect, 'change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      if (value === 'custom') {
        const customResolution = prompt('Enter custom resolution (format: WIDTHxHEIGHT):', '1920x1080');
        if (customResolution && /^\d+x\d+$/.test(customResolution)) {
          if (debugGeneral) console.log('Custom output resolution:', customResolution);
        } else {
          outputResolutionSelect.value = '1920x1080';
        }
      } else if (debugGeneral) console.log('Output resolution set to:', value);
    });
  }
  const outputFpsLimitSelect = getElement('#outputFpsLimit') as HTMLSelectElement | null;
  if (outputFpsLimitSelect) {
    eventRegistry.listen(outputFpsLimitSelect, 'change', (event) => {
      if (debugGeneral) console.log('Output FPS limit set to:', (event.target as HTMLSelectElement).value);
    });
  }

  const recordingEngine = new RecordingEngine({
    canvas,
    glCanvas,
    params,
    getRecordingFPS: () => recordingSettingsRef.current?.fps ?? recordingFPS,
    getRecordingResolution: () => recordingSettingsRef.current?.resolution ?? recordingResolution,
    getRecordingDuration: () => recordingSettingsRef.current?.duration ?? 0,
    getRecordingCodec: () => recordingSettingsRef.current?.codec ?? 'vp9',
    getRecordingQuality: () => recordingSettingsRef.current?.quality ?? 'high',
    setRecordingCaptureResolution,
    setIsRecording,
    setRecordingTimeLeft,
    setRecordingLibrary,
    getIsPlaying: () => audioState.isPlaying,
    setIsPlaying: (value: boolean) => { audioState.isPlaying = value; },
    getIsMicActive: () => audioState.usingMic,
    getMediaEl: () => audioState.mediaElement,
    getAC: () => AC,
    getCurrentPlayPromise: () => audioState.currentPlayPromise,
    setCurrentPlayPromise: (promise: Promise<void> | null) => { audioState.currentPlayPromise = promise; },
    setAudioStartTime: (value: number) => { audioState.audioStartTime = value; },
    trackMetadata,
    updateMetadataDisplay,
    root,
  });
  recordingEngine.init();
  sessionDisposer.add(() => recordingEngine.dispose());
  sessionDisposer.add(installRecordingRuntimeController(recordingControllerRef, recordingEngine));

  const midiController = new MidiController({
    params,
    applyMacroLive: (macroId: string, value: number) => {
      applyRuntimeParameterTransaction(params, { [macroId]: value });
      (window as any).applyMacro?.(macroId, value, { syncDom: false, interactionPhase: 'live' });
    },
    commitMacroValue: (macroId: string, value: number) => {
      applyRuntimeParameterTransaction(params, { [macroId]: value });
      setMacroValues((previous: any) => previous[macroId] === value ? previous : { ...previous, [macroId]: value });
      const hiddenInput = document.getElementById(`${macroId}-hidden`) as HTMLInputElement | null;
      if (hiddenInput) hiddenInput.value = String(value);
      (window as any).applyMacro?.(macroId, value, { immediateDom: true, interactionPhase: 'commit' });
    },
    getSelectedPaletteIndex,
    setSelectedPaletteIndex,
    palettesLength,
  });
  midiController.init();
  sessionDisposer.add(() => midiController.dispose());

  const uiInteractionRuntime = new UIInteractionRuntime(resourceScope);
  uiInteractionRuntime.init();
  sessionDisposer.add(() => uiInteractionRuntime.dispose());

  const audioVisualStressDiagnostics = new AudioVisualStressDiagnostics(resourceScope);
  audioState.setStressDiagnosticsAttacher((media) => audioVisualStressDiagnostics.attach(media));
  audioVisualStressDiagnostics.attach(audioState.mediaElement);
  sessionDisposer.add(() => audioVisualStressDiagnostics.dispose());

  const keyboardShortcutHandler = createKeyboardShortcutHandler({
    isTypingTarget,
    toggleCollapse,
    mediaEl: audioState.mediaElement,
    $: getElement,
    params,
    palettes,
    getSelectedPaletteIndex,
    setSelectedPaletteIndex,
    captureScreenshot,
    toggleFullscreen,
    setShowKeyboardHelper,
    debugUiEvents: debugUIEvents,
  });
  eventRegistry.listen(window, 'keydown', keyboardShortcutHandler, { capture: true });

  return {
    captureScreenshot,
    toggleFullscreen,
    recordingEngine,
    uiInteractionRuntime,
    audioVisualStressDiagnostics,
  };
}
