import { createRuntimeParameterStore, type RuntimeParameterStore } from '../../parameters/RuntimeParameterStore';
import { runtimeRenderAuthority } from '../RuntimeRenderAuthority';
import type { RuntimeSessionDisposer } from './RuntimeSessionDisposer';

export function attachRuntimeParameterAuthority(
  params: Record<string, unknown>,
  sessionDisposer: RuntimeSessionDisposer,
): RuntimeParameterStore<Record<string, unknown>> {
  const parameterStore = createRuntimeParameterStore<Record<string, unknown>>(params);
  sessionDisposer.add(runtimeRenderAuthority.attachParameterStore(parameterStore));
  sessionDisposer.add(() => parameterStore.dispose());

  // Transitional main-thread compatibility only. Worker publication reads the
  // RuntimeParameterStore attached above and never reaches through window.params.
  const runtimeWindow = window as typeof window & { params?: Record<string, unknown> };
  runtimeWindow.params = params;
  sessionDisposer.add(() => {
    if (runtimeWindow.params === params) delete runtimeWindow.params;
  });
  return parameterStore;
}


export function attachAudioSourceAuthority(
  state: { usingMic?: boolean; mediaElement?: HTMLMediaElement | null },
  sessionDisposer: RuntimeSessionDisposer,
): void {
  sessionDisposer.add(runtimeRenderAuthority.attachAudioSourceProvider(() => {
    if (state.usingMic) return { source: 'microphone', playing: true };
    const media = state.mediaElement;
    if (media) return { source: 'media', playing: !media.paused && !media.ended };
    return { source: 'idle', playing: false };
  }));
}

interface CenterMediaControllerLike {
  hidden: boolean;
  activeImage?: {
    loaded?: boolean;
    type: 'image' | 'video';
    element: HTMLImageElement | HTMLVideoElement;
    savedZoom?: number;
    fitState?: { fitMode?: 'auto' | 'contain' | 'cover' | 'logo' };
  } | null;
  autoRotationAngle?: number;
}

export function attachCenterMediaAuthority(
  controller: CenterMediaControllerLike,
  params: Record<string, unknown>,
  sessionDisposer: RuntimeSessionDisposer,
): void {
  let generation = 0;
  let lastElement: HTMLImageElement | HTMLVideoElement | null = null;
  sessionDisposer.add(runtimeRenderAuthority.attachCenterMediaProvider(() => {
    const active = controller.activeImage;
    if (!active?.loaded || controller.hidden) return null;
    if (active.element !== lastElement) {
      lastElement = active.element;
      generation += 1;
    }
    return {
      generation,
      kind: active.type,
      element: active.element,
      transform: {
        fit: active.fitState?.fitMode ?? 'auto',
        scale: Number(params.centerImageScale ?? active.savedZoom ?? 1),
        offsetX: Number(params.centerImageOffsetX ?? 0),
        offsetY: Number(params.centerImageOffsetY ?? 0),
        rotation: Number(controller.autoRotationAngle ?? 0),
        opacity: Number(params.centerImageOpacity ?? 1),
      },
    };
  }));
}
