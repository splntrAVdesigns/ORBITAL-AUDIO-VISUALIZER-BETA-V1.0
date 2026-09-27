import { useEffect } from 'react';
import { checkBrowserCompatibility } from '../utils/browserCompat';
import { detectDeviceGate, type DeviceGate } from '../boot/deviceGate';
import { safeLocalStorage } from '../utils/browserCompat';
import { isReturningSession, markSessionBooted } from '../boot/sessionBoot';
import {
  applyRuntimeParameterTransaction,
  readRuntimeParameterTransaction,
  RUNTIME_PARAMETER_TRANSACTION_EVENT,
  type RuntimeParameterTarget,
} from '../runtime/parameters/RuntimeParameterTransactions';

type AppState = 'landing' | 'loading' | 'main';

// Sprint L4: bump whenever onboarding content materially changes. A version bump
// re-shows the tutorial once per browser (even to someone who previously opted out)
// without touching the opt-out state for versions already shown.
export const ONBOARDING_VERSION = '1';
const ONBOARDING_OPT_OUT_KEY = `orbital.onboarding.optOut.v${ONBOARDING_VERSION}`;
const ONBOARDING_SHOWN_SESSION_KEY = `orbital.onboarding.shown.v${ONBOARDING_VERSION}`;

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
  setDeviceGate: (value: DeviceGate) => void;
  setShowIntroTutorial: (value: boolean) => void;
  setAutoAdvance: (value: boolean) => void;
  setShuffleEnabled: (value: boolean) => void;
  setSettingsPanelOpen: (value: boolean) => void;
  setCompatMissing: (value: string[]) => void;
  setShowCompatWarning: (value: boolean) => void;
}

/** Sprint L4: true once per tab for this onboarding version — set by App.tsx on close. */
export function markOnboardingShownThisSession(): void {
  try { window.sessionStorage.setItem(ONBOARDING_SHOWN_SESSION_KEY, '1'); } catch { /* unavailable */ }
}

/** Sprint L4: permanent opt-out for this onboarding version only — a future version bump clears it. */
export function setOnboardingOptedOut(): void {
  safeLocalStorage.setItem(ONBOARDING_OPT_OUT_KEY, 'true');
}

function shouldShowOnboarding(): boolean {
  if (safeLocalStorage.getItem(ONBOARDING_OPT_OUT_KEY) === 'true') return false;
  try {
    if (window.sessionStorage.getItem(ONBOARDING_SHOWN_SESSION_KEY) === '1') return false;
  } catch { /* if sessionStorage is unavailable, fall through and show it */ }
  return true;
}

export function useOrbitalAppLifecycle(options: Options) {
  const o = options;
  useEffect(() => {
    const update = () => o.setDeviceGate(detectDeviceGate());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, [o.setDeviceGate]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = readRuntimeParameterTransaction(event);
      const params = (window as any).params as RuntimeParameterTarget | undefined;
      if (params && detail) applyRuntimeParameterTransaction(params, detail.patch);
    };
    window.addEventListener(RUNTIME_PARAMETER_TRANSACTION_EVENT, handler);
    return () => window.removeEventListener(RUNTIME_PARAMETER_TRANSACTION_EVENT, handler);
  }, []);

  // Sprint L4: session-aware, versioned onboarding (replaces the single permanent
  // 'orbital-intro-completed' flag, which meant the tutorial could show at most once
  // per browser, ever, with no way to bring it back for a new feature set).
  useEffect(() => {
    if (o.appState === 'main' && !o.isMobileDevice && !o.isLandscapeOnly && shouldShowOnboarding()) {
      o.setShowIntroTutorial(true);
    }
  }, [o.appState, o.isLandscapeOnly, o.isMobileDevice, o.setShowIntroTutorial]);

  useEffect(() => {
    const saved = localStorage.getItem('orbital-auto-advance');
    if (saved !== null) o.setAutoAdvance(saved === 'true');
    if (localStorage.getItem('orbital-shuffle-enabled') === 'true') localStorage.setItem('orbital-shuffle-enabled', 'false');
    o.setShuffleEnabled(false);
  }, [o.setAutoAdvance, o.setShuffleEnabled]);

  // Sprint L2/L4: marks this tab as booted once the real app is up, so a same-tab
  // reload (isReturningSession()) can skip the loader's minimum brand hold. Boot
  // readiness itself (when the loader dismisses) is owned by boot/bootReadiness.ts —
  // there is no fixed reveal timer here any more.
  useEffect(() => {
    if (o.appState === 'main') markSessionBooted();
  }, [o.appState]);

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

export { isReturningSession };
