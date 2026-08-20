// ORBITAL Color Palettes - Extracted from App.tsx
// 40 curated color schemes for audio visualization

export interface ColorPalette {
  name: string;
  type: 'mono' | 'grad' | 'heat';
  h?: number;
  a?: number;
  b?: number;
  sat: number;
  lum: number;
  stops?: Array<{ p: number; h: number }>;
}

export const palettes: ColorPalette[] = [
  { name: "Coral → Electric Blue", type: "grad", a: 12, b: 200, sat: 1.0, lum: 0.62 },
  { name: "Pink → Aqua", type: "grad", a: 320, b: 170, sat: 1.0, lum: 0.62 },
  { name: "Sunrise (orange→magenta)", type: "grad", a: 30, b: 320, sat: 1.0, lum: 0.62 },
  { name: "Aurora (teal→violet)", type: "grad", a: 165, b: 275, sat: 1.0, lum: 0.62 },
  { name: "Neon Lime → Cyan", type: "grad", a: 95, b: 190, sat: 1.0, lum: 0.6 },
  { name: "Royal (blue→purple)", type: "grad", a: 215, b: 285, sat: 1.0, lum: 0.6 },
  { name: "Cyber (cyan→pink)", type: "grad", a: 190, b: 320, sat: 1.0, lum: 0.62 },
  { name: "Infra (red→yellow)", type: "grad", a: 355, b: 55, sat: 1.0, lum: 0.62 },
  { name: "Steel (blue→teal)", type: "grad", a: 205, b: 170, sat: 0.95, lum: 0.6 },
  { name: "Sandstorm (amber→rose)", type: "grad", a: 45, b: 345, sat: 1.0, lum: 0.62 },
  { name: "Thermal A (indigo→yellow→white)", type: "heat", sat: 1.0, lum: 0.68, stops: [{ p: 0, h: 250 }, { p: 0.55, h: 55 }, { p: 1, h: 0 }] },
  { name: "Thermal B (blue→green→red)", type: "heat", sat: 1.0, lum: 0.66, stops: [{ p: 0, h: 220 }, { p: 0.5, h: 135 }, { p: 1, h: 0 }] },
  { name: "Heatmap Classic (navy→cyan→yellow)", type: "heat", sat: 1.0, lum: 0.66, stops: [{ p: 0, h: 230 }, { p: 0.6, h: 190 }, { p: 1, h: 55 }] },
  { name: "Plasma (purple→orange→yellow)", type: "heat", sat: 1.0, lum: 0.66, stops: [{ p: 0, h: 285 }, { p: 0.6, h: 25 }, { p: 1, h: 55 }] },
  { name: "Volcano (dark red→orange)", type: "heat", sat: 1.0, lum: 0.62, stops: [{ p: 0, h: 355 }, { p: 0.65, h: 20 }, { p: 1, h: 40 }] },
  { name: "Neon Blue", type: "mono", h: 200, sat: 1.0, lum: 0.66 },
  { name: "Neon Cyan", type: "mono", h: 185, sat: 1.0, lum: 0.66 },
  { name: "Neon Teal", type: "mono", h: 170, sat: 1.0, lum: 0.66 },
  { name: "Neon Lime", type: "mono", h: 100, sat: 1.0, lum: 0.66 },
  { name: "Neon Yellow", type: "mono", h: 58, sat: 1.0, lum: 0.66 },
  { name: "Neon Orange", type: "mono", h: 35, sat: 1.0, lum: 0.66 },
  { name: "Neon Coral", type: "mono", h: 12, sat: 1.0, lum: 0.66 },
  { name: "Neon Magenta", type: "mono", h: 315, sat: 1.0, lum: 0.66 },
  { name: "Neon Purple", type: "mono", h: 275, sat: 1.0, lum: 0.66 },
  { name: "Neon Rose", type: "mono", h: 345, sat: 1.0, lum: 0.66 },
  { name: "Glacier (ice blue→white)", type: "grad", a: 195, b: 0, sat: 0.95, lum: 0.72 },
  { name: "Jungle (lime→deep teal)", type: "grad", a: 100, b: 165, sat: 1.0, lum: 0.64 },
  { name: "Arcade (violet→neon pink)", type: "grad", a: 275, b: 320, sat: 1.0, lum: 0.66 },
  { name: "Cosmo (teal→magenta)", type: "grad", a: 170, b: 315, sat: 1.0, lum: 0.66 },
  { name: "Toxic (chartreuse→aqua)", type: "grad", a: 90, b: 180, sat: 1.0, lum: 0.64 },
  { name: "NightDrive (indigo→electric blue)", type: "grad", a: 250, b: 205, sat: 1.0, lum: 0.64 },
  { name: "Bioluminescence (deep blue→teal→glow green)", type: "heat", sat: 1.0, lum: 0.64, stops: [{ p: 0, h: 210 }, { p: 0.5, h: 185 }, { p: 1, h: 150 }] },
  { name: "Solar Flare (crimson→orange→white-gold)", type: "heat", sat: 1.0, lum: 0.72, stops: [{ p: 0, h: 340 }, { p: 0.55, h: 15 }, { p: 1, h: 58 }] },
  { name: "Vaporwave (hot pink→purple→cyan)", type: "heat", sat: 1.0, lum: 0.64, stops: [{ p: 0, h: 330 }, { p: 0.5, h: 280 }, { p: 1, h: 190 }] },
  { name: "Opal (soft pink→lavender→mint)", type: "heat", sat: 0.55, lum: 0.74, stops: [{ p: 0, h: 340 }, { p: 0.5, h: 270 }, { p: 1, h: 160 }] },
  { name: "Deep Space (violet→magenta→starlight blue)", type: "heat", sat: 0.9, lum: 0.6, stops: [{ p: 0, h: 255 }, { p: 0.5, h: 310 }, { p: 1, h: 215 }] },
  { name: "Molten Gold (bronze→gold→pale white-gold)", type: "heat", sat: 0.85, lum: 0.68, stops: [{ p: 0, h: 25 }, { p: 0.6, h: 48 }, { p: 1, h: 55 }] },
  { name: "Coral Reef (turquoise→coral→golden)", type: "heat", sat: 0.95, lum: 0.64, stops: [{ p: 0, h: 175 }, { p: 0.5, h: 10 }, { p: 1, h: 45 }] },
  { name: "Citrus Burst (lime→yellow→orange)", type: "heat", sat: 1.0, lum: 0.64, stops: [{ p: 0, h: 95 }, { p: 0.5, h: 58 }, { p: 1, h: 30 }] },
  { name: "Blood Moon (deep red→crimson→ember orange)", type: "heat", sat: 0.85, lum: 0.42, stops: [{ p: 0, h: 355 }, { p: 0.5, h: 345 }, { p: 1, h: 15 }] },
];

/**
 * Get hue value from palette based on normalized energy (0-1)
 */
export function hueFromPalette(palette: ColorPalette, energy: number): number {
  if (palette.type === 'mono' && palette.h !== undefined) {
    return palette.h;
  }
  
  if (palette.type === 'grad' && palette.a !== undefined && palette.b !== undefined) {
    const a = palette.a;
    const b = palette.b;
    const d = ((b - a + 540) % 360) - 180;
    return (a + d * energy + 360) % 360;
  }
  
  if (palette.type === 'heat' && palette.stops) {
    const stops = palette.stops;
    for (let i = 0; i < stops.length - 1; i++) {
      const s = stops[i];
      const e = stops[i + 1];
      if (energy >= s.p && energy <= e.p) {
        const t = (energy - s.p) / (e.p - s.p);
        const a = s.h;
        const b = e.h;
        const d = ((b - a + 540) % 360) - 180;
        return (a + d * t + 360) % 360;
      }
    }
    return stops[stops.length - 1].h;
  }
  
  return 200; // Default: electric blue
}

/**
 * Get palette by name
 */
export function getPaletteByName(name: string): ColorPalette | undefined {
  return palettes.find(p => p.name === name);
}

/**
 * Get palette by index (with wrap-around)
 */
export function getPaletteByIndex(index: number): ColorPalette {
  const idx = ((index % palettes.length) + palettes.length) % palettes.length;
  return palettes[idx];
}