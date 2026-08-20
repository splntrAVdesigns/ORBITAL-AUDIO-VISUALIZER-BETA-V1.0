import { renderOwnedPass } from '../PassOwner';
import type { RenderPass } from '../RenderPass';
import type { RenderFrameState } from '../RenderFrameState';

export const dotPass: RenderPass<RenderFrameState> = {
  id: 'dots',
  order: 40,
  enabled: (frame) => Boolean(frame.owners.dots),
  render: (frame) => renderOwnedPass(frame.owners.dots, frame),
};
