import type { RuntimeFrameTiming } from '../VisualizerRuntimeTypes';
import type { RuntimeColorFrame } from './RuntimeColorFrame';
import type { RuntimePassOwner } from './PassOwner';

export type RuntimeLayerPassId = 'halo' | 'dots' | 'centerMedia' | 'postEffects';

export interface RenderFrameState {
  timing: RuntimeFrameTiming;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  cssWidth: number;
  cssHeight: number;
  centerX: number;
  centerY: number;
  minSide: number;
  color: RuntimeColorFrame;
  owners: Partial<Record<RuntimeLayerPassId, RuntimePassOwner>>;
  passCosts: Partial<Record<RuntimeLayerPassId, number>>;
}
