import { useState } from 'react';
import { safeLocalStorage } from '../../../utils/browserCompat';
import { detectDeviceGate } from '../../../boot/deviceGate';

export type AppViewState = 'landing' | 'loading' | 'main';

export function useAppShellState() {
  const [appState, setAppState] = useState<AppViewState>('landing');
  const [showCompatWarning, setShowCompatWarning] = useState(false);
  const [compatMissing, setCompatMissing] = useState<string[]>([]);

  // Sprint L1: evaluated synchronously on first render (not in an effect) so a
  // blocked device is caught before Landing ever paints a frame.
  const [{ isMobileDevice, isLandscapeOnly }, setDeviceGate] = useState(detectDeviceGate);
  const [showIntroTutorial, setShowIntroTutorial] = useState(false);

  const [showKeyboardHelper, setShowKeyboardHelper] = useState(() => {
    const saved = safeLocalStorage.getItem('orbital-keyboard-helper-visible');
    return saved === 'true';
  });

  return {
    appState,
    setAppState,
    showCompatWarning,
    setShowCompatWarning,
    compatMissing,
    setCompatMissing,
    isMobileDevice,
    isLandscapeOnly,
    setDeviceGate,
    showIntroTutorial,
    setShowIntroTutorial,
    showKeyboardHelper,
    setShowKeyboardHelper,
  };
}