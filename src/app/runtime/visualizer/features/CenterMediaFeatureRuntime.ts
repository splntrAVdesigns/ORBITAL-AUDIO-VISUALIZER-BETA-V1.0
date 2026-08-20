/** Owns reusable Center Media / Center Glow frame options and render state. */
export class CenterMediaFeatureRuntime {
  readonly energyState: Record<string, any> = {};
  readonly centerOptions: Record<string, any> = { energyState: this.energyState };
  readonly glowOptions: Record<string, any> = {};

  constructor(readonly renderState: any) {}

  prepareCenter(input: Record<string, any>): Record<string, any> {
    Object.assign(this.centerOptions, input);
    // Keep one stable energy-state object for the lifetime of the feature runtime.
    // Never allow a partial/undefined frame payload to replace it.
    this.centerOptions.energyState = this.energyState;
    return this.centerOptions;
  }

  prepareGlow(input: Record<string, any>): Record<string, any> {
    Object.assign(this.glowOptions, input);
    return this.glowOptions;
  }
}

export function createCenterMediaFeatureRuntime(renderState: any): CenterMediaFeatureRuntime {
  return new CenterMediaFeatureRuntime(renderState);
}