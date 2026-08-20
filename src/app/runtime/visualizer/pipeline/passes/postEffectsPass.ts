import { renderOwnedPass } from '../PassOwner';
import type { RenderPass } from '../RenderPass';
import type { RenderFrameState } from '../RenderFrameState';

export const postEffectsPass: RenderPass<RenderFrameState> = {
  id: 'postEffects',
  order: 90,
  enabled: (frame) => Boolean(frame.owners.postEffects),
  render: (frame) => renderOwnedPass(frame.owners.postEffects, frame),
};
