/**
 * ORBITAL — Audio System Initializer
 * Owns the full audio pipeline: dual-analyser setup, typed arrays, BPM detection,
 * mic input, file loading, and playback controller wiring.
 *
 * Extracted from App.tsx (Phase 3 refactor) using Pattern B (imperative module).
 *
 * Usage:
 *   const audio = initAudioSystem({ AC, micStreamRef, ... });
 *   const { analyser, freqArr, loadFile, useMic, stopMic, ... } = audio;
 *   // App.tsx then defines updateMetadataDisplay using audio.trackMetadata + closure
 *   // and sets: audio.onMetadataUpdate = updateMetadataDisplay;
 */

import { createPlaybackController } from '../src/app/hooks/usePlaybackController';
import { formatDuration as formatTime } from '../utils/trackMetadataManager';
import type { MutableRefObject } from 'react';
import { bpmClockRuntime } from '../runtime/bpm/BpmClockRuntime';
import { type BpmDetectionResult } from '../runtime/bpm/BpmDetector';
import { runBpmAnalysis, terminateBpmAnalysisWorker } from '../runtime/bpm/BpmAnalysisWorkerClient';
import { audioObjectUrlRegistry } from '../runtime/audio/AudioObjectUrlRegistry';
import { LatestOnlySerializedAnalysisQueue } from '../runtime/audio/SerializedBpmAnalysisQueue';
import { DEVELOPMENT_DIAGNOSTICS_ENABLED } from '../config/runtimeEnvironment';
import {
  AUDIO_FILE_MAX_BYTES,
  AUDIO_TRACK_MAX_DURATION_SECONDS,
  formatResourceBytes,
  validateBpmAnalysisResource,
  validateDecodedBpmAudioResource,
} from '../config/resourceLimits';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrackMetadata {
  recTime: string;
  track:   string;
  duration: string;
  timeLeft: string;
  sr:      string;
  fft:     string;
  bpm:     string;
}

export interface AudioSystemInitOptions {
  AC: AudioContext;

  // React refs — must be passed directly (can't go on window)
  micStreamRef:       MutableRefObject<MediaStream | null>;
  leftAnalyserRef:    MutableRefObject<AnalyserNode | null>;
  rightAnalyserRef:   MutableRefObject<AnalyserNode | null>;
  leftTimeDataRef:    MutableRefObject<Float32Array | null>;
  rightTimeDataRef:   MutableRefObject<Float32Array | null>;
  stereoSplitterRef:  MutableRefObject<ChannelSplitterNode | null>;

  // Mutable App.tsx closure var access via getter/setter callbacks.
  // RAF reads these vars directly; audio system writes via these callbacks.
  getIsPlaying:               () => boolean;
  setIsPlaying:               (v: boolean) => void;
  getUsingMic:                () => boolean;
  setUsingMic:                (v: boolean) => void;
  getMediaEl:                 () => HTMLAudioElement | null;
  setMediaEl:                 (v: HTMLAudioElement | null) => void;
  getCurrentPlayPromise:      () => Promise<void> | null;
  setCurrentPlayPromise:      (v: Promise<void> | null) => void;
  setAudioStartTime:          (v: number) => void;
  getBeatCounter:             () => number;
  resetBeatCounter:           () => void;
  getInitializationStartTime: () => number;
  setInitializationStartTime: (v: number) => void;
  getMonitorEnabled:          () => boolean;
  setMonitorEnabledLocal:     (v: boolean) => void;

  /**
   * Called whenever audio metadata changes (track loaded, BPM detected, etc.).
   * App.tsx sets this to its `updateMetadataDisplay` function after init returns.
   * The ref pattern breaks the circular dependency: AudioSystem needs metadata state
   * from App.tsx, but App.tsx needs trackMetadata from AudioSystem.
   */
  onMetadataUpdate: () => void;

  querySelector: (selector: string) => Element | null;
  debugAudio: boolean;
}

export interface AudioSystemResult {
  // Analyser nodes — RAF fills typed arrays from these every frame
  analyser:       AnalyserNode;
  energyAnalyser: AnalyserNode;

  // Pre-allocated typed arrays — RAF reads these every frame (zero per-frame allocation)
  freqArr:              Uint8Array<ArrayBuffer>;
  timeArr:              Uint8Array<ArrayBuffer>;
  energyFreqArr:        Uint8Array<ArrayBuffer>;
  energyTimeArr:        Uint8Array<ArrayBuffer>;
  filteredFreqArr:      Uint8Array<ArrayBuffer>;
  beatDetectionFreqArr: Uint8Array<ArrayBuffer>;

  // Shared metadata object — App.tsx and RecordingEngine write recTime; loadFile writes rest
  trackMetadata: TrackMetadata;

  // Public API
  loadFile:     (file: File) => Promise<void>;
  unloadAudioFile: () => Promise<void>;
  useMic:       () => Promise<void>;
  stopMic:      () => void;
  connectNode:  (node: AudioNode | MediaStreamAudioSourceNode | MediaElementAudioSourceNode) => void;
  detectBPM:    (file: File) => Promise<number>;

  // Playback handlers — exposed to window and keyboard shortcut handler
  playButtonHandler:    () => void;
  restartButtonHandler: () => void;

  // Full teardown: stop mic and disconnect the active source
  dispose: () => void;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export function initAudioSystem(opts: AudioSystemInitOptions): AudioSystemResult | null {
  const {
    AC,
    micStreamRef, leftAnalyserRef, rightAnalyserRef,
    leftTimeDataRef, rightTimeDataRef, stereoSplitterRef,
    getIsPlaying, setIsPlaying,
    getUsingMic, setUsingMic,
    getMediaEl, setMediaEl,
    getCurrentPlayPromise, setCurrentPlayPromise,
    setAudioStartTime,
    resetBeatCounter,
    getInitializationStartTime, setInitializationStartTime,
    getMonitorEnabled, setMonitorEnabledLocal,
    querySelector: $,
    debugAudio,
  } = opts;

  // ── Dual-Analyser Setup ──────────────────────────────────────────────────────
  // PRIMARY: FFT slider controls spike count only
  // ENERGY:  Locked at 2048 — drives dots, colours, VU meter, beat detection

  let analyser: AnalyserNode;
  let energyAnalyser: AnalyserNode;

  try {
    analyser = AC.createAnalyser();
    analyser.fftSize              = 2 ** 7; // 128 — controlled by FFT slider via bind()
    // REVERTED (2026-09-24): "Sprint Integrity Lock" changed this to 0.48
    // based on a stored project note claiming that value was empirically
    // confirmed optimal. That note predates this reference build, which
    // ships 0.04 as the approved, "spike ring at its best" value — the note
    // was stale, not the code. Restored to match the approved reference.
    // Do not change again without side-by-side comparison against the
    // actual reference build, not against a written note.
    analyser.smoothingTimeConstant = 0.04;
    analyser.minDecibels          = -90;
    analyser.maxDecibels          = -25;

    energyAnalyser = AC.createAnalyser();
    energyAnalyser.fftSize              = 2048; // LOCKED — never changed by FFT slider
    energyAnalyser.smoothingTimeConstant = 0.035;
    energyAnalyser.minDecibels          = -90;
    energyAnalyser.maxDecibels          = -25;

    // Stereo analysis branch — for vectorscope / core particles
    const leftAnalyser  = AC.createAnalyser();
    const rightAnalyser = AC.createAnalyser();
    leftAnalyser.fftSize  = rightAnalyser.fftSize  = 1024;
    leftAnalyser.smoothingTimeConstant  = rightAnalyser.smoothingTimeConstant  = 0.06;
    leftAnalyser.minDecibels  = rightAnalyser.minDecibels  = -90;
    leftAnalyser.maxDecibels  = rightAnalyser.maxDecibels  = -25;
    leftAnalyserRef.current  = leftAnalyser;
    rightAnalyserRef.current = rightAnalyser;
    leftTimeDataRef.current  = new Float32Array(leftAnalyser.fftSize);
    rightTimeDataRef.current = new Float32Array(rightAnalyser.fftSize);

    if (AC.state === 'suspended') {
      AC.resume().then(() => {
        if (debugAudio) console.log('✅ AudioContext resumed');
      });
    }
  } catch (e) {
    console.error('❌ Analyser initialization error:', e);
    return null;
  }

  // ── Audio Limiter ─────────────────────────────────────────────────────────────
  let audioLimiter: DynamicsCompressorNode | null = null;
  try {
    audioLimiter = AC.createDynamicsCompressor();
    audioLimiter.threshold.value = -3;
    audioLimiter.knee.value      =  0;
    audioLimiter.ratio.value     = 20;
    audioLimiter.attack.value    = 0.003;
    audioLimiter.release.value   = 0.25;
  } catch (e) {
    console.warn('⚠️ Failed to create audio limiter:', e);
  }

  // ── Pre-allocated typed arrays (zero per-frame allocation) ───────────────────
  const freqArr              = new Uint8Array(analyser.frequencyBinCount);
  const timeArr              = new Uint8Array(analyser.fftSize);
  const energyFreqArr        = new Uint8Array(energyAnalyser.frequencyBinCount);
  const energyTimeArr        = new Uint8Array(energyAnalyser.fftSize);
  const filteredFreqArr      = new Uint8Array(analyser.frequencyBinCount);
  const beatDetectionFreqArr = new Uint8Array(analyser.frequencyBinCount);

  // Initialise time-domain arrays with 128 (silence) — prevents meter spike on load
  timeArr.fill(128);
  energyTimeArr.fill(128);

  // ── Track metadata ──────────────────────────────────────────────────────────
  const trackMetadata: TrackMetadata = {
    recTime:  '—',
    track:    '—',
    duration: '—',
    timeLeft: '—',
    sr:       '—',
    fft:      '256',
    bpm:      '—',
  };

  // ── Audio Worker ─────────────────────────────────────────────────────────────

  // ── Internal state ───────────────────────────────────────────────────────────
  let sourceNode: AudioNode | null = null;
  let activePlaybackObjectUrl: string | null = null;
  let mediaLoadRevision = 0;
  let cancelPendingMediaLoad: (() => void) | null = null;
  let disposed = false;
  let micVisualGainNode: GainNode | null = null;
  let activeStereoSplitter: ChannelSplitterNode | null = null;
  let graphRevision = 0;
  let currentMicStatus = 'idle';
  const setMicDiagnostic = (status: string) => {
    currentMicStatus = status;
    if (DEVELOPMENT_DIAGNOSTICS_ENABLED) (window as any).__ORBITAL_MIC_STATUS__ = status;
    const el = document.getElementById('micStatusDiagnostic');
    if (el) el.textContent = status;
  };

  // ── connectNode ──────────────────────────────────────────────────────────────
  function connectNode(node: any): void {
    try {
      if (sourceNode) { try { sourceNode.disconnect(); } catch { } }
      if (activeStereoSplitter) { try { activeStereoSplitter.disconnect(); } catch { } activeStereoSplitter = null; }
      if (audioLimiter) { try { audioLimiter.disconnect(); } catch { } }
      sourceNode = node;
      graphRevision++;

      if (audioLimiter) {
        sourceNode!.connect(audioLimiter);
        if (getMonitorEnabled()) {
          audioLimiter.connect(AC.destination);
        }
        audioLimiter.connect(analyser);
        audioLimiter.connect(energyAnalyser);
      } else {
        if (getMonitorEnabled()) { sourceNode!.connect(AC.destination); }
        sourceNode!.connect(analyser);
        sourceNode!.connect(energyAnalyser);
      }

      // Stereo branch
      if (leftAnalyserRef.current && rightAnalyserRef.current) {
        const stereoSplitter = AC.createChannelSplitter(2);
        sourceNode!.connect(stereoSplitter);
        stereoSplitter.connect(leftAnalyserRef.current,  0);
        stereoSplitter.connect(rightAnalyserRef.current, 1);
        activeStereoSplitter = stereoSplitter;
        stereoSplitterRef.current = stereoSplitter;
      }
      if (DEVELOPMENT_DIAGNOSTICS_ENABLED) (window as any).__ORBITAL_AUDIO_GRAPH__ = {
        revision: graphRevision,
        contextState: AC.state,
        baseLatency: AC.baseLatency || 0,
        outputLatency: (AC as any).outputLatency || 0,
        monitored: getMonitorEnabled(),
        sourceType: node?.constructor?.name || 'AudioNode',
      };
    } catch (e) {
      console.error('❌ connectNode error:', e);
    }
  }

  // ── BPM Detection ────────────────────────────────────────────────────────────
  interface BpmAnalysisJob {
    readonly file: File;
    readonly durationSeconds: number;
  }

  async function detectBPMDetailed(job: BpmAnalysisJob): Promise<BpmDetectionResult | null> {
    const { file, durationSeconds } = job;
    let arrayBuffer: ArrayBuffer | null = null;
    let audioBuffer: AudioBuffer | null = null;
    let channels: Float32Array[] | null = null;
    try {
      const preflight = validateBpmAnalysisResource(file.size, durationSeconds, AC.sampleRate);
      if (!preflight.valid) {
        console.warn(`[ORBITAL audio] ${preflight.reason}`);
        return null;
      }
      arrayBuffer = await file.arrayBuffer();
      audioBuffer = await AC.decodeAudioData(arrayBuffer);
      arrayBuffer = null;
      const decodedValidation = validateDecodedBpmAudioResource(audioBuffer.length, audioBuffer.numberOfChannels);
      if (!decodedValidation.valid) {
        console.warn(`[ORBITAL audio] ${decodedValidation.reason}`);
        return null;
      }
      channels = [];
      for (let index = 0; index < audioBuffer.numberOfChannels; index += 1) {
        channels.push(audioBuffer.getChannelData(index));
      }
      return await runBpmAnalysis(channels, audioBuffer.sampleRate);
    } catch (error) {
      console.error('BPM detection error:', error);
      return null;
    } finally {
      channels = null;
      audioBuffer = null;
      arrayBuffer = null;
    }
  }

  const bpmAnalysisQueue = new LatestOnlySerializedAnalysisQueue<BpmAnalysisJob, BpmDetectionResult>(detectBPMDetailed);

  async function detectBPM(file: File): Promise<number> {
    const durationSeconds = getMediaEl()?.duration ?? Number.NaN;
    const validation = validateBpmAnalysisResource(file.size, durationSeconds, AC.sampleRate);
    if (!validation.valid) return 0;
    const outcome = await bpmAnalysisQueue.enqueue({ file, durationSeconds });
    return outcome.status === 'completed' ? outcome.value?.bpm ?? 0 : 0;
  }

  function scheduleAutomaticBpmAnalysis(file: File, durationSeconds: number): void {
    const validation = validateBpmAnalysisResource(file.size, durationSeconds, AC.sampleRate);
    if (!validation.valid) {
      trackMetadata.bpm = '—';
      bpmClockRuntime.setAutoUnavailable();
      opts.onMetadataUpdate();
      console.warn(`[ORBITAL audio] ${validation.reason}`);
      return;
    }
    bpmClockRuntime.beginAutoAnalysis();
    void bpmAnalysisQueue.enqueue({ file, durationSeconds }).then((outcome) => {
      if (disposed || outcome.status === 'disposed' || outcome.status === 'superseded') return;
      if (outcome.status === 'completed' && outcome.value) {
        trackMetadata.bpm = `${outcome.value.bpm}`;
        bpmClockRuntime.setAutoBpm(outcome.value.bpm, performance.now(), outcome.value.confidence);
      } else {
        if (outcome.status === 'failed') console.error('BPM detection failed:', outcome.error);
        trackMetadata.bpm = '—';
        bpmClockRuntime.setAutoUnavailable();
      }
      opts.onMetadataUpdate();
    });
  }

  function revokeActivePlaybackObjectUrl(): void {
    const url = activePlaybackObjectUrl;
    activePlaybackObjectUrl = null;
    if (url) audioObjectUrlRegistry.revoke(url);
  }

  function detachMediaElement(
    el: HTMLAudioElement | null,
    ownedUrl: string | null = activePlaybackObjectUrl,
  ): void {
    if (ownedUrl && activePlaybackObjectUrl === ownedUrl) activePlaybackObjectUrl = null;
    if (el) {
      try { el.pause(); } catch { }
      try { el.removeAttribute('src'); } catch { }
      try { el.load(); } catch { }
    }
    if (ownedUrl) audioObjectUrlRegistry.revoke(ownedUrl);
  }

  async function unloadAudioFile(): Promise<void> {
    mediaLoadRevision += 1;
    cancelPendingMediaLoad?.();
    cancelPendingMediaLoad = null;
    bpmAnalysisQueue.invalidate();
    const pendingPlay = getCurrentPlayPromise();
    setCurrentPlayPromise(null);
    const currentElement = getMediaEl();
    detachMediaElement(currentElement);
    if (pendingPlay) await pendingPlay.catch(() => {});
    setMediaEl(null);
    window.mediaEl = null;
    setIsPlaying(false);
    if (window.setIsAudioPlaying) window.setIsAudioPlaying(false);

    if (sourceNode) {
      try { sourceNode.disconnect(); } catch { }
      sourceNode = null;
    }
    if (activeStereoSplitter) {
      try { activeStereoSplitter.disconnect(); } catch { }
      activeStereoSplitter = null;
      stereoSplitterRef.current = null;
    }

    trackMetadata.track = '—';
    trackMetadata.duration = '—';
    trackMetadata.timeLeft = '—';
    trackMetadata.bpm = '—';
    bpmClockRuntime.setAutoUnavailable();
    opts.onMetadataUpdate();
  }

  // ── Playback controller (stop/play/restart handlers) ─────────────────────────
  const playbackController = createPlaybackController({
    querySelector: $,
    audioContext: AC,
    micStreamRef,
    getMediaEl,
    setMediaEl: (value) => {
      setMediaEl(value);
      window.mediaEl = value as any;
    },
    getIsPlaying,
    setIsPlaying,
    setUsingMic,
    getCurrentPlayPromise,
    setCurrentPlayPromise,
    resetBeatCounter,
    setAudioStartTime,
    getInitializationStartTime,
    setInitializationStartTime,
    debugAudio,
  });

  const { stopMic, playButtonHandler, restartButtonHandler } = playbackController;

  // ── useMic ───────────────────────────────────────────────────────────────────
  async function useMic(): Promise<void> {
    setMicDiagnostic('requesting permission');
    stopMic();
    if (micVisualGainNode) {
      try { micVisualGainNode.disconnect(); } catch { }
      micVisualGainNode = null;
    }
    setUsingMic(true);
    setIsPlaying(false);
    resetBeatCounter();

    const setIsAudioPlayingFn = window.setIsAudioPlaying;
    if (setIsAudioPlayingFn) setIsAudioPlayingFn(false);

    const mediaEl = getMediaEl();
    if (mediaEl) {
      const promise = getCurrentPlayPromise();
      if (promise) { await promise.catch(() => {}); setCurrentPlayPromise(null); }
      mediaEl.pause();
    }

    // Auto-disable monitor to prevent feedback
    const monitorCheckbox = $('#monitor') as HTMLInputElement | null;
    const wasMonitorEnabled = getMonitorEnabled();
    if (wasMonitorEnabled) {
      setMonitorEnabledLocal(false);
      if (monitorCheckbox) monitorCheckbox.checked = false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      micStreamRef.current = stream;
      if (AC.state === 'suspended') await AC.resume().catch(() => undefined);
      const source = AC.createMediaStreamSource(stream);
      // Sprint 22I: analyser-only mic trim. Browser mic levels in Vercel/Chrome can
      // arrive quiet with autoGainControl disabled, so we boost visual detection
      // before the analyser chain without changing any user-facing controls.
      // Re-read after the await: a second mic request can set this node while
      // getUserMedia is pending, so the guard is real even though TypeScript
      // narrowed the variable to null earlier in this function.
      const pendingMicGainNode = micVisualGainNode as GainNode | null;
      if (pendingMicGainNode) { try { pendingMicGainNode.disconnect(); } catch { } }
      micVisualGainNode = AC.createGain();
      micVisualGainNode.gain.value = 1.68;
      source.connect(micVisualGainNode);
      connectNode(micVisualGainNode);
      setMicDiagnostic('stream connected + visual boost');

      const playBtn = $('#play') as HTMLButtonElement | null;
      if (playBtn) playBtn.disabled = true;

      const setIsMicActiveFn = window.setIsMicActive;
      if (setIsMicActiveFn) setIsMicActiveFn(true);

      setAudioStartTime(performance.now());
      if (getInitializationStartTime() === 0) setInitializationStartTime(performance.now());

      if (wasMonitorEnabled) {
        setTimeout(() => {
          alert('🎤 MICROPHONE ENABLED\n\n' +
            '⚠️ Monitor has been automatically disabled to prevent audio feedback.\n\n' +
            'This safeguard prevents your speakers from creating a feedback loop with the microphone.\n\n' +
            'You can re-enable Monitor after switching back to audio playback.');
        }, 100);
      }
      setTimeout(() => {
        analyser.getByteFrequencyData(freqArr);
        let peak = 0;
        for (let i = 0; i < freqArr.length; i++) if (freqArr[i] > peak) peak = freqArr[i];
        setMicDiagnostic(peak > 0 ? 'receiving signal' : 'connected / no signal yet');
      }, 350);
      console.log('✅ Microphone activated');
    } catch (e: any) {
      setMicDiagnostic(`failed: ${e?.name || 'unknown'}`);
      if (e.name !== 'NotAllowedError') console.error('❌ Microphone error:', e);
      else console.log('ℹ️ Microphone permission denied by user');

      let msg = '❌ MICROPHONE ACCESS FAILED\n\n';
      if      (e.name === 'NotAllowedError')     msg += 'PERMISSION DENIED\n\n🔧 Click the 🔒 lock icon in Chrome\'s address bar → Set "Microphone" to "Allow" → Refresh.';
      else if (e.name === 'NotFoundError')        msg += 'NO MICROPHONE DETECTED\nCheck that your mic is plugged in and recognised.';
      else if (e.name === 'NotReadableError')     msg += 'MICROPHONE IN USE\nClose other apps using the mic (Zoom, Discord…) and retry.';
      else if (e.name === 'OverconstrainedError') msg += 'MICROPHONE SETTINGS ERROR\nTry a different microphone.';
      else if (e.name === 'SecurityError')        msg += 'SECURITY ERROR\nMicrophone access blocked. Ensure you\'re on HTTPS.';
      else                                        msg += `UNKNOWN ERROR: ${e.name}\n${e.message}\nTry refreshing the page.`;
      alert(msg);
    }
  }

  // ── loadFile ─────────────────────────────────────────────────────────────────
  async function loadFile(file: File): Promise<void> {
    if (!(file instanceof File) || file.size <= 0 || file.size > AUDIO_FILE_MAX_BYTES) {
      throw new Error(`Audio files must be non-empty and no larger than ${formatResourceBytes(AUDIO_FILE_MAX_BYTES)}.`);
    }
    const loadRevision = ++mediaLoadRevision;
    cancelPendingMediaLoad?.();
    cancelPendingMediaLoad = null;
    let loadElement: HTMLAudioElement | null = null;
    let loadPlaybackUrl: string | null = null;
    try {
      stopMic();
      setUsingMic(false);
      const setIsMicActiveFn = (window as any).setIsMicActive;
      if (setIsMicActiveFn) setIsMicActiveFn(false);

      // Release the previous element and its owned blob URL before replacement.
      const prevEl = getMediaEl();
      if (prevEl) {
        try {
          const prevPromise = getCurrentPlayPromise();
          setCurrentPlayPromise(null);
          detachMediaElement(prevEl);
          if (prevPromise) await prevPromise.catch(() => {});
        } catch (e) { console.warn('Media element cleanup warning:', e); }
      } else {
        revokeActivePlaybackObjectUrl();
      }

      // Fresh audio element — createMediaElementSource() can only be called once per element
      const newEl = new Audio();
      loadElement = newEl;
      newEl.loop        = false;
      newEl.crossOrigin = 'anonymous';
      newEl.preload     = 'metadata';
      setMediaEl(newEl);
      setIsPlaying(false);

      const setIsAudioPlayingFn = window.setIsAudioPlaying;
      if (setIsAudioPlayingFn) setIsAudioPlayingFn(false);

      // Playlist auto-advance on track end
      newEl.addEventListener('ended', async () => {
        const playlist:           any[]    = (window as any).playlist     || [];
        const setTrackIdx                  = (window as any).setCurrentTrackIndex;
        const autoAdvance:        boolean  = (window as any).autoAdvance;
        const shuffleOn:          boolean  = (window as any).shuffleEnabled;
        const currentIdx = playlist.findIndex((_: any, i: number) =>
          trackMetadata.track === playlist[i]?.name
        );

        if (autoAdvance && currentIdx >= 0 && playlist.length > 0) {
          let nextIdx: number;
          if (shuffleOn) {
            const available = playlist.map((_: any, i: number) => i).filter((i: number) => i !== currentIdx);
            nextIdx = available.length > 0
              ? available[Math.floor(Math.random() * available.length)]
              : currentIdx;
          } else {
            nextIdx = (currentIdx + 1) % playlist.length;
          }
          const nextTrack = playlist[nextIdx];
          if (setTrackIdx) setTrackIdx(nextIdx);
          try {
            await loadFile(nextTrack.file);
            const el = getMediaEl();
            if (el) await el.play();
          } catch (err) { console.error('Failed to load/play next track:', err); }
        }
      });

      // Wait for metadata before creating MediaElementSource. A newer load or
      // explicit unload cancels this promise so stale elements/files are released.
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          newEl.removeEventListener('loadedmetadata', onMetadata);
          newEl.removeEventListener('error', onError);
          if (cancelPendingMediaLoad === cancel) cancelPendingMediaLoad = null;
          if (error) reject(error);
          else resolve();
        };
        const cancel = () => finish(new Error('Audio load superseded'));
        const onMetadata = () => {
          if (loadRevision !== mediaLoadRevision) {
            cancel();
            return;
          }
          if (!Number.isFinite(newEl.duration) || newEl.duration <= 0 || newEl.duration > AUDIO_TRACK_MAX_DURATION_SECONDS) {
            finish(new Error('Audio duration is invalid or exceeds the 3-hour track limit.'));
            return;
          }
          trackMetadata.track    = file.name;
          trackMetadata.duration = formatTime(newEl.duration);
          trackMetadata.timeLeft = formatTime(newEl.duration);
          trackMetadata.sr       = AC.sampleRate ? `${(AC.sampleRate / 1000).toFixed(1)}kHz` : '—';
          finish();
        };
        const onError = () => {
          if (!loadPlaybackUrl) return;
          const code = newEl.error?.code;
          if (code === 2 || code === 3 || code === 4) {
            const msgs: Record<number, string> = { 2: 'Network error', 3: 'Decode error', 4: 'Format not supported' };
            finish(new Error(msgs[code]));
          }
        };

        cancelPendingMediaLoad = cancel;
        newEl.addEventListener('loadedmetadata', onMetadata, { once: true });
        newEl.addEventListener('error', onError, { once: true });
        newEl.addEventListener('play',  () => { AC.resume(); if (window.setIsAudioPlaying) window.setIsAudioPlaying(true); });
        newEl.addEventListener('pause', () => { if (window.setIsAudioPlaying) window.setIsAudioPlaying(false); });
        newEl.addEventListener('timeupdate', () => {
          if (getMediaEl() !== newEl) return;
          if (window.setCurrentTime) window.setCurrentTime(newEl.currentTime);
          if (window.setAudioDuration) window.setAudioDuration(newEl.duration);
        });

        const playbackUrl = audioObjectUrlRegistry.create(file, 'playback', file.name);
        loadPlaybackUrl = playbackUrl;
        activePlaybackObjectUrl = playbackUrl;
        newEl.src = playbackUrl;
        newEl.load();
      });

      if (loadRevision !== mediaLoadRevision || getMediaEl() !== newEl) {
        detachMediaElement(newEl, loadPlaybackUrl);
        return;
      }

      // Enable monitor for uploaded files BEFORE connecting —
      // connectNode only routes to AC.destination when monitorEnabled is true
      setMonitorEnabledLocal(true);
      if (window.setMonitorEnabled) window.setMonitorEnabled(true);

      // Connect to analyser chain
      const mediaSource = AC.createMediaElementSource(newEl);
      connectNode(mediaSource);

      const playBtn = $('#play') as HTMLButtonElement | null;
      if (playBtn) { playBtn.disabled = false; playBtn.textContent = '▶︎'; }

      trackMetadata.track = file.name;
      trackMetadata.sr    = AC.sampleRate ? `${(AC.sampleRate / 1000).toFixed(1)}kHz` : '—';
      trackMetadata.fft   = String(analyser.frequencyBinCount);

      const metaSREl = document.getElementById('metaSR');
      if (metaSREl) metaSREl.textContent = trackMetadata.sr;

      opts.onMetadataUpdate();

      console.log('✅ File loaded:', file.name);

      // Latest-only serialized analysis prevents overlapping decoded AudioBuffers.
      scheduleAutomaticBpmAnalysis(file, newEl.duration);

    } catch (e) {
      try { detachMediaElement(loadElement, loadPlaybackUrl); } catch { }
      if (loadRevision !== mediaLoadRevision) return;

      console.error('❌ Load file error:', e);
      bpmAnalysisQueue.invalidate();
      if (getMediaEl() === loadElement) {
        setMediaEl(null);
        window.mediaEl = null;
      }
      alert(`❌ Failed to load audio file\n\n${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }

  // ── dispose ───────────────────────────────────────────────────────────────────
  function dispose(): void {
    disposed = true;
    mediaLoadRevision += 1;
    cancelPendingMediaLoad?.();
    cancelPendingMediaLoad = null;
    bpmAnalysisQueue.dispose();
    terminateBpmAnalysisWorker();
    const currentElement = getMediaEl();
    detachMediaElement(currentElement);
    setMediaEl(null);
    window.mediaEl = null;
    stopMic();
    if (micVisualGainNode) {
      try { micVisualGainNode.disconnect(); } catch { }
      micVisualGainNode = null;
    }
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch { }
      sourceNode = null;
    }
  }

  // ── Expose RadialAnalyzer for legacy external integrations ────────────────────
  // Note: setPalette is wired in App.tsx after initAudioSystem returns (needs setPaletteByName closure)
  (window as any).RadialAnalyzer = {
    connectAudioNode: (node: any) => { setUsingMic(true); connectNode(node); },
    setPalette: (name: string) => { (window as any).setPaletteByName?.(name); },
  };

  return {
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
    detectBPM,
    playButtonHandler,
    restartButtonHandler,
    dispose,
  };
}
