import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Core Textures has a bounded render budget independent of the visualizer frame loop', () => {
  const engine = read('src/app/src/engines/CoreTexturesEngine.ts');
  assert.match(engine, /maxInternalDimension = 512/);
  assert.match(engine, /now - this\.lastRenderAt < minInterval/);
  assert.match(engine, /averageRenderMs/);
  assert.match(engine, /getRenderIntervalMs/);
  assert.match(engine, /1000 \/ 18/);
  assert.match(engine, /Object\.assign\(this\.params, newParams\)/);
});

test('the known costly Canvas2D presets obey adaptive geometry limits', () => {
  const cube = read('src/app/src/shaders/presets/ParticleCubeField.ts');
  const tunnel = read('src/app/src/shaders/presets/HologridDepthTunnel.ts');
  assert.match(cube, /renderQuality/);
  assert.match(cube, /quality < 0\.7 \? 6/);
  // Sprint N: geometry is bounded by preallocated typed arrays; sliders reach their full range.
  assert.match(tunnel, /renderQuality/);
  assert.match(tunnel, /const MAX_RINGS = 42;/);
  assert.match(tunnel, /const MAX_SEGMENTS = 96;/);
  assert.match(tunnel, /new Float32Array\(MAX_RINGS \* MAX_SEGMENTS\)/);
  assert.doesNotMatch(tunnel, /shadowBlur\s*=/, 'Hologrid must not use per-primitive shadowBlur');
  assert.doesNotMatch(tunnel, /points\.push\(/, 'Hologrid must not allocate ring points per frame');
});

test('Digital Matrix stages its first visible columns and starts from conservative defaults', () => {
  const matrix = read('src/app/src/shaders/presets/DigitalMatrix.ts');
  const engine = read('src/app/src/engines/CoreTexturesEngine.ts');
  assert.match(matrix, /let activationElapsed = 0/);
  assert.match(matrix, /columns\.indexOf\(col\) \* 0\.115/);
  assert.match(matrix, /if \(activationElapsed < stagger\) return/);
  assert.match(matrix, /speed: 1\.1/);
  assert.match(matrix, /density: 16/);
  assert.match(matrix, /reset\(\) \{/);
  assert.match(engine, /this\.currentShader\?\.reset\?\.\(\)/);
});

test('Geometric Pattern uses observed beat edges and adaptive geometry instead of a four-beat wall clock', () => {
  const geometric = read('src/app/src/shaders/presets/GeometricPattern.ts');
  const liquid = read('src/app/src/shaders/presets/LiquidGradient.ts');
  assert.match(geometric, /formationStartedAt/);
  assert.match(geometric, /if \(isBeat && !beatWasActive\) formationStartedAt = now/);
  assert.match(geometric, /formationDuration/);
  assert.doesNotMatch(geometric, /const beatsPerCycle = 4/);
  assert.match(geometric, /renderQuality/);
  assert.match(liquid, /opacity: 1\.0/);
});


test('low-cost WebGL Core Textures can present at 60 FPS before budget fallback', () => {
  const engine = read('src/app/src/engines/CoreTexturesEngine.ts');
  assert.match(engine, /this\.averageRenderMs <= 2\) return 1000 \/ 60/);
  assert.match(engine, /this\.averageRenderMs <= 4\) return 1000 \/ 45/);
  assert.match(engine, /return 1000 \/ 30/);
});
