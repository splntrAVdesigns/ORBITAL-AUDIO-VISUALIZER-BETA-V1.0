import { trackGlobalRuntimeResource } from '../visualizer/session/RuntimeResourceDiagnostics';

export type MainThreadAsyncOwner = string;

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type IntervalHandle = ReturnType<typeof globalThis.setInterval>;
type RafHandle = number;

interface OwnedRelease {
  owner: MainThreadAsyncOwner;
  release: () => void;
}

export interface MainThreadAsyncSnapshot {
  activeTimeouts: number;
  activeIntervals: number;
  activeShortLivedRafs: number;
  owners: Record<string, number>;
}

const timeoutReleases = new Map<TimeoutHandle, OwnedRelease>();
const intervalReleases = new Map<IntervalHandle, OwnedRelease>();
const rafReleases = new Map<RafHandle, OwnedRelease>();

function ownerSnapshot(): Record<string, number> {
  const owners: Record<string, number> = {};
  const add = (entry: OwnedRelease) => {
    owners[entry.owner] = (owners[entry.owner] ?? 0) + 1;
  };
  timeoutReleases.forEach(add);
  intervalReleases.forEach(add);
  rafReleases.forEach(add);
  return owners;
}

export function getMainThreadAsyncSnapshot(): MainThreadAsyncSnapshot {
  return {
    activeTimeouts: timeoutReleases.size,
    activeIntervals: intervalReleases.size,
    activeShortLivedRafs: rafReleases.size,
    owners: ownerSnapshot(),
  };
}

export function scheduleTrackedTimeout(
  owner: MainThreadAsyncOwner,
  callback: () => void,
  delayMs = 0,
): TimeoutHandle {
  const release = trackGlobalRuntimeResource('activeClassifiedTimeouts');
  let handle: TimeoutHandle;
  const wrapped = () => {
    timeoutReleases.delete(handle);
    release();
    callback();
  };
  handle = globalThis.setTimeout(wrapped, delayMs);
  timeoutReleases.set(handle, { owner, release });
  return handle;
}

export function cancelTrackedTimeout(handle: TimeoutHandle | null | undefined): void {
  if (handle == null) return;
  globalThis.clearTimeout(handle);
  const owned = timeoutReleases.get(handle);
  if (!owned) return;
  timeoutReleases.delete(handle);
  owned.release();
}

export function scheduleTrackedInterval(
  owner: MainThreadAsyncOwner,
  callback: () => void,
  delayMs: number,
): IntervalHandle {
  const release = trackGlobalRuntimeResource('activeClassifiedIntervals');
  const handle = globalThis.setInterval(callback, delayMs);
  intervalReleases.set(handle, { owner, release });
  return handle;
}

export function cancelTrackedInterval(handle: IntervalHandle | null | undefined): void {
  if (handle == null) return;
  globalThis.clearInterval(handle);
  const owned = intervalReleases.get(handle);
  if (!owned) return;
  intervalReleases.delete(handle);
  owned.release();
}

/**
 * Tracks one-shot RAF work only. The authoritative continuous visual RAF remains
 * RuntimeFrameScheduler; this helper is reserved for bounded UI/layout work.
 */
export function requestTrackedShortLivedRaf(
  owner: MainThreadAsyncOwner,
  callback: FrameRequestCallback,
): RafHandle {
  const release = trackGlobalRuntimeResource('activeShortLivedRafs');
  let handle = 0;
  const wrapped: FrameRequestCallback = (time) => {
    rafReleases.delete(handle);
    release();
    callback(time);
  };
  handle = globalThis.requestAnimationFrame(wrapped);
  rafReleases.set(handle, { owner, release });
  return handle;
}

export function cancelTrackedShortLivedRaf(handle: RafHandle | null | undefined): void {
  if (handle == null || handle === 0) return;
  globalThis.cancelAnimationFrame(handle);
  const owned = rafReleases.get(handle);
  if (!owned) return;
  rafReleases.delete(handle);
  owned.release();
}
