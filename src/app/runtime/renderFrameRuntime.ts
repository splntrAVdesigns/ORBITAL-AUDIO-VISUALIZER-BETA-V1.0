export interface FrameCostSnapshot {
  frame: number;
  audioRead: number;
  canvas2D: number;
  webgl: number;
  coreParticles: number;
  liquidShaper: number;
  uiFlush: number;
  rotation: number;
  dots: number;
  halo: number;
  comet: number;
  orbital: number;
  shockwave: number;
  canvas2DSpikeBaselineActive: boolean;
  engineOwnedGLActive: boolean;
  webglEngineActive: boolean;
  frameInterval?: number;
  avgFrameInterval?: number;
  worstFrameInterval?: number;
  jitter?: number;
  droppedFrames?: number;
  longFrames?: number;
  rafDrift?: number;
  p95FrameInterval?: number;
  p99FrameInterval?: number;
  qualityTier?: string;
  renderMode?: string;
  effectiveDpr?: number;
  deviceDpr?: number;
  renderPixels?: number;
}

export interface FramePhaseCosts {
  renderStartTime: number;
  audioReadMs: number;
  canvas2DMs: number;
  webglMs: number;
  coreParticlesMs: number;
  liquidShaperMs: number;
  uiFlushMs: number;
  rotationMs: number;
  dotsMs: number;
  haloMs: number;
  cometMs: number;
  orbitalMs: number;
  shockwaveMs: number;
}

export function createFramePhaseCosts(now: () => number = () => performance.now()): FramePhaseCosts {
  return {
    renderStartTime: now(),
    audioReadMs: 0,
    canvas2DMs: 0,
    webglMs: 0,
    coreParticlesMs: 0,
    liquidShaperMs: 0,
    uiFlushMs: 0,
    rotationMs: 0,
    dotsMs: 0,
    haloMs: 0,
    cometMs: 0,
    orbitalMs: 0,
    shockwaveMs: 0,
  };
}

export function resetFramePhaseCosts(
  costs: FramePhaseCosts,
  now: () => number = () => performance.now(),
  enabled = true,
): FramePhaseCosts {
  costs.renderStartTime = enabled ? now() : 0;
  costs.audioReadMs = 0;
  costs.canvas2DMs = 0;
  costs.webglMs = 0;
  costs.coreParticlesMs = 0;
  costs.liquidShaperMs = 0;
  costs.uiFlushMs = 0;
  costs.rotationMs = 0;
  costs.dotsMs = 0;
  costs.haloMs = 0;
  costs.cometMs = 0;
  costs.orbitalMs = 0;
  costs.shockwaveMs = 0;
  return costs;
}

export function measureElapsed(startTime: number, now: () => number = () => performance.now()): number {
  return Math.max(0, now() - startTime);
}

export function flushQueuedUIUpdates(args: {
  pending: Array<() => void>;
  setPending: (pending: boolean) => void;
  setLastUIFlushMs?: (ms: number) => void;
  now?: () => number;
  requestIdle?: typeof requestIdleCallback;
  maxUpdatesPerFlush?: number;
  maxFlushMs?: number;
}): void {
  if (args.pending.length <= 0) return;

  const maxUpdates = Math.max(1, args.maxUpdatesPerFlush ?? 4);
  const updates = args.pending.splice(0, maxUpdates);
  args.setPending(args.pending.length > 0);
  const now = args.now ?? (() => performance.now());
  const flushFn = () => {
    const uiStart = now();
    const maxMs = Math.max(0.5, args.maxFlushMs ?? 1.5);
    for (let i = 0; i < updates.length; i++) {
      if (i > 0 && measureElapsed(uiStart, now) >= maxMs) {
        args.pending.unshift(...updates.slice(i));
        args.setPending(true);
        break;
      }
      try {
        updates[i]();
      } catch (err) {
        console.error('UI update error:', err);
      }
    }
    const uiFlushMs = measureElapsed(uiStart, now);
    args.setLastUIFlushMs?.(uiFlushMs);
    (window as any).__ORBITAL_LAST_UI_FLUSH_MS__ = uiFlushMs;
  };

  const idle = args.requestIdle ?? ((window as any).requestIdleCallback as typeof requestIdleCallback | undefined);
  if (typeof idle === 'function') {
    idle(flushFn, { timeout: 100 });
  } else {
    window.setTimeout(flushFn, 0);
  }
}

export function publishRenderCostDebug(args: {
  costs: FramePhaseCosts;
  canvas2DSpikeBaselineActive: boolean;
  engineOwnedGLActive: boolean;
  webglEngineActive: boolean;
  enabled?: boolean;
  now?: () => number;
  getElement?: (id: string) => HTMLElement | null;
  framePacing?: any;
  renderScale?: any;
  snapshot?: FrameCostSnapshot;
}): void {
  if (!args.enabled && !(window as any).__ORBITAL_RENDER_COST_DEBUG__) return;

  const now = args.now ?? (() => performance.now());
  const nowCost = now();
  const lastCostUpdate = (window as any).__ORBITAL_RENDER_COST_LAST__ || 0;
  if (nowCost - lastCostUpdate <= 500) return;

  const frameMs = measureElapsed(args.costs.renderStartTime, now);
  const uiFlushMs = (window as any).__ORBITAL_LAST_UI_FLUSH_MS__ || args.costs.uiFlushMs;
  const snapshot = args.snapshot ?? {} as FrameCostSnapshot;
  Object.assign(snapshot, {
    frame: frameMs,
    audioRead: args.costs.audioReadMs,
    canvas2D: args.costs.canvas2DMs,
    webgl: args.costs.webglMs,
    coreParticles: args.costs.coreParticlesMs,
    liquidShaper: args.costs.liquidShaperMs,
    uiFlush: uiFlushMs,
    rotation: args.costs.rotationMs,
    dots: args.costs.dotsMs,
    halo: args.costs.haloMs,
    comet: args.costs.cometMs,
    orbital: args.costs.orbitalMs,
    shockwave: args.costs.shockwaveMs,
    canvas2DSpikeBaselineActive: Boolean(args.canvas2DSpikeBaselineActive),
    engineOwnedGLActive: Boolean(args.engineOwnedGLActive),
    webglEngineActive: Boolean(args.webglEngineActive),
    frameInterval: args.framePacing?.frameInterval,
    avgFrameInterval: args.framePacing?.avgFrameInterval,
    worstFrameInterval: args.framePacing?.worstFrameInterval,
    jitter: args.framePacing?.jitter,
    droppedFrames: args.framePacing?.droppedFrames,
    longFrames: args.framePacing?.longFrames,
    rafDrift: args.framePacing?.rafDrift,
    p95FrameInterval: args.framePacing?.p95FrameInterval,
    p99FrameInterval: args.framePacing?.p99FrameInterval,
    qualityTier: args.framePacing?.qualityTier,
    renderMode: args.renderScale?.mode,
    effectiveDpr: args.renderScale?.effectiveDpr,
    deviceDpr: args.renderScale?.deviceDpr,
    renderPixels: args.renderScale?.pixelCount,
  });

  (window as any).__ORBITAL_RENDER_COST_LAST__ = nowCost;
  (window as any).__ORBITAL_RENDER_COSTS__ = snapshot;

  const getElement = args.getElement ?? ((id: string) => document.getElementById(id));
  const hud = getElement('renderCostDebug');
  if (hud) {
    hud.textContent = `FRAME ${snapshot.frame.toFixed(1)}ms | AUDIO ${snapshot.audioRead.toFixed(2)} | C2D ${snapshot.canvas2D.toFixed(1)} | HALO ${snapshot.halo.toFixed(2)} | COMET ${snapshot.comet.toFixed(2)} | ORBIT ${snapshot.orbital.toFixed(2)} | SHOCK ${snapshot.shockwave.toFixed(2)} | GL ${snapshot.webgl.toFixed(1)} | UI ${snapshot.uiFlush.toFixed(2)} | JIT ${(snapshot.jitter ?? 0).toFixed(1)} | DROP ${snapshot.droppedFrames ?? 0} | DPR ${(snapshot.effectiveDpr ?? 0).toFixed(2)} | C2D-SPIKE ${snapshot.canvas2DSpikeBaselineActive ? 'ON' : 'OFF'}`;
  }
}
