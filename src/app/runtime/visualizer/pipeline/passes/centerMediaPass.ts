import { renderOwnedPass } from '../PassOwner';
import type { RenderPass } from '../RenderPass';
import type { RenderFrameState } from '../RenderFrameState';

export const centerMediaPass: RenderPass<RenderFrameState> = {
  id: 'centerMedia',
  order: 60,
  enabled: (frame) => Boolean(frame.owners.centerMedia),
  render: (frame) => renderOwnedPass(frame.owners.centerMedia, frame),
};
