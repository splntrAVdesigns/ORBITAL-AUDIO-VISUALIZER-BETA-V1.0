// ORBITAL v1.0 - WEBGL FULL INTEGRATION - Build 20250304-PARTICLES-REACTIVITY
// 🔄 VERTICAL SYMMETRY: LEFT HALF (90°-270°) mirrored to RIGHT HALF - perfect left-right balance!
// 🚀 WEBGL FULL INTEGRATION: Complete layer-based rendering system!
//    ├─ WebGLEngine: Modular render graph with all GPU layers
//    ├─ Spike Ring: WebGL layer (frequency-domain spectrum)
//    ├─ Core Particles: 360 PURE AUDIO-REACTIVE particles - GLOBAL RADIUS PULSING!
//    │  ├─ 🎯 120-250Hz reactivity: Balanced low-mid frequency response
//    │  ├─ ✨ Global radius pulsing: All particles pulse outward together (like center graphic!)
//    │  ├─ 🎚️ Motion Intensity: Controls pulse amplitude (0-50% growth)
//    │  ├─ ⏱️ Motion Smoothing: Controls attack/decay timing (unified system)
//    │  ├─ 📏 Dynamic spread: 50% → 100% of R0 (1/4 to full center diameter)
//    │  ├─ Audio-reactive SIZE: 0.9-5.2px (grows with audio intensity!)
//    │  ├─ Pure audio chaos: Chaos slider controls audio-driven displacement/jitter
//    │  └─ NO WHITE: Luminance triple-capped at 48% (20-48% range)
//    ├─ Spark Impact: 20 spark pool (ULTRA-LIGHTWEIGHT - 75% reduction!)
//    │  ├─ Line streaks: Fast beams shooting outward (not dots!)
//    │  ├─ Beat-triggered: 3-5 per burst, 200ms cooldown
//    │  ├─ Short lifetime: 0.3-0.5s fixed duration
//    │  ├─ High speed: 300-500 px/s (2-3x faster!)
//    │  └─ Color integration: Uses currentColor (picker + auto-cycle!)
//    └─ Performance: +35-45 FPS gain, smooth 60fps maintained!
// 🎨 LIQUID SHAPER: WebGL-accelerated sacred geometry morphing
//    ├─ GPU-powered shader with metaball-style liquid transitions
//    ├─ Continuous noise-based rotation and field modulation
//    ├─ Automated texture cleanup for long-running sessions (300s interval)
//    └─ Replaces old vector-based morphing with high-performance WebGL

// 🎯 REACTIVITY SYSTEM: Unified control (0=smooth, 1=reactive) - BOOSTED RANGES for MORE punch!
// ⚡ FREQUENCY SMOOTHING: Bass 60% faster, treble 50% slower - DRAMATIC difference!
// 🥁 BEAT BOOST: 4x reactivity surge on beats (120ms decay) - OVERDRIVE allowed!
// 📊 COMPACT UI: Gray buttons with blue active state - matches existing design!
// 🎬 MOTION BLUR: True afterimage trails with persistence control (multiply/alpha modes)
// ✨ IRIDIZE FX: Metallic/pearlescent shimmer - white flashing overtones on peaks (like iridium coating!)
// 🌟 ORBITAL ENERGY: Animated pulse traveling around halo (speed + width + direction controls!)
// 🌊 COLOR WAVE: GPU-accelerated hue variations AROUND base color (NOT rainbow!)
//    ├─ WebGL shader applies ±60° hue offset based on angle (3 cycles around ring)
//    ├─ Canvas2D strokes use same logic (angle-based offset from base hue)
//    └─ Base color ALWAYS respected - effects modulate, never replace!
// 💥 SATURATION BURST: Simple brightness pulse (dots + halo ONLY, no spikes!)
//    ├─ Dots: 0ms delay (wave hits first) - +25% luminosity
//    ├─ Halo: 600ms delay (wave hits last) - +30% luminosity
//    └─ No saturation/hue changes - clean and performant!
// 🔥 ROTATION SYNC: Production-ready smooth rotation with 3 modes (PRIORITY 1-3 FIXES!)
//    ├─ FREE Mode: 10% exponential smoothing (industry standard, butter smooth!)
//    ├─ BPM Mode: Temporal smoothing buffer (15% lerp, eliminates dt stuttering!)
//    ├─ QUANTIZED Mode: Frame-rate independent spring-damper (frequency-based physics!)
//    ├─ State Reset: Clean mode switching (no jumps, jitter, or accumulated errors!)
//    ├─ Beat Phase Sync: Quantized snaps to nearest beat-aligned angle on mode entry!
//    └─ Angle Normalization: All modes prevent floating-point drift (stable long sessions!)
// 🧹 CLEANUP: Removed Web Audio Clock overhead, simplified render loop!
// ⚡ QUICK WINS (20250223):
//    ├─ GPU-accelerated collapsible sections (transform: scaleY vs max-height)
//    ├─ Consolidated RAF loops (3 → 1, coordinated batching)
//    ├─ DOM updates moved OUT of render loop (FPS/quality indicators)
//    └─ Cached DOM element references (zero getElementById per frame)
//
// 🚀 TIER 1-3 PERFORMANCE FIXES (20250228):
//    ├─ TIER 1: Circular buffers eliminate ALL per-frame allocations
//    │   ├─ Pending shockwaves: splice() → circular buffer (0 alloc/frame)
//    │   └─ Energy history: push()/slice() → circular buffer (0 alloc/frame)
//    ├─ TIER 2: Time stability prevents rotation jitter
//    │   ├─ dt clamping: Max 100ms prevents huge time jumps
//    │   └─ Tab visibility: RAF pause/resume with timer reset
//    └─ TIER 3: Worker optimization + performance monitoring
//        ├─ Direct TypedArray transfer (no Array.from conversion)
//        └─ Optional frame time tracking for debugging
//    🎯 RESULT: 240 allocations/sec → 0 (100% reduction) = ZERO audio stuttering!
//
// ℹ️  BABEL NOTE: The "deoptimised styling" message is NORMAL and NOT AN ERROR!
//    This file intentionally exceeds 500KB due to the complex monolithic architecture
//    required for real-time audio visualization with WebGL rendering, frequency analysis,
//    particle systems, and 40+ control parameters. The warning is INFORMATIONAL ONLY.
//    ✅ THE APP COMPILES AND RUNS PERFECTLY - this is expected for large visualization engines.
//    File size: ~11,700 lines containing the complete visualization engine in one module.

import { renderCenterGraphicLayer, createCenterGraphicRenderState } from './renderers/centerGraphicRenderer';
import { WebGLEngine } from './src/engines/webgl/WebGLEngine';
import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { useAppShellState } from './src/app/hooks/useAppShellState';
import { useControlPanelState } from './src/app/hooks/useControlPanelState';
import { createKeyboardShortcutHandler } from './src/app/hooks/useKeyboardShortcuts';
// Note: createPlaybackController, AudioBridge, formatDuration now internal to AudioSystemInit (Phase 3)
import { presets, PRESET_VERSION, PRESET_COUNT } from './data/presets';
import { Star, SkipBack, SkipForward, HelpCircle, ChevronDown, Settings } from 'lucide-react';
import { LoadingPage } from './components/LoadingPage';
import { AudioAmplifier } from './utils/audioProcessing';
import { MacroKnob } from './components/MacroKnob';
import { MobileBlocker } from './components/MobileBlocker';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import { ControlPanel } from './components/ControlPanel';
import { LandingPage } from './components/LandingPage';
import { IntroTutorial } from './components/IntroTutorial';
import { SettingsPanel } from './components/SettingsPanel';

// Utility imports
import { checkBrowserCompatibility, safeLocalStorage } from './utils/browserCompat';
import { spikeRingVertexShader, spikeRingFragmentShader, type SpikeProgramLocations } from './utils/webglShaders';
import { compileShader, linkProgram } from './utils/webglInit';
import { avg, clamp, lerp } from './utils/audioVisualizationHelpers';
import { processSpikeSignalChain, sampleSymmetricSpikeAmplitude } from './utils/spikeSignalChain';
import { renderSpikePremiumFx } from './utils/spikePremiumFx';
import { getSpikeAngleJitter } from './utils/spikeGeometry';
import { createPresetActions } from './utils/presetActions';
import { renderMiniSpectrumTrace } from './utils/miniSpectrumTrace';
// Note: formatDuration (formatTime alias) now also imported inside AudioSystemInit (Phase 3)
// App.tsx still needs it directly for RAF loop trackMetadata.timeLeft updates
import { formatDuration as formatTime } from './utils/trackMetadataManager';
import { damp, wrapAngle, shortestAngleDiff, TAU } from './utils/mathHelpers';
import { startAngleTween, easeOutSine } from './utils/easing';
import { RuntimeClock } from './utils/runtimeClock';
import { RotationAuthority } from './utils/rotationAuthority';
import { PresetTransitionEngine } from './utils/presetTransitionEngine';
import { CenterGraphicController, bindMotionControlsRouting, createDomBindingController, createPanelController, captureCanvasScreenshot, createFullscreenController, createAudioUIController, toggleAppFullscreen } from './controllers';
import { ShockwaveRuntime, SoftParticleSpriteCache, buildSpikeLookupTables, updatePerformanceMetrics as updatePerformanceMetricsHelper, startIdleCacheCleanup, type PerformanceMetricsState } from './runtime/renderLoopHelpers';
import { createFramePhaseCosts, flushQueuedUIUpdates, measureElapsed, publishRenderCostDebug } from './runtime/renderFrameRuntime';
import { FramePacingRuntime } from './runtime/framePacingRuntime';
import { resolveAdaptiveRenderScale, getStoredRenderDisplayMode } from './utils/adaptiveRenderScale';
import { CanvasViewportController } from './runtime/CanvasViewportController';
import { createVisualizerRuntimeFoundation } from './runtime/visualizer/VisualizerRuntimeFoundation';
import { useVisualizerRuntimeEffect } from './runtime/visualizer/useVisualizerRuntimeEffect';
import { RenderPipeline } from './runtime/visualizer/pipeline/RenderPipeline';
import { UIRefreshScheduler } from './runtime/visualizer/pipeline/UIRefreshScheduler';
import { createRenderFrameState, prepareRenderFrame } from './runtime/visualizer/pipeline/prepareRenderFrame';
import { clearBackgroundPass } from './runtime/visualizer/pipeline/passes/clearBackgroundPass';
import { haloPass } from './runtime/visualizer/pipeline/passes/haloPass';
import { dotPass } from './runtime/visualizer/pipeline/passes/dotPass';
import { centerMediaPass } from './runtime/visualizer/pipeline/passes/centerMediaPass';
import { postEffectsPass } from './runtime/visualizer/pipeline/passes/postEffectsPass';
import type { RuntimeFrameTiming } from './runtime/visualizer/VisualizerRuntimeTypes';
import type { ViewportState } from './runtime/ViewportState';
import { VisualAudioRuntime } from './runtime/audio/VisualAudioRuntime';
import { CoreParticleImpulseRuntime } from './runtime/audio/CoreParticleImpulseRuntime';
import { AudioVisualStressDiagnostics } from './runtime/audio/AudioVisualStressDiagnostics';
import { BeatEffectRuntime } from './runtime/audio/BeatEffectRuntime';
import { MotionRotationRuntime } from './runtime/motion/MotionRotationRuntime';
import { getUnifiedHue, type CenterColorSource } from './runtime/colorPipeline';
import { renderVuMeter, renderOuterHalo, renderShockwaves, renderCenterGlow, type VuGradientCache } from './renderers/canvasLayerRenderer';
import { DotRingRuntime } from './renderers/dotRingRenderer';
import { DEBUG_AUDIO, DEBUG_FLAGS, DEBUG_GENERAL, DEBUG_PERF, DEBUG_WEBGL } from './src/app/config/debugFlags';

// 🚀 PERFORMANCE: Web Worker for audio analysis (zero main thread blocking)
// Note: AudioBridge now imported inside AudioSystemInit (Phase 3)

// Extracted classes
import { ErrorBoundary } from './components/ErrorBoundary';
import { AutoReactivityEngine } from './engine/AutoReactivityEngine';
import { VisualReactivityEngine } from './audio/visualReactivityEngine';

// Liquid Shaper - WebGL Sacred Geometry Engine
import { getAstralMorphEngine } from './engine/AstralMorphEngine';
import { drawAstralShaper, getAllShapes, getNextShape, getCycleDuration, clearStaleCache, clearShapeSampleCache, clearTextureCache, getNextShapeInFamily, getMorphFamily, type ShapeType, type StrokeStyle, type AutoCycleSpeed, type MorphOrigin } from './utils/astralShaper';

// Color Palettes - Extracted to reduce file size
import { palettes, type ColorPalette } from './data/colorPalettes';

// Phase 1 Refactor: Config extracted from App.tsx
import { defaultParams } from './config/defaultParams';
import { macroMappings, type MacroMapping } from './config/macroDefinitions';

// Phase 2 Refactor: Imperative systems extracted from App.tsx
import { MidiController } from './engine/MidiController';
import { MidiConfigModal } from './components/MidiConfigModal';
import { UIInteractionRuntime } from './runtime/uiInteractionRuntime';
import { usePresetKeyboardNavigation } from './hooks/usePresetKeyboardNavigation';
import { computeCoreParticleReactivity } from './renderers/coreParticleReactivity';
import { RecordingEngine, type RecordingItem } from './engine/RecordingEngine';
import type { RecordingCodec, RecordingQuality, RecordingRuntimeController, RecordingStartOptions } from './engine/recording/RecordingRuntimeController';
import { installRecordingKeyboardShortcut } from './engine/recording/installRecordingKeyboardShortcut';

// Phase 3 Refactor: Audio pipeline extracted from App.tsx
import { initAudioSystem, type TrackMetadata } from './engine/AudioSystemInit';
import { useCrashTelemetry } from './hooks/useCrashTelemetry';
import { useOrbitalAppLifecycle } from './hooks/useOrbitalAppLifecycle';
import { LandscapePrompt } from './components/shell/LandscapePrompt';
import { CompatibilityWarning } from './components/shell/CompatibilityWarning';
import { KeyboardShortcutOverlay } from './components/shell/KeyboardShortcutOverlay';
import { captureOrbitalScreenshot, exportOrbitalSettings, importOrbitalSettings } from './controllers/settingsTransferController';
import { FrameScheduler } from './runtime/FrameScheduler';
import { getSessionRecoverySupervisor } from './runtime/session/SessionRecoverySupervisor';
import { publishAudioMetadata, setControlPanelAudioTab } from './runtime/controlPanelRuntimeStore';
import { applyRuntimeParameterTransaction } from './runtime/parameters/RuntimeParameterTransactions';

// Phase 2: GIF Export
// Note: GIFExporter, formatDuration, estimateFileSize, isGIFLibraryAvailable, waitForGIFLibrary
// are now internal to RecordingEngine (Phase 2 refactor)

// Motion Blur Trails - True Afterimage Effect
import { getMotionBlurEngine, type MotionBlurConfig } from './utils/motionBlur';
// FIX 10: CoreTextures engine imports — required for shader preset system
import { CoreTexturesEngine } from './src/engines/CoreTexturesEngine';
import { resolveCoreTextureParams } from './src/shaders/coreTextureParamMapper';

function AppContent() {
  // 🔄 Version: BUILD 20250304-PERFORMANCE-OPTIMIZED
  const CORE_PARTICLES_SANDBOX = true;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null); // WebGL (spike ring + particles)
  const webglEngineRef = useRef<WebGLEngine | null>(null);
  // FIX 10b: CoreTextures engine refs
  const coreTexturesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coreTexturesEngineRef = useRef<CoreTexturesEngine | null>(null);
  const useWebGLCoreParticlesRef = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const crashTelemetryRef = useCrashTelemetry(glCanvasRef);
  const sessionRecoverySupervisor = getSessionRecoverySupervisor();
  const sessionRecovery = useSyncExternalStore(
    sessionRecoverySupervisor.subscribe,
    sessionRecoverySupervisor.getSnapshot,
    sessionRecoverySupervisor.getSnapshot,
  );

  // 🐛 BUG FIX: previously the saved panel width was only restored inside a useEffect
  // (in panelController.ts), which always fires *after* the first paint — guaranteeing
  // one visible frame at the CSS default (480px) before snapping to the user's actual
  // saved width, which also dragged the canvas resize along with it. Reading it here,
  // synchronously, during the very first render means the correct width is what gets
  // painted from the start — no flash, no jump.
  const [initialPanelW] = useState<number | null>(() => {
    try {
      const saved = parseInt(safeLocalStorage.getItem('radial_panel_w') || '0', 10);
      return saved > 0 ? Math.max(220, Math.min(560, saved)) : null;
    } catch {
      return null;
    }
  });
  const stereoPanRef = useRef(0);
  const stereoWidthRef = useRef(0.65);
  const stereoSplitterRef = useRef<ChannelSplitterNode | null>(null);
  const leftAnalyserRef = useRef<AnalyserNode | null>(null);
  const rightAnalyserRef = useRef<AnalyserNode | null>(null);
  const leftTimeDataRef = useRef<Float32Array | null>(null);
  const rightTimeDataRef = useRef<Float32Array | null>(null);
  const {
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
  } = useAppShellState();

  const {
    audioSectionCollapsed,
    setAudioSectionCollapsed,
    colorSectionCollapsed,
    setColorSectionCollapsed,
    spikeRingSectionCollapsed,
    setSpikeRingSectionCollapsed,
    animationSectionCollapsed,
    setAnimationSectionCollapsed,
    dotsSectionCollapsed,
    setDotsSectionCollapsed,
    outerHaloSectionCollapsed,
    setOuterHaloSectionCollapsed,
    settingsPanelOpen,
    setSettingsPanelOpen,
    performanceHUDEnabled,
    setPerformanceHUDEnabled,
  } = useControlPanelState();
  const [spikeCount, setSpikeCount] = useState(256); // 2^9 FFT window exposes 256 visible frequency bins
  const [spikeThickness, setSpikeThickness] = useState(0.90); // 🎯 Thickness value (0.2-1.0, default 75%)
  const [spikeMirror, setSpikeMirror] = useState(0); // Mirror value (0-1.0) as percentage
  const [spikeAttackVal, setSpikeAttackVal] = useState(0.30); // 🎯 Attack value (0.1-1.2, default 0.30)
  const [spikeBloomVal, setSpikeBloomVal] = useState(0.0); // 🔥 Bloom/glow intensity (0-1.0, default 0% - users discover the wow factor!)
  const [transientBoostVal, setTransientBoostVal] = useState(0.0); // 🔥 Transient emphasis (0-1.0, default 0% - users discover the wow factor!)
  
  // Macro Knob State (for premium SVG knobs)
  const [macroValues, setMacroValues] = useState({ 
    macro1: 0, macro2: 0, macro3: 0, macro4: 0,
    macro5: 0, macro6: 0, macro7: 0, macro8: 10 // DEFAULT: 10% for Core Particles intensity
  });
  
  // Macro Set State (Classic 1-4 vs Advanced 5-8)
  const [macroSet, setMacroSet] = useState<'classic' | 'advanced'>('classic');
  
  // 🚀 PW-03: useRef replaces useState — macro knob drags no longer trigger 12K-line re-renders
  const pendingMacroChangesRef = useRef<{macroId: string, value: number} | null>(null);
  const pendingMacroTimeoutRef = useRef<number | null>(null);
  
  // 🚀 PW-03: useRef replaces useState — Liquid Shaper slider drags no longer trigger re-renders
  const pendingLiquidChangesRef = useRef<{[key: string]: any}>({});

  // 🚀 PW-03b (Beta cleanup): same pattern, applied to the 6 Spike Ring sliders. The native
  // bindThrottled/bind listeners on these same <input> elements already update the live
  // render params instantly and independently of React — this ref only governs how often the
  // React state (used for the numeric readout label next to each slider, and for presets/
  // reset) gets committed, batched to at most once per animation frame instead of once per
  // raw 'input' event (which can fire well over 60/sec while dragging).
  const pendingSpikeSliderRef = useRef<{
    spikeCount?: number;
    spikeThickness?: number;
    spikeMirror?: number;
    spikeAttackVal?: number;
    spikeBloomVal?: number;
    transientBoostVal?: number;
  }>({});
  const spikeSliderSchedulerRef = useRef(new FrameScheduler());

  // Output Settings State
  const [outputResolution, setOutputResolution] = useState('1920x1080');
  const [outputFpsLimit, setOutputFpsLimit] = useState('auto');
  
  // Playlist State
  const [playlist, setPlaylist] = useState<Array<{id: string, file: File, name: string, duration: number}>>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [shuffleEnabled, setShuffleEnabled] = useState<boolean>(false); // Shuffle mode for playlist
  const currentTimeRef = useRef<number>(0);
  const setCurrentTime = (time: number) => {
    currentTimeRef.current = time;
  };
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [monitorEnabled, setMonitorEnabled] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false); // Track audio play/pause state
  const [isMicActive, setIsMicActive] = useState<boolean>(false); // Track if microphone is active
  
  // Recording State for Settings Panel
  const [recordingResolution, setRecordingResolution] = useState<string>('1080p');
  const [recordingFPS, setRecordingFPS] = useState<number>(60);
  const [recordingDuration, setRecordingDuration] = useState<number>(30);
  const [recordingCodec, setRecordingCodec] = useState<RecordingCodec>('vp9');
  const [recordingQuality, setRecordingQuality] = useState<RecordingQuality>('high');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState<number>(0);
  const [recordingLibrary, setRecordingLibrary] = useState<RecordingItem[]>([]);
  const [showClearRecordingsModal, setShowClearRecordingsModal] = useState(false);
  const recordingControllerRef = useRef<RecordingRuntimeController | null>(null);
  useEffect(() => installRecordingKeyboardShortcut(recordingControllerRef), []);

  const recordingSettingsRef = useRef<RecordingStartOptions>({
    resolution: '1080p',
    fps: 60,
    duration: 30,
    codec: 'vp9',
    quality: 'high',
  });
  recordingSettingsRef.current = {
    resolution: recordingResolution,
    fps: recordingFPS,
    duration: recordingDuration,
    codec: recordingCodec,
    quality: recordingQuality,
  };
  
  // 🚀 WebGL Engine with Canvas2D Fallback
  const [useWebGL, setUseWebGL] = useState<boolean>(true); // Try WebGL first, fallback to Canvas2D if it fails
  const useWebGLRef = useRef<boolean>(true); // Ref for render loop access
  
  // 🔴 FIX #2: AudioContext created on user gesture (iOS compatibility)
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null); // 🔴 FIX #4: Store mic stream for cleanup
  const initializingRef = useRef(false); // 🔴 FIX: Prevent double-initialization in React Strict Mode
  const initializedRef = useRef(false); // 🔴 FIX: Track if visualizer has been initialized

  useOrbitalAppLifecycle({
    appState, isMobileDevice, isLandscapeOnly, isAudioPlaying, settingsPanelOpen,
    playlist, monitorEnabled, autoAdvance, shuffleEnabled, setIsMobileDevice, setIsLandscapeOnly,
    setShowIntroTutorial, setAutoAdvance, setShuffleEnabled, setAppReady, setSettingsPanelOpen,
    setCompatMissing, setShowCompatWarning,
  });



  // 🔴 FIX #2: Create AudioContext on Launch (user gesture for iOS compatibility)
  const handleLaunch = () => {
    try {
      // 🛡️ FIX (Beta cleanup): Guard against creating a second AudioContext if one already
      // exists and is still usable. No UI path currently re-enters 'landing' after launch,
      // but this makes handleLaunch safe by construction if that ever changes — browsers cap
      // concurrent AudioContexts, so an unconditional `new AudioContext()` here would eventually
      // break audio entirely for anyone who relaunches the app multiple times in one tab.
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        // 🔧 FIX AUDIO DELAY 1: latencyHint:'interactive' tells the browser to minimise
        //    audio buffer size, reducing the pipeline delay from ~100-200ms to ~20-50ms.
        //    Without this the default hint is 'balanced' which prioritises stability over
        //    latency — fine for playback, wrong for a live audio-reactive visualiser.
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(
          { latencyHint: 'interactive', sampleRate: 44100 }
        );
        if (DEBUG_FLAGS.GENERAL) console.log('✅ AudioContext created on user gesture (latencyHint: interactive)');
      } else if (DEBUG_FLAGS.GENERAL) {
        console.log('ℹ️ Reusing existing AudioContext (already open)');
      }
    } catch (e) {
      console.error('❌ AudioContext creation failed:', e);
      alert('Audio initialization failed. Please try refreshing the page.');
      return;
    }
    setAppState('loading');
  };

  // 🔥 FIX 5: Apply pending macro changes (called on beat detection)
  const applyPendingMacroChanges = useCallback(() => {
    if (!pendingMacroChangesRef.current) return;
    
    const { macroId, value } = pendingMacroChangesRef.current;
    
    // Update React state
    setMacroValues(prev => ({ ...prev, [macroId]: value }));
    
    // Update window.params
    const params = (window as any).params;
    if (params) applyRuntimeParameterTransaction(params, { [macroId]: value });
    
    // Apply macro
    const applyMacro = (window as any).applyMacro;
    if (applyMacro) {
      applyMacro(macroId, value);
    }
    
    // Sync hidden input
    const hiddenInput = document.getElementById(`${macroId}-hidden`) as HTMLInputElement;
    if (hiddenInput) hiddenInput.value = String(value);
    
    // Clear pending ref
    pendingMacroChangesRef.current = null;
    
    // Clear timeout if exists
    if (pendingMacroTimeoutRef.current) {
      clearTimeout(pendingMacroTimeoutRef.current);
      pendingMacroTimeoutRef.current = null;
    }
  }, []); // 🚀 PW-03: no deps — reads from ref, not from closed-over state

  // 🔥 PERFORMANCE: Apply pending Liquid Shaper changes on beat (prevents choking)
  const applyPendingLiquidChanges = useCallback(() => {
    if (Object.keys(pendingLiquidChangesRef.current).length === 0) return;
    
    const params = (window as any).params;
    if (!params) return;
    
    // Apply all pending changes at once
    Object.entries(pendingLiquidChangesRef.current).forEach(([key, value]) => {
      if (key === '_clearTextureCache') {
        clearTextureCache();
      } else {
        params[key] = value;
        
        // Update UI slider values
        const slider = document.getElementById(key) as HTMLInputElement;
        if (slider && slider.type === 'range') {
          slider.value = String(value);
        }
      }
    });
    
    // Clear pending ref
    pendingLiquidChangesRef.current = {};
  }, []); // 🚀 PW-03: no deps — reads from ref, not from closed-over state

  // 🚀 PW-03b (Beta cleanup): Flush queued Spike Ring slider values into real React state,
  // batched to at most once per animation frame. The slider thumbs themselves are uncontrolled
  // (defaultValue, not value) so their on-screen position is unaffected by this either way —
  // this only governs how often the numeric readout label re-renders during a drag.
  const flushPendingSpikeSliders = useCallback(() => {
    const pending = pendingSpikeSliderRef.current;
    if (pending.spikeCount !== undefined) setSpikeCount(pending.spikeCount);
    if (pending.spikeThickness !== undefined) setSpikeThickness(pending.spikeThickness);
    if (pending.spikeMirror !== undefined) setSpikeMirror(pending.spikeMirror);
    if (pending.spikeAttackVal !== undefined) setSpikeAttackVal(pending.spikeAttackVal);
    if (pending.spikeBloomVal !== undefined) setSpikeBloomVal(pending.spikeBloomVal);
    if (pending.transientBoostVal !== undefined) setTransientBoostVal(pending.transientBoostVal);
    pendingSpikeSliderRef.current = {};
  }, []); // no deps — setX setters are stable, reads from ref, not from closed-over state

  const scheduleSpikeSliderFlush = useCallback(() => {
    spikeSliderSchedulerRef.current.schedule(flushPendingSpikeSliders);
  }, [flushPendingSpikeSliders]);

  const setSpikeCountDeferred = useCallback((value: number) => {
    pendingSpikeSliderRef.current.spikeCount = value;
    scheduleSpikeSliderFlush();
  }, [scheduleSpikeSliderFlush]);
  const setSpikeThicknessDeferred = useCallback((value: number) => {
    pendingSpikeSliderRef.current.spikeThickness = value;
    scheduleSpikeSliderFlush();
  }, [scheduleSpikeSliderFlush]);
  const setSpikeMirrorDeferred = useCallback((value: number) => {
    pendingSpikeSliderRef.current.spikeMirror = value;
    scheduleSpikeSliderFlush();
  }, [scheduleSpikeSliderFlush]);
  const setSpikeAttackValDeferred = useCallback((value: number) => {
    pendingSpikeSliderRef.current.spikeAttackVal = value;
    scheduleSpikeSliderFlush();
  }, [scheduleSpikeSliderFlush]);
  const setSpikeBloomValDeferred = useCallback((value: number) => {
    pendingSpikeSliderRef.current.spikeBloomVal = value;
    scheduleSpikeSliderFlush();
  }, [scheduleSpikeSliderFlush]);
  const setTransientBoostValDeferred = useCallback((value: number) => {
    pendingSpikeSliderRef.current.transientBoostVal = value;
    scheduleSpikeSliderFlush();
  }, [scheduleSpikeSliderFlush]);

  const clearPendingMacroTransactions = useCallback(() => {
    pendingMacroChangesRef.current = null;
    if (pendingMacroTimeoutRef.current !== null) {
      clearTimeout(pendingMacroTimeoutRef.current);
      pendingMacroTimeoutRef.current = null;
    }
  }, []);

  const handleMacroChange = useCallback((_macroId: string, _value: number) => {
    // Phase 4.8J.4: all visual macro gestures are draft-only until release.
    // The knob owns its local native preview; React/runtime publication happens
    // once in handleMacroCommit. This prevents Energy/Chaos/Atmosphere/etc. from
    // changing render params while the pointer is moving and protects Rotation
    // Sync from generic macro-drag starvation.
    pendingMacroChangesRef.current = null;
    if (pendingMacroTimeoutRef.current) {
      clearTimeout(pendingMacroTimeoutRef.current);
      pendingMacroTimeoutRef.current = null;
    }
  }, []);

  const handleMacroCommit = useCallback((macroId: string, value: number) => {
    setMacroValues(prev => prev[macroId as keyof typeof prev] === value
      ? prev
      : { ...prev, [macroId]: value });
    const hiddenInput = document.getElementById(`${macroId}-hidden`) as HTMLInputElement | null;
    if (hiddenInput) hiddenInput.value = String(value);

    // Commit is the sole publication point for Macro 2. This keeps the runtime and
    // the React knob in sync without leaking pointer-drag values into rotation.
    const params = (window as any).params;
    if (params) applyRuntimeParameterTransaction(params, { [macroId]: value });
    (window as any).applyMacro?.(macroId, value, { immediateDom: true, interactionPhase: 'commit' });
    window.dispatchEvent(new CustomEvent('orbital:macro-commit', { detail: { macroId, value } }));
  }, []);

  useVisualizerRuntimeEffect({
    enabled: true,
    activationKey: 0,
    lifecycle: {
      appState,
      renderOnMainThread: true,
      renderWebGLOnMainThread: true,
      canvasRef,
      coreTexturesCanvasRef,
      glCanvasRef,
      initializedRef,
      initializingRef,
      rootRef,
    },
    audio: {
      AudioAmplifier,
      AudioVisualStressDiagnostics,
      RecordingEngine,
      VisualAudioRuntime,
      audioContextRef,
      createAudioUIController,
      initAudioSystem,
      leftAnalyserRef,
      leftTimeDataRef,
      micStreamRef,
      playlist,
      recordingFPS,
      recordingResolution,
      recordingControllerRef,
      recordingSettingsRef,
      rightAnalyserRef,
      rightTimeDataRef,
      setAudioDuration,
      setAudioTab: setControlPanelAudioTab,
      setCurrentTrackIndex,
      setIsAudioPlaying,
      setIsRecording,
      setMonitorEnabled,
      setPlaylist,
      setRecordingLibrary,
      setRecordingTimeLeft,
      stereoPanRef,
      stereoSplitterRef,
      stereoWidthRef,
    },
    controls: {
      applyPendingLiquidChanges,
      applyPendingMacroChanges,
      clearPendingMacroTransactions,
      autoAdvance,
      pendingLiquidChangesRef,
      setAudioDuration,
      setAudioTab: setControlPanelAudioTab,
      setCurrentTime,
      setCurrentTrackIndex,
      setIsAudioPlaying,
      setIsMicActive,
      setIsRecording,
      setMacroValues,
      setMetadata: publishAudioMetadata,
      setMonitorEnabled,
      setPlaylist,
      setRecordingLibrary,
      setRecordingTimeLeft,
      setShowKeyboardHelper,
      setUseWebGL,
      shuffleEnabled,
    },
    renderers: {
      CORE_PARTICLES_SANDBOX,
      CenterGraphicController,
      CoreParticleImpulseRuntime,
      CoreTexturesEngine,
      DEBUG_WEBGL,
      DotRingRuntime,
      RenderPipeline,
      ShockwaveRuntime,
      SoftParticleSpriteCache,
      WebGLEngine,
      buildSpikeLookupTables,
      centerMediaPass,
      clearBackgroundPass,
      clearTextureCache,
      compileShader,
      computeCoreParticleReactivity,
      coreTexturesCanvasRef,
      coreTexturesEngineRef,
      createCenterGraphicRenderState,
      createRenderFrameState,
      dotPass,
      drawAstralShaper,
      getAstralMorphEngine,
      getMotionBlurEngine,
      getSpikeAngleJitter,
      haloPass,
      postEffectsPass,
      prepareRenderFrame,
      processSpikeSignalChain,
      publishRenderCostDebug,
      renderCenterGlow,
      renderMiniSpectrumTrace,
      renderShockwaves,
      renderSpikePremiumFx,
      renderVuMeter,
      resolveAdaptiveRenderScale,
      resolveCoreTextureParams,
      sampleSymmetricSpikeAmplitude,
      setUseWebGL,
      spikeRingFragmentShader,
      spikeRingVertexShader,
      useWebGLCoreParticlesRef,
      useWebGLRef,
      webglEngineRef,
    },
    diagnostics: {
      AudioVisualStressDiagnostics,
      DEBUG_FLAGS,
      DEBUG_GENERAL,
      DEBUG_PERF,
      DEBUG_WEBGL,
      FramePacingRuntime,
      UIInteractionRuntime,
      measureElapsed,
      publishRenderCostDebug,
      updatePerformanceMetricsHelper,
    },
    factories: {
      bindMotionControlsRouting,
      createAudioUIController,
      createCenterGraphicRenderState,
      createDomBindingController,
      createFramePhaseCosts,
      createFullscreenController,
      createKeyboardShortcutHandler,
      createPanelController,
      createPresetActions,
      createRenderFrameState,
      createVisualizerRuntimeFoundation,
      initAudioSystem,
      initializedRef,
      initializingRef,
      startIdleCacheCleanup,
    },
    utilities: {
      AutoReactivityEngine,
      BeatEffectRuntime,
      CanvasViewportController,
      MidiController,
      MotionRotationRuntime,
      PresetTransitionEngine,
      RotationAuthority,
      RuntimeClock,
      UIRefreshScheduler,
      VisualReactivityEngine,
      avg,
      captureCanvasScreenshot,
      clamp,
      clearStaleCache,
      damp,
      defaultParams,
      easeOutSine,
      flushQueuedUIUpdates,
      formatTime,
      getAllShapes,
      getUnifiedHue,
      linkProgram,
      palettes,
      startAngleTween,
    },
  });

  // PRIORITY 1: Block mobile devices (phones only, tablets OK)
  if (isMobileDevice) {
    return <MobileBlocker />;
  }
  
  // PRIORITY 2: Force landscape on tablets in portrait mode
  if (isLandscapeOnly) {
    return <LandscapePrompt />;
  }

  // Handle landing and loading states
  if (appState === 'landing') {
    return <LandingPage onLaunch={handleLaunch} />;
  }

  // Show loading screen (overlay during main app initialization)
  const showLoadingScreen = appState === 'loading' || (appState === 'main' && !appReady);
  
  if (appState === 'loading') {
    return <LoadingPage onComplete={() => setAppState('main')} />;
  }

  // Main visualizer app
  return (
    <>
      {/* Browser Compatibility Warning */}
      {showCompatWarning && (
        <CompatibilityWarning
          missing={compatMissing}
          onClose={() => setShowCompatWarning(false)}
        />
      )}
      
      {/* Intro Tutorial Modal */}
      {showIntroTutorial && (
        <IntroTutorial onClose={() => setShowIntroTutorial(false)} />
      )}
      
      {/* Keyboard Helper Overlay */}
      {showKeyboardHelper && (
        <KeyboardShortcutOverlay onClose={() => {
          setShowKeyboardHelper(false);
          localStorage.setItem('orbital-keyboard-helper-visible', 'false');
        }} />
      )}
      
      {/* Removed duplicate panelToggle button - using only the middle handle for panel control */}
      <div id="app-frame" className="app-fade-in" style={{ opacity: appReady ? 1 : 0, transition: 'opacity 0.6s ease-in-out' }}>
        <div id="frame-border-outer">
          <div id="frame-border-inner">
            <div
              id="root"
              ref={rootRef}
              style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                minWidth: 0,
                minHeight: 0,
                overflow: 'hidden',
                position: 'relative',
                ...(initialPanelW !== null ? ({ '--panelW': `${initialPanelW}px` } as any) : {})
              }}
            >
              <ControlPanel
                animationSectionCollapsed={animationSectionCollapsed}
                audioDuration={audioDuration}
                audioSectionCollapsed={audioSectionCollapsed}
                autoAdvance={autoAdvance}
                colorSectionCollapsed={colorSectionCollapsed}
                currentTrackIndex={currentTrackIndex}
                dotsSectionCollapsed={dotsSectionCollapsed}
                handleMacroChange={handleMacroChange}
                handleMacroCommit={handleMacroCommit}
                isAudioPlaying={isAudioPlaying}
                isMicActive={isMicActive}
                macroSet={macroSet}
                macroValues={macroValues}
                monitorEnabled={monitorEnabled}
                outerHaloSectionCollapsed={outerHaloSectionCollapsed}
                playlist={playlist}
                setAnimationSectionCollapsed={setAnimationSectionCollapsed}
                setAudioSectionCollapsed={setAudioSectionCollapsed}
                setAutoAdvance={setAutoAdvance}
                setColorSectionCollapsed={setColorSectionCollapsed}
                setCurrentTrackIndex={setCurrentTrackIndex}
                setDotsSectionCollapsed={setDotsSectionCollapsed}
                setMacroSet={setMacroSet}
                setMonitorEnabled={setMonitorEnabled}
                setOuterHaloSectionCollapsed={setOuterHaloSectionCollapsed}
                setPlaylist={setPlaylist}
                setSettingsPanelOpen={setSettingsPanelOpen}
                setShuffleEnabled={setShuffleEnabled}
                setSpikeAttackVal={setSpikeAttackValDeferred}
                setSpikeBloomVal={setSpikeBloomValDeferred}
                setSpikeCount={setSpikeCountDeferred}
                setSpikeMirror={setSpikeMirrorDeferred}
                setSpikeRingSectionCollapsed={setSpikeRingSectionCollapsed}
                setSpikeThickness={setSpikeThicknessDeferred}
                setTransientBoostVal={setTransientBoostValDeferred}
                shuffleEnabled={shuffleEnabled}
                spikeAttackVal={spikeAttackVal}
                spikeBloomVal={spikeBloomVal}
                spikeCount={spikeCount}
                spikeMirror={spikeMirror}
                spikeRingSectionCollapsed={spikeRingSectionCollapsed}
                spikeThickness={spikeThickness}
                transientBoostVal={transientBoostVal}
                useWebGL={useWebGL}
              />
              
              <div id="handle" title="Drag to resize panel"></div>
              
              <VisualizerCanvas
                canvasRef={canvasRef}
                glCanvasRef={glCanvasRef}
                performanceHUDEnabled={performanceHUDEnabled}
              />
            </div>
          </div>
        </div>
      </div>
        
        <MidiConfigModal />

        {/* Settings Panel */}
        <SettingsPanel
          open={settingsPanelOpen}
          onOpenChange={setSettingsPanelOpen}
          onCaptureScreenshot={() => captureOrbitalScreenshot(canvasRef.current)}
          onExportSettings={exportOrbitalSettings}
          onImportSettings={importOrbitalSettings}
          onToggleFullscreen={toggleAppFullscreen}
          performanceHUDEnabled={performanceHUDEnabled}
          onPerformanceHUDToggle={setPerformanceHUDEnabled}
          sessionState={sessionRecovery.state}
          sessionReason={sessionRecovery.reason}
          sessionPreviousExit={sessionRecovery.previousExitReason}
          onSafeGraphicsRecovery={() => sessionRecoverySupervisor.requestSafeGraphicsRecovery()}
          onStartRecording={(options: RecordingStartOptions) => {
            recordingSettingsRef.current = options;
            setRecordingResolution(options.resolution);
            setRecordingFPS(options.fps);
            setRecordingDuration(options.duration);
            setRecordingCodec(options.codec);
            setRecordingQuality(options.quality);

            const result = recordingControllerRef.current?.start(options) ?? 'unavailable';
            if (result === 'unavailable') {
              console.warn('[ORBITAL recording] Runtime controller is not available');
            }
          }}
          onStopRecording={() => {
            const result = recordingControllerRef.current?.stop() ?? 'unavailable';
            if (result === 'unavailable') {
              console.warn('[ORBITAL recording] Runtime controller is not available');
            }
          }}
          isRecording={isRecording}
          recordingTimeLeft={recordingTimeLeft}
          recordingLibrary={recordingLibrary}
          onDeleteRecording={(index: number) => {
            recordingControllerRef.current?.deleteRecording(index);
          }}
          onClearAllRecordings={() => {
            setShowClearRecordingsModal(true);
          }}
          recordingResolution={recordingResolution}
          recordingFPS={recordingFPS}
          recordingDuration={recordingDuration}
          recordingCodec={recordingCodec}
          recordingQuality={recordingQuality}
          onResolutionChange={(resolution) => {
            recordingSettingsRef.current = { ...recordingSettingsRef.current, resolution };
            setRecordingResolution(resolution);
          }}
          onFPSChange={(fps) => {
            recordingSettingsRef.current = { ...recordingSettingsRef.current, fps };
            setRecordingFPS(fps);
          }}
          onDurationChange={(duration) => {
            recordingSettingsRef.current = { ...recordingSettingsRef.current, duration };
            setRecordingDuration(duration);
          }}
          onCodecChange={(codec) => {
            recordingSettingsRef.current = { ...recordingSettingsRef.current, codec };
            setRecordingCodec(codec);
          }}
          onQualityChange={(quality) => {
            recordingSettingsRef.current = { ...recordingSettingsRef.current, quality };
            setRecordingQuality(quality);
          }}
        />
        
        {/* Clear Recordings Confirmation Modal */}
        {showClearRecordingsModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-modal-title"
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.72)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowClearRecordingsModal(false); }}
          >
            <div style={{
              background: '#0e1623', border: '1px solid rgba(30,144,255,0.3)',
              borderRadius: 12, padding: '28px 32px', maxWidth: 380, width: '90%',
              boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
            }}>
              <h2 id="clear-modal-title" style={{ margin: '0 0 10px', color: '#e8edf2', fontSize: 16, fontWeight: 600 }}>
                Delete all recordings?
              </h2>
              <p style={{ margin: '0 0 24px', color: '#7a94aa', fontSize: 13, lineHeight: 1.55 }}>
                This will permanently remove all saved recordings from the library. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowClearRecordingsModal(false)}
                  style={{
                    padding: '7px 18px', borderRadius: 7, border: '1px solid rgba(122,148,170,0.3)',
                    background: 'transparent', color: '#7a94aa', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    recordingControllerRef.current?.clearRecordings();
                    setShowClearRecordingsModal(false);
                  }}
                  style={{
                    padding: '7px 18px', borderRadius: 7, border: 'none',
                    background: '#c0392b', color: '#fff', fontSize: 13, cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Star favorite button styles */}
        <style dangerouslySetInnerHTML={{__html: `
          .star-btn {
            position: relative;
            overflow: visible;
          }
          
          .star-btn .star-icon {
            transition: all 0.2s ease;
          }
          
          .star-btn:hover .star-icon {
            filter: drop-shadow(0 0 6px #1E90FF);
            transform: scale(1.1);
          }
          
          .star-btn.favorited .star-icon {
            fill: #1E90FF !important;
            filter: drop-shadow(0 0 8px #1E90FF);
          }
          
          /* 🎯 Reactivity Preset Button Styles */
          .reactivity-preset-btn:hover {
            box-shadow: 0 0 0 2px rgba(30,144,255,.3);
          }
          
          .reactivity-preset-btn:active {
            transform: translateY(1px) scale(.99);
          }
          
          .reactivity-preset-btn.active {
            background: #1E90FF !important;
            border-color: #1E90FF !important;
            color: #fff !important;
            box-shadow: 0 0 12px rgba(30,144,255,0.6) !important;
          }
        `}} />
      </>
    );
}

// CRITICAL FIX: Wrap App with Error Boundary for crash resilience
export default function App() {
  usePresetKeyboardNavigation();
  if (DEBUG_FLAGS.GENERAL) console.log('🚀 App.tsx executing!');
  if (DEBUG_FLAGS.GENERAL) console.log('📍 URL:', window.location.href);
  if (DEBUG_FLAGS.GENERAL) console.log('🎨 Rendering main App...');
  
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}   
 