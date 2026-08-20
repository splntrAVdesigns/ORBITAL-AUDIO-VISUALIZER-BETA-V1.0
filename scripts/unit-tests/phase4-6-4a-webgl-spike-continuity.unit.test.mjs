import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

const read = relative => fs.readFileSync(relative, 'utf8');

test('WebGL spike runtime owns cached state, one profile/upload, and mirrored draws', () => {
  const renderer = read('src/app/runtime/visualizer/renderers/WebGLSpikeRenderer.ts');
  const setup = read('src/app/runtime/visualizer/setup/createLegacyWebGLSetup.ts');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));

  assert.match(renderer, /export class WebGLSpikeRenderer/);
  assert.match(renderer, /createVertexArray\(\)/);
  assert.match(renderer, /bindVertexArray\(this\.vao\)/);
  assert.equal((renderer.match(/ALIASED_LINE_WIDTH_RANGE/g) || []).length, 1);
  assert.doesNotMatch(renderer, /\.subarray\(/);
  assert.match(renderer, /fillAuthoritativeAmplitudeProfile\(frame\.source\)/);
  assert.equal((renderer.match(/bufferSubData\(/g) || []).length, 1);
  assert.match(renderer, /u_spikeDirection, 1/);
  assert.match(renderer, /u_spikeDirection, -1/);
  assert.match(renderer, /sourceLength === this\.sourceLength/);
  assert.match(renderer, /sampleRate === this\.sampleRate/);

  assert.match(setup, /new WebGLSpikeRenderer/);
  assert.doesNotMatch(session, /gl\.getParameter\(gl\.ALIASED_LINE_WIDTH_RANGE\)/);
  assert.doesNotMatch(session, /renderSpikePremiumFx\(/);
  assert.doesNotMatch(session, /sampleSymmetricSpikeAmplitude\(/);
});

test('Gamma is geometry-neutral and Iridize is shader-owned during WebGL rendering', () => {
  const renderer = read('src/app/runtime/visualizer/renderers/WebGLSpikeRenderer.ts');
  const shader = read('src/app/utils/webglShaders.ts');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const amplitudeBlock = renderer.slice(
    renderer.indexOf('private fillAuthoritativeAmplitudeProfile'),
  );

  assert.doesNotMatch(amplitudeBlock, /gamma/i);
  assert.match(renderer, /u_gammaFx/);
  assert.match(renderer, /u_iridize/);
  assert.match(shader, /uniform float u_iridize/);
  assert.match(shader, /float shell =/);
  assert.match(shader, /float tipAccent =/);
  assert.match(shader, /float fringePhase =/);
  assert.match(session, /const webglSpikeActive = !!legacyWebGLSpikeAllowed/);
  assert.match(session, /canvas2DSpikeBaselineActive = params\.vizMode === 0 && \(!webglSpikeActive/);
});

test('scheduler motion phase clamps long gaps and is shared across motion consumers', async context => {
  const { SchedulerMotionPhaseRuntime } = await importBundledTypescript(
    'src/app/runtime/visualizer/motion/SchedulerMotionPhaseRuntime.ts',
    context,
  );
  const runtime = new SchedulerMotionPhaseRuntime();
  const first = { ...runtime.advance(1 / 60) };
  const stalled = { ...runtime.advance(0.5) };
  assert.ok(stalled.deltaSeconds <= 1 / 45);
  assert.ok(stalled.timeSeconds - first.timeSeconds <= 1 / 45 + 1e-9);

  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const halo = read('src/app/runtime/visualizer/renderers/HaloRendererSystem.ts');
  assert.match(session, /schedulerMotionPhaseRuntime\.advance\(frame\.dt\)/);
  assert.match(session, /motionRotationRuntime\.updateRotation\(\{[\s\S]*dt,/);
  assert.match(session, /autoZoomMotionRuntime\.update\([\s\S]*dt,/);
  assert.match(session, /timeMs: schedulerMotionTimeMs/);
  assert.match(halo, /frame\.motionDeltaSeconds/);
});
