type PlaybackControllerDeps = {
  querySelector: (selector: string) => Element | null;
  audioContext: AudioContext;
  micStreamRef: { current: MediaStream | null };
  getMediaEl: () => HTMLAudioElement | null;
  setMediaEl: (mediaEl: HTMLAudioElement | null) => void;
  getIsPlaying: () => boolean;
  setIsPlaying: (value: boolean) => void;
  setUsingMic: (value: boolean) => void;
  getCurrentPlayPromise: () => Promise<void> | null;
  setCurrentPlayPromise: (value: Promise<void> | null) => void;
  resetBeatCounter: () => void;
  setAudioStartTime: (value: number) => void;
  getInitializationStartTime: () => number;
  setInitializationStartTime: (value: number) => void;
  debugAudio?: boolean;
};

export function createPlaybackController({
  querySelector,
  audioContext,
  micStreamRef,
  getMediaEl,
  setMediaEl,
  getIsPlaying,
  setIsPlaying,
  setUsingMic,
  getCurrentPlayPromise,
  setCurrentPlayPromise,
  resetBeatCounter,
  setAudioStartTime,
  getInitializationStartTime,
  setInitializationStartTime,
  debugAudio = false,
}: PlaybackControllerDeps) {
  const stopMic = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('✅ Mic track stopped:', track.label);
      });
      micStreamRef.current = null;
      setUsingMic(false);
      const setIsMicActiveFn = (window as any).setIsMicActive;
      if (setIsMicActiveFn) {
        setIsMicActiveFn(false);
      }
    }
  };

  const playButtonHandler = () => {
    const playBtn = querySelector('#play') as HTMLElement | null;
    if (!playBtn) {
      console.error('❌ Play button not found in DOM');
      return;
    }

    const mediaEl = getMediaEl();
    const isPlaying = getIsPlaying();

    console.log('🎮 Play button clicked - Checking state...', {
      hasMediaEl: !!mediaEl,
      mediaElSrc: mediaEl?.src || 'none',
      isPlaying,
      audioContextState: audioContext.state,
    });

    if (!mediaEl) {
      console.log('ℹ️ No audio loaded yet. Please upload or select a file from the playlist.');
      alert('⚠️ No audio loaded.\n\nPlease upload an audio file or select one from the playlist.');
      return;
    }

    if (!isPlaying) {
      console.log('▶️ Attempting to play audio...');
      console.log('   Audio element ready state:', mediaEl.readyState);
      console.log('   Audio element source:', mediaEl.src);
      console.log('   Audio Context state:', audioContext.state);

      setIsPlaying(true);

      if (audioContext.state !== 'running') {
        console.log('🔄 Resuming Audio Context...');
        audioContext.resume().then(() => {
          console.log('✅ Audio Context resumed, state:', audioContext.state);
        }).catch(err => {
          console.error('❌ Failed to resume Audio Context:', err);
        });
      }

      const playPromise = mediaEl.play();
      setCurrentPlayPromise(playPromise ?? null);

      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ Audio started playing successfully');
          playBtn.textContent = '❚❚';
          setAudioStartTime(performance.now());
          if (getInitializationStartTime() === 0) {
            setInitializationStartTime(performance.now());
          }
          setCurrentPlayPromise(null);
        }).catch(e => {
          if (e.name !== 'AbortError') {
            console.error('❌ Play error:', e);
            console.error('   Error name:', e.name);
            console.error('   Error message:', e.message);
            alert(`❌ Playback Error\n\n${e.message}\n\nTry reloading the audio file.`);
            setIsPlaying(false);
          } else {
            console.log('⚠️ Play aborted (likely interrupted by another play call)');
          }
          setCurrentPlayPromise(null);
        });
      } else {
        console.log('✅ Audio play() returned undefined (immediate success)');
        playBtn.textContent = '❚❚';
        setAudioStartTime(performance.now());
        setCurrentPlayPromise(null);
      }
    } else {
      console.log('⏸️ Attempting to pause audio...');
      setIsPlaying(false);
      resetBeatCounter();

      const currentPlayPromise = getCurrentPlayPromise();
      if (currentPlayPromise) {
        currentPlayPromise.catch(() => {}).then(() => {
          getMediaEl()?.pause();
          console.log('✅ Audio paused (after waiting for play promise)');
          playBtn.textContent = '▶︎';
          setCurrentPlayPromise(null);
        });
      } else {
        mediaEl.pause();
        console.log('✅ Audio paused');
        playBtn.textContent = '▶︎';
      }
    }

    if (debugAudio) {
      console.log('🎛️ Playback controller state updated');
    }
  };

  const restartButtonHandler = async () => {
    const mediaEl = getMediaEl();
    if (!mediaEl) {
      console.log('ℹ️ No audio loaded to restart');
      return;
    }

    console.log('⏮️ Restarting audio track...');
    mediaEl.currentTime = 0;

    if (getIsPlaying()) {
      try {
        audioContext.resume();
        const playPromise = mediaEl.play();
        setCurrentPlayPromise(playPromise ?? null);
        if (playPromise !== undefined) {
          await playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.warn('❌ Restart play error:', e);
            }
          });
        }
      } catch (e) {
        console.warn('⚠️ Restart error:', e);
      }
    }

    setAudioStartTime(performance.now());
    if (getInitializationStartTime() === 0) {
      setInitializationStartTime(performance.now());
    }

    console.log('✅ Audio restarted');
  };

  return {
    stopMic,
    playButtonHandler,
    restartButtonHandler,
  };
}