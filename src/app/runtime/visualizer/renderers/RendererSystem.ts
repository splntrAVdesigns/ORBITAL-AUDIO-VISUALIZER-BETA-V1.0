/** Worker-safe renderer lifecycle. Implementations may use OffscreenCanvas/WebGL,
 * but must not query the DOM, import React, or depend on uncontrolled globals. */
export interface RendererSystem<TFrame, TTarget = void> {
  update(frame: TFrame): void;
  render(target: TTarget): void;
  reset(): void;
  dispose(): void;
}

export interface RendererAdapter<TFrame, TTarget = void> {
  render(frame: TFrame, target: TTarget): void;
  reset?(): void;
  dispose?(): void;
}
