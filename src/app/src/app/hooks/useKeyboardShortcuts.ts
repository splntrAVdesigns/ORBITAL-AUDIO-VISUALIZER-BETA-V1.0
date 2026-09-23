type KeyboardShortcutDeps = {
  isTypingTarget: (el: Element | null) => boolean;
  toggleCollapse: () => void;
  mediaEl: HTMLMediaElement | null;
  $: (selector: string) => Element | null;
  params: { vizMode: number };
  palettes: Array<{ name: string }>;
  getSelectedPaletteIndex: () => number;
  setSelectedPaletteIndex: (value: number) => void;
  recorder: MediaRecorder | null;
  stopRecording: () => void;
  captureScreenshot: () => void;
  toggleFullscreen: () => void;
  setShowKeyboardHelper: React.Dispatch<React.SetStateAction<boolean>>;
  debugUiEvents: boolean;
};
 
function isProtectedTextEntry(target: EventTarget | Element | null): boolean {
  const element = target instanceof Element ? target : null;
  if (!element) return false;
  if ((element as HTMLElement).isContentEditable || element.closest('[contenteditable="true"]')) return true;
  if (element.tagName === 'TEXTAREA') return true;
  if (element.tagName !== 'INPUT') return false;
  const type = ((element as HTMLInputElement).type || 'text').toLowerCase();
  return ['text', 'search', 'email', 'url', 'tel', 'password'].includes(type);
}

export function createKeyboardShortcutHandler({
  isTypingTarget,
  toggleCollapse,
  mediaEl,
  $,
  params,
  palettes,
  getSelectedPaletteIndex,
  setSelectedPaletteIndex,
  recorder,
  stopRecording,
  captureScreenshot,
  toggleFullscreen,
  setShowKeyboardHelper,
  debugUiEvents,
}: KeyboardShortcutDeps) {
  return (e: KeyboardEvent) => {
    // Fullscreen remains available after interacting with sliders, toggles,
    // selects, and number fields. True text-entry fields still own the F key.
    if (e.code === 'KeyF') {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : document.activeElement;
      if (isProtectedTextEntry(target)) return;
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    if (isTypingTarget(document.activeElement)) return;

    if (e.code === 'KeyH') {
      e.preventDefault();
      toggleCollapse();
    } else if (e.code === 'Space') {
      e.preventDefault();
      const playBtn = $('#play') as HTMLButtonElement | null;
      if (playBtn) {
        playBtn.click();
        if (debugUiEvents) console.log('⌨️ SPACE pressed - Play/Pause toggled');
      }
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      if (mediaEl) {
        mediaEl.muted = !mediaEl.muted;
        if (debugUiEvents) console.log('⌨️ M pressed - Mute toggled:', mediaEl.muted);
      }
    } else if (e.code === 'Digit1') {
      e.preventDefault();
      params.vizMode = 0;
      const vizModeSelect = $('#vizMode') as HTMLSelectElement | null;
      if (vizModeSelect) vizModeSelect.value = '0';
      console.log('⌨️ 1 pressed - Switched to Electric Chaos');
    } else if (e.code === 'Digit2') {
      e.preventDefault();
      params.vizMode = 1;
      const vizModeSelect = $('#vizMode') as HTMLSelectElement | null;
      if (vizModeSelect) vizModeSelect.value = '1';
      console.log('⌨️ 2 pressed - Switched to Particle Storm');
    } else if (e.code === 'Digit3') {
      e.preventDefault();
      params.vizMode = 2;
      const vizModeSelect = $('#vizMode') as HTMLSelectElement | null;
      if (vizModeSelect) vizModeSelect.value = '2';
      console.log('⌨️ 3 pressed - Switched to Heatmap Bars');
    } else if (e.code === 'Digit4') {
      e.preventDefault();
      params.vizMode = 3;
      const vizModeSelect = $('#vizMode') as HTMLSelectElement | null;
      if (vizModeSelect) vizModeSelect.value = '3';
      console.log('⌨️ 4 pressed - Switched to Waveform Trails');
    } else if (e.code === 'KeyC') {
      e.preventDefault();
      const nextIndex = (getSelectedPaletteIndex() + 1) % palettes.length;
      setSelectedPaletteIndex(nextIndex);
      console.log('⌨️ C pressed - Color theme cycled to:', palettes[nextIndex]?.name);
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      if (recorder && recorder.state === 'recording') {
        stopRecording();
        console.log('⌨️ R pressed - Recording stopped');
      } else {
        const recBtn = $('#rec') as HTMLElement | null;
        if (recBtn) {
          recBtn.click();
          console.log('⌨️ R pressed - Recording started');
        }
      }
    } else if (e.code === 'KeyS') {
      e.preventDefault();
      captureScreenshot();
      console.log('⌨️ S pressed - Screenshot captured');
    } else if (e.key === '?' && e.shiftKey) {
      e.preventDefault();
      setShowKeyboardHelper(prev => {
        const newValue = !prev;
        // Inline try/catch (not the safeLocalStorage wrapper): this file is
        // transpiled standalone by scripts/test-recording-controls.mjs, which
        // copies it in isolation with no module resolution, so it must not
        // depend on any external import.
        try {
          localStorage.setItem('orbital-keyboard-helper-visible', String(newValue));
        } catch (err) {
          console.warn('localStorage.setItem failed for key "orbital-keyboard-helper-visible":', err);
        }
        return newValue;
      });
      console.log('⌨️ ? pressed - Keyboard helper toggled');
    }
  };
}