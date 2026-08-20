import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('active panel interactions correlate frame gaps with bounded render-pass cost diagnostics', () => {
  const interaction = read('src/app/runtime/uiInteractionRuntime.ts');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));

  for (const field of [
    'interactionFrames',
    'interactionLongFrames',
    'maxInteractionFrameInterval',
    'maxInteractionRenderMs',
    'maxInteractionCanvas2DMs',
    'maxInteractionWebGLMs',
    'maxInteractionDotsMs',
    'maxInteractionHaloMs',
    'maxInteractionUiFlushMs',
  ]) assert.match(interaction, new RegExp(field));

  assert.match(interaction, /recordRenderCost\(args:/);
  assert.match(interaction, /if \(!INTERACTION_METRICS_ENABLED \|\| !this\.state\.active\) return;/);
  assert.match(session, /uiInteractionRuntime\.isActive/);
  assert.match(session, /uiInteractionRuntime\.recordRenderCost\(\{/);
  assert.match(session, /frameIntervalMs:\s*framePacing\.frameInterval/);
  assert.match(session, /renderMs:\s*measureFrameTimings \? measureElapsed\(frameCosts\.renderStartTime\) : 0/);
});

test('interaction instrumentation does not introduce a second render scheduler or change quality', () => {
  const interaction = read('src/app/runtime/uiInteractionRuntime.ts');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));

  assert.doesNotMatch(interaction, /requestAnimationFrame\s*\(/);
  const correlationBlock = session.slice(
    session.indexOf('uiInteractionRuntime.recordRenderCost({'),
    session.indexOf('reusableFramePublication.canvas2DSpikeBaselineActive'),
  );
  assert.doesNotMatch(correlationBlock, /quality|renderScale|params\./i);
});
