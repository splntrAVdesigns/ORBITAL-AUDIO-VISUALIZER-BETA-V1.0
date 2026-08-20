import { renderOwnedPass } from '../PassOwner';
import type { RenderPass } from '../RenderPass';
import type { RenderFrameState } from '../RenderFrameState';

export const haloPass: RenderPass<RenderFrameState> = {
  id: 'halo',
  order: 20,
  enabled: (frame) => Boolean(frame.owners.halo),
  render: (frame) => renderOwnedPass(frame.owners.halo, frame),
};
