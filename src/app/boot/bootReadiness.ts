/**
 * Sprint L2: real boot readiness.
 *
 * The loader is dismissed when every stage below has actually completed, instead of
 * on a fixed timer. Stages are marked by the code that owns them:
 *
 *   shell     visualizer chunk loaded and mounted            (App.tsx)
 *   viewport  canvas stage measured and committed            (SessionBootSequence)
 *   ui        controls synced to defaults, readouts bound    (SessionBootSequence)
 *   frame     the frame scheduler has presented frames       (SessionBootSequence)
 *   shaders   GPU programs pre-compiled behind the loader     (SessionBootSequence, Sprint M1)
 *   fonts     document fonts settled                         (OrbitalBoot)
 *
 * Plain external store (no React dependency) so the runtime can mark stages
 * without importing UI code.
 */
export type BootStage = 'shell' | 'viewport' | 'ui' | 'frame' | 'shaders' | 'fonts';

export const BOOT_STAGES: readonly BootStage[] = ['shell', 'viewport', 'ui', 'frame', 'shaders', 'fonts'];

export const BOOT_STAGE_LABELS: Record<BootStage, string> = {
  shell: 'Loading visual engine',
  viewport: 'Measuring stage',
  ui: 'Syncing controls',
  frame: 'Rendering first frames',
  shaders: 'Warming GPU shaders',
  fonts: 'Finishing up',
};

export interface BootSnapshot {
  completed: number;
  total: number;
  progress: number;
  ready: boolean;
  /** First stage still pending, used for the loader status line. */
  pending: BootStage | null;
}

type Listener = () => void;

const done = new Set<BootStage>();
const listeners = new Set<Listener>();
let snapshot: BootSnapshot = buildSnapshot();

function buildSnapshot(): BootSnapshot {
  const completed = done.size;
  const total = BOOT_STAGES.length;
  return {
    completed,
    total,
    progress: completed / total,
    ready: completed === total,
    pending: BOOT_STAGES.find((stage) => !done.has(stage)) ?? null,
  };
}

function publish(): void {
  snapshot = buildSnapshot();
  for (const listener of listeners) listener();
}

export function markBootStage(stage: BootStage): void {
  if (done.has(stage)) return;
  done.add(stage);
  publish();
}

export function isBootStageDone(stage: BootStage): boolean {
  return done.has(stage);
}

/** Called by the shell at Launch so a relaunch in the same tab starts clean. */
export function resetBootReadiness(): void {
  if (done.size === 0) return;
  done.clear();
  publish();
}

export function subscribeBootReadiness(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getBootSnapshot(): BootSnapshot {
  return snapshot;
}
