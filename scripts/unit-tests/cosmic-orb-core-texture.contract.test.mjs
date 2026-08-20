import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Cosmic Orb is registered as a native Core Textures WebGL preset', () => {
  const registry = read('src/app/src/shaders/ShaderRegistry.ts');
  const orb = read('src/app/src/shaders/presets/CosmicOrb.ts');
  assert.match(registry, /import \{ CosmicOrbShader \} from '\.\/presets\/CosmicOrb'/);
  assert.match(registry, /CosmicOrbShader/);
  assert.match(orb, /id: 'cosmic-orb'/);
  assert.match(orb, /type: 'webgl'/);
  assert.doesNotMatch(orb, /requestAnimationFrame|useEffect|ResizeObserver|document\./);
});

test('Cosmic Orb maps ORBITAL color and preprocessed audio into bounded shader controls', () => {
  const orb = read('src/app/src/shaders/presets/CosmicOrb.ts');
  for (const control of ['orbArchetype', 'orbScale', 'orbSpeed', 'orbSpin', 'nebulaDensity', 'starDetail', 'lensEnabled', 'lensAmount', 'audioPulseAmount', 'paletteSpread', 'colorSource']) {
    assert.match(orb, new RegExp(control));
  }
  assert.match(orb, /params\.colorSource === 'custom-accent'/);
  assert.match(orb, /Number\(params\.hue \?\? 210\)/);
  assert.match(orb, /activeArchetype = requestedArchetype/);
  assert.match(orb, /smoothAudio \+= \(energy - smoothAudio\) \* \.11/);
});

test('Cosmic Orb rotation remains time-driven while audio is smoothed into intensity-only effects', () => {
  const orb = read('src/app/src/shaders/presets/CosmicOrb.ts');
  assert.match(orb, /float angle = atan\(p\.y, p\.x\) \+ u_orbitalPhase/);
  assert.doesNotMatch(orb, /\+ u_mid \* \.55/);
  assert.match(orb, /smoothAudio \+= \(energy - smoothAudio\) \* \.11/);
  assert.match(orb, /smoothPulse \+= \(pulseTarget - smoothPulse\)/);
  assert.match(orb, /uniform float u_pulse/);
  assert.match(orb, /max: 1\.5/);
});

test('Cosmic Orb uses periodic direction-space nebula coordinates to prevent angular seams', () => {
  const orb = read('src/app/src/shaders/presets/CosmicOrb.ts');
  assert.match(orb, /vec2 direction = vec2\(cos\(angle\), sin\(angle\)\)/);
  assert.match(orb, /float nebula = fbm\(direction/);
  assert.match(orb, /Direction-space noise is periodic/);
  assert.doesNotMatch(orb, /fbm\(vec2\(angle/);
});


test('Cosmic Orb keeps its left edge seam-free while restoring organic color-wave response', () => {
  const orb = read('src/app/src/shaders/presets/CosmicOrb.ts');
  assert.match(orb, /float arms = floor\(4\.0 \+ u_density \* 5\.0 \+ \.5\)/);
  assert.doesNotMatch(orb, /angle \* \(5\.0 \+ u_density/);
  assert.match(orb, /Round SDF stars replace the previous grid-cell hash squares/);
  assert.match(orb, /float starDot = 1\.0 - smoothstep/);
  assert.match(orb, /float travelingWave/);
  assert.match(orb, /float colorPulse/);
  assert.match(orb, /const perceptualAudio = Math\.pow/);
  assert.match(orb, /float lensField = exp/);
});


test('Cosmic Orb holds manual archetypes and integrates motion phase across speed/spin changes', () => {
  const orb = read('src/app/src/shaders/presets/CosmicOrb.ts');
  assert.match(orb, /activeArchetype = requestedArchetype/);
  assert.doesNotMatch(orb, /pendingArchetype/);
  assert.match(orb, /function resolvePhase\(clock: PhaseClock/);
  assert.match(orb, /const orbitRate =/);
  assert.match(orb, /const innerSpinRate =/);
  assert.match(orb, /resolvePhase\(orbitalPhase, motionNow, orbitRate\)/);
  assert.match(orb, /uniform float u_orbitalPhase/);
  assert.match(orb, /float lensWarp = u_lens \* lensField \* \(\.13 \+ \.07 \* sin/);
});


test('Cosmic Orb separates global orbit from internal spin and gives Deep its own depth composition', () => {
  const orb = read('src/app/src/shaders/presets/CosmicOrb.ts');
  for (const marker of ['u_spinPhase', 'innerAngle', 'orbSpeed: { type:', 'max: 2.0', "label: 'Inner Spin'", "label: 'Audio Pulse'", 'deepVoidDepth', 'deepRimDensity', 'deepRimColorPull', 'deepStarParallax', 'deepDepthOfField', 'voidMask', 'rimBand', 'deepParallax', 'deepStars']) {
    assert.match(orb, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(orb, /Orb Speed owns whole-orb rotation; Inner Spin only twists internal arms/);
});
