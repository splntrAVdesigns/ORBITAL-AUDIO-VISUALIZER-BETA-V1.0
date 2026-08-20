import type { RenderInputSnapshot, RenderViewportSnapshot } from '../kernel/RenderInputSnapshot';

export type RenderHostKind = 'main-thread' | 'offscreen-worker';
export type RenderHostState = 'idle' | 'running' | 'paused' | 'stopped' | 'disposed';

/**
 * Phase 4.8B host contract.
 *
 * Hosts own scheduling/surface ownership only. They must never reinterpret
 * visual parameters or contain feature-specific renderer logic. Both the
 * main-thread fallback and the future Offscreen worker host implement this
 * exact lifecycle/input contract around the same VisualizerRenderKernel.
 */
export interface RenderHost<TParameters extends object = Record<string, unknown>> {
  readonly kind: RenderHostKind;
  readonly state: RenderHostState;
  readonly isRunning: boolean;

  start(): void;
  stop(): void;
  pause(): void;
  resume(now?: number): void;
  updateInput(snapshot: RenderInputSnapshot<TParameters>): void;
  resize(viewport: RenderViewportSnapshot): void;
  dispose(): void;
}
