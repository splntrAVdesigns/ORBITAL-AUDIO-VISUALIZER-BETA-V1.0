/**
 * Liquid Shaper - Color helpers.
 * Split out of utils/astralShaper.ts (Sprint C); code moved verbatim.
 */

/**
 * Convert HSL color string to hex format for WebGL shader
 * HSL input format: "hsl(240, 100%, 62%)" or "hsla(...)"
 * Returns: "#RRGGBB"
 */
export function hslToHex(hslString: string): string {
  // Extract H, S, L values from string
  const match = hslString.match(/hsla?\((\d+\.?\d*),\s*(\d+\.?\d*)%,\s*(\d+\.?\d*)%/);
  if (!match) return hslString; // Return original if not HSL format
  
  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  
  // HSL to RGB conversion
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  // Convert to hex
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
