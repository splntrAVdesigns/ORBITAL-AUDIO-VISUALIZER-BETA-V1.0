import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Chromatic Waves is the tenth native Core Textures WebGL preset', () => {
  const registry = read('src/app/src/shaders/ShaderRegistry.ts');
  const shader = read('src/app/src/shaders/presets/ChromaticWaves.ts');
  assert.match(registry, /ChromaticWavesShader/);
  assert.match(shader, /id:'chromatic-waves'/);
  assert.match(shader, /type:'webgl'/);
  assert.doesNotMatch(shader, /requestAnimationFrame|useEffect|ResizeObserver|document\./);
  for (const control of ['chromaticFrequency', 'chromaticSpeed', 'chromaticContrast', 'chromaticCellSize', 'chromaticGamma', 'chromaticPaletteBias', 'chromaticDotDensity', 'chromaticAudioWave']) assert.match(shader, new RegExp(control));
  assert.match(shader, /float dot=1\.-smoothstep/);
  assert.match(shader, /float fbm/);
});

test('Noise Glitch Static uses native bounded blinking LED squares instead of random ImageData', () => {
  const noise = read('src/app/src/shaders/presets/NoiseGlitch.ts');
  assert.match(noise, /function drawBlinkSquares/);
  assert.match(noise, /drawBlinkSquares\(ctx, cx, cy, radius/);
  assert.match(noise, /LED Square Density/);
  assert.match(noise, /LED Blink Speed/);
  assert.match(noise, /LED Square Fill/);
  assert.doesNotMatch(noise, /createImageData|putImageData|drawStatic/);
});
