import { DotRingRuntime, type DotRingRenderOptions } from '../../../renderers/dotRingRenderer';
import type { RendererSystem } from './RendererSystem';

/** Owns dot density transitions, equal spacing, glow/fade state and WebGL buffers. */
export class DotRendererSystem implements RendererSystem<DotRingRenderOptions, void> {
  private frame: DotRingRenderOptions | null = null;
  private readonly runtime: DotRingRuntime;

  constructor(maxDots = 2000) {
    this.runtime = new DotRingRuntime(maxDots);
  }

  update(frame: DotRingRenderOptions): void { this.frame = frame; }
  render(): void { if (this.frame) this.runtime.render(this.frame); }
  reset(): void { this.frame = null; this.runtime.reset(); }
  dispose(): void { this.frame = null; this.runtime.dispose(); }
}
