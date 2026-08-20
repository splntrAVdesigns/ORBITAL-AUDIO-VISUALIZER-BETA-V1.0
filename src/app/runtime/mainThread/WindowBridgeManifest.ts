/**
 * Main-thread compatibility bridge inventory.
 *
 * These globals are intentionally excluded from the render-worker contract. Every
 * custom Window/globalThis property used by ORBITAL must be listed here so the
 * bridge audit can reject accidental, unowned globals.
 */
export type WindowBridgeCategory =
  | 'audio-control'
  | 'runtime-state'
  | 'ui-command'
  | 'controller-reference'
  | 'feature-compatibility'
  | 'diagnostics';

export type WindowBridgeDisposition =
  | 'replace-before-worker-cutover'
  | 'keep-main-thread-only'
  | 'debug-only';

export interface WindowBridgeManifestEntry {
  readonly key: string;
  readonly category: WindowBridgeCategory;
  readonly disposition: WindowBridgeDisposition;
  readonly owner: string;
  readonly lifecycle: 'app' | 'runtime-session' | 'feature-session' | 'debug-session';
  readonly notes: string;
}

const bridge = (
  key: string,
  category: WindowBridgeCategory,
  disposition: WindowBridgeDisposition,
  owner: string,
  lifecycle: WindowBridgeManifestEntry['lifecycle'],
  notes: string,
): WindowBridgeManifestEntry => Object.freeze({ key, category, disposition, owner, lifecycle, notes });

export const WINDOW_BRIDGE_MANIFEST: readonly WindowBridgeManifestEntry[] = Object.freeze([
  // Audio engine and playback compatibility.
  bridge('AC', 'audio-control', 'keep-main-thread-only', 'audioUIController/useAudioSystem', 'app', 'Main-thread AudioContext handle; never transferred to the renderer worker.'),
  bridge('mediaEl', 'audio-control', 'keep-main-thread-only', 'AudioSystemInit/useAudioSystem', 'app', 'HTMLAudioElement handle; worker receives analysis snapshots only.'),
  bridge('loadFile', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy ControlPanel command bridge; replace with typed React/controller callback.'),
  bridge('unloadAudioFile', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Releases the active media element and owned playback object URL when the current playlist item is removed or cleared.'),
  bridge('playButtonHandler', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy play command bridge.'),
  bridge('setPlaylist', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy React setter bridge.'),
  bridge('setAudioTab', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy React setter bridge.'),
  bridge('setCurrentTrackIndex', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy React setter bridge.'),
  bridge('setCurrentTime', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy React setter bridge.'),
  bridge('setAudioDuration', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy React setter bridge.'),
  bridge('setIsAudioPlaying', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy React setter bridge.'),
  bridge('setIsMicActive', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy React setter bridge.'),
  bridge('setMonitorEnabled', 'audio-control', 'replace-before-worker-cutover', 'audioUIController', 'app', 'Legacy React setter bridge.'),
  bridge('setCurrentPresetName', 'audio-control', 'replace-before-worker-cutover', 'audioUIController/presetActions', 'app', 'Legacy React setter bridge.'),
  bridge('updateMetadataDisplay', 'audio-control', 'replace-before-worker-cutover', 'visualizer runtime', 'runtime-session', 'Legacy metadata callback installed for the audio engine.'),
  bridge('setPaletteByName', 'audio-control', 'replace-before-worker-cutover', 'AudioSystemInit', 'feature-session', 'Compatibility hook for analyser palette changes.'),
  bridge('updateMonitor', 'audio-control', 'replace-before-worker-cutover', 'AudioControlsSection', 'feature-session', 'Compatibility hook for monitor state.'),
  bridge('RadialAnalyzer', 'audio-control', 'keep-main-thread-only', 'AudioSystemInit', 'feature-session', 'Main-thread analyser integration; worker receives compact analysis data.'),

  // Runtime state mirrors used by legacy controls.
  bridge('params', 'runtime-state', 'replace-before-worker-cutover', 'visualizer runtime', 'runtime-session', 'Canonical migration target is RuntimeParameterStore plus typed parameter patches.'),
  bridge('playlist', 'runtime-state', 'replace-before-worker-cutover', 'audioUIController/useOrbitalAppLifecycle', 'app', 'Legacy playback state mirror.'),
  bridge('playlistIndex', 'runtime-state', 'replace-before-worker-cutover', 'AudioSystemInit', 'app', 'Reserved legacy playback index mirror.'),
  bridge('monitorEnabled', 'runtime-state', 'replace-before-worker-cutover', 'useOrbitalAppLifecycle', 'app', 'Legacy playback state mirror.'),
  bridge('autoAdvance', 'runtime-state', 'replace-before-worker-cutover', 'useOrbitalAppLifecycle', 'app', 'Legacy playback state mirror.'),
  bridge('shuffleEnabled', 'runtime-state', 'replace-before-worker-cutover', 'useOrbitalAppLifecycle', 'app', 'Legacy playback state mirror.'),
  bridge('__coreTexturesUIEnabled', 'runtime-state', 'replace-before-worker-cutover', 'CoreTexturesSettings', 'feature-session', 'Legacy Core Textures UI state mirror.'),
  bridge('__coreTexturesSelectedShader', 'runtime-state', 'replace-before-worker-cutover', 'CoreTexturesSettings', 'feature-session', 'Legacy Core Textures shader selection mirror.'),

  // UI command shims. These stay on the main thread and must not be called by worker code.
  bridge('applyMacro', 'ui-command', 'replace-before-worker-cutover', 'presetActions/App', 'runtime-session', 'Replace with typed macro command dispatch.'),
  bridge('applyPendingMacroChanges', 'ui-command', 'replace-before-worker-cutover', 'presetActions', 'runtime-session', 'Main-thread UI batching hook.'),
  bridge('applyPendingLiquidChanges', 'ui-command', 'replace-before-worker-cutover', 'presetActions', 'runtime-session', 'Main-thread UI batching hook.'),
  bridge('resetAstralShaper', 'ui-command', 'replace-before-worker-cutover', 'presetActions', 'runtime-session', 'Section reset command.'),
  bridge('resetCenterGraphic', 'ui-command', 'replace-before-worker-cutover', 'presetActions', 'runtime-session', 'Section reset command.'),
  bridge('resetColorBPM', 'ui-command', 'replace-before-worker-cutover', 'presetActions', 'runtime-session', 'Section reset command.'),
  bridge('resetDots', 'ui-command', 'replace-before-worker-cutover', 'presetActions', 'runtime-session', 'Section reset command.'),
  bridge('resetOuterHaloCenterLayer', 'ui-command', 'replace-before-worker-cutover', 'presetActions', 'runtime-session', 'Section reset command.'),
  bridge('resetRotationSync', 'ui-command', 'replace-before-worker-cutover', 'presetActions', 'runtime-session', 'Section reset command.'),
  bridge('resetSpikeRing', 'ui-command', 'replace-before-worker-cutover', 'presetActions', 'runtime-session', 'Section reset command.'),
  bridge('updateShaderControls', 'ui-command', 'replace-before-worker-cutover', 'CoreTexturesEngine', 'feature-session', 'Legacy shader-control synchronization hook.'),

  // Object references that are strictly main-thread owned.
  bridge('centerGraphicController', 'controller-reference', 'replace-before-worker-cutover', 'visualizer runtime', 'runtime-session', 'DOM/media controller; worker receives media commands and transferable frames only.'),
  bridge('coreTexturesEngine', 'controller-reference', 'replace-before-worker-cutover', 'visualizer runtime', 'runtime-session', 'Main-thread compatibility reference during renderer migration.'),

  // Development/diagnostic publication. Never a worker dependency.
  bridge('__ORBITAL_AUDIO_GRAPH__', 'diagnostics', 'debug-only', 'AudioSystemInit', 'debug-session', 'Audio graph identity snapshot used to detect accidental rebuilds.'),
  bridge('__ORBITAL_AUDIO_VISUAL_STRESS__', 'diagnostics', 'debug-only', 'AudioVisualStressDiagnostics', 'debug-session', 'Gamma/Iridize and audio-stall correlation snapshot.'),
  bridge('__ORBITAL_AUDIO_SOAK__', 'diagnostics', 'debug-only', 'RuntimeAudioSoakMonitor', 'debug-session', 'Frame-driven before/after resource and heap snapshots for the 15-minute uploaded-audio soak.'),
  bridge('__ORBITAL_CRASH_TELEMETRY__', 'diagnostics', 'debug-only', 'useCrashTelemetry', 'debug-session', 'Crash telemetry accessor.'),
  bridge('__ORBITAL_CORE_PARTICLES_GPU__', 'diagnostics', 'debug-only', 'CoreParticlesGpuRenderer', 'debug-session', 'GPU backend, draw-count, context recovery, fallback, and CPU submission timings.'),
  bridge('__ORBITAL_DEBUG_CONTROLS__', 'diagnostics', 'debug-only', 'ControlPanel', 'debug-session', 'Opt-in control render diagnostics flag.'),
  bridge('__ORBITAL_FRAME_PACING__', 'diagnostics', 'debug-only', 'FramePacingRuntime', 'debug-session', 'Throttled frame pacing snapshot.'),
  bridge('__ORBITAL_INTERACTION_METRICS__', 'diagnostics', 'debug-only', 'UIInteractionRuntime', 'debug-session', 'Scroll/drag presentation proxy metrics.'),
  bridge('__ORBITAL_INTERACTION_ACTIVE__', 'diagnostics', 'debug-only', 'UIInteractionRuntime', 'debug-session', 'Production-safe transient interaction-active mirror used to defer nonessential UI work.'),
  bridge('__ORBITAL_INTERACTION_STATE__', 'diagnostics', 'debug-only', 'UIInteractionRuntime', 'debug-session', 'Production-safe transient interaction-state mirror for scroll/drag correlation.'),
  bridge('__ORBITAL_LAST_CONTROL_TRANSACTION__', 'diagnostics', 'debug-only', 'presetActions', 'debug-session', 'Latest batched preset/control transaction timing and queue-depth snapshot.'),
  bridge('__ORBITAL_LAST_UI_FLUSH_MS__', 'diagnostics', 'debug-only', 'renderFrameRuntime', 'debug-session', 'Last deferred UI flush cost.'),
  bridge('__ORBITAL_MIC_STATUS__', 'diagnostics', 'debug-only', 'AudioSystemInit', 'debug-session', 'Microphone permission/status snapshot.'),
  bridge('__ORBITAL_PANEL_RENDER__', 'diagnostics', 'debug-only', 'UIInteractionRuntime', 'debug-session', 'Panel render counter callback.'),
  bridge('__ORBITAL_RAF_CRASH_COUNT__', 'diagnostics', 'debug-only', 'visualizer runtime', 'debug-session', 'RAF recovery count.'),
  bridge('__ORBITAL_SPARK_DIAGNOSTICS__', 'diagnostics', 'debug-only', 'SparkCometRuntime', 'debug-session', 'Active/max spark count and emitted-burst counters.'),
  bridge('__ORBITAL_RENDER_COSTS__', 'diagnostics', 'debug-only', 'renderFrameRuntime', 'debug-session', 'Throttled render pass cost snapshot.'),
  bridge('__ORBITAL_RENDER_COST_DEBUG__', 'diagnostics', 'debug-only', 'PerformanceHUDOverlay', 'debug-session', 'Enables render cost publication.'),
  bridge('__ORBITAL_RENDER_COST_LAST__', 'diagnostics', 'debug-only', 'renderFrameRuntime', 'debug-session', 'Render cost publication timestamp.'),
  bridge('__ORBITAL_RENDER_SCALE__', 'diagnostics', 'debug-only', 'createViewportPanelSetup', 'debug-session', 'Active adaptive render-scale snapshot.'),
  bridge('__ORBITAL_PHASE_4_8H_5_CERTIFICATION__', 'diagnostics', 'debug-only', 'ProductionPerformanceCertification', 'debug-session', 'Phase 4.8H.5 bounded parity/performance certification snapshot.'),
  bridge('__ORBITAL_BEGIN_PHASE_4_8H_5_CERTIFICATION__', 'diagnostics', 'debug-only', 'ProductionPerformanceCertification', 'debug-session', 'Starts explicit Phase 4.8H.5 field certification sampling.'),
  bridge('__ORBITAL_END_PHASE_4_8H_5_CERTIFICATION__', 'diagnostics', 'debug-only', 'ProductionPerformanceCertification', 'debug-session', 'Stops Phase 4.8H.5 field certification and freezes results.'),
  bridge('__ORBITAL_RESET_PHASE_4_8H_5_CERTIFICATION__', 'diagnostics', 'debug-only', 'ProductionPerformanceCertification', 'debug-session', 'Clears the current Phase 4.8H.5 certification sample set.'),
  bridge('__ORBITAL_RUNTIME_RESOURCE_COUNTS__', 'diagnostics', 'debug-only', 'RuntimeResourceDiagnostics', 'debug-session', 'Private backing store for resource counts.'),
  bridge('__ORBITAL_RUNTIME_RESOURCES__', 'diagnostics', 'debug-only', 'RuntimeResourceDiagnostics', 'debug-session', 'Public resource-count snapshot.'),
  bridge('__ORBITAL_VISUAL_BUS__', 'diagnostics', 'debug-only', 'lowLatencyVisualBus', 'debug-session', 'Latest low-latency visual bus snapshot.'),
]);

export const WINDOW_BRIDGE_KEYS = Object.freeze(
  WINDOW_BRIDGE_MANIFEST.map((entry) => entry.key),
);

export function getWindowBridgeEntry(key: string): WindowBridgeManifestEntry | undefined {
  return WINDOW_BRIDGE_MANIFEST.find((entry) => entry.key === key);
}
