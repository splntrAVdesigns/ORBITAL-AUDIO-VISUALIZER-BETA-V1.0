export type CenterFitMode = 'auto' | 'contain' | 'cover' | 'logo' | 'manual';
export type CenterMediaKind = 'logo' | 'photo' | 'video' | 'unknown';

export type VisibleBounds = { x: number; y: number; width: number; height: number };
export type MediaFitState = {
  fitMode: CenterFitMode;
  baseScale: number;
  userScaleOffset: number;
  aspectRatio: number;
  visibleBounds?: VisibleBounds;
  mediaKind?: CenterMediaKind;
  preferredAutoScale?: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Computes scale relative to the center renderer's normalized 1.0 mask box.
 * Unlike the previous aspect-ratio constants, this is real contain/cover geometry.
 */
export function computeCenterMediaBaseScale(
  width: number,
  height: number,
  mode: CenterFitMode = 'auto',
  visibleBounds?: VisibleBounds,
  mediaKind: CenterMediaKind = 'unknown',
  preferredAutoScale?: number,
) {
  const sourceW = Math.max(1, visibleBounds?.width ?? width);
  const sourceH = Math.max(1, visibleBounds?.height ?? height);
  const ar = sourceW / sourceH;

  const contain = Math.min(1 / ar, 1);
  const cover = Math.max(1 / ar, 1);
  const containScale = contain * 0.92; // circular-mask safety padding
  const coverScale = cover * 1.08;     // ensure corners cover mask bounds

  let scale: number;
  if (mode === 'contain') scale = containScale;
  else if (mode === 'cover') scale = coverScale;
  else if (mode === 'logo') scale = containScale * 0.72;
  else if (mode === 'manual') scale = 1;
  else if (Number.isFinite(preferredAutoScale)) scale = preferredAutoScale as number;
  else if (mediaKind === 'logo') scale = containScale * 0.72;
  else if (mediaKind === 'video' || mediaKind === 'photo') scale = coverScale;
  else scale = ar > 1.7 ? containScale * 0.72 : containScale * 0.9;
  return clamp(scale, 0.075, 1.6);
}

export function resolveCenterMediaScale(state: MediaFitState) {
  return clamp(state.baseScale * state.userScaleOffset, 0.08, 1.8);
}

export async function measureVisibleAlphaBounds(
  image: HTMLImageElement,
  maxSampleSize = 256,
): Promise<VisibleBounds | undefined> {
  try {
    const w = image.naturalWidth || image.width;
    const h = image.naturalHeight || image.height;
    if (!w || !h) return undefined;
    const scale = Math.min(1, maxSampleSize / Math.max(w, h));
    const sw = Math.max(1, Math.round(w * scale));
    const sh = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = sw; canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(image, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;
    let minX = sw, minY = sh, maxX = -1, maxY = -1;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > 12) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX || maxY < minY) return undefined;
    return { x: minX / scale, y: minY / scale, width: (maxX - minX + 1) / scale, height: (maxY - minY + 1) / scale };
  } catch { return undefined; }
}
