import { HaloRendererSystem, type HaloRenderFrame } from '../../renderers/HaloRendererSystem';
import type { RuntimePassOwner } from '../PassOwner';

export class HaloPassOwner implements RuntimePassOwner {
  readonly id = 'halo' as const;
  private readonly system = new HaloRendererSystem();
  private ready = false;
  get timings() { return this.system.timings; }
  prepare(options: HaloRenderFrame): void { this.system.update(options); this.ready = true; }
  isEnabled(): boolean { return this.ready; }
  render(): void { this.system.render(); }
  reset(): void { this.ready = false; this.system.reset(); }
  dispose(): void { this.ready = false; this.system.dispose(); }
}
