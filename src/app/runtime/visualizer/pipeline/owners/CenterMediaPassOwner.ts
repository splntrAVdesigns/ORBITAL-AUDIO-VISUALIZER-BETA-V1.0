import { CenterMediaRendererSystem, type CenterMediaRenderFrame, type CenterMediaFrameResult } from '../../renderers/CenterMediaRendererSystem';
import type { RuntimePassOwner } from '../PassOwner';

export class CenterMediaPassOwner implements RuntimePassOwner {
  readonly id = 'centerMedia' as const;
  private readonly system = new CenterMediaRendererSystem();
  private onEnergyState: ((state: CenterMediaFrameResult) => void) | null = null;
  private ready = false;

  prepare(options: CenterMediaRenderFrame, onEnergyState?: (state: CenterMediaFrameResult) => void): void {
    this.system.update(options);
    this.onEnergyState = onEnergyState ?? null;
    this.ready = true;
  }

  isEnabled(): boolean { return this.ready; }
  render(): void {
    this.system.render();
    const result = this.system.getLastResult();
    if (result) this.onEnergyState?.(result);
  }
  reset(): void { this.ready = false; this.onEnergyState = null; this.system.reset(); }
  dispose(): void { this.reset(); this.system.dispose(); }
}
