import type { RendererSystem } from './RendererSystem';

export interface PostEffectsTarget {
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  engine: { postRenderCapture(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, config: unknown): void };
}
export interface PostEffectsFrame {
  config: unknown;
  gamma: number;
  iridize: number;
  motionBlur: number;
  rainbowOverlay: number;
  shockwave: number;
}

/** Owns post-effect frame state and shared color-effect values. */
export class PostEffectsRendererSystem implements RendererSystem<PostEffectsFrame, PostEffectsTarget> {
  private frame: PostEffectsFrame | null = null;
  update(frame: PostEffectsFrame): void { this.frame = frame; }
  render(target: PostEffectsTarget): void {
    if (!this.frame) return;
    target.engine.postRenderCapture(target.context, this.frame.config);
  }
  reset(): void { this.frame = null; }
  dispose(): void { this.frame = null; }
}
