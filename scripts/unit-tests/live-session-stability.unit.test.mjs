import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = relative => fs.readFileSync(relative, 'utf8');

test('Canvas2D Iridize fallback stays bounded so it cannot starve Web Audio', () => {
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const renderer = read('src/app/runtime/visualizer/renderers/CanvasSpikeRingRenderer.ts');
  assert.match(renderer, /const canvasIridize = Number\(params\.iridize\) > 0\.01/);
  assert.match(renderer, /const iridizeBandSize = canvasIridize \? Math\.max\(1, Math\.ceil\(N \/ 24\)\) : N/);
  assert.match(renderer, /if \(i % iridizeBandSize === 0\)/);
  assert.match(session, /do not draw two extra full spike rings/);
  assert.doesNotMatch(session, /drawSpikes\(ampEcho1/);
  assert.doesNotMatch(session, /drawSpikes\(ampEcho2/);
});

test('Liquid Shaper keeps adaptive thin strokes sharp and restores ping-pong echo motion', () => {
  const shaper = read('src/app/utils/astralShaper.ts');
  assert.match(shaper, /const sharpStroke = 0\.92 \+ normalizedThickness \* 1\.02/);
  assert.match(shaper, /Math\.min\(4\.8, sharpStroke \* thicknessDampen\)/);
  assert.match(shaper, /Math\.min\(5\.5, 1\.0 \+ normalizedThickness \* 0\.9\)/);
  assert.match(shaper, /Math\.sin\(timeSec \* 0\.78\) \* jScale/);
  assert.match(shaper, /Math\.sin\(timeSec \* 0\.52 \+ Math\.PI\) \* jScale \* 0\.68/);
  assert.match(shaper, /renderLayer\(jOsc1, 0\.18\);[\s\S]*renderLayer\(jOsc2, 0\.32\);[\s\S]*renderLayer\(0, 1\.0\);/);
  assert.doesNotMatch(shaper, /jOsc3/);
});

test('active-session recovery remains graphics-only and cannot issue an automatic document reload', () => {
  const supervisor = read('src/app/runtime/session/SessionRecoverySupervisor.ts');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  assert.doesNotMatch(supervisor, /location\.reload|window\.location|document\.location/);
  assert.match(session, /requestSafeGraphicsRecovery\(`Renderer fault/);
  assert.match(session, /audio and controls were preserved/);
});
