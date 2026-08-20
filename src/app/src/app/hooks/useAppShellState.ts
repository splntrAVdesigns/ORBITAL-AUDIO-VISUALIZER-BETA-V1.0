import { useState } from 'react';

export type AppViewState = 'landing' | 'loading' | 'main';

export function useAppShellState() {
  const [appState, setAppState] = useState<AppViewState>('landing');
  const [appReady, setAppReady] = useState(false);
  const [showCompatWarning, setShowCompatWarning] = useState(false);
  const [compatMissing, setCompatMissing] = useState<string[]>([]);

  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isLandscapeOnly, setIsLandscapeOnly] = useState(false);
  const [showIntroTutorial, setShowIntroTutorial] = useState(false);

  const [showKeyboardHelper, setShowKeyboardHelper] = useState(() => {
    const saved = localStorage.getItem('orbital-keyboard-helper-visible');
    return saved === 'true';
  });

  return {
    appState,
    setAppState,
    appReady,
    setAppReady,
    showCompatWarning,
    setShowCompatWarning,
    compatMissing,
    setCompatMissing,
    isMobileDevice,
    setIsMobileDevice,
    isLandscapeOnly,
    setIsLandscapeOnly,
    showIntroTutorial,
    setShowIntroTutorial,
    showKeyboardHelper,
    setShowKeyboardHelper,
  };
}