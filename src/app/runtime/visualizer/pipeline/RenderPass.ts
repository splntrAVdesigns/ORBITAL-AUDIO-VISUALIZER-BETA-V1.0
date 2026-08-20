export interface RenderPass<TFrame> {
  readonly id: string;
  readonly order: number;
  enabled?(frame: TFrame): boolean;
  render(frame: TFrame): void;
}
