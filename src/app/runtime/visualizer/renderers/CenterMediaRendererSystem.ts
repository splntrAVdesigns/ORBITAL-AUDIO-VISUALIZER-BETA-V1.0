import { renderCenterGraphicLayer, type CenterGraphicEnergyState } from '../../../renderers/centerGraphicRenderer';
import type { RendererSystem } from './RendererSystem';

export type CenterMediaRenderFrame = Parameters<typeof renderCenterGraphicLayer>[0];
export type CenterMediaFrameResult = CenterGraphicEnergyState;

/**
 * Worker-oriented center-media boundary. The source/resource bridge is supplied
 * directly in each frame through an explicit resource bridge.
 */
export class CenterMediaRendererSystem implements RendererSystem<CenterMediaRenderFrame, void> {
  private frame: CenterMediaRenderFrame | null = null;
  private result: CenterMediaFrameResult | null = null;

  update(frame: CenterMediaRenderFrame): void { this.frame = frame; }
  render(): void { if (this.frame) this.result = renderCenterGraphicLayer(this.frame); }
  getLastResult(): CenterMediaFrameResult | null { return this.result; }
  reset(): void { this.frame = null; this.result = null; }
  dispose(): void { this.reset(); }
}
