/** Owns Liquid Shaper reusable frame options and deferred control mutations. */
export class LiquidShaperFeatureRuntime {
  readonly audioOptions: Record<string, any> = {};
  readonly paramsOptions: Record<string, any> = {};
  constructor(private readonly pendingChangesRef: { current: Record<string, any> }) {}
  queueControlChange(name: string, value: any): void { this.pendingChangesRef.current[name] = value; }
  resetPendingChanges(): void { this.pendingChangesRef.current = {}; }
  prepareAudio(input: Record<string, any>): Record<string, any> { Object.assign(this.audioOptions, input); return this.audioOptions; }
  prepareParams(input: Record<string, any>): Record<string, any> { Object.assign(this.paramsOptions, input); return this.paramsOptions; }
}
export function createLiquidShaperFeatureRuntime(pendingChangesRef: { current: Record<string, any> }): LiquidShaperFeatureRuntime {
  return new LiquidShaperFeatureRuntime(pendingChangesRef);
}
