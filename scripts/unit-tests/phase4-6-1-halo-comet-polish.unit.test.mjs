import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = relative => fs.readFileSync(relative, 'utf8');

test('Halo Comet keeps a thickness-aware visual gap beyond the complete Halo bloom', () => {
  const canvas = read('src/app/renderers/canvasLayerRenderer.ts');
  const cometBlock = canvas.slice(
    canvas.indexOf('export function renderHaloComet'),
    canvas.indexOf('export function renderShockwaves'),
  );

  assert.match(cometBlock, /bloomOuterReach/);
  assert.match(cometBlock, /Math\.min\(14, 8 \+ thickness \* 0\.6\)/);
  assert.match(cometBlock, /orbitOffset = bloomOuterReach \+ visualGap \+ tailGlowWidth \* 0\.5/);
  assert.match(cometBlock, /orbitRadius = Math\.min\(maxRadius, radius\) \+ orbitOffset/);
});

test('Halo Comet tail is densely overlapped and eased from faint tail to bright head', () => {
  const canvas = read('src/app/renderers/canvasLayerRenderer.ts');
  const cometBlock = canvas.slice(
    canvas.indexOf('export function renderHaloComet'),
    canvas.indexOf('export function renderShockwaves'),
  );

  assert.match(cometBlock, /const segments = 24/);
  assert.match(cometBlock, /overlapProgress = segmentProgress \* 0\.14/);
  assert.match(cometBlock, /sampleProgress \* sampleProgress \* \(3 - 2 \* sampleProgress\)/);
  assert.match(cometBlock, /ctx\.lineCap = 'round'/);
  assert.match(cometBlock, /adaptiveSaturation/);
  assert.match(cometBlock, /tailGlowWidth/);
});

test('Halo Comet polish does not introduce an independent scheduler or simulation', () => {
  const canvas = read('src/app/renderers/canvasLayerRenderer.ts');
  const orbit = read('src/app/runtime/visualizer/renderers/HaloCometOrbitRuntime.ts');
  const renderer = read('src/app/runtime/visualizer/renderers/HaloRendererSystem.ts');

  for (const source of [canvas, orbit, renderer]) {
    assert.doesNotMatch(source, /requestAnimationFrame|setInterval|setTimeout/);
  }
  assert.doesNotMatch(canvas, /new (?:Worker|OffscreenCanvas|HTMLCanvasElement)/);
});
