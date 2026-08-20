import type { RenderPass } from './RenderPass';

export class RenderPassRegistry<TFrame> {
  private passes: RenderPass<TFrame>[] = [];

  register(pass: RenderPass<TFrame>): () => void {
    this.passes.push(pass);
    this.passes.sort((a, b) => a.order - b.order);
    return () => {
      const index = this.passes.indexOf(pass);
      if (index >= 0) this.passes.splice(index, 1);
    };
  }

  get(id: string): RenderPass<TFrame> | undefined {
    return this.passes.find((pass) => pass.id === id);
  }

  render(frame: TFrame): void {
    for (const pass of this.passes) {
      if (pass.enabled && !pass.enabled(frame)) continue;
      pass.render(frame);
    }
  }

  clear(): void { this.passes.length = 0; }
  get size(): number { return this.passes.length; }
}
