import type { RuntimeParameterStore } from '../parameters/RuntimeParameterStore';
import type { BpmClockFrame } from '../bpm/BpmClockRuntime';

export type RuntimeScalarParameters = Record<string, unknown>;

export type RuntimeAudioSourceSnapshot = { source: 'idle' | 'media' | 'microphone'; playing: boolean };

export interface RuntimeVisualAudioSnapshot {
  now: number;
  sampleRate: number;
  spectrum: Uint8Array;
  energy: number;
  transient: number;
  energy20_160: number;
  energy20_600: number;
  energy40_500: number;
  energy60_150: number;
  energy150_250: number;
  energy500_2000: number;
  energy600_1600: number;
  energy1600_8000: number;
  energy20_8000: number;
  beat: boolean;
  beatPulse: number;
}


type CenterMediaSnapshot = {
  generation: number;
  kind: 'image' | 'video';
  element: HTMLImageElement | HTMLVideoElement;
  transform: {
    fit: 'auto' | 'contain' | 'cover' | 'logo' | 'manual';
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
    opacity: number;
  };
} | null;

class RuntimeRenderAuthority {
  private store: RuntimeParameterStore<RuntimeScalarParameters> | null = null;
  private bpmFrame: BpmClockFrame | null = null;
  private getCenterMedia: (() => CenterMediaSnapshot) | null = null;
  private getAudioSource: (() => RuntimeAudioSourceSnapshot) | null = null;
  private visualAudioFrame: RuntimeVisualAudioSnapshot | null = null;

  attachParameterStore(store: RuntimeParameterStore<RuntimeScalarParameters>): () => void {
    this.store = store;
    return () => { if (this.store === store) this.store = null; };
  }

  attachAudioSourceProvider(provider: () => RuntimeAudioSourceSnapshot): () => void {
    this.getAudioSource = provider;
    return () => { if (this.getAudioSource === provider) this.getAudioSource = null; };
  }

  attachCenterMediaProvider(provider: () => CenterMediaSnapshot): () => void {
    this.getCenterMedia = provider;
    return () => { if (this.getCenterMedia === provider) this.getCenterMedia = null; };
  }

  publishBpmFrame(frame: BpmClockFrame): void { this.bpmFrame = frame; }
  clearBpmFrame(): void { this.bpmFrame = null; }
  publishVisualAudioFrame(frame: RuntimeVisualAudioSnapshot): void { this.visualAudioFrame = frame; }
  clearVisualAudioFrame(): void { this.visualAudioFrame = null; }

  getParameterStore(): RuntimeParameterStore<RuntimeScalarParameters> | null { return this.store; }
  getBpmFrame(): BpmClockFrame | null { return this.bpmFrame; }
  getVisualAudioFrame(): RuntimeVisualAudioSnapshot | null { return this.visualAudioFrame; }
  readCenterMedia(): CenterMediaSnapshot { return this.getCenterMedia?.() ?? null; }
  readAudioSource(): RuntimeAudioSourceSnapshot { return this.getAudioSource?.() ?? { source: 'idle', playing: false }; }

  reset(): void {
    this.store = null;
    this.bpmFrame = null;
    this.visualAudioFrame = null;
    this.getCenterMedia = null;
    this.getAudioSource = null;
  }
}

export const runtimeRenderAuthority = new RuntimeRenderAuthority();
