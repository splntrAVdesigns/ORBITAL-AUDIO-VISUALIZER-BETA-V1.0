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
  assert.match(tunnel, /Math\.min\(24/);
  assert.match(tunnel, /Math\.min\(48/);
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
