import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

test('panel interaction cannot change the Dot Ring renderer, geometry, or glow profile', () => {
  const dots = read('src/app/renderers/dotRingRenderer.ts');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));

  assert.match(dots, /const useWebGLDots = Boolean\(this\.webglDots/);
  assert.match(dots, /const dotGlowQuality = params\.dotsPulse \|\| dots > 96 \? 0\.55 : 1\.0/);
  assert.match(dots, /radius: rad,/);
  assert.doesNotMatch(dots, /interactionBudget/);
  assert.doesNotMatch(dots, /switchingToCanvasBudget/);
  assert.doesNotMatch(session, /interactionBudget: uiInteractionRuntime\.isActive/);
});

test('Dot Ring retains one scheduler-free renderer authority', () => {
  const dots = read('src/app/renderers/dotRingRenderer.ts');
  assert.match(dots, /if \(useWebGLDots\) this\.webglDots!\.begin/);
  assert.match(dots, /if \(useWebGLDots\) this\.webglDots!\.flush/);
  assert.doesNotMatch(dots, /requestAnimationFrame\s*\(/);
  assert.doesNotMatch(dots, /setInterval\s*\(/);
});
