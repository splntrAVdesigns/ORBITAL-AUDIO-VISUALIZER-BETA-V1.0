export interface RuntimeColorFrame {
  primaryHue: number;
  secondaryHue: number;
  saturation: number;
  luminance: number;
  beatHueShift: number;
}

export function createRuntimeColorFrame(): RuntimeColorFrame {
  return { primaryHue: 0, secondaryHue: 0, saturation: 100, luminance: 50, beatHueShift: 0 };
}
