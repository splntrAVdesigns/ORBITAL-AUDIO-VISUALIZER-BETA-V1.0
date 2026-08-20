import { renderHaloComet, renderOuterHalo } from '../../../renderers/canvasLayerRenderer';
import { HaloCometOrbitRuntime } from './HaloCometOrbitRuntime';
import type { RendererSystem } from './RendererSystem';

export type HaloRenderFrame = Parameters<typeof renderOuterHalo>[0] & {
  cometRadius: number;
  maxCometRadius: number;
  sceneRotation: number;
  motionDeltaSeconds: number;
  measureTimings?: boolean;
};

export interface HaloRenderTimings {
  haloMs: number;
  cometMs: number;
  orbitalMs: number;
}

/** Owns halo geometry/color/pulse render input without DOM access. */
export class HaloRendererSystem implements RendererSystem<HaloRenderFrame, void> {
  private frame: HaloRenderFrame | null = null;
  private readonly cometOrbit = new HaloCometOrbitRuntime();
  private cometPhase = -Math.PI * 0.5;
  private readonly renderTimings: HaloRenderTimings = {
    haloMs: 0,
    cometMs: 0,
    orbitalMs: 0,
  };

  get timings(): Readonly<HaloRenderTimings> {
    return this.renderTimings;
  }

  update(frame: HaloRenderFrame): void {
    this.frame = frame;
    this.cometPhase = this.cometOrbit.update(
      Boolean(frame.params.haloCometEnabled),
      Number(frame.params.haloCometSpeed),
      Number(frame.params.haloCometDirection),
      frame.motionDeltaSeconds,
    );
  }

  render(): void {
    if (!this.frame) return;
    this.renderTimings.haloMs = 0;
    this.renderTimings.cometMs = 0;
    this.renderTimings.orbitalMs = 0;
    const measureTimings = Boolean(this.frame.measureTimings);
    this.frame.timings = measureTimings ? this.renderTimings : undefined;
    renderOuterHalo(this.frame);
    const cometStartedAt = measureTimings ? performance.now() : 0;
    renderHaloComet({
      ctx: this.frame.ctx,
      params: this.frame.params,
      radius: this.frame.cometRadius,
      maxRadius: this.frame.maxCometRadius,
      phase: this.cometPhase,
      sceneRotation: this.frame.sceneRotation,
      effectiveHue: this.frame.effectiveHue,
      saturation: this.frame.saturation,
      luminosity: this.frame.luminosity,
    });
    if (measureTimings) this.renderTimings.cometMs = performance.now() - cometStartedAt;
  }

  reset(): void {
    this.frame = null;
    this.cometPhase = -Math.PI * 0.5;
    this.renderTimings.haloMs = 0;
    this.renderTimings.cometMs = 0;
    this.renderTimings.orbitalMs = 0;
    this.cometOrbit.reset();
  }

  dispose(): void { this.reset(); }
}
