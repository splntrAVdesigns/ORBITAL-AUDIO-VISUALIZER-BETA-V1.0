import {
  CenterMediaPassOwner,
  DotPassOwner,
  HaloPassOwner,
  PostEffectsPassOwner,
} from '../pipeline/owners';
import type { RenderFrameState } from '../pipeline/RenderFrameState';

export interface RuntimePassOwners {
  halo: HaloPassOwner;
  dots: DotPassOwner;
  centerMedia: CenterMediaPassOwner;
  postEffects: PostEffectsPassOwner;
  dispose(): void;
}

export function createRuntimePassOwners(frameState: RenderFrameState): RuntimePassOwners {
  const owners: RuntimePassOwners = {
    halo: new HaloPassOwner(),
    dots: new DotPassOwner(),
    centerMedia: new CenterMediaPassOwner(),
    postEffects: new PostEffectsPassOwner(),
    dispose() {
      owners.halo.dispose();
      owners.dots.dispose();
      owners.centerMedia.dispose();
      owners.postEffects.dispose();
    },
  };
  Object.assign(frameState.owners, owners);
  return owners;
}
