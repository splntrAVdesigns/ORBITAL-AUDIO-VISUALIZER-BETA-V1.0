import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';
import type { RenderFrameState } from './RenderFrameState';
import { createRuntimeColorFrame } from './RuntimeColorFrame';

export function createRenderFrameState(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): RenderFrameState {
  return {
    timing: { now: 0, deltaMs: 0, deltaSeconds: 0, frameIndex: 0, resumed: false },
    canvas,
    ctx,
    dpr: 1,
    cssWidth: 0,
    cssHeight: 0,
    centerX: 0,
    centerY: 0,
    minSide: 0,
    color: createRuntimeColorFrame(),
    owners: {},
    passCosts: {},
  };
}

export function prepareRenderFrame(
  frame: RenderFrameState,
  timing: RuntimeFrameTiming,
  dpr: number,
  cssWidth: number,
  cssHeight: number,
): RenderFrameState {
  frame.timing = timing;
  frame.dpr = dpr;
  frame.cssWidth = cssWidth;
  frame.cssHeight = cssHeight;
  frame.centerX = cssWidth * 0.5;
  frame.centerY = cssHeight * 0.5;
  frame.minSide = Math.min(cssWidth, cssHeight);
  return frame;
}
