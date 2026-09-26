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

  assert.equal(PRESET_VERSION, '14K.3-beta-feature-presets');
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
  assert.equal(coreParticlePresets.length, 4); // Sprint K3: + Neural Bloom
  for (const preset of coreParticlePresets) {
    assert.equal(preset.settings.shapeDistortion, 0.30, `${preset.name} must recall 30% Core Particle Spread`);
  }
});

test('preset recall routes Rotation Speed Mod through the same preset control authority', () => {
  const actions = read('src/app/utils/presetActions.ts');
  assert.match(actions, /setCheckbox\("#astralRotationSpeedMod", .*astralRotationSpeedMod/);
});

test('Sprint K3 feature presets exist with their hero features and every preset has a unique palette', async context => {
  const { presets, PRESET_COUNT } = await importBundledTypescript('src/app/data/presets.ts', context);
  assert.equal(presets.length, 25);
  assert.equal(PRESET_COUNT, presets.length, 'PRESET_COUNT must match the preset array');
  const byName = Object.fromEntries(presets.map(p => [p.name, p.settings]));
  const expect = {
    Hyperspace: { beatDetect: true, beatPulseType: 'starfield', haloStrobeEnabled: true, haloStrobeDivision: '1/4', palette: 35 },
    'Liquid Metal': { astralShaper: true, astralMorphMode: 'path-interpolate', rotationSyncMode: 'oscillator', palette: 36 },
    'Strobe Temple': { beatDetect: true, beatPulseType: 'dark-strobe', haloStrobeEnabled: true, haloStrobeDivision: '1/8', shockwave: true, palette: 39 },
    'Neural Bloom': { shapeOscillate: true, shapeDistortion: 0.30, coreTexturesEnabled: true, coreTexturesShaderId: 'hologrid-depth-tunnel', palette: 31 },
    Velocity: { motionBlurEnabled: true, haloCometEnabled: true, rotationSyncMode: 'bpm', palette: 33 },
  };
  for (const [name, fields] of Object.entries(expect)) {
    assert.ok(byName[name], `${name} preset must exist`);
    for (const [key, value] of Object.entries(fields)) {
      assert.equal(byName[name][key], value, `${name}.${key}`);
    }
  }
  const palettes = presets.map(p => p.settings.palette);
  assert.equal(new Set(palettes).size, palettes.length, 'every built-in preset must use a distinct palette');
});

test('legacy trail parameter stays removed and zoom stays a viewport-only setting', async context => {
  const { presets } = await importBundledTypescript('src/app/data/presets.ts', context);
  const { defaultParams } = await importBundledTypescript('src/app/config/defaultParams.ts', context);
  assert.equal('trail' in defaultParams, false, 'defaultParams must not reintroduce trail');
  for (const preset of presets) {
    assert.equal('trail' in preset.settings, false, `${preset.name} must not set the removed trail parameter`);
  }
  const macros = fs.readFileSync('src/app/config/macroDefinitions.ts', 'utf8');
  assert.doesNotMatch(macros, /param:\s*'trail'/, 'macros must not target the removed trail parameter');
  const actions = fs.readFileSync('src/app/utils/presetActions.ts', 'utf8');
  const applyBody = actions.slice(actions.indexOf('function applyPreset('), actions.indexOf('function syncMacrosToPreset('));
  assert.doesNotMatch(applyBody, /preset\.zoom\b|['"]#zoom['"]/, 'zoom is a mouse-wheel viewport setting and must not be applied on preset load');
});
