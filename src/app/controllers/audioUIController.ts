/**
 * ORBITAL — Audio UI Controller
 * Sprint 22D: keeps audio button wiring, mic UI glue, global audio UI bridges,
 * and metadata display updates out of App.tsx.
 *
 * This controller intentionally does not own the Web Audio graph. AudioSystemInit
 * still owns real audio routing/playback. This file only coordinates UI events
 * and metadata/state bridges used by React components and legacy DOM fallbacks.
 */
import {
  getActivePresetName,
  setActivePresetName,
  subscribeActivePresetName,
} from '../runtime/presetNameRuntimeStore';
import { formatPresetNameForHud } from '../runtime/presetHudLabel';

export interface AudioUIPlaylistItem {
  id: string;
  file: File;
  name: string;
  duration: number;
}

export interface AudioTrackMetadataLike {
  recTime: string;
  track: string;
  duration: string;
  timeLeft: string;
  sr: string;
  fft: string;
}

export interface AudioUIControllerOptions {
  AC: AudioContext;
  getElement: (selector: string) => any;
  trackMetadata: AudioTrackMetadataLike;
  getParams: () => any;
  playlist: AudioUIPlaylistItem[];
  autoAdvance: boolean;
  shuffleEnabled: boolean;

  setMetadata: (value: any) => void;
  setPlaylist: (value: AudioUIPlaylistItem[] | ((prev: AudioUIPlaylistItem[]) => AudioUIPlaylistItem[])) => void;
  setAudioTab: (value: 'controls' | 'playlist') => void;
  setCurrentTrackIndex: (value: number | ((prev: number) => number)) => void;
  setCurrentTime: (value: number) => void;
  setAudioDuration: (value: number) => void;
  setMonitorEnabled: (value: boolean) => void;
  setIsAudioPlaying: (value: boolean) => void;
  setIsMicActive: (value: boolean) => void;

  loadFile: (file: File) => Promise<void>;
  unloadAudioFile: () => Promise<void>;
  useMic: () => Promise<void>;
  playButtonHandler: () => void;
  restartButtonHandler: () => void;

  debugGeneral?: boolean;
  debugUIEvents?: boolean;
}

export interface AudioUIController {
  exposeWindowBridges: () => void;
  syncPlaylistWindow: () => void;
  syncPlayButtonIcon: (isPlaying: boolean) => void;
  updateMetadataDisplay: () => void;
  attachMicButton: () => void;
  attachAudioControlDelegation: () => void;
  cleanup: () => void;
}

export function createAudioUIController(options: AudioUIControllerOptions): AudioUIController {
  const {
    AC,
    getElement: $,
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
    debugGeneral = false,
    debugUIEvents = false,
  } = options;

  let micClickHandler: null | (() => void) = null;
  let audioDelegationHandler: null | ((e: Event) => void) = null;
  let unsubscribePresetName: null | (() => void) = null;

  const exposeWindowBridges = () => {
    window.loadFile = loadFile;
    window.unloadAudioFile = unloadAudioFile;
    window.AC = AC;
    window.setPlaylist = setPlaylist as any;
    window.setAudioTab = setAudioTab as any;
    window.setCurrentTrackIndex = setCurrentTrackIndex as any;
    window.setCurrentTime = setCurrentTime;
    window.setAudioDuration = setAudioDuration;
    window.setMonitorEnabled = setMonitorEnabled;
    window.setIsAudioPlaying = setIsAudioPlaying;
    window.setIsMicActive = setIsMicActive;
    (window as any).setCurrentPresetName = setActivePresetName;
    (window as any).playlist = playlist;
    (window as any).autoAdvance = autoAdvance;
    (window as any).shuffleEnabled = shuffleEnabled;
    (window as any).playButtonHandler = playButtonHandler;

    if (debugGeneral) {
      console.log('✅ Audio UI window bridges exposed:', {
        AC: !!window.AC,
        loadFile: !!window.loadFile,
        unloadAudioFile: !!window.unloadAudioFile,
        setPlaylist: !!window.setPlaylist,
        setAudioTab: !!window.setAudioTab,
        setCurrentTrackIndex: !!window.setCurrentTrackIndex,
        playlistLength: playlist.length,
        shuffleEnabled,
      });
    }
  };

  const syncPlaylistWindow = () => {
    (window as any).playlist = playlist;
    (window as any).autoAdvance = autoAdvance;
    (window as any).shuffleEnabled = shuffleEnabled;
  };

  const syncPlayButtonIcon = (isPlaying: boolean) => {
    const playBtn = document.getElementById('play') as HTMLButtonElement | null;
    if (playBtn) playBtn.textContent = isPlaying ? '❚❚' : '▶︎';
  };

  const updateMetadataDisplay = () => {
    try {
      const params = getParams();
      const currentPresetName = getActivePresetName();
      const bandMap: Record<string, string> = { full: 'FULL', bass: 'BASS', mid: 'MID', high: 'HIGH' };
      const bpm = params?.bpm?.toString?.() || '174';
      const band = bandMap[params?.frequencyBand] || 'FULL';
      const detect = params?.beatDetect ? 'ON' : 'OFF';

      setMetadata({
        recTime: trackMetadata.recTime,
        track: trackMetadata.track,
        duration: trackMetadata.duration,
        timeLeft: trackMetadata.timeLeft,
        sr: trackMetadata.sr,
        fft: trackMetadata.fft,
        bpm,
        band,
        detect,
        mode: currentPresetName,
      });

      // Legacy DOM fallbacks used by the compact audio metadata strip.
      const metaRecTime = $('#metaRecTime'); if (metaRecTime) metaRecTime.textContent = trackMetadata.recTime;
      const metaTrack   = $('#metaTrack');   if (metaTrack)   metaTrack.textContent   = trackMetadata.track;
      const metaDur     = $('#metaDur');     if (metaDur)     metaDur.textContent     = trackMetadata.duration;
      const metaTL      = $('#metaTL');      if (metaTL)      metaTL.textContent      = trackMetadata.timeLeft;
      const metaSR      = $('#metaSR');      if (metaSR)      metaSR.textContent      = trackMetadata.sr;
      const metaFFT     = $('#metaFFT');     if (metaFFT)     metaFFT.textContent     = trackMetadata.fft;
      const metaBPM     = $('#metaBPM');     if (metaBPM)     metaBPM.textContent     = bpm;
      const metaBand    = $('#metaBand');    if (metaBand)    metaBand.textContent    = band;
      const metaDetect  = $('#metaDetect');  if (metaDetect)  metaDetect.textContent  = detect;
      const metaMode = $('#metaMode');
      if (metaMode) {
        metaMode.textContent = formatPresetNameForHud(currentPresetName);
        metaMode.title = currentPresetName;
      }
    } catch (e) {
      console.error('Metadata display error:', e);
    }
  };

  unsubscribePresetName = subscribeActivePresetName(() => {
    updateMetadataDisplay();
  });

  const attachMicButton = () => {
    const micBtn = $('#mic') as HTMLElement | null;
    if (!micBtn) return;

    if (micClickHandler) micBtn.removeEventListener('click', micClickHandler);
    micClickHandler = async () => {
      try {
        await AC.resume();
        await useMic();
      } catch (e: any) {
        alert((e as Error).message);
      }
    };
    micBtn.addEventListener('click', micClickHandler);
  };

  const attachAudioControlDelegation = () => {
    if (audioDelegationHandler) document.removeEventListener('click', audioDelegationHandler);

    audioDelegationHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.id === 'play' || target.closest('#play')) {
        if (debugUIEvents) console.log('🎯 Play button click detected via event delegation');
        playButtonHandler();
      } else if (target.id === 'restartAudio' || target.closest('#restartAudio')) {
        if (debugUIEvents) console.log('🎯 Restart button click detected via event delegation');
        restartButtonHandler();
      }
    };

    document.addEventListener('click', audioDelegationHandler);
    if (debugGeneral) console.log('✅ Audio UI event delegation attached');
  };

  const cleanup = () => {
    const micBtn = $('#mic') as HTMLElement | null;
    if (micBtn && micClickHandler) micBtn.removeEventListener('click', micClickHandler);
    micClickHandler = null;

    if (audioDelegationHandler) document.removeEventListener('click', audioDelegationHandler);
    audioDelegationHandler = null;
    unsubscribePresetName?.();
    unsubscribePresetName = null;

    if (window.loadFile === loadFile) delete window.loadFile;
    if (window.unloadAudioFile === unloadAudioFile) delete window.unloadAudioFile;
    if ((window as any).setCurrentPresetName === setActivePresetName) {
      delete (window as any).setCurrentPresetName;
    }
  };

  return {
    exposeWindowBridges,
    syncPlaylistWindow,
    syncPlayButtonIcon,
    updateMetadataDisplay,
    attachMicButton,
    attachAudioControlDelegation,
    cleanup,
  };
}
