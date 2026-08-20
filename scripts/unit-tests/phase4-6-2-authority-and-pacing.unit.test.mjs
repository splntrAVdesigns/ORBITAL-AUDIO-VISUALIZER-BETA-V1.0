import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

const read = relative => fs.readFileSync(relative, 'utf8');

test('Spike FFT has one exponent conversion and publishes visible frequency bins', async context => {
  const conversions = await importBundledTypescript(
    'src/app/config/parameterConversions.ts',
    context,
  );
  assert.equal(conversions.normalizeSpikeFftExponent(8), 9);
  assert.equal(conversions.normalizeSpikeFftExponent(14), 13);
  assert.equal(conversions.spikeFftExponentToWindowSize(9), 512);
  assert.equal(conversions.spikeFftExponentToVisibleCount(9), 256);
  assert.equal(conversions.spikeFftExponentToVisibleCount(13), 4096);

  const app = read('src/app/App.tsx');
  const settings = read('src/app/components/SpikeRingSettings.tsx');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const controls = read('src/app/runtime/visualizer/controls/registerVisualizerControlPlane.ts');
  const audio = read('src/app/engine/AudioSystemInit.ts');
  const metadataStore = read('src/app/runtime/controlPanelRuntimeStore.ts');

  assert.match(app, /useState\(256\).*visible frequency bins/);
  assert.match(settings, /spikeFftExponentToVisibleCount/);
  assert.match(session, /registerVisualizerControlPlane/);
  assert.match(controls, /trackMetadata\.fft = String\(analyser\.frequencyBinCount\)/);
  assert.match(controls, /orbital:spike-fft-change/);
  assert.match(controls, /params\.fftSize = target/);
  assert.match(audio, /trackMetadata\.fft\s*=\s*String\(analyser\.frequencyBinCount\)/);
  assert.match(metadataStore, /fft:\s*'256'/);

  for (const source of [session, controls, audio, metadataStore]) {
    assert.doesNotMatch(source, /\(spikes\)/);
  }
});

test('Preset MODE uses a live store for built-in, custom, random, and default changes', async context => {
  const store = await importBundledTypescript(
    'src/app/runtime/presetNameRuntimeStore.ts',
    context,
  );
  const observed = [];
  const unsubscribe = store.subscribeActivePresetName(name => observed.push(name));
  store.setActivePresetName('Fractal Dreams');
  store.setActivePresetName('RANDOM');
  store.setActivePresetName('');
  unsubscribe();
  assert.deepEqual(observed, ['Fractal Dreams', 'RANDOM', 'DEFAULT']);
  assert.equal(store.getActivePresetName(), 'DEFAULT');

  const controller = read('src/app/controllers/audioUIController.ts');
  const actions = read('src/app/utils/presetActions.ts');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  assert.match(controller, /subscribeActivePresetName/);
  assert.match(controller, /getActivePresetName\(\)/);
  assert.doesNotMatch(session, /getCurrentPresetName:\s*\(\)\s*=>\s*currentPresetName/);
  assert.match(actions, /setActivePresetName\(presetName\)/);
  assert.match(actions, /setActivePresetName\('RANDOM'\)/);
  assert.match(actions, /setActivePresetName\('DEFAULT'\)/);
});

test('Halo Comet toggle is sole authority and opacity survives Halo zero', () => {
  const canvas = read('src/app/renderers/canvasLayerRenderer.ts');
  const comet = canvas.slice(
    canvas.indexOf('export function renderHaloComet'),
    canvas.indexOf('export function renderShockwaves'),
  );
  assert.match(comet, /if \(!params\.haloCometEnabled\) return/);
  assert.doesNotMatch(comet, /params\.halo\s*<=/);
  assert.match(comet, /haloGeometryStrength/);
  assert.doesNotMatch(comet, /globalAlpha\s*=\s*[^;\n]*haloGeometryStrength/);
  assert.match(comet, /ctx\.globalAlpha = 0\.075/);
  assert.match(comet, /ctx\.globalAlpha = 1/);
});

test('Fractal Dreams routes Triangle particles, Pulse, Density, Burst, and Halo Comet', () => {
  const presets = read('src/app/data/presets.ts');
  const actions = read('src/app/utils/presetActions.ts');
  const fractal = presets.slice(
    presets.indexOf("name: 'Fractal Dreams'"),
    presets.indexOf("name: 'Particle Storm'"),
  );
  for (const [pattern, label] of [
    [/astralShaper: false/, 'Liquid Shaper off'],
    [/shapeOscillate: true/, 'Core Particles on'],
    [/shapeEdgeTrails: 0\.60/, 'Intensity 60%'],
    [/shapeBurstStrength: 0\.50/, 'Burst 50%'],
    [/shapeDecay: 0\.30/, 'Pulse 30%'],
    [/shapeDensity: 0\.75/, 'Density default'],
    [/coreParticlesShapeMode: 'tri'/, 'Triangle mode'],
    [/haloCometEnabled: true/, 'Halo Comet on'],
    [/haloCometTailLength: 0\.50/, 'Tail 50%'],
    [/haloCometThickness: 2\.8/, 'Thickness 20%'],
    [/halo: 0\.30/, 'Halo 30%'],
  ]) assert.match(fractal, pattern, label);

  for (const id of ['shapeDecay', 'shapeDensity', 'shapeBurstStrength']) {
    assert.match(actions, new RegExp(`setSlider\\("#${id}"`));
    assert.match(actions, new RegExp(`${id}: getSlider\\("#${id}"\\)`));
  }
  assert.match(actions, /setCoreParticleShapeMode/);
});

test('Field-only GPU timing, coalesced metadata, reused diagnostics, and ring timings are wired', () => {
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const rendererViewportSetup = read('src/app/runtime/visualizer/setup/createRendererViewportSetup.ts');
  const gpu = read('src/app/src/render/coreParticles/CoreParticlesGpuRenderer.ts');
  const frame = read('src/app/runtime/renderFrameRuntime.ts');
  const halo = read('src/app/runtime/visualizer/renderers/HaloRendererSystem.ts');

  assert.match(rendererViewportSetup, /enableGpuTimers: FIELD_CERTIFICATION_ENABLED/);
  assert.match(gpu, /if \(this\.gpuTimingEnabled\) this\.initializeGpuTimers\(\)/);
  assert.match(gpu, /if \(this\.gpuTimingEnabled\) \{[\s\S]*this\.pollGpuTimers\(\)/);
  assert.match(session, /pendingMetadataIdleHandle === null/);
  assert.match(session, /pendingMetadataIdleHandle = null/);
  assert.match(session, /reusableFrameCosts/);
  assert.match(session, /reusableFramePublication/);
  assert.match(session, /reusableRenderCostSnapshot/);
  for (const field of ['haloMs', 'cometMs', 'orbitalMs', 'shockwaveMs']) {
    assert.match(frame, new RegExp(field));
  }
  assert.match(halo, /measureTimings/);
  assert.match(session, /frameCosts\.shockwaveMs/);
});
