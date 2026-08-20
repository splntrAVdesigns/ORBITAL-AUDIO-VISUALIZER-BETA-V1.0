export type AudioObjectUrlKind = 'duration-probe' | 'playback';

export interface AudioObjectUrlAdapter {
  createObjectURL(value: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface AudioObjectUrlSnapshot {
  readonly active: number;
  readonly created: number;
  readonly revoked: number;
  readonly durationProbeActive: number;
  readonly playbackActive: number;
}

interface AudioObjectUrlEntry {
  readonly kind: AudioObjectUrlKind;
  readonly label: string;
}

/**
 * Owns every blob URL created for uploaded audio. URLs are revoked only by the
 * owner that created them, which makes replacement/disposal deterministic.
 */
export class AudioObjectUrlRegistry {
  private readonly entries = new Map<string, AudioObjectUrlEntry>();
  private createdCount = 0;
  private revokedCount = 0;

  constructor(private readonly adapter: AudioObjectUrlAdapter = URL) {}

  create(file: Blob, kind: AudioObjectUrlKind, label = ''): string {
    const url = this.adapter.createObjectURL(file);
    this.entries.set(url, { kind, label });
    this.createdCount += 1;
    return url;
  }

  revoke(url: string | null | undefined): boolean {
    if (!url || !this.entries.has(url)) return false;
    this.entries.delete(url);
    this.adapter.revokeObjectURL(url);
    this.revokedCount += 1;
    return true;
  }

  revokeKind(kind: AudioObjectUrlKind): number {
    let revoked = 0;
    for (const [url, entry] of [...this.entries]) {
      if (entry.kind !== kind) continue;
      if (this.revoke(url)) revoked += 1;
    }
    return revoked;
  }

  revokeAll(): number {
    let revoked = 0;
    for (const url of [...this.entries.keys()]) {
      if (this.revoke(url)) revoked += 1;
    }
    return revoked;
  }

  has(url: string | null | undefined): boolean {
    return !!url && this.entries.has(url);
  }

  snapshot(): AudioObjectUrlSnapshot {
    let durationProbeActive = 0;
    let playbackActive = 0;
    for (const entry of this.entries.values()) {
      if (entry.kind === 'duration-probe') durationProbeActive += 1;
      else playbackActive += 1;
    }
    return Object.freeze({
      active: this.entries.size,
      created: this.createdCount,
      revoked: this.revokedCount,
      durationProbeActive,
      playbackActive,
    });
  }
}

export interface AudioDurationProbeElement {
  preload: string;
  src: string;
  duration: number;
  addEventListener(type: 'loadedmetadata' | 'error', listener: EventListener, options?: AddEventListenerOptions | boolean): void;
  removeEventListener(type: 'loadedmetadata' | 'error', listener: EventListener): void;
  removeAttribute(name: string): void;
  load(): void;
}

export interface AudioDurationProbeOptions {
  readonly registry?: AudioObjectUrlRegistry;
  readonly timeoutMs?: number;
  readonly createAudio?: () => AudioDurationProbeElement;
  readonly setTimer?: (callback: () => void, timeoutMs: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export const audioObjectUrlRegistry = new AudioObjectUrlRegistry();

/** Reads metadata without retaining the temporary object URL or Audio element. */
export function probeAudioDuration(file: File, options: AudioDurationProbeOptions = {}): Promise<number> {
  const registry = options.registry ?? audioObjectUrlRegistry;
  const createAudio = options.createAudio ?? (() => new Audio());
  const setTimer = options.setTimer ?? ((callback, timeoutMs) => setTimeout(callback, timeoutMs));
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 15000);
  const url = registry.create(file, 'duration-probe', file.name);
  const audio = createAudio();

  return new Promise<number>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (duration: number) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimer(timer);
      audio.removeEventListener('loadedmetadata', onMetadata);
      audio.removeEventListener('error', onError);
      try {
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // Some lightweight test doubles do not implement media reset behavior.
      }
      registry.revoke(url);
      resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
    };

    const onMetadata: EventListener = () => finish(audio.duration);
    const onError: EventListener = () => finish(0);

    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', onMetadata, { once: true });
    audio.addEventListener('error', onError, { once: true });
    timer = setTimer(() => finish(0), timeoutMs);

    try {
      audio.src = url;
      audio.load();
    } catch {
      finish(0);
    }
  });
}
