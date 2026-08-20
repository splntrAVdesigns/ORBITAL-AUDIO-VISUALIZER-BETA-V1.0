import { PostEffectsRendererSystem, type PostEffectsFrame, type PostEffectsTarget } from '../../renderers/PostEffectsRendererSystem';
import type { RuntimePassOwner } from '../PassOwner';

export class PostEffectsPassOwner implements RuntimePassOwner {
  readonly id = 'postEffects' as const;
  private readonly system = new PostEffectsRendererSystem();
  private target: PostEffectsTarget | null = null;
  private ready = false;

  prepare(context: CanvasRenderingContext2D, engine: PostEffectsTarget['engine'], config: unknown, frame?: Partial<PostEffectsFrame>): void {
    this.target = { context, engine };
    this.system.update({
      config,
      gamma: frame?.gamma ?? 0,
      iridize: frame?.iridize ?? 0,
      motionBlur: frame?.motionBlur ?? 0,
      rainbowOverlay: frame?.rainbowOverlay ?? 0,
      shockwave: frame?.shockwave ?? 0,
    });
    this.ready = true;
  }
  disable(): void { this.target = null; this.ready = false; this.system.reset(); }
  isEnabled(): boolean { return this.ready && Boolean(this.target); }
  render(): void { if (this.target) this.system.render(this.target); }
  reset(): void { this.disable(); }
  dispose(): void { this.disable(); this.system.dispose(); }
}
