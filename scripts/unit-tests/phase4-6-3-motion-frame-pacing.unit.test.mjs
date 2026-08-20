import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { importBundledTypescript } from './load-typescript-module.mjs';

const read = relative => fs.readFileSync(relative, 'utf8');

test('Auto Zoom uses scheduler delta, smooth energy, and bounded phase/scale correction', async context => {
  const { AutoZoomMotionRuntime } = await importBundledTypescript(
    'src/app/runtime/visualizer/motion/AutoZoomMotionRuntime.ts',
    context,
  );
  const runtime = new AutoZoomMotionRuntime();
  let previous = runtime.update(true, true, 1 / 60, 120, 4, 0, 0);
  let maxScaleDelta = 0;
  for (let frame = 1; frame <= 240; frame += 1) {
    const next = runtime.update(
      true,
      true,
      1 / 60,
      120,
      4,
      (frame / 120) % 1,
      frame % 24 < 4 ? 1 : 0.15,
    );
    maxScaleDelta = Math.max(
      maxScaleDelta,
      Math.abs(next.spike - previous.spike),
      Math.abs(next.center - previous.center),
      Math.abs(next.dots - previous.dots),
      Math.abs(next.halo - previous.halo),
    );
    previous = { ...next };
  }
  assert.ok(maxScaleDelta <= 0.0081, `scale changed too quickly: ${maxScaleDelta}`);

  const phaseBeforePause = previous.cyclePhase;
  const scaleBeforePause = previous.spike;
  const paused = runtime.update(false, true, 1 / 30, 120, 4, 0.95, 1);
  assert.equal(paused.cyclePhase, phaseBeforePause, 'disabled Auto Zoom must preserve phase');
  assert.ok(
    Math.abs(paused.spike - scaleBeforePause) <= 0.0161,
    'disabled Auto Zoom must ease rather than snap home',
  );
  assert.ok(
    Math.abs(paused.spike - 1) <= Math.abs(scaleBeforePause - 1),
    'disabled Auto Zoom must approach neutral',
  );
  const resumed = runtime.update(true, true, 1 / 30, 120, 4, 0.98, 1);
  const phaseAdvance = ((resumed.cyclePhase - phaseBeforePause) + 1) % 1;
  assert.ok(phaseAdvance < 0.011, `phase correction snapped by ${phaseAdvance}`);

  const source = read('src/app/runtime/visualizer/motion/AutoZoomMotionRuntime.ts');
  assert.doesNotMatch(source, /performance\.now|document\.|querySelector|getElementById/);
  assert.doesNotMatch(source, /update\(input:|const pulse = \(/);
  assert.match(source, /MAX_PHASE_CORRECTION_PER_SECOND/);
  assert.match(source, /envelopeRate = energyTarget > this\.smoothedEnergy \? 10 : 3\.8/);
});

test('Core Particle quality transitions remain continuous under pressure and recovery', async context => {
  const { CoreParticleQualityGovernor } = await importBundledTypescript(
    'src/app/src/render/coreParticles/CoreParticleQualityGovernor.ts',
    context,
  );
  const governor = new CoreParticleQualityGovernor();
  let previous = governor.resolve(850, 2);
  let maxDrawStep = 0;
  let maxPointStep = 0;
  for (let frame = 0; frame < 360; frame += 1) {
    governor.update(frame < 180 ? (frame % 3 === 0 ? 58 : 30) : 16.7);
    const next = governor.resolve(850, 2);
    maxDrawStep = Math.max(maxDrawStep, Math.abs(next.drawScale - previous.drawScale));
    maxPointStep = Math.max(maxPointStep, Math.abs(next.pointScale - previous.pointScale));
    previous = next;
  }
  assert.ok(maxDrawStep < 0.03, `draw density stepped by ${maxDrawStep}`);
  assert.ok(maxPointStep < 0.05, `point size stepped by ${maxPointStep}`);
});

test('ring rendering uses bounded Comet, Orbital, and Shockwave work', () => {
  const canvas = read('src/app/renderers/canvasLayerRenderer.ts');
  assert.match(canvas, /const segments = 24/);
  assert.doesNotMatch(canvas, /const segments = 60/);
  assert.doesNotMatch(canvas, /createConicGradient/);
  assert.match(canvas, /MAX_ORBITAL_PATH_BUCKETS = 16/);
  assert.match(canvas, /getOrbitalEnergyPath\(ctx, pulseWidth\)/);
  assert.match(canvas, /MAX_SHOCKWAVE_GRADIENTS_PER_CONTEXT = 48/);
  assert.match(canvas, /getShockwaveGradient\(ctx, sw\.radius, hue\)/);
});

test('normal sessions keep diagnostics dormant and performance HUD publication subscriber-driven', () => {
  const environment = read('src/app/config/runtimeEnvironment.ts');
  const session = (read('src/app/runtime/visualizer/createVisualizerRuntimeSession.ts') + '\n' + read('src/app/runtime/visualizer/frame/createVisualizerProductionFrameController.ts'));
  const bus = read('src/app/runtime/visualizer/pipeline/MainThreadUIRefreshBus.ts');
  const gpu = read('src/app/src/render/coreParticles/CoreParticlesGpuRenderer.ts');
  assert.doesNotMatch(environment, /getItem\('orbital\.fieldCertification'\)/);
  assert.match(environment, /removeItem\('orbital\.fieldCertification'\)/);
  assert.match(bus, /hasPerformanceHUDSubscribers/);
  assert.match(session, /mainThreadUIRefreshBus\.hasPerformanceHUDSubscribers\(\)/);
  assert.match(gpu, /const measureSubmitTime = this\.gpuTimingEnabled/);
});

test('preset keyboard navigation has no toast and MODE labels stay compact', async context => {
  const keyboard = read('src/app/hooks/usePresetKeyboardNavigation.ts');
  assert.doesNotMatch(keyboard, /orbital-preset-shortcut-toast|PRESET ·|700/);
  const { formatPresetNameForHud } = await importBundledTypescript(
    'src/app/runtime/presetHudLabel.ts',
    context,
  );
  assert.equal(formatPresetNameForHud('Bass Earthquake'), 'BASS EQ');
  assert.equal(formatPresetNameForHud('Fractal Dreams'), 'FRAC DRM');
  assert.ok(formatPresetNameForHud('A Very Long Custom Preset Name').length <= 10);
  const strip = read('src/app/components/AudioMetadataStrip.tsx');
  const styles = read('src/styles/globals.css');
  assert.match(strip, /title=\{metadata\.mode\}/);
  assert.match(styles, /\.audio-metadata-mode[\s\S]*white-space:\s*nowrap/);
});
