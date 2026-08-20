import { useSyncExternalStore } from 'react';

export type ControlPanelAudioTab = 'controls' | 'playlist';

export interface AudioMetadataSnapshot {
  recTime: string;
  track: string;
  duration: string;
  timeLeft: string;
  sr: string;
  fft: string;
  bpm: string;
  band: string;
  detect: string;
  mode: string;
}

const DEFAULT_AUDIO_METADATA: Readonly<AudioMetadataSnapshot> = Object.freeze({
  recTime: '—',
  track: '—',
  duration: '—',
  timeLeft: '—',
  sr: '—',
  fft: '256',
  bpm: '—',
  band: 'FULL',
  detect: 'OFF',
  mode: 'DEFAULT',
});

type Listener = () => void;

const metadataListeners = new Set<Listener>();
const audioTabListeners = new Set<Listener>();
let metadataSnapshot = DEFAULT_AUDIO_METADATA;
let audioTabSnapshot: ControlPanelAudioTab = 'controls';

function subscribe(listeners: Set<Listener>, listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const subscribeMetadata = (listener: Listener) => subscribe(metadataListeners, listener);
const subscribeAudioTab = (listener: Listener) => subscribe(audioTabListeners, listener);

export function publishAudioMetadata(next: AudioMetadataSnapshot): void {
  const keys = Object.keys(DEFAULT_AUDIO_METADATA) as Array<keyof AudioMetadataSnapshot>;
  if (keys.every(key => metadataSnapshot[key] === next[key])) return;
  metadataSnapshot = Object.freeze({ ...next });
  metadataListeners.forEach(listener => listener());
}

export function getAudioMetadataSnapshot(): Readonly<AudioMetadataSnapshot> {
  return metadataSnapshot;
}

export function useAudioMetadataSnapshot(): Readonly<AudioMetadataSnapshot> {
  return useSyncExternalStore(
    subscribeMetadata,
    getAudioMetadataSnapshot,
    () => DEFAULT_AUDIO_METADATA,
  );
}

export function setControlPanelAudioTab(next: ControlPanelAudioTab): void {
  if (audioTabSnapshot === next) return;
  audioTabSnapshot = next;
  audioTabListeners.forEach(listener => listener());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('orbital:panel-tab-change', { detail: { tab: next } }));
  }
}

export function getControlPanelAudioTab(): ControlPanelAudioTab {
  return audioTabSnapshot;
}

export function useControlPanelAudioTab(): ControlPanelAudioTab {
  return useSyncExternalStore(
    subscribeAudioTab,
    getControlPanelAudioTab,
    () => 'controls',
  );
}
