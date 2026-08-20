import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

const read = relative => fs.readFileSync(relative, 'utf8');

test('Burst is progressive, single-applied, and motion-only while Pulse is color-only', async context => {
  const mapping = await importBundledTypescript(
    'src/app/src/render/coreParticles/CoreParticleControlMapping.ts',
    context,
  );
  const impulseRuntime = read('src/app/runtime/audio/CoreParticleImpulseRuntime.ts');
  const shaders = read('src/app/src/render/coreParticles/CoreParticleShaders.ts');
  const updateShader = shaders.slice(0, shaders.indexOf('CORE_PARTICLE_UPDATE_FRAGMENT_SHADER'));
  const renderShader = shaders.slice(shaders.indexOf('CORE_PARTICLE_RENDER_VERTEX_SHADER'));

  let previous = 0;
  for (let step = 0; step <= 100; step += 5) {
    const value = mapping.resolveCoreParticleImpulse(1, step / 100);
    assert.ok(value >= previous, `Burst regressed at ${step}%`);
    assert.ok(value < 1, 'Burst must not saturate the impulse ceiling');
    previous = value;
  }
  assert.doesNotMatch(impulseRuntime, /strength:/, 'upstream impulse runtime must not pre-scale Burst');
  assert.match(updateShader, /uniform float u_impulse/);
  assert.doesNotMatch(updateShader, /uniform float u_pulse/);
  assert.doesNotMatch(renderShader, /uniform float u_impulse/);
  assert.match(renderShader, /signedFlash|flashSaturation/);
  const pointSize = renderShader.match(/gl_PointSize\s*=([^;]+);/)?.[1] ?? '';
  assert.doesNotMatch(pointSize, /u_pulse|u_impulse/);
});

test('renderer quality governor downshifts quickly, recovers slowly, and bounds point area', async context => {
  const { CoreParticleQualityGovernor } = await importBundledTypescript(
    'src/app/src/render/coreParticles/CoreParticleQualityGovernor.ts',
    context,
  );
  const governor = new CoreParticleQualityGovernor();
  for (let i = 0; i < 180; i += 1) governor.update(i % 3 === 0 ? 55 : 28);
  const pressured = governor.resolve(850, 2);
  assert.notEqual(pressured.tier, 'full');
  assert.ok(pressured.pointScale < 1);
  assert.ok(pressured.estimatedPointArea <= pressured.pointAreaBudget + 1);
  for (let i = 0; i < 180; i += 1) governor.update(16.7);
  assert.notEqual(governor.resolve(850, 1).tier, 'full', 'quality must not rebound after only one clean window');
  for (let i = 0; i < 900; i += 1) governor.update(16.7);
  assert.equal(governor.resolve(850, 1).tier, 'full');
});

test('default-scene overhead is gated and frame/GPU observability is field-ready', () => {
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const audio = read('src/app/engine/AudioSystemInit.ts');
  const environment = read('src/app/config/runtimeEnvironment.ts');
  const telemetry = read('src/app/runtime/crashTelemetry.ts');
  const renderer = read('src/app/src/render/coreParticles/CoreParticlesGpuRenderer.ts');
  const viewport = read('src/app/runtime/visualizer/setup/createViewportPanelSetup.ts');

  assert.doesNotMatch(session, /audioBridge\.analyzeAsync|latestAudioData|pendingWorkerRequest/);
  assert.doesNotMatch(audio, /new AudioBridge|AudioBridge/);
  assert.match(session, /coreParticlesActive\s*&&[\s\S]{0,120}leftAnalyser/);
  assert.doesNotMatch(session, /Auto-reducing dot density|performanceQuality\s*<[^\n]+params\.dotsDensity/);
  assert.match(session, /frameIntervalMs:\s*framePacing\.frameInterval/);
  assert.match(environment, /orbitalDiagnostics/);
  assert.match(environment, /RUNTIME_TELEMETRY_ENABLED/);
  assert.match(telemetry, /if \(!force\) return/);
  assert.match(renderer, /EXT_disjoint_timer_query_webgl2/);
  assert.match(renderer, /pointAreaBudget/);
  assert.match(viewport, /pixelCount:\s*viewport\.pixelWidth \* viewport\.pixelHeight/);
});
