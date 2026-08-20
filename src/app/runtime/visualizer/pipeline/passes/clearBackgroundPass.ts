import type { RenderPass } from '../RenderPass';
import type { RenderFrameState } from '../RenderFrameState';

export const clearBackgroundPass: RenderPass<RenderFrameState> = {
  id: 'clear-background',
  order: 0,
  render(frame) {
    const { ctx, canvas, dpr } = frame;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
};
