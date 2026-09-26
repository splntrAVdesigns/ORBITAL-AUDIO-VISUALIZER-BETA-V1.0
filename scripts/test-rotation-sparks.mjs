import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbital-rotation-sparks-'));
const tscPath = path.resolve('node_modules/typescript/bin/tsc');
try {
  const sources = [
    'src/app/utils/rotationSyncEngine.ts',
    'src/app/utils/rotationAuthority.ts',
    'src/app/utils/easing.ts',
    'src/app/utils/mathHelpers.ts',
    'src/app/utils/runtimeClock.ts',
    'src/app/runtime/visualizer/renderers/SparkCometRuntime.ts',
    'src/app/runtime/visualizer/renderers/CenterEmitterGeometry.ts',
    'src/app/runtime/visualizer/renderers/SparkCometSpriteAtlas.ts',
    'src/app/runtime/visualizer/session/RuntimeResourceDiagnostics.ts',
    'src/app/runtime/diagnostics/RuntimeAudioSoakMonitor.ts',
  ];
  const compile = spawnSync(process.execPath, [
    tscPath,
    ...sources,
    '--target', 'ES2022',
    '--module', 'ESNext',
    '--moduleResolution', 'Bundler',
    '--skipLibCheck',
    '--outDir', tempDir,
  ], { encoding: 'utf8' });
  if (compile.status !== 0) throw new Error(`Compile failed:\n${compile.stdout}\n${compile.stderr}`);

  const find = (name, dir = tempDir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = find(name, full);
        if (nested) return nested;
      } else if (entry.name === name) return full;
    }
  };

  for (const file of ['rotationSyncEngine.js', 'rotationAuthority.js', 'easing.js', 'mathHelpers.js', 'runtimeClock.js', 'RuntimeAudioSoakMonitor.js', 'SparkCometRuntime.js', 'CenterEmitterGeometry.js']) {
    const resolved = find(file);
    if (!resolved) continue;
    let code = fs.readFileSync(resolved, 'utf8');
    code = code
      .replace(/from '\.\/easing'/g, "from './easing.js'")
      .replace(/from '\.\/mathHelpers'/g, "from './mathHelpers.js'")
      .replace(/from '\.\/runtimeClock'/g, "from './runtimeClock.js'")
      .replace(/from '\.\/rotationSyncEngine'/g, "from './rotationSyncEngine.js'")
      .replace(/from '\.\.\/visualizer\/session\/RuntimeResourceDiagnostics'/g, "from '../visualizer/session/RuntimeResourceDiagnostics.js'")
      .replace(/from '\.\.\/visualizer\/renderers\/SparkCometRuntime'/g, "from '../visualizer/renderers/SparkCometRuntime.js'")
      .replace(/from '\.\/SparkCometSpriteAtlas'/g, "from './SparkCometSpriteAtlas.js'");
    fs.writeFileSync(resolved, code);
  }

  const rotation = await import(`${pathToFileURL(find('rotationSyncEngine.js')).href}?v=${Date.now()}`);
  const quarterInterval = rotation.getSecondsPerDivision(120, '1/4');
  const exactQuarter = rotation.advanceQuantizedRotation({
    accumulator: 0,
    targetAngle: 0,
    dt: quarterInterval,
    bpm: 120,
    division: '1/4',
    speed: 0.8,
  });
  assert.ok(Math.abs(exactQuarter.targetAngle - Math.PI / 2) < 1e-9, 'fractional speed must still land on the exact 90° grid');

  const fullInterval = rotation.getSecondsPerDivision(120, '1/1');
  const fullTurn = rotation.advanceQuantizedRotation({ accumulator: 0, targetAngle: 0, dt: fullInterval, bpm: 120, division: '1/1', speed: 1 });
  assert.ok(Math.abs(fullTurn.targetAngle - Math.PI * 2) < 1e-9, '1/1 must advance an unwrapped full turn');
  const reverse = rotation.advanceQuantizedRotation({ accumulator: 0, targetAngle: 0, dt: fullInterval, bpm: 120, division: '1/1', speed: -2 });
  assert.ok(Math.abs(reverse.targetAngle + Math.PI * 2) < 1e-9, 'signed speed must reverse direction without multiplying the angular grid');
  assert.equal(rotation.getBeatsForDivision('2/1'), 8);
  assert.equal(rotation.getBeatsForDivision('4/1'), 16);

  const { RotationAuthority } = await import(`${pathToFileURL(find('rotationAuthority.js')).href}?v=${Date.now()}`);
  const authority = new RotationAuthority();
  authority.angle = 0.72;
  authority.currentAngle = 0.72;
  authority.reset('quantized', 0.72);
  const params = { rotationSyncMode: 'quantized', rotation: 0.8, bpm: 120, bars: 8, rotationQuantize: '1/4' };
  for (let i = 0; i < 28; i += 1) authority.update(params, 1 / 60);
  const justAfterHome = authority.angle;
  for (let i = 0; i < 6; i += 1) authority.update(params, 1 / 60);
  assert.notEqual(authority.angle, justAfterHome, 'quantized movement must start immediately after cardinal homing');
  const exactAuthority = new RotationAuthority();
  exactAuthority.reset('quantized', 0);
  for (let i = 0; i < 26; i += 1) exactAuthority.update(params, 1 / 60);
  for (let i = 0; i < 30; i += 1) exactAuthority.update(params, 1 / 60);
  const nearestQuarter = Math.round(exactAuthority.currentAngle / (Math.PI / 2)) * (Math.PI / 2);
  assert.ok(Math.abs(exactAuthority.currentAngle - nearestQuarter) < 0.025, 'quantized authority must land on an exact cardinal grid target');

  const geometryModule = await import(`${pathToFileURL(find('CenterEmitterGeometry.js')).href}?v=${Date.now()}`);
  const emitterGeometry = geometryModule.createCenterEmitterGeometry();
  geometryModule.updateCenterEmitterGeometry(emitterGeometry, { minSide: 1080, energy: 0.6, coreRadius: 230 });
  assert.ok(emitterGeometry.minimumOriginRadius > 0, 'center emitter must never begin at the exact x/y origin');
  assert.ok(emitterGeometry.maximumOriginRadius < emitterGeometry.centerGlowRadius, 'center emitter shell must remain inside Center Glow geometry');
  assert.ok(emitterGeometry.emitterBand < emitterGeometry.emitterRadius * 0.25, 'center emitter must remain a narrow shell');

  const { SparkCometRuntime } = await import(`${pathToFileURL(find('SparkCometRuntime.js')).href}?v=${Date.now()}`);
  const sparks = new SparkCometRuntime(32);
  const hit = {
    dt: 1 / 60,
    width: 1920,
    height: 1080,
    originRadius: 200,
    emitterRadius: emitterGeometry.emitterRadius,
    emitterBand: emitterGeometry.emitterBand,
    hue: 200,
    impact: 0.92,
    amps: 0.8,
    density: 0.8,
    dispersion: 0.9,
    bassEnergy: 0.95,
    highEnergy: 0.72,
    beatPulse: 1,
  };
  sparks.update(hit);
  assert.ok(sparks.activeCount > 0, 'strong impact should emit immediately');
  assert.ok(sparks.diagnostics.minimumBurstOriginRadius >= emitterGeometry.minimumOriginRadius - 0.001, 'spark births must stay outside the empty center core');
  assert.ok(sparks.diagnostics.maximumBurstOriginRadius <= emitterGeometry.maximumOriginRadius + 0.001, 'spark births must stay inside the shared emitter shell');
  assert.ok(sparks.diagnostics.lastBurstAngularCoverage > Math.PI, 'multi-particle bursts must distribute across more than half of the available 360-degree field');
  assert.ok(sparks.diagnostics.centerBurstImpulse > 0, 'a burst must publish one shared Center Glow impulse');
  const firstBurstCount = sparks.diagnostics.emittedBursts;
  for (let i = 0; i < 18; i += 1) sparks.update({ ...hit, impact: 0.2, bassEnergy: 0.34, highEnergy: 0.18, beatPulse: 0 });
  sparks.update(hit);
  assert.ok(sparks.diagnostics.emittedBursts > firstBurstCount, 'detector must rearm and emit a second musical hit');
  assert.ok(sparks.diagnostics.maximumActive > 0, 'maximum-active diagnostic must be recorded');
  for (let i = 0; i < 150; i += 1) sparks.update({ ...hit, impact: 0.2, bassEnergy: 0.12, highEnergy: 0.08, beatPulse: 0 });
  assert.equal(sparks.activeCount, 0, 'faster comets must drain the active pool after the burst');

  const budgetSparks = new SparkCometRuntime(64);
  for (let i = 0; i < 120; i += 1) {
    budgetSparks.update({ ...hit, impact: 0, bassEnergy: 0.08, highEnergy: 0.05, beatPulse: 0, frameTimeMs: 40 });
  }
  assert.equal(budgetSparks.diagnostics.qualityTier, 'critical', 'sustained frame pressure must lower Spark quality');
  for (let i = 0; i < 12; i += 1) budgetSparks.emit(1, { ...hit, frameTimeMs: 40 });
  assert.ok(budgetSparks.activeCount <= 8, 'critical Spark quality must cap simultaneous comets at eight');
  assert.ok(budgetSparks.diagnostics.droppedParticles > 0, 'over-budget particles must be counted instead of accumulated');

  const mockContext = {
    save() {}, restore() {}, rotate() {}, translate() {}, drawImage() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
    globalCompositeOperation: 'source-over', lineCap: 'round', lineWidth: 1,
    strokeStyle: '', fillStyle: '', globalAlpha: 1,
  };
  budgetSparks.render(mockContext, { ...hit, frameTimeMs: 40 });
  assert.ok(budgetSparks.diagnostics.renderMs >= 0, 'Spark render timing diagnostic must be published');

  const sparkRuntimeSource = fs.readFileSync('src/app/runtime/visualizer/renderers/SparkCometRuntime.ts', 'utf8');
  const sparkAtlasSource = fs.readFileSync('src/app/runtime/visualizer/renderers/SparkCometSpriteAtlas.ts', 'utf8');
  assert.ok(!sparkRuntimeSource.includes('createLinearGradient'), 'frame render path must not allocate gradients');
  assert.ok(!sparkRuntimeSource.includes('shadowBlur'), 'frame render path must not mutate expensive shadow blur per particle');
  assert.ok(sparkRuntimeSource.includes('drawImage'), 'frame render path must use cached comet sprites');
  assert.ok(sparkAtlasSource.includes('OffscreenCanvas') && sparkAtlasSource.includes('createLinearGradient'), 'sprite atlas must pre-render worker-safe comet sprites');
  budgetSparks.dispose();

  const { RuntimeAudioSoakMonitor } = await import(`${pathToFileURL(find('RuntimeAudioSoakMonitor.js')).href}?v=${Date.now()}`);
  const resources = {
    activeRuntimeSessions: 1,
    activeRafSchedulers: 1,
    activeAudioContexts: 1,
    activeWebGLContexts: 1,
    activeListeners: 10,
    activeTimers: 0,
    activeIdleCallbacks: 0,
  };
  const soak = new RuntimeAudioSoakMonitor(1000);
  soak.update(0, true, resources, 120, sparks.diagnostics);
  const completed = soak.update(1000, true, resources, 121, sparks.diagnostics);
  assert.equal(completed.status, 'complete');
  assert.deepEqual(completed.resourceDelta, {
    activeRuntimeSessions: 0,
    activeRafSchedulers: 0,
    activeAudioContexts: 0,
    activeWebGLContexts: 0,
    activeListeners: 0,
    activeTimers: 0,
    activeIdleCallbacks: 0,
  }, 'audio soak must capture stable before/after resource counters');

  sparks.dispose();
  console.log('Cardinal rotation, Spark retrigger, and audio-soak diagnostics tests passed');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
