export interface Shockwave {
  radius: number;
  alpha: number;
  maxRadius: number;
  active?: boolean;
}

export interface PendingShockwave {
  spawnTime: number;
  radius: number;
  alpha: number;
  maxRadius: number;
  active?: boolean;
}

export interface ShockwaveRuntimeOptions {
  maxShockwaves?: number;
  maxPendingShockwaves?: number;
}

export class ShockwaveRuntime {
  readonly maxShockwaves: number;
  readonly maxPendingShockwaves: number;
  readonly shockwavePool: Shockwave[];
  readonly pendingShockwavePool: PendingShockwave[];

  constructor(options: ShockwaveRuntimeOptions = {}) {
    this.maxShockwaves = options.maxShockwaves ?? 50;
    this.maxPendingShockwaves = options.maxPendingShockwaves ?? 20;
    this.shockwavePool = Array.from({ length: this.maxShockwaves }, () => ({
      radius: 0,
      alpha: 0,
      maxRadius: 0,
      active: false,
    }));
    this.pendingShockwavePool = Array.from({ length: this.maxPendingShockwaves }, () => ({
      spawnTime: 0,
      radius: 0,
      alpha: 0,
      maxRadius: 0,
      active: false,
    }));
  }

  spawnShockwave(radius: number, alpha: number, maxRadius: number): void {
    for (let i = 0; i < this.maxShockwaves; i++) {
      const sw = this.shockwavePool[i];
      if (!sw.active) {
        sw.radius = radius;
        sw.alpha = alpha;
        sw.maxRadius = maxRadius;
        sw.active = true;
        return;
      }
    }
  }

  spawnShockwaveRings(params: { shockwaveRings: number; macro3: number }, baseAlpha: number, R0: number, RH: number, debugLog?: (message: string) => void): void {
    const ringCount = Math.max(1, Math.round(params.shockwaveRings));
    const macro3Multiplier = params.macro3 / 100;
    const alphaBoost = 1.0 + macro3Multiplier * 0.5;

    if (ringCount < 1) return;
    if (debugLog && Math.random() < 0.01) {
      debugLog(`🌊 Spawning shockwave rings: ${ringCount} baseAlpha: ${baseAlpha.toFixed(2)}`);
    }

    const radii = [0.6, 0.65, 0.7, 0.75, 0.8];
    const alphas = [2.0, 1.5, 1.2, 1.0, 0.8];
    const delays = [0, 0.05, 0.10, 0.15, 0.20];

    for (let i = 0; i < ringCount; i++) {
      const radius = R0 * radii[i];
      const alpha = alphas[i] * baseAlpha * alphaBoost;
      const maxRadius = RH * 0.95;
      if (i === 0) {
        this.spawnShockwave(radius, alpha, maxRadius);
        continue;
      }
      for (let poolIdx = 0; poolIdx < this.maxPendingShockwaves; poolIdx++) {
        const pending = this.pendingShockwavePool[poolIdx];
        if (!pending.active) {
          pending.spawnTime = delays[i];
          pending.radius = radius;
          pending.alpha = alpha;
          pending.maxRadius = maxRadius;
          pending.active = true;
          break;
        }
      }
    }
  }

  processPending(dt: number): void {
    for (let i = 0; i < this.maxPendingShockwaves; i++) {
      const pending = this.pendingShockwavePool[i];
      if (!pending.active) continue;
      pending.spawnTime -= dt;
      if (pending.spawnTime <= 0) {
        this.spawnShockwave(pending.radius, pending.alpha, pending.maxRadius);
        pending.active = false;
      }
    }
  }
}

export interface BeatPulseUpdateArgs {
  beatPulse: number;
  dt: number;
  damp: (value: number, target: number, speed: number, dt: number) => number;
  applyBeatPulse: (beatPulse: number, reactivityMultiplier: number) => void;
  beatReactivityBoost: boolean;
}

export function updateBeatPulseState(args: BeatPulseUpdateArgs): number {
  const nextBeatPulse = args.damp(args.beatPulse, 0, 14, args.dt);
  args.applyBeatPulse(
    nextBeatPulse,
    args.beatReactivityBoost ? (1 + nextBeatPulse * 0.34) : 1
  );
  return nextBeatPulse;
}

export class SoftParticleSpriteCache {
  private cache = new Map<number, HTMLCanvasElement>();

  get(radius: number): HTMLCanvasElement {
    const bucket = Math.max(2, Math.round(radius * 2) / 2);
    const cached = this.cache.get(bucket);
    if (cached) return cached;

    const size = Math.ceil(bucket * 8);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const sctx = canvas.getContext('2d');
    if (!sctx) return canvas;

    const cx = size / 2;
    const cy = size / 2;
    const grad = sctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    grad.addColorStop(0.00, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, 'rgba(255,255,255,0.42)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.14)');
    grad.addColorStop(0.78, 'rgba(255,255,255,0.03)');
    grad.addColorStop(1.00, 'rgba(255,255,255,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);

    this.cache.set(bucket, canvas);
    return canvas;
  }

  clear(): void {
    this.cache.clear();
  }
}

export interface SpikeLookupTables {
  spikeCosTable: Float32Array;
  spikeSinTable: Float32Array;
  transientBoostNoise: Float32Array;
}

export function buildSpikeLookupTables(size: number): SpikeLookupTables {
  const spikeCosTable = new Float32Array(size);
  const spikeSinTable = new Float32Array(size);
  const transientBoostNoise = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    const angle = (i / size) * Math.PI * 2;
    spikeCosTable[i] = Math.cos(angle);
    spikeSinTable[i] = Math.sin(angle);

    const hash1 = Math.sin((i + 1) * 12.9898) * 43758.5453123;
    const hash2 = Math.sin((i + 1) * 78.233) * 12345.6789;
    const hash3 = Math.sin((i + 1) * 31.4159) * 24691.3571;

    const n1 = (hash1 - Math.floor(hash1)) - 0.5;
    const n2 = (hash2 - Math.floor(hash2)) - 0.5;
    const n3 = (hash3 - Math.floor(hash3)) - 0.5;
    const blendedNoise = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;
    const contourA = Math.sin((i / size) * Math.PI * 8.0);
    const contourB = Math.sin((i / size) * Math.PI * 19.0) * 0.45;
    transientBoostNoise[i] = blendedNoise * (0.92 + 0.08 * contourA) + contourB * 0.12;
  }

  return { spikeCosTable, spikeSinTable, transientBoostNoise };
}

export interface PerformanceMetricsState {
  lastFpsUpdate: number;
  perfFrameCount: number;
  lastPerfFrameTime: number;
}

export function updatePerformanceMetrics(state: PerformanceMetricsState, options: {
  now?: number;
  canvas: HTMLCanvasElement;
  getElement: (selector: string) => HTMLElement | null;
  performanceObj?: Performance;
}): void {
  state.perfFrameCount++;
  const now = options.now ?? performance.now();

  if (now - state.lastFpsUpdate >= 1000) {
    const fps = Math.round(state.perfFrameCount);
    state.perfFrameCount = 0;
    state.lastFpsUpdate = now;

    const fpsEl = options.getElement('#fps');
    if (fpsEl) fpsEl.textContent = String(fps);

    const resEl = options.getElement('#resolution');
    if (resEl) resEl.textContent = `${options.canvas.width}×${options.canvas.height}`;

    const perfObj: any = options.performanceObj ?? performance;
    const memEl = options.getElement('#memUsage');
    if (memEl && perfObj.memory) {
      const memMB = Math.round(perfObj.memory.usedJSHeapSize / 1048576);
      memEl.textContent = `${memMB}MB`;
    }

    const frameTime = now - state.lastPerfFrameTime;
    const cpuPercent = Math.min(100, Math.round((frameTime / 16.67) * 100));
    const cpuEl = options.getElement('#cpuUsage');
    if (cpuEl) cpuEl.textContent = `${cpuPercent}%`;
  }

  state.lastPerfFrameTime = now;
}

export interface IdleCacheCleanupHandle {
  dispose: () => void;
}

export function startIdleCacheCleanup(clearCache: () => void, intervalMs = 15000, idleTimeoutMs = 800): IdleCacheCleanupHandle {
  let disposed = false;
  let timeoutId: number | null = null;
  let idleId: number | null = null;

  const schedule = () => {
    if (disposed) return;
    timeoutId = window.setTimeout(() => {
      if (disposed) return;
      const requestIdle = (window as any).requestIdleCallback;
      if (typeof requestIdle === 'function') {
        idleId = requestIdle(() => {
          idleId = null;
          if (disposed) return;
          clearCache();
          schedule();
        }, { timeout: idleTimeoutMs });
      } else {
        clearCache();
        schedule();
      }
    }, intervalMs);
  };

  schedule();

  return {
    dispose: () => {
      disposed = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (idleId !== null && typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleId);
      }
      timeoutId = null;
      idleId = null;
    },
  };
}