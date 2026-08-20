import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

const read = relative => fs.readFileSync(relative, 'utf8');

test('Halo Comet advances on authoritative frames and reverses without phase reset', async context => {
  const { HaloCometOrbitRuntime } = await importBundledTypescript(
    'src/app/runtime/visualizer/renderers/HaloCometOrbitRuntime.ts',
    context,
  );
  const orbit = new HaloCometOrbitRuntime();
  const initial = orbit.update(true, 0.25, 1, 0);
  const movingRight = orbit.update(true, 0.25, 1, 0.016);
  const movingLeft = orbit.update(true, 0.25, -1, 0.016);

  assert.ok(movingRight > initial, 'RIGHT must advance clockwise');
  assert.ok(movingLeft < movingRight, 'LEFT must reverse from the current phase');
  assert.ok(Math.abs(movingLeft - initial) < 1e-9, 'equal opposite steps must return continuously');

  const paused = orbit.update(false, 1, 1, 1);
  const resumed = orbit.update(true, 0.25, 1, 0.016);
  assert.equal(paused, movingLeft, 'disabled comet must retain its phase');
  assert.ok(resumed - paused < 0.1, 'resume must not catch up hidden time');
});

test('Halo Comet is a bounded halo-pass feature with no independent scheduler', () => {
  const defaults = read('src/app/config/defaultParams.ts');
  const panel = read('src/app/components/OuterHaloSettings.tsx');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const controls = read('src/app/runtime/visualizer/controls/registerVisualizerControlPlane.ts');
  const renderer = read('src/app/runtime/visualizer/renderers/HaloRendererSystem.ts');
  const orbit = read('src/app/runtime/visualizer/renderers/HaloCometOrbitRuntime.ts');
  const canvas = read('src/app/renderers/canvasLayerRenderer.ts');

  for (const key of [
    'haloCometEnabled', 'haloCometSpeed', 'haloCometDirection',
    'haloCometThickness', 'haloCometTailLength',
  ]) {
    assert.match(defaults, new RegExp(`${key}:`));
    assert.equal((panel.match(new RegExp(`id="${key}"`, 'g')) || []).length, 1, `${key} must exist once`);
    assert.match(controls, new RegExp(`bind\\("#${key}"`));
  }

  assert.match(panel, /\[-1, 'LEFT'\]/);
  assert.match(panel, /\[1, 'RIGHT'\]/);
  assert.match(renderer, /renderOuterHalo\(this\.frame\)[\s\S]*renderHaloComet/);
  assert.match(session, /cometOverscanActive = params\.autoZoom \|\| params\.allowZoom/);
  assert.match(session, /0\.62 : 0\.49/);
  assert.match(canvas, /headAngle = phase - sceneRotation/);
  assert.match(canvas, /const segments = 24/);
  assert.doesNotMatch(orbit, /requestAnimationFrame|setInterval|setTimeout/);
  assert.doesNotMatch(renderer, /requestAnimationFrame|setInterval|setTimeout/);
});

test('Orbital Energy uses seconds and Outer Halo reset covers every owned control', () => {
  const canvas = read('src/app/renderers/canvasLayerRenderer.ts');
  const actions = read('src/app/utils/presetActions.ts');
  const resetBlock = actions.slice(
    actions.indexOf('function resetOuterHaloCenterLayer'),
    actions.indexOf('function resetDots'),
  );

  assert.match(canvas, /\(timeMs \/ 1000\) \* pulseSpeed/);
  for (const id of [
    'halo', 'bloom', 'orbitalEnergy', 'orbitalWidth', 'orbitalDirection',
    'haloCometEnabled', 'haloCometSpeed', 'haloCometDirection',
    'haloCometThickness', 'haloCometTailLength', 'glowCenter', 'glowStrength',
    'shockwave', 'shockwaveThreshold', 'shockwaveRings', 'shockwaveSpeed', 'shockwaveDecay',
  ]) {
    assert.match(resetBlock, new RegExp(`'#${id}'`), `${id} missing from Outer Halo reset`);
  }
});
