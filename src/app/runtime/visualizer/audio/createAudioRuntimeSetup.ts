import { DEVELOPMENT_DIAGNOSTICS_ENABLED } from '../../../config/runtimeEnvironment';
import { RuntimeAudioSessionState } from './RuntimeAudioSessionState';
import type { RuntimeResourceScope } from '../session/RuntimeResourceDiagnostics';
import type { RuntimeSessionDisposer } from '../session/RuntimeSessionDisposer';

export interface AudioRuntimeSetupOptions {
  audioContextRef: { current: AudioContext | null };
  micStreamRef: any;
  leftAnalyserRef: any;
  rightAnalyserRef: any;
  leftTimeDataRef: any;
  rightTimeDataRef: any;
  stereoSplitterRef: any;
  sessionDisposer: RuntimeSessionDisposer;
  resourceScope: RuntimeResourceScope;
  abortInitialization(message: string): void;
  initAudioSystem: any;
  createAudioUIController: any;
  getElement(selector: string): Element | null;
  getParams(): any;
  playlist: any;
  autoAdvance: any;
  shuffleEnabled: any;
  setMetadata: any;
  setPlaylist: any;
  setAudioTab: any;
  setCurrentTrackIndex: any;
  setCurrentTime: any;
  setAudioDuration: any;
  setMonitorEnabled: any;
  setIsAudioPlaying: any;
  setIsMicActive: any;
  debugAudio: boolean;
  debugGeneral: boolean;
  debugUIEvents: boolean;
}

export interface AudioRuntimeSetup {
  AC: AudioContext;
  state: RuntimeAudioSessionState;
  analyser: AnalyserNode;
  energyAnalyser: AnalyserNode;
  freqArr: Uint8Array<ArrayBuffer>;
  timeArr: Uint8Array<ArrayBuffer>;
  energyFreqArr: Uint8Array<ArrayBuffer>;
  energyTimeArr: Uint8Array<ArrayBuffer>;
  filteredFreqArr: Uint8Array<ArrayBuffer>;
  beatDetectionFreqArr: Uint8Array<ArrayBuffer>;
  rawSpikeFreqArr: Uint8Array<ArrayBuffer>;
  trackMetadata: any;
  loadFile: any;
  unloadAudioFile: any;
  useMic: any;
  stopMic: any;
  connectNode: any;
  playButtonHandler: any;
  restartButtonHandler: any;
  updateMetadataDisplay: () => void;
}

/** Owns AudioContext/audio-system initialization, audio UI bridging, and teardown. */
export function createAudioRuntimeSetup(options: AudioRuntimeSetupOptions): AudioRuntimeSetup | null {
  const {
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
    getElement,
    getParams,
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
    debugAudio,
    debugGeneral,
    debugUIEvents,
  } = options;

  const AC = audioContextRef.current;
  if (!AC) {
    abortInitialization('❌ AudioContext not initialized. This should not happen.');
    return null;
  }
  sessionDisposer.add(resourceScope.track('activeAudioContexts'));

  const state = new RuntimeAudioSessionState(resourceScope, DEVELOPMENT_DIAGNOSTICS_ENABLED);
  sessionDisposer.add(() => state.dispose());

  const audioSystem = initAudioSystem({
    AC,
    micStreamRef,
    leftAnalyserRef,
    rightAnalyserRef,
    leftTimeDataRef,
    rightTimeDataRef,
    stereoSplitterRef,
    getIsPlaying: () => state.isPlaying,
    setIsPlaying: (value: boolean) => { state.isPlaying = value; },
    getUsingMic: () => state.usingMic,
    setUsingMic: (value: boolean) => { state.usingMic = value; },
    getMediaEl: () => state.mediaElement,
    setMediaEl: (value: HTMLAudioElement | null) => state.setMediaElement(value),
    getCurrentPlayPromise: () => state.currentPlayPromise,
    setCurrentPlayPromise: (value: Promise<void> | null) => { state.currentPlayPromise = value; },
    setAudioStartTime: (value: number) => { state.audioStartTime = value; },
    getBeatCounter: () => state.beatCounter,
    resetBeatCounter: () => { state.beatCounter = 0; },
    getInitializationStartTime: () => state.initializationStartTime,
    setInitializationStartTime: (value: number) => { state.initializationStartTime = value; },
    getMonitorEnabled: () => state.monitorEnabled,
    setMonitorEnabledLocal: (value: boolean) => { state.monitorEnabled = value; },
    onMetadataUpdate: () => state.notifyMetadataUpdated(),
    querySelector: getElement,
    debugAudio,
  });

  if (!audioSystem) {
    abortInitialization('❌ Audio system failed to initialize');
    return null;
  }

  const {
    analyser,
    energyAnalyser,
    freqArr,
    timeArr,
    energyFreqArr,
    energyTimeArr,
    filteredFreqArr,
    beatDetectionFreqArr,
    trackMetadata,
    loadFile,
    unloadAudioFile,
    useMic,
    stopMic,
    connectNode,
    playButtonHandler,
    restartButtonHandler,
    dispose: disposeAudioSystem,
  } = audioSystem;

  sessionDisposer.add(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  });
  sessionDisposer.add(() => disposeAudioSystem());

  const audioUIController = createAudioUIController({
    AC,
    getElement,
    trackMetadata,
    getParams,
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
    loadFile,
    unloadAudioFile,
    useMic,
    playButtonHandler,
    restartButtonHandler,
    debugGeneral,
    debugUIEvents,
  });
  sessionDisposer.add(() => audioUIController.cleanup());
  audioUIController.exposeWindowBridges();
  const updateMetadataDisplay = audioUIController.updateMetadataDisplay;
  state.setMetadataUpdater(updateMetadataDisplay);
  (window as any).updateMetadataDisplay = updateMetadataDisplay;
  sessionDisposer.add(() => {
    const runtimeWindow = window as any;
    if (runtimeWindow.updateMetadataDisplay === updateMetadataDisplay) delete runtimeWindow.updateMetadataDisplay;
  });

  audioUIController.attachMicButton();
  audioUIController.attachAudioControlDelegation();

  return {
    AC,
    state,
    analyser,
    energyAnalyser,
    freqArr,
    timeArr,
    energyFreqArr,
    energyTimeArr,
    filteredFreqArr,
    beatDetectionFreqArr,
    rawSpikeFreqArr: new Uint8Array(analyser.frequencyBinCount),
    trackMetadata,
    loadFile,
    unloadAudioFile,
    useMic,
    stopMic,
    connectNode,
    playButtonHandler,
    restartButtonHandler,
    updateMetadataDisplay,
  };
}
