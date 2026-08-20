/**
 * ORBITAL — Macro Knob Definitions
 * Maps each macro knob (ENERGY, MOTION, CHAOS, ATMOSPHERE + 4 advanced)
 * to the visualizer params it controls, with min/max range per param.
 *
 * Extracted from App.tsx (Phase 1 refactor).
 * Import as: import { macroMappings, type MacroMapping } from './config/macroDefinitions'
 */

import type { RuntimeParameterKey } from '../runtime/parameters/RuntimeParameterTransactions';

export type MacroMapping = {
  param: RuntimeParameterKey;
  min: number;
  max: number;
};

export const macroMappings: { [key: string]: MacroMapping[] } = {
  macro1: [ // ENERGY - global reactive power + subtle hue motion
    { param: 'halo',           min: 1.00, max: 1.35 },
    { param: 'bloom',          min: 0.50, max: 0.85 },
    { param: 'glowStrength',   min: 0.50, max: 0.95 },
    { param: 'beatAccent',     min: 1.00, max: 1.55 },
    { param: 'transientBoost', min: 0.00, max: 0.42 },
    { param: 'gamma',          min: 0.00, max: 0.22 },
    { param: 'centerImageHueShift', min: 0.00, max: 20.0 },
  ],
  macro2: [ // MOTION - global movement only; avoids live center-motion hijacking while dragging
    { param: 'rotation',        min: 0.00, max: 0.72 },
    { param: 'trail',           min: 0.50, max: 0.82 },
    { param: 'autoRotateSpeed', min: 1.00, max: 1.55 },
    { param: 'motionBlur',      min: 0.00, max: 0.18 },
  ],
  macro3: [ // CHAOS - focused instability; avoids broad motion blur/zoom-ring toggling
    { param: 'chaos',               min: 0.00, max: 0.52 },
    { param: 'iridize',             min: 0.00, max: 0.58 },
    { param: 'centerImageDisplacement', min: 0.00, max: 18.0 },
    { param: 'centerImageJitter',   min: 0.00, max: 0.22 },
    { param: 'centerImageRGBOffset', min: 0.00, max: 0.16 },
    { param: 'hueSpeed',            min: 1.00, max: 2.05 },
  ],
  macro4: [ // ATMOSPHERE - depth/mood; center layer stays visible
    { param: 'halo',                  min: 1.00, max: 1.20 },
    { param: 'bloom',                 min: 0.50, max: 0.76 },
    { param: 'orbitalEnergy',         min: 0.00, max: 0.72 },
    { param: 'centerImageOpacity',    min: 1.00, max: 1.00 },
    { param: 'centerImageSaturation', min: 1.00, max: 1.22 },
    { param: 'gammaBlast',            min: 0.00, max: 0.22 },
  ],
  macro5: [ // SPIKES - spike ring focus + capped FFT detail boost
    { param: 'innerRadius',     min: 0.28, max: 0.18 },
    { param: 'spikeTightness',  min: 0.60, max: 0.88 },
    { param: 'spikeBloom',      min: 0.00, max: 0.46 },
    { param: 'transientBoost',  min: 0.00, max: 0.48 },
    { param: 'tail',            min: 0.30, max: 0.20 },
    { param: 'gamma',           min: 0.00, max: 0.30 },
    { param: 'fftSize',         min: 9.00, max: 11.00 },
  ],
  macro6: [ // DOTS - smooth visual emphasis only; avoids live density segmentation glitches
    { param: 'dotSize',        min: 2.00, max: 4.20 },
    { param: 'dotGlow',        min: 1.00, max: 2.10 },
    { param: 'trail',          min: 0.50, max: 0.74 },
  ],
  macro7: [ // TEXTURE - core/liquid texture depth with guarded auto-enable
    { param: 'coreTexturesOpacity',        min: 0.18, max: 0.72 },
    { param: 'coreTexturesAudioIntensity', min: 0.00, max: 0.55 },
    { param: 'coreTexturesSpeed',          min: 0.32, max: 1.25 },
    { param: 'coreTexturesDensity',        min: 0.20, max: 0.62 },
    { param: 'coreTexturesGlowIntensity',  min: 0.10, max: 0.58 },
  ],
  macro8: [ // CENTER FX - visual treatment only; does not alter center motion speed/intensity live
    { param: 'centerImageDisplacement', min: 0.00, max: 22.0 },
    { param: 'centerImageSaturation',   min: 1.00, max: 1.28 },
    { param: 'centerImageHueShift',     min: 0.00, max: 20.0 },
    { param: 'centerImageRGBOffset',    min: 0.00, max: 0.12 },
    { param: 'centerImageOpacity',      min: 1.00, max: 1.00 },
    { param: 'glowStrength',            min: 0.50, max: 0.88 },
    { param: 'gammaBlast',              min: 0.00, max: 0.20 },
  ],
};
