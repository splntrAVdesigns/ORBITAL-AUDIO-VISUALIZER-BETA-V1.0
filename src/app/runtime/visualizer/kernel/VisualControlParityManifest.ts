/**
 * Behavior-level parity gates for features that regressed during the first
 * Offscreen attempt. This is intentionally narrower than "every key exists":
 * each entry identifies the production behavior that a future host must prove.
 */
export const VISUAL_CONTROL_PARITY_MANIFEST = Object.freeze([
  { id: 'reactivity-hz', parameters: ['reactivityHz'], evidence: ['reactivity cadence changes without changing visual RAF cadence'] },
  { id: 'motion-blur', parameters: ['motionBlurEnabled', 'motionBlurPersistence'], evidence: ['trail activation and persistence alter post-frame output'] },
  { id: 'spike-fft', parameters: ['fftSize'], evidence: ['FFT/window selection changes spike frequency mapping'] },
  { id: 'spike-shape', parameters: ['tail', 'lineWidth', 'mirror'], evidence: ['attack/thickness/mirror alter spike geometry'] },
  { id: 'color-adapt', parameters: ['gamma', 'iridize', 'hueSpeed'], evidence: ['resolved frame color changes from the production color authority'] },
  { id: 'rotation-sync', parameters: ['rotationSyncMode', 'rotationQuantize', 'rotation'], evidence: ['rotation phase/easing remains continuous across frames'] },
  { id: 'dots', parameters: ['dotsOn', 'dotsDensity', 'dotSize', 'dotGlow'], evidence: ['dot count/size/glow alter production dot pass'] },
  { id: 'halo', parameters: ['halo', 'bloom', 'orbitalEnergy'], evidence: ['halo radius/bloom/energy alter production halo pass'] },
  { id: 'halo-comet', parameters: ['haloCometEnabled', 'haloCometSpeed', 'haloCometDirection'], evidence: ['comet lifecycle/orbit follows production runtime'] },
  { id: 'core-particles', parameters: ['shapeOscillate', 'shapeDistortion', 'shapeBurstStrength'], evidence: ['particle geometry/impulse follows production GPU runtime'] },
  { id: 'liquid-shaper', parameters: ['astralShaper', 'astralShape', 'astralMorphAmount', 'astralAutoCycle'], evidence: ['curated cycle and compatibility shape/morph changes reach production Astral path'] },
  { id: 'dark-strobe', parameters: ['beatPulseType', 'darkStrobeDepth', 'darkStrobeDisplacement'], evidence: ['black depth/displacement reaches the top WebGL pass and recording composite'] },
  { id: 'core-textures', parameters: ['coreTexturesEnabled', 'coreTexturesShaderId'], evidence: ['shader selection reaches production CoreTexturesEngine'] },
  { id: 'center-media', parameters: ['centerImageScale', 'centerImageOpacity'], evidence: ['center geometry/opacity affects production center-media pass'] },
] as const);
