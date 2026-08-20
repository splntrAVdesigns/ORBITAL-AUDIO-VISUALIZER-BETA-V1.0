import { useEffect } from 'react';
import { checkBrowserCompatibility } from '../utils/browserCompat';
import {
  applyRuntimeParameterTransaction,
  readRuntimeParameterTransaction,
  RUNTIME_PARAMETER_TRANSACTION_EVENT,
  type RuntimeParameterTarget,
} from '../runtime/parameters/RuntimeParameterTransactions';

type AppState = 'landing' | 'loading' | 'main';

interface Options {
  appState: AppState;
  isMobileDevice: boolean;
  isLandscapeOnly: boolean;
  isAudioPlaying: boolean;
  settingsPanelOpen: boolean;
  playlist: unknown[];
  monitorEnabled: boolean;
  autoAdvance: boolean;
  shuffleEnabled: boolean;
  setIsMobileDevice: (value: boolean) => void;
  setIsLandscapeOnly: (value: boolean) => void;
  setShowIntroTutorial: (value: boolean) => void;
  setAutoAdvance: (value: boolean) => void;
  setShuffleEnabled: (value: boolean) => void;
  setAppReady: (value: boolean) => void;
  setSettingsPanelOpen: (value: boolean) => void;
  setCompatMissing: (value: string[]) => void;
  setShowCompatWarning: (value: boolean) => void;
}

export function useOrbitalAppLifecycle(options: Options) {
  const o = options;
  useEffect(() => {
    const update = () => {
      const mobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const small = window.innerWidth < 768;
      const portrait = window.innerHeight > window.innerWidth;
      o.setIsMobileDevice(mobileUA && small);
      o.setIsLandscapeOnly(!mobileUA && small && portrait);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, [o.setIsLandscapeOnly, o.setIsMobileDevice]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = readRuntimeParameterTransaction(event);
      const params = (window as any).params as RuntimeParameterTarget | undefined;
      if (params && detail) applyRuntimeParameterTransaction(params, detail.patch);
    };
    window.addEventListener(RUNTIME_PARAMETER_TRANSACTION_EVENT, handler);
    return () => window.removeEventListener(RUNTIME_PARAMETER_TRANSACTION_EVENT, handler);
  }, []);

  useEffect(() => {
    if (o.appState === 'main' && !o.isMobileDevice && !o.isLandscapeOnly && !localStorage.getItem('orbital-intro-completed')) o.setShowIntroTutorial(true);
  }, [o.appState, o.isLandscapeOnly, o.isMobileDevice, o.setShowIntroTutorial]);

  useEffect(() => {
    const saved = localStorage.getItem('orbital-auto-advance');
    if (saved !== null) o.setAutoAdvance(saved === 'true');
    if (localStorage.getItem('orbital-shuffle-enabled') === 'true') localStorage.setItem('orbital-shuffle-enabled', 'false');
    o.setShuffleEnabled(false);
  }, [o.setAutoAdvance, o.setShuffleEnabled]);

  useEffect(() => {
    if (o.appState !== 'main') { o.setAppReady(false); return; }
    const timer = window.setTimeout(() => o.setAppReady(true), 360);
    return () => window.clearTimeout(timer);
  }, [o.appState, o.setAppReady]);

  useEffect(() => {
    const button = document.getElementById('play');
    if (button) button.textContent = o.isAudioPlaying ? '❚❚' : '▶︎';
  }, [o.isAudioPlaying]);

  useEffect(() => { (window as any).playlist = o.playlist; }, [o.playlist]);
  useEffect(() => { (window as any).monitorEnabled = o.monitorEnabled; }, [o.monitorEnabled]);
  useEffect(() => { (window as any).autoAdvance = o.autoAdvance; }, [o.autoAdvance]);
  useEffect(() => { (window as any).shuffleEnabled = o.shuffleEnabled; }, [o.shuffleEnabled]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && o.settingsPanelOpen) o.setSettingsPanelOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [o.settingsPanelOpen, o.setSettingsPanelOpen]);

  useEffect(() => {
    const result = checkBrowserCompatibility();
    if (!result.compatible) { o.setCompatMissing(result.missing); o.setShowCompatWarning(true); }
  }, [o.setCompatMissing, o.setShowCompatWarning]);
}
