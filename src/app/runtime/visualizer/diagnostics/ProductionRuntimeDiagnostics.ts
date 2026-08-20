export interface ProductionRuntimeDiagnosticsOptions {
  canvas: HTMLCanvasElement;
  performanceObj: Performance;
  resourceScope: { snapshot: () => unknown };
  params: Record<string, any>;
  audioState: any;
  sparkCometRuntime: any;
  audioSoakMonitor: any;
  uiRefreshScheduler: any;
  mainThreadUIRefreshBus: any;
  publishRenderCostDebug: (options: any) => void;
  developmentDiagnosticsEnabled: boolean;
  fieldCertificationEnabled: boolean;
  getRenderScale: () => number;
  getCurrentFps: () => number;
  getSpikeCount: () => number;
  getUseWebGL: () => boolean;
  reusableRenderCostSnapshot: any;
  performanceMetricsState: any;
  updatePerformanceMetricsHelper: (state: any, options: any) => void;
  getElement: (selector: string) => Element | null;
}

/**
 * Phase 4.8H.4
 * Keeps telemetry/HUD publication out of the production visual frame body.
 * The renderer publishes one immutable-ish frame summary; this runtime owns all
 * window diagnostics, HUD publication and soak/crash heartbeat side effects.
 */
export class ProductionRuntimeDiagnostics {
  constructor(private readonly options: ProductionRuntimeDiagnosticsOptions) {}

  updatePerformanceMetrics(now: number): void {
    const o = this.options;
    o.updatePerformanceMetricsHelper(o.performanceMetricsState, {
      now,
      canvas: o.canvas,
      getElement: o.getElement,
      performanceObj: o.performanceObj,
    });
  }

  publish(publication: any, now: number): void {
    if (!publication) return;
    const o = this.options;
    const renderCostDebugEnabled = o.fieldCertificationEnabled ||
      Boolean((window as any).__ORBITAL_RENDER_COST_DEBUG__);

    o.publishRenderCostDebug({
      costs: publication.costs,
      canvas2DSpikeBaselineActive: publication.canvas2DSpikeBaselineActive,
      engineOwnedGLActive: publication.engineOwnedGLActive,
      webglEngineActive: publication.webglEngineActive,
      enabled: renderCostDebugEnabled,
      framePacing: publication.framePacing,
      renderScale: o.getRenderScale(),
      snapshot: o.reusableRenderCostSnapshot,
    });

    if (
      o.mainThreadUIRefreshBus.hasPerformanceHUDSubscribers() &&
      o.uiRefreshScheduler.shouldRun('hud', now)
    ) {
      const memoryMB = (o.performanceObj as any).memory
        ? Math.round((o.performanceObj as any).memory.usedJSHeapSize / 1048576)
        : 0;
      const currentFPS = o.getCurrentFps();
      const fps = Math.max(0, currentFPS || Math.round(1000 / Math.max(1, publication.framePacing.avgFrameInterval)));
      const renderCosts = (window as any).__ORBITAL_RENDER_COSTS__
        ? { ...(window as any).__ORBITAL_RENDER_COSTS__, ...((window as any).__ORBITAL_INTERACTION_METRICS__ || {}) }
        : null;

      o.mainThreadUIRefreshBus.publishPerformanceHUD({
        fps,
        cpu: Math.min(100, Math.max(0, Math.round((60 - fps) * 2))),
        memoryMB,
        resolution: `${o.canvas.width}×${o.canvas.height}`,
        quality: Math.max(0, Math.min(100, Math.round((fps / 60) * 100))),
        renderCosts,
      });
    }

    if (o.developmentDiagnosticsEnabled && o.uiRefreshScheduler.shouldRun('diagnostics', now)) {
      const resources = ((window as any).__ORBITAL_RUNTIME_RESOURCES__ || o.resourceScope.snapshot()) as any;
      const heapMB = (o.performanceObj as any).memory
        ? Math.round((o.performanceObj as any).memory.usedJSHeapSize / 1048576)
        : null;
      const sparkDiagnostics = o.sparkCometRuntime.diagnostics;
      (window as any).__ORBITAL_SPARK_DIAGNOSTICS__ = sparkDiagnostics;
      const renderCostSnapshot = (window as any).__ORBITAL_RENDER_COSTS__;
      if (renderCostSnapshot && typeof renderCostSnapshot === 'object') {
        renderCostSnapshot.sparkUpdateMs = sparkDiagnostics.updateMs;
        renderCostSnapshot.sparkRenderMs = sparkDiagnostics.renderMs;
        renderCostSnapshot.sparkActive = sparkDiagnostics.activeCount;
        renderCostSnapshot.sparkQualityTier = sparkDiagnostics.qualityTier;
        renderCostSnapshot.sparkDroppedBursts = sparkDiagnostics.droppedBursts;
      }

      (window as any).__ORBITAL_AUDIO_SOAK__ = o.audioSoakMonitor.update(
        now,
        Boolean(o.audioState.isPlaying && o.audioState.mediaElement && !o.audioState.mediaElement.paused),
        resources,
        heapMB,
        sparkDiagnostics,
      );

      const mediaState = o.audioState.mediaElement
        ? {
            present: true,
            paused: o.audioState.mediaElement.paused,
            ended: o.audioState.mediaElement.ended,
            readyState: o.audioState.mediaElement.readyState,
            networkState: o.audioState.mediaElement.networkState,
            currentTime: Number.isFinite(o.audioState.mediaElement.currentTime) ? o.audioState.mediaElement.currentTime : 0,
            duration: Number.isFinite(o.audioState.mediaElement.duration) ? o.audioState.mediaElement.duration : 0,
          }
        : { present: false };

      (window as any).__ORBITAL_CRASH_TELEMETRY__?.heartbeat?.(
        resources,
        sparkDiagnostics,
        heapMB,
        {
          framePacing: publication.framePacing,
          renderScale: o.getRenderScale(),
          renderCosts: renderCostSnapshot && typeof renderCostSnapshot === 'object'
            ? { ...renderCostSnapshot }
            : null,
          activeEffects: {
            sparkImpact: Boolean(o.params.beatDetect && (o.params.beatPulseType === 'spark' || o.params.beatPulseType === 'all')),
            centerGlow: Boolean(o.params.glowCenter),
            gamma: Number(o.params.gamma || 0),
            iridize: Number(o.params.iridize || 0),
            rainbowOverlay: Number(o.params.rainbowOverlay || 0),
            astralShaper: Boolean(o.params.astralShaper),
            coreParticles: Boolean(o.params.shapeOscillate && !o.params.astralShaper),
            rotation: Number(o.params.rotation || 0),
            spikeCount: o.getSpikeCount(),
            webgl: o.getUseWebGL(),
          },
          audioState: mediaState,
        },
      );
    }
  }
}

export function createProductionRuntimeDiagnostics(options: ProductionRuntimeDiagnosticsOptions) {
  return new ProductionRuntimeDiagnostics(options);
}
