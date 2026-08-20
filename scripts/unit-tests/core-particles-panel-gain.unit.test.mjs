import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Core Particles owns one independent black collapsible panel', () => {
  const controlPanel = read('src/app/components/ControlPanel.tsx');
  const outerHalo = read('src/app/components/OuterHaloSettings.tsx');
  const particles = read('src/app/components/CoreParticlesSettings.tsx');

  assert.match(controlPanel, /import \{ CoreParticlesSettings \}/);
  const outerIndex = controlPanel.indexOf('<OuterHaloSettings');
  const particleIndex = controlPanel.indexOf('<CoreParticlesSettings');
  const liquidIndex = controlPanel.indexOf('<AstralShaperSettings');
  assert.ok(outerIndex >= 0 && particleIndex > outerIndex && liquidIndex > particleIndex);

  assert.doesNotMatch(outerHalo, /shapeOscillate|shapeEdgeTrails|shapeBurstStrength/);
  assert.match(particles, /className="section"/);
  assert.doesNotMatch(particles, /linear-gradient/);
  assert.match(particles, /aria-expanded=/);
  assert.match(particles, /Reset Core Particles to defaults/);
  assert.match(particles, /defaultParams\.shapeDecay/);
  assert.match(particles, /defaultParams\.shapeDensity/);

  for (const id of [
    'shapeOscillate', 'shapeEdgeTrails', 'shapeDecay', 'shapeDistortion',
    'shapeTurbulence', 'shapeBurstStrength', 'shapeOrbitDrift', 'shapeDensity',
  ]) {
    assert.equal((particles.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `${id} must exist once`);
  }
});

test('Core Particle shader is the exact approved Phase 1 visible-floor baseline', () => {
  const shaders = read('src/app/src/render/coreParticles/CoreParticleShaders.ts');
  const canonicalShaders = shaders.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
  const digest = crypto.createHash('sha256').update(canonicalShaders).digest('hex');

  assert.equal(digest, '5693a24180b26d66438196b42fad906f320f52aafc7582019457a3209aea194f');
  assert.match(shaders, /uniform float u_qualityScale/);
  assert.match(shaders, /bodyDiameter \* 2\.55 \* shapeScale \* u_dpr \* u_qualityScale/);
  assert.match(shaders, /u_diameterGain/);
  assert.match(shaders, /u_visualEnergy/);
  assert.match(shaders, /presenceGate/);
  assert.match(shaders, /v_flash = phasePulse/);
  assert.doesNotMatch(shaders, /v_colorPulse|v_presence|smoothstep\(0\.38, 1\.0, intensityNorm\)/);
});

test('Phase 4.5 Pulse remains render-only and never changes simulation geometry', () => {
  const shaders = read('src/app/src/render/coreParticles/CoreParticleShaders.ts');
  const updateShader = shaders.slice(
    shaders.indexOf('CORE_PARTICLE_UPDATE_VERTEX_SHADER'),
    shaders.indexOf('CORE_PARTICLE_UPDATE_FRAGMENT_SHADER'),
  );
  const renderVertex = shaders.slice(
    shaders.indexOf('CORE_PARTICLE_RENDER_VERTEX_SHADER'),
    shaders.indexOf('CORE_PARTICLE_RENDER_FRAGMENT_SHADER'),
  );
  const pointSizeBlock = renderVertex.slice(
    renderVertex.indexOf('float bodyDiameter'),
    renderVertex.indexOf('float signedFlash'),
  );

  assert.doesNotMatch(updateShader, /u_pulse|phasePulse/);
  assert.doesNotMatch(pointSizeBlock, /u_pulse|phasePulse|u_impulse/);
  assert.match(renderVertex, /hueShift[\s\S]*signedFlash/);
  assert.match(renderVertex, /flashSaturation[\s\S]*phasePulse/);
  assert.match(renderVertex, /lightness[\s\S]*phasePulse/);
});
