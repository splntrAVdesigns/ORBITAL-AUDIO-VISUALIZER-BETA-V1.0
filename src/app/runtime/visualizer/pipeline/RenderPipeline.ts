import { RenderPassRegistry } from './RenderPassRegistry';
import type { RenderPass } from './RenderPass';

/** Stage 1 pipeline shell. Main visual passes migrate here incrementally in Sprint 22N.C Stage 2. */
export class RenderPipeline<TFrame> {
  readonly passes = new RenderPassRegistry<TFrame>();

  register(pass: RenderPass<TFrame>): () => void { return this.passes.register(pass); }
  render(frame: TFrame): void { this.passes.render(frame); }

  renderPass(id: string, frame: TFrame): void {
    const pass = this.passes.get(id);
    if (!pass || (pass.enabled && !pass.enabled(frame))) return;
    pass.render(frame);
  }
  dispose(): void { this.passes.clear(); }
}
