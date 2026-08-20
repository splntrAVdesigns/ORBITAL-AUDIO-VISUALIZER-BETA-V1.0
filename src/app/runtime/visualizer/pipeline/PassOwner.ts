import type { RenderFrameState, RuntimeLayerPassId } from './RenderFrameState';

export interface RuntimePassOwner {
  readonly id: RuntimeLayerPassId;
  isEnabled(frame: RenderFrameState): boolean;
  render(frame: RenderFrameState): void;
  reset?(): void;
  dispose?(): void;
}

export function renderOwnedPass(owner: RuntimePassOwner | undefined, frame: RenderFrameState): void {
  if (!owner || !owner.isEnabled(frame)) return;
  const startedAt = performance.now();
  owner.render(frame);
  frame.passCosts[owner.id] = performance.now() - startedAt;
}
