/**
 * Liquid Shaper - Canvas factory shared by the render core and legacy paths.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */

export function createAstralCanvas(width = 1, height = 1): any {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}
