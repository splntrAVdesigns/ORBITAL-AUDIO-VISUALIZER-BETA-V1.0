import type { DotRingRenderOptions } from '../../../../renderers/dotRingRenderer';
import { DotRendererSystem } from '../../renderers/DotRendererSystem';
import type { RuntimePassOwner } from '../PassOwner';

export class DotPassOwner implements RuntimePassOwner {
  readonly id = 'dots' as const;
  private readonly system = new DotRendererSystem(2000);
  private ready = false;

  prepare(options: DotRingRenderOptions): void {
    this.system.update(options);
    this.ready = true;
  }

  isEnabled(): boolean { return this.ready; }
  render(): void { this.system.render(); }
  reset(): void { this.ready = false; this.system.reset(); }
  dispose(): void { this.ready = false; this.system.dispose(); }
}
