import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

const read = path => fs.readFileSync(path, 'utf8');

test('Dark Strobe doubles depth gain and increases tear travel by 50 percent', () => {
  const renderer = read('src/app/runtime/visualizer/renderers/DarkStrobeRenderer.ts');
  assert.match(renderer, /depthGain = clamp\(u_depth, 0\.0, 1\.0\) \* 2\.0/);
  assert.match(renderer, /displacementGain = clamp\(u_displacement, 0\.0, 1\.0\) \* 1\.5/);
  assert.match(renderer, /tearOffset = \(randomA - 0\.5\) \* displacementGain \* pulse \* 0\.42/);
  assert.match(renderer, /alpha = clamp\(pulse \* depthGain, 0\.0, 1\.0\)/);
  assert.doesNotMatch(renderer, /requestAnimationFrame|setInterval|setTimeout|readPixels|getImageData/);
});

test('Performance HUD frame summary is split into exactly two rows', () => {
  const hud = read('src/app/components/PerformanceHUDOverlay.tsx');
  const start = hud.indexOf('id="renderCostDebug"');
  const end = hud.indexOf('</div>\n          <StatRow label="AUDIO:"', start);
  const summary = hud.slice(start, end);
  assert.match(summary, /display: 'grid'/);
  assert.equal((summary.match(/<FrameSummaryRow/g) ?? []).length, 2);
  assert.match(summary, /leftLabel="FRAME"[\s\S]*rightLabel="AUDIO"/);
  assert.match(summary, /leftLabel="CANVAS"[\s\S]*rightLabel="WEBGL"/);
  assert.doesNotMatch(summary, /whiteSpace:\s*'nowrap'/);
  assert.match(hud, /width: '236px'/);
  assert.match(hud, /maxWidth: 'calc\(100vw - 20px\)'/);
  assert.doesNotMatch(hud, /backdropFilter/);
});

test('requested built-in preset tuning is exact and all Core Particle presets use 30 percent spread', async context => {
  const { presets, PRESET_VERSION } = await importBundledTypescript('src/app/data/presets.ts', context);
  const settings = name => presets.find(preset => preset.name === name)?.settings;

  assert.equal(PRESET_VERSION, '14K.2-beta-preset-refresh');
  assert.deepEqual(
    { fftSize: settings('Minimalscape').fftSize, mirror: settings('Minimalscape').mirror, chaos: settings('Minimalscape').chaos },
    { fftSize: 9, mirror: 0.23, chaos: 0 },
  );
  assert.deepEqual(
    {
      dotsPulse: settings('Retro Synthwave').dotsPulse,
      dotsDensity: settings('Retro Synthwave').dotsDensity,
      dotSize: settings('Retro Synthwave').dotSize,
      beatDetect: settings('Retro Synthwave').beatDetect,
      beatPulseType: settings('Retro Synthwave').beatPulseType,
      darkStrobeDepth: settings('Retro Synthwave').darkStrobeDepth,
      darkStrobeDisplacement: settings('Retro Synthwave').darkStrobeDisplacement,
    },
    {
      dotsPulse: false,
      dotsDensity: 0.10,
      dotSize: 1.10,
      beatDetect: true,
      beatPulseType: 'dark-strobe',
      darkStrobeDepth: 0.50,
      darkStrobeDisplacement: 0.45,
    },
  );
  assert.deepEqual(
    {
      dotsPulse: settings('Blang it Out').dotsPulse,
      dotsDensity: settings('Blang it Out').dotsDensity,
      dotSize: settings('Blang it Out').dotSize,
    },
    { dotsPulse: false, dotsDensity: 0.45, dotSize: 1.00 },
  );
  assert.deepEqual(
    {
      rotation: settings('Sacred Mandala').rotation,
      astralRotationSpeedMod: settings('Sacred Mandala').astralRotationSpeedMod,
      astralRotationMult: settings('Sacred Mandala').astralRotationMult,
      astralKaleidoscope: settings('Sacred Mandala').astralKaleidoscope,
      astralAudioInfluence: settings('Sacred Mandala').astralAudioInfluence,
      astralMorphAmount: settings('Sacred Mandala').astralMorphAmount,
      spikeTightness: settings('Sacred Mandala').spikeTightness,
      chaos: settings('Sacred Mandala').chaos,
    },
    {
      rotation: 0.35,
      astralRotationSpeedMod: true,
      astralRotationMult: 3.50,
      astralKaleidoscope: true,
      astralAudioInfluence: 0.75,
      astralMorphAmount: 0.45,
      spikeTightness: 0.89,
      chaos: 0,
    },
  );
  assert.deepEqual(
    {
      astralKaleidoscope: settings('Cosmic Geometry').astralKaleidoscope,
      astralFieldModulation: settings('Cosmic Geometry').astralFieldModulation,
      astralMorphAmount: settings('Cosmic Geometry').astralMorphAmount,
    },
    { astralKaleidoscope: true, astralFieldModulation: 0.45, astralMorphAmount: 0.25 },
  );
  assert.equal(settings('Particle Storm').chaos, 0);
  assert.equal(settings('Ethereal Bloom').dotsPulse, false);
  assert.equal(settings('Ethereal Bloom').chaos, 0);

  const coreParticlePresets = presets.filter(preset => preset.settings.shapeOscillate === true);
  assert.equal(coreParticlePresets.length, 3);
  for (const preset of coreParticlePresets) {
    assert.equal(preset.settings.shapeDistortion, 0.30, `${preset.name} must recall 30% Core Particle Spread`);
  }
});

test('preset recall routes Rotation Speed Mod through the same preset control authority', () => {
  const actions = read('src/app/utils/presetActions.ts');
  assert.match(actions, /setCheckbox\("#astralRotationSpeedMod", .*astralRotationSpeedMod/);
});
